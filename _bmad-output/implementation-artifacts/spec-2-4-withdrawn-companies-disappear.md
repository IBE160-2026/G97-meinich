---
title: 'Story 2.4: Withdrawn companies disappear'
type: 'feature'
created: '2026-10-30'
status: 'in-progress'
baseline_commit: 'e5ad7467226ba5e68884cede54a7178b929f72d3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/data-sources-brreg.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Step 1 treats `410 Gone` like `404` and never deletes, so a company the register has withdrawn keeps its rows. It stays in peer groups, aggregates and the seed, which the register's terms forbid (`docs/data-sources-brreg.md`, "Withdrawn entities must be dropped"). Step 1 also leaves no durable record of a run, so its failures exist only in terminal output.

**Approach:**
- A plain `pnpm ingest` asks Enhetsregisteret about every stored orgnr that is absent from the bulk file. It deletes the company on `410 Gone`, and every `register` row that references it cascades with it.
- Any other answer deletes nothing and becomes a failure in a new step-1 run-record table. Every step-1 mode writes one record per run.
- `seed:export` leaves a deleted orgnr out of every file it writes, `seed/allow-list.json` included.

## Boundaries & Constraints

**Always:**
- Only an explicit HTTP `410` on `GET /enhetsregisteret/api/enheter/{orgnr}` deletes. The company is deleted, never flagged (FR-66, AD-2).
- Deletion is one `DELETE FROM register.company WHERE orgnr = %s` per orgnr, in its own transaction. Cascades remove the rest.
- `ingest` gets DELETE on `register.company` only. `reader`, `derive` and `loader` get no DELETE anywhere.
- The run record is written by `ingest` only, and it is inserted when the run starts. It is updated when the run ends, including when the run ends in an exception (its class and message go into the record, and the exception is re-raised). It holds: mode, start, end, counts per outcome, every failure (orgnr, stage, reason) and every deleted orgnr.
- The deletion check runs in the plain mode only. `--companies-only`, `--documents` and `--reread` still delete nothing, but each writes a record.
- An allow-list entry whose orgnr is not in `register.company` is dropped by the write-back, and the export names it on stderr. A drawn orgnr (`analysis/ocr-reference/drawn.json`) that is not a stored company makes `seed:export` refuse, naming it (D6).
- If more than 1 % of the stored companies are absent from the bulk file, the run makes no unit request and deletes nothing. It writes a failure to the run record and exits 1 (D5).

**Never:**
- Delete on 404, 5xx, a timeout, a parse error, absence from the bulk file alone, or from the `regnskap`/`kopi` endpoints.
- Flag instead of delete. Delete in `--companies-only`. Add DELETE grants on any table other than the company table.
- Let the run record enter the seed. Grant `loader` or `derive` a write on it.
- Change `src/engine`, the reconciliation logic, or what the existing callers of `fetch_filings`/`fetch_kopi`/`fetch_aar` return on a 410.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if the guard is deleted |
|---|---|---|---|
| Withdrawn | stored orgnr absent from bulk; unit endpoint 410 | company and all referencing rows gone; record lists it under `deleted` | `test_run_record.py::test_gone_unit_is_deleted_everywhere` (loops every `register` table that has `orgnr` or `brreg_id`) |
| 404 | absent from bulk; 404 | nothing deleted; failure `unit_not_found` | `::test_absent_unit_404_deletes_nothing` |
| 5xx / timeout | absent; 503 after retries, or `TimeoutError` | nothing deleted; failure with the exception class | `::test_unit_fetch_error_deletes_nothing` (parametrised) |
| Live | absent from bulk; 200 | nothing deleted; failure `absent_from_bulk_but_live` | `::test_live_unit_absent_from_bulk_is_kept` |
| In bulk | stored and in bulk | no unit request | `FixtureTransport` raises on an unexpected URL |
| Crash | an exception mid-run | record has `ended_at` and the error; exception re-raised | `::test_crash_still_ends_record` |
| Transport | `urlopen` → HTTPError 410 vs 404 | `get` raises `Gone` vs returns None; `fetch_filings` and the document fetchers still return `[]`/None on 410 | `test_fetch.py::test_gone_is_distinct_from_not_found`, `::test_gone_filings_still_empty` |
| Truncated bulk | 2 of 100 stored orgnrs absent (> 1 %) | no unit request, nothing deleted; failure `bulk_absent_share_exceeded` with count and share; exit 1 | `test_run_record.py::test_truncated_bulk_checks_and_deletes_nothing`; `::test_absent_share_at_limit_is_checked` (1 of 100) |
| Drawn orgnr withdrawn | a `drawn.json` orgnr missing from `register.company` | `seed:export` exits non-zero, naming it, and writes nothing | `test/seed-export.test.ts` (or the existing export test file) `refuses a drawn orgnr that is not a stored company` |
| Run grants | every relation in schema `run` | ingest writes; derive and loader have no write; reader has no access | `test/db/run-grants.test.ts` (loops `pg_class` in `run`) |

