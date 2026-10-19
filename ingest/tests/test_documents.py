"""The combined read: checks, the digits-only gate, refusals, and the contract.

Hand-built TSVs (`tsv_builder`) for the traps; the recorded Tesseract output
of 979607008/2025 for the contract. No Tesseract, no database, no network.
"""

from __future__ import annotations

import pytest

from peerless_ingest import documents
from peerless_ingest.documents import DocumentRead
from tsv_builder import BASE_ROWS, Row, digits_of, document, replace_row


def read(rows: list[Row], digits_rows: list[Row] | None = None, **page: object) -> DocumentRead:
    top, pages = document(rows, digits_rows, **page)
    return documents.read_words(top, pages)


def current_of(result: DocumentRead) -> documents.Column:
    assert result.current is not None
    return result.current


def checks_of(column: documents.Column) -> tuple[str, str, str, str]:
    return (column.c1, column.c2, column.c3, column.c4)


def test_base_statement_reads_and_reconciles() -> None:
    result = read(BASE_ROWS)
    assert (result.layout, result.valuta, result.unit_text, result.refusal) == ("generated", "NOK", "NOK", None)
    assert result.current is not None and result.prior is not None
    assert (result.current.year, result.prior.year) == (2025, 2024)
    assert checks_of(result.current) == ("pass", "pass", "pass", "pass")
    assert checks_of(result.prior) == ("pass", "pass", "pass", "pass")
    assert result.current.digits_pass_fields == ()
    assert set(result.current.figures) == set(documents.FIELDS)
    assert result.current.figures["varer"] is None  # no row: absent, never 0


def test_check_bound_is_five_kroner() -> None:
    # 2024 in 979607008/2025: C2 is one krone off and passes. Six kroner fails.
    assert documents.TOLERANCE_KR == 5
    f = dict.fromkeys(documents.FIELDS)
    f |= {"driftsresultat": -969_111, "netto_finans": -1_102_745}
    assert documents.checks(f | {"ordinaert_resultat_foer_skattekostnad": -2_071_857})["c2"] == "pass"
    assert documents.checks(f | {"ordinaert_resultat_foer_skattekostnad": -2_071_861})["c2"] == "pass"
    assert documents.checks(f | {"ordinaert_resultat_foer_skattekostnad": -2_071_862})["c2"] == "fail"
    assert documents.checks(f)["c1"] == "not_evaluable"


# A statement whose driftsresultat is 6 228 521, the figure of spike error 4.
SPIKE_4_ROWS = replace_row(
    replace_row(
        replace_row(BASE_ROWS, "Sum kostnader", current="66 403 789"),
        "Driftsresultat",
        current="6 228 521",
    ),
    "Resultat før skattekostnad",
    current="5 402 010",
)


def test_digits_never_override_plain() -> None:
    # Spike error 4: the digits-only pass drops a digit in the older font.
    digits = replace_row(digits_of(SPIKE_4_ROWS), "Driftsresultat", current="622821")
    column = current_of(read(SPIKE_4_ROWS, digits))
    assert column.figures["driftsresultat"] == 6_228_521
    assert column.digits_pass_fields == ()
    assert checks_of(column) == ("pass", "pass", "pass", "pass")

    # Not even when the digits-only figure would reconcile and the plain one
    # does not: the plain figure stands, and its checks fail.
    rows = replace_row(BASE_ROWS, "Driftsresultat", current="1 122 003")
    column = current_of(read(rows, digits_of(BASE_ROWS)))
    assert column.figures["driftsresultat"] == 1_122_003
    assert (column.c1, column.c2) == ("fail", "fail")
    assert column.digits_pass_fields == ()


