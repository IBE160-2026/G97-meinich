"""Render a filed document and run Tesseract on it (Story 2.1a).

Ported from the spike, `analysis/ocr/ocr_accuracy.py` (`render`, `ocr_all`,
`read_tsv`) and `analysis/ocr/era_screening.py` (the top of page 1). Step 1
runs inside its image, so `tesseract` is called directly by subprocess,
never through `docker run`.

- Page 1's top 30 % is rendered at 150 dpi and read once, for the layout
  (`layout.classify`).
- The figure pages (zero-based 1-4: the generated section's income statement
  and balance sheet follow its first page) are rendered at 2.5x and read
  twice: a plain pass, and a digits-only pass (`tessedit_char_whitelist`).
- Pages run in parallel, one Tesseract thread each (`OMP_THREAD_LIMIT=1`),
  through `xargs -P` over a page list. The list is written with LF line
  endings on every host: a list written on Windows reached the spike's
  container with `\\r` in every filename (spike error 2).

Nothing here interprets a word: `layout` and `documents` do that. No
confidence value is read (AGENTS.md, "Never trust an OCR digit").
"""

from __future__ import annotations

import csv
import io
import os
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import pymupdf

# Rendering, exactly as the spike measured it.
ZOOM = 2.5  # the embedded images are ~200 dpi, 1-bit; Tesseract reads better enlarged
FIGURE_PAGES = (1, 2, 3, 4)  # zero-based
TOP_DPI = 150
TOP_FRACTION = 0.3  # page 1's heading sits in the top third

PARALLEL = 8
PLAIN_ARGS = ("-l", "nor", "--psm", "6")
DIGITS_ARGS = (*PLAIN_ARGS, "-c", "tessedit_char_whitelist=0123456789-")

# The sha256 of nor.traineddata from tesseract-ocr/tessdata_best at commit
# e12c65a915945e4c28e237a9b52bc4a8f39a0cec. ingest/Dockerfile checks the same
# hash in the build; image_check checks it in the built image.
NOR_TRAINEDDATA_SHA256 = "451d52ba1559aa1aecf163ccbfdeced2b9605fbd49480f5e8a53ace29b9eb0e7"


class OcrError(RuntimeError):
    """Tesseract failed or wrote no output."""


@dataclass(frozen=True)
class Word:
    """One word from Tesseract's TSV (level 5), in pixels."""

    text: str
    left: int
    top: int
    width: int
    height: int
    line: tuple[int, int, int, int]  # page_num, block_num, par_num, line_num

    @property
    def right(self) -> int:
        return self.left + self.width

    @property
    def mid_y(self) -> float:
        return self.top + self.height / 2


@dataclass(frozen=True)
class PageWords:
    """One figure page: the plain pass and the digits-only pass."""

    plain: list[Word]
    digits: list[Word]


def read_tsv(text: str) -> list[Word]:
    """The words of a Tesseract TSV. Rows above level 5 and empty words are
    skipped; nothing else is changed."""
    words: list[Word] = []
    for row in csv.DictReader(io.StringIO(text), delimiter="\t", quoting=csv.QUOTE_NONE):
        word = (row.get("text") or "").strip()
        if row.get("level") != "5" or not word:
            continue
        words.append(
            Word(
                word,
                int(row["left"]),
                int(row["top"]),
                int(row["width"]),
                int(row["height"]),
                (int(row["page_num"]), int(row["block_num"]), int(row["par_num"]), int(row["line_num"])),
            )
        )
    return words


def write_page_list(images: Sequence[Path], target: Path) -> None:
    """One image path per line, LF only, whatever the host."""
    target.write_bytes("".join(f"{image}\n" for image in images).encode("utf-8"))


def xargs_argv(page_list: Path, suffix: str, args: Sequence[str]) -> list[str]:
    """`xargs` running one Tesseract per listed image, PARALLEL at a time.
    Each image `p.png` gets `p.png.<suffix>.tsv`. No shell is involved."""
    return [
        "xargs", "-P", str(PARALLEL), "-a", str(page_list), "-I{}",
        "tesseract", "{}", f"{{}}.{suffix}", *args, "tsv",
    ]  # fmt: skip


def _run(images: Sequence[Path], workdir: Path, suffix: str, args: Sequence[str]) -> list[list[Word]]:
    page_list = workdir / f"pages.{suffix}.txt"
    write_page_list(images, page_list)
    env = {**os.environ, "OMP_THREAD_LIMIT": "1"}
    result = subprocess.run(xargs_argv(page_list, suffix, args), env=env, capture_output=True, check=False)
    if result.returncode != 0:
        raise OcrError(f"tesseract failed ({suffix} pass, exit {result.returncode})")
    out: list[list[Word]] = []
    for image in images:
        tsv = Path(f"{image}.{suffix}.tsv")
        if not tsv.exists():
            raise OcrError(f"tesseract wrote no {suffix} output for {image.name}")
        out.append(read_tsv(tsv.read_text(encoding="utf-8", errors="replace")))
    return out


def ocr_top(pdf: bytes, workdir: Path) -> list[Word]:
    """The top of page 1, plain pass only."""
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:
        page = doc[0]
        clip = pymupdf.Rect(0, 0, page.rect.width, page.rect.height * TOP_FRACTION)
        png = workdir / "p1top.png"
        page.get_pixmap(dpi=TOP_DPI, clip=clip).save(png)
    [words] = _run([png], workdir, "plain", PLAIN_ARGS)
    return words


def ocr_figure_pages(pdf: bytes, workdir: Path) -> list[PageWords]:
    """The figure pages that exist, each read by both passes."""
    pngs: list[Path] = []
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:
        for index in FIGURE_PAGES:
            if index >= doc.page_count:
                break
            png = workdir / f"p{index + 1}.png"
            doc[index].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM)).save(png)
            pngs.append(png)
    if not pngs:
        return []
    plain = _run(pngs, workdir, "plain", PLAIN_ARGS)
    digits = _run(pngs, workdir, "digits", DIGITS_ARGS)
    return [PageWords(p, d) for p, d in zip(plain, digits, strict=True)]
