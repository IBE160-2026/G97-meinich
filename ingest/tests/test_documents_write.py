"""The document writer against the migrated local database, as `ingest`
(Story 2.1b; technical note AD-14, AD-15).

Each test runs inside a transaction that is rolled back (conftest `db`).
Skipped with a message when INGEST_DATABASE_URL is unset locally; required
in CI, where the database holds the demo seed.
"""

from __future__ import annotations

from datetime import UTC, datetime

import psycopg
import pytest

from conftest import FixtureTransport, aar_url, kopi_url, recorded
from document_fakes import FakeRecognise, generated, pdf, recorded_979607008_2025
from peerless_ingest import documents, parse, run, write
from peerless_ingest.config import Config
from test_write import company, one

READ_AT = datetime(2026, 10, 20, 9, 0, tzinfo=UTC)
ORGNR = "979607008"

# Hand-checked øre for both columns of 979607008/2025: the printed whole
# kroner (fixtures/documents/expected-979607008-2025.json, checked against
# the PDF in Story 2.1a) times 100, each written out as a literal.
# Annen driftskostnad 2025 and leverandørgjeld in both years are printed but
# absent from the read (the digits-only gate, Story 2.1a); varer is a heading
# with no figure. Nedskrivninger 2025 is a printed 0.
CONTRACT_CURRENT_ORE: dict[str, int | None] = {
    "salgsinntekt_ore": 7_198_715_700,
    "sum_driftsinntekter_ore": 7_263_231_000,
    "varekostnad_ore": 132_742_500,
    "lonnskostnad_ore": 5_558_266_000,
    "avskrivninger_ore": 542_935_700,
    "nedskrivninger_ore": 0,
    "annen_driftskostnad_ore": None,
    "sum_driftskostnad_ore": 7_251_030_700,
    "driftsresultat_ore": 12_200_300,
    "netto_finans_ore": -82_651_100,
    "ordinaert_resultat_foer_skattekostnad_ore": -70_450_800,
    "aarsresultat_ore": -154_100_900,
    "sum_immaterielle_eiendeler_ore": 1_621_324_500,
    "sum_varige_driftsmidler_ore": 119_776_800,
    "varer_ore": None,
    "kundefordringer_ore": 842_189_300,
    "bankinnskudd_ore": 211_535_600,
    "sum_eiendeler_ore": 3_107_354_400,
    "sum_egenkapital_ore": 776_418_900,
    "leverandorgjeld_ore": None,
    "sum_kortsiktig_gjeld_ore": 1_867_602_300,
    "sum_gjeld_ore": 2_330_935_500,
    "sum_egenkapital_gjeld_ore": 3_107_354_400,
}
CONTRACT_PRIOR_ORE: dict[str, int | None] = {
    "salgsinntekt_ore": 6_679_945_900,
    "sum_driftsinntekter_ore": 6_905_100_600,
    "varekostnad_ore": 74_432_700,
    "lonnskostnad_ore": 5_296_714_700,
    "avskrivninger_ore": 551_207_100,
    "nedskrivninger_ore": 32_852_700,
    "annen_driftskostnad_ore": 1_046_804_500,
    "sum_driftskostnad_ore": 7_002_011_700,
    "driftsresultat_ore": -96_911_100,
    "netto_finans_ore": -110_274_500,
    "ordinaert_resultat_foer_skattekostnad_ore": -207_185_700,
    "aarsresultat_ore": -261_156_000,
    "sum_immaterielle_eiendeler_ore": 1_461_500_300,
    "sum_varige_driftsmidler_ore": 210_272_300,
    "varer_ore": None,
    "kundefordringer_ore": 1_125_324_300,
    "bankinnskudd_ore": 450_251_300,
    "sum_eiendeler_ore": 3_561_502_500,
    "sum_egenkapital_ore": 930_519_800,
    "leverandorgjeld_ore": None,
    "sum_kortsiktig_gjeld_ore": 1_800_982_300,
    "sum_gjeld_ore": 2_630_982_700,
    "sum_egenkapital_gjeld_ore": 3_561_502_500,
}


def stored_column(conn: psycopg.Connection, orgnr: str, year: int, role: str) -> dict[str, object]:
    columns = ", ".join(write.FIGURE_COLUMNS)
    row = one(
        conn,
        f"""select stated_year, c1, c2, c3, c4, digits_pass_fields, dataset, {columns}
            from register.document_column where orgnr = %s and filing_year = %s and role = %s""",
        orgnr,
        year,
        role,
    )
    names = ("stated_year", "c1", "c2", "c3", "c4", "digits_pass_fields", "dataset", *write.FIGURE_COLUMNS)
    return dict(zip(names, row, strict=True))


