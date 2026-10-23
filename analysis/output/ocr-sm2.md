# OCR accuracy against the hand-transcribed reference set (SM-2)

Generated 2026-10-23 by `scripts/ocr-sm2.ts` (`pnpm analysis:sm2`), with helpers in `scripts/ocr-sm2-compare.ts`. Inputs, all committed: `analysis/ocr-reference/drawn.json` and `analysis/ocr-reference/transcriptions.csv` (the reference set, issue #14); `seed/demo/document.csv` and `seed/demo/document_column.csv` (step 1's output, written by `pnpm ingest --documents analysis/ocr-reference/document-run.json` and committed by `pnpm seed:export`); `analysis/output/ocr-consistency-2026.json` (generated 2026-10-23 by `analysis/ocr/consistency.py` in step 1's image, tesseract 5.5.0).

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

| Group | Filings | Misread figures in reconciled columns |
|---|---|---|
| Recent (2023–2025) | 12 | 3 |
| Older (2021–2022) | 8 | 3 |
| All | 20 | 6 |

| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |
|---|---|---|---|---|---|---|---|
| 995318733 | 2021 | this year | kundefordringer | 444 745 213 kr | 44 745 213 kr | misread | reconciled |
| 995318733 | 2021 | this year | sum_eiendeler | 86 913 592 kr | 86 913 593 kr | misread | reconciled |
| 995318733 | 2021 | last year | sum_kortsiktig_gjeld | 19 339 152 kr | 37 849 846 kr | misread | reconciled |
| 917526729 | 2025 | this year | sum_kortsiktig_gjeld | 3 398 859 kr | 5 619 383 kr | misread | reconciled |
| 917526729 | 2025 | last year | sum_kortsiktig_gjeld | 3 224 133 kr | 5 233 612 kr | misread | reconciled |
| 922184534 | 2025 | this year | bankinnskudd | 429 329 kr | 9 429 329 kr | misread | reconciled |

## Every compared field, by class

- **correct**: both hold the same figure;
- **not read**: OCR is NULL and the transcription holds a figure;
- **misread**: both hold a figure, and they differ;
- **phantom**: OCR holds a figure and the transcription is blank.

A field neither holds is not a figure and is not counted. "Recovered exactly" is correct over counted.

| Group | correct | not read | misread | phantom | Counted | Recovered exactly |
|---|---|---|---|---|---|---|
| Recent (2023–2025) | 411 | 61 | 4 | 0 | 476 | 86,3 % |
| Older (2021–2022) | 228 | 60 | 5 | 0 | 293 | 77,8 % |
| All | 639 | 121 | 9 | 0 | 769 | 83,1 % |

## Consistency of the reference filings

Two definitions, never mixed. **Passing** is the spike baseline's: a column is evaluable when c1 (income statement) and c3 (balance) both are, and passes when it is evaluable and no check among c1–c4 fails (5 kr bound). **Reconciled** is Story 2.2's `column_status` (c1–c5 and, for this year's column, the API comparison). A filing is reconciled when its current column is.

| Group | Filings | Columns | Evaluable | Passing | Passing / all | Passing / evaluable | Columns reconciled | Filings reconciled |
|---|---|---|---|---|---|---|---|---|
| Recent (2023–2025) | 12 | 24 | 8 | 7 | 29,2 % | 87,5 % | 22 of 24 | 11 of 12 |
| Older (2021–2022) | 8 | 16 | 5 | 5 | 31,3 % | 100,0 % | 8 of 16 | 5 of 8 |
| All | 20 | 40 | 13 | 12 | 30,0 % | 92,3 % | 30 of 40 | 16 of 20 |

## Every mismatch

130 fields are not correct. Expected is the transcription, read is step 1's stored figure, both in whole kroner.

| Orgnr | Year | Column | Field | Expected | Read | Class | Column status |
|---|---|---|---|---|---|---|---|
| 915648479 | 2021 | this year | avskrivninger | 200 052 kr | NULL | not read | reconciled |
| 915648479 | 2021 | this year | annen_driftskostnad | 1 621 328 kr | NULL | not read | reconciled |
| 915648479 | 2021 | this year | aarsresultat | 1 501 123 kr | NULL | not read | reconciled |
| 915648479 | 2021 | this year | sum_egenkapital_gjeld | 4 101 424 kr | NULL | not read | reconciled |
| 915648479 | 2021 | last year | salgsinntekt | 3 659 013 kr | 3 657 114 kr | misread | failed_reconciliation |
| 915648479 | 2021 | last year | avskrivninger | 225 747 kr | NULL | not read | failed_reconciliation |
| 915648479 | 2021 | last year | bankinnskudd | 1 366 565 kr | NULL | not read | failed_reconciliation |
| 915648479 | 2021 | last year | sum_egenkapital | 1 027 301 kr | NULL | not read | failed_reconciliation |
| 915648479 | 2021 | last year | sum_egenkapital_gjeld | 2 577 783 kr | NULL | not read | failed_reconciliation |
| 917397198 | 2021 | this year | salgsinntekt | 5 661 887 kr | NULL | not read | reconciled |
| 921716257 | 2021 | this year | annen_driftskostnad | 95 575 kr | NULL | not read | reconciled |
| 921716257 | 2021 | this year | kundefordringer | 132 559 kr | NULL | not read | reconciled |
| 921716257 | 2021 | this year | leverandorgjeld | 87 800 kr | NULL | not read | reconciled |
| 921716257 | 2021 | last year | ordinaert_resultat_foer_skattekostnad | 0 kr | NULL | not read | failed_reconciliation |
| 921716257 | 2021 | last year | aarsresultat | 0 kr | NULL | not read | failed_reconciliation |
| 921716257 | 2021 | last year | sum_egenkapital | 0 kr | NULL | not read | failed_reconciliation |
| 921716257 | 2021 | last year | sum_gjeld | 0 kr | NULL | not read | failed_reconciliation |
| 995318733 | 2021 | this year | avskrivninger | 891 828 kr | NULL | not read | reconciled |
| 995318733 | 2021 | this year | kundefordringer | 444 745 213 kr | 44 745 213 kr | misread | reconciled |
| 995318733 | 2021 | this year | sum_eiendeler | 86 913 592 kr | 86 913 593 kr | misread | reconciled |
| 995318733 | 2021 | this year | sum_egenkapital_gjeld | 86 913 593 kr | NULL | not read | reconciled |
| 995318733 | 2021 | last year | avskrivninger | 815 697 kr | NULL | not read | reconciled |
| 995318733 | 2021 | last year | sum_kortsiktig_gjeld | 19 339 152 kr | 37 849 846 kr | misread | reconciled |
| 995318733 | 2021 | last year | sum_egenkapital_gjeld | 73 729 645 kr | NULL | not read | reconciled |
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
| 929821092 | 2022 | this year | sum_egenkapital_gjeld | 605 550 kr | NULL | not read | failed_reconciliation |
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
| 927533235 | 2023 | this year | sum_egenkapital_gjeld | 1 427 357 kr | NULL | not read | reconciled |
| 927533235 | 2023 | last year | avskrivninger | 40 981 kr | NULL | not read | reconciled |
| 927533235 | 2023 | last year | sum_egenkapital_gjeld | 944 098 kr | NULL | not read | reconciled |
| 929151178 | 2023 | this year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 929151178 | 2023 | this year | sum_egenkapital_gjeld | 1 510 453 kr | NULL | not read | reconciled |
| 929151178 | 2023 | last year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 929151178 | 2023 | last year | sum_egenkapital_gjeld | 827 616 kr | NULL | not read | reconciled |
| 992036079 | 2023 | this year | sum_egenkapital_gjeld | 175 826 882 kr | NULL | not read | reconciled |
| 992036079 | 2023 | last year | sum_egenkapital_gjeld | 211 351 517 kr | NULL | not read | reconciled |
| 911561972 | 2024 | this year | avskrivninger | 1 390 183 kr | NULL | not read | failed_reconciliation |
| 911561972 | 2024 | this year | sum_eiendeler | 51 096 403 kr | NULL | not read | failed_reconciliation |
| 911561972 | 2024 | this year | sum_egenkapital_gjeld | 51 096 403 kr | NULL | not read | failed_reconciliation |
| 911561972 | 2024 | last year | avskrivninger | 1 216 410 kr | NULL | not read | reconciled |
| 911561972 | 2024 | last year | sum_egenkapital_gjeld | 57 390 695 kr | NULL | not read | reconciled |
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
| 917526729 | 2025 | this year | sum_kortsiktig_gjeld | 3 398 859 kr | 5 619 383 kr | misread | reconciled |
| 917526729 | 2025 | this year | sum_egenkapital_gjeld | 14 021 777 kr | NULL | not read | reconciled |
| 917526729 | 2025 | last year | salgsinntekt | 11 015 493 kr | NULL | not read | reconciled |
| 917526729 | 2025 | last year | annen_driftskostnad | 1 677 195 kr | NULL | not read | reconciled |
| 917526729 | 2025 | last year | kundefordringer | 1 831 373 kr | NULL | not read | reconciled |
| 917526729 | 2025 | last year | sum_kortsiktig_gjeld | 3 224 133 kr | 5 233 612 kr | misread | reconciled |
| 917526729 | 2025 | last year | sum_egenkapital_gjeld | 11 642 511 kr | NULL | not read | reconciled |
| 918618716 | 2025 | this year | salgsinntekt | 1 733 466 kr | NULL | not read | reconciled |
| 918618716 | 2025 | this year | avskrivninger | 64 200 kr | NULL | not read | reconciled |
| 918618716 | 2025 | this year | sum_egenkapital_gjeld | 11 259 726 kr | NULL | not read | reconciled |
| 918618716 | 2025 | last year | avskrivninger | 11 938 kr | NULL | not read | reconciled |
| 918618716 | 2025 | last year | sum_egenkapital_gjeld | 10 406 314 kr | NULL | not read | reconciled |
| 922184534 | 2025 | this year | salgsinntekt | 56 433 689 kr | NULL | not read | reconciled |
| 922184534 | 2025 | this year | avskrivninger | 59 405 139 kr | NULL | not read | reconciled |
| 922184534 | 2025 | this year | bankinnskudd | 429 329 kr | 9 429 329 kr | misread | reconciled |
| 922184534 | 2025 | this year | sum_egenkapital_gjeld | 195 262 950 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | lonnskostnad | 31 286 483 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | avskrivninger | 15 118 394 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | kundefordringer | 1 557 335 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | leverandorgjeld | 4 829 528 kr | NULL | not read | reconciled |
| 922184534 | 2025 | last year | sum_egenkapital_gjeld | 213 300 967 kr | NULL | not read | reconciled |
| 989081799 | 2025 | this year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | this year | sum_varige_driftsmidler | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | this year | bankinnskudd | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | this year | sum_egenkapital_gjeld | 1 398 134 kr | NULL | not read | reconciled |
| 989081799 | 2025 | last year | sum_immaterielle_eiendeler | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | last year | sum_varige_driftsmidler | 0 kr | NULL | not read | reconciled |
| 989081799 | 2025 | last year | sum_egenkapital_gjeld | 1 517 815 kr | NULL | not read | reconciled |

## Consistency re-measured on the spike's filings

The baseline is `analysis/output/ocr-consistency.md` (Tesseract 5, combined read, 2021–2025): 89 generated filings, 178 columns, 168 evaluable. That report states only "93 % of 168"; its failure table lists 11 failing 2021–2025 columns, so 157 pass. `epics.md` gave the baseline as 156, which matches 93 % of 168 (156,2) rounded down: a count read back from the rounded percentage rather than counted. The failure table gives 157, and 157 is used here.

Now: the same companies and years (from each company's `-aar.json`) read again by `read_document` in step 1's image, tesseract 5.5.0, checks within 5 kr. No figure is stored; the spike's old Tesseract output is not reused.

| | Filings | Columns | Evaluable | Passing | Passing / all | Passing / evaluable |
|---|---|---|---|---|---|---|
| Baseline (spike, Tesseract 5) | 89 | 178 | 168 | 157 | 88,2 % | 93,5 % |
| Now (`read_document`, Tesseract 5.5) | 89 | 178 | 92 | 89 | 50,0 % | 96,7 % |

Story 2.2's `column_status` (c1–c5, within the document only: these columns have no API filing at hand, so the API check is not evaluable): 157 of 178 columns reconciled (88,2 %).

### The differences, column by column

- Failing in the baseline, passing now (6): 911586738/2021, this year; 933565831/2021, last year; 950308508/2022, this year; 950308508/2023, last year; 979775377/2021, this year; 987307749/2023, last year.
- Failing in the baseline and now (0): none.
- Failing in the baseline, not evaluable now (5): 874350672/2023, this year; 976570626/2022, this year; 976570626/2023, last year; 979775377/2022, last year; 979775377/2024, last year.
- Failing now, not in the baseline's failure table (3): 987307749/2021, this year; 987307749/2021, last year; 996941566/2022, last year.
- Not evaluable now (86): 816202612/2021, this year (c1 pass, c3 not_evaluable); 816202612/2021, last year (c1 pass, c3 not_evaluable); 816202612/2025, this year (c1 pass, c3 not_evaluable); 816202612/2025, last year (c1 not_evaluable, c3 not_evaluable); 834095742/2022, this year (c1 pass, c3 not_evaluable); 834095742/2022, last year (c1 pass, c3 not_evaluable); 834095742/2025, this year (c1 pass, c3 not_evaluable); 834095742/2025, last year (c1 pass, c3 not_evaluable); 874350672/2022, this year (c1 pass, c3 not_evaluable); 874350672/2022, last year (c1 pass, c3 not_evaluable); 874350672/2023, this year (c1 pass, c3 not_evaluable); 874350672/2023, last year (c1 pass, c3 not_evaluable); 874350672/2025, this year (c1 not_evaluable, c3 not_evaluable); 874350672/2025, last year (c1 pass, c3 not_evaluable); 911586738/2025, this year (c1 pass, c3 not_evaluable); 911586738/2025, last year (c1 pass, c3 not_evaluable); 916605617/2023, this year (c1 pass, c3 not_evaluable); 916605617/2023, last year (c1 pass, c3 not_evaluable); 916605617/2024, this year (c1 pass, c3 not_evaluable); 916605617/2024, last year (c1 pass, c3 not_evaluable); 931924672/2021, this year (c1 pass, c3 not_evaluable); 931924672/2021, last year (c1 pass, c3 not_evaluable); 931924672/2022, this year (c1 pass, c3 not_evaluable); 931924672/2022, last year (c1 pass, c3 not_evaluable); 931924672/2023, this year (c1 pass, c3 not_evaluable); 931924672/2023, last year (c1 pass, c3 not_evaluable); 931924672/2024, this year (c1 pass, c3 not_evaluable); 931924672/2024, last year (c1 pass, c3 not_evaluable); 931924672/2025, this year (c1 pass, c3 not_evaluable); 931924672/2025, last year (c1 pass, c3 not_evaluable); 942896204/2023, this year (c1 not_evaluable, c3 not_evaluable); 942896204/2023, last year (c1 pass, c3 not_evaluable); 942896204/2025, this year (c1 pass, c3 not_evaluable); 942896204/2025, last year (c1 pass, c3 not_evaluable); 950308508/2024, this year (c1 pass, c3 not_evaluable); 950308508/2024, last year (c1 pass, c3 not_evaluable); 950308508/2025, this year (c1 pass, c3 not_evaluable); 950308508/2025, last year (c1 pass, c3 not_evaluable); 976570626/2022, this year (c1 pass, c3 not_evaluable); 976570626/2022, last year (c1 pass, c3 not_evaluable); 976570626/2023, this year (c1 pass, c3 not_evaluable); 976570626/2023, last year (c1 pass, c3 not_evaluable); 979775377/2022, this year (c1 pass, c3 not_evaluable); 979775377/2022, last year (c1 pass, c3 not_evaluable); 979775377/2023, this year (c1 pass, c3 not_evaluable); 979775377/2023, last year (c1 pass, c3 not_evaluable); 979775377/2024, this year (c1 pass, c3 not_evaluable); 979775377/2024, last year (c1 pass, c3 not_evaluable); 979775377/2025, this year (c1 pass, c3 not_evaluable); 979775377/2025, last year (c1 pass, c3 not_evaluable); 980015033/2021, this year (c1 pass, c3 not_evaluable); 980015033/2021, last year (c1 pass, c3 not_evaluable); 980015033/2022, this year (c1 pass, c3 not_evaluable); 980015033/2022, last year (c1 pass, c3 not_evaluable); 980015033/2023, this year (c1 pass, c3 not_evaluable); 980015033/2023, last year (c1 pass, c3 not_evaluable); 980015033/2024, this year (c1 pass, c3 not_evaluable); 980015033/2024, last year (c1 pass, c3 not_evaluable); 980015033/2025, this year (c1 pass, c3 not_evaluable); 980015033/2025, last year (c1 pass, c3 not_evaluable); 987307749/2025, this year (c1 pass, c3 not_evaluable); 987307749/2025, last year (c1 pass, c3 not_evaluable); 991051228/2023, this year (c1 pass, c3 not_evaluable); 991051228/2023, last year (c1 pass, c3 not_evaluable); 991051228/2025, this year (c1 pass, c3 not_evaluable); 991051228/2025, last year (c1 pass, c3 not_evaluable); 996941566/2023, this year (c1 pass, c3 not_evaluable); 996941566/2023, last year (c1 pass, c3 not_evaluable); 996941566/2024, this year (c1 pass, c3 not_evaluable); 996941566/2024, last year (c1 pass, c3 not_evaluable); 996941566/2025, this year (c1 pass, c3 not_evaluable); 996941566/2025, last year (c1 pass, c3 not_evaluable); 997003543/2021, this year (c1 pass, c3 not_evaluable); 997003543/2021, last year (c1 pass, c3 not_evaluable); 997003543/2022, this year (c1 pass, c3 not_evaluable); 997003543/2022, last year (c1 pass, c3 not_evaluable); 997003543/2023, this year (c1 pass, c3 not_evaluable); 997003543/2023, last year (c1 pass, c3 not_evaluable); 997003543/2024, this year (c1 pass, c3 not_evaluable); 997003543/2024, last year (c1 pass, c3 not_evaluable); 997003543/2025, this year (c1 pass, c3 not_evaluable); 997003543/2025, last year (c1 pass, c3 not_evaluable); 997746848/2021, this year (c1 pass, c3 not_evaluable); 997746848/2021, last year (c1 pass, c3 not_evaluable); 997746848/2022, this year (c1 pass, c3 not_evaluable); 997746848/2022, last year (c1 pass, c3 not_evaluable).

The baseline report does not list its non-evaluable columns, so a change in the evaluable count cannot be traced column by column; the list above is every column not evaluable now. Of those, 71 have c3 not evaluable while c5 is evaluable: sum eiendeler was read, so the figure missing is "Sum egenkapital og gjeld", the fault Story 2.3b takes up.
