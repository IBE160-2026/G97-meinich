# Story 2.4: withdrawn companies disappear

**Date:** 2026-10-30
**Tool:** Claude Code (implementation subagent, Opus 5.5)
**Story / issue:** Story 2.4 (FR-66), branch `story/2.4-withdrawn-410`; issue and PR to be linked
**Result:** commits `7755b2d`, `5248a74`, `697a058`, `5e79258`, `15d17c7`, `783eb6a`, and the docs commit

## Goal

Implement `_bmad-output/implementation-artifacts/spec-2-4-withdrawn-companies-disappear.md`: step 1 deletes a stored company the register answers `410 Gone` for, with every row referencing it, records every run in a new schema `run`, and keeps a withdrawn orgnr out of the seed and the allow-list. The live run (D2) and the seed re-export (step e) come after review and are not part of this session.

## Prompts that mattered

- "Read … spec-2-4-withdrawn-companies-disappear.md fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. Commit in small logical steps on the current branch as you go … Do not push."

## What came back, and what was done with it

- **Accepted (built as the spec's code map says):**
  - `fetch.Gone`, raised only on an explicit HTTP 410; 404 stays `None`; the key-figures and document fetchers answer a 410 as before.
  - Migration `20261030120000_withdrawn_companies.sql`: `filing` and `key_figures` cascade on delete, `ingest` gets DELETE on `register.company` only, schema `run` with `run.step1`. Applied with `pnpm exec supabase migration up` only (D4); row counts before and after: company 17 557, document 2 044, document_column 4 086, unchanged.
  - `write.delete_company` (one transaction per orgnr, appending to the run record in the same transaction), `start_run`, `end_run`; the withdrawal check in `run.run`; the record around every mode in `run.main`.
  - `[withdrawal] max_absent_share = 0.01`, read exactly as a `Fraction`.
  - `seed:export` drops an allow-list entry that is not a stored company and refuses a drawn reference orgnr that is not (D6).
  - A peers test: a peer deleted in a rolled-back transaction leaves the candidates, every band's group and `ekskl`.
- **Choices the spec left open, made here:**
  - The run record's mode values are `plain`, `companies_only`, `documents`, `reread`; failures are `{orgnr, stage, reason}`, with `orgnr` null for the D5 failure.
  - Withdrawal failures are kept apart from `Summary.failed`, so the existing run tests (`summary.failed == []`) are unchanged; `needs_operator` includes them, so any of them makes `main` exit 1, not only D5's.
  - The deleted orgnrs are appended by `delete_company` in its own transaction rather than written by `end_run`, so a crash or a kill after a delete still leaves it recorded.
  - Demo company C answering 410 at step 3 is a failure there; it is deleted by the withdrawal check if it is also absent from the bulk file.
  - The matrix tests store filler companies (`000000001`, …) until the stored total is a multiple of 100, so the 1 % boundary is exact on an empty or a seeded database.
  - The peers test reads the candidate query (`CANDIDATES_SQL`, `toCandidate`, now exported) inside the deleting transaction, since `loadCandidates`'s own reader connection cannot see an uncommitted delete; it runs as the migration role, since `postgres` cannot `SET ROLE ingest` locally.
- **Checked by removing the guard:** the D5 share check (`test_truncated_bulk_checks_and_deletes_nothing` and `test_record_lists_every_failure` fail) and the record handler in `main` (`test_crash_still_ends_record` fails).
- **Not done here:** `pnpm seed` printing the latest run record (in `epic-2-context.md`, not in the spec; deferred, since D1 gives `loader` no access to `run`); the live run and seed re-export (D2, after review); `sprint-status.yaml` stays `in-progress` until then.

## Verification

- `pnpm test:ingest`: 237 passed against the local (2.1b) database.
- `pnpm typecheck`; `eslint scripts test src`: clean.
- `pnpm test`: all pass except `test/seed-format.test.ts` "passes every check against the repository", which refuses the seed's migration id until step e re-exports it (expected by the spec).
- `pnpm test:db`: all pass except `test/db/seed.test.ts`, whose `beforeAll` refuses the same migration id. Its three export tests that matter here were run with the new migration file moved aside (the database keeps it applied) and passed.

## Links

- `docs/ai-log.md`, "2026-10-30 — Story 2.4: step 1 deletes a company on 410 Gone, and records every run"
- `_bmad-output/implementation-artifacts/deferred-work.md`: two Story 2.4 entries
