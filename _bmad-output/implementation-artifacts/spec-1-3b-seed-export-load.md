---
title: 'Story 1.3b: The seed path — export, load and CI'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: '78abdd94656040d2b8ad731366465fcdfa411734'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The register data from the Story 1.3a run exists only in one local database. A fresh clone and CI have no way to reach the same data without calling the register, and nothing writes `register.covered_industry`.

**Approach:**
- `pnpm seed:export` writes the step-1 tables deterministically to committed seed files, with a manifest and `seed/allow-list.json`.
- `pnpm seed` validates everything, then truncates and replaces every `register` table in one transaction as `loader`.
- CI migrates a fresh database and loads the committed seed on every PR.
- Story ACs: GitHub issue #4 and `epics.md` Story 1.3b (authoritative; `epics.md` wins on conflict).

**Decisions (human, 2026-10-11):**
- Branch `story/1.3b-seed-export-load` from `main` at `78abdd9`.
- **Seed encoding:** plain CSV, one file per table, in `seed/demo/{company,filing,key_figures}.csv` with `seed/demo/manifest.json`. It is about 8.4 MB, and readable and diffable in a PR.
- **Spec length:** kept whole, about 2,600 tokens. Export, loader and CI are tested together.
- **Collation-free order:** the export sorts with `ORDER BY … COLLATE "C"` on every text sort column, so the row order, and with it the checksums, never depends on the database's collation.
- **A later migration invalidates the seed:** the PR that adds a migration re-exports the seed in that same PR. The steps are `supabase migration up` on a loaded database, then `pnpm seed:export`. The README "Seed" section and AD-16 say so.
- **Recovery from an empty local database, without a new ingest:** documented in the README and AD-16.
  - If the seed matches the latest migration, `pnpm seed` restores the data.
  - If a new migration is already in the tree, run the old loader on the old schema: a `git worktree` at the last commit whose seed matched (with `.env` copied), `pnpm install`, `pnpm db:reset`, `pnpm db:roles`, `pnpm seed`. Then, back in the main tree, `pnpm exec supabase migration up` and `pnpm seed:export`.
- **Never run `pnpm db:reset`, or a loader test that writes outside a rolled-back transaction, before the export has run and the seed files are committed.** The 1.3a data exists only in the local database (17 557 companies, 22 354 filings).

## Boundaries & Constraints

**Always:**
- Copy values with `COPY … TO/FROM STDOUT/STDIN (FORMAT csv, HEADER)` and never parse an amount in JS. Export with `TimeZone = UTC` and `DateStyle = ISO, YMD`, so `read_at` and the dates round-trip byte for byte (AD-18).
- The export connects as `reader` (`READER_DATABASE_URL`) and the loader as `loader` (`LOADER_DATABASE_URL`). Neither runs DDL.
- The loader checks everything before it opens a connection: manifest version, migration id, the file list and checksums, the shape of `coverage.json`, declared codes against fetched codes, and `measured` reports. Then it writes in one transaction. Any failure gives a non-zero exit, a message naming the entry and the check, and leaves the database as it was.
- Seed files are written with LF line endings and UTF-8, rows sorted by primary key with `COLLATE "C"` on text columns. `.gitattributes` marks `seed/**` and `analysis/output/**` `-text`, so `core.autocrlf` never changes a checksummed byte.
- The demo seed holds all of 62.100 plus demo company C, as the technical note specifies.

