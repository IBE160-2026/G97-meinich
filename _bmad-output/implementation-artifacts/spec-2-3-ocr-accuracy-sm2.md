---
title: 'Story 2.3: Measure OCR accuracy (SM-2)'
type: 'feature'
created: '2026-10-23'
status: 'in-progress'
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
- [ ] `scripts/seed-format.ts`, `scripts/seed-export.ts` and the allow-list tests: merge `drawn.json` into the list.
- [ ] `scripts/document-set.ts --reference`, and a test.
- [ ] `scripts/ocr-sm2-compare.ts`, `scripts/ocr-sm2.ts` and `test/ocr-sm2.test.ts`: every matrix row.
- [ ] `analysis/ocr/consistency.py`.
- [ ] Data, last, after the full suite:
  1. Check the 2.1b dump is intact.
  2. Run `pnpm seed`.
  3. Run `pnpm ingest --documents analysis/ocr-reference/document-run.json`.
  4. Run `pnpm seed:export` and commit the seed.
  5. Run `consistency.py`, then `pnpm analysis:sm2`, and commit the report.
  6. Restore the 2.1b dump.
- [ ] Story 2.3b:
  - a GitHub issue with the actual fault and the evidence;
  - `sprint-status.yaml`: add `2-3b`;
  - `deferred-work.md`: add a split entry, and correct the 2.2 entry;
  - the diagnosis corrections listed in the Decisions.
- [ ] Docs.

**Acceptance Criteria:** `epics.md` Story 2.3, and the matrix above. In addition:
- Given a fresh clone with the seed loaded, when `pnpm analysis:sm2` runs, then it rewrites `ocr-sm2.md` byte for byte, apart from the generation date.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm test:ingest`: expected all green.
- `pnpm seed && pnpm seed:export && git diff --exit-code seed/`: expected no diff.
