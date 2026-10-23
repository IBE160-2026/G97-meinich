---
title: 'Story 2.3: Measure OCR accuracy (SM-2)'
type: 'feature'
created: '2026-10-23'
status: 'in-review'
baseline_commit: 'b19b1fab9f9156584c47820cb10a530f47d79382'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/analysis/ocr-reference/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing measures how accurate step 1's OCR is. The hand-transcribed reference set (issue #14: 20 filings, 40 columns, `analysis/ocr-reference/`) has never been compared with step 1's output. Step 1 has never read the reference companies, and their orgnrs are not on `seed/allow-list.json`. The spike's consistency baseline (Tesseract 5, 89 filings 2021–2025) has not been re-measured with Tesseract 5.5 and `tessdata_best` through `read_document` (NFR25, FR-28, NFR15).

**Approach:**
- Run step 1's document pass for the 20 reference orgnrs.
- `seed:export` adds them to the allow-list from `drawn.json` (reason "OCR-referansesett") and commits their document rows.
- A measurement script compares the committed rows field by field with `transcriptions.csv`.
- A second script re-reads the spike's 89 filings with `read_document` in the step-1 image.
- One report in `analysis/output/` holds both results.
- The ACs are in `epics.md` Story 2.3, which wins on a conflict.

**Decisions (Meinich, 2026-10-23):**
- **The sum line moves to Story 2.3b.** That story fixes the reading of the "SUM EGENKAPITAL OG GJELD" total and re-reads the affected documents.
  - **The diagnosis has changed.** The label is read. What fails is the bold figures on the total row.
  - **Correct the old description wherever it stands:**
    - the 2.2 entry in `deferred-work.md`;
    - `docs/data-sources-brreg.md:220`;
    - `epic-2-context.md:57`;
    - a Spec Change Log line in `spec-2-2`;
    - `docs/ai-log.md`, wherever it blames the label.
  - **The 2.3b GitHub issue** describes the actual fault.
  - **This story measures the reader as it is.** That result is 2.3b's "before".
  - **This story's PR still links issue #14.**
- **The boundary is recent = 2023–2025 and older = 2021–2022.** The key-figures API holds 2023 onward.
  - The report gives n per group: 12 and 8 filings in the reference set.
  - It draws no conclusions about differences between the groups beyond what samples that small can carry.
- **The report's headline figure (approval, 2026-10-23).**
  - The headline is the misread figures in columns that nevertheless reconciled, so they reach the engine.
  - Give it per group and in total, and list every case.
- **Every compared field is classified (approval, 2026-10-23).** Both blank is not a figure and is not counted. The four classes are:
  - **correct**: both hold the same figure;
  - **not read**: OCR is NULL and the transcription holds a figure;
  - **misread**: both hold a figure, and they differ;
  - **phantom**: OCR holds a figure and the transcription is blank.
  - Give counts per class, per group and in total.
  - Give no overall percentage without this breakdown.
- **Scope of the comparison (approval, 2026-10-23).**
  - Compare only the (orgnr, filing year) pairs in `drawn.json`. The other documents stored for the 20 companies are left out.
  - Read `transcriptions.csv` by column name.

## Boundaries & Constraints

**Always:**
- Read `transcriptions.csv` by header name, and ignore columns that are not in `TARGETS` (the header misspells `finansielle_anleggsmider`).
- Compare figures exactly: stored øre = transcribed kroner × 100. Use BigInt or `parseOre`, never a float.
- A cell is either blank or a figure, and a NULL column is either absent or a figure. Blank or NULL is never 0.
- State the recent/older boundary in the report before the comparison section.
- List every mismatch: orgnr, year, column, field, expected, read, and its class (`not read`, `misread` or `phantom`).
- Give both consistency denominators, under the baseline's own definition:
  - evaluable means c1 and c3 are both non-null;
  - a column passes when no c1–c4 check fails, within 5 kr;
  - report 2.2's `column_status` (with c5) on a separate line.
- Give the baseline as the spike report shows it. Its failure table lists 11 failing columns, so the baseline is 157/168. `epics.md` says 156. Explain the gap, and correct `epics.md` and `epic-2-context.md`.
- Put the generation date and the producing script names in the report.