**Never:**
- The export never writes `seed/coverage.json`.
- No batch step writes `register.covered_industry` or `register.dataset`.
- No `seed:full` (Story 5.7), no run-record print (Story 2.6), no licence gate (Story 2.5), no explanation checks at load (Epic 4).
- The literal `62.100` appears in no application code. Seed data files and fixtures are not application code.
- No new npm dependency: hand-written validation, `node:crypto` for SHA-256, postgres.js for COPY.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error handling |
|---|---|---|---|
| round trip | load the committed seed, then export inside the same transaction | the export is byte-identical to the committed files, including `read_at` | — |
| idempotent | `pnpm seed` twice | the same table digests, the same `register.dataset` row | — |
| version / migration | manifest `format_version` ≠ 1, or `migration_id` ≠ the latest file in `supabase/migrations` | refused, nothing loaded | names the field |
| unlisted / checksum | an extra file in `seed/demo/`, or one byte changed | refused, nothing loaded | names the file |
| bad shape | an unknown key, a non-boolean `measured`, `report` present while `measured` is false, a code not `^\d{2}\.\d{3}$`, a duplicate code | refused | names the entry |
| declared not fetched | coverage declares `62.010`, which is not among the manifest's `fetched_codes` | refused | names the code |
| measured: true ×3 | no `report`/`sha256`; a report file that is missing; a checksum mismatch | each refused, database unchanged | names the entry and the check |
| measured: true ok | `analysis/output/x.md` exists and its SHA-256 matches | loaded; `covered_industry` row has `measured`, `report` and `sha256` | — |
| collation | the export query for each table; the exported `filing.csv` | every text/char sort column carries `COLLATE "C"` (unit test on the ORDER BY builder), and the PK order of the exported rows equals a byte-order sort of those keys (DB test) | — |
| allow-list | a fixture `filing.csv` with status ≠ `not_extracted` for an orgnr not on the list | the allow-list test fails; the committed seed passes | — |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261011120000_register_step1_tables.sql` -- the three step-1 tables. Do not change it; the new grants go in the new migration.
- `test/db/grants.test.ts:358-425` -- the `the step-1 tables` block asserts the exact ACL and that `loader` has nothing. Update it to the loader grants.
- `test/db/db-env.ts` -- `setting()`, `supabaseDbUrl()`. Reuse it in the DB tests.
- `scripts/run-ingest.ts` -- the style for scripts: header comment, a `setting(root, name)` that reads env then `.env`, exported pure functions, and `main` guarded by `pathToFileURL`. Scripts run with `node file.ts` (type stripping; `erasableSyntaxOnly`).
- `ingest/src/peerless_ingest/config.py` -- step 1's own reading of `coverage.json`. Leave it alone; the loader's TS schema check is separate (AC).
- `.github/workflows/ci.yml` -- `pnpm db:start`, then `db:roles`, then `test:db`. The seed steps go after `test:db`.
- `supabase_migrations.schema_migrations` -- readable by neither `reader` nor `loader` (checked 2026-10-11). The migration id is therefore the latest file name in `supabase/migrations`, both at export and at load.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/<ts>_register_seed_manifest.sql`:
  - `register.dataset`: `id smallint PK DEFAULT 1 CHECK (id = 1)`, `dataset text CHECK IN ('demo','full')`, `format_version int`, `migration_id text`, `manifest jsonb`, all NOT NULL.
  - `register.covered_industry`: `code text PK CHECK (~ '^\d{2}\.\d{3}$')`, `measured boolean NOT NULL`, `report text`, `sha256 char(64)`, with a CHECK that `report` and `sha256` are non-null exactly when `measured`.
  - `loader` gets SELECT, INSERT and TRUNCATE on all five `register` tables. `ingest` and `derive` get nothing on the two new tables.
- [x] `scripts/seed-format.ts` -- the pure core, no DB:
  - `SEED_VERSION = 1`, `SEED_TABLES` (company, filing, key_figures in FK order with their PK sort columns), `LOADER_TABLES` (dataset, covered_industry).
  - Types, `sha256`, `latestMigrationId(root)`, `validateCoverage(json)`, `checkMeasured(root, entries)`, `checkManifest(root, manifest, dir)`, `unlistedDocumentFigures(files, allowList)`.
- [x] `scripts/seed-export.ts` -- `exportSeed(sql, root)`:
  - COPY each `SEED_TABLES` entry with its catalog column list (by `attnum`) and `ORDER BY` its PK into `seed/demo/`.
  - `fetched_codes` = the codes in `coverage.json` that have at least one company with that `naeringskode1` in the database. Demo C's code is never included.
  - `document_figure_orgnrs` = the orgnrs with a filing whose `status` ≠ `not_extracted`.
  - `read_at` = min and max over `company` and `filing`.
  - Write `manifest.json` with sorted keys, 2-space indent and a final LF, then `seed/allow-list.json` (`[]`).
- [x] `scripts/seed-load.ts` -- validate, then `loadSeed(tx, root)`:
  - Assert that the `register` tables in the catalog are exactly `SEED_TABLES` ∪ `LOADER_TABLES`.
  - One `TRUNCATE` over all of them, then COPY with the header as the column list in FK order.
  - Insert the `covered_industry` rows and the `dataset` row.
  - The CLI wraps all of this in `sql.begin`.
