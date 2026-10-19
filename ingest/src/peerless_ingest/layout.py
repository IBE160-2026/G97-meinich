"""The generated section's layout: words to labelled rows and figures (Story 2.1a).

Ported from the spike, `analysis/ocr/ocr_accuracy.py` (`normalise`,
`group_lines`, `column_edges`, `parse_number`, `parse_page`, `similar`,
`extract`) and `analysis/ocr/era_screening.py` (`classify`). What changed
from the spike:

- `fold` maps known look-alike letters (Cyrillic and Greek capitals and
  lower case that look like Latin ones) before diacritics are dropped, so a
  Cyrillic `Р` inside RESULTATREGNSKAP no longer makes the heading vanish.
  It only ever touches labels and headings, never a figure.
- A figure token is checked against ASCII digits only. Python's
  `str.isdigit` also accepts superscripts and other scripts' digits.
- The plain pass accepts only the generated layout's digit groups. A single
  ungrouped token is accepted only from the digits-only pass, which drops the
  thousands spaces; `documents` decides whether such a figure is kept.
- Every target field of the generated layout (`TARGETS`), not only the
  spike's nine check fields.

Nothing here computes anything: a figure is the digits as printed, or None.
"""

from __future__ import annotations

import difflib
import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Literal

from .ocr import Word

Layout = Literal["generated", "paper", "unknown"]
PageKind = Literal["resultat", "balanse", "other"]
Pass = Literal["plain", "digits"]

# Look-alike letters Tesseract has been seen to return, or could return, for
# Latin capitals and lower case in the generated section. Upper and lower
# case are both listed because `fold` maps before lower-casing.
LOOKALIKES = str.maketrans(
    {
        # Cyrillic
        "А": "a", "В": "b", "Е": "e", "К": "k", "М": "m", "Н": "h", "О": "o",
        "Р": "p", "С": "c", "Т": "t", "Х": "x", "У": "y", "І": "i", "Ј": "j", "Ѕ": "s",
        "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
        "і": "i", "ј": "j", "ѕ": "s",
        # Greek
        "Α": "a", "Β": "b", "Ε": "e", "Ζ": "z", "Η": "h", "Ι": "i", "Κ": "k",
        "Μ": "m", "Ν": "n", "Ο": "o", "Ρ": "p", "Τ": "t", "Υ": "y", "Χ": "x",
        "ο": "o",
        # Norwegian letters, spelled out before the accents are dropped.
        "Æ": "ae", "æ": "ae", "Ø": "o", "ø": "o", "Å": "a", "å": "a",
    }
)  # fmt: skip


def fold(text: str) -> str:
    """Lower-case ASCII letters only: look-alikes mapped, diacritics dropped,
    everything else (digits, spaces, punctuation) removed. For labels and
    headings only."""
    text = text.translate(LOOKALIKES)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", text.lower())


# --- Page 1: which kind of filing --------------------------------------------


def classify(top_words: Sequence[Word]) -> Layout:
    """The layout from the top of page 1. The paper cover form also says
    "regnskapsåret" ("endringer dette regnskapsåret"), so only the generated
    section's own heading counts (spike error 1)."""
    text = fold(" ".join(w.text for w in top_words))
    if "generellinformasjon" in text:
        return "generated"
    if "vedleggtil" in text:
        return "paper"
    return "unknown"


# --- Rows and columns ----------------------------------------------------------

YEAR = re.compile(r"^(19|20)[0-9]{2}$")
DIGITS = re.compile(r"^[0-9]+$")
ONE_TOKEN = re.compile(r"^-?[0-9]{1,10}$")


@dataclass(frozen=True)
class Edges:
    """The right edges of the two figure columns and the character pitch,
    from the year header line, and the two years it states."""

    current_right: int
    prior_right: int
    pitch: float
    current_year: int
    prior_year: int


@dataclass(frozen=True)
class Row:
    label: str
    has_number: bool
    current: int | None
    prior: int | None


@dataclass(frozen=True)
class Page:
    kind: PageKind
    edges: Edges | None
    unit_text: str | None  # the words after "Beløp i:", as read; None if no such line
    rows: list[Row] = field(default_factory=list)
    own_header: bool = False  # the edges come from this page's own year header
    balance_closed: bool = False  # this page or one before it holds SUM EGENKAPITAL OG GJELD


def group_lines(words: Sequence[Word]) -> list[list[Word]]:
    """Words grouped into Tesseract's lines, each left to right, top to bottom."""
    lines: dict[tuple[int, int, int, int], list[Word]] = {}
    for w in words:
        lines.setdefault(w.line, []).append(w)
    return sorted((sorted(ws, key=lambda w: w.left) for ws in lines.values()), key=lambda ws: ws[0].top)