## Decisions (Meinich, 2026-10-30)

- **D1, the run record lives in a new schema `run`** (`run.step1`), outside `register`. It is not seeded or loaded, and Story 2.6 adds `run.step2`.
  - Its own grants test loops over every relation in `run`, as `grants.test.ts` does for `register`: `ingest` may write; `derive` and `loader` have no write; `reader` has no access, since nothing needs it yet.
  - `AGENTS.md` and AD-2/AD-3 in the technical note name the schema in the same PR.
- **D2, a live `pnpm ingest` on the local database is part of acceptance, after review.**
  - Before it: dump the document tables to `.local/`, copy the dump to `peerless-backups`, and check the sha256 matches. A 410 cascade also deletes 2.1b document rows, which exist only locally.
  - Announce the run before it starts, with an estimate of how long it takes.
  - The PR lists every deleted orgnr, how many document rows went with it, and whether it was among the 407 of the 2.1b set or in the OCR reference set.
  - After it: take a new dump. It replaces `.local/document-run-2ce5a50/` as the restore source, because the old dump has rows for deleted orgnrs and would fail on the foreign key. The old dump is kept, not deleted. README "Seed" says which dump to restore.
  - The seed export after the run is its own commit, so the refreshed key figures are not mixed with code.
- **D3, the spec is kept whole** at about 2,300 tokens; splitting would separate the deletion from its record and grants.
- **D4, no `pnpm seed`, no seed export and no deletion of 2.1b rows outside the acceptance run.** The local database holds 2.1b rows for 407 companies that are not on the allow-list, so `seed:export` refuses and `pnpm seed` would truncate them.
  - As in 2.3b, the migration is applied with `supabase migration up`, and the seed is exported only in step e of the live run.
  - `pnpm seed`, or anything that deletes 2.1b rows, needs Meinich's yes first.
  - After any such step, always restore from the newest dump and confirm the row counts against the dump's counts.
- **D5, a guard against a truncated bulk file.** If more than 1 % of the stored companies are absent from the bulk file, no unit request is made and nothing is deleted. The run writes a failure to the run record and exits 1. The limit is one value in `ingest/config.toml`, and it has a test.
- **D6, a withdrawn reference orgnr stops the work.** If a deleted orgnr is in `drawn.json`, stop before `seed:export` and ask Meinich. The SM-2 report and its byte-identity test then change.

</frozen-after-approval>

## Code Map

- **`ingest/src/peerless_ingest/fetch.py`**
  - `UrllibTransport.get` (70–90) folds 404 and 410 into None. Add `class Gone(Exception)` and raise it on 410; 404 stays None.
  - `fetch_unit` (126) lets `Gone` propagate. `fetch_filings` (137) and the kopi/aar fetchers (148, 162) catch `Gone` and return as on 404.
  - Update the `Transport` docstring (42).