- [x] `package.json` -- `seed:export` and `seed` scripts.
- [x] `.gitattributes` -- `seed/** -text`, `analysis/output/** -text`.
- [x] `test/seed-format.test.ts` -- every validation row in the matrix, the allow-list check against fixtures, and that the export's file list never includes `coverage.json`. Fixtures go in `test/fixtures/seed/`.
- [x] `test/allow-list.test.ts` -- the committed seed against `seed/allow-list.json`.
- [x] `test/db/seed.test.ts` -- as `loader`, always rolled back:
  - the round trip and the idempotence digests;
  - each refusal leaves the table digests unchanged;
  - a `covered_industry` row from the committed coverage;
  - the table-set assertion.
- [x] `test/db/grants.test.ts` -- the new tables' ACLs, the loader grants on every `register` table (loop), and none for `ingest`/`derive` on the two new tables.
- [x] `.github/workflows/ci.yml` -- after `test:db`, add `pnpm seed`, then `pnpm seed` again.
- [x] Run `pnpm seed:export` against the 1.3a database and commit `seed/demo/*` and `seed/allow-list.json`, before any loader write outside a rolled-back test.
- [x] Docs:
  - README "Seed" section: load, export, re-export in the same PR as any new migration, and recovery from an empty local database;
  - `AGENTS.md` CI list;
  - technical note AD-16 (format, directory, collation-free order, migration-id source, `fetched_codes` rule, re-export with each migration, recovery);
  - `docs/ai-log.md` (what could go wrong with the loader's writes and refusals);
  - `docs/ai-sessions/` file;
  - sprint-status.

**Acceptance Criteria:**
- Given the committed seed and a freshly migrated database with `db:roles` run, when `pnpm seed` runs twice, then `register` holds 17 557 companies, 22 354 filings, one `covered_industry` row (`62.100`, false) and one `dataset` row (`demo`).
- Given `pnpm seed:export` run twice on the same database, then the files are byte-identical.

## Design Notes

- **Document figures:** there is no document-figure table yet. "A document figure" is therefore a `filing` row whose `status` is not `not_extracted`. Story 2.3 extends `unlistedDocumentFigures` when its tables arrive.
- **SELECT for `loader`:** granted so the round-trip test can export inside the loader's own uncommitted transaction. It adds no exposure, because `reader` already reads every table.
- **Future tables:** the loader truncates exactly the tables in the catalog. A future table that is not added to `SEED_TABLES`/`LOADER_TABLES`, or not granted to `loader`, makes `pnpm seed` and the grants loop fail loudly instead of keeping stale rows.

## Implementation Notes

- Commits `a5e6088` (migration, scripts, the demo seed exported from the 1.3a database, committed before any loader write outside a rolled-back test), `d1e79bb` (tests, loader fixes, CI), `89e2dae` (fixtures moved out of the gitignored `coverage/` name), `82bd968` (docs). The new migration went in with `supabase migration up`. `pnpm db:reset` ran only after the seed was committed.
- Migration id = the latest migration file name without `.sql` (`20261011130000_register_seed_manifest`).
- **CI order:** the two `pnpm seed` steps run after "Step 1 tests", which come after `test:db`. The step-1 tests assume empty register tables, and two of them fail against a loaded database.
- **postgres.js 3.4.9 COPY faults, worked around:**
  - (a) Reading `COPY TO` with `for await` sometimes hung the next query. The export now reads in flowing mode.
  - (b) A `COPY FROM` that the server rejects at the end of the statement (a foreign-key error) hung instead of failing. The loader wraps the query's internal `reject`. This relies on the pinned version's internals; re-check it on any upgrade. The `23503` rollback test covers it.
- `loadSeed(tx, plan)` takes a plan already checked by `prepareSeed(paths)`, so the loader writes exactly the bytes it checked. `SeedPaths.reportRoot` lets the tests use fixture reports. `.gitattributes` also marks `test/fixtures/seed/** -text`.
- Verified by the orchestrator: `check:pins`, `check:env`, lint, typecheck, `pnpm test` (114), `pnpm test:db` (57); `pnpm seed` gives 17 557 / 22 354 / 22 354 / 1 / 1; `pnpm seed:export` afterwards leaves `seed/` unchanged; `seed/demo/*` has `text: unset`.

## Spec Change Log

## Review Triage Log

Pass 1 (blind hunter BH, edge-case hunter EC, verification gap VG). The diff left out `seed/demo/*.csv`: exported data, covered by checksums and the round-trip test.

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | BH/EC: the loader takes its COPY column list from the CSV header, so `HEADER MATCH` cannot fail. An export from an un-migrated database is stamped with the newest migration id and loads, with NULLs in the new columns | medium | `headerColumns` feeds `copyIn`; `latestMigrationId` reads files, not the database. Nothing compares the header with the catalog | patch: the header must equal the catalog columns in `attnum` order |
| 2 | EC/BH: `fetched_codes` (manifest, no checksum) is trusted by the FR-59 check; a hand-edited manifest offers an industry with no companies | medium | `checkDeclaredFetched` reads only `manifest.fetched_codes` | patch: inside the load, refuse a declared code with no `company` row of that `naeringskode1` |
| 3 | EC: export succeeds when a declared code was not fetched, writing a seed the loader refuses | low | `exportSeed` never calls `checkDeclaredFetched` | patch: refuse at export |
| 4 | EC: `report` with backslashes (`analysis/output/..\..\x`) escapes `analysis/output` on Windows | low | `path.posix.normalize` keeps `\`; `path.join` on win32 treats it as a separator | patch: refuse `\` |
| 5 | EC/BH: `copyIn` wraps `query.reject` without checking it exists | low | after an upgrade a TypeError would hide the database error | patch: `typeof` guard with a clear message |
| 6 | BH: the table-set check and the loader-grants loop include views, matviews and foreign tables, which cannot be truncated | low | `relkind in ('r','p','v','m','f')` in `registerTables` and the grants loop | patch: tables only (`'r','p'`) |
| 7 | BH/VG: the 8 DB refusal tests throw in `prepareSeed` before `loadSeed`, so "digests unchanged" cannot fail; `main`'s refusal path (exit 1, message) is untested | medium | `loadSeed(tx, prepareSeed(paths))` | patch: test `main` refusing (exit 1, stderr names the entry, nothing loaded) |
| 8 | VG: removing ORDER BY from the export breaks no test; the round trip loads already-sorted rows | medium | demonstrated by the reviewer's analysis; heap order equals key order after a sorted COPY | patch: load rows out of key order, export, assert key order |
| 9 | VG: nothing checks the `.gitattributes` `-text` rule; CI on Linux is blind to it | medium | no `check-attr` in tests | patch: unit test with `git check-attr text` |
| 10 | BH: CI never runs `seed:export` as `reader` | low | only the round trip exports, as `loader` | patch: CI `pnpm seed:export && git diff --exit-code seed/` after the second load |
| 11 | BH: no test that demo company C is in the seed | low | only the count implies it | patch: assert C's orgnr and 3 filings; every other company is in a declared code |
| 12 | BH: README recovery leaves the worktree behind | low | no `git worktree remove` | patch (README) |
| 13 | BH: session file omits `89e2dae` and the docs commit hash | low | docs | patch (orchestrator) |
| 14 | EC/BH: export overwrites `seed/allow-list.json` with `[]`, erasing entries once Story 2.3 adds them, and never checks document figures against it | medium | hard-coded `'[]\n'`; harmless while there are no document figures | defer (Story 2.3 decides where entries come from) |
| 15 | VG: `checkPrimaryKey` never fails in a test | low | reviewer's filed disposition | defer |
| 16 | BH: AGENTS.md and AD-16 name two `-text` paths; `.gitattributes` has three | low | the fix edits an agent-context file | defer |
| 17 | EC: a failed write midway leaves `seed/demo` half-written | low | the loader then refuses it on checksum, and git restores it; rare | reject |
| 18 | EC: a foreign key from another schema into `register` makes TRUNCATE fail | false | it fails loudly (0A000) and rolls back; no such key exists | reject |
| 19 | BH: no row counts in the manifest | low | the manifest fields are fixed by epics.md; a suggestion, not a defect | reject |
| 20 | BH: CI-order deviation only recorded in Implementation Notes | low | the fix is a spec edit; the steps still run after `test:db` | reject |
| 21 | BH: `db:roles` in the worktree would mint new passwords | false | `scripts/set-role-passwords.ts:12`: an existing password in `.env` is never overwritten | reject |
| 22 | BH: `analysis/output/` might be gitignored | false | `git check-ignore analysis/output/x.md` exits 1; the directory holds committed files | reject |

## Verification

**Commands:**
- `pnpm check:pins && pnpm check:env && pnpm lint && pnpm typecheck && pnpm test` -- expected: pass.
- `pnpm exec supabase migration up` -- applies the new migration to the local database without a reset, so the 1.3a data stays.
- `pnpm test:db` -- expected: pass. Run it only after the seed is committed.
- `pnpm seed:export && git status --porcelain seed/` -- expected: empty on a second run.