**Never:**
- Claim a numeric target (NFR32).
- Reuse the spike's old Tesseract TSVs.
- Store the 89 spike filings in the database.
- Look at OCR output while transcribing, or edit `transcriptions.csv`.
- Add any other orgnr to the allow-list. The acceptance run's 407 orgnrs wait for Story 5.4 (technical note :155, `epics.md:679`), so the README dump step stays.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Test that fails if deleted |
|---|---|---|---|
| Correct | stored `26395800`, transcribed `263958` | `correct` | `test/ocr-sm2.test.ts` "classifies a correct figure" |
| Misread | stored `72263231000`, transcribed `72632310` | `misread`, listed | "classifies a misread figure" |
| Not read | stored NULL, transcribed `0` | `not read`, never `correct` | "NULL is not zero" |
| Phantom | stored value, transcribed blank | `phantom`, listed | "classifies a phantom figure" |
| Both blank | stored NULL, transcribed blank | not counted | "ignores a field neither holds" |
| Misread but reconciled | `misread` in a column whose `status` is `reconciled` | in the headline count and listed, per group and in total | "counts misreads that reach the engine" |
| Outside the draw | stored rows for a (orgnr, year) not in `drawn.json` | not compared | "compares only drawn filings" |
| Header order | columns shuffled, plus extra columns | same result | "reads by header name" |
| Baseline denominators | 178 columns, 168 evaluable, 157 pass | 157/178, 157/168 | "computes both denominators" |
| Allow-list | `drawn.json` with 20 orgnrs; list has other entries | the 20 are added once with reason "OCR-referansesett"; existing entries are kept | `test/seed-format.test.ts` "adds the reference orgnrs" |
| Committed set | allow-list missing one drawn orgnr | test fails | `test/allow-list.test.ts` "lists every reference orgnr" |

</frozen-after-approval>

## Code Map

- `analysis/ocr-reference/{drawn.json,transcriptions.csv,README.md}`: the input. Read-only.
- `scripts/document-set.ts` (`pnpm ingest:document-set`): add `--reference`. It writes `analysis/ocr-reference/document-run.json`, the sorted orgnrs from `drawn.json`, for `pnpm ingest --documents`. `run_documents` (`ingest/.../run.py:530-560`) accepts them, because all 20 are stored 62.100 companies. The run reads every `/aar` year, about 90 documents, and stores and reconciles them.
- `scripts/seed-format.ts:440-488`:
  - `parseAllowList` and `refuseUnlistedDocumentFigures`;
  - add a pure `withReferenceOrgnrs(allowList, drawn)`.
- `scripts/seed-export.ts:135-168`:
  - Read `drawn.json`, merge it in, and write the merged list. This replaces "as it read it", so update AGENTS.md and README:98/:107.
  - Refusal stays before any write.
- `test/allow-list.test.ts`: also read `drawn.json`, and assert every drawn orgnr is listed with the reason.
- `ingest/src/peerless_ingest/reconcile.py:94-169`: reuse `within_document_checks` (returns c1–c5 in øre) and `column_status`. `documents.py:232`: `read_document(pdf, bound)`.
- `analysis/ocr/consistency.py` (new):
  - Runs in the `peerless-ingest` image the way `ocr_accuracy.py:136` does.
  - The 89 filings are the orgnrs in `ocr_accuracy.py:380-382` × 2021–2025, taken from `-aar.json`.
  - PDFs come from `analysis/.cache/ocr/`, fetched with `Accept: application/octet-stream` when missing.
  - Writes `analysis/output/ocr-consistency-2026.json`: per column, the c1–c5 results and `column_status`.
- `scripts/ocr-sm2.ts` (new, `pnpm analysis:sm2`), with pure helpers in `scripts/ocr-sm2-compare.ts`:
  - Reads `transcriptions.csv`, `seed/demo/document_column.csv`, `document.csv` and the consistency JSON.
  - Writes `analysis/output/ocr-sm2.md`.
  - Formats numbers through `src/engine/format.ts`.
- Docs:
  - `docs/data-sources-brreg.md` (SM-2 result)
  - `epics.md:1377` and `epic-2-context.md:26` (157)
  - README (the reference run and the scripts)
  - `docs/ai-log.md`, the session file, `sprint-status.yaml`, `deferred-work.md` (the 2.1b dump entry goes to owner 5.4)

## Tasks & Acceptance

