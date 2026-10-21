"""Read the figures of a filed document (Story 2.1a).

`read_document(pdf bytes, bound) -> DocumentRead` is the library's one entry
point: it classifies page 1, and for a generated filing reads both figure
columns and runs the four within-document checks within `bound` kroner (the
configured `within_document_bound_kr`, Story 2.2). `read_words` is the same read from
words already recognised, so the host tests run it on recorded Tesseract
output with no Tesseract installed.

No database, no network, no write (Story 2.1b stores this). Figures are
whole currency units as printed; converting to øre is 2.1b's writer. The only
arithmetic is the four checks (AD-1): nothing is derived, and an absent
figure stays None, never 0.

**The combined read** (ported from the spike, with the gate it lacked):

1. The plain pass gives every figure it can read as a well-formed digit group.
2. For a figure the plain pass did not yield, the digits-only pass may give
   one. It never overrides a plain figure (spike error 4: the digits-only
   pass reads "622821" for 6 228 521).
3. Such a digits-only figure is kept only if, with all of the column's
   digits-only figures filled in, (a) the field takes part in at least one
   check that then passes and in which at least one of the other operands
   came from the plain pass, and (b) every evaluable check of that column
   passes. Otherwise the figure is absent; if any check fails, every
   digits-only figure of the column is dropped. A field in no check never
   takes a digits-only figure, and digits-only figures never confirm each
   other: sum eiendeler and sum egenkapital og gjeld print the same number,
   so the same dropped digit in both would pass C3 (Meinich, 2026-10-19).

**Reporting unit.** Figures are read only when every page with its own year
header has a "Beløp i:" header, and every such header states the same bare
three-letter currency code, which means whole units. A scale ("NOK 1000",
"tusen kroner"), headers that disagree between pages, or a missing or
unreadable header refuses the document's columns with
`refusal = "reporting_unit"`, never a guessed scale.

**Years.** The columns' years come from the year headers. No readable year
header, year headers that disagree between pages, a prior year that is not
the current year minus one, or a statement page with no year header and
nothing to inherit one from refuses with `refusal = "year_header"`.
"""

from __future__ import annotations

import re
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from . import layout, ocr
from .layout import Layout, Page, Pass
from .ocr import PageWords, Word

CheckResult = Literal["pass", "fail", "not_evaluable"]
Refusal = Literal["reporting_unit", "year_header"]

# The within-document bound is not set here: it is `within_document_bound_kr`
# in ingest/config.toml (Story 2.2), passed in as `bound`, in the figures'
# own unit (whole kroner for a read; øre, times 100, for stored figures).

FIELDS: tuple[str, ...] = tuple(layout.TARGETS)

# The fields each check reads; the arithmetic is in `checks`.
#   c1  sum_driftsinntekter - sum_driftskostnad      = driftsresultat
#   c2  driftsresultat + netto_finans                 = ordinaert_resultat_foer_skattekostnad
#   c3  sum_eiendeler                                 = sum_egenkapital_gjeld
#   c4  sum_egenkapital + sum_gjeld                   = sum_egenkapital_gjeld
CHECK_FIELDS: dict[str, tuple[str, ...]] = {
    "c1": ("sum_driftsinntekter", "sum_driftskostnad", "driftsresultat"),
    "c2": ("driftsresultat", "netto_finans", "ordinaert_resultat_foer_skattekostnad"),
    "c3": ("sum_eiendeler", "sum_egenkapital_gjeld"),
    "c4": ("sum_egenkapital", "sum_gjeld", "sum_egenkapital_gjeld"),
}

VALUTA = re.compile(r"^[A-Z]{3}$")


@dataclass(frozen=True)
class Column:
    """One figure column: this year's or last year's, as the document states it."""

    year: int
    figures: dict[str, int | None]  # every field in FIELDS; whole units as printed
    c1: CheckResult
    c2: CheckResult
    c3: CheckResult
    c4: CheckResult
    digits_pass_fields: tuple[str, ...]  # fields whose figure came from the digits-only pass


@dataclass(frozen=True)
class DocumentRead:
    layout: Layout
    valuta: str | None  # the bare currency code of "Beløp i:", or None
    unit_text: str | None  # the "Beløp i:" header as read, None if no such header
    refusal: Refusal | None  # why a generated document has no columns
    current: Column | None
    prior: Column | None


# --- Checks ----------------------------------------------------------------------


def _close(left: int | None, right: int | None, bound: int) -> CheckResult:
    if left is None or right is None:
        return "not_evaluable"
    return "pass" if abs(left - right) <= bound else "fail"


def _plus(a: int | None, b: int | None) -> int | None:
    return None if a is None or b is None else a + b


def _minus(a: int | None, b: int | None) -> int | None:
    return None if a is None or b is None else a - b


def checks(f: dict[str, int | None], bound: int) -> dict[str, CheckResult]:
    """The four within-document checks, as in CHECK_FIELDS: each holds when
    its two sides differ by at most `bound`, an absolute amount in the
    figures' own unit. No confidence enters (Story 2.2)."""
    if type(bound) is not int or bound < 0:
        raise ValueError(f"the within-document bound must be a non-negative int, got {bound!r}")
    return {
        "c1": _close(_minus(f["sum_driftsinntekter"], f["sum_driftskostnad"]), f["driftsresultat"], bound),
        "c2": _close(_plus(f["driftsresultat"], f["netto_finans"]), f["ordinaert_resultat_foer_skattekostnad"], bound),
        "c3": _close(f["sum_eiendeler"], f["sum_egenkapital_gjeld"], bound),
        "c4": _close(_plus(f["sum_egenkapital"], f["sum_gjeld"]), f["sum_egenkapital_gjeld"], bound),
    }


