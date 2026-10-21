"""Reconciliation (Story 2.2; FR-57, FR-58): the two rules, the column and
document status, and that no confidence enters.

Pure: hand-built TSVs (`tsv_builder`) and the recorded 979607008/2025 output
and API filing. No Tesseract, no database, no network. Every amount is øre
unless a name says kroner.
"""

from __future__ import annotations

from datetime import UTC, datetime
from fractions import Fraction

import pytest

from conftest import BOUND_KR, RULES, recorded
from document_fakes import DOCUMENTS, recorded_979607008_2025
from peerless_ingest import documents, parse, reconcile, write
from peerless_ingest.ocr import PageWords, Word, read_tsv
from peerless_ingest.reconcile import SHARED_FIELDS, Reconciliation
from tsv_builder import BASE_ROWS, Row, document, replace_row

FLOOR_KR = RULES.between_sources_floor_kr
TOLERANCE = RULES.between_sources_tolerance
READ_AT = datetime(2026, 10, 21, 9, 0, tzinfo=UTC)


def read_rows(rows: list[Row]) -> documents.DocumentRead:
    return documents.read_words(*document(rows), BOUND_KR)


def api_of_filing(name: str, orgnr: str) -> dict[str, int | None]:
    """The shared figures of a recorded key-figures filing, in øre, by field."""
    [raw] = parse.load_filings_json(recorded(name))
    filing = parse.parse_filing(raw, orgnr, READ_AT)
    return {field: filing.key_figures[f"{field}_ore"] for field in SHARED_FIELDS}


def api_equal_to(column: documents.Column) -> dict[str, int | None]:
    """An API filing holding exactly the column's shared figures."""
    figures = write.figures_ore(column)
    return {field: figures[field] for field in SHARED_FIELDS}


def statuses(outcome: write.DocumentOutcome) -> dict[str, Reconciliation]:
    return {c.role: c.reconciliation for c in outcome.columns}


def checks_of(rec: Reconciliation) -> tuple[str, str, str, str]:
    return (rec.c1, rec.c2, rec.c3, rec.c4)


# --- The matrix ------------------------------------------------------------------------


def test_contract_979607008_2025_reconciles() -> None:
    # Sum inntekter, Årsresultat and Sum gjeld are each one krone off in the
    # register's print; both columns pass c1-c4 within 5 kr, and the current
    # column agrees with the API filing 6984522.
    read = documents.read_words(*recorded_979607008_2025(), BOUND_KR)
    api = api_of_filing("regnskap_979607008_2025.json", "979607008")
    outcome = write.document_outcome(2025, read, {2025: api}, RULES)
    assert outcome.status == "reconciled"
    current, prior = statuses(outcome)["current"], statuses(outcome)["prior"]
    assert checks_of(current) == ("pass", "pass", "pass", "pass")
    assert (current.api.check, current.api.fail_fields, current.status) == ("pass", (), "reconciled")
    # The recording holds no 2024 filing: the prior column is accepted on its own checks.
    assert checks_of(prior) == ("pass", "pass", "pass", "pass")
    assert (prior.api.check, prior.status) == ("not_evaluable", "reconciled")
    # Every shared figure the API holds was compared (none is NULL in either).
    assert all(api[field] is not None for field in SHARED_FIELDS)


def test_split_merge_fails() -> None:
    # Merged: 722 632 310 read for sum inntekter 72 632 310.
    merged = read_rows(replace_row(BASE_ROWS, "Sum inntekter", current="722 632 310"))
    outcome = write.document_outcome(2025, merged, {}, RULES)
    assert statuses(outcome)["current"].c1 == "fail"
    assert statuses(outcome)["current"].status == "failed_reconciliation"
    assert outcome.status == "failed_reconciliation"

    # Split: 8 335 514 read for a driftsresultat of 833 514.
    rows = replace_row(BASE_ROWS, "Sum kostnader", current="71 798 796")
    rows = replace_row(rows, "Driftsresultat", current="8 335 514")
    rows = replace_row(rows, "Resultat før skattekostnad", current="7 003")
    outcome = write.document_outcome(2025, read_rows(rows), {}, RULES)
    assert (statuses(outcome)["current"].c1, statuses(outcome)["current"].c2) == ("fail", "fail")
    assert outcome.status == "failed_reconciliation"
    # As printed correctly, the same column is reconciled.
    outcome = write.document_outcome(2025, read_rows(replace_row(rows, "Driftsresultat", current="833 514")), {}, RULES)
    assert outcome.status == "reconciled"