- **`ingest/src/peerless_ingest/run.py`**
  - `run` (710–760): read `SELECT orgnr FROM register.company` before streaming, and mark the stored orgnrs seen in the *whole* bulk file, not only the covered selection.
  - After step 3, check the absent share first (D5): if `len(absent) / len(stored)` exceeds `[withdrawal] max_absent_share = 0.01` in `ingest/config.toml` (read via `config.py`), write the failure and skip the check, and `needs_operator()` makes `main` exit 1.
  - Otherwise, for each stored orgnr not seen, call `fetch_unit` and handle the answer: Gone → `write.delete_company`; None → failure; `FETCH_ERRORS` → failure; 200 → failure "live".
  - Every mode's entry point (`main`, ~998) wraps the run in `write.start_run`/`write.end_run`.
  - Fix the comments that say "step 1 never deletes" (56, 344, 906) and the `CompaniesOnlySummary.not_found` comment.
- **`ingest/src/peerless_ingest/write.py`**: line 3 ("no DELETE") changes. Add `delete_company`, `start_run(mode) -> id` and `end_run(id, counts, failures, deleted, error)`. The counts come from each Summary.
- **New migration `supabase/migrations/20261030120000_withdrawn_companies.sql`**
  - Re-add `filing.orgnr → company` and `key_figures.brreg_id → filing` with ON DELETE CASCADE, keeping ON UPDATE CASCADE (step1_tables.sql:41, :80). `document` and `document_column` already cascade. `document.brreg_id` stays NO ACTION; it is checked at the end of the statement, after the cascade removes the document.
  - `GRANT DELETE ON register.company TO ingest`. The cascades run as the table owner.
  - `CREATE SCHEMA run` (D1), with no default privileges for reader. Create `run.step1`: identity id, `mode` with a CHECK, `started_at`, `ended_at`, `counts jsonb`, `failures jsonb`, `deleted text[]`, `error text`. Grant SELECT, INSERT and UPDATE (plus sequence USAGE) to `ingest` and nothing to anyone else.
- **Tests**
  - `ingest/tests/test_write.py:209` and `test_documents_write.py:210` now assert that ingest may delete from `company` but not from any other register table.
  - `conftest.FixtureTransport` gains a `GONE` sentinel answer.
  - `test/db/grants.test.ts`: the `STEP1_TABLES` exact ACL (340–376) adds ingest DELETE for `company` only; extend 379–393.
  - New `test/db/run-grants.test.ts` (D1): loops `pg_class` in schema `run` and asserts per relation that ingest has SELECT/INSERT/UPDATE, derive and loader have no write, and reader has no privilege; also no USAGE on schema `run` for reader.
- **`scripts/seed-export.ts`** (148–151) and **`seed-format.ts`** `withReferenceOrgnrs` (512–534)
  - Drop allow-list entries that are not in `register.company`, printing each one.
  - Refuse (non-zero exit, nothing written) when a drawn orgnr is not in `register.company` (D6).
  - `test/allow-list.test.ts:45-52` stays "all 20 drawn". The refusal guarantees it.
- **Peer/aggregate AC**
  - `test/db/peers.test.ts` gets a new case: in a rolled-back transaction, delete a demo subject's peer and assert it is absent from `loadCandidates`/`assemblePeerGroup`, and that `parse` with it in `ekskl` sets `invalidSettings`.
  - The DB tests' connection role must be able to delete. Use the role that test file already uses for setup, or `SET ROLE ingest`.
- Reuse `conftest` `db`, `enhet_url` and `cfg`, and `test_fetch.py`'s `http_error`.

## Tasks & Acceptance