**Execution:**
- [x] `scripts/seed-format.ts`, `scripts/seed-export.ts` and the allow-list tests: merge `drawn.json` into the list.
- [x] `scripts/document-set.ts --reference`, and a test.
- [x] `scripts/ocr-sm2-compare.ts`, `scripts/ocr-sm2.ts` and `test/ocr-sm2.test.ts`: every matrix row.
- [x] `analysis/ocr/consistency.py`.
- [x] Data, last, after the full suite:
  1. Check the 2.1b dump is intact.
  2. Run `pnpm seed`.
  3. Run `pnpm ingest --documents analysis/ocr-reference/document-run.json`.
  4. Run `pnpm seed:export` and commit the seed.
  5. Run `consistency.py`, then `pnpm analysis:sm2`, and commit the report.
  6. Restore the 2.1b dump.
- [x] Story 2.3b (issue #38):
  - a GitHub issue with the actual fault and the evidence;
  - `sprint-status.yaml`: add `2-3b`;
  - `deferred-work.md`: add a split entry, and correct the 2.2 entry;
  - the diagnosis corrections listed in the Decisions.
- [x] Docs.

**Acceptance Criteria:** `epics.md` Story 2.3, and the matrix above. In addition:
- Given a fresh clone with the seed loaded, when `pnpm analysis:sm2` runs, then it rewrites `ocr-sm2.md` byte for byte, apart from the generation date.

## Spec Change Log

- **2026-10-23, Meinich: the diagnosis in the Decisions is disproved.**
  - **The old diagnosis.** "The label is read; the bold figures fail" came from the BMAD session's first investigation, which read the spike's Tesseract 5 TSVs (`analysis/.cache/ocr`), not step 1's current reader. It was carried into Meinich's planning answer and frozen.
  - **What the probe showed.** The implementation probe ran `read_document`'s own OCR on 919062223/2021 and six random documents from the 836. In all seven, the bold "SUM" reads as "50M". `layout.fold` drops digits, so the label folds to "megenkapitaloggjeld" and matches no target. A bold "1" came back as "l" in 2 of the 7, which refuses that figure.
  - **The 2.3b issue** describes the fold failure ("SUM" → "50M") and the "1" → "l" misreads, with the probe as evidence (`deferred-work.md`, the Story 2.3b entry).
  - **KEEP:** the split to 2.3b, and this story measuring the reader as it is.
- **2026-10-23, Meinich: suspected transcription errors are checked blind.**
  - **The check.** `analysis/ocr-reference/blind-check.csv` holds 20 cells (orgnr, year, column, field) in random order (seed 20261023): the 6 misreads in reconciled columns, mixed with 14 random cells where OCR and transcription agree. It has no OCR values and does not mark which cells are suspected.
  - **Meinich checks every cell against the PDFs.**
  - **Each correction to `transcriptions.csv`** is logged in `analysis/ocr-reference/README.md` with its old value, new value and date.
  - **`ocr-sm2.md`** shows the headline count both before and after the corrections.

## Review Triage Log

Review pass 1, 2026-10-23. Three layers ran on the diff since `b19b1fa`: blind (B), edge case (E) and verification gap (V).

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| V1 | `document-set` `main` argv routing (`--reference`, unknown argument) has no test | medium | No test calls `main` or `writeReferenceRun`. Reverting the entry point to `main(process.cwd())` would make `--reference` take the database path, and every test would still pass. | patch |
| V2 | The per-column baseline comparison (fixed / still failing / neither / newly failing, `totalUnread`) is inline in `renderReport` and covered only by the self-generated snapshot | medium | `scripts/ocr-sm2.ts:347-370`; the only test of it is the byte-for-byte snapshot. The predicate restates `consistencyDenominators` instead of sharing it. | patch |
| E3 | A column with a failing check that is also not evaluable is listed both as failing and as not evaluable | low | `failingNow` adds on `failed` without `evaluable` (`ocr-sm2.ts:353`), while `notEvaluableNow` lists the same column. | patch (with V2) |
| B7 | The report does not explain every difference from the baseline, which the AC requires ("or the report explains each difference") | medium | The report attributes the drop to the missing total (71 of 86 not-evaluable columns). The other 15, the 3 newly failing and the 5 baseline-failing now not evaluable are listed but not explained. | patch (with V2) |
| E4, B10a | A baseline filing missing from the re-read would be reported as "not evaluable now". Nothing checks that the re-read covers the same 89 filings. | low | `neither` takes every baseline key that is neither passing nor failing, including absent filings. `consistency.py` drops a cached-404 filing silently. | patch: the report refuses unless the re-read set is the baseline's 89 filings |
| V3 | `consistency.py` and its JSON contract with `parseConsistency` have no test | low | No test or CI step runs either. It is a one-off script that needs Docker and the network. | defer |
| E1 | `consistency.py` aborts the whole run on a non-`OcrError` exception | low | `analysis/ocr/consistency.py:710-718`. The run completed on all 89 filings. Unlikely, and the fix adds a branch. | reject |
| E2, B10c | `fetch` retries only on `HTTPError`; a `URLError` or timeout aborts | low | `consistency.py:634-648`. The run fails loudly, not silently. The fix adds a branch. | reject |
| B10b | The consistency JSON records the mutable tag `peerless-ingest:local`, not the commit it was built from | low | True. Fixing it needs a new 30-minute OCR run, and the branch history ties the run to `cfecb1e`. | reject |
| E5 | A malformed correction row's refusal names "row 0" | low | `ocr-sm2-compare.ts`: `parseCorrections` passes `0` as the line to `orgnr()`, `year()` and `role()`. The fix is a direct correction. | patch |
| E6, B14a | `withReferenceOrgnrs` keeps a drawn orgnr listed with another reason, while the test and the epics AC require "OCR-referansesett" | medium | `seed-format.ts`, `withReferenceOrgnrs`; `test/allow-list.test.ts`. The export and the test disagree once Story 5.4 lists a reference orgnr for another reason. | patch: refuse a drawn orgnr listed with another reason |
| B14b | A changed draw leaves stale reference orgnrs on the list | false | The draw is committed once (issue #14) and is never re-run; nothing changes it. | reject |
| B1 | The blind check re-read only cells where OCR disagreed in reconciled columns, so every correction moved towards OCR. The report states neither that nor the transcription error rate. | medium | True: the 3 misreads in failed columns were not re-checked; 12 errors were found in 40 rows (6 + 6). Neither `ocr-sm2.md` nor `data-sources-brreg.md` says so. | patch (report and docs text) |
| B2 | Cell 6 was re-read only after a prompt, but is presented as a blind confirmation | medium | The build session told the checker the value equalled the other column's figure. The report says "each was found by the blind check and confirmed against the PDF". | patch (qualify cell 6 in the README, report and docs) |
| B3 | The blind check cannot be audited: the key and the selection code are outside the repository | medium | True. The key is in the scratchpad; no script is committed. | patch: commit the selection script (reproducible from the transcriptions before the corrections) and the key |
| B4 | The headline counts misreads only. A phantom in a reconciled column also reaches the engine. | low | `misreadsReachingEngine` filters `misread`. It is 0 today. The headline's definition is the human's (approval), so it stays. | patch: the report also states phantoms in reconciled columns (0) |
| B5 | Reconciled prior columns are counted as reaching the engine, although Story 2.9 uses a prior column only when the year has no document of its own | medium | Two of the six "before" cases are prior columns, and step 1 read every year for these companies. The headline's definition stays (approval). | patch: the report states that prior columns overcount |
| B6 | "Not read" mixes transcribed 0 with real figures | medium | Verified: 42 of 121 not-read fields are transcribed as 0. | patch: the report splits not-read into transcribed 0 and non-zero |
| B8 | The corrected transcriptions were not re-validated with c1–c4 | low | Re-run in review: all 40 corrected rows pass c1–c4. The README does not say so. | patch (one README line) |
| B9 | Lines that no check covers (bankinnskudd, kundefordringer, salgsinntekt) have no follow-up owner | medium | `data-sources-brreg.md` names the risk, but no `deferred-work.md` entry exists. Pre-existing in the reader (2.1a/2.2), exposed here. | defer |
| B11 | The README says a dump taken after `pnpm seed` fails to restore, but gives only that failing command | medium | `README.md:120-126`. The next dump taken as written will not restore over the seed. | patch: a dump command that excludes allow-listed orgnrs |
| B12 | The frozen "Never: edit `transcriptions.csv`" is not amended | — | Its fix edits this build's spec. The Spec Change Log entry of 2026-10-23 records the blind check and its corrections. | reject |
| B13 | Status and session records out of step: sprint-status `in-progress`, session file commit list, ai-log "Not yet reviewed" | low | True; direct corrections. | patch |
| B15 | The README says "about 90" reference documents; the run read 97 | low | Direct correction. The `read_at` range mixing register and OCR reads is cosmetic. | patch (97 only) |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ingest`: expected all green.
- `pnpm seed && pnpm seed:export && git diff --exit-code seed/`: expected no diff.
