"""Withdrawn companies and the run record (Story 2.4).

A plain run asks the register's unit endpoint about each stored orgnr the
bulk file does not hold and deletes the company only on 410 Gone; any other
answer is a failure in run.step1, which every mode writes. Every request
goes through `FixtureTransport`, which fails the test on a URL it was not
given, so a unit request for a company that is in the bulk file is caught.
Each test runs inside a transaction that is rolled back (conftest `db`).

The tests pass on an empty or a seeded database: `stored_to_multiple`
stores filler companies until the stored total is a multiple of 100, so the
absent share is exact whatever the database already holds.
"""

from __future__ import annotations

import contextlib
import json
import urllib.error
from datetime import UTC, datetime
from email.message import Message
from io import BytesIO
from pathlib import Path

import psycopg
import pytest

from conftest import BOUND_KR, GONE, READER_COMMIT, RULES, Answer, FixtureTransport, enhet_url, recorded, regnskap_url
from document_fakes import recorded_979607008_2025
from peerless_ingest import documents, run, write
from peerless_ingest.config import Config
from test_write import company, filings_of

READ_AT = datetime(2026, 10, 30, 9, 0, tzinfo=UTC)
COVERED = "919951834"  # 62.100 in the recorded bulk file
DEMO = "967534579"
CODES = ["62.100"]


def count(conn: psycopg.Connection, query: str, *params: object) -> int:
    row = conn.execute(query, params).fetchone()
    assert row is not None
    return int(row[0])


def stored_orgnrs(conn: psycopg.Connection) -> set[str]:
    return {row[0] for row in conn.execute("select orgnr from register.company").fetchall()}


def stored_to_multiple(conn: psycopg.Connection) -> tuple[int, list[str]]:
    """Stores filler companies (orgnrs 000000001, …: no real orgnr starts
    with 0) until the stored total T is a multiple of 100 with more than
    T/100 fillers. Returns T and the fillers."""
    existing = count(conn, "select count(*) from register.company")
    total = 100
    while total - existing < total // 100 + 1:
        total += 100
    fillers = total - existing
    conn.execute(
        """insert into register.company (orgnr, navn, read_at)
           select lpad(i::text, 9, '0'), 'FILLER AS', %s from generate_series(1, %s) i""",
        (READ_AT, fillers),
    )
    assert count(conn, "select count(*) from register.company") == total
    return total, [f"{i:09d}" for i in range(1, fillers + 1)]


def recorded_unit(orgnr: str) -> dict:
    [unit] = [u for u in json.loads(recorded("enheter_lastned.json")) if u["organisasjonsnummer"] == orgnr]
    return unit


def transport(conn: psycopg.Connection, absent: set[str], answers: dict[str, Answer] | None = None) -> FixtureTransport:
    """A bulk file holding every stored orgnr except `absent` (as bare units
    with no primary code, so nothing more is loaded), plus the covered
    company and demo company C as recorded; and the responses a clean run
    needs. `answers` adds what the unit endpoint answers per orgnr."""
    units = [recorded_unit(COVERED), recorded_unit(DEMO)]
    units += [{"organisasjonsnummer": o} for o in sorted(stored_orgnrs(conn) - absent - {COVERED, DEMO})]
    responses: dict[str, Answer] = {
        regnskap_url(COVERED): recorded("regnskap_919951834.json"),
        enhet_url(DEMO): recorded("enhet_967534579.json"),
        regnskap_url(DEMO): recorded("regnskap_967534579.json"),
    }
    responses |= {enhet_url(orgnr): answer for orgnr, answer in (answers or {}).items()}
    return FixtureTransport(responses, bulk=json.dumps(units).encode("utf-8"))


def unit_requests(t: FixtureTransport) -> list[str]:
    return [
        url
        for url in t.requested
        if "/enhetsregisteret/api/enheter/" in url and not url.endswith((DEMO, "/lastned"))
    ]


def http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://register.fixture.invalid", code, "status", Message(), BytesIO(b""))


def record(conn: psycopg.Connection, run_id: int) -> tuple:
    row = conn.execute(
        "select mode, ended_at is not null, counts, failures, deleted, error from run.step1 where id = %s", (run_id,)
    ).fetchone()
    assert row is not None
    return row


def tables_with(conn: psycopg.Connection, column: str) -> list[str]:
    """Every register table with a column of this name."""
    rows = conn.execute(
        """select format('%%I.%%I', n.nspname, c.relname)
             from pg_catalog.pg_attribute a
             join pg_catalog.pg_class c on c.oid = a.attrelid
             join pg_catalog.pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'register' and c.relkind in ('r', 'p') and a.attname = %s and not a.attisdropped
            order by 1""",
        (column,),
    ).fetchall()
    return [row[0] for row in rows]


# --- Withdrawn: 410 Gone deletes the company and everything referencing it ----