**Execution:**
- [ ] `fetch.py` + `test_fetch.py` -- Gone vs None -- the transport must tell 410 from 404 first
- [ ] Migration + `write.py` + `test_write.py`/`test_documents_write.py` + both grants tests. Apply it locally with `pnpm exec supabase migration up` only: no reset, no `pnpm seed`, no export (D4). CI's seed check stays red on the migration id until step e below.
- [ ] `run.py` deletion check and run record in every mode + `ingest/tests/test_run_record.py` (the matrix)
- [ ] `seed-export.ts`/`seed-format.ts` + the export refusal test; `test/db/peers.test.ts` case
- [ ] After review, the live run (D2):
  - a. Dump the document tables to `.local/`, copy the dump to `peerless-backups`, check the sha256, and record the row counts.
  - b. Announce the run with an estimate, then run `pnpm ingest`.
  - c. Write the deleted-orgnr table into the PR: document rows cascaded, and 2.1b set or reference set. If any orgnr is in `drawn.json`, stop and ask (D6).
  - d. Take a new dump, and point README "Seed" at it.
  - e. Run `pnpm seed:export` the way 2.3b did it, and commit the seed on its own. Run `pnpm seed` only with Meinich's yes; then restore from the newest dump and confirm the row counts (D4).
- [ ] Docs:
  - `AGENTS.md`: step 1's one deletion, schema `run` and the run record, and "`--companies-only` … deleting nothing";
  - `technical-note-architecture.md` AD-2/AD-3: the record's schema;
  - `data-sources-brreg.md`: 410 handled;
  - `ai-log.md`: what could go wrong with an automated delete;
  - `deferred-work.md`, the session file, `sprint-status.yaml`.

**Acceptance Criteria:**
- Given the migrations, when the grants test runs, then `ingest` alone may delete from `register.company`, and `reader`, `derive` and `loader` may delete nowhere and have no write on the run record.
- Given any step-1 run in any mode, when it ends normally or in an exception, then exactly one record exists for it, with `ended_at` set and every failure listed.
- Given a company deleted after a 410, when `pnpm seed:export` runs, then the orgnr is in no seed file, in no `document_figure_orgnrs` and not in `seed/allow-list.json`.
- Given the PR, then it states what could go wrong with an automated delete, and `docs/ai-log.md` records it with the tests that back it.

## Implementation Notes

- Run modes in `run.step1.mode`: `plain`, `companies_only`, `documents`, `reread`. Failures are `{orgnr, stage, reason}`; the D5 failure has `orgnr` null and reason `bulk_absent_share_exceeded: {n} of {total} …`.
- Each deleted orgnr is appended to `run.step1.deleted` by `write.delete_company` in the deleting transaction, not by `end_run`, so a crash after a delete keeps it.
- Withdrawal failures live in `Summary.withdrawal`, apart from `Summary.failed`; every one of them makes `main` exit 1.
- `test/db/peers.test.ts` reads `CANDIDATES_SQL` (with `toCandidate`, now exported) inside the deleting transaction as the migration role: `postgres` cannot `SET ROLE ingest` locally, and `loadCandidates`'s reader connection cannot see an uncommitted delete.
- The export tests for D6 and the dropped allow-list entry are in `test/db/seed.test.ts`; they need a seed exported at the new migration id (step e) to run in `pnpm test:db`.

## Spec Change Log

## Review Triage Log

## Design Notes

**Why only stored orgnrs absent from the bulk file are checked.** The bulk file holds every live unit, so a unit in it cannot be withdrawn. Checking every stored orgnr would cost thousands of requests per run. A unit absent from the bulk file is either withdrawn (410), unknown (404), or live but missing from the bulk file through a register error. Only the first deletes.

**What could go wrong (for the PR and the AI log):**
- A truncated bulk download makes thousands of companies "absent". D5 stops the check above 1 %. Below that, each one still needs its own 410.
- A proxy or test double that answers 410 wrongly would delete. That is why the fixture's 410 is explicit and `Gone` is raised only from the urllib `HTTPError.code == 410`.
- A cascade can remove a local 2.1b document row that is not in any dump. That is why the dump comes before the live run (D2).

## Verification

**Commands:**
- `pnpm test:ingest` -- expected: all pass, the new matrix tests included
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: all pass
- `pnpm test:db` -- expected: all pass against the local database after `supabase migration up`. The local database is never reseeded (D4).
- After step e: CI is green, including seed load twice and the export unchanged.
