# Story 1.3b: the seed path — export, load and CI

**Date:** 2026-10-11
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #4, Story 1.3b
**Result:** branch `story/1.3b-seed-export-load`. `a5e6088` (migration, `.gitattributes`, export and loader scripts, and the committed demo seed exported from the 1.3a database), `d1e79bb` (tests, two loader fixes, CI), then the docs commit. Not pushed: the human reviews the branch first.

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

## Links

- AI log: "2026-10-11 — Story 1.3b: the seed loader truncates every register table, and how its writes and refusals can go wrong".
- Updated: README ("Seed"), `AGENTS.md` (CI list, the `loader` grant and table-set rule), technical note AD-16, sprint status.
