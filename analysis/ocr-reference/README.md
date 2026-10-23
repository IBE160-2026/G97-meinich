# OCR reference set

Hand-transcribed truth for measuring step 1's OCR (SM-2, NFR25, Story 2.3). Issue [#14](https://github.com/IBE160-2026/G97-meinich/issues/14).

The rules below were committed **before** the draw was run, so the sample cannot be chosen to flatter the OCR.

## Population

- Every company with primary industry 62.100 that has a `SELSKAP` key-figures filing for 2023 with `sumDriftsinntekter` > 0, according to the committed demo seed.
- **Excluded:** the 407 companies in `seed/document-run.json` (demo A and B and their peer pools). The reference set measures the whole industry, not the demo set, and those documents have already been read by the code being measured.
- **Excluded:** companies with no positive 2023 revenue. Their filings are mostly empty lines, so they would test very little.

## Strata (20 cells, one filing each)

| | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| **A** revenue < 1 mill. kr | 1 | 1 | 1 | 1 | 1 |
| **B** 1–10 mill. kr | 1 | 1 | 1 | 1 | 1 |
| **C** 10–50 mill. kr | 1 | 1 | 1 | 1 | 1 |
| **D** ≥ 50 mill. kr | 1 | 1 | 1 | 1 | 1 |

The size band comes from the company's **2023** `sumDriftsinntekter`, for every filing year. The key-figures API holds no 2021–2022 filings, so a single reference year keeps the bands comparable.

## The draw

`draw.py` sorts the population by orgnr. It shuffles each band once with `random.Random(SEED)`, where `SEED = 20261022`, and then fills the cells in the order the table lists them (year by year, band by band). For each cell it walks its band's shuffled list and takes the **first** company that:
1. has not been used for another cell; and
2. has the cell's year in the register's list of filed documents (`/aar`).

The document is downloaded to `.local/ocr-reference/` (gitignored, never committed: the licence check is Story 2.5). The orgnrs that were tried and skipped are recorded, so the draw can be reproduced and checked.

**Replacement rule:** if the transcriber finds that a drawn document is a scanned paper filing rather than the generated layout, the cell takes the next eligible company in the same shuffled list. Both the skip and the reason are written in `drawn.json`. All 1 947 documents read in Story 2.1b were generated, so this should be rare.

## Transcription

Fill in `transcriptions.csv` from the PDF, **without looking at any OCR output** for that document. Otherwise the reference is no longer independent.

- One row per column: `current` (the filing year) and `prior` (the year before), with `stated_year` as printed in the column header.
- Each figure is in **whole kroner, exactly as printed**: no spaces, a minus sign for negatives (also when the PDF shows parentheses), and the cell left **empty** when the line does not appear in the document. An empty cell is never 0, and a printed 0 is `0`.
- The 23 field columns are the lines `read_document` targets (`ingest/src/peerless_ingest/layout.py`, `TARGETS`). Lines the document labels differently (for example "Sum inntekter" for `sum_driftsinntekter`) go in the same column.
- `transcribed_by` and `transcribed_on` (YYYY-MM-DD) on every row; `notes` for anything unusual.
- The file is semicolon-separated (`;`), UTF-8, so it opens column by column in a Norwegian Excel. Keep figures as plain digits: no thousands separator, no currency.
- Extra columns for lines outside `TARGETS` (for example `finansielle_anleggsmidler`, `andre_kortsiktige_fordringer`) are allowed, but optional: the reconciliation checks compare printed totals only, so no extra line is needed for them. Story 2.3 must read the file **by header name, not by position**, and ignore columns that are not in `TARGETS`.

## Files

- `README.md`: these rules.
- `draw.py`: the draw.
- `drawn.json`: the result, committed after the draw.
- `transcriptions.csv`: the template, then the transcriptions.
- `blind-check.csv`: the blind check of 20 cells against the PDFs (below).

## Transcription check

Before the transcriptions were used, the review session ran the within-document checks c1–c4 (5 kr bound) on every transcribed row, without looking at any OCR output. Six of the 40 rows failed at first: 921716257/2021, 912197905/2022, 915338534/2023, 989081799/2025 (prior), 917526729/2025 and 922184534/2025 (prior). Each was a transcription error: a mistyped or dropped digit, wrong by 20 kr to about 8 mill. kr. The transcriber corrected every one against the PDF, and all 40 rows pass. The transcription dates were changed from DD.MM.YYYY to YYYY-MM-DD.

## Blind check after the first measurement

The first SM-2 report (Story 2.3) found six misread figures in reconciled columns: figures that would reach the engine. Five of them looked like transcription errors. One example: kundefordringer was transcribed as 444 745 213 against total assets of 86 913 592. So the transcriptions were checked again, blind. `blind-check.csv` lists 20 cells (orgnr, filing year, column, field) in random order (seed 20261023): the six suspected cells mixed with 14 cells drawn at random from the 639 where OCR and transcription agree. It shows no OCR value and no transcribed value, and does not say which cells are suspected. The transcriber read every cell from the PDF.

**Result:**
- **The 14 control cells:** all agree with both the transcription and OCR.
- **The six suspected cells:** all six were transcription errors.
- **Cell 6:** the first value entered (45 622 466) was read from the 2021 column; re-read from the 2020 column, it is 37 849 846. This is noted in the file.

`scripts/ocr-sm2.ts` reads the table below to report the headline before and after the corrections, so keep its columns as they are. `Column` is `current` or `prior`. The figures are whole kroner, as in `transcriptions.csv`.

## Corrections

| Date | Orgnr | Filing year | Column | Field | Old | New |
|---|---|---|---|---|---|---|
| 2026-10-23 | 995318733 | 2021 | current | sum_eiendeler | 86913592 | 86913593 |
| 2026-10-23 | 995318733 | 2021 | prior | sum_kortsiktig_gjeld | 19339152 | 37849846 |
| 2026-10-23 | 995318733 | 2021 | current | kundefordringer | 444745213 | 44745213 |
| 2026-10-23 | 917526729 | 2025 | current | sum_kortsiktig_gjeld | 3398859 | 5619383 |
| 2026-10-23 | 922184534 | 2025 | current | bankinnskudd | 429329 | 9429329 |
| 2026-10-23 | 917526729 | 2025 | prior | sum_kortsiktig_gjeld | 3224133 | 5233612 |