def test_digits_kept_only_if_column_reconciles() -> None:
    plain = replace_row(BASE_ROWS, "Sum kostnader", current="72 51o 307")
    well_read = digits_of(BASE_ROWS)  # the digits-only pass reads 72510307

    # The digits-only figure makes C1 evaluable, and every check passes: kept.
    column = current_of(read(plain, well_read))
    assert column.figures["sum_driftskostnad"] == 72_510_307
    assert column.digits_pass_fields == ("sum_driftskostnad",)
    assert column.c1 == "pass"

    # It dropped a digit, so C1 would fail: absent, and C1 cannot be evaluated.
    digits = replace_row(well_read, "Sum kostnader", current="7251307")
    column = current_of(read(plain, digits))
    assert column.figures["sum_driftskostnad"] is None
    assert column.digits_pass_fields == ()
    assert checks_of(column) == ("not_evaluable", "pass", "pass", "pass")

    # Right, but another check of the column fails: every digits-only figure
    # of the column is dropped.
    broken = replace_row(plain, "Sum gjeld", current="23 309 955")
    column = current_of(read(broken, well_read))
    assert column.figures["sum_driftskostnad"] is None
    assert column.digits_pass_fields == ()
    assert column.c4 == "fail"

    # Right, but its check stays unevaluable (sum inntekter is read by neither
    # pass): nothing confirms it, so it is absent.
    no_income = replace_row(plain, "Sum inntekter", current="72 6E2 310")
    no_income_digits = replace_row(well_read, "Sum inntekter", current="")
    column = current_of(read(no_income, no_income_digits))
    assert column.figures["sum_driftskostnad"] is None
    assert column.figures["sum_driftsinntekter"] is None
    assert column.c1 == "not_evaluable"

    # The other column is read on its own.
    result = read(plain, digits)
    assert result.prior is not None and result.prior.figures["sum_driftskostnad"] == 70_020_117


def test_digits_unused_outside_checks() -> None:
    # Varekostnad is in no check, so nothing could confirm a digits-only
    # figure for it, even with every check passing.
    plain = replace_row(BASE_ROWS, "Varekostnad", current="1 327 4z5")
    column = current_of(read(plain, digits_of(BASE_ROWS)))  # digits-only: 1327425
    assert column.figures["varekostnad"] is None
    assert column.digits_pass_fields == ()
    assert checks_of(column) == ("pass", "pass", "pass", "pass")


@pytest.mark.parametrize(
    ("unit_line", "unit_text"),
    [
        ("Beløp i: NOK 1000", "NOK 1000"),
        ("Beløp i: tusen kroner", "tusen kroner"),
        ("Beløp i: N0K", "N0K"),
        ("Beløp i:", ""),
        (None, None),  # no "Beløp i:" header at all
    ],
)
def test_scaled_or_unreadable_unit_gives_no_columns(unit_line: str | None, unit_text: str | None) -> None:
    result = read(BASE_ROWS, unit_line=unit_line)
    assert result.layout == "generated"
    assert result.refusal == "reporting_unit"
    assert (result.valuta, result.unit_text) == (None, unit_text)
    assert (result.current, result.prior) == (None, None)


def test_units_that_disagree_between_pages_give_no_columns() -> None:
    top, first = document(BASE_ROWS)
    _, second = document(BASE_ROWS, unit_line="Beløp i: NOK 1000", heading="BALANSE")
    result = documents.read_words(top, first + second)
    assert result.refusal == "reporting_unit"
    assert result.unit_text == "NOK; NOK 1000"
    assert result.current is None


def test_unreadable_year_header_gives_no_columns() -> None:
    result = read(BASE_ROWS, years=None)
    assert (result.layout, result.refusal, result.current, result.prior) == ("generated", "year_header", None, None)


def test_split_merge_fails_check() -> None:
    # A merged figure: 722 632 310 for sum inntekter 72 632 310.
    column = current_of(read(replace_row(BASE_ROWS, "Sum inntekter", current="722 632 310")))
    assert column.figures["sum_driftsinntekter"] == 722_632_310  # read as printed
    assert column.c1 == "fail"

    # A split figure: 8 335 514 for a driftsresultat of 833 514. Both checks
    # that use it fail.
    rows = replace_row(BASE_ROWS, "Sum kostnader", current="71 798 796")
    rows = replace_row(rows, "Driftsresultat", current="8 335 514")
    rows = replace_row(rows, "Resultat før skattekostnad", current="7 003")
    column = current_of(read(rows))
    assert column.figures["driftsresultat"] == 8_335_514
    assert (column.c1, column.c2) == ("fail", "fail")
    # As printed correctly, the same column passes.
    column = current_of(read(replace_row(rows, "Driftsresultat", current="833 514")))
    assert (column.c1, column.c2) == ("pass", "pass")
