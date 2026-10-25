# Story 2.3b: Read the balance total ("SUM EGENKAPITAL OG GJELD")

**Date:** 2026-10-23
**Tool:** Claude Code (Opus 5.5), implementation subagent of the BMAD build session
**Story / issue:** Story 2.3b (FR-28, NFR25), issue #38
**Result:** branch `story/2.3b-read-the-balance-total`, not pushed; PR not opened yet. Commits listed below.

## Goal

Read the bold balance total that Tesseract returns as "50M EGENKAPITAL OG GJELD", record on every document the reader version that read it, add a re-read mode, and report before and after (`_bmad-output/implementation-artifacts/spec-2-3b-read-the-balance-total.md`).

## Prompts that mattered

The human's prompts are in `docs/ai-prompts.md`, verbatim; the review session adds them after merge. In short:

1. Implement the 2.3b spec; the spec is the sole source of truth.
2. Mid-run (from the coordinator, on the human's behalf): commit in small logical steps, do not push, do not run the long re-read, and check the 2.1b rows and the dumps under `.local/` before any `pnpm seed` or `db:reset`.

## What came back, and what was done with it

- **Implemented as specified:** `layout.fold_mixed` and its use in `extract` and `ends_balance`; the "l" cases through the existing gate; migration `20261023120000_document_reader_commit.sql`; `write.write_document(…, reader_commit)` and `stored_document_versions`; `run.run_reread` and `--reread`; `PEERLESS_READER_COMMIT` and the dirty-tree refusal in `scripts/run-ingest.ts`; `pnpm analysis:document-run`; the before inputs; the report section. Each matrix row's test was run with its guard removed and fails (`docs/ai-log.md`, Story 2.3b).
- **The probe (no write).** `read_document` with the new fold, in the step-1 image built from this branch, on Story 2.3's seven probe documents (919062223/2021, 921600070/2024, 914000076/2022, 924895772/2024, 991939490/2024, 823980892/2023, 887217912/2021): every one prints the row as "50M EGENKAPITAL OG GJELD …"; the total is now read in both columns of all seven and equals sum eiendeler; c1–c4 pass in all fourteen columns. In 914000076/2022 and 991939490/2024 the current total was printed "l4 066 151" / "l2 853 098" and came from the digits-only pass, through the gate.
- **The migration, applied locally without a reset** (`supabase migration up`), after a full data dump of both document tables (`.local/document-tables-before-2.3b-migration.sql`). The backfill check, recorded:

  ```
  select reader_commit, (read_at < '2026-10-22 00:00:00+00'), count(*) from register.document group by 1, 2;
  cfecb1e1f8d32f942034d1c0f3e69648272b7a94 | false |   97   -- corrected 2026-10-25, see below
  e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d | true  | 1947
  select count(*) from register.document where reader_commit is null;   -- 0
  ```

- **Choices the spec left open:** an OCR error on re-read is never written, even over a stored `ocr_error` row, so the next re-read retries it (counted as not replaced); a failed fetch or read is also counted as not replaced, so every document left at another version is listed with a reason; the version is passed to the container by name (`--env PEERLESS_READER_COMMIT`), like the database URL, rather than as `-e NAME=value`. The re-read fetches only stored years; it does not reconcile the current-version documents again.
- **Noted for review:** `cfecb1e`, the backfilled version of the reference rows, did not touch `ingest/`; the last `ingest/` commit before it is `901a78d`. The spec decided `cfecb1e`; it differs from the current version either way, so the re-read is unaffected.
- **Corrected (Meinich, 2026-10-25):** the reference rows' version is `901a78d`, the definition. The migration and `test/db/reader-commit-backfill.test.ts` now say `901a78d`; the migration had already run locally, so the 97 rows were updated in one transaction that refused any count but 97. Recount: 97 at `901a78d` (read from 2026-10-22), 1 947 at `e09a413` (before), 0 NULL; the backfill test passes. The pre-migration dump `.local/document-tables-before-2.3b-migration.sql` was also copied to `peerless-backups`, where it had been missing (sha256 equal to the original).

## Not done

- **The seed is not re-exported.** `pnpm seed:export` refuses while the 2.1b rows (not on the allow-list) are in the database. The README's route is to remove them and restore them from a dump; the delete was refused by the session's permission classifier, so it needs the human. The 2.1b rows, now with `reader_commit`, are dumped in the README's CSV form to `.local/document-run-e09a413-reader-commit/` (1 947 documents, 3 892 columns); the old dumps are untouched. Until the export, `test/seed-format.test.ts` ("passes every check against the repository") and `test/db/seed.test.ts` fail on the manifest's migration id.
- **The acceptance run** (spec, "After review") has not run: dump and backup, `--reread` of the reference set and `seed:export`, `consistency.py`, `--reread` of `seed/document-run.json`, `pnpm analysis:document-run after-2.3b`, the report, the second dump. "Not replaced" is therefore not yet known.

## Commits

- `0118e75` spec, epic context and sprint status
- `a07089a` the second label fold, and the "l" cases through the gate
- `11ae685` `reader_commit`, the migration, and `--reread`
- `1c657ce` `pnpm ingest` passes the reader version and refuses a dirty `ingest/`
- `b581ff9` the before inputs
- `1218b2c` the report's before-and-after section
- docs (this file, AGENTS.md, README, `data-sources-brreg.md`, `epics.md`, `deferred-work.md`, `ai-log.md`)
