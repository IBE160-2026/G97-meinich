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
