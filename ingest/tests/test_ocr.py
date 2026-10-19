"""OCR plumbing tests: the page list, the Tesseract call, the TSV reader.

No Tesseract runs here (the host needs none); the image check runs the real
engine in CI (`python -m peerless_ingest.image_check`).
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from peerless_ingest import ocr
from tsv_builder import HEADER


def test_page_list_is_lf(tmp_path: Path) -> None:
    # Spike error 2: a list written on Windows reached the container with
    # "\r" at the end of every filename. Written on any host, the bytes hold
    # no carriage return.
    images = [tmp_path / "p2.png", tmp_path / "p3.png", tmp_path / "p4.png"]
    target = tmp_path / "pages.plain.txt"
    ocr.write_page_list(images, target)
    data = target.read_bytes()
    assert b"\r" not in data
    assert data.endswith(b"\n")
    assert data.decode("utf-8").split("\n") == [str(p) for p in images] + [""]


def test_xargs_runs_tesseract_per_page_without_a_shell(tmp_path: Path) -> None:
    argv = ocr.xargs_argv(tmp_path / "pages.digits.txt", "digits", ocr.DIGITS_ARGS)
    assert argv[:5] == ["xargs", "-P", str(ocr.PARALLEL), "-a", str(tmp_path / "pages.digits.txt")]
    assert "sh" not in argv and "-c" not in argv[:6]
    tesseract = argv[argv.index("tesseract") :]
    assert tesseract == ["tesseract", "{}", "{}.digits", "-l", "nor", "--psm", "6",
                         "-c", "tessedit_char_whitelist=0123456789-", "tsv"]  # fmt: skip


def test_plain_pass_has_no_whitelist() -> None:
    assert ocr.PLAIN_ARGS == ("-l", "nor", "--psm", "6")
    assert not any("whitelist" in a for a in ocr.PLAIN_ARGS)


def test_read_tsv_keeps_only_words() -> None:
    text = "\n".join(
        [
            HEADER,
            "1\t1\t0\t0\t0\t0\t0\t0\t4320\t5780\t-1\t",
            "4\t1\t1\t1\t1\t0\t520\t300\t800\t45\t-1\t",
            "5\t1\t1\t1\t1\t1\t520\t300\t400\t45\t96.1\tSalgsinntekt",
            "5\t1\t1\t1\t1\t2\t2483\t300\t72\t45\t91.0\t71",
            "5\t1\t1\t1\t1\t3\t2600\t300\t72\t45\t10.0\t ",
        ]
    )
    words = ocr.read_tsv(text + "\n")
    assert [w.text for w in words] == ["Salgsinntekt", "71"]
    assert words[1].right == 2483 + 72
    assert words[0].line == (1, 1, 1, 1)


def test_model_hash_matches_the_dockerfile() -> None:
    # The build checks the same hash; the two must not drift apart.
    dockerfile = (Path(__file__).resolve().parents[1] / "Dockerfile").read_text(encoding="utf-8")
    assert f'echo "{ocr.NOR_TRAINEDDATA_SHA256}  ' in dockerfile


def test_tesseract_failure_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    image = tmp_path / "p2.png"
    image.write_bytes(b"")

    def failed(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[bytes]:
        return subprocess.CompletedProcess(argv, 123, b"", b"")

    monkeypatch.setattr(ocr.subprocess, "run", failed)
    with pytest.raises(ocr.OcrError, match="exit 123"):
        ocr._run([image], tmp_path, "plain", ocr.PLAIN_ARGS)


def test_missing_tsv_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    image = tmp_path / "p2.png"
    image.write_bytes(b"")

    def silent(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[bytes]:
        assert kwargs["env"]["OMP_THREAD_LIMIT"] == "1"  # type: ignore[index]
        return subprocess.CompletedProcess(argv, 0, b"", b"")

    monkeypatch.setattr(ocr.subprocess, "run", silent)
    with pytest.raises(ocr.OcrError, match="no plain output for p2.png"):
        ocr._run([image], tmp_path, "plain", ocr.PLAIN_ARGS)