def test_absolute_bound_rejects_what_proportional_admits() -> None:
    # Driftsresultat 100 kr off on a sum inntekter of 72 632 310: 0.00014 %,
    # inside the between-sources tolerance of 0.001 % of that sum. The
    # within-document bound is absolute, so c1 fails: the rules are not one.
    figures = dict.fromkeys(documents.FIELDS)
    figures |= {"sum_driftsinntekter": 7_263_231_000, "sum_driftskostnad": 7_251_030_700, "driftsresultat": 12_210_300}
    deviation = 12_210_300 - (7_263_231_000 - 7_251_030_700)
    assert deviation == 10_000  # 100 kr
    assert deviation <= TOLERANCE * 7_263_231_000  # a proportional rule would admit it
    assert reconcile.within_document_checks(figures, BOUND_KR)["c1"] == "fail"
    rec = reconcile.reconcile_column("current", figures, None, RULES)
    assert (rec.c1, rec.status) == ("fail", "failed_reconciliation")


def test_millions_rounding_passes() -> None:
    # 923609016's pattern: the API states 127 221 000 000, the document
    # 127 220 000 000; 1 000 000 off is 0.00079 %, under 0.001 %.
    doc, api = 12_722_000_000_000, 12_722_100_000_000
    assert reconcile.figure_agrees(doc, api, FLOOR_KR, TOLERANCE)
    figures = dict.fromkeys(documents.FIELDS) | {"sum_eiendeler": doc}
    api_figures = dict.fromkeys(SHARED_FIELDS) | {"sum_eiendeler": api}
    assert reconcile.api_check(figures, api_figures, FLOOR_KR, TOLERANCE) == reconcile.ApiResult("pass", ())
    # Twice that deviation is outside it.
    assert not reconcile.figure_agrees(doc - 100_000_000, api, FLOOR_KR, TOLERANCE)


def test_floor_five_kroner() -> None:
    # On small figures the proportional term is under an øre: the 5 kr floor decides.
    assert reconcile.figure_agrees(30_000, 30_400, FLOOR_KR, TOLERANCE)  # 300 vs 304
    assert reconcile.figure_agrees(30_000, 30_500, FLOOR_KR, TOLERANCE)  # exactly 5 kr
    assert not reconcile.figure_agrees(30_000, 30_600, FLOOR_KR, TOLERANCE)  # 300 vs 306
    figures = dict.fromkeys(documents.FIELDS) | {"aarsresultat": 30_000}
    assert reconcile.api_check(figures, dict.fromkeys(SHARED_FIELDS) | {"aarsresultat": 30_400}, FLOOR_KR, TOLERANCE).check == "pass"
    assert reconcile.api_check(figures, dict.fromkeys(SHARED_FIELDS) | {"aarsresultat": 30_600}, FLOOR_KR, TOLERANCE) == (
        reconcile.ApiResult("fail", ("aarsresultat",))
    )


def test_swapped_digits_fail() -> None:
    # 911701251: 114 120 459 read against the register's 114 210 458.
    doc, api = 11_412_045_900, 11_421_045_800
    assert not reconcile.figure_agrees(doc, api, FLOOR_KR, TOLERANCE)
    # A tolerance of 0.1 % would have admitted it (Meinich, 2026-10-21).
    assert reconcile.figure_agrees(doc, api, FLOOR_KR, Fraction(1, 1000))
    figures = dict.fromkeys(documents.FIELDS) | {"sum_driftsinntekter": doc}
    result = reconcile.api_check(figures, dict.fromkeys(SHARED_FIELDS) | {"sum_driftsinntekter": api}, FLOOR_KR, TOLERANCE)
    assert result == reconcile.ApiResult("fail", ("sum_driftsinntekter",))


