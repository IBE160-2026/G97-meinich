"""Filed documents for the document-pass tests (Story 2.1b), with no Tesseract.

`FakeRecognise` replaces `documents.recognise`: each PDF body the transport
serves maps to the words Tesseract would have returned, either the recorded
979607008/2025 output (`fixtures/documents/*.tsv`) or a statement built by
`tsv_builder`. `documents.read_document` and everything after it run for
real, so the read, the outcome and the write are the ones the image runs.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import pytest

from peerless_ingest import documents
from peerless_ingest.ocr import PageWords, Word, read_tsv
from tsv_builder import BASE_ROWS, document, label_words, words

DOCUMENTS = Path(__file__).resolve().parent / "fixtures" / "documents"

Recognised = tuple[list[Word], list[PageWords]]


def recorded_979607008_2025() -> Recognised:
    """The recorded Tesseract output of the committed 979607008/2025 PDF."""

    def tsv(name: str) -> list[Word]:
        return read_tsv((DOCUMENTS / name).read_text(encoding="utf-8"))

    stem = "979607008-2025"
    pages = [PageWords(tsv(f"{stem}.p{n}.plain.tsv"), tsv(f"{stem}.p{n}.digits.tsv")) for n in (2, 3, 4, 5)]
    return tsv(f"{stem}.top.tsv"), pages


def generated(year: int, unit_line: str = "Beløp i: NOK") -> Recognised:
    """A generated statement whose headers state `year` and `year - 1`: the
    979607008/2025 check rows, one consistent column each."""
    return document(BASE_ROWS, years=(str(year), str(year - 1)), unit_line=unit_line)


def paper_top() -> list[Word]:
    """Page 1's top of a paper filing: the cover form "VEDLEGG TIL"."""
    return words([label_words("Brønnøysundregistrene"), label_words("VEDLEGG TIL ÅRSREGNSKAPET FOR 2011")])


def pdf(tag: str) -> bytes:
    """A body the fetch accepts as a PDF. Its bytes key FakeRecognise."""
    return f"%PDF-1.4 fixture {tag}".encode()


class FakeRecognise:
    """Stands in for `documents.recognise`. Records every body it is asked
    to read, so a test can assert that nothing is read twice."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch, reads: dict[bytes, Recognised | Callable[[], Recognised]]) -> None:
        self.reads = reads
        self.calls: list[bytes] = []
        monkeypatch.setattr(documents, "recognise", self)

    def __call__(self, body: bytes) -> Recognised:
        self.calls.append(body)
        if body not in self.reads:
            raise AssertionError(f"unexpected document read: {body[:40]!r}")
        found = self.reads[body]
        return found() if callable(found) else found
