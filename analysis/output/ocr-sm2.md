# OCR accuracy against the hand-transcribed reference set (SM-2)

Generated 2026-10-29 by `scripts/ocr-sm2.ts` (`pnpm analysis:sm2`), with helpers in `scripts/ocr-sm2-compare.ts`. Inputs, all committed: `analysis/ocr-reference/drawn.json` and `analysis/ocr-reference/transcriptions.csv` (the reference set, issue #14) and the corrections log in `analysis/ocr-reference/README.md`; `seed/demo/document.csv` and `seed/demo/document_column.csv` (step 1's output, written by `pnpm ingest --documents analysis/ocr-reference/document-run.json` and committed by `pnpm seed:export`); `analysis/output/ocr-consistency-2026.json` (generated 2026-10-28 by `analysis/ocr/consistency.py` in step 1's image, tesseract 5.5.0).

This measures step 1 as it is: `read_document` (Tesseract 5.5, `nor` from `tessdata_best`) and Story 2.2's reconciliation. It states what was measured and commits to no numeric target (NFR32).

## The sample

- 20 filings, one per cell of a seeded draw stratified by filing year (2021–2025) and by 2023 revenue band, from every company in the covered industry with positive 2023 revenue (`analysis/ocr-reference/README.md`). The sample is the whole industry, not the demo companies and their peers: those 407 companies were excluded before the draw.
- Each filing has two columns (this year, last year), and each column the 23 lines `read_document` targets. Only the drawn (orgnr, filing year) pairs are compared; the other documents step 1 stored for the same companies are left out.
- Stored øre are compared exactly with the transcribed kroner × 100. A blank cell or a NULL figure is absent, never 0.

## Recent and older filings

The boundary was set before the comparison was run: **recent** is filing years 2023–2025, **older** is 2021–2022. The key-figures API holds filings from 2023 on, so only a recent filing's current column can be checked against the register.

- Recent: n = 12 filings. Older: n = 8 filings.
- Samples this small carry no conclusion about a difference between the groups. The split is reported, not interpreted.

## Headline: misread figures that reach the engine

A misread figure in a column that nevertheless reconciled. Only a reconciled column's figures reach the engine, so these are wrong figures Peerless would use.

The transcriptions were corrected after the first measurement: a blind check against the PDFs found 6 transcription errors; 1 more was found later, on prompting, after the Story 2.3b report pointed to it (`analysis/ocr-reference/README.md`, "Corrections"). The headline is given against the transcriptions both before and after those corrections; every other section uses the corrected transcriptions.

| Group | Filings | Before corrections | After corrections |
|---|---|---|---|
| Recent (2023–2025) | 12 | 3 | 0 |
| Older (2021–2022) | 8 | 4 | 0 |
| All | 20 | 7 | 0 |

- **Phantoms reach the engine too.** The headline counts misreads only; phantom figures in reconciled columns: recent (2023–2025) 0, older (2021–2022) 0, all 0 (after the corrections; 0 before).
- **Prior columns overcount.** Of the headline cases, 3 of 7 before and 0 of 0 after the corrections are in a last-year column. Story 2.9 uses a last-year column only when that year has no document of its own, so the headline overcounts what reaches the engine by up to those.
- **How the blind check chose its cells.** It re-read only the cells where OCR and the transcription disagreed in reconciled columns (the 6 headline cases of the first measurement), mixed with control cells where they agreed. 7 of the 7 corrections set the transcription to the figure OCR read, so every correction moved towards OCR. The 2 misread figures in columns that did not reconcile were not re-checked, and neither were the not-read fields.
- **Transcription error rate.** 6 errors were found by the within-document checks on the transcriptions alone (`analysis/ocr-reference/README.md`, "Transcription check") and 6 by the blind check, 1 later, across 40 transcribed columns.

### After the corrections

None.

### Before the corrections

"Expected" is the transcription as it stood before the corrections.

| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |
|---|---|---|---|---|---|---|---|
| 915648479 | 2021 | last year | salgsinntekt | 3 659 013 kr | 3 657 114 kr | misread | reconciled |
| 995318733 | 2021 | this year | kundefordringer | 444 745 213 kr | 44 745 213 kr | misread | reconciled |
| 995318733 | 2021 | this year | sum_eiendeler | 86 913 592 kr | 86 913 593 kr | misread | reconciled |
| 995318733 | 2021 | last year | sum_kortsiktig_gjeld | 19 339 152 kr | 37 849 846 kr | misread | reconciled |
| 917526729 | 2025 | this year | sum_kortsiktig_gjeld | 3 398 859 kr | 5 619 383 kr | misread | reconciled |
| 917526729 | 2025 | last year | sum_kortsiktig_gjeld | 3 224 133 kr | 5 233 612 kr | misread | reconciled |
| 922184534 | 2025 | this year | bankinnskudd | 429 329 kr | 9 429 329 kr | misread | reconciled |

### The corrections

Each was found by the blind check and confirmed against the PDF (`analysis/ocr-reference/README.md`), blind except where the table says otherwise: blind-check cell 6 was re-read on prompting, after the build session said its first entry equalled the other column's figure, so its correction is not a blind result.

| Date | Orgnr | Year | Column | Field | Transcribed | Corrected | Blind |
|---|---|---|---|---|---|---|---|
| 2026-10-23 | 995318733 | 2021 | this year | sum_eiendeler | 86 913 592 kr | 86 913 593 kr | yes |
| 2026-10-23 | 995318733 | 2021 | last year | sum_kortsiktig_gjeld | 19 339 152 kr | 37 849 846 kr | no: re-read on prompting |
| 2026-10-23 | 995318733 | 2021 | this year | kundefordringer | 444 745 213 kr | 44 745 213 kr | yes |
| 2026-10-23 | 917526729 | 2025 | this year | sum_kortsiktig_gjeld | 3 398 859 kr | 5 619 383 kr | yes |
| 2026-10-23 | 922184534 | 2025 | this year | bankinnskudd | 429 329 kr | 9 429 329 kr | yes |
| 2026-10-23 | 917526729 | 2025 | last year | sum_kortsiktig_gjeld | 3 224 133 kr | 5 233 612 kr | yes |
| 2026-10-28 | 915648479 | 2021 | last year | salgsinntekt | 3 659 013 kr | 3 657 114 kr | yes |

## Every compared field, by class

- **correct**: both hold the same figure;
- **not read**: OCR is NULL and the transcription holds a figure;
- **misread**: both hold a figure, and they differ;
- **phantom**: OCR holds a figure and the transcription is blank.

A field neither holds is not a figure and is not counted. "Recovered exactly" is correct over counted. "Not read" is split by what the transcription holds: a transcribed 0, or a non-zero figure.

| Group | correct | not read (transcribed 0) | not read (transcribed non-zero) | misread | phantom | Counted | Recovered exactly |
|---|---|---|---|---|---|---|---|
| Recent (2023–2025) | 431 | 13 | 31 | 1 | 0 | 476 | 90,5 % |
| Older (2021–2022) | 238 | 29 | 25 | 1 | 0 | 293 | 81,2 % |
| All | 669 | 42 | 56 | 2 | 0 | 769 | 87,0 % |

## Consistency of the reference filings

Two definitions, never mixed. **Passing** is the spike baseline's: a column is evaluable when c1 (income statement) and c3 (balance) both are, and passes when it is evaluable and no check among c1–c4 fails (5 kr bound). **Reconciled** is Story 2.2's `column_status` (c1–c5 and, for this year's column, the API comparison). A filing is reconciled when its current column is.

| Group | Filings | Columns | Evaluable | Passing | Passing / all | Passing / evaluable | Columns reconciled | Filings reconciled |
|---|---|---|---|---|---|---|---|---|
| Recent (2023–2025) | 12 | 24 | 24 | 23 | 95,8 % | 95,8 % | 23 of 24 | 12 of 12 |
| Older (2021–2022) | 8 | 16 | 9 | 9 | 56,3 % | 100,0 % | 9 of 16 | 5 of 8 |
| All | 20 | 40 | 33 | 32 | 80,0 % | 97,0 % | 32 of 40 | 17 of 20 |

## Every mismatch

100 fields are not correct. Expected is the transcription, read is step 1's stored figure, both in whole kroner.

| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |
|---|---|---|---|---|---|---|---|
| 915648479 | 2021 | this year | avskrivninger | 200 052 kr | NULL | not read | reconciled |
| 915648479 | 2021 | this year | annen_driftskostnad | 1 621 328 kr | NULL | not read | reconciled |
| 915648479 | 2021 | this year | aarsresultat | 1 501 123 kr | NULL | not read | reconciled |
| 915648479 | 2021 | last year | avskrivninger | 225 747 kr | NULL | not read | reconciled |
| 915648479 | 2021 | last year | bankinnskudd | 1 366 565 kr | NULL | not read | reconciled |
| 917397198 | 2021 | this year | salgsinntekt | 5 661 887 kr | NULL | not read | reconciled |
| 921716257 | 2021 | this year | annen_driftskostnad | 95 575 kr | NULL | not read | reconciled |
| 921716257 | 2021 | this year | kundefordringer | 132 559 kr | NULL | not read | reconciled |
| 921716257 | 2021 | this year | leverandorgjeld | 87 800 kr | NULL | not read | reconciled |
| 921716257 | 2021 | last year | ordinaert_resultat_foer_skattekostnad | 0 kr | NULL | not read | failed_reconciliation |
| 921716257 | 2021 | last year | aarsresultat | 0 kr | NULL | not read | failed_reconciliation |
| 921716257 | 2021 | last year | sum_egenkapital | 0 kr | NULL | not read | failed_reconciliation |
| 921716257 | 2021 | last year | sum_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 995318733 | 2021 | this year | avskrivninger | 891 828 kr | NULL | not read | reconciled |
| 995318733 | 2021 | last year | avskrivninger | 815 697 kr | NULL | not read | reconciled |
| 885583822 | 2022 | this year | salgsinntekt | 60 863 322 kr | NULL | not read | failed_reconciliation |
| 885583822 | 2022 | this year | avskrivninger | 170 190 kr | NULL | not read | failed_reconciliation |
| 885583822 | 2022 | this year | sum_driftskostnad | 56 922 303 kr | NULL | not read | failed_reconciliation |
| 885583822 | 2022 | last year | varekostnad | 14 481 267 kr | NULL | not read | failed_reconciliation |
| 885583822 | 2022 | last year | avskrivninger | 171 463 kr | NULL | not read | failed_reconciliation |
| 885583822 | 2022 | last year | driftsresultat | 1 721 957 kr | NULL | not read | failed_reconciliation |
| 885583822 | 2022 | last year | ordinaert_resultat_foer_skattekostnad | 1 373 242 kr | NULL | not read | failed_reconciliation |
| 885583822 | 2022 | last year | leverandorgjeld | 1 662 590 kr | NULL | not read | failed_reconciliation |
| 885583822 | 2022 | last year | sum_egenkapital_gjeld | 19 349 861 kr | 19 349 361 kr | misread | failed_reconciliation |
| 912197905 | 2022 | this year | avskrivninger | 109 500 kr | NULL | not read | reconciled |
| 912197905 | 2022 | last year | avskrivninger | 182 118 kr | NULL | not read | reconciled |
| 912197905 | 2022 | last year | annen_driftskostnad | 5 260 438 kr | NULL | not read | reconciled |
| 912197905 | 2022 | last year | leverandorgjeld | 1 518 435 kr | NULL | not read | reconciled |
| 929481151 | 2022 | this year | sum_driftsinntekter | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | this year | netto_finans | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | this year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | this year | sum_varige_driftsmidler | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | this year | leverandorgjeld | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | this year | sum_kortsiktig_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | this year | sum_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | this year | sum_egenkapital_gjeld | 24 428 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | sum_driftsinntekter | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | driftsresultat | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | netto_finans | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | aarsresultat | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | sum_varige_driftsmidler | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | sum_eiendeler | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | sum_egenkapital | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | leverandorgjeld | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | sum_kortsiktig_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | sum_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 929481151 | 2022 | last year | sum_egenkapital_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 929821092 | 2022 | this year | avskrivninger | 4 628 kr | NULL | not read | failed_reconciliation |
| 929821092 | 2022 | last year | ordinaert_resultat_foer_skattekostnad | 0 kr | NULL | not read | failed_reconciliation |
| 929821092 | 2022 | last year | aarsresultat | 0 kr | NULL | not read | failed_reconciliation |
| 929821092 | 2022 | last year | sum_eiendeler | 0 kr | NULL | not read | failed_reconciliation |
| 929821092 | 2022 | last year | sum_egenkapital | 0 kr | NULL | not read | failed_reconciliation |
| 929821092 | 2022 | last year | sum_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 929821092 | 2022 | last year | sum_egenkapital_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 915338534 | 2023 | this year | salgsinntekt | 12 808 765 kr | NULL | not read | reconciled |
| 915338534 | 2023 | this year | lonnskostnad | 8 605 849 kr | NULL | not read | reconciled |
| 915338534 | 2023 | this year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 915338534 | 2023 | this year | varer | 0 kr | NULL | not read | reconciled |
| 915338534 | 2023 | last year | varekostnad | 1 740 688 kr | NULL | not read | reconciled |
| 915338534 | 2023 | last year | aarsresultat | 1 554 617 kr | NULL | not read | reconciled |
| 915338534 | 2023 | last year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 915338534 | 2023 | last year | varer | 0 kr | NULL | not read | reconciled |
| 927533235 | 2023 | this year | lonnskostnad | 1 448 646 kr | NULL | not read | reconciled |
| 927533235 | 2023 | this year | avskrivninger | 67 977 kr | NULL | not read | reconciled |
| 927533235 | 2023 | last year | avskrivninger | 40 981 kr | NULL | not read | reconciled |
| 929151178 | 2023 | this year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 929151178 | 2023 | last year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 911561972 | 2024 | this year | avskrivninger | 1 390 183 kr | NULL | not read | reconciled |
| 911561972 | 2024 | last year | avskrivninger | 1 216 410 kr | NULL | not read | reconciled |
| 919470992 | 2024 | this year | salgsinntekt | 1 030 166 kr | NULL | not read | reconciled |
| 936252710 | 2024 | this year | lonnskostnad | 11 978 000 kr | NULL | not read | reconciled |
| 936252710 | 2024 | this year | annen_driftskostnad | 3 804 886 kr | NULL | not read | reconciled |
| 936252710 | 2024 | this year | aarsresultat | 1 468 297 kr | NULL | not read | reconciled |
| 936252710 | 2024 | this year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 936252710 | 2024 | last year | lonnskostnad | 13 216 966 kr | NULL | not read | failed_reconciliation |
| 936252710 | 2024 | last year | sum_driftskostnad | 58 860 968 kr | 658 860 968 kr | misread | failed_reconciliation |
| 936252710 | 2024 | last year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | failed_reconciliation |
| 981564782 | 2024 | this year | salgsinntekt | 5 477 727 kr | NULL | not read | reconciled |
| 981564782 | 2024 | last year | aarsresultat | 11 558 582 kr | NULL | not read | reconciled |
| 981564782 | 2024 | last year | kundefordringer | 1 219 037 kr | NULL | not read | reconciled |
| 917526729 | 2025 | this year | salgsinntekt | 11 245 099 kr | NULL | not read | reconciled |
| 917526729 | 2025 | this year | kundefordringer | 864 869 kr | NULL | not read | reconciled |
| 917526729 | 2025 | last year | salgsinntekt | 11 015 493 kr | NULL | not read | reconciled |
| 917526729 | 2025 | last year | annen_driftskostnad | 1 677 195 kr | NULL | not read | reconciled |
| 917526729 | 2025 | last year | kundefordringer | 1 831 373 kr | NULL | not read | reconciled |
| 918618716 | 2025 | this year | salgsinntekt | 1 733 466 kr | NULL | not read | reconciled |
| 918618716 | 2025 | this year | avskrivninger | 64 200 kr | NULL | not read | reconciled |
| 918618716 | 2025 | last year | avskrivninger | 11 938 kr | NULL | not read | reconciled |
| 922184534 | 2025 | this year | salgsinntekt | 56 433 689 kr | NULL | not read | reconciled |
| 922184534 | 2025 | this year | avskrivninger | 59 405 139 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | lonnskostnad | 31 286 483 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | avskrivninger | 15 118 394 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | kundefordringer | 1 557 335 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | leverandorgjeld | 4 829 528 kr | NULL | not read | reconciled |
| 989081799 | 2025 | this year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | this year | sum_varige_driftsmidler | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | this year | bankinnskudd | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | last year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | last year | sum_varige_driftsmidler | 0 kr | NULL | not read | reconciled |

## Consistency re-measured on the spike's filings

The baseline is `analysis/output/ocr-consistency.md` (Tesseract 5, combined read, 2021–2025): 89 generated filings, 178 columns, 168 evaluable. That report states only "93 % of 168"; its failure table lists 11 failing 2021–2025 columns, so 157 pass. `epics.md` gave the baseline as 156, which matches 93 % of 168 (156,2) rounded down: a count read back from the rounded percentage rather than counted. The failure table gives 157, and 157 is used here.

Now: the same companies and years (from each company's `-aar.json`) read again by `read_document` in step 1's image, tesseract 5.5.0, checks within 5 kr. No figure is stored; the spike's old Tesseract output is not reused.

| | Filings | Columns | Evaluable | Passing | Passing / all | Passing / evaluable |
|---|---|---|---|---|---|---|
| Baseline (spike, Tesseract 5) | 89 | 178 | 168 | 157 | 88,2 % | 93,5 % |
| Now (`read_document`, Tesseract 5.5) | 89 | 178 | 165 | 162 | 91,0 % | 98,2 % |

Story 2.2's `column_status` (c1–c5, within the document only: these columns have no API filing at hand, so the API check is not evaluable): 162 of 178 columns reconciled (91,0 %).

### The differences, column by column

Each column is in exactly one line below, or among the passing columns that were not failing in the baseline. A column is evaluable when c1 and c3 both are; a failing check in a column that is not evaluable does not make it failing.

- Failing in the baseline, passing now (11): 874350672/2023, this year; 911586738/2021, this year; 933565831/2021, last year; 950308508/2022, this year; 950308508/2023, last year; 976570626/2022, this year; 976570626/2023, last year; 979775377/2021, this year; 979775377/2022, last year; 979775377/2024, last year; 987307749/2023, last year.
- Failing in the baseline and now (0): none.
- Failing in the baseline, not evaluable now (0): none.
- Failing now, not in the baseline's failure table (3): 987307749/2021, this year (fails c1); 987307749/2021, last year (fails c1); 996941566/2022, last year (fails c1).
- Not evaluable now, not in the baseline's failure table (13): 816202612/2025, last year (c1 not evaluable); 874350672/2025, this year (c1 not evaluable); 942896204/2023, this year (c1 not evaluable); 997003543/2021, this year (c3 and c5 not evaluable); 997003543/2021, last year (c3 and c5 not evaluable); 997003543/2022, this year (c3 and c5 not evaluable); 997003543/2022, last year (c3 and c5 not evaluable); 997003543/2023, this year (c3 and c5 not evaluable); 997003543/2023, last year (c3 and c5 not evaluable); 997003543/2024, this year (c3 and c5 not evaluable); 997003543/2024, last year (c3 and c5 not evaluable); 997003543/2025, this year (c3 and c5 not evaluable); 997003543/2025, last year (c3 and c5 not evaluable).
- Passing now, and not in the baseline's failure table: 151.

Why the 13 columns not evaluable now are not (the baseline report does not list its own non-evaluable columns, so the change cannot be traced column by column):

| Cause | Columns |
|---|---|
| no column | 0 |
| c1 not evaluable | 3 |
| missing total | 0 |
| c3 and c5 not evaluable | 10 |

"missing total" is c3 not evaluable while c5 is: sum eiendeler, sum egenkapital and sum gjeld were read, so the one figure missing is "Sum egenkapital og gjeld", the fault Story 2.3b takes up. "c1 not evaluable" is a missing income-statement figure; "c3 and c5 not evaluable" a missing sum eiendeler, or the total and another balance figure; "no column" a document that gave none.

## Before and after Story 2.3b

Story 2.3b reads the bold "SUM EGENKAPITAL OG GJELD" row, which Tesseract reads as "50M EGENKAPITAL OG GJELD", with a second label fold (`layout.fold_mixed`), and re-reads every stored document (`pnpm ingest --reread`). "Before" is Story 2.3's output, copied byte for byte into `analysis/output/ocr-sm2-before-2.3b/` before any re-read, and `analysis/output/document-run-counts-before-2.3b.json`; "after" is the committed seed, `analysis/output/ocr-consistency-2026.json` and `analysis/output/document-run-counts-after-2.3b.json`. Both are compared with the corrected transcriptions.

### "Sum egenkapital og gjeld" read

| Data set | Columns | Before | After |
|---|---|---|---|
| Reference set, every stored document (this year) | 97 | 49 of 97 (50,5 %) | 96 of 97 (99,0 %) |
| Reference set, every stored document (last year) | 97 | 47 of 97 (48,5 %) | 93 of 97 (95,9 %) |
| The spike's 89 filings, shown read (c3 or c4 evaluable) | 178 | 102 of 178 (57,3 %) | 178 of 178 (100,0 %) |
| The spike's filings, shown missing (c3 not evaluable, c5 evaluable) | 178 | 71 | 0 |
| Story 2.1b run, local data (this year) | 1946 | 1110 of 1946 (57,0 %) | 1930 of 1946 (99,2 %) |
| Story 2.1b run, local data (last year) | 1946 | 1094 of 1946 (56,2 %) | 1894 of 1946 (97,3 %) |

- **The Story 2.1b run is local data.** Its 1947 documents are in the local database and a gitignored dump, not in the seed, until Story 5.4's allow-list; its counts come from `pnpm analysis:document-run` and cannot be reproduced from a fresh clone. Reconciled current columns: 1801 before, 1834 after. Reader versions before: e09a413 1947; after: 2ce5a50 1947.
- **The spike's filings hold no figures here**, only check results, so "shown read" is a lower bound: a total read beside a missing sum eiendeler and a missing sum egenkapital or sum gjeld shows in neither c3 nor c4.

### The spike's filings: evaluable and passing

| | Columns | Evaluable | Passing | Passing / evaluable | Reconciled (c1–c5) |
|---|---|---|---|---|---|
| Before | 178 | 92 | 89 | 96,7 % | 157 |
| After | 178 | 165 | 162 | 98,2 % | 162 |

### The reference set, every class

| Group | correct | not read (transcribed 0) | not read (transcribed non-zero) | misread | phantom | Counted | Recovered exactly |
|---|---|---|---|---|---|---|---|
| Before | 646 | 42 | 79 | 2 | 0 | 769 | 84,0 % |
| After | 669 | 42 | 56 | 2 | 0 | 769 | 87,0 % |

Per field, before → after:

| Field | correct | not read | misread | phantom |
|---|---|---|---|---|
| salgsinntekt | 26 | 9 | 0 | 0 |
| sum_driftsinntekter | 35 | 2 | 0 | 0 |
| varekostnad | 28 | 2 | 0 | 0 |
| lonnskostnad | 31 | 5 | 0 | 0 |
| avskrivninger | 10 | 17 | 0 | 0 |
| nedskrivninger | 4 | 0 | 0 | 0 |
| annen_driftskostnad | 33 | 5 | 0 | 0 |
| sum_driftskostnad | 36 | 1 | 1 | 0 |
| driftsresultat | 36 | 2 | 0 | 0 |
| netto_finans | 36 | 2 | 0 | 0 |
| ordinaert_resultat_foer_skattekostnad | 37 | 3 | 0 | 0 |
| aarsresultat | 33 | 7 | 0 | 0 |
| sum_immaterielle_eiendeler | 13 | 10 | 0 | 0 |
| sum_varige_driftsmidler | 24 | 4 | 0 | 0 |
| varer | 9 | 2 | 0 | 0 |
| kundefordringer | 29 | 5 | 0 | 0 |
| bankinnskudd | 36 | 2 | 0 | 0 |
| sum_eiendeler | 37 → 38 | 3 → 2 | 0 | 0 |
| sum_egenkapital | 36 → 37 | 4 → 3 | 0 | 0 |
| leverandorgjeld | 30 | 6 | 0 | 0 |
| sum_kortsiktig_gjeld | 36 | 2 | 0 | 0 |
| sum_gjeld | 36 | 4 | 0 | 0 |
| sum_egenkapital_gjeld | 15 → 36 | 24 → 3 | 1 | 0 |

### Errors that reach the engine, before and after

More figures read must not be paid for with new errors. Misread and phantom figures in reconciled columns of the drawn filings:

| | Before | After |
|---|---|---|
| Misread, reaching the engine | 0 | 0 |
| Phantom, reaching the engine | 0 | 0 |

New ones (after, not before):

None.
