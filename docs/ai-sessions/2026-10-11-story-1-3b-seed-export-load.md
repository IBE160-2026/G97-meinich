# Story 1.3b: the seed path — export, load and CI

**Date:** 2026-10-11
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #4, Story 1.3b
**Result:** branch `story/1.3b-seed-export-load`. `a5e6088` (migration, `.gitattributes`, export and loader scripts, and the committed demo seed exported from the 1.3a database), `d1e79bb` (tests, two loader fixes, CI), `89e2dae` (coverage fixtures moved out of the gitignored `coverage/` name), `82bd968` (docs), then the review fixes `e826097` (code and tests) and `6f08074` (CI and README). Not pushed: the human reviews the branch first.

## Goal

Make the Story 1.3a register data reachable from a fresh clone and from CI without calling the register: a deterministic `pnpm seed:export`, an idempotent `pnpm seed` that refuses any mismatch and writes `register.covered_industry` and `register.dataset`, and CI loading the committed seed on every pull request.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-3b-seed-export-load.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human decisions frozen in the spec: plain CSV in `seed/demo/` with a manifest; `ORDER BY … COLLATE "C"` on every text key so checksums never depend on collation; the migration id is the latest file name in `supabase/migrations`; a migration PR re-exports the seed; the recovery path through a `git worktree`; and never `pnpm db:reset` or a committed loader write before the export is committed, because the 1.3a data existed only in one local database.

## What came back, and what was done with it

- **Order of work, to protect the data:** the new migration was applied with `supabase migration up` (no reset), the export was run twice and compared byte for byte, and the seed was committed in `a5e6088` before the loader wrote anything outside a rolled-back test.
- **Accepted:**
  - All checks run before the loader connects, and the loader sends the bytes it checked, not a second read of the file.
  - The export checks the declared primary key and its text columns against the catalog, so a schema change cannot silently break the byte order.
  - `prepareSeed` takes the coverage file and a report root as paths, so the measured fixtures are tested both without a database and through a real load.
- **Corrected, and how it was caught:**
  - The export hung on the query after a `COPY … TO STDOUT` roughly one run in three. Running it repeatedly showed the hang; reading postgres.js 3.4.9 showed the socket is paused on backpressure and resumed only from `read()`. The export now reads the stream in flowing mode, and eight runs in a row completed.
  - A `COPY … FROM STDIN` rejected at statement end (a foreign-key violation) hung instead of failing. Caught by the database test that corrupts key figures after the checks; the loader wraps the query's reject so the error fails the load and the transaction rolls back.
  - The manifest was stored in `register.dataset` as a JSON string, not an object, because postgres.js serialised the string again for a `jsonb` parameter. Caught by the test comparing the stored manifest with the file; it is now sent as `text` and cast.
  - The `coverage.json` fixtures first lived in `test/fixtures/seed/coverage/`, which the repository-wide `coverage/` ignore rule hides from git, so a fresh clone and CI would have lacked them. Caught by checking `git ls-files` on the fixtures before the docs commit; they moved to `test/fixtures/seed/declarations/`.
- **Deviation from the spec's task list, flagged for review:** the spec places the two `pnpm seed` CI steps right after `test:db`. They run after the step-1 tests instead, because those tests assume empty register tables: run against the loaded database, two of them fail (checked locally before the change).
- **Verification:** `check:pins`, `check:env`, lint, typecheck, `pnpm test`; `pnpm test:db` on the 1.3a database. Then, with the seed committed, the CI sequence on a reset database: `db:reset`, `db:roles`, `test:db` (57), `test:ingest` (65), `pnpm seed` twice (17 557 companies, 22 354 filings, 22 354 key-figure rows, one `covered_industry` row, one `dataset` row), and `pnpm seed:export` leaving `seed/` unchanged, `read_at` included.

## Review

Three review subagents (blind hunter, edge-case hunter, verification gap) read the diff without the seed CSVs. They raised 22 findings: 12 were patched, 3 deferred (`deferred-work.md`), and 7 rejected, 3 of them as false. The full table is in the spec's Review Triage Log. The fixes that mattered:

- **Header check.** The loader took its COPY column list from the CSV header, so `HEADER MATCH` could never fail. A seed exported from an un-migrated database, stamped with the newest migration id, would have loaded with NULLs in the new columns. The header must now equal the catalog columns.
- **Covered codes checked against the data.** The FR-59 check trusted `fetched_codes` in the manifest, which no checksum covers. Each declared code must now have a loaded company, checked inside the transaction.
- **Tests that could not fail:**
  - Removing ORDER BY from the export broke nothing.
  - The database refusal tests never reached the database.
  - The CLI's exit code was untested.
  - Nothing checked the `.gitattributes` rule, and CI runs on Linux, where line endings are never converted.

  Each has a real test now. CI also re-exports as `reader` and fails on any byte change.
- **Smaller fixes:**
  - refuse backslashes in a report path (Windows);
  - a guard on the postgres.js internals;
  - tables only (no views) in the table-set check;
  - a test that demo company C is in the seed;
  - worktree removal in the README recovery steps.
- Verified after the fixes by the orchestrator:
  - `check:pins`, `check:env`, lint, typecheck;
  - `pnpm test` (116) and `pnpm test:db` (61);
  - `pnpm seed` twice, then `pnpm seed:export`: `seed/` unchanged.

## Links

- AI log: "2026-10-11 — Story 1.3b: the seed loader truncates every register table, and how its writes and refusals can go wrong".
- Updated: README ("Seed"), `AGENTS.md` (CI list, the `loader` grant and table-set rule), technical note AD-16, sprint status.
