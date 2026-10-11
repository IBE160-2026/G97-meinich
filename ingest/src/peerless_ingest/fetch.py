"""Requests to the Brønnøysund register, behind an injectable transport.

The run uses `UrllibTransport`; the tests pass a transport that replays
recorded responses and never opens a socket. Step 1 runs as a batch job and
is never in a user's request path.
"""

from __future__ import annotations

import gzip
import io
import json
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
                    if error.code in RETRY_STATUSES and attempt < self.attempts - 1:
                        time.sleep(2**attempt)
                        continue
                    raise
                except urllib.error.URLError:
                    if attempt < self.attempts - 1:
                        time.sleep(2**attempt)
                        continue
                    raise
            raise RuntimeError("unreachable")
        finally:
            time.sleep(self.pause_seconds)

    @contextmanager
    def stream(self, url: str, accept: str) -> Iterator[BinaryIO]:
        # Long download: a generous timeout per read, no retry mid-stream.
        with urllib.request.urlopen(self._request(url, accept), timeout=600) as response:
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
