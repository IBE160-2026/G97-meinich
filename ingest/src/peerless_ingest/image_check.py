"""The image check (Story 2.1a): run inside the built step-1 image in CI.

    python -m peerless_ingest.image_check <fixtures/documents>

1. `tesseract --version` reports 5.5.x.
2. nor.traineddata under TESSDATA_PREFIX has the pinned sha256.
3. `read_document` on every `<stem>.pdf` that has an `expected-<stem>.json`
   gives exactly that JSON: the same JSON the host tests reach from the
   recorded Tesseract output, so the two reads agree.

Exits 0 when all hold, 1 otherwise, printing each mismatch.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from .documents import read_document, to_json
from .ocr import NOR_TRAINEDDATA_SHA256

VERSION = re.compile(r"^tesseract 5\.5\.\d+")


def tesseract_version() -> str:
    result = subprocess.run(["tesseract", "--version"], capture_output=True, text=True, check=False)
    lines = (result.stdout or result.stderr).splitlines()
    return lines[0].strip() if lines else ""


def model_sha256() -> str:
    path = Path(os.environ.get("TESSDATA_PREFIX", "")) / "nor.traineddata"
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else ""


def differences(got: object, want: object, where: str = "") -> list[str]:
    """Every path at which two JSON values differ."""
    if isinstance(got, dict) and isinstance(want, dict):
        out: list[str] = []
        for key in sorted(set(got) | set(want)):
            out += differences(got.get(key), want.get(key), f"{where}.{key}")
        return out
    return [] if got == want and type(got) is type(want) else [f"{where}: read {got!r}, expected {want!r}"]


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: python -m peerless_ingest.image_check <fixtures/documents>")
        return 2
    fixtures = Path(argv[0])
    failures: list[str] = []

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
        got = to_json(read_document(pdf.read_bytes()))
        want = json.loads(expected.read_text(encoding="utf-8"))
        diff = differences(got, want)
        print(f"{stem}: {'matches' if not diff else f'{len(diff)} difference(s)'}")
        failures += [f"{stem}{d}" for d in diff]

    for failure in failures:
        print(f"FAIL {failure}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