def test_contract_979607008_2025_db(db: psycopg.Connection) -> None:
    write.write_company(db, company(ORGNR, "STATEMENT AS"))
    read = documents.read_words(*recorded_979607008_2025())
    write.write_document(db, ORGNR, 2025, write.document_outcome(2025, read), None, READ_AT)

    assert one(
        db,
        """select layout, status, refusal, valuta, unit_text, read_at, dataset
           from register.document where orgnr = %s and filing_year = %s""",
        ORGNR,
        2025,
    ) == ("generated", "extracted", None, "NOK", "NOK", READ_AT, "full")

    for role, year, expected in (("current", 2025, CONTRACT_CURRENT_ORE), ("prior", 2024, CONTRACT_PRIOR_ORE)):
        column = stored_column(db, ORGNR, 2025, role)
        assert column["stated_year"] == year
        assert (column["c1"], column["c2"], column["c3"], column["c4"]) == ("pass", "pass", "pass", "pass")
        assert column["digits_pass_fields"] == []
        assert column["dataset"] == "full"
        figures = {name: column[name] for name in write.FIGURE_COLUMNS}
        assert figures == expected, role
        for value in figures.values():
            assert value is None or type(value) is int

    # The ones the spec names.
    current = stored_column(db, ORGNR, 2025, "current")
    assert current["sum_driftsinntekter_ore"] == 7_263_231_000
    assert current["annen_driftskostnad_ore"] is None
    assert current["leverandorgjeld_ore"] is None and current["varer_ore"] is None
    assert current["nedskrivninger_ore"] == 0
    assert stored_column(db, ORGNR, 2025, "prior")["sum_egenkapital_ore"] == 930_519_800


def test_figure_columns_match_the_reading_library(db: psycopg.Connection) -> None:
    # One bigint øre column, with a unit comment, for every field 2.1a reads.
    rows = db.execute(
        """select a.attname, format_type(a.atttypid, a.atttypmod), col_description(a.attrelid, a.attnum)
           from pg_attribute a
           where a.attrelid = 'register.document_column'::regclass and a.attnum > 0 and not a.attisdropped
             and a.attname like '%%\\_ore'
           order by a.attnum"""
    ).fetchall()
    assert [name for name, _, _ in rows] == list(write.FIGURE_COLUMNS)
    assert len(write.FIGURE_COLUMNS) == 23
    for name, kind, comment in rows:
        assert kind == "bigint", name
        assert comment is not None and comment.startswith("øre (hundredths of document.valuta"), name


def test_ore_is_int_times_100() -> None:
    assert write.to_ore(72_632_310) == 7_263_231_000
    assert type(write.to_ore(72_632_310)) is int
    assert write.to_ore(-969_111) == -96_911_100
    assert write.to_ore(0) == 0  # a printed 0 is 0
    assert write.to_ore(None) is None  # absent stays absent, never 0
    for not_whole in (72_632_310.0, True, "72632310"):
        with pytest.raises(TypeError):
            write.to_ore(not_whole)  # type: ignore[arg-type]


def test_links_brreg_id_by_year(db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    # The API holds a 2025 SELSKAP filing for 979607008 and none for 2022.
    write.write_company(db, company(ORGNR, "STATEMENT AS"))
    [filing] = [parse.parse_filing(raw, ORGNR, READ_AT) for raw in parse.load_filings_json(recorded("regnskap_979607008_2025.json"))]
    write.write_filing(db, filing)
    assert write.filing_brreg_id(db, ORGNR, 2025) == 6984522
    assert write.filing_brreg_id(db, ORGNR, 2022) is None

    FakeRecognise(monkeypatch, {pdf("2022"): generated(2022), pdf("2025"): recorded_979607008_2025()})
    transport = FixtureTransport(
        {
            aar_url(ORGNR): b'["2022", "2025"]',
            kopi_url(ORGNR, 2022): pdf("2022"),
            kopi_url(ORGNR, 2025): pdf("2025"),
        }
    )
    summary = run.run_documents(db, transport, cfg, ["69.202"], [ORGNR], now=lambda: READ_AT)
    assert summary.failed == [] and summary.refused == []
    rows = db.execute(
        "select filing_year, brreg_id, status from register.document where orgnr = %s order by filing_year", (ORGNR,)
    ).fetchall()
    assert rows == [(2022, None, "extracted"), (2025, 6984522, "extracted")]


def test_document_and_columns_are_written_together(db: psycopg.Connection) -> None:
    # A column the database refuses rolls back its document row too: a rerun
    # then finds the year unstored and reads it again.
    write.write_company(db, company(ORGNR, "STATEMENT AS"))
    outcome = write.document_outcome(2025, documents.read_words(*recorded_979607008_2025()))
    current = outcome.columns[0][1]
    broken = write.DocumentOutcome(
        outcome.layout,
        outcome.status,
        outcome.refusal,
        outcome.valuta,
        outcome.unit_text,
        (("current", current), ("prior", current)),  # prior stating 2025 breaks the year CHECK
    )
    with pytest.raises(psycopg.errors.CheckViolation):
        write.write_document(db, ORGNR, 2025, broken, None, READ_AT)
    assert write.stored_document_years(db, ORGNR) == set()


def test_ingest_cannot_delete_documents(db: psycopg.Connection) -> None:
    for table in ("register.document", "register.document_column"):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with db.transaction():
                db.execute(f"delete from {table}")