def test_gone_unit_is_deleted_everywhere(db: psycopg.Connection, cfg: Config) -> None:
    target = "979607008"
    write.write_company(db, company(target, "STATEMENT AS"))
    for filing in filings_of("regnskap_979607008.json", target):
        write.write_filing(db, filing)
    outcome = write.document_outcome(2025, documents.read_words(*recorded_979607008_2025(), BOUND_KR), {}, RULES)
    write.write_document(
        db, target, 2025, outcome, write.filing_brreg_id(db, target, 2025), READ_AT, READER_COMMIT
    )
    brreg_ids = [row[0] for row in db.execute("select brreg_id from register.filing where orgnr = %s", (target,))]
    _, fillers = stored_to_multiple(db)

    by_orgnr = tables_with(db, "orgnr")
    by_brreg_id = tables_with(db, "brreg_id")
    # The loop covers every table the cascade must reach, and each holds a
    # row of the target before the run.
    assert {"register.company", "register.filing", "register.document", "register.document_column"} <= set(by_orgnr)
    assert {"register.key_figures", "register.document"} <= set(by_brreg_id)
    for table in by_orgnr:
        if table != "register.key_figures":
            assert count(db, f"select count(*) from {table} where orgnr = %s", target) > 0, table
    assert count(db, "select count(*) from register.key_figures where brreg_id = any(%s)", brreg_ids) == 3
    assert count(db, "select count(*) from register.document where brreg_id = any(%s)", brreg_ids) == 1

    run_id = write.start_run(db, "plain", READ_AT)
    t = transport(db, {target}, {target: GONE})
    summary = run.run(db, t, cfg, CODES, now=lambda: READ_AT, run_id=run_id)

    assert summary.withdrawal.deleted == [target]
    assert summary.withdrawal.failures == []
    assert unit_requests(t) == [enhet_url(target)]
    for table in by_orgnr:
        assert count(db, f"select count(*) from {table} where orgnr = %s", target) == 0, table
    for table in by_brreg_id:
        assert count(db, f"select count(*) from {table} where brreg_id = any(%s)", brreg_ids) == 0, table
    # Nothing else was deleted.
    assert count(db, "select count(*) from register.company where orgnr = any(%s)", fillers) == len(fillers)
    # The deleting transaction appended the orgnr to the run record.
    assert record(db, run_id)[4] == [target]
    assert f"  deleted (410 Gone), with every row referencing it: {target}" in summary.lines()
    assert not summary.needs_operator()


# --- Any other answer deletes nothing and is a failure ------------------------


def test_absent_unit_404_deletes_nothing(db: psycopg.Connection, cfg: Config) -> None:
    _, fillers = stored_to_multiple(db)
    target = fillers[0]
    summary = run.run(db, transport(db, {target}, {target: None}), cfg, CODES, now=lambda: READ_AT)

    assert count(db, "select count(*) from register.company where orgnr = %s", target) == 1
    assert summary.withdrawal.deleted == []
    assert summary.withdrawal.failures == [write.Failure(target, "withdrawal", "unit_not_found")]
    assert summary.needs_operator()


@pytest.mark.parametrize(
    ("answer", "error_class"),
    [(http_error(503), "HTTPError"), (TimeoutError("timed out"), "TimeoutError"), (b"<html>", "JSONDecodeError")],
    ids=["503-after-retries", "timeout", "not-json"],
)
def test_unit_fetch_error_deletes_nothing(db: psycopg.Connection, cfg: Config, answer: Answer, error_class: str) -> None:
    _, fillers = stored_to_multiple(db)
    target = fillers[0]
    summary = run.run(db, transport(db, {target}, {target: answer}), cfg, CODES, now=lambda: READ_AT)

    assert count(db, "select count(*) from register.company where orgnr = %s", target) == 1
    assert summary.withdrawal.deleted == []
    [failure] = summary.withdrawal.failures
    assert (failure.orgnr, failure.stage) == (target, "withdrawal")
    assert failure.reason.startswith(f"{error_class}: ")
    assert summary.needs_operator()


def test_live_unit_absent_from_bulk_is_kept(db: psycopg.Connection, cfg: Config) -> None:
    _, fillers = stored_to_multiple(db)
    target = fillers[0]
    live = recorded("enhet_967534579.json")
    summary = run.run(db, transport(db, {target}, {target: live}), cfg, CODES, now=lambda: READ_AT)

    assert count(db, "select count(*) from register.company where orgnr = %s", target) == 1
    assert summary.withdrawal.failures == [write.Failure(target, "withdrawal", "absent_from_bulk_but_live")]


def test_stored_units_in_bulk_are_not_asked_about(db: psycopg.Connection, cfg: Config) -> None:
    # FixtureTransport fails on any unit request it was not given: with no
    # absent orgnr, the run makes none.
    stored_to_multiple(db)
    t = transport(db, set())
    summary = run.run(db, t, cfg, CODES, now=lambda: READ_AT)

    assert unit_requests(t) == []
    assert (summary.withdrawal.absent, summary.withdrawal.checked, summary.withdrawal.failures) == (0, 0, [])
    assert not summary.needs_operator()


# --- D5: a truncated bulk file checks and deletes nothing ---------------------


