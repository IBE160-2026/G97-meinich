# Story 2.3: Measure OCR accuracy (SM-2)

**Date:** 2026-10-23
**Tool:** Claude Code (Opus 5.5), BMAD build session with an implementation subagent
**Story / issue:** Story 2.3 (FR-28, NFR25, NFR15); links issue #14 (the reference set). The story issue and the 2.3b issue are not opened yet.
**Result:** branch `story/2.3-ocr-accuracy-sm2`, not pushed; PR to come. Commits `4a3b3f0`…, listed below; status `review`.

## Goal

Measure step 1's OCR against the hand-transcribed reference set, field by field, and re-measure the spike's consistency baseline with `read_document`, in one report: `analysis/output/ocr-sm2.md`.

## Prompts that mattered

The human's prompts are in `docs/ai-prompts.md`, verbatim; the review session adds them after merge. In short:

1. Implement `spec-2-3-ocr-accuracy-sm2.md`; the spec is the source of truth.
2. Mid-run: commit in logical steps (AGENTS.md "Git workflow"), no push and no remote operations, so no GitHub issue was opened.
3. Mid-run: restore the 1 947 Story 2.1b document rows from `.local/document-run-bd2ce3e.sql` only after the seed commit, and report the counts.
4. After the hand-back, on the diagnosis: take the probe's ("SUM" → "50M" in the fold, "1" → "l" in 2 of 7); the spec's correction says the earlier diagnosis came from the build session's first investigation and was carried into the human's planning answer.
5. On the suspected transcription errors: a blind check of 20 cells (the six suspected among 14 random agreeing ones, random order, no OCR values, unmarked), every correction logged in the reference README with old and new value and date, and the report's headline before and after.

## What came back, and what was done with it

- **Accepted (implemented as specified):** `withReferenceOrgnrs` and the export reading `drawn.json`; `pnpm ingest:document-set --reference`; `scripts/ocr-sm2-compare.ts`, `scripts/ocr-sm2.ts` and every matrix row in `test/ocr-sm2.test.ts`; `analysis/ocr/consistency.py`; the seed with the reference rows; the report.
- **The data run.** `pnpm ingest --documents analysis/ocr-reference/document-run.json` read 97 documents of the 20 reference companies (83 reconciled, 14 failed_reconciliation) in 47 minutes. The seed now holds 97 documents and 194 columns. After the seed commit, the dump was restored: `register.document` 2 044 = 1 947 + 97, `register.document_column` 4 086 = 3 892 + 194.
- **Found by the build session, against the spec's decision:** the spec said the "SUM EGENKAPITAL OG GJELD" label is read and the bold figures fail. A probe of `read_document`'s own OCR on seven documents with the total NULL showed the bold "SUM" read as "50M" in all seven, so the folded label matches no target; the figures were mostly read. The corrections in `deferred-work.md`, `docs/data-sources-brreg.md`, `epic-2-context.md`, the 2.2 spec's change log and `docs/ai-log.md` describe what the probe showed. The human confirmed the probe's diagnosis (prompt 4); the first diagnosis was the build session's own, from the spike's Tesseract 5 output, and is recorded as such in the spec's change log.
- **Found by the build session in the result:** 5 of the 6 headline misreads look like transcription errors (995318733/2021: kundefordringer above total assets, sum eiendeler a krone off its own total; 917526729/2025: sum kortsiktig gjeld read equal to the register's API). `transcriptions.csv` was not edited from OCR output.
- **The blind check (prompt 5).** The build session wrote `analysis/ocr-reference/blind-check.csv` (seed 20261023) and first kept the key outside the repository (committed in review as `blind-check-key.csv`, with the selection script `blind-check-draw.ts`); Meinich read all 20 cells from the PDFs. The 14 controls agreed; all six suspected cells were transcription errors, including the bankinnskudd cell the build session had taken for a real misread. One check entry (cell 6) equalled the other column's figure; the build session said so without showing the OCR value, and Meinich re-read it from the 2020 column. That correction was made on prompting, so cell 6 is not a blind result; five of the six are. The six corrections are logged in `analysis/ocr-reference/README.md` (`cfb2290`). `transcriptionsBefore` rebuilds the first headline from that log; the headline is 6 before and 0 after the corrections.
- **Corrected in the build session's own code:** the "compares only drawn filings" test passed under a mutation that ignored the draw, because the undrawn year had only one column transcribed (`5b51e84`). The not-evaluable list printed raw keys (`76d7120`).
- **Baseline 156 → 157:** `epics.md` and `epic-2-context.md` corrected; the report explains the gap.

## Commits

`4a3b3f0` spec and planning, `b96b648` allow-list merge, `7c47031` `--reference`, `f7cc3e7` `analysis:sm2`, `cfecb1e` `consistency.py`, `76d7120` list format, `3b7e3dc` seed, `ca566fe` reports, `5b51e84` test fix, `4d564aa` docs, `cfb2290` blind check and corrections (#14), `050ef5a` headline before and after the corrections, `e9d2e3b` report regenerated, `a22aa84` docs after the blind check, `c093760` `
` escapes in `document-set.ts`.

Review fixes (each finding credited to the review layer that raised it, in `docs/ai-log.md`, the Story 2.3 entry):

- `a81bfd4` a reference orgnr listed with another reason refuses (edge case E6);
- `040c920` tests for `main`'s argument routing in `document-set.ts` (verification gap V1);
- `fda03db` `baselineDiff` with one bucket per column and the shared predicate (V2, E3), the not-evaluable causes and failing checks (blind B7), the coverage refusal (E4, B10a), README line numbers in corrections refusals (E5), the phantom, prior-column, blind-check-selection and error-rate lines (B4, B5, B1), cell 6 marked as re-read on prompting (B2), not read split by transcribed 0 (B6);
- `5c7300e` the blind check's selection script and key (B3);
- `ac7fe89` the report regenerated;
- then the docs commit: cell 6 qualified and the selection described in the reference README, the SM-2 section and the ai-log (B1, B2), the c1–c4 re-check of the corrected transcriptions (B8), a dump and restore of unlisted orgnrs only (B11), 97 documents (B15), status `review` and this list (B13).

## Links

- `analysis/output/ocr-sm2.md`, `analysis/output/ocr-consistency-2026.json`
- `docs/ai-log.md`, "Story 2.3: SM-2, the reader measured against a hand transcription"
- `deferred-work.md`: the 2.3b entry and the dump entry (owner 5.4)
