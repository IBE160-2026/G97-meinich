# Story 2.1b: storing the filed accounts (OCR ingest)

**Date:** 2026-10-20 to 2026-10-21
**Tool:** Claude Code (Opus 5.5): an orchestrating session, an implementation subagent working from the frozen spec, and three review subagents (blind, edge-case, verification gap)
**Story / issue:** #32, Story 2.1b
**Result:** [PR #34](https://github.com/IBE160-2026/G97-meinich/pull/34), merged 2026-10-21, from branch `story/2.1b-ocr-ingest`: implementation `c1a33fe`, `cdc2704`, `3a295ee`, `889e5f0`, `e1c87d0`, `f72c206`, `4f1c37c`; docs `6123767`; review fixes `50b39be`; triage log and decision #21 `529f65b`; decision #10 `e09a413`; the seed dump note `9a662c1`; session file and AI log `be324ad`, `80a4108` and the run's results. Acceptance run on the image built from `e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d`: 407 of 407 companies, 1 947 documents, 1 refused (see "Acceptance run").

## Goal

Implement `_bmad-output/implementation-artifacts/spec-2-1b-ocr-ingest.md`: step 1 fetches every filed 2021–2025 document of each covered company, reads it with the Story 2.1a library and stores one row per document and per figure column, as filed, in øre; one migration with grants, the seed decision and re-export, the contract test against the database, `--documents <file>` and the committed acceptance set, and the "Kilder og lisens" copy.

## Prompts that mattered

Several of the human's prompts below carry decisions that came from the separate review session, which checks this session's output, and were then decided by the human. Each is marked where it appears.

The human, answering the spec's open questions (in Norwegian, verbatim). The limit to demo A, B and their peers instead of all 62.100 companies, and the requirement to measure seconds per document in the image first, came from the review session and were decided by the human:

> Behold spec-en hel.
> 1: A – status extracted.
> 2: A – alle år 2021–2025, som akseptansekriteriet.
> 3: Ingen av alternativene. Mål først sekunder per dokument i imaget og gi meg et anslag. Kjøringen skal kunne avgrenses til et sett orgnr, og akseptansekjøringen er demoselskapene A, B, C pluss peer-gruppene deres i standardbåndet (~500 selskaper), ikke hele 62.100. Seeden har de nye tabellene tomme til allow-listen i 2.3. Hele bransjen er en deferred-post med anslått tid.

This replaced the draft's full-industry run with a measured estimate and a limitable run. Measured in the image on 20 cached PDFs (16 logical cores): median 21.1 s, mean 22.8 s, max 38.5 s per document; two or three in parallel gave 19.1 s and 21.5 s per document, so parallelism does not help. 8 442 covered companies with filings give about 33 000 documents and about 190 h; the acceptance set about 10–12 h.

The human, approving the spec. Running the acceptance run on the final code after review, and making it resumable, came from the review session and were decided by the human:

> godkjent, med to krav:
> 1. Rekkefølge: akseptansekjøringen (~12 t) starter først etter review, rettelser og full testsuite, på imaget bygget fra siste commit – ikke før, som i 1.3a. Oppgi commit-hash for imaget i PR og session-fil.
> 2. Kjøringen skal kunne avbrytes og startes på nytt uten å gjøre om lagrede dokumenter. Test det, og si fra før du starter den, så jeg kan holde maskinen våken.

To the implementation subagent, from the orchestrating session:

> Read C:\Dev\ibe160\_bmad-output\implementation-artifacts\spec-2-1b-ocr-ingest.md fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start.

The human, deciding the two review findings raised with them. The argument for overruling #10 came from the review session; the decision is the human's:

> 1. Godta A og B uten C (C er udekket og bruker ikke dokumenttall). Skriv det i Spec Change Log.
> 2. Ikke godta. Jeg besluttet at dokumentlesing skal kunne avgrenses, ikke at vanlig pnpm ingest skal lese dokumenter. pnpm ingest gjør register- og API-kjøringen som før; dokumenter leses bare med --documents <fil>. Spec Change Log med dato og min beslutning, egen commit, test som viser at vanlig pnpm ingest ikke henter noen PDF. Oppdater README og AGENTS.md.
> Kjør deretter hele verifiseringen i bolker, én om gangen, og stopp ved første feil.

The human, starting the acceptance run:

> ja, start, med ett tillegg:
> Når kjøringen er ferdig, dump register.document og register.document_column (data only) til en gitignored fil, f.eks. .local/document-run-<commit>.sql, og legg en gjenopprettingskommando i README "Seed". Skriv i session-fila og deferred-work at pnpm seed og db:reset sletter dokumentradene, og at de gjenopprettes fra dumpen til allow-listen i 2.3 finnes. Si fra når containeren kjører, med navnet.

The human, adjusting the steps after the run. Checking the dump's row counts and copying it to a second location before `pnpm seed` came from the review session and was decided by the human:

> to justeringer for når kjøringen er ferdig:
> 1. Før du kjører pnpm seed for å teste gjenopprettingen: sjekk at radtallene i dumpen stemmer med tabellene, og kopier dumpen til en ekstra plassering (f.eks. også utenfor repoet). Først da seed + restore + sammenlign.
> 2. Spec-en står på in-review til etter merge, som etter retroen – ikke done.

The human, before the machine went to sleep mid-run. The completeness check over all 407 companies after sleep came from the review session and was decided by the human:

> jeg lukker PC-en en stund, så maskinen går i dvale midt i kjøringen. Når containeren avslutter: sjekk først at alle 407 selskapene i seed/document-run.json har dokumentrader (eller er rapportert som uten dokumenter). Mangler noen, er kjøringen avbrutt – start den igjen med samme kommando (den hopper over lagrede dokumenter), og ikke dump, seed eller gjenopprett før den har gått helt ferdig.

## What came back, and what was done with it

Commits:
- `c1a33fe` migration `20261020120000_register_document_tables.sql` (`register.document`, `register.document_column`, grants), both tables in `SEED_TABLES`, `unlistedDocumentFigures` and the manifest's `document_figure_orgnrs` reading `document_column`, the export's refusal of unlisted document figures, the seed re-exported (new tables empty, every other file unchanged), `test/db/documents.test.ts` and the table lists in the TS tests.
- `cdc2704` `OcrError` names the failed page and Tesseract's first stderr line.
- `3a295ee` the document pass in `run.py`, `fetch_document_years`/`fetch_document`, `write_document`/`to_ore`/`document_outcome`, documents mode, `test_documents_write.py` and `test_documents_run.py` (every matrix row).
- `889e5f0` the "Kilder og lisens" paragraph names the filed annual accounts.
- `e1c87d0` `pnpm ingest --documents <file>` (mounted read-only), `pnpm ingest:document-set` and the committed `seed/document-run.json` (407 orgnrs).
- `f72c206` the `Accept` header fix and the AGENTS.md stack line.
- `6123767` docs: technical note (AD-15's tables and `extracted`; every year 2021–2025, not every other year), `docs/data-sources-brreg.md` (the documents step and the 406), README ("Batch step 1", "Seed"), `docs/ai-log.md`, `deferred-work.md` (three 2.1b entries and the 1.3b allow-list entry closed; the full 62.100 run and the refiling limit added), `epic-2-context.md`, the spec's Implementation Notes, `sprint-status.yaml` (story at `review`).

Choices made by the subagent, open to the human (all in the spec's Implementation Notes):
- **Demo company C is not in the acceptance set**, although the spec's Decisions name it: it is uncovered, has no peer group, and documents mode refuses it. Accepted by the human (finding #21 below).
- **The export writes the allow-list back as it read it** instead of `[]`, because refusing unlisted figures while erasing the list would contradict itself.
- **`layout` is NULL for a Tesseract failure** (`refusal = 'ocr_error'`), and a PDF PyMuPDF cannot open is a failure that is not stored, so the next run retries it.
- **The acceptance set runs through Vite's module runner**, since plain Node cannot load `src/` (JSON imports, `server-only`).

Corrected during the session, caught by the subagent:
- **406 from the register.** A one-company run (`pnpm ingest --documents` with 813235552) failed every document: the endpoint refuses `Accept: application/pdf`. Fixed to `application/octet-stream`, pinned by `test_fetch.py::test_document_is_requested_as_octet_stream`. The rerun stored all five documents as `extracted` in 132 s, and 2023–2025's sum driftsinntekter equals the API to the øre. The database was restored with `pnpm seed`.
- **A NULL-blind CHECK.** The first draft of the status/layout/refusal CHECK compared nullable columns with `=`; a NULL makes a CHECK pass, so `status = 'paper'` with a NULL layout would have been accepted. Rewritten with `coalesce` before the tests ran; `test/db/documents.test.ts` covers the NULL cases.
- **A hang in `pnpm ingest:document-set`.** The computation module imported the CLI module back, which was still in its top-level await; the import never settled. The computation now returns the pools and imports nothing from the CLI.
- **A trailing newline passed the orgnr and year checks.** `^…$` with `re.match` accepts `"979607008\n"`; the `--documents` list and the `/aar` years now use `fullmatch` (`4f1c37c`), with a test case each that fails under the old pattern.
- Each matrix guard was deleted in turn and its named test run; all failed (listed in `docs/ai-log.md`). The export's allow-list refusal was checked the same way against `test/db/seed.test.ts`.

## Review

Three review subagents read the diff: a blind reviewer (B, the diff only), an edge-case reviewer (E) and a verification-gap reviewer (V). The orchestrating session triaged their 21 findings into the spec's Review Triage Log; the human decided #10 and #21.

Fixed in `50b39be` (finding numbers from the triage log; who found it in brackets):
- **#6 Cascades** (blind, edge). `register.document` references its company and `document_column` its document `ON DELETE CASCADE`, as Story 2.4's AC requires for a withdrawn company. `test/db/documents.test.ts`, "goes with its document, and the document with its company (ON DELETE CASCADE, for Story 2.4)".
- **#2 Read errors contained** (verification gap, blind, edge). Only `OcrError` and `RuntimeError` were caught around the read, so any other exception ended the run, and every rerun crashed on the same document. Any other failure is now named "read failed", not stored, and the run goes on. Tests in `ingest/tests/test_documents_run.py`: `test_a_read_that_fails_otherwise_is_named_not_stored_and_the_run_goes_on`, `test_a_listed_year_not_served_is_named_and_the_next_is_stored`, `test_a_malformed_year_list_costs_that_company_only`.
- **#3 Resume really commits** (verification gap). The resume test runs inside the fixture's outer transaction, so it could not show a real commit per document. `test_documents_run.py::test_connect_commits_each_transaction` asserts `write.connect` is autocommit; the live check is under "Acceptance run".
- **#4 No document list named** (verification gap, blind, edge). A company whose `/aar` answers 404/410 is counted and named in the summary: `test_a_company_with_no_document_list_is_counted_and_named`.
- **#5 OCR errors signal** (blind, edge). An OCR error is stored for good, so it now makes the run exit 1 (`needs_operator`); `test_documents_run.py::test_refusal_and_ocr_error_store_not_extracted` asserts it.
- **#1 Allow-list round trip untested** (verification gap, blind). `test/db/seed.test.ts`, "exports a listed orgnr, keeps the allow-list byte for byte, and names it in the manifest"; it fails when the export writes `[]` again or reads `document_figure_orgnrs` from `filing`.
- **#16 Manifest read dates** (edge). The read-at range includes `register.document`.
- **#8, #9 Stale docs** (blind). `docs/data-sources-brreg.md` and PRD FR-28 no longer say every other year; `epic-2-context.md` marks the "Kilder og lisens" item done.
- **#20 Valuta** (blind). The figure comments say øre are hundredths of `document.valuta`, since a non-NOK document is stored in its own currency.
- **#14 Session file** (blind): this update.

Rejected, with the reason in the triage log: #7 (blind: the copy follows the AC; the licence paragraph is Story 5.4), #11 (blind: the 2021–2025 window is the AC), #12 (blind: `seed/document-run.json` is not a seed file), #13 (blind, edge: no writer produces columns under a non-extracted document), #15 (edge: filings are written before documents), #17 (edge: a document row holds no figure), #18 (edge: both cases fail loudly and write nothing), #19 (edge: a failing SELECT is the existing connection-lost behaviour).

Decided by the human:
- **#21, demo C** (edge). The orchestrating session raised it as an intent gap. The human accepted A and B and their pools without C (`529f65b`, Spec Change Log).
- **#10, a plain `pnpm ingest` reads documents** (blind). The orchestrating session had rejected it as a frozen decision. The review session made the argument for overruling it: document reading was meant to be limitable, not part of the normal run. The human decided on that argument and overruled the rejection. `e09a413`: a plain `pnpm ingest` is the register and key-figures run and fetches no document; documents are read only with `--documents <file>`. `ingest/tests/test_documents_run.py::test_normal_run_fetches_no_document` serves the year list and the PDF and asserts neither is requested; it fails with the pass put back. Spec Change Log, README, AGENTS.md, `docs/data-sources-brreg.md`.

## Verification

On `e09a413`, batch by batch, stopping at the first failure (none failed):
- `pnpm check:pins`, `pnpm check:env`, `pnpm lint`, `pnpm typecheck`: pass.
- `pnpm test`: 763 passed.
- `pnpm seed && pnpm seed && pnpm seed:export`: `seed/` unchanged; `document` and `document_column` empty.
- `pnpm test:db`: 130 passed.
- `pnpm test:ingest` against the seeded database: 170 passed, none skipped.
- `pnpm build && pnpm check:routes`: pass, routes unchanged.
- `pnpm test:e2e`: 116 passed.

## Acceptance run

`pnpm ingest --documents seed/document-run.json` on the local database, image built from `e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d`, started 2026-10-20 after the verification above.

**Live interrupt and resume.** The first container (`goofy_galois`) was stopped with SIGINT after three documents (813235552, 2021–2023); it ended with `KeyboardInterrupt`, exit 130, and the three documents and six columns stayed committed. The same command started `tender_kepler`, which went on with 813235552/2024 and 2025 and the next company. The three stored rows kept their `read_at` (18:22:39, 18:23:09, 18:23:34 UTC), so nothing was read twice.

**Seed and reset delete the rows.** `pnpm seed` truncates every `register` table and `pnpm db:reset` recreates the database, so both delete the document rows. The committed seed keeps the two tables empty until Story 2.3's allow-list exists; until then the run is dumped (data only) to the gitignored `.local/document-run-e09a413.sql` and restored from it after a seed or a reset (README "Seed"; `deferred-work.md`; `9a662c1`).

**Result.** All 407 listed companies have document rows: 1 947 documents, 3 892 figure columns (two per extracted document).

| Filing year | extracted | not_extracted | paper |
|---|---|---|---|
| 2021 | 359 | 0 | 0 |
| 2022 | 380 | 0 | 0 |
| 2023 | 396 | 0 | 0 |
| 2024 | 404 | 1 | 0 |
| 2025 | 407 | 0 | 0 |
| Total | 1 946 | 1 | 0 |

- The one `not_extracted` is 912355233/2024, layout `generated`, refused with `year_header`: the year header could not be read, so no figure was stored.
- No failures, no OCR errors, no company without a document list; 2 177 listed years outside 2021–2025 were never fetched.
- `tender_kepler` read 1 944 documents in 40 753.9 s of reading, 21.0 s per document, in line with the 21.1 s median measured before the run; its wall time was 44 446 s (12.3 h). The machine slept during the run, so the elapsed time from the first to the last `read_at` (2026-10-20 18:22 to 2026-10-21 18:01 UTC) is longer.
- `brreg_id` links 1 208 documents to a key-figures filing: every 2023–2025 document, none for 2021–2022, the years the key-figures API does not hold.
- The completeness check after the machine slept (every listed orgnr has a document row) found none missing. A second run of the same command, on the image built from `80a4108` (no code change since `e09a413`; only docs), read nothing: 1 947 skipped as stored, 278 s, exit 0.

**Dump and restore.** `.local/document-run-e09a413.sql` (data only, 1 186 982 bytes): its COPY blocks hold 1 947 and 3 892 rows, the same as the tables. A second copy outside the repo, `C:\Users\cmein\peerless-backups\document-run-e09a413.sql`, has the same sha256. Then `pnpm seed` (both tables 0 rows) and the README restore command: the md5 of each table's rows in key order is the same before the seed and after the restore.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-1b-ocr-ingest.md` (Implementation Notes, Spec Change Log, Review Triage Log)
- AI log: "2026-10-20 — Story 2.1b: storing the filed accounts, and what could go wrong with them" and "2026-10-21 — Story 2.1b review: …"
- PR: [#34](https://github.com/IBE160-2026/G97-meinich/pull/34)

## Merge

CI on `14ea028` was green. The review was posted before merge as a GitHub review with five line comments, drafted by the review session and posted at the human's decision, as its summary says. The PR was merged at 18:31 UTC. The review session set the spec and the story to done on `main` afterwards.
