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

from conftest import FixtureTransport, enhet_url, recorded, regnskap_url
from peerless_ingest import parse, run, write
from peerless_ingest.config import Config
from test_parse import CONTRACT_979607008_2025

READ_AT = datetime(2026, 10, 11, 9, 0, tzinfo=UTC)


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
    )


def filings_of(name: str, orgnr: str) -> list[parse.Filing]:
    return [parse.parse_filing(raw, orgnr, READ_AT) for raw in parse.load_filings_json(recorded(name))]


def one(conn: psycopg.Connection, query: str, *params: object) -> tuple:
    row = conn.execute(query, params).fetchone()
    assert row is not None
    return row


def count(conn: psycopg.Connection, query: str, *params: object) -> int:
    return int(one(conn, query, *params)[0])


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


def test_run_reports_a_non_whole_amount_and_writes_the_rest(db: psycopg.Connection, cfg: Config) -> None:
    filings = json.loads(recorded("regnskap_919951834.json"))
    filings[0]["eiendeler"]["sumEiendeler"] = 1234.5
    transport = run_transport({regnskap_url("919951834"): json.dumps(filings).encode("utf-8")})
    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert [(p.orgnr, p.what) for p in summary.rejected] == [
        ("919951834", "field eiendeler.sumEiendeler: not a whole amount: 1234.5")
    ]
    assert summary.codes["62.100"].filings_written == 2
    assert count(db, "select count(*) from register.filing where brreg_id = %s", filings[0]["id"]) == 0
    assert count(db, "select count(*) from register.filing where orgnr = %s", "919951834") == 2
    assert "rejected filing, not written: 919951834 field eiendeler.sumEiendeler" in "\n".join(summary.lines())


def test_run_rolls_back_a_failed_filing_and_continues(db: psycopg.Connection, cfg: Config) -> None:
    filings = json.loads(recorded("regnskap_919951834.json"))
    # Beyond bigint once in øre: the key_figures insert fails.
    filings[0]["eiendeler"]["sumEiendeler"] = 10**17
    transport = run_transport({regnskap_url("919951834"): json.dumps(filings).encode("utf-8")})
    summary = run.run(db, transport, cfg, ["62.100"], now=lambda: READ_AT)

    assert len(summary.failed) == 1
    assert summary.failed[0].orgnr == "919951834"
    assert summary.failed[0].what.startswith(f"filing {filings[0]['id']} ")
    assert count(db, "select count(*) from register.filing where brreg_id = %s", filings[0]["id"]) == 0
    assert count(db, "select count(*) from register.filing where orgnr = %s", "919951834") == 2
    assert summary.demo_filings_written == 3
