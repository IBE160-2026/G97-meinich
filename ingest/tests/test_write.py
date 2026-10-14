"""Write and contract tests against the migrated local database, as `ingest`.

Each test runs inside a transaction that is rolled back (conftest `db`).
Skipped with a message when INGEST_DATABASE_URL is unset locally; required
in CI.
"""

from __future__ import annotations

import dataclasses
import json
from datetime import UTC, datetime

import psycopg
import pytest

from conftest import BASE_URL, FixtureTransport, enhet_url, recorded, regnskap_url
from peerless_ingest import parse, run, write
from peerless_ingest.config import Config
from test_parse import CONTRACT_979607008_2025

READ_AT = datetime(2026, 10, 11, 9, 0, tzinfo=UTC)
# A companies-only run after the run that stored the companies.
LATER = datetime(2026, 10, 14, 12, 0, tzinfo=UTC)


def company(orgnr: str, navn: str = "TEST AS") -> parse.Company:
    return parse.Company(
        orgnr=orgnr,
        navn=navn,
        organisasjonsform="AS",
        naeringskode1="69.202",
        naeringskode2=None,
        naeringskode3=None,
        konkurs=False,
        under_avvikling=False,
        under_tvangsavvikling=False,
        read_at=READ_AT,
        forretningsadresse_kommunenummer=None,
        forretningsadresse_kommune=None,
        naeringskode1_beskrivelse=None,
        search_fields_read_at=READ_AT,
    )


def filings_of(name: str, orgnr: str) -> list[parse.Filing]:
    return [parse.parse_filing(raw, orgnr, READ_AT) for raw in parse.load_filings_json(recorded(name))]


def one(conn: psycopg.Connection, query: str, *params: object) -> tuple:
    row = conn.execute(query, params).fetchone()
    assert row is not None
    return row


def count(conn: psycopg.Connection, query: str, *params: object) -> int:
    return int(one(conn, query, *params)[0])


def filing_state(conn: psycopg.Connection, brreg_id: int) -> list[tuple]:
    """The filing and key-figures rows of one filing, as text, or [] when absent.

    Lets a test assert that a run left a filing as it was, whether the database
    is empty or holds the demo seed (which includes 919951834).
    """
    return conn.execute(
        """select f::text, k::text from register.filing f
           left join register.key_figures k using (brreg_id) where f.brreg_id = %s""",
        (brreg_id,),
    ).fetchall()


def written_by_run(conn: psycopg.Connection, orgnr: str) -> int:
    """Filings of orgnr whose read_at is this test run's READ_AT."""
    return count(conn, "select count(*) from register.filing where orgnr = %s and read_at = %s", orgnr, READ_AT)


def test_connected_as_ingest(db: psycopg.Connection) -> None:
    assert one(db, "select current_user")[0] == "ingest"


def test_contract_979607008_2025(db: psycopg.Connection) -> None:
    write.write_company(db, company("979607008", "STATEMENT AS"))
    [filing] = filings_of("regnskap_979607008_2025.json", "979607008")
    write.write_filing(db, filing)

    columns = ", ".join(parse.KEY_FIGURE_COLUMNS)
    row = one(db, f"select {columns} from register.key_figures where brreg_id = %s", 6984522)
    stored = dict(zip(parse.KEY_FIGURE_COLUMNS, row, strict=True))
    assert stored == CONTRACT_979607008_2025
    assert stored["sum_driftsinntekter_ore"] == 7_263_231_000
    assert stored["sum_eiendeler_ore"] == 3_107_354_400
    for value in stored.values():
        assert value is None or isinstance(value, int)

    meta = one(
        db,
        """select filing_year, periode_fra::text, periode_til::text, regnskapstype, journalnr, valuta,
                  regnskapsregler, smaa_foretak, avviklingsregnskap, oppstillingsplan, reporting_unit,
                  status, read_at
           from register.filing where brreg_id = %s""",
        6984522,
    )
    assert meta == (
        2025,
        "2025-01-01",
        "2025-12-31",
        "SELSKAP",
        "2026591255",
        "NOK",
        "regnskapslovenAlminneligRegler",
        True,
        False,
        "store",
        "api_whole_units",
        "not_extracted",
        READ_AT,
    )