# --- The combined read -------------------------------------------------------------


def combine(
    plain: dict[str, int | None], digits: dict[str, int | None], bound: int
) -> tuple[dict[str, int | None], tuple[str, ...]]:
    """The column's figures and the fields taken from the digits-only pass,
    under the gate described in the module docstring."""
    filled = dict(plain)
    offered = [k for k in FIELDS if plain[k] is None and digits[k] is not None]
    for k in offered:
        filled[k] = digits[k]
    results = checks(filled, bound)
    if any(r == "fail" for r in results.values()):
        return dict(plain), ()
    passing = [name for name, r in results.items() if r == "pass"]

    def confirmed(k: str) -> bool:
        # A passing check with k in it and a plain-pass figure among its
        # other operands.
        return any(
            k in CHECK_FIELDS[name] and any(plain[f] is not None for f in CHECK_FIELDS[name] if f != k)
            for name in passing
        )

    kept = tuple(k for k in offered if confirmed(k))
    figures = dict(plain)
    for k in kept:
        figures[k] = digits[k]
    return figures, kept


def _column(year: int, plain: dict[str, int | None], digits: dict[str, int | None], bound: int) -> Column:
    figures, kept = combine(plain, digits, bound)
    c = checks(figures, bound)
    return Column(year, figures, c["c1"], c["c2"], c["c3"], c["c4"], kept)


def parse_pages(pages: Sequence[PageWords], mode: Pass) -> list[Page]:
    parsed: list[Page] = []
    previous: Page | None = None
    for page in pages:
        numbers = page.plain if mode == "plain" else page.digits
        previous = layout.parse_page(page.plain, numbers, mode, previous)
        parsed.append(previous)
    return parsed


def _split(found: dict[str, tuple[int | None, int | None]], index: int) -> dict[str, int | None]:
    return {k: (found[k][index] if k in found else None) for k in FIELDS}


def read_words(top: Sequence[Word], pages: Sequence[PageWords], bound: int) -> DocumentRead:
    """The read, from words already recognised; `bound` is the within-document
    bound in whole kroner."""
    kind = layout.classify(top)
    if kind != "generated":
        return DocumentRead(kind, None, None, None, None, None)

    plain_pages = parse_pages(pages, "plain")
    headed = [p for p in plain_pages if p.own_header]
    units = [p.unit_text for p in plain_pages if p.own_header or p.unit_text is not None]
    found_units = [u for u in units if u is not None]
    unit = "; ".join(dict.fromkeys(found_units)) if found_units else None
    years = {(p.edges.current_year, p.edges.prior_year) for p in headed if p.edges is not None}
    headless_statement = any(p.kind != "other" and p.edges is None for p in plain_pages)
    if len(years) != 1 or headless_statement:
        return DocumentRead(kind, None, unit, "year_header", None, None)
    [(current_year, prior_year)] = years
    if prior_year != current_year - 1:
        return DocumentRead(kind, None, unit, "year_header", None, None)
    if None in units or unit is None or not VALUTA.match(unit):
        return DocumentRead(kind, None, unit, "reporting_unit", None, None)

    plain = layout.extract(plain_pages)
    digits = layout.extract(parse_pages(pages, "digits"))
    return DocumentRead(
        kind,
        unit,
        unit,
        None,
        _column(current_year, _split(plain, 0), _split(digits, 0), bound),
        _column(prior_year, _split(plain, 1), _split(digits, 1), bound),
    )


def recognise(pdf: bytes) -> tuple[list[Word], list[PageWords]]:
    """Render and recognise one filed document. Only page 1's top is
    recognised unless it is a generated filing; a paper filing is never read."""
    with tempfile.TemporaryDirectory(prefix="peerless-ocr-") as tmp:
        workdir = Path(tmp)
        top = ocr.ocr_top(pdf, workdir)
        generated = layout.classify(top) == "generated"
        pages = ocr.ocr_figure_pages(pdf, workdir) if generated else []
    return top, pages


def read_document(pdf: bytes, bound: int) -> DocumentRead:
    """Render, recognise and read one filed document; `bound` is the
    within-document bound in whole kroner."""
    top, pages = recognise(pdf)
    return read_words(top, pages, bound)


# --- JSON, for the fixtures ----------------------------------------------------------


def _column_json(column: Column | None) -> dict[str, object] | None:
    if column is None:
        return None
    return {
        "year": column.year,
        "figures": dict(column.figures),
        "c1": column.c1,
        "c2": column.c2,
        "c3": column.c3,
        "c4": column.c4,
        "digits_pass_fields": list(column.digits_pass_fields),
    }


def to_json(read: DocumentRead) -> dict[str, object]:
    """The read as plain JSON values, in the shape of the expected-*.json fixtures."""
    return {
        "layout": read.layout,
        "valuta": read.valuta,
        "unit_text": read.unit_text,
        "refusal": read.refusal,
        "current": _column_json(read.current),
        "prior": _column_json(read.prior),
    }