def column_edges(label_words: Sequence[Word]) -> Edges | None:
    """From the first line holding two years: the last two are the columns."""
    for line in group_lines(label_words):
        years = [w for w in line if YEAR.match(w.text)]
        if len(years) >= 2:
            a, b = years[-2], years[-1]
            pitch = (a.width + b.width) / 8  # four characters each
            return Edges(a.right, b.right, pitch, int(a.text), int(b.text))
    return None


def unit_text(label_words: Sequence[Word]) -> str | None:
    """The words after "Beløp i:" on its line, up to "Note" or a year, as
    read. None when no line starts that way."""
    for line in group_lines(label_words):
        folded = [fold(w.text) for w in line]
        for i in range(len(line) - 1):
            if folded[i] == "belop" and folded[i + 1] == "i":
                rest: list[str] = []
                for w, f in zip(line[i + 2 :], folded[i + 2 :], strict=True):
                    if f == "note" or YEAR.match(w.text):
                        break
                    rest.append(w.text)
                return " ".join(rest)
    return None


def parse_number(tokens: Sequence[Word], pitch: float, mode: Pass) -> int | None:
    """Join digit groups into one figure, or refuse. Never guess, never
    repair: a token holding anything but ASCII digits (after a leading minus)
    gives None."""
    if not tokens:
        return None
    # The digits-only pass drops the thousands spaces and returns one token.
    if mode == "digits" and len(tokens) == 1 and ONE_TOKEN.match(tokens[0].text):
        return int(tokens[0].text)
    words = list(tokens)
    text = [t.text for t in words]
    negative = False
    if text[0] == "-":
        # The minus stays in `words`, so the gap check below covers it too.
        negative, text = True, text[1:]
    elif text[0].startswith("-"):
        negative, text = True, [text[0][1:], *text[1:]]
    if not text or not all(DIGITS.match(t) for t in text):
        return None
    # A leading group of 1-3 digits, then groups of exactly 3.
    if not (1 <= len(text[0]) <= 3) or not all(len(t) == 3 for t in text[1:]):
        return None
    for a, b in zip(words, words[1:]):
        if b.left - a.right > 1.8 * pitch:  # more than one space between groups
            return None
    value = int("".join(text))
    return -value if negative else value


def page_kind(label_words: Sequence[Word]) -> PageKind:
    text = fold(" ".join(w.text for w in label_words))
    if "resultatregnskap" in text:
        return "resultat"
    if "balanse" in text:
        return "balanse"
    return "other"


def parse_page(
    label_words: Sequence[Word],
    number_words: Sequence[Word],
    mode: Pass,
    previous: Page | None = None,
) -> Page:
    """One page's rows. A continuation page has no heading or year header; it
    inherits both from the page before, since the generated layout is
    identical, until the balance sheet has ended (SUM EGENKAPITAL OG GJELD):
    a later page without its own year header is the company's notes, kind
    "other" with no rows. Labels always come from the plain pass
    (`label_words`); the figures from `number_words`, the plain or the
    digits-only pass."""
    kind = page_kind(label_words)
    edges = column_edges(label_words)
    own_header = edges is not None
    closed_before = previous is not None and previous.balance_closed
    unit = unit_text(label_words)
    if edges is None and closed_before:
        return Page("other", None, unit, [], False, True)
    if edges is None and previous is not None and previous.edges is not None:
        edges = previous.edges
        if kind == "other":
            kind = previous.kind
    if edges is None:
        return Page(kind, None, unit, [], False, closed_before)
    pitch = edges.pitch
    number_zone_left = edges.current_right - 13 * pitch  # widest figure: "-999 999 999"
    split = (edges.current_right + edges.prior_right) / 2 - 4 * pitch

    rows: list[Row] = []
    for line in group_lines(label_words):
        label = " ".join(w.text for w in line if w.right < number_zone_left)
        y = sum(w.mid_y for w in line) / len(line)
        near = sorted(
            (w for w in number_words if abs(w.mid_y - y) < 0.6 * line[0].height + 8 and w.left >= number_zone_left),
            key=lambda w: w.left,
        )
        current = parse_number([w for w in near if w.right <= split], pitch, mode)
        prior = parse_number([w for w in near if w.right > split], pitch, mode)
        # A row has a number if either the plain line or this pass's number
        # words put something in the number zone: the digits-only pass can
        # fill a row whose plain line read nothing there.
        has_number = bool(near) or any(w.left >= number_zone_left for w in line)
        rows.append(Row(label, has_number, current, prior))
    closed = closed_before or any(r.has_number and ends_balance(r.label) for r in rows)
    return Page(kind, edges, unit, rows, own_header, closed)