def test_amount_columns_are_bigint_ore_with_a_unit_comment(db: psycopg.Connection) -> None:
    rows = db.execute(
        """select a.attname, format_type(a.atttypid, a.atttypmod), col_description(a.attrelid, a.attnum)
           from pg_attribute a
           where a.attrelid = 'register.key_figures'::regclass and a.attnum > 0 and not a.attisdropped
             and a.attname <> 'brreg_id'
           order by a.attnum"""
    ).fetchall()
    assert [name for name, _, _ in rows] == list(parse.KEY_FIGURE_COLUMNS)
    for name, kind, comment in rows:
        assert kind == "bigint", name
        assert comment is not None and comment.startswith("øre"), name


def test_two_names_one_company_row(db: psycopg.Connection) -> None:
    write.write_company(db, company("979607008", "EKSTRA RESSURS AS"))
    write.write_company(db, company("979607008", "STATEMENT AS"))
    assert count(db, "select count(*) from register.company where orgnr = %s", "979607008") == 1
    assert one(db, "select navn from register.company where orgnr = %s", "979607008")[0] == "STATEMENT AS"


def test_selskap_and_konsern_are_two_rows_each(db: psycopg.Connection) -> None:
    write.write_company(db, company("923609016", "EQUINOR ASA"))
    for filing in filings_of("regnskap_923609016.json", "923609016"):
        write.write_filing(db, filing)
    rows = db.execute(
        "select regnskapstype, filing_year from register.filing where orgnr = %s and filing_year = 2025 order by 1",
        ("923609016",),
    ).fetchall()
    assert rows == [("KONSERN", 2025), ("SELSKAP", 2025)]
    assert count(
        db,
        """select count(*) from register.key_figures k join register.filing f using (brreg_id)
           where f.orgnr = %s""",
        "923609016",
    ) == 6


def test_millions_reporter_amounts_times_100(db: psycopg.Connection) -> None:
    write.write_company(db, company("923609016", "EQUINOR ASA"))
    raws = parse.load_filings_json(recorded("regnskap_923609016.json"))
    for raw in raws:
        write.write_filing(db, parse.parse_filing(raw, "923609016", READ_AT))
    for raw in raws:
        stored = one(
            db,
            """select k.sum_eiendeler_ore, f.reporting_unit from register.key_figures k
               join register.filing f using (brreg_id) where brreg_id = %s""",
            raw["id"],
        )
        assert stored == (int(raw["eiendeler"]["sumEiendeler"]) * 100, "api_whole_units")


def test_reissued_filing_updates_the_row_and_its_key_figures(db: psycopg.Connection) -> None:
    write.write_company(db, company("979607008"))
    [filing] = filings_of("regnskap_979607008_2025.json", "979607008")
    write.write_filing(db, filing)
    reissued = dataclasses.replace(
        filing,
        brreg_id=filing.brreg_id + 1_000_000_000,
        key_figures={**filing.key_figures, "aarsresultat_ore": -154_100_800},
    )
    write.write_filing(db, reissued)

    rows = db.execute(
        "select brreg_id from register.filing where orgnr = %s and regnskapstype = 'SELSKAP' and filing_year = 2025",
        ("979607008",),
    ).fetchall()
    assert rows == [(reissued.brreg_id,)]
    assert count(db, "select count(*) from register.key_figures where brreg_id = %s", filing.brreg_id) == 0
    assert one(db, "select aarsresultat_ore from register.key_figures where brreg_id = %s", reissued.brreg_id) == (
        -154_100_800,
    )


