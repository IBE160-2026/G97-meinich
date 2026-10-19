"""Hand-built Tesseract TSVs in the generated section's geometry.

The trap fixtures (look-alikes, bad grouping, split and merged figures,
units, the digits-only gate) are built here rather than recorded, so each
test states the one word it is about. The geometry copies the recorded
979607008/2025 output (`fixtures/documents/*.tsv`): a monospace pitch of
38.75 px, labels from x = 520, the figure columns right-aligned at
x = 2885 (this year) and 3720 (last year), and one line every 75 px.

A figure is written as the string Tesseract would print, right-aligned in
its column: every run of non-spaces becomes one word, so "12 34 567" gives
three words one space apart and "1 327  425" leaves two spaces in a gap.
"""

from __future__ import annotations

from collections.abc import Sequence

from peerless_ingest.ocr import PageWords, Word, read_tsv

PITCH = 38.75
LABEL_X = 520
NOTE_X = 1688
CURRENT_RIGHT = 2885
PRIOR_RIGHT = 3720
LINE_STEP = 75
WORD_HEIGHT = 45
TOP = 200

HEADER = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"

Placed = tuple[str, float]  # (text, left)


def label_words(text: str, left: float = LABEL_X) -> list[Placed]:
    """Words of a label, one space apart, starting at `left`."""
    out: list[Placed] = []
    for i, char in enumerate(text):
        if char != " " and (i == 0 or text[i - 1] == " "):
            end = text.find(" ", i)
            out.append((text[i : end if end != -1 else len(text)], left + i * PITCH))
    return out


def figure_words(text: str, right: float) -> list[Placed]:
    """A printed figure right-aligned so its last character ends at `right`."""
    return label_words(text, right - len(text) * PITCH)


def tsv(lines: Sequence[Sequence[Placed]]) -> str:
    """A TSV with one Tesseract line per entry, top to bottom."""
    rows = [HEADER]
    for n, line in enumerate(lines, start=1):
        top = TOP + n * LINE_STEP
        for w, (text, left) in enumerate(line, start=1):
            width = max(int(len(text) * PITCH) - 10, 5)
            rows.append(f"5\t1\t1\t1\t{n}\t{w}\t{int(left) + 5}\t{top}\t{width}\t{WORD_HEIGHT}\t95.0\t{text}")
    return "\n".join(rows) + "\n"


def words(lines: Sequence[Sequence[Placed]]) -> list[Word]:
    """Through the real TSV reader, so the reader is part of every test."""
    return read_tsv(tsv(lines))


GENERATED_TOP: list[list[Placed]] = [
    label_words("Brønnøysundregistrene"),
    label_words("ÅRSREGNSKAP FOR REGNSKAPSÅRET 2025 - GENERELL INFORMASJON"),
    label_words("Organisasjonsnummer: 979 607 008"),
]

# The rows of 979607008/2025 that the four checks read, plus two outside
# them: one consistent statement, both columns (Design Notes, spec 2.1a).
Row = tuple[str, str, str]  # (label, this year as printed, last year as printed)
BASE_ROWS: list[Row] = [
    ("Salgsinntekt", "71 987 157", "66 799 459"),
    ("Sum inntekter", "72 632 310", "69 051 006"),
    ("Varekostnad", "1 327 425", "744 327"),
    ("Sum kostnader", "72 510 307", "70 020 117"),
    ("Driftsresultat", "122 003", "-969 111"),
    ("Netto finans", "-826 511", "-1 102 745"),
    ("Resultat før skattekostnad", "-704 508", "-2 071 857"),
    ("SUM EIENDELER", "31 073 544", "35 615 025"),
    ("Sum egenkapital", "7 764 189", "9 305 198"),
    ("Sum gjeld", "23 309 355", "26 309 827"),
    ("SUM EGENKAPITAL OG GJELD", "31 073 544", "35 615 025"),
]


def page_lines(
    rows: Sequence[Row],
    *,
    heading: str = "RESULTATREGNSKAP",
    unit_line: str | None = "Beløp i: NOK",
    years: tuple[str, str] | None = ("2025", "2024"),
    figures_only: bool = False,
) -> list[list[Placed]]:
    """A figure page: heading, the "Beløp i:" / year header line, then rows.
    `figures_only` leaves the labels out, as the digits-only pass's TSV
    holds no usable label."""
    header: list[Placed] = []
    if unit_line is not None:
        header += label_words(unit_line)
    header += label_words("Note", NOTE_X)
    if years is not None:
        header += figure_words(years[0], CURRENT_RIGHT) + figure_words(years[1], PRIOR_RIGHT)
    lines: list[list[Placed]] = [label_words(heading), header]
    for label, current, prior in rows:
        line = [] if figures_only else label_words(label)
        line += figure_words(current, CURRENT_RIGHT) if current else []
        line += figure_words(prior, PRIOR_RIGHT) if prior else []
        lines.append(line)
    return lines


def digits_of(rows: Sequence[Row]) -> list[Row]:
    """What the digits-only pass returns for well-read rows: the thousands
    spaces dropped, one token per figure."""
    return [(label, current.replace(" ", ""), prior.replace(" ", "")) for label, current, prior in rows]


def document(
    rows: Sequence[Row],
    digits_rows: Sequence[Row] | None = None,
    **page: object,
) -> tuple[list[Word], list[PageWords]]:
    """A generated document of one figure page, as `documents.read_words`
    takes it. The digits-only pass defaults to the plain rows without spaces."""
    plain = words(page_lines(rows, **page))  # type: ignore[arg-type]
    digits = words(page_lines(digits_rows if digits_rows is not None else digits_of(rows), figures_only=True, **page))  # type: ignore[arg-type]
    return words(GENERATED_TOP), [PageWords(plain, digits)]


def replace_row(rows: Sequence[Row], label: str, current: str | None = None, prior: str | None = None) -> list[Row]:
    """`rows` with one row's figures replaced."""
    out: list[Row] = []
    for row in rows:
        if row[0] == label:
            row = (label, row[1] if current is None else current, row[2] if prior is None else prior)
        out.append(row)
    assert any(r[0] == label for r in rows), label
    return out
