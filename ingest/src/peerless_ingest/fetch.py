"""Requests to the Brønnøysund register, behind an injectable transport.

The run uses `UrllibTransport`; the tests pass a transport that replays
recorded responses and never opens a socket. Step 1 runs as a batch job and
is never in a user's request path: no document is fetched outside it.
"""

from __future__ import annotations

import gzip
import http.client
import io
import json
import re
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from contextlib import AbstractContextManager, contextmanager
from typing import BinaryIO, Protocol

from . import parse

ACCEPT_JSON = "application/json"
# The bulk download of every unit in Enhetsregisteret: one gzipped JSON
# array, refreshed daily (docs/data-sources-brreg.md, "Open questions").
ACCEPT_BULK_UNITS = "application/vnd.brreg.enhetsregisteret.enhet.v2+gzip;charset=UTF-8"
BULK_CHUNK_CHARS = 1 << 20
# The register answers a filed document with Content-Type application/pdf,
# but refuses `Accept: application/pdf` with 406 Not Acceptable (verified
# 2026-10-20 on 813235552/2025); it serves the PDF for octet-stream.
ACCEPT_DOCUMENT = "application/octet-stream"
# The filed annual-accounts documents (docs/data-sources-brreg.md, "Endpoints").
KOPI_PATH = "regnskapsregisteret/regnskap/aarsregnskap/kopi"
YEAR = re.compile(r"^[0-9]{4}$")

RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


class Transport(Protocol):
    def get(self, url: str, accept: str) -> bytes | None:
        """The response body, or None when the register answers 404 or 410."""
        ...

    def stream(self, url: str, accept: str) -> AbstractContextManager[BinaryIO]:
        """A context manager yielding the response body as a binary stream."""
        ...


class UrllibTransport:
    """HTTP with a User-Agent, backoff on 429 and 5xx, and a pause after
    every request so a full run does not hammer the register."""

    def __init__(self, user_agent: str, pause_seconds: float, attempts: int = 5, timeout: float = 60) -> None:
        self.user_agent = user_agent
        self.pause_seconds = pause_seconds
        self.attempts = attempts
        self.timeout = timeout

    def _request(self, url: str, accept: str) -> urllib.request.Request:
        return urllib.request.Request(url, headers={"Accept": accept, "User-Agent": self.user_agent})

    def _retry_or_raise(self, attempt: int) -> None:
        """Back off before the next attempt, or re-raise the current
        exception when the attempts are used up."""
        if attempt >= self.attempts - 1:
            raise
        time.sleep(2**attempt)

    def get(self, url: str, accept: str) -> bytes | None:
        try:
            for attempt in range(self.attempts):
                try:
                    with urllib.request.urlopen(self._request(url, accept), timeout=self.timeout) as response:
                        return response.read()
                except urllib.error.HTTPError as error:
                    # 410 Gone is a withdrawn unit. Deleting it is Story 2.4;
                    # here it is simply not loaded.
                    if error.code in (404, 410):
                        return None
                    if error.code not in RETRY_STATUSES:
                        raise
                    self._retry_or_raise(attempt)
                except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ConnectionError):
                    # Also errors while reading the body: IncompleteRead is an
                    # HTTPException, not an OSError.
                    self._retry_or_raise(attempt)
            raise RuntimeError("unreachable")
        finally:
            time.sleep(self.pause_seconds)

    @contextmanager
    def stream(self, url: str, accept: str) -> Iterator[BinaryIO]:
        # Long download: a generous timeout per read. Opening the request is
        # retried like `get`; there is no retry mid-stream.
        for attempt in range(self.attempts):
            try:
                response = urllib.request.urlopen(self._request(url, accept), timeout=600)
                break
            except urllib.error.HTTPError as error:
                if error.code not in RETRY_STATUSES:
                    raise
                self._retry_or_raise(attempt)
            except urllib.error.URLError:
                self._retry_or_raise(attempt)
        else:
            raise RuntimeError("unreachable")
        with response:
            yield response


def iter_bulk_units(transport: Transport, base_url: str) -> Iterator[dict]:
    """Every unit in Enhetsregisteret, from the gzipped bulk download, one at
    a time. The paged search cannot replace it: it stops at 10 000 results."""
    url = f"{base_url}/enhetsregisteret/api/enheter/lastned"
    with transport.stream(url, ACCEPT_BULK_UNITS) as raw:
        with gzip.GzipFile(fileobj=raw) as unzipped:
            text = io.TextIOWrapper(unzipped, encoding="utf-8")
            chunks = iter(lambda: text.read(BULK_CHUNK_CHARS), "")
            for unit in parse.iter_json_array(chunks):
                if not isinstance(unit, dict):
                    raise ValueError("bulk download holds a non-object element")
                yield unit


def fetch_unit(transport: Transport, base_url: str, orgnr: str) -> dict | None:
    """One unit from Enhetsregisteret, or None when the register has none."""
    body = transport.get(f"{base_url}/enhetsregisteret/api/enheter/{orgnr}", ACCEPT_JSON)
    if body is None:
        return None
    unit = json.loads(body)
    if not isinstance(unit, dict):
        raise ValueError(f"unit {orgnr}: expected a JSON object")
    return unit


def fetch_filings(transport: Transport, base_url: str, orgnr: str) -> list[dict]:
    """Every key-figures filing the register returns for `orgnr` (several
    years, SELSKAP and KONSERN). No year is requested: the register ignores
    the parameter, so each filing's year is read from its own
    `regnskapsperiode`. An empty list when the register has none."""
    body = transport.get(f"{base_url}/regnskapsregisteret/regnskap/{orgnr}", ACCEPT_JSON)
    if body is None:
        return []
    return parse.load_filings_json(body)


def fetch_document_years(transport: Transport, base_url: str, orgnr: str) -> list[int] | None:
    """The years the register holds a filed document for, as its `/aar` list
    gives them (`["2011", …, "2025"]`), sorted, or None when it answers 404
    or 410. Each year is the one used in that document's path; no year is
    ever sent as the `år` query parameter, which the register ignores."""
    body = transport.get(f"{base_url}/{KOPI_PATH}/{orgnr}/aar", ACCEPT_JSON)
    if body is None:
        return None
    years = json.loads(body)
    if not isinstance(years, list) or not all(isinstance(year, str) and YEAR.match(year) for year in years):
        raise ValueError(f"document years {orgnr}: expected a JSON list of four-digit year strings")
    return sorted({int(year) for year in years})


def fetch_document(transport: Transport, base_url: str, orgnr: str, year: int) -> bytes | None:
    """The filed document for `year` as PDF bytes, or None when the register
    answers 404 or 410. A body that is not a PDF raises ValueError."""
    body = transport.get(f"{base_url}/{KOPI_PATH}/{orgnr}/{year}", ACCEPT_DOCUMENT)
    if body is None:
        return None
    if not body.startswith(b"%PDF-"):
        raise ValueError(f"document {orgnr}/{year}: the body is not a PDF")
    return body
