"""UrllibTransport: retries and absence, with urlopen and time.sleep patched.
No network."""

from __future__ import annotations

import http.client
import io
import urllib.error
from email.message import Message

import pytest

from peerless_ingest import fetch

URL = "https://register.fixture.invalid/regnskapsregisteret/regnskap/919951834"


class FakeResponse:
    def __init__(self, body: bytes | None = None, error: Exception | None = None) -> None:
        self.body = body
        self.error = error

    def read(self) -> bytes:
        if self.error is not None:
            raise self.error
        assert self.body is not None
        return self.body

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_: object) -> None:
        return None


def http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(URL, code, "status", Message(), io.BytesIO(b""))


@pytest.fixture
def sleeps(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    recorded: list[float] = []
    monkeypatch.setattr(fetch.time, "sleep", recorded.append)
    return recorded


def patch_urlopen(monkeypatch: pytest.MonkeyPatch, outcomes: list[object]) -> list[object]:
    """Each call to urlopen takes the next outcome: an exception is raised,
    a FakeResponse is returned."""
    calls: list[object] = []

    def urlopen(request: object, timeout: float) -> object:
        calls.append(request)
        outcome = outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(fetch.urllib.request, "urlopen", urlopen)
    return calls


def transport() -> fetch.UrllibTransport:
    return fetch.UrllibTransport("peerless-tests", pause_seconds=0.15, attempts=3)


@pytest.mark.parametrize("code", [404, 410])
def test_absent_unit_is_none(monkeypatch: pytest.MonkeyPatch, sleeps: list[float], code: int) -> None:
    calls = patch_urlopen(monkeypatch, [http_error(code)])
    assert transport().get(URL, fetch.ACCEPT_JSON) is None
    assert len(calls) == 1
    assert sleeps == [0.15]  # only the pause, no backoff


def test_503_is_retried_once(monkeypatch: pytest.MonkeyPatch, sleeps: list[float]) -> None:
    calls = patch_urlopen(monkeypatch, [http_error(503), FakeResponse(b"[]")])
    assert transport().get(URL, fetch.ACCEPT_JSON) == b"[]"
    assert len(calls) == 2
    assert sleeps == [1, 0.15]


def test_incomplete_read_is_retried(monkeypatch: pytest.MonkeyPatch, sleeps: list[float]) -> None:
    calls = patch_urlopen(
        monkeypatch,
        [FakeResponse(error=http.client.IncompleteRead(b"[")), FakeResponse(b"[]")],
    )
    assert transport().get(URL, fetch.ACCEPT_JSON) == b"[]"
    assert len(calls) == 2


def test_url_error_that_never_clears_is_raised(monkeypatch: pytest.MonkeyPatch, sleeps: list[float]) -> None:
    calls = patch_urlopen(monkeypatch, [urllib.error.URLError("down")] * 3)
    with pytest.raises(urllib.error.URLError):
        transport().get(URL, fetch.ACCEPT_JSON)
    assert len(calls) == 3
    assert sleeps == [1, 2, 0.15]


def test_other_http_error_is_raised_at_once(monkeypatch: pytest.MonkeyPatch, sleeps: list[float]) -> None:
    calls = patch_urlopen(monkeypatch, [http_error(400)])
    with pytest.raises(urllib.error.HTTPError):
        transport().get(URL, fetch.ACCEPT_JSON)
    assert len(calls) == 1


def test_stream_retries_opening(monkeypatch: pytest.MonkeyPatch, sleeps: list[float]) -> None:
    calls = patch_urlopen(monkeypatch, [http_error(502), urllib.error.URLError("x"), FakeResponse(b"body")])
    with transport().stream(URL, fetch.ACCEPT_BULK_UNITS) as response:
        assert response.read() == b"body"
    assert len(calls) == 3
    assert sleeps == [1, 2]


class RecordingTransport:
    """Records each request's URL and Accept header."""

    def __init__(self, body: bytes | None) -> None:
        self.body = body
        self.requests: list[tuple[str, str]] = []

    def get(self, url: str, accept: str) -> bytes | None:
        self.requests.append((url, accept))
        return self.body


def test_document_is_requested_as_octet_stream() -> None:
    # The register answers 406 to `Accept: application/pdf` (Story 2.1b,
    # found by the first run against it) and serves the PDF for octet-stream.
    transport = RecordingTransport(b"%PDF-1.4 body")
    assert fetch.fetch_document(transport, "https://register.fixture.invalid", "813235552", 2025) == b"%PDF-1.4 body"  # type: ignore[arg-type]
    assert transport.requests == [
        (
            "https://register.fixture.invalid/regnskapsregisteret/regnskap/aarsregnskap/kopi/813235552/2025",
            "application/octet-stream",
        )
    ]


def test_document_years_are_requested_as_json_and_parsed() -> None:
    transport = RecordingTransport(b'["2014", "2025", "2021"]')
    assert fetch.fetch_document_years(transport, "https://register.fixture.invalid", "813235552") == [2014, 2021, 2025]  # type: ignore[arg-type]
    assert transport.requests == [
        ("https://register.fixture.invalid/regnskapsregisteret/regnskap/aarsregnskap/kopi/813235552/aar", fetch.ACCEPT_JSON)
    ]
    for body in (b'{"2025": 1}', b"[2025]", b'["25"]'):
        with pytest.raises(ValueError):
            fetch.fetch_document_years(RecordingTransport(body), "https://x.invalid", "813235552")  # type: ignore[arg-type]
    assert fetch.fetch_document_years(RecordingTransport(None), "https://x.invalid", "813235552") is None  # type: ignore[arg-type]
    assert fetch.fetch_document(RecordingTransport(None), "https://x.invalid", "813235552", 2025) is None  # type: ignore[arg-type]
