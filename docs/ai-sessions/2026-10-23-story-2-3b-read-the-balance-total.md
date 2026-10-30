# Story 2.3b: Read the balance total ("SUM EGENKAPITAL OG GJELD")

**Date:** 2026-10-23, review 2026-10-25, acceptance run 2026-10-25 to 2026-10-29
**Tool:** Claude Code (Opus 5.5), implementation subagent of the BMAD build session
**Story / issue:** Story 2.3b (FR-28, NFR25), issue #38
**Result:** branch `story/2.3b-read-the-balance-total`, PR [#40](https://github.com/IBE160-2026/G97-meinich/pull/40), opened and merged 2026-10-30. Commits listed below.

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

The session resumed after the PC restarted mid-verification (2026-10-23, 16:17). Meinich's first three tasks: check that the database still held the migration and all 2 044 documents (it did: 2 044 documents, 427 companies, 4 086 columns); copy `.local/document-tables-before-2.3b-migration.sql` to `peerless-backups` (done, sha256 equal); correct the backfill to `901a78d` (above, `9d2fcf9`). Before the acceptance run Meinich also had `.local/document-run-e09a413-reader-commit/` copied there (sha256 of both files equal), as it is the restore source after `pnpm seed`.

Verification in batches: lint, typecheck, `pnpm test`, `pnpm test:db`, `pnpm test:ingest` green except `seed-format.test.ts` and `test/db/seed.test.ts`, which fail on the manifest's migration id until the seed is exported; `pnpm analysis:sm2` changes only the date. The seed round trip was not run: it deletes the 2.1b rows.

Four review layers (subagents of this session: blind, edge case, verification gap, acceptance auditor) ran on the diff since `dcff3ab`, without the three files in `analysis/output/ocr-sm2-before-2.3b/`, which are byte-identical (sha256) to `main`'s. Triage in the spec's Review Triage Log: 3 decisions, 8 patches, 1 deferred, the rest rejected with the evidence there. Each finding is credited to its layer in `docs/ai-log.md` (Story 2.3b).

- **Decisions (Meinich):** D1, the seed is exported only in the acceptance run, with no push before it. D2, a re-read that turns a reconciled column into `failed_reconciliation` is not replaced, and a figure lost from a column still reconciled is replaced but listed per document, with its number in the PR (spec change log). D3, the report's "After" stays until the acceptance run regenerates it.
- **Fixes:** `fb47a46` (D2, its two tests and the docs; B15 with it) and `2ce5a50` (the eight patches). Each new test was run with its guard removed and fails.
- **Rejected:** 15, each with its refutation or reason in the triage log. Among them: the backfill labelling other databases' rows (only the local database has rows from that date, all the reference run's), squash merges orphaning `reader_commit` (PRs merge with merge commits; both commits are on `main`), and three findings whose fix would edit the spec under review.

## Acceptance run (2026-10-25 to 2026-10-29)

Run by this session on Meinich's instructions, with no push before it was done (D1). Reader version `2ce5a503d44bf6ab379cc3383fcefe1cc2734389`, the last commit touching `ingest/`; the image was built from `42b1c02`, and for the restart in step 4 from `0e9a4eb`, with the same `ingest/` tree.

