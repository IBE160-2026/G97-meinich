# Story 2.1b: storing the filed accounts (OCR ingest)

**Date:** 2026-10-20
**Tool:** Claude Code (Opus 5.5): an orchestrating session and an implementation subagent working from the frozen spec
**Story / issue:** #32, Story 2.1b
**Result:** branch `story/2.1b-ocr-ingest`, not yet pushed or reviewed: commits `c1a33fe`, `cdc2704`, `3a295ee`, `889e5f0`, `e1c87d0`, `f72c206`, `4f1c37c` and the docs commit. PR: to be linked. Acceptance run: not started (after review, fixes and the full suite, on the image built from the final commit).

## Goal

Implement `_bmad-output/implementation-artifacts/spec-2-1b-ocr-ingest.md`: step 1 fetches every filed 2021–2025 document of each covered company, reads it with the Story 2.1a library and stores one row per document and per figure column, as filed, in øre; one migration with grants, the seed decision and re-export, the contract test against the database, `--documents <file>` and the committed acceptance set, and the "Kilder og lisens" copy.

## Prompts that mattered

To the implementation subagent, from the orchestrating session:

> Read C:\Dev\ibe160\_bmad-output\implementation-artifacts\spec-2-1b-ocr-ingest.md fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start.

## What came back, and what was done with it

Commits:
- `c1a33fe` migration `20261020120000_register_document_tables.sql` (`register.document`, `register.document_column`, grants), both tables in `SEED_TABLES`, `unlistedDocumentFigures` and the manifest's `document_figure_orgnrs` reading `document_column`, the export's refusal of unlisted document figures, the seed re-exported (new tables empty, every other file unchanged), `test/db/documents.test.ts` and the table lists in the TS tests.
- `cdc2704` `OcrError` names the failed page and Tesseract's first stderr line.
- `3a295ee` the document pass in `run.py`, `fetch_document_years`/`fetch_document`, `write_document`/`to_ore`/`document_outcome`, documents mode, `test_documents_write.py` and `test_documents_run.py` (every matrix row).
- `889e5f0` the "Kilder og lisens" paragraph names the filed annual accounts.
- `e1c87d0` `pnpm ingest --documents <file>` (mounted read-only), `pnpm ingest:document-set` and the committed `seed/document-run.json` (407 orgnrs).
- `f72c206` the `Accept` header fix and the AGENTS.md stack line.
- Docs: technical note (AD-15's tables and `extracted`; every year 2021–2025, not every other year), `docs/data-sources-brreg.md` (the documents step and the 406), README ("Batch step 1", "Seed"), `docs/ai-log.md`, `deferred-work.md` (three 2.1b entries and the 1.3b allow-list entry closed; the full 62.100 run and the refiling limit added), `epic-2-context.md`, the spec's Implementation Notes, `sprint-status.yaml` (story at `review`).

Choices made by the subagent, open to the human (all in the spec's Implementation Notes):
- **Demo company C is not in the acceptance set**, although the spec's Decisions name it: it is uncovered, has no peer group, and documents mode refuses it.
- **The export writes the allow-list back as it read it** instead of `[]`, because refusing unlisted figures while erasing the list would contradict itself.
- **`layout` is NULL for a Tesseract failure** (`refusal = 'ocr_error'`), and a PDF PyMuPDF cannot open is a failure that is not stored, so the next run retries it.
- **The acceptance set runs through Vite's module runner**, since plain Node cannot load `src/` (JSON imports, `server-only`).

Corrected during the session, caught by the subagent:
- **406 from the register.** A one-company run (`pnpm ingest --documents` with 813235552) failed every document: the endpoint refuses `Accept: application/pdf`. Fixed to `application/octet-stream`, pinned by `test_fetch.py::test_document_is_requested_as_octet_stream`. The rerun stored all five documents as `extracted` in 132 s, and 2023–2025's sum driftsinntekter equals the API to the øre. The database was restored with `pnpm seed`.
- **A NULL-blind CHECK.** The first draft of the status/layout/refusal CHECK compared nullable columns with `=`; a NULL makes a CHECK pass, so `status = 'paper'` with a NULL layout would have been accepted. Rewritten with `coalesce` before the tests ran; `test/db/documents.test.ts` covers the NULL cases.
- **A hang in `pnpm ingest:document-set`.** The computation module imported the CLI module back, which was still in its top-level await; the import never settled. The computation now returns the pools and imports nothing from the CLI.
- **A trailing newline passed the orgnr and year checks.** `^…$` with `re.match` accepts `"979607008\n"`; the `--documents` list and the `/aar` years now use `fullmatch` (`4f1c37c`), with a test case each that fails under the old pattern.
- Each matrix guard was deleted in turn and its named test run; all failed (listed in `docs/ai-log.md`). The export's allow-list refusal was checked the same way against `test/db/seed.test.ts`.

## Verification

- `pnpm test:ingest` against the seeded database: 165 passed, none skipped.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`: pass.
- `pnpm seed && pnpm seed && pnpm seed:export`: `seed/` unchanged.
- `pnpm build && pnpm check:routes && pnpm test:e2e`: build passes, routes unchanged, 116 e2e tests pass.
- `docker build` of the step-1 image via `pnpm ingest`: a bad `--documents` file exits 2 inside the container; the one-company run above.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-1b-ocr-ingest.md` (Implementation Notes)
- AI log: "2026-10-20 — Story 2.1b: storing the filed accounts, and what could go wrong with them"
