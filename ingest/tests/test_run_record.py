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
import dataclasses
import json
import urllib.error
from datetime import UTC, date, datetime
from email.message import Message
from fractions import Fraction
from io import BytesIO
from pathlib import Path

import psycopg
import pytest

from conftest import BOUND_KR, GONE, READER_COMMIT, RULES, Answer, FixtureTransport, enhet_url, kopi_url, recorded, regnskap_url
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
    assert not summary.needs_operator()  # Q6: a 404 is recorded, the run does not exit 1


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
    assert not summary.needs_operator()  # Q6: recorded, but no exit 1


def unit_with_slettedato(value: object) -> bytes:
    unit = json.loads(recorded("enhet_967534579.json"))
    unit["slettedato"] = value
    return json.dumps(unit).encode("utf-8")


def slettedato_of(conn: psycopg.Connection, orgnr: str) -> object:
    row = conn.execute("select slettedato from register.company where orgnr = %s", (orgnr,)).fetchone()
    assert row is not None
    return row[0]


# --- Q4a: 200 with slettedato is dissolved: stored, kept, not a failure --------


def test_dissolved_unit_is_stored_not_a_failure(db: psycopg.Connection, cfg: Config) -> None:
    _, fillers = stored_to_multiple(db)
    target = fillers[0]
    summary = run.run(
        db, transport(db, {target}, {target: unit_with_slettedato("2026-09-01")}), cfg, CODES, now=lambda: READ_AT
    )

    assert slettedato_of(db, target) == date(2026, 9, 1)
    assert count(db, "select count(*) from register.company where orgnr = %s", target) == 1
    assert summary.withdrawal.dissolved == [target]
    assert summary.withdrawal.failures == [] and summary.withdrawal.deleted == []
    assert summary.record_counts()["dissolved"] == 1
    assert not summary.needs_operator()


@pytest.mark.parametrize("value", ["01.09.2026", "2026-13-01", "", None, 20260901])
def test_malformed_slettedato_is_a_failure(db: psycopg.Connection, cfg: Config, value: object) -> None:
    _, fillers = stored_to_multiple(db)
    target = fillers[0]
    summary = run.run(db, transport(db, {target}, {target: unit_with_slettedato(value)}), cfg, CODES, now=lambda: READ_AT)

    assert slettedato_of(db, target) is None
    assert summary.withdrawal.dissolved == []
    assert summary.withdrawal.failures == [write.Failure(target, "withdrawal", f"malformed_slettedato: {value!r}")]
    assert summary.needs_operator()  # the lookup did not complete