1. **Dump and backup.** Both document tables in full, in the README's CSV form, to `.local/document-tables-before-2.3b-reread/`, copied to `peerless-backups` (sha256 equal). The rows not on the allow-list were checked equal, sorted, to the restore source `.local/document-run-e09a413-reader-commit/`.
2. **The reference set.** The first `--reread analysis/ocr-reference/document-run.json` got HTTP 503 on every fetch: the accounts register was down (`.local/reread-reference-2.3b-503.log`); it replaced nothing, as designed. The rerun replaced 97, not replaced 0, no reconciled column failing, 0 lost figures. Then, with Meinich's approval for this step only, the 2.1b rows were deleted in a checked transaction (3 892 columns, 1 947 documents), `pnpm seed:export` ran, `pnpm seed` loaded twice and the re-export was unchanged, and the 2.1b rows were restored and checked byte-identical (1 947 at `e09a413` + 97 at `2ce5a50`, 4 086 columns, 0 NULL): `5444765`.
3. **`consistency.py`** in the step-1 image: `47c7b81`.
4. **`--reread seed/document-run.json`**, 407 companies. The machine slept mid-run and the run hung after it woke (Known problem, below); it was stopped at 1 414 of 1 947 documents and restarted, and the restart re-read the remaining 533 (`.local/reread-2.1b-2.3b-container.log`, `.local/reread-2.1b-2.3b-resume.log`). Every document now has `reader_commit` `2ce5a50` (2 044).
5. **`pnpm analysis:document-run after-2.3b` and the report:** `2d41750`.
6. **The second dump**, the 2.1b rows after the re-read, in the README's CSV form: `.local/document-run-2ce5a50/` (1 947 documents, 3 892 columns), copied to `peerless-backups` (sha256 equal: `document.csv` `b7489f93…`, `document_column.csv` `1da6c7fe…`). It is the restore source after `pnpm seed` from now on; the older dumps are kept.
7. **Not replaced and lost figures (D2).** Not replaced: 0, in both runs. Documents replaced with a figure lost from a column reconciled before and after: 0. The restart's summary gives 0 for its 533; the first run's summary was lost when it hung, so its 1 414 were checked from the two dumps: across the 3 892 columns of the 2.1b run, no column reconciled before is not reconciled after, and no column reconciled before and after has a figure before that is NULL after (script in the session's scratchpad, not committed). The reference set's 97 are in step 2's summary.

**Result.** Sum egenkapital og gjeld read in the 2.1b run: 1 930 of 1 946 current columns (was 1 110) and 1 894 of 1 946 prior (was 1 094); reconciled current columns 1 801 → 1 834. On the reference set, 96 of 97 current and 93 of 97 prior (was 49 and 47); in the spike's filings, shown read in 178 of 178 columns (was 102). Misread and phantom figures reaching the engine on the reference set: 0 → 0.

**One new misread, and a transcription corrected.** The first regenerated report listed one new misread reaching the engine: 915648479/2021, last-year column, salgsinntekt, transcribed 3 659 013, read 3 657 114. The review session pointed out the cell; Meinich checked the PDF and found OCR right (salgsinntekt 3 657 114, annen driftsinntekt 1 899). The transcription was corrected and logged as not blind (`77b51c9`). That broke two things, fixed in `2ac2cdb`: the report counted every correction as found by the blind check (it now counts only the cells `blind-check-key.csv` marks as suspected: 6 blind, 1 later), and `blind-check-draw.ts` no longer reproduced its key, because it compared against the current seed; it now compares against Story 2.3's stored columns in `analysis/output/ocr-sm2-before-2.3b/`, and writes the key byte-identical.

**Memory.** Claude Code stopped several of this session's background shells because the machine was low on memory. The containers they started ran on, and their output was saved from `docker logs`; the restarted re-read in step 4 was launched as a separate Windows process.

**Verification after the run:** `check:pins`, `check:env`, lint, typecheck, `pnpm test` (814), `pnpm test:db` (136), `pnpm test:ingest` (218), build, `check:routes`, `pnpm test:e2e` (116), all green. The seed round trip was not run again: `pnpm seed` deletes the 2.1b rows, and it ran in step 2 against the same seed; `seed/`, `supabase/` and `ingest/` have not changed since `5444765`.

**Merge.** CI on `fc6f559` was green, including the seed round trip that was not run locally on the final tree. Before merging, the review session checked the run against the database (every document on `2ce5a50`, the status and before/after counts, the dump's row counts and backup checksums). The review was posted as a GitHub review with six line comments, drafted by the review session and posted at the human's decision. The PR was merged at 07:15 UTC as `1dd628e`. The review session then set the spec and the story to done on `main`.

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
- `42b1c02` the review record (this file, the AI log, the triage log's resolution, status)
- `5444765` the seed with `reader_commit`, the reference set re-read
- `77b51c9` the reference set: 915648479/2021 salgsinntekt (2020) corrected
- `2ac2cdb` the SM-2 report counts the blind check's corrections apart from a later one
- `0e9a4eb` the fetch that hung after sleep, deferred
- `47c7b81` the spike's consistency after the re-read
- `2d41750` the SM-2 report after the acceptance re-read
- `4bf8a3a` the acceptance-run record (this file, the AI log)
- the PR link (this file)
