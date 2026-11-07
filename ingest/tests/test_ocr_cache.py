"""The OCR word cache (Story 2.5d): an exact key match reads the stored
words, and anything else runs OCR and is counted.

`documents.recognise` stands in for Tesseract (`FakeRecognise`), so a test
sees whether OCR ran. No Tesseract, no database, no network.
"""

from __future__ import annotations

import dataclasses
import gzip
import hashlib
import json
from pathlib import Path

import pytest

from conftest import BOUND_KR
from document_fakes import DOCUMENTS, TEST_SETTINGS, FakeRecognise, cache_in, paper_top, recorded_979607008_2025
from peerless_ingest import documents, ocr, ocr_cache

STEM = "979607008-2025"
PDF = (DOCUMENTS / f"{STEM}.pdf").read_bytes()
PDF_SHA256 = hashlib.sha256(PDF).hexdigest()


def expected_json() -> dict[str, object]:
    loaded: dict[str, object] = json.loads((DOCUMENTS / f"expected-{STEM}.json").read_text(encoding="utf-8"))
    return loaded


def entry(directory: Path) -> dict[str, object]:
    loaded: dict[str, object] = json.loads(gzip.decompress(ocr_cache.entry_path(directory, PDF_SHA256).read_bytes()))
    return loaded


def test_hit_reads_the_same_as_tesseract(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # The recorded words of 979607008-2025, read through Tesseract (the fake)
    # and stored, then read from the cache: the same DocumentRead, equal to
    # the expected JSON, with no Tesseract call on the hit.
    reader = FakeRecognise(monkeypatch, {PDF: recorded_979607008_2025()})
    cache = cache_in(tmp_path)

    first = documents.read_document(PDF, BOUND_KR, cache)
    assert reader.calls == [PDF]
    second = documents.read_document(PDF, BOUND_KR, cache)

    assert reader.calls == [PDF]  # no Tesseract call on the hit
    assert second == first == documents.read_words(*recorded_979607008_2025(), BOUND_KR)
    assert documents.to_json(second) == expected_json()
    assert (cache.counts.hit, cache.counts.miss_absent, cache.counts.miss_key, cache.counts.miss_unreadable) == (1, 1, 0, 0)
    assert cache.counts.record()["ocr_cache_hit"] == 1


def test_absent_runs_ocr_and_writes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    reader = FakeRecognise(monkeypatch, {PDF: recorded_979607008_2025()})
    cache = cache_in(tmp_path / "cache")  # not yet created: the first store creates it

    documents.read_document(PDF, BOUND_KR, cache)

    assert reader.calls == [PDF]
    assert cache.counts.miss_absent == 1 and cache.counts.hit == 0
    stored = entry(tmp_path / "cache")
    assert stored["key"] == ocr_cache.Key.of(PDF, TEST_SETTINGS).as_json()
    top, pages = recorded_979607008_2025()
    assert stored["top"] == [[w.text, w.left, w.top, w.width, w.height, list(w.line)] for w in top]
    assert isinstance(stored["pages"], list) and len(stored["pages"]) == len(pages)
    # Only the entry: the temporary file was renamed, not left behind.
    assert [p.name for p in (tmp_path / "cache").iterdir()] == [f"{PDF_SHA256}.json.gz"]


def differing(part: str) -> dict[str, object]:
    """The key of PDF with one part changed."""
    key = ocr_cache.Key.of(PDF, TEST_SETTINGS).as_json()
    changed = {
        "pdf_sha256": "0" * 64,
        "tesseract": "tesseract 5.4.1",
        "traineddata_sha256": "f" * 64,
        "render": {**ocr_cache.render_settings(), "zoom": 3.0},
        "plain_args": ["-l", "nor", "--psm", "4"],
        "digits_args": [*ocr.PLAIN_ARGS, "-c", "tessedit_char_whitelist=0123456789"],
    }
    assert set(changed) == set(ocr_cache.KEY_PARTS)
    return {**key, part: changed[part]}


@pytest.mark.parametrize("part", ocr_cache.KEY_PARTS)
def test_key_part_differs_runs_ocr(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, part: str) -> None:
    # An entry whose key differs in one part (each part in turn) is never
    # used: full OCR runs, the entry is replaced, and the part is named.
    ocr_cache.store(tmp_path, ocr_cache.Key.of(PDF, TEST_SETTINGS), paper_top(), [])
    path = ocr_cache.entry_path(tmp_path, PDF_SHA256)
    body = entry(tmp_path)
    body["key"] = differing(part)
    path.write_bytes(gzip.compress(json.dumps(body).encode("utf-8")))
    reader = FakeRecognise(monkeypatch, {PDF: recorded_979607008_2025()})
    cache = cache_in(tmp_path)

    read = documents.read_document(PDF, BOUND_KR, cache)

    assert reader.calls == [PDF]
    assert read.layout == "generated"  # the stored paper words were not used
    assert (cache.counts.hit, cache.counts.miss_key) == (0, 1)
    assert cache.counts.record()["ocr_cache_miss_key_parts"] == {part: 1}
    assert entry(tmp_path)["key"] == ocr_cache.Key.of(PDF, TEST_SETTINGS).as_json()


def test_settings_change_misses(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # The same entry read by a run whose Tesseract differs: a miss, never a
    # repaired key.
    FakeRecognise(monkeypatch, {PDF: recorded_979607008_2025()})
    documents.read_document(PDF, BOUND_KR, cache_in(tmp_path))
    other = ocr_cache.Cache(tmp_path, dataclasses.replace(TEST_SETTINGS, tesseract="tesseract 5.5.1"))
    documents.read_document(PDF, BOUND_KR, other)
    assert other.counts.record()["ocr_cache_miss_key_parts"] == {"tesseract": 1}


@pytest.mark.parametrize(
    "content",
    [
        "truncated gzip",
        "bad json",
        "not an entry",
        "a word malformed",
    ],
)
def test_unreadable_entry_is_a_miss(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, content: str) -> None:
    ocr_cache.store(tmp_path, ocr_cache.Key.of(PDF, TEST_SETTINGS), *recorded_979607008_2025())
    path = ocr_cache.entry_path(tmp_path, PDF_SHA256)
    good = path.read_bytes()
    if content == "truncated gzip":
        path.write_bytes(good[: len(good) // 2])
    elif content == "bad json":
        path.write_bytes(gzip.compress(b'{"key": '))
    elif content == "not an entry":
        path.write_bytes(gzip.compress(b"[1, 2, 3]"))
    else:
        body = entry(tmp_path)
        body["top"] = [["Resultatregnskap", 1, 2, 3, True, [1, 1, 1, 1]]]
        path.write_bytes(gzip.compress(json.dumps(body).encode("utf-8")))
    reader = FakeRecognise(monkeypatch, {PDF: recorded_979607008_2025()})
    heard: list[str] = []
    cache = dataclasses.replace(cache_in(tmp_path), notify=heard.append)

    read = documents.read_document(PDF, BOUND_KR, cache)

    assert reader.calls == [PDF]
    assert documents.to_json(read) == expected_json()
    assert (cache.counts.hit, cache.counts.miss_unreadable) == (0, 1)
    assert len(heard) == 1 and heard[0].startswith(f"OCR cache entry {PDF_SHA256} unreadable, read by OCR: ")
    # Replaced by a good entry: the next read is a hit.
    documents.read_document(PDF, BOUND_KR, cache)
    assert cache.counts.hit == 1 and reader.calls == [PDF]


def test_paper_filing_cached(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # Only the top was recognised: pages == [], stored and read back as a
    # paper filing.
    reader = FakeRecognise(monkeypatch, {PDF: (paper_top(), [])})
    cache = cache_in(tmp_path)
    first = documents.read_document(PDF, BOUND_KR, cache)
    second = documents.read_document(PDF, BOUND_KR, cache)
    assert reader.calls == [PDF]
    assert first == second and second.layout == "paper"
    assert entry(tmp_path)["pages"] == []
    assert cache.counts.hit == 1


def test_a_failed_write_is_counted_and_the_read_goes_on(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    FakeRecognise(monkeypatch, {PDF: recorded_979607008_2025()})
    blocked = tmp_path / "file"
    blocked.write_text("not a directory", encoding="utf-8")
    heard: list[str] = []
    cache = dataclasses.replace(cache_in(blocked), notify=heard.append)

    read = documents.read_document(PDF, BOUND_KR, cache)

    assert documents.to_json(read) == expected_json()
    assert (cache.counts.miss_absent, cache.counts.write_failed) == (1, 1)
    assert len(heard) == 1 and "not written" in heard[0]


def test_no_cache_reads_by_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    reader = FakeRecognise(monkeypatch, {PDF: recorded_979607008_2025()})
    documents.read_document(PDF, BOUND_KR)
    documents.read_document(PDF, BOUND_KR)
    assert reader.calls == [PDF, PDF]
    assert ocr_cache.record_of(None) == {"ocr_cache": "off"}


def test_key_values_read_at_run_time(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # The key's Tesseract version and model hash come from the running
    # system, not from constants: a different model file is a different key.
    model = tmp_path / "nor.traineddata"
    model.write_bytes(b"a model")
    monkeypatch.setenv("TESSDATA_PREFIX", str(tmp_path))
    monkeypatch.setattr(ocr, "tesseract_version", lambda: "tesseract 9.9.9")
    settings = ocr_cache.current_settings()
    assert settings.tesseract == "tesseract 9.9.9"
    assert settings.traineddata_sha256 == hashlib.sha256(b"a model").hexdigest()
    assert settings.plain_args == tuple(ocr.PLAIN_ARGS) and settings.digits_args == tuple(ocr.DIGITS_ARGS)
    assert settings.render == ocr_cache.render_settings()

    cache = ocr_cache.from_env({ocr_cache.CACHE_ENV: str(tmp_path / "c")}, lambda _m: None)
    assert cache is not None and cache.settings == settings
    assert ocr_cache.from_env({}, lambda _m: None) is None

    model.unlink()
    with pytest.raises(ocr_cache.KeyUnavailable):
        ocr_cache.current_settings()
    model.write_bytes(b"a model")
    monkeypatch.setattr(ocr, "tesseract_version", lambda: "")
    with pytest.raises(ocr_cache.KeyUnavailable):
        ocr_cache.current_settings()