def test_factor_ten_fails() -> None:
    read = read_rows(BASE_ROWS)
    assert read.current is not None
    api = api_equal_to(read.current)
    assert write.document_outcome(2025, read, {2025: api}, RULES).status == "reconciled"
    api["sum_eiendeler"] = api["sum_eiendeler"] // 10  # type: ignore[operator]  # the document is 10 x the API
    outcome = write.document_outcome(2025, read, {2025: api}, RULES)
    current = statuses(outcome)["current"]
    assert checks_of(current) == ("pass", "pass", "pass", "pass")
    assert (current.api.check, current.api.fail_fields) == ("fail", ("sum_eiendeler",))
    assert (current.status, outcome.status) == ("failed_reconciliation", "failed_reconciliation")


def test_no_api_filing_not_evaluable() -> None:
    read = documents.read_words(*document(BASE_ROWS, years=("2022", "2021")), BOUND_KR)
    outcome = write.document_outcome(2022, read, {}, RULES)
    for rec in statuses(outcome).values():
        assert rec.api == reconcile.ApiResult("not_evaluable", ())
        assert rec.status == "reconciled"
    assert outcome.status == "reconciled"
    # A filing with no shared figure stated is not evaluable either; NULL is never 0.
    assert read.current is not None
    figures = write.figures_ore(read.current)
    assert reconcile.api_check(figures, dict.fromkeys(SHARED_FIELDS), FLOOR_KR, TOLERANCE).check == "not_evaluable"
    # And a figure the document lacks is not compared.
    assert reconcile.api_check(dict.fromkeys(documents.FIELDS), api_equal_to(read.current), FLOOR_KR, TOLERANCE).check == (
        "not_evaluable"
    )


def test_core_check_must_be_evaluable() -> None:
    # c3 not evaluable (sum eiendeler unread), the rest pass: not reconciled.
    read = read_rows(replace_row(BASE_ROWS, "SUM EIENDELER", current="31 o73 544"))
    outcome = write.document_outcome(2025, read, {}, RULES)
    current = statuses(outcome)["current"]
    assert checks_of(current) == ("pass", "pass", "not_evaluable", "pass")
    assert (current.status, outcome.status) == ("failed_reconciliation", "failed_reconciliation")
    # The same for c1; c2 or c4 unevaluable alone does not fail the column.
    assert reconcile.column_status("current", "not_evaluable", "pass", "pass", "pass", "pass") == "failed_reconciliation"
    assert reconcile.column_status("current", "pass", "not_evaluable", "pass", "not_evaluable", "not_evaluable") == "reconciled"


def test_prior_failure_does_not_fail_filing() -> None:
    read = read_rows(replace_row(BASE_ROWS, "Sum inntekter", prior="69 051 106"))  # 100 kr off
    outcome = write.document_outcome(2025, read, {}, RULES)
    assert statuses(outcome)["prior"].c1 == "fail"
    assert statuses(outcome)["prior"].status == "failed_reconciliation"
    assert statuses(outcome)["current"].status == "reconciled"
    assert outcome.status == "reconciled"
    # The current column alone decides: when it fails, the filing fails.
    read = read_rows(replace_row(BASE_ROWS, "Sum inntekter", current="72 632 410"))  # 100 kr off
    assert write.document_outcome(2025, read, {}, RULES).status == "failed_reconciliation"


