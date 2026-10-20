"""Shared test setup for step 1.

- No outbound network from Python: a Python socket connection or name
  lookup for a host other than the local machine fails, so a test that
  reaches the register fails loudly. The guard covers Python sockets only:
  libpq (under psycopg) connects in C and is not seen by it; it is held to
  the local database by INGEST_DATABASE_URL.
- `FixtureTransport` replays recorded register responses from
  tests/fixtures/recorded (Brønnøysundregistrene, NLOD 2.0), and the filed
  documents' `kopi` URLs (`aar_url`, `kopi_url`) from the bodies a test gives.
- `db` is a connection as `ingest` (INGEST_DATABASE_URL) inside a transaction
  that is always rolled back: the tests leave no rows behind, and `ingest`
  never needs DELETE.
"""

from __future__ import annotations

import gzip
import io
import ipaddress
import os
import socket
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import BinaryIO

import psycopg
import pytest

from peerless_ingest.config import Config, DemoCompany

TESTS = Path(__file__).resolve().parent
RECORDED = TESTS / "fixtures" / "recorded"
REPO_ROOT = TESTS.parents[1]

BASE_URL = "https://register.fixture.invalid"


# --- No outbound network ------------------------------------------------------

LOCAL_NAMES = {"localhost", "host.docker.internal"}


def _is_local(host: object) -> bool:
    if not isinstance(host, str):
        return False
    if host in LOCAL_NAMES:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


class NetworkBlocked(RuntimeError):
    pass


_real_connect = socket.socket.connect
_real_connect_ex = socket.socket.connect_ex
_real_getaddrinfo = socket.getaddrinfo


def _guarded_connect(self: socket.socket, address: object) -> None:
    host = address[0] if isinstance(address, tuple) else None
    if self.family in (socket.AF_INET, socket.AF_INET6) and not _is_local(host):
        raise NetworkBlocked(f"outbound network in a test: {address!r}")
    return _real_connect(self, address)  # type: ignore[arg-type]


def _guarded_connect_ex(self: socket.socket, address: object) -> int:
    host = address[0] if isinstance(address, tuple) else None
    if self.family in (socket.AF_INET, socket.AF_INET6) and not _is_local(host):
        raise NetworkBlocked(f"outbound network in a test: {address!r}")
    return _real_connect_ex(self, address)  # type: ignore[arg-type]


def _guarded_getaddrinfo(host: object, *args: object, **kwargs: object) -> object:
    if host is not None and not _is_local(host if isinstance(host, str) else None):
        raise NetworkBlocked(f"name lookup in a test: {host!r}")
    return _real_getaddrinfo(host, *args, **kwargs)  # type: ignore[arg-type]


def pytest_configure(config: pytest.Config) -> None:
    socket.socket.connect = _guarded_connect  # type: ignore[method-assign]
    socket.socket.connect_ex = _guarded_connect_ex  # type: ignore[method-assign]
    socket.getaddrinfo = _guarded_getaddrinfo  # type: ignore[assignment]


# --- Recorded responses ---------------------------------------------------------


def recorded(name: str) -> bytes:
    return (RECORDED / name).read_bytes()


class FixtureTransport:
    """Serves recorded bodies by URL. An unexpected URL fails the test, so a
    request step 1 should not make (a secondary-code company's accounts, a
    filed document) is caught."""

    def __init__(self, responses: dict[str, bytes | None], bulk: bytes | None = None) -> None:
        self.responses = responses
        self.bulk = bulk
        self.requested: list[str] = []

    def get(self, url: str, accept: str) -> bytes | None:
        self.requested.append(url)
        if url not in self.responses:
            raise AssertionError(f"unexpected request: {url}")
        return self.responses[url]

    @contextmanager
    def stream(self, url: str, accept: str) -> Iterator[BinaryIO]:
        self.requested.append(url)
        if self.bulk is None or not url.endswith("/enhetsregisteret/api/enheter/lastned"):
            raise AssertionError(f"unexpected stream: {url}")
        yield io.BytesIO(gzip.compress(self.bulk))


def regnskap_url(orgnr: str) -> str:
    return f"{BASE_URL}/regnskapsregisteret/regnskap/{orgnr}"


def enhet_url(orgnr: str) -> str:
    return f"{BASE_URL}/enhetsregisteret/api/enheter/{orgnr}"


def aar_url(orgnr: str) -> str:
    """The register's list of years with a filed document."""
    return f"{BASE_URL}/regnskapsregisteret/regnskap/aarsregnskap/kopi/{orgnr}/aar"


def kopi_url(orgnr: str, year: int) -> str:
    """One filed document, by the year in its path."""
    return f"{BASE_URL}/regnskapsregisteret/regnskap/aarsregnskap/kopi/{orgnr}/{year}"


@pytest.fixture
def cfg() -> Config:
    return Config(
        base_url=BASE_URL,
        user_agent="peerless-tests",
        request_pause_seconds=0,
        demo_company_c=DemoCompany(orgnr="967534579", navn="KANTALL AS"),
    )


# --- Database -------------------------------------------------------------------


def _from_dotenv(name: str) -> str | None:
    path = REPO_ROOT / ".env"
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip() == name and value.strip():
            return value.strip()
    return None


def ingest_database_url() -> str | None:
    return os.environ.get("INGEST_DATABASE_URL") or _from_dotenv("INGEST_DATABASE_URL")


@pytest.fixture
def db() -> Iterator[psycopg.Connection]:
    url = ingest_database_url()
    if url is None:
        if os.environ.get("CI"):
            pytest.fail("INGEST_DATABASE_URL is not set; CI must run `pnpm db:roles` before the step-1 tests")
        pytest.skip("INGEST_DATABASE_URL is not set: start the local database and run `pnpm db:roles`")
    with psycopg.connect(url) as conn:
        with conn.transaction() as tx:
            yield conn
            raise psycopg.Rollback(tx)
