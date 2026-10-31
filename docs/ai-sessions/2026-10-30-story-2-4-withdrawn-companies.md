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

## Review pass 1 fixes (same day)

Three review layers ran on the diff. They were subagents of this session: blind hunter, edge-case hunter and verification gap. Their findings are triaged in the spec's Review Triage Log. Meinich decided Q4a, Q5a and Q6 (spec change log). The commits are `058059d`, `131af9b` and the docs commit after them.

**Who found what:**
- **The review layers and this session's live check:** dissolved companies answer 200 with `slettedato`, not 410 (findings 1–3). This session confirmed it live on 930663530, 974676125 and 936651437.
- **The separate review session**, which checks this session's output:
  - the 1 % absent-share guard (D5);
  - the stop before `seed:export` when a deleted orgnr is in the reference draw (D6);
  - dumps before and after the live run, with the seed export done only in the acceptance run (D2, D4);
  - the addition to Q6 that a lookup that did not complete makes the run exit 1.

- **Q4a:** migration `20261030130000_company_slettedato.sql`, applied with `supabase migration up`. A unit that answers 200 with `slettedato` has the date stored and is counted as dissolved. A malformed `slettedato` is a failure.
- **Q5a:** the D5 share counts only absent companies without a stored `slettedato`, and those companies are not looked up again.
- **Q6:**
  - Exit 1 comes only from the D5 guard, a failed delete or write, or a lookup that did not complete.
  - 404 and a live unit are still listed in the record.
  - This replaces this session's earlier choice that every withdrawal failure exits 1. That choice was wrong, and the earlier deferred-work entry about it is replaced by the peer-pool question.
- **Patch findings fixed:**
  - Demo company C's 410 is now recorded once.
  - A crash keeps the counts and failures collected before it (`on_summary`). The demo and coverage checks are left out of an unfinished run's failures.
  - `delete_company` rolls back a delete whose run-record update matches no row.
  - New tests cover each fix, plus the failure stages in every mode, a failed delete, a lost connection, a 410 with no row and a crash after a delete.
  - AGENTS.md's description of the allow-list write-back is corrected.
  - `docs/data-sources-brreg.md` now covers dissolved companies, worded to match the read-only measurement (8 of 56 answered 410, all bankruptcy or forced-dissolution estates).
  - The epic context status line is updated.
- **Not done, and why:** the earlier AI-log entry was not edited. `docs/ai-log.md` allows only appending, so a new entry corrects it.

### Rejected and deferred findings (pass 1)

All from this session's review subagents (BH blind hunter, EC edge-case hunter, VG verification gap). The numbers refer to the spec's Review Triage Log.
- **Rejected:**
  - 9: `end_run` raising after a successful run (EC). Unlikely, and the record stays open as the migration comment accepts.
  - 10: `inf`/`nan` as the share (EC).
  - 11: a duplicate drawn orgnr (EC). False, because `drawn.json` holds each orgnr once.
  - 13: no record before `start_run` (EC). False, because those exits happen before a run starts.
  - 15 and 22: spec wording (BH). Fixed in the spec, not in code.
  - 16: D6 tests red in CI until step e (BH). Planned, and named in the PR.
  - 20: the session file lacks the PR (BH). Filled at PR time.
  - 23: weak `run.step1` CHECKs (BH).
  - 24: the allow-list prune rests on absence (BH). Would need a seed missing allow-listed companies.
  - 25: the peers test's `ekskl` part (VG).
- **Deferred:**
  - 18: a killed run leaves `ended_at` NULL (BH). The entry was added to `deferred-work.md` only at step e (`b1dc586`).
  - 14 was routed to defer but fixed anyway, in AGENTS.md.

## Live run (D2) and seed re-export (step e)

Meinich decided the live run's terms (D4: no deletion of 2.1b rows and no `pnpm seed` without a yes; restore from the newest dump and confirm the counts), gave "go a–d" and then "go e".

- **a.** Both document tables were dumped in full to `.local/document-tables-before-2.4-run/` and copied to `peerless-backups`, sha256-checked. Before: company 17 557, filing 22 354, document 2 044, document_column 4 086.
- **b.** A plain `pnpm ingest` ran as run record 229, from 08:28:57 to 11:11:01 UTC, and exited 0.
  - Claude Code stopped the attached `pnpm` process when the machine ran low on memory, at 13 000 of 17 811 companies. The container ran on. Its log and exit code were saved with `docker logs -f` and `docker wait`.
  - 56 stored companies were absent from the bulk file (0.32 %), and all were looked up. 48 were dissolved and kept with their `slettedato`, HEATEN AS 924830972 (5 documents) among them. 8 answered 410 and were deleted: the same eight estates as the measurement. There were 0 failures.
  - After: company 17 883, filing 22 522, documents and columns unchanged.
- **c.** None of the eight deleted orgnrs had a filing, a document or a column, and none was in `seed/document-run.json`, the reference draw or the allow-list.
- **d.** The rows not on the allow-list were dumped to `.local/document-run-2.4/` and copied, sha256-checked.
  - The column file is byte-identical to `2ce5a50`'s.
  - One document row differs. The register replaced the 2025 filing of 823633882 under a new id (6816046 became 7242006), and the row followed by `ON UPDATE CASCADE`. The document was read and reconciled against the old filing and now points to the new one. This is the existing refiling item in `deferred-work.md`.
  - Because of this, `2ce5a50` no longer restores, and the README names the new dump (`2196482`).
- **e.**
  - The 1 947 documents and 3 892 columns not on the allow-list were deleted in one transaction that checked both counts and the 97 + 194 left.
  - `pnpm seed:export` was committed on its own (`40295b5`). `pnpm seed` ran twice with the same counts, and a re-export changed nothing.
  - The restore from `.local/document-run-2.4/` gave 1 947 + 97 documents and 3 892 + 194 columns. A fresh dump of the restored rows equals the dump.
  - **Found at step e:** `test/db/seed.test.ts` still expected the old counts, and its header regex expected `read_at` as the last company column, which the `slettedato` migration made false. Both went unseen while the test failed in setup (`a649010`). `pnpm ingest:document-set` now computes 412 orgnrs: the 407 plus five companies that entered the demo pools with the new filings, none of whose documents has been read (`f21cdc6`).

## Verification

After step e: `pnpm typecheck` clean. `pnpm test` 816 of 816. `pnpm test:db` 147 of 147 (13 files). `pnpm test:ingest` 264 passed. `pnpm lint` reports problems only in the pre-existing `.local/wt-5.1`. The row counts still held after the test runs.

Before the live run:

- `pnpm test:ingest`: 237 passed against the local (2.1b) database.
- `pnpm typecheck`; `eslint scripts test src`: clean.
- `pnpm test`: all pass except `test/seed-format.test.ts` "passes every check against the repository", which refuses the seed's migration id until step e re-exports it (expected by the spec).
- `pnpm test:db`: all pass except `test/db/seed.test.ts`, whose `beforeAll` refuses the same migration id. Its three export tests that matter here were run with the new migration file moved aside (the database keeps it applied) and passed.

## Links

- `docs/ai-log.md`, "2026-10-30 — Story 2.4: step 1 deletes a company on 410 Gone, and records every run"
- `_bmad-output/implementation-artifacts/deferred-work.md`: two Story 2.4 entries
