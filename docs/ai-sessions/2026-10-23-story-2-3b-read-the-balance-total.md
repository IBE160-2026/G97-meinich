# Story 2.3b: Read the balance total ("SUM EGENKAPITAL OG GJELD")

**Date:** 2026-10-23, review 2026-10-25
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
- **The migration, applied locally without a reset** (`supabase migration up`), after a full data dump of both document tables (`.local/document-tables-before-2.3b-migration.sql`). The backfill check, recorded after the correction to `901a78d` below (2026-10-25; on 2026-10-23 the 97 rows showed `cfecb1e`):

  ```
  select reader_commit, (read_at < '2026-10-22 00:00:00+00'), count(*) from register.document group by 1, 2 order by 1;
  901a78dbee3081c1708f8d140b4e769e6e764abd | false |   97
  e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d | true  | 1947
  select count(*) from register.document where reader_commit is null;   -- 0
  ```

- **Choices the spec left open:** an OCR error on re-read is never written, even over a stored `ocr_error` row, so the next re-read retries it (counted as not replaced); a failed fetch or read is also counted as not replaced, so every document left at another version is listed with a reason; the version is passed to the container by name (`--env PEERLESS_READER_COMMIT`), like the database URL, rather than as `-e NAME=value`. The re-read fetches only stored years; it does not reconcile the current-version documents again.
- **Noted for review:** `cfecb1e`, the backfilled version of the reference rows, did not touch `ingest/`; the last `ingest/` commit before it is `901a78d`. The spec decided `cfecb1e`; it differs from the current version either way, so the re-read is unaffected.
- **Corrected (Meinich, 2026-10-25):** the reference rows' version is `901a78d`, the definition. The migration and `test/db/reader-commit-backfill.test.ts` now say `901a78d`; the migration had already run locally, so the 97 rows were updated in one transaction that refused any count but 97. Recount: 97 at `901a78d` (read from 2026-10-22), 1 947 at `e09a413` (before), 0 NULL; the backfill test passes. The pre-migration dump `.local/document-tables-before-2.3b-migration.sql` was also copied to `peerless-backups`, where it had been missing (sha256 equal to the original).

## Review, pass 1 (2026-10-25)

The session resumed after the PC restarted mid-verification (2026-10-23, 16:17). Meinich's first three tasks: check that the database still held the migration and all 2 044 documents (it did: 2 044 documents, 427 companies, 4 086 columns); copy `.local/document-tables-before-2.3b-migration.sql` to `peerless-backups` (done, sha256 equal); correct the backfill to `901a78d` (above, `9d2fcf9`). Before the acceptance run he also had `.local/document-run-e09a413-reader-commit/` copied there (sha256 of both files equal), as it is the restore source after `pnpm seed`.

Verification in batches: lint, typecheck, `pnpm test`, `pnpm test:db`, `pnpm test:ingest` green except `seed-format.test.ts` and `test/db/seed.test.ts`, which fail on the manifest's migration id until the seed is exported; `pnpm analysis:sm2` changes only the date. The seed round trip was not run: it deletes the 2.1b rows.

Four review layers (subagents of this session: blind, edge case, verification gap, acceptance auditor) ran on the diff since `dcff3ab`, without the three files in `analysis/output/ocr-sm2-before-2.3b/`, which are byte-identical (sha256) to `main`'s. Triage in the spec's Review Triage Log: 3 decisions, 8 patches, 1 deferred, the rest rejected with the evidence there. Each finding is credited to its layer in `docs/ai-log.md` (Story 2.3b).

- **Decisions (Meinich):** D1, the seed is exported only in the acceptance run, with no push before it. D2, a re-read that turns a reconciled column into `failed_reconciliation` is not replaced, and a figure lost from a column still reconciled is replaced but listed per document, with its number in the PR (spec change log). D3, the report's "After" stays until the acceptance run regenerates it.
- **Fixes:** `fb47a46` (D2, its two tests and the docs; B15 with it) and `2ce5a50` (the eight patches). Each new test was run with its guard removed and fails.
- **Rejected:** 15, each with its refutation or reason in the triage log. Among them: the backfill labelling other databases' rows (only the local database has rows from that date, all the reference run's), squash merges orphaning `reader_commit` (PRs merge with merge commits; both commits are on `main`), and three findings whose fix would edit the spec under review.

## Not done

- **The seed is not re-exported.** `pnpm seed:export` refuses while the 2.1b rows (not on the allow-list) are in the database. The README's route is to remove them and restore them from a dump; the delete was refused by the session's permission classifier, so it needs the human. The 2.1b rows, now with `reader_commit`, are dumped in the README's CSV form to `.local/document-run-e09a413-reader-commit/` (1 947 documents, 3 892 columns); the old dumps are untouched. Until the export, `test/seed-format.test.ts` ("passes every check against the repository") and `test/db/seed.test.ts` fail on the manifest's migration id.
- **The acceptance run** (spec, "After review") has not run: dump and backup, `--reread` of the reference set and `seed:export`, `consistency.py`, `--reread` of `seed/document-run.json`, `pnpm analysis:document-run after-2.3b`, the report, the second dump. "Not replaced" (now also a reconciled column that would fail) and the number of documents with a lost figure, which the PR states (D2), are therefore not yet known. The seed export is part of this run (D1).

## Known problem

- **A fetch hung for about two hours after the machine woke.** In step 4 of the acceptance run the machine slept mid-run; after it woke, the re-read wrote 981479076/2022 at 15:48 UTC and then waited on an open HTTPS connection, at 0 % CPU, although the fetch has a 60 s timeout. The session stopped the container and restarted the re-read, which Meinich approved afterwards; it resumed from the documents still on the old version. A per-document time limit outside the network call is proposed in `deferred-work.md`; Meinich decided (2026-10-29) not to fix it in 2.3b. The PR lists it as a known problem.

## Commits

- `0118e75` spec, epic context and sprint status
- `a07089a` the second label fold, and the "l" cases through the gate
- `11ae685` `reader_commit`, the migration, and `--reread`
- `1c657ce` `pnpm ingest` passes the reader version and refuses a dirty `ingest/`
- `b581ff9` the before inputs
- `1218b2c` the report's before-and-after section
- `0bc1376` docs (this file, AGENTS.md, README, `data-sources-brreg.md`, `epics.md`, `deferred-work.md`, `ai-log.md`)
- `9d2fcf9` the reference rows' backfilled version is `901a78d`
- `fb47a46` review decision D2: a re-read that fails a reconciled column is not replaced
- `2ce5a50` review fixes
- the review record (this file, the AI log, the triage log's resolution, status)