def test_atomic_write_leaves_no_filing_when_key_figures_fail(db: psycopg.Connection) -> None:
    write.write_company(db, company("979607008"))
    [filing] = filings_of("regnskap_979607008_2025.json", "979607008")
    # 10^19 øre is beyond bigint: the filing row inserts, key_figures fails.
    broken = dataclasses.replace(filing, key_figures={**filing.key_figures, "sum_eiendeler_ore": 10**19})
    with pytest.raises(psycopg.errors.NumericValueOutOfRange):
        write.write_filing(db, broken)
    assert count(db, "select count(*) from register.filing where brreg_id = %s", filing.brreg_id) == 0
    # The connection is still usable and the next filing is written.
    write.write_filing(db, filing)
    assert count(db, "select count(*) from register.key_figures where brreg_id = %s", filing.brreg_id) == 1


def test_ingest_cannot_delete_or_run_ddl(db: psycopg.Connection) -> None:
    for statement in ("delete from register.company", "create table register.ingest_was_here (id int)"):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with db.transaction():
                db.execute(statement)


# --- The run, end to end, against recorded responses ---------------------------


def run_transport(overrides: dict[str, bytes | None] | None = None) -> FixtureTransport:
    responses: dict[str, bytes | None] = {
        regnskap_url("919951834"): recorded("regnskap_919951834.json"),
        enhet_url("967534579"): recorded("enhet_967534579.json"),
        regnskap_url("967534579"): recorded("regnskap_967534579.json"),
    }
    responses.update(overrides or {})
    return FixtureTransport(responses, bulk=recorded("enheter_lastned.json"))


def test_run_loads_covered_code_and_demo_c_and_names_the_sn2007_code(db: psycopg.Connection, cfg: Config) -> None:
    transport = run_transport()
    summary = run.run(db, transport, cfg, ["62.100", "62.010"], now=lambda: READ_AT)

    assert summary.codes["62.100"].companies == 1
    assert summary.codes["62.100"].filings_written == 3
    assert summary.codes_returning_nothing() == ["62.010"]
    assert summary.demo_found and summary.demo_navn == "KANTALL AS"
    assert summary.demo_filings_written == 3
    assert summary.rejected == [] and summary.failed == []
    text = "\n".join(summary.lines())
    assert "62.010: the register returned nothing" in text
    assert "62.100: 1 companies" in text
    assert "demo company C 967534579 (KANTALL AS): 3 filings written" in text

    # A secondary-code company (990051232) is neither stored nor asked for.
    assert count(db, "select count(*) from register.company where orgnr = %s", "990051232") == 0
    assert regnskap_url("990051232") not in transport.requested
    # Nothing is matched to the SN2007 code.
    assert count(db, "select count(*) from register.company where naeringskode1 = %s", "62.010") == 0
    # No document is fetched: only the bulk download, the accounts and C.
    assert all("aarsregnskap" not in url for url in transport.requested)

    kantall = one(
        db,
        """select count(*), min(filing_year), max(filing_year) from register.filing
           where orgnr = %s and status = 'not_extracted'""",
        "967534579",
    )
    assert kantall == (3, 2023, 2025)
    assert one(db, "select naeringskode1, organisasjonsform from register.company where orgnr = %s", "967534579") == (
        "69.202",
        "AS",
    )


def search_fields(conn: psycopg.Connection, orgnr: str) -> tuple:
    return one(
        conn,
        """select forretningsadresse_kommunenummer, forretningsadresse_kommune, naeringskode1_beskrivelse,
                  search_fields_read_at, read_at
           from register.company where orgnr = %s""",
        orgnr,
    )


def test_run_stores_the_search_fields_read_with_the_unit(db: psycopg.Connection, cfg: Config) -> None:
    run.run(db, run_transport(), cfg, ["62.100"], now=lambda: READ_AT)

    # From the bulk download (919951834) and from the single-unit endpoint
    # (demo company C), as delivered; read at the same time as the rest.
    assert search_fields(db, "919951834") == ("1103", "STAVANGER", "Dataprogrammeringstjenester", READ_AT, READ_AT)
    assert search_fields(db, "967534579") == ("3405", "LILLEHAMMER", "Regnskapsføring og bokføring", READ_AT, READ_AT)


