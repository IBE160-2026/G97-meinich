"""The combined read: checks, the digits-only gate, refusals, and the contract.

Hand-built TSVs (`tsv_builder`) for the traps; the recorded Tesseract output
of 979607008/2025 for the contract. No Tesseract, no database, no network.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from conftest import BOUND_KR, REPO_ROOT
from peerless_ingest import config, documents, image_check
from peerless_ingest.documents import DocumentRead
from peerless_ingest.ocr import PageWords, Word, read_tsv
from tsv_builder import BASE_ROWS, Row, digits_of, document, replace_row


def read(rows: list[Row], digits_rows: list[Row] | None = None, **page: object) -> DocumentRead:
    top, pages = document(rows, digits_rows, **page)
    return documents.read_words(top, pages, BOUND_KR)


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
    # The bound comes from ingest/config.toml (Story 2.2), not a constant.
    # 2024 in 979607008/2025: C2 is one krone off and passes. Six kroner fails.
    bound = config.load_config(REPO_ROOT / "ingest" / "config.toml", env={}).within_document_bound_kr
    assert bound == 5 == BOUND_KR
    f = dict.fromkeys(documents.FIELDS)
    f |= {"driftsresultat": -969_111, "netto_finans": -1_102_745}
    assert documents.checks(f | {"ordinaert_resultat_foer_skattekostnad": -2_071_857}, bound)["c2"] == "pass"
    assert documents.checks(f | {"ordinaert_resultat_foer_skattekostnad": -2_071_861}, bound)["c2"] == "pass"
    assert documents.checks(f | {"ordinaert_resultat_foer_skattekostnad": -2_071_862}, bound)["c2"] == "fail"
    assert documents.checks(f, bound)["c1"] == "not_evaluable"
    # The bound is a parameter: a tighter one fails what 5 kr admits.
    assert documents.checks(f | {"ordinaert_resultat_foer_skattekostnad": -2_071_857}, 0)["c2"] == "fail"


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


def test_digits_never_confirm_each_other() -> None:
    # Both C3 totals unreadable in the plain pass, and the digits-only pass
    # drops the same digit from both: C3 passes on two digits-only figures,
    # which confirms neither. Both absent (Meinich, 2026-10-19). Sum gjeld is
    # read by neither pass, so C4 cannot catch it.
    plain = replace_row(BASE_ROWS, "SUM EIENDELER", current="31 o73 544")
    plain = replace_row(plain, "SUM EGENKAPITAL OG GJELD", current="31 o73 544")
    plain = replace_row(plain, "Sum gjeld", current="23 3o9 355")
    digits = replace_row(digits_of(BASE_ROWS), "SUM EIENDELER", current="3107354")
    digits = replace_row(digits, "SUM EGENKAPITAL OG GJELD", current="3107354")
    digits = replace_row(digits, "Sum gjeld", current="")
    column = current_of(read(plain, digits))
    assert column.figures["sum_eiendeler"] is None
    assert column.figures["sum_egenkapital_gjeld"] is None
    assert column.digits_pass_fields == ()
    assert (column.c3, column.c4) == ("not_evaluable", "not_evaluable")


def test_digits_unused_outside_checks() -> None:
    # Varekostnad is in no check, so nothing could confirm a digits-only
    # figure for it, even with every check passing.
    plain = replace_row(BASE_ROWS, "Varekostnad", current="1 327 4z5")
    column = current_of(read(plain, digits_of(BASE_ROWS)))  # digits-only: 1327425
    assert column.figures["varekostnad"] is None
    assert column.digits_pass_fields == ()
    assert checks_of(column) == ("pass", "pass", "pass", "pass")


# A balance whose total is 14 066 151: sum egenkapital 7 764 189 plus sum
# gjeld 6 301 962.
BALANCE_14_ROWS = replace_row(
    replace_row(
        replace_row(
            replace_row(BASE_ROWS, "SUM EIENDELER", current="14 066 151"),
            "Sum gjeld",
            current="6 301 962",
        ),
        "SUM EGENKAPITAL OG GJELD",
        current="14 066 151",
    ),
    "Sum egenkapital",
    current="7 764 189",
)


def test_bold_one_recovered_only_through_gate() -> None:
    # Story 2.3b: a bold "1" read as "l" ("l4 066 151") makes the plain figure
    # absent; "l" gets no rule of its own. The figure enters only through the
    # digits-only gate.
    plain = replace_row(BALANCE_14_ROWS, "SUM EGENKAPITAL OG GJELD", current="l4 066 151")
    digits = digits_of(BALANCE_14_ROWS)  # the digits-only pass reads 14066151

    # Confirmed: C3 passes against the plain sum eiendeler (and C4 against
    # the plain sum egenkapital and sum gjeld). Kept, from the digits pass.
    column = current_of(read(plain, digits))
    assert column.figures["sum_egenkapital_gjeld"] == 14_066_151
    assert column.digits_pass_fields == ("sum_egenkapital_gjeld",)
    assert (column.c3, column.c4) == ("pass", "pass")

    # Unconfirmed: sum eiendeler absent (and sum gjeld, so C4 cannot confirm
    # it either): no passing check has a plain operand beside it. Absent.
    unread = replace_row(replace_row(plain, "SUM EIENDELER", current="l4 066 151"), "Sum gjeld", current="6 3o1 962")
    no_digits = replace_row(replace_row(digits, "SUM EIENDELER", current=""), "Sum gjeld", current="")
    column = current_of(read(unread, no_digits))
    assert column.figures["sum_egenkapital_gjeld"] is None
    assert column.figures["sum_eiendeler"] is None
    assert column.digits_pass_fields == ()
    assert (column.c3, column.c4) == ("not_evaluable", "not_evaluable")

    # A bold sum line in no check (sum kortsiktig gjeld): never confirmed,
    # absent, even with every check passing.
    rows = [*BALANCE_14_ROWS, ("Sum kortsiktig gjeld", "l8 676 023", "18 009 823")]
    column = current_of(read(rows, digits_of([*BALANCE_14_ROWS, ("Sum kortsiktig gjeld", "18 676 023", "18 009 823")])))
    assert column.figures["sum_kortsiktig_gjeld"] is None
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
    result = documents.read_words(top, first + second, BOUND_KR)
    assert result.refusal == "reporting_unit"
    assert result.unit_text == "NOK; NOK 1000"
    assert result.current is None


def test_unreadable_year_header_gives_no_columns() -> None:
    result = read(BASE_ROWS, years=None)
    assert (result.layout, result.refusal, result.current, result.prior) == ("generated", "year_header", None, None)


def test_years_must_follow_and_agree() -> None:
    # A prior year that is not the current year minus one.
    result = read(BASE_ROWS, years=("2025", "2023"))
    assert (result.refusal, result.current, result.prior) == ("year_header", None, None)
    # Two pages whose own year headers disagree.
    top, first = document(BASE_ROWS)
    _, second = document(BASE_ROWS, heading="BALANSE", years=("2024", "2023"))
    result = documents.read_words(top, first + second, BOUND_KR)
    assert (result.refusal, result.current) == ("year_header", None)


def test_statement_page_without_year_header_refuses() -> None:
    # The first statement page has no year header and nothing to inherit it
    # from; a later page has one. Its rows would be lost silently.
    top, first = document(BASE_ROWS, years=None)
    _, second = document(BASE_ROWS, heading="BALANSE")
    result = documents.read_words(top, first + second, BOUND_KR)
    assert (result.refusal, result.current, result.prior) == ("year_header", None, None)


def test_every_headed_page_needs_the_unit() -> None:
    # The second page has its own year header but no "Beløp i:".
    top, first = document(BASE_ROWS)
    _, second = document(BASE_ROWS, heading="BALANSE", unit_line=None)
    result = documents.read_words(top, first + second, BOUND_KR)
    assert (result.refusal, result.unit_text, result.current) == ("reporting_unit", "NOK", None)


def test_digits_fill_a_row_the_plain_pass_left_empty() -> None:
    # The plain pass put nothing in the number zone of "Sum kostnader"; the
    # digits-only pass reads both figures, C1 passes against plain figures.
    plain = replace_row(BASE_ROWS, "Sum kostnader", current="", prior="")
    result = read(plain, digits_of(BASE_ROWS))
    assert result.current is not None and result.prior is not None
    assert result.current.figures["sum_driftskostnad"] == 72_510_307
    assert result.prior.figures["sum_driftskostnad"] == 70_020_117
    assert result.current.digits_pass_fields == ("sum_driftskostnad",)
    assert result.current.c1 == "pass"


def test_digits_gate_in_the_prior_column() -> None:
    plain = replace_row(BASE_ROWS, "Sum kostnader", prior="70 02o 117")
    result = read(plain, digits_of(BASE_ROWS))
    assert result.current is not None and result.prior is not None
    assert result.prior.figures["sum_driftskostnad"] == 70_020_117
    assert result.prior.digits_pass_fields == ("sum_driftskostnad",)
    assert result.current.digits_pass_fields == ()


def test_check_fields_match_the_checks() -> None:
    # CHECK_FIELDS drives the gate; checks() does the arithmetic. Each field
    # a check reads is the one whose absence makes it unevaluable.
    full = dict.fromkeys(documents.FIELDS, 1)
    derived: dict[str, set[str]] = {name: set() for name in documents.CHECK_FIELDS}
    for name in documents.FIELDS:
        for check, result in documents.checks(full | {name: None}, BOUND_KR).items():
            if result == "not_evaluable":
                derived[check].add(name)
    assert derived == {check: set(fields) for check, fields in documents.CHECK_FIELDS.items()}


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


# --- The contract: 979607008/2025 ---------------------------------------------------

DOCUMENTS = Path(__file__).resolve().parent / "fixtures" / "documents"
STEM = "979607008-2025"

# Hand-checked against the filed document (fixtures/documents/979607008-2025.pdf),
# whole kroner as printed, (2025, 2024). The spec's Design Notes table.
# "Nedskrivning 0" is a printed 0. Varer is a heading with no figure.
FILED_979607008_2025: dict[str, tuple[int | None, int | None]] = {
    "salgsinntekt": (71_987_157, 66_799_459),
    "sum_driftsinntekter": (72_632_310, 69_051_006),
    "varekostnad": (1_327_425, 744_327),
    "lonnskostnad": (55_582_660, 52_967_147),
    "avskrivninger": (5_429_357, 5_512_071),
    "nedskrivninger": (0, 328_527),
    "annen_driftskostnad": (10_170_865, 10_468_045),
    "sum_driftskostnad": (72_510_307, 70_020_117),
    "driftsresultat": (122_003, -969_111),
    "netto_finans": (-826_511, -1_102_745),
    "ordinaert_resultat_foer_skattekostnad": (-704_508, -2_071_857),
    "aarsresultat": (-1_541_009, -2_611_560),
    "sum_immaterielle_eiendeler": (16_213_245, 14_615_003),
    "sum_varige_driftsmidler": (1_197_768, 2_102_723),
    "varer": (None, None),
    "kundefordringer": (8_421_893, 11_253_243),
    "bankinnskudd": (2_115_356, 4_502_513),
    "sum_eiendeler": (31_073_544, 35_615_025),
    "sum_egenkapital": (7_764_189, 9_305_198),
    "leverandorgjeld": (1_001_605, 1_731_356),
    "sum_kortsiktig_gjeld": (18_676_023, 18_009_823),
    "sum_gjeld": (23_309_355, 26_309_827),
    "sum_egenkapital_gjeld": (31_073_544, 35_615_025),
}

# Figures the read leaves absent although the document prints them. The
# plain pass misread a digit ("l0 170 8365", "l 001 605", "l 731 356"), and
# neither field is in a check, so the gate refuses the digits-only figure
# (for annen driftskostnad 2025 it was also wrong: "101708365").
ABSENT_BY_GATE = {("annen_driftskostnad", 0), ("leverandorgjeld", 0), ("leverandorgjeld", 1)}


def recorded_words(stem: str) -> tuple[list[Word], list[PageWords]]:
    def tsv(name: str) -> list[Word]:
        return read_tsv((DOCUMENTS / name).read_text(encoding="utf-8"))

    pages = [PageWords(tsv(f"{stem}.p{n}.plain.tsv"), tsv(f"{stem}.p{n}.digits.tsv")) for n in (2, 3, 4, 5)]
    return tsv(f"{stem}.top.tsv"), pages


def test_contract_979607008_2025() -> None:
    top, pages = recorded_words(STEM)
    result = documents.read_words(top, pages, BOUND_KR)
    expected = json.loads((DOCUMENTS / f"expected-{STEM}.json").read_text(encoding="utf-8"))
    assert documents.to_json(result) == expected

    assert (result.layout, result.valuta, result.unit_text, result.refusal) == ("generated", "NOK", "NOK", None)
    assert result.current is not None and result.prior is not None
    assert (result.current.year, result.prior.year) == (2025, 2024)
    for index, column in enumerate((result.current, result.prior)):
        assert checks_of(column) == ("pass", "pass", "pass", "pass")
        assert column.digits_pass_fields == ()
        for name, filed in FILED_979607008_2025.items():
            want = None if (name, index) in ABSENT_BY_GATE else filed[index]
            assert column.figures[name] == want, (name, column.year)
    assert set(FILED_979607008_2025) == set(documents.FIELDS)


def test_contract_split_figure_in_the_recorded_document() -> None:
    # The recorded words with sum inntekter 2025 ("72 632 310", the first "72"
    # on the page; "72 510 307" is the second) read as 722 632 310.
    top, pages = recorded_words(STEM)
    page = pages[0]
    first = next(i for i, w in enumerate(page.plain) if w.text == "72")
    w = page.plain[first]
    plain = [*page.plain[:first], Word("722", w.left - 40, w.top, w.width + 40, w.height, w.line), *page.plain[first + 1 :]]
    result = documents.read_words(top, [PageWords(plain, page.digits), *pages[1:]], BOUND_KR)
    column = current_of(result)
    assert column.figures["sum_driftsinntekter"] == 722_632_310
    assert column.c1 == "fail"


def test_image_check_reports_every_difference() -> None:
    expected = json.loads((DOCUMENTS / f"expected-{STEM}.json").read_text(encoding="utf-8"))
    got = json.loads(json.dumps(expected))
    assert image_check.differences(got, expected) == []
    got["current"]["figures"]["driftsresultat"] = 12_200
    got["valuta"] = None
    assert image_check.differences(got, expected) == [
        ".current.figures.driftsresultat: read 12200, expected 122003",
        ".valuta: read None, expected 'NOK'",
    ]
    # A key missing on either side is reported, even where the other is null.
    missing = json.loads(json.dumps(expected))
    del missing["refusal"]
    assert image_check.differences(missing, expected) == [".refusal: missing from the read"]
    assert image_check.differences(expected, missing) == [".refusal: not in the expected JSON"]
    assert image_check.VERSION.match("tesseract 5.5.0")
    assert not image_check.VERSION.match("tesseract 5.3.0")


def test_image_check_compares_the_digits_pass() -> None:
    recorded = image_check.recorded_pages(DOCUMENTS, STEM)
    assert len(recorded) == 4
    assert image_check.digits_differences(recorded, recorded) == []
    # A digits-only pass that drops a digit from sum inntekter 2025.
    page = recorded[0]
    broken = [Word("7263231", w.left, w.top, w.width, w.height, w.line) if w.text == "72632310" else w for w in page.digits]
    assert broken != page.digits
    diff = image_check.digits_differences([PageWords(page.plain, broken), *recorded[1:]], recorded)
    assert diff == [".digits_pass.sum_driftsinntekter: read [7263231, 69051006], expected [72632310, 69051006]"]

