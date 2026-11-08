"""The image check (Story 2.1a): run inside the built step-1 image in CI.

    python -m peerless_ingest.image_check <fixtures/documents>

1. `tesseract --version` reports 5.5.x.
2. nor.traineddata under TESSDATA_PREFIX has the pinned sha256.
3. The read of every `<stem>.pdf` that has an `expected-<stem>.json`
   (recognised in the image, then `read_words`, as `read_document` does) gives
   exactly that JSON: the same JSON the host tests reach from the recorded
   Tesseract output, so the two reads agree.
4. Where `<stem>.p<n>.digits.tsv` is recorded, the digits-only pass's
   figures from the image equal those from the recording. The expected JSON
   holds no digits-only figure, so without this a broken digits-only pass
   would go unseen.
5. The OCR word cache (Story 2.5d): each PDF is read twice more through a
   fresh cache with the key read in the image. The first read misses and
   stores the words, the second must be a hit and give exactly the same
   JSON.

Exits 0 when all hold, 1 otherwise, printing each mismatch.
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from pathlib import Path

from . import config, layout, ocr_cache
from .documents import parse_pages, read_document, read_words, recognise, to_json
from .ocr import NOR_TRAINEDDATA_SHA256, PageWords, model_sha256, read_tsv, tesseract_version

VERSION = re.compile(r"^tesseract 5\.5\.\d+")


def differences(got: object, want: object, where: str = "") -> list[str]:
    """Every path at which two JSON values differ, a key missing on either
    side included (a missing key is not the same as null)."""
    if isinstance(got, dict) and isinstance(want, dict):
        out: list[str] = []
        for key in sorted(set(got) | set(want), key=str):
            if key not in got:
                out.append(f"{where}.{key}: missing from the read")
            elif key not in want:
                out.append(f"{where}.{key}: not in the expected JSON")
            else:
                out += differences(got[key], want[key], f"{where}.{key}")
        return out
    return [] if got == want and type(got) is type(want) else [f"{where}: read {got!r}, expected {want!r}"]


def recorded_pages(fixtures: Path, stem: str) -> list[PageWords]:
    """The recorded plain and digits-only TSVs of `stem`, page by page;
    empty when none are recorded."""
    pages: list[PageWords] = []
    for n in range(2, 10):
        plain, digits = fixtures / f"{stem}.p{n}.plain.tsv", fixtures / f"{stem}.p{n}.digits.tsv"
        if not (plain.is_file() and digits.is_file()):
            break
        pages.append(PageWords(read_tsv(plain.read_text(encoding="utf-8")), read_tsv(digits.read_text(encoding="utf-8"))))
    return pages


def digits_figures(pages: list[PageWords]) -> dict[str, list[int | None]]:
    """What the digits-only pass reads per field, as JSON values."""
    return {k: list(v) for k, v in layout.extract(parse_pages(pages, "digits")).items()}


def digits_differences(read: list[PageWords], recorded: list[PageWords]) -> list[str]:
    return [f".digits_pass{d}" for d in differences(digits_figures(read), digits_figures(recorded))]


def cached_differences(pdf: bytes, want: object, bound: int) -> list[str]:
    """Reads `pdf` twice through a fresh OCR word cache with the key read in
    the image: the first read must miss (absent) and store, the second must
    hit, and both must give `want`."""
    out: list[str] = []
    try:
        settings = ocr_cache.current_settings()
    except ocr_cache.KeyUnavailable as error:
        return [f".cache: key not readable: {error}"]
    with tempfile.TemporaryDirectory(prefix="peerless-ocr-cache-") as tmp:
        cache = ocr_cache.Cache(Path(tmp), settings)
        first = to_json(read_document(pdf, bound, cache))
        second = to_json(read_document(pdf, bound, cache))
        counts = cache.counts
        if (counts.miss_absent, counts.hit, counts.write_failed) != (1, 1, 0):
            out.append(
                f".cache: expected one absent miss, one hit and no failed write; got {counts.miss_absent} absent,"
                f" {counts.hit} hits, {counts.miss_key} key, {counts.miss_unreadable} unreadable, {counts.write_failed} failed writes"
            )
        out += [f".cache.first{d}" for d in differences(first, want)]
        out += [f".cache.hit{d}" for d in differences(second, want)]
    return out


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: python -m peerless_ingest.image_check <fixtures/documents>")
        return 2
    fixtures = Path(argv[0])
    failures: list[str] = []
    # The within-document bound the run uses: [reconciliation] in the
    # image's config.toml (Story 2.2).
    bound = config.load_config(Path(os.environ.get("PEERLESS_INGEST_CONFIG", config.DEFAULT_CONFIG))).within_document_bound_kr

    version = tesseract_version()
    print(f"tesseract: {version}")
    if not VERSION.match(version):
        failures.append(f"tesseract is not 5.5.x: {version!r}")

    sha = model_sha256()
    if sha != NOR_TRAINEDDATA_SHA256:
        failures.append(f"nor.traineddata sha256 {sha or '(missing)'} != {NOR_TRAINEDDATA_SHA256}")

    expected_files = sorted(fixtures.glob("expected-*.json"))
    if not expected_files:
        failures.append(f"no expected-*.json in {fixtures}")
    for expected in expected_files:
        stem = expected.stem.removeprefix("expected-")
        pdf = fixtures / f"{stem}.pdf"
        if not pdf.is_file():
            failures.append(f"{stem}: no {pdf.name}")
            continue
        top, pages = recognise(pdf.read_bytes())
        got = to_json(read_words(top, pages, bound))
        want = json.loads(expected.read_text(encoding="utf-8"))
        diff = differences(got, want)
        recorded = recorded_pages(fixtures, stem)
        if recorded:
            diff += digits_differences(pages, recorded)
        print(f"{stem}: {'matches' if not diff else f'{len(diff)} difference(s)'}")
        cached = cached_differences(pdf.read_bytes(), want, bound)
        print(f"{stem}, through the OCR word cache: {'a hit, matches' if not cached else f'{len(cached)} difference(s)'}")
        diff += cached
        failures += [f"{stem}{d}" for d in diff]

    for failure in failures:
        print(f"FAIL {failure}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