def test_stored_slettedato_is_neither_counted_nor_asked(db: psycopg.Connection, cfg: Config) -> None:
    # Q5a: one more than 1 % absent, but one of them is already stored as
    # dissolved: the share is exactly 1 %, so the check runs, and the
    # dissolved one is not looked up again.
    total, fillers = stored_to_multiple(db)
    absent = fillers[: total // 100 + 1]
    dissolved, rest = absent[0], absent[1:]
    db.execute("update register.company set slettedato = '2026-01-15' where orgnr = %s", (dissolved,))
    t = transport(db, set(absent), dict.fromkeys(rest, None))
    summary = run.run(db, t, cfg, CODES, now=lambda: READ_AT)

    assert enhet_url(dissolved) not in t.requested
    assert sorted(unit_requests(t)) == sorted(enhet_url(o) for o in rest)
    assert (summary.withdrawal.absent, summary.withdrawal.absent_already_dissolved) == (len(rest), 1)
    assert not any(f.reason.startswith("bulk_absent_share_exceeded") for f in summary.withdrawal.failures)
    assert slettedato_of(db, dissolved) == date(2026, 1, 15)


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


def stages_of(conn: psycopg.Connection) -> list[str]:
    failures = record(conn, last_run_id(conn))[3]
    return [failure["stage"] for failure in failures]


def test_crash_keeps_failures_recorded_before_it(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The first absent orgnr answers 404 (a failure), the second's lookup
    # raises an error no run catches: the record keeps the 404 and the
    # counts collected before the exception.
    _, fillers = stored_to_multiple(db)
    first, second = fillers[0], fillers[1]
    patch_main(monkeypatch, db, cfg, transport(db, {first, second}, {first: None, second: RuntimeError("boom")}))

    with pytest.raises(RuntimeError, match="boom"):
        run.main([])

    _, ended, counts, failures, _, error = record(db, last_run_id(db))
    assert ended and error == "RuntimeError: boom"
    assert failures == [{"orgnr": first, "stage": "withdrawal", "reason": "unit_not_found"}]
    assert (counts["absent_from_bulk"], counts["unit_checked"]) == (2, 2)


def test_crash_after_a_delete_keeps_it_recorded(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The first absent orgnr answers 410 and is deleted; the second's lookup
    # raises. The deletion stays committed and recorded, and the record is
    # ended with the error.
    _, fillers = stored_to_multiple(db)
    first, second = fillers[0], fillers[1]
    patch_main(monkeypatch, db, cfg, transport(db, {first, second}, {first: GONE, second: RuntimeError("boom")}))

    with pytest.raises(RuntimeError):
        run.main([])

    _, ended, counts, _, deleted, error = record(db, last_run_id(db))
    assert (ended, deleted, error) == (True, [first], "RuntimeError: boom")
    assert counts["deleted"] == 1
    assert count(db, "select count(*) from register.company where orgnr = %s", first) == 0


# --- Q6: which withdrawal answers make main exit 1 ----------------------------


@pytest.mark.parametrize(
    ("answer", "exit_code"),
    [
        (GONE, 0),
        (None, 0),
        (b"live", 0),
        (b"dissolved", 0),
        (TimeoutError("timed out"), 1),
        (http_error(503), 1),
        (b"<html>", 1),
        (b"malformed", 1),
    ],
    ids=["410", "404", "live", "dissolved", "timeout", "503", "not-json", "malformed-slettedato"],
)
def test_exit_code_follows_whether_the_check_finished(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch, answer: Answer, exit_code: int
) -> None:
    bodies: dict[object, Answer] = {
        b"live": recorded("enhet_967534579.json"),
        b"dissolved": unit_with_slettedato("2026-09-01"),
        b"malformed": unit_with_slettedato("01.09.2026"),
    }
    _, fillers = stored_to_multiple(db)
    target = fillers[0]
    given = bodies.get(answer, answer) if isinstance(answer, bytes) else answer
    patch_main(monkeypatch, db, cfg, transport(db, {target}, {target: given}))

    assert run.main([]) == exit_code


def test_withdrawn_demo_company_is_a_failure_not_a_crash(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Demo company C answering 410 at step 3: the run goes on to the
    # withdrawal check, and the record names the cause once.
    _, fillers = stored_to_multiple(db)
    target = fillers[0]
    t = transport(db, {target}, {target: GONE})
    t.responses[enhet_url(DEMO)] = GONE  # type: ignore[index]
    summary = run.run(db, t, cfg, CODES, now=lambda: READ_AT)

    assert not summary.demo_found
    assert summary.withdrawal.deleted == [target]  # the check still ran
    demo = [f for f in summary.record_failures() if f.stage == "demo_company_c"]
    assert demo == [write.Failure(DEMO, "demo_company_c", "demo company C: withdrawn (410 Gone)")]
    assert summary.needs_operator()


# --- The failure stages in the record, per mode --------------------------------


def test_plain_record_names_load_demo_and_withdrawal(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, fillers = stored_to_multiple(db)
    target = fillers[0]
    t = transport(db, {target}, {target: None})
    t.responses[regnskap_url(COVERED)] = b"<html>"  # type: ignore[index]
    t.responses[enhet_url(DEMO)] = None  # type: ignore[index]
    patch_main(monkeypatch, db, cfg, t)

    assert run.main([]) == 1
    assert sorted(stages_of(db)) == ["demo_company_c", "load", "withdrawal"]


@pytest.mark.parametrize("mode", ["--documents", "--reread"])
def test_document_modes_record_refused(
    db: psycopg.Connection, cfg: Config, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    patch_main(monkeypatch, db, cfg, FixtureTransport({}))
    listed = tmp_path / "list.json"
    listed.write_text('["999999999"]', encoding="utf-8")  # not a stored company

    assert run.main([mode, str(listed)]) == 1
    assert stages_of(db) == ["refused"]


def test_reread_records_not_replaced(
    db: psycopg.Connection, cfg: Config, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A stored document read by another version whose re-fetch fails is not
    # replaced, and the record names it.
    orgnr = "979607008"
    write.write_company(db, company(orgnr, "STATEMENT AS"))
    write.write_document(db, orgnr, 2025, write.OCR_FAILED, None, READ_AT, "e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d")
    patch_main(monkeypatch, db, cfg, FixtureTransport({kopi_url(orgnr, 2025): None}))
    monkeypatch.setattr(run.config_module, "load_coverage", lambda path: ["69.202"])
    listed = tmp_path / "list.json"
    listed.write_text(f'["{orgnr}"]', encoding="utf-8")

    assert run.main(["--reread", str(listed)]) == 1
    assert stages_of(db) == ["not_replaced"]


def test_companies_only_records_search_fields(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    write.write_company(db, company(COVERED, "OLD NAME AS"))

    def refuse(*_args: object) -> bool:
        raise psycopg.errors.DataError("refused")

    monkeypatch.setattr(run.write, "update_company_search_fields", refuse)
    patch_main(monkeypatch, db, cfg, transport(db, stored_orgnrs(db) - {COVERED}))

    assert run.main(["--companies-only"]) == 1
    assert set(stages_of(db)) == {"search_fields"}


# --- A delete that fails, a 410 with no row, a delete without its record --------


def test_delete_error_is_a_failure_and_the_check_goes_on(
    db: psycopg.Connection, cfg: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, fillers = stored_to_multiple(db)
    first, second = fillers[0], fillers[1]
    real_delete = write.delete_company

    def delete(conn: psycopg.Connection, orgnr: str, run_id: int | None) -> bool:
        if orgnr == first:
            raise psycopg.errors.ForeignKeyViolation("still referenced")
        return real_delete(conn, orgnr, run_id)

    monkeypatch.setattr(run.write, "delete_company", delete)
    patch_main(monkeypatch, db, cfg, transport(db, {first, second}, {first: GONE, second: GONE}))

    assert run.main([]) == 1  # a failed delete leaves the check incomplete

    _, _, _, failures, deleted, _ = record(db, last_run_id(db))
    assert deleted == [second]
    assert [(f["orgnr"], f["reason"]) for f in failures] == [(first, "delete_failed: ForeignKeyViolation: still referenced")]
    assert count(db, "select count(*) from register.company where orgnr = %s", first) == 1


def test_lost_connection_on_delete_ends_the_run(cfg: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    class Closed:
        closed = True

    def delete(*_args: object) -> bool:
        raise psycopg.OperationalError("connection lost")

    monkeypatch.setattr(run.write, "delete_company", delete)
    summary = run.WithdrawalSummary()
    t = FixtureTransport({enhet_url("000000001"): GONE})
    with pytest.raises(run.ConnectionLost):
        run._check_withdrawn(
            Closed(),  # type: ignore[arg-type]
            t,
            dataclasses.replace(cfg, max_absent_share=Fraction(1)),
            {"000000001": None},
            set(),
            summary,
            None,
            lambda _message: None,
        )
    assert summary.incomplete
    assert summary.failures[0].reason.startswith("delete_failed: OperationalError")


def test_gone_with_no_row_is_a_failure(db: psycopg.Connection, cfg: Config) -> None:
    # Stored when the run started, gone by the time the 410 came: nothing to
    # delete, recorded, and the check finished.
    summary = run.WithdrawalSummary()
    t = FixtureTransport({enhet_url("000000001"): GONE})
    run._check_withdrawn(
        db, t, dataclasses.replace(cfg, max_absent_share=Fraction(1)), {"000000001": None}, set(), summary, None,
        lambda _message: None,
    )
    assert summary.failures == [write.Failure("000000001", "withdrawal", "gone_but_no_row_to_delete")]
    assert summary.deleted == [] and not summary.incomplete


def test_delete_without_its_record_is_rolled_back(db: psycopg.Connection) -> None:
    write.write_company(db, company("000000001", "WITHDRAWN AS"))
    missing_run = last_run_id(db) + 1000
    with pytest.raises(ValueError, match="no row to record"):
        write.delete_company(db, "000000001", missing_run)
    assert count(db, "select count(*) from register.company where orgnr = '000000001'") == 1