def test_run_stores_no_municipality_without_a_business_address(db: psycopg.Connection, cfg: Config) -> None:
    units = json.loads(recorded("enheter_lastned.json"))
    for unit in units:
        if unit["organisasjonsnummer"] == "919951834":
            del unit["forretningsadresse"]  # postadresse remains
    transport = FixtureTransport(run_transport().responses, bulk=json.dumps(units).encode("utf-8"))
    run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert search_fields(db, "919951834") == (None, None, "Dataprogrammeringstjenester", READ_AT, READ_AT)


# --- Companies-only mode (Story 1.5a) ------------------------------------------

BULK_ORGNRS = {"919951834", "990051232", "979607008", "967534579"}
# In the database, never in the bulk file.
ABSENT = "000000000"


def stored_orgnrs(conn: psycopg.Connection) -> set[str]:
    return {row[0] for row in conn.execute("select orgnr from register.company").fetchall()}


def company_row(conn: psycopg.Connection, orgnr: str) -> str:
    return one(conn, "select c::text from register.company c where orgnr = %s", orgnr)[0]


def prepare_companies_only(db: psycopg.Connection) -> None:
    """Two bulk companies stored by an earlier run, under an old name and
    without search fields, one with a filing; and one company the bulk file
    does not have."""
    # Stored under its bulk primary code, so its description is kept.
    write.write_company(db, dataclasses.replace(company("919951834", "OLD NAME AS"), naeringskode1="62.100"))
    write.write_company(db, company("979607008", "EKSTRA RESSURS AS"))
    [filing] = filings_of("regnskap_979607008_2025.json", "979607008")
    write.write_filing(db, filing)
    write.write_company(db, company(ABSENT, "WITHDRAWN AS"))


def companies_only_transport() -> FixtureTransport:
    # Only the bulk download: any other request fails the test.
    return FixtureTransport({}, bulk=recorded("enheter_lastned.json"))


def test_companies_only_updates_the_search_fields_and_nothing_else(db: psycopg.Connection, cfg: Config) -> None:
    prepare_companies_only(db)
    filing_before = filing_state(db, 6984522)
    stored = stored_orgnrs(db)
    transport = companies_only_transport()

    summary = run.run_companies_only(db, transport, cfg, now=lambda: LATER)

    assert transport.requested == [f"{BASE_URL}/enhetsregisteret/api/enheter/lastned"]
    # The search fields come from the bulk file, read at the run's time;
    # navn and read_at are those of the run that stored the company.
    assert search_fields(db, "919951834") == ("1103", "STAVANGER", "Dataprogrammeringstjenester", LATER, READ_AT)
    assert search_fields(db, "979607008") == ("0301", "OSLO", "Regnskapsføring og bokføring", LATER, READ_AT)
    assert one(db, "select navn from register.company where orgnr = %s", "919951834") == ("OLD NAME AS",)
    assert one(db, "select navn from register.company where orgnr = %s", "979607008") == ("EKSTRA RESSURS AS",)
    # The filing, with its read_at, is untouched.
    assert filing_state(db, 6984522) == filing_before
    # No company added, none deleted.
    assert stored_orgnrs(db) == stored

    assert summary.in_database == len(stored)
    assert summary.updated == len(stored & BULK_ORGNRS)
    assert summary.not_found == sorted(stored - BULK_ORGNRS)
    assert summary.failed == [] and not summary.needs_operator()