def test_prior_register_deviation_is_information() -> None:
    # 924830972's pattern: the prior column passes c1-c4 and differs from the
    # register's own filing for that year by +56 007 in two sums, a restated
    # comparative. Stored, never a status.
    read = read_rows(BASE_ROWS)
    assert read.prior is not None and read.current is not None
    api_2024 = api_equal_to(read.prior)
    api_2024["sum_eiendeler"] -= 5_600_700  # type: ignore[operator]
    api_2024["sum_gjeld"] -= 5_600_700  # type: ignore[operator]
    outcome = write.document_outcome(2025, read, {2025: api_equal_to(read.current), 2024: api_2024}, RULES)
    prior = statuses(outcome)["prior"]
    assert checks_of(prior) == ("pass", "pass", "pass", "pass")
    assert prior.api == reconcile.ApiResult("fail", ("sum_eiendeler", "sum_gjeld"))
    assert prior.status == "reconciled"
    assert outcome.status == "reconciled"
    # The same deviation on the current column fails the filing.
    api_2025 = api_equal_to(read.current)
    api_2025["sum_gjeld"] -= 5_600_700  # type: ignore[operator]
    assert write.document_outcome(2025, read, {2025: api_2025}, RULES).status == "failed_reconciliation"


def _with_confidence(text: str, conf: str) -> str:
    """A Tesseract TSV with every word's `conf` replaced."""
    lines = text.split("\n")
    header = lines[0].split("\t")
    at = header.index("conf")
    out = [lines[0]]
    for line in lines[1:]:
        cells = line.split("\t")
        if len(cells) == len(header):
            cells[at] = conf
        out.append("\t".join(cells))
    return "\n".join(out)


def test_flag_ignores_confidence() -> None:
    # Every conf in the recorded TSVs rewritten: the same figures, checks,
    # comparison and status. No reconciliation function takes a confidence.
    api = api_of_filing("regnskap_979607008_2025.json", "979607008")

    def outcome_with(conf: str | None) -> write.DocumentOutcome:
        def tsv(name: str) -> list[Word]:
            text = (DOCUMENTS / name).read_text(encoding="utf-8")
            return read_tsv(text if conf is None else _with_confidence(text, conf))

        stem = "979607008-2025"
        pages = [PageWords(tsv(f"{stem}.p{n}.plain.tsv"), tsv(f"{stem}.p{n}.digits.tsv")) for n in (2, 3, 4, 5)]
        read = documents.read_words(tsv(f"{stem}.top.tsv"), pages, BOUND_KR)
        return write.document_outcome(2025, read, {2025: api}, RULES)

    baseline = outcome_with(None)
    assert baseline.status == "reconciled"
    for conf in ("0", "-1", "100", "12.5"):
        assert outcome_with(conf) == baseline, conf
    # The text really changed: confidences are in the recording, and rewritten.
    original = (DOCUMENTS / "979607008-2025.p2.plain.tsv").read_text(encoding="utf-8")
    assert _with_confidence(original, "0") != original
    for name in ("within_document_checks", "api_check", "column_status", "reconcile_column", "document_status"):
        params = getattr(reconcile, name).__code__.co_varnames
        assert not any("conf" in p for p in params), name


# --- Arithmetic and input guards ---------------------------------------------------------


def test_no_float_enters() -> None:
    with pytest.raises(ValueError):
        reconcile.api_check({}, None, FLOOR_KR, 0.00001)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        reconcile.within_document_checks(dict.fromkeys(documents.FIELDS), 5.0)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        documents.checks(dict.fromkeys(documents.FIELDS), -1)


def test_shared_fields_are_the_names_both_hold() -> None:
    key_figures = {column.removesuffix("_ore") for column in parse.KEY_FIGURE_COLUMNS}
    assert SHARED_FIELDS == tuple(f for f in documents.FIELDS if f in key_figures)
    assert len(SHARED_FIELDS) == 11


def test_document_status_needs_one_current_column() -> None:
    rec = reconcile.reconcile_column("prior", dict.fromkeys(documents.FIELDS), None, RULES)
    with pytest.raises(ValueError):
        reconcile.document_status([("prior", rec)])