def test_truncated_bulk_checks_and_deletes_nothing(db: psycopg.Connection, cfg: Config) -> None:
    total, fillers = stored_to_multiple(db)
    absent = fillers[: total // 100 + 1]  # one more than 1 %
    # GONE for every one of them: a request would delete it.
    t = transport(db, set(absent), dict.fromkeys(absent, GONE))
    summary = run.run(db, t, cfg, CODES, now=lambda: READ_AT)

    assert unit_requests(t) == []
    assert count(db, "select count(*) from register.company where orgnr = any(%s)", absent) == len(absent)
    [failure] = summary.withdrawal.failures
    assert (failure.orgnr, failure.stage) == (None, "withdrawal")
    assert failure.reason.startswith(f"bulk_absent_share_exceeded: {len(absent)} of {total} stored companies absent")
    assert "limit 1.00 %" in failure.reason
    assert summary.withdrawal.deleted == []
    assert summary.needs_operator()  # main exits 1


def test_absent_share_at_limit_is_checked(db: psycopg.Connection, cfg: Config) -> None:
    total, fillers = stored_to_multiple(db)
    absent = fillers[: total // 100]  # exactly 1 %: not above the limit
    t = transport(db, set(absent), dict.fromkeys(absent, None))
    summary = run.run(db, t, cfg, CODES, now=lambda: READ_AT)

    assert sorted(unit_requests(t)) == sorted(enhet_url(o) for o in absent)
    assert summary.withdrawal.checked == len(absent)
    assert [f.reason for f in summary.withdrawal.failures] == ["unit_not_found"] * len(absent)


# --- The run record, through main, in every mode -------------------------------


def patch_main(monkeypatch: pytest.MonkeyPatch, db: psycopg.Connection, cfg: Config, t: FixtureTransport) -> None:
    monkeypatch.setattr(run.fetch, "UrllibTransport", lambda *args: t)
    monkeypatch.setattr(run.write, "connect", lambda url: contextlib.nullcontext(db))
    monkeypatch.setattr(run.config_module, "load_config", lambda path: cfg)
    monkeypatch.setattr(run.config_module, "load_coverage", lambda path: CODES)
    monkeypatch.setenv("INGEST_DATABASE_URL", "postgresql://unused")
    monkeypatch.setenv(run.READER_COMMIT_ENV, READER_COMMIT)


def last_run_id(conn: psycopg.Connection) -> int:
    return count(conn, "select coalesce(max(id), 0) from run.step1")


@pytest.mark.parametrize("mode", ["plain", "companies_only", "documents", "reread"])
def test_every_mode_writes_one_record(
    db: psycopg.Connection, cfg: Config, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    stored_to_multiple(db)
    # Companies-only mode updates every stored company in the bulk file:
    # give it only the two recorded units, so it updates two (the rest are
    # "not found in bulk file", which that mode reports and never deletes).
    t = transport(db, stored_orgnrs(db) if mode == "companies_only" else set())
    patch_main(monkeypatch, db, cfg, t)
    empty = tmp_path / "list.json"
    empty.write_text("[]", encoding="utf-8")
    argv = {"plain": [], "companies_only": ["--companies-only"], "documents": ["--documents", str(empty)], "reread": ["--reread", str(empty)]}[mode]
    before = last_run_id(db)

    assert run.main(argv) == 0

    assert count(db, "select count(*) from run.step1 where id > %s", before) == 1
    recorded_mode, ended, counts, failures, deleted, error = record(db, last_run_id(db))
    assert (recorded_mode, ended, failures, deleted, error) == (mode, True, [], [], None)
    assert counts != {}


def test_record_lists_every_failure(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    total, fillers = stored_to_multiple(db)
    absent = fillers[: total // 100 + 1]
    patch_main(monkeypatch, db, cfg, transport(db, set(absent)))

    assert run.main([]) == 1  # D5: a truncated bulk file needs a person

    _, ended, counts, failures, deleted, error = record(db, last_run_id(db))
    assert ended and deleted == [] and error is None
    [failure] = failures
    assert failure["orgnr"] is None and failure["stage"] == "withdrawal"
    assert failure["reason"].startswith("bulk_absent_share_exceeded")
    assert (counts["stored"], counts["absent_from_bulk"], counts["unit_checked"]) == (total, len(absent), 0)


def test_crash_still_ends_record(db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    # A bulk download cut off mid-array: the run raises before any company
    # is loaded or any unit asked about. The record is ended with the error,
    # and the exception still reaches the caller.
    t = FixtureTransport({}, bulk=b'[{"organisasjonsnummer": "9199')
    patch_main(monkeypatch, db, cfg, t)
    before = last_run_id(db)

    with pytest.raises(Exception) as raised:
        run.main([])

    assert count(db, "select count(*) from run.step1 where id > %s", before) == 1
    mode, ended, _, failures, deleted, error = record(db, last_run_id(db))
    assert (mode, ended, failures, deleted) == ("plain", True, [], [])
    assert error == f"{raised.value.__class__.__name__}: {raised.value}"