# --- Label matching ------------------------------------------------------------

# Target rows of the generated layout, by field. A row matches when its
# label, joined with the label-only lines directly above it and folded, ends
# with one of the variants. Field names follow docs/key-figures.md in
# snake_case, and register.key_figures where that file has none.
TARGETS: dict[str, tuple[str, ...]] = {
    "salgsinntekt": ("salgsinntekt", "salgsinntekter"),
    "sum_driftsinntekter": ("suminntekter", "sumdriftsinntekter"),
    "varekostnad": ("varekostnad",),
    "lonnskostnad": ("lonnskostnad",),
    "avskrivninger": ("avskrivningpavarigedriftsmidlerogimmaterielleeiendeler",),
    "nedskrivninger": ("nedskrivningavvarigedriftsmidlerogimmaterielleeiendeler",),
    "annen_driftskostnad": ("annendriftskostnad",),
    "sum_driftskostnad": ("sumkostnader", "sumdriftskostnader", "sumdriftskostnad"),
    "driftsresultat": ("driftsresultat",),
    "netto_finans": ("nettofinans", "nettofinansposter", "nettofinansresultat"),
    "ordinaert_resultat_foer_skattekostnad": ("ordinaertresultatforskattekostnad", "resultatforskattekostnad"),
    "aarsresultat": ("arsresultat",),
    "sum_immaterielle_eiendeler": ("sumimmaterielleeiendeler",),
    "sum_varige_driftsmidler": ("sumvarigedriftsmidler",),
    "varer": ("varer",),
    "kundefordringer": ("kundefordringer",),
    "bankinnskudd": ("sumbankinnskuddkontanteroglignende",),
    "sum_eiendeler": ("sumeiendeler",),
    "sum_egenkapital": ("sumegenkapital",),
    "leverandorgjeld": ("leverandorgjeld",),
    "sum_kortsiktig_gjeld": ("sumkortsiktiggjeld",),
    "sum_gjeld": ("sumgjeld",),
    "sum_egenkapital_gjeld": ("sumegenkapitaloggjeld",),
}

LABEL_SIMILARITY = 0.85  # tolerates OCR slips such as "Driftoreoultat" for "Driftsresultat"
JOIN_LINES = 3  # at most this many label-only lines above a row join its label


def similar(label: str, variant: str) -> bool:
    """A row's own label is the variant with a few characters misread.
    Lengths must be within one, so "Annen driftskostnad" never passes for
    "Sum driftskostnad" nor "Sum innskutt egenkapital" for "Sum egenkapital"
    (spike error 3)."""
    if abs(len(label) - len(variant)) > 1:
        return False
    return difflib.SequenceMatcher(None, label, variant).ratio() >= LABEL_SIMILARITY


def ends_balance(label: str) -> bool:
    """The row that ends the generated balance sheet, matched like any label
    (exact, or fuzzy within one character: "S5O0M EGENKAPITAL OG GJELD")."""
    own = fold(label)
    return any(own.endswith(v) or similar(own, v) for v in TARGETS["sum_egenkapital_gjeld"])


def extract(pages: Sequence[Page]) -> dict[str, tuple[int | None, int | None]]:
    """(current, prior) per target field a row matched. Exact matches first,
    over every page; a fuzzy match only for a field no row matched exactly,
    and only against the row's own label. A field no row matched is left out."""
    candidates: list[tuple[str, str, Row]] = []  # (joined label, own label, row)
    for page in pages:
        if page.kind == "other":
            continue
        rows = page.rows
        for i, row in enumerate(rows):
            if not row.has_number:
                continue
            own = fold(row.label)
            joined = own
            j = i - 1
            while j >= 0 and not rows[j].has_number and i - j <= JOIN_LINES:
                joined = fold(rows[j].label) + joined
                j -= 1
            candidates.append((joined, own, row))

    found: dict[str, tuple[int | None, int | None]] = {}
    for key, variants in TARGETS.items():
        for joined, _, row in candidates:
            if any(joined.endswith(v) for v in variants):
                found[key] = (row.current, row.prior)
                break
    for key, variants in TARGETS.items():
        if key in found:
            continue
        for _, own, row in candidates:
            if any(similar(own, v) for v in variants):
                found[key] = (row.current, row.prior)
                break
    return found