def test_companies_only_leaves_a_company_missing_from_the_bulk_file(db: psycopg.Connection, cfg: Config) -> None:
    prepare_companies_only(db)
    before = company_row(db, ABSENT)

    summary = run.run_companies_only(db, companies_only_transport(), cfg, now=lambda: LATER)

    assert company_row(db, ABSENT) == before
    assert search_fields(db, ABSENT)[3] == READ_AT  # as the earlier run left it
    assert ABSENT in summary.not_found
    lines = summary.lines()
    assert f"not found in bulk file {len(summary.not_found)}" in lines[1]
    assert f"updated {summary.updated}," in lines[1]
    assert f"  not found in bulk file, left untouched: {ABSENT}" in lines


def test_companies_only_inserts_no_bulk_unit_that_is_not_stored(db: psycopg.Connection, cfg: Config) -> None:
    prepare_companies_only(db)
    # 990051232 is in the bulk file, with 62.100 only as a secondary code.
    assert count(db, "select count(*) from register.company where orgnr = %s", "990051232") == 0

    run.run_companies_only(db, companies_only_transport(), cfg, now=lambda: LATER)

    assert count(db, "select count(*) from register.company where orgnr = %s", "990051232") == 0


def test_companies_only_names_a_failed_write_and_continues(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    prepare_companies_only(db)
    real = write.update_company_search_fields

    def failing(conn: psycopg.Connection, comp: parse.Company, read_at: datetime) -> bool:
        if comp.orgnr == "919951834":
            raise psycopg.errors.InsufficientPrivilege("refused in the test")
        return real(conn, comp, read_at)

    monkeypatch.setattr(run.write, "update_company_search_fields", failing)
    summary = run.run_companies_only(db, companies_only_transport(), cfg, now=lambda: LATER)

    assert [p.orgnr for p in summary.failed] == ["919951834"]
    assert "919951834" not in summary.not_found
    assert summary.needs_operator()
    assert search_fields(db, "919951834")[3] == READ_AT
    assert search_fields(db, "979607008")[3] == LATER


def test_companies_only_reports_no_row_to_update_as_failed(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    prepare_companies_only(db)
    real = write.update_company_search_fields

    def vanished(conn: psycopg.Connection, comp: parse.Company, read_at: datetime) -> bool:
        if comp.orgnr == "919951834":
            return False
        return real(conn, comp, read_at)

    monkeypatch.setattr(run.write, "update_company_search_fields", vanished)
    summary = run.run_companies_only(db, companies_only_transport(), cfg, now=lambda: LATER)

    assert [(p.orgnr, p.what) for p in summary.failed] == [("919951834", "no row to update")]
    assert "919951834" not in summary.not_found
    assert summary.needs_operator()


def test_companies_only_names_a_changed_primary_code(db: psycopg.Connection, cfg: Config) -> None:
    prepare_companies_only(db)
    units = json.loads(recorded("enheter_lastned.json"))
    for unit in units:
        if unit["organisasjonsnummer"] == "979607008":
            unit["naeringskode1"] = {"kode": "31.010", "beskrivelse": "Produksjon av møbler"}
    transport = FixtureTransport({}, bulk=json.dumps(units).encode("utf-8"))

    summary = run.run_companies_only(db, transport, cfg, now=lambda: LATER)

    # The bulk description names 31.010, not the stored 69.202: NULL, and
    # reported, not an error. The municipality is still stored, and the code
    # itself is left for a full run.
    assert one(
        db,
        "select naeringskode1, naeringskode1_beskrivelse, forretningsadresse_kommune from register.company where orgnr = %s",
        "979607008",
    ) == ("69.202", None, "OSLO")
    differs = {orgnr: (stored, bulk) for orgnr, stored, bulk in summary.code_differs}
    assert differs["979607008"] == ("69.202", "31.010")
    assert set(differs) == {"979607008"}
    assert not summary.needs_operator()
    lines = summary.lines()
    assert f"  code differs from stored naeringskode1, description stored as NULL: {len(summary.code_differs)}" in lines
    assert "  code differs: 979607008 stored 69.202 bulk 31.010" in lines


def test_run_reports_a_non_whole_amount_and_writes_the_rest(db: psycopg.Connection, cfg: Config) -> None:
    filings = json.loads(recorded("regnskap_919951834.json"))
    filings[0]["eiendeler"]["sumEiendeler"] = 1234.5
    transport = run_transport({regnskap_url("919951834"): json.dumps(filings).encode("utf-8")})
    before = filing_state(db, filings[0]["id"])
    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert [(p.orgnr, p.what) for p in summary.rejected] == [
        ("919951834", "field eiendeler.sumEiendeler: not a whole amount: 1234.5")
    ]
    assert summary.codes["62.100"].filings_written == 2
    # The rejected filing is left as it was (absent, or the seed's row); the
    # other two are written by this run.
    assert filing_state(db, filings[0]["id"]) == before
    assert written_by_run(db, "919951834") == 2
    assert "rejected filing, not written: 919951834 field eiendeler.sumEiendeler" in "\n".join(summary.lines())


def test_run_rolls_back_a_failed_filing_and_continues(db: psycopg.Connection, cfg: Config) -> None:
    filings = json.loads(recorded("regnskap_919951834.json"))
    # Beyond bigint once in øre: the key_figures insert fails.
    filings[0]["eiendeler"]["sumEiendeler"] = 10**17
    transport = run_transport({regnskap_url("919951834"): json.dumps(filings).encode("utf-8")})
    before = filing_state(db, filings[0]["id"])
    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert len(summary.failed) == 1
    assert summary.failed[0].orgnr == "919951834"
    assert summary.failed[0].what.startswith(f"filing {filings[0]['id']} ")
    # Rolled back: the failed filing is left as it was (absent, or the seed's
    # row); the other two are written by this run.
    assert filing_state(db, filings[0]["id"]) == before
    assert written_by_run(db, "919951834") == 2
    assert summary.demo_filings_written == 3


def test_run_names_an_unreadable_response_and_continues(db: psycopg.Connection, cfg: Config) -> None:
    transport = run_transport({regnskap_url("919951834"): b"<html>not json</html>"})
    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert [p.orgnr for p in summary.failed] == ["919951834"]
    assert summary.failed[0].what.startswith("key figures: JSONDecodeError")
    assert summary.codes["62.100"].companies == 1
    assert summary.codes["62.100"].filings_written == 0
    assert summary.demo_filings_written == 3


def test_run_company_without_key_figures(db: psycopg.Connection, cfg: Config) -> None:
    transport = run_transport({regnskap_url("919951834"): None})
    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert count(db, "select count(*) from register.company where orgnr = %s", "919951834") == 1
    code = summary.codes["62.100"]
    assert (code.companies, code.companies_with_filings, code.filings_written) == (1, 0, 0)
    assert summary.failed == [] and summary.rejected == []
    assert "62.100: 1 companies, 0 with filings, 0 filings written" in summary.lines()[1]


def test_run_demo_c_not_found(db: psycopg.Connection, cfg: Config) -> None:
    transport = run_transport({enhet_url("967534579"): None})
    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert summary.demo_found is False
    assert "  demo company C 967534579: not found in Enhetsregisteret" in summary.lines()
    assert regnskap_url("967534579") not in transport.requested
    assert summary.needs_operator()


def test_run_bulk_unit_without_valid_orgnr_is_named(db: psycopg.Connection, cfg: Config) -> None:
    units = json.loads(recorded("enheter_lastned.json"))
    broken = json.loads(json.dumps(units[0]))
    broken["organisasjonsnummer"] = "12345"
    transport = FixtureTransport(run_transport().responses, bulk=json.dumps([broken, *units]).encode("utf-8"))
    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert [(p.orgnr, p.what.startswith("bulk unit not loaded")) for p in summary.failed] == [("12345", True)]
    assert summary.codes["62.100"].companies == 1
    assert summary.codes["62.100"].filings_written == 3
    assert summary.demo_filings_written == 3


# --- main's exit code -------------------------------------------------------------


def clean_summary() -> run.Summary:
    summary = run.Summary(codes={"62.100": run.CodeSummary("62.100", 1, 1, 3)}, demo_orgnr="967534579")
    summary.demo_found = True
    summary.demo_navn = "KANTALL AS"
    summary.demo_filings_written = 3
    return summary


def with_failed(s: run.Summary) -> None:
    s.failed.append(run.Problem("919951834", "x"))


def with_rejected(s: run.Summary) -> None:
    s.rejected.append(run.Problem("919951834", "x"))


def without_demo(s: run.Summary) -> None:
    s.demo_found = False
    s.demo_filings_written = 0


def demo_without_filings(s: run.Summary) -> None:
    s.demo_filings_written = 0


def code_without_companies(s: run.Summary) -> None:
    s.codes["62.010"] = run.CodeSummary("62.010")


@pytest.mark.parametrize(
    "spoil",
    [None, with_failed, with_rejected, without_demo, demo_without_filings, code_without_companies],
    ids=["clean", "failed", "rejected", "demo-not-found", "demo-no-filings", "code-no-companies"],
)
def test_main_exit_code(monkeypatch: pytest.MonkeyPatch, cfg: Config, spoil: object) -> None:
    summary = clean_summary()
    if callable(spoil):
        spoil(summary)

    class NoConnection:
        def __enter__(self) -> object:
            return object()

        def __exit__(self, *_: object) -> None:
            return None

    monkeypatch.setattr(run.config_module, "load_config", lambda _path: cfg)
    monkeypatch.setattr(run.config_module, "load_coverage", lambda _path: list(summary.codes))
    monkeypatch.setattr(run.config_module, "database_url", lambda: "postgresql://unused")
    monkeypatch.setattr(run.write, "connect", lambda _url: NoConnection())
    monkeypatch.setattr(run, "run", lambda *_args, **_kwargs: summary)

    assert run.main([]) == (0 if spoil is None else 1)


def test_main_selects_companies_only_mode(monkeypatch: pytest.MonkeyPatch, cfg: Config) -> None:
    calls: list[str] = []

    class NoConnection:
        def __enter__(self) -> object:
            return object()

        def __exit__(self, *_: object) -> None:
            return None

    def companies_only(*_args: object, **_kwargs: object) -> run.CompaniesOnlySummary:
        calls.append("companies-only")
        return run.CompaniesOnlySummary(in_database=2, updated=1, not_found=["000000000"])

    def full(*_args: object, **_kwargs: object) -> run.Summary:
        raise AssertionError("the full run must not start in companies-only mode")

    monkeypatch.setattr(run.config_module, "load_config", lambda _path: cfg)
    def no_coverage(_path: object) -> list[str]:
        raise AssertionError("companies-only mode must not read coverage.json")

    monkeypatch.setattr(run.config_module, "load_coverage", no_coverage)
    monkeypatch.setattr(run.config_module, "database_url", lambda: "postgresql://unused")
    monkeypatch.setattr(run.write, "connect", lambda _url: NoConnection())
    monkeypatch.setattr(run, "run", full)
    monkeypatch.setattr(run, "run_companies_only", companies_only)

    # A company not found in the bulk file is expected: exit 0.
    assert run.main(["--companies-only"]) == 0
    assert calls == ["companies-only"]


@pytest.mark.parametrize("argv", [["--company-only"], ["--companies-only", "x"], ["62.100"]])
def test_main_refuses_other_arguments(monkeypatch: pytest.MonkeyPatch, argv: list[str]) -> None:
    def no_connection(_url: str) -> object:
        raise AssertionError("a refused argument must not reach the database")

    monkeypatch.setattr(run.write, "connect", no_connection)
    assert run.main(argv) == 2
