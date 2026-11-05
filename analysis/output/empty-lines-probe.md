# Why the cost lines come out empty (Story 2.5b probe)

Generated 2026-11-05 by `analysis/ocr/empty_lines.py`, read-only, in step 1's image (tesseract 5.5.0). Step 1's own recognition and row parsing; nothing written to the database; no fingerprint computed. Figures are whole kroner as the OCR words read them.

Documents: the OCR reference set's cells where the transcription holds a figure and the seed stores NULL, and a seeded draw (seed 20261105) of 20 2.1b documents with a reconciled current column and an empty `lonnskostnad`, every empty cost line in them.

## Causes

| Set | Field | refused | no_number | unmatched | read | document_refused |
|---|---|---|---|---|---|---|
| reference | varekostnad | 2 | 0 | 0 | 0 | 0 |
| reference | lonnskostnad | 5 | 0 | 0 | 0 | 0 |
| reference | avskrivninger | 0 | 0 | 17 | 0 | 0 |
| reference | annen_driftskostnad | 4 | 0 | 1 | 0 | 0 |
| reference | sum_immaterielle_eiendeler | 10 | 0 | 0 | 0 | 0 |
| 2.1b | varekostnad | 0 | 0 | 7 | 0 | 0 |
| 2.1b | lonnskostnad | 5 | 0 | 15 | 0 | 0 |
| 2.1b | avskrivninger | 0 | 0 | 17 | 0 | 0 |
| 2.1b | nedskrivninger | 0 | 0 | 20 | 0 | 0 |
| 2.1b | annen_driftskostnad | 0 | 0 | 6 | 0 | 0 |

## Refused figure tokens (Q3)

26 empty lines had a matching row whose plain-pass tokens `parse_number` refused. "Digits pass" is the digits-only pass's figure for the same row: a gate could admit it only when a sum check confirms it.

| Set | Orgnr | Year | Column | Field | Label (OCR) | Tokens (plain) | Digits pass | Transcribed |
|---|---|---|---|---|---|---|---|---|
| reference | 885583822 | 2022 | prior | varekostnad | Varekostnad | `l4 481 267` | 4 481 267 | 14 481 267 |
| reference | 912197905 | 2022 | prior | annen_driftskostnad | Annen driftskostnad 2 | `H5 260 438` | 5 260 438 | 5 260 438 |
| reference | 915338534 | 2023 | current | lonnskostnad | Lønnskostnad l, 2 | `8 605 8349` | 86 058 349 | 8 605 849 |
| reference | 915338534 | 2023 | current | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 915338534 | 2023 | prior | varekostnad | Varekostnad | `l 740 688` | 1 740 688 | 1 740 688 |
| reference | 915338534 | 2023 | prior | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 915648479 | 2021 | current | annen_driftskostnad | Annen driftskostnad | `l 621 328` | 1 621 328 | 1 621 328 |
| reference | 917526729 | 2025 | prior | annen_driftskostnad | Annen driftskostnad | `l 677 195` | 1 677 195 | 1 677 195 |
| reference | 922184534 | 2025 | prior | lonnskostnad | Lønnskostnad | `3l 285 483` | 31 285 483 | 31 286 483 |
| reference | 927533235 | 2023 | current | lonnskostnad | Lønnskostnad 2 | `l 448 546` | 1 448 546 | 1 448 646 |
| reference | 929151178 | 2023 | current | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 929151178 | 2023 | prior | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 929481151 | 2022 | current | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 929481151 | 2022 | prior | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 936252710 | 2024 | current | lonnskostnad | Lønnskostnad l, 2 | `ll 978 000` | 11 978 000 | 11 978 000 |
| reference | 936252710 | 2024 | current | annen_driftskostnad | Annen driftskostnad 4 | `3 804 3836` | 38 043 836 | 3 804 886 |
| reference | 936252710 | 2024 | current | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 936252710 | 2024 | prior | lonnskostnad | Lønnskostnad l, 2 | `l3 216 966` | 13 216 966 | 13 216 966 |
| reference | 936252710 | 2024 | prior | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 989081799 | 2025 | current | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| reference | 989081799 | 2025 | prior | sum_immaterielle_eiendeler | Sun immaterielle eiendeler | `Ö` | – | 0 |
| 2.1b | 911737671 | 2022 | current | lonnskostnad | Lønnskostnad 4 | `HB 953 633` | 953 633 | – |
| 2.1b | 912787281 | 2022 | current | lonnskostnad | Lønnskostnad l, 2 | `l2 521 273` | 12 521 273 | – |
| 2.1b | 922201080 | 2023 | current | lonnskostnad | Lønnskostnad 1 | `l 654 507` | 1 654 507 | – |
| 2.1b | 937199090 | 2021 | current | lonnskostnad | Lønnskostnad 3, 4 | `l0 118 908` | 10 118 908 | – |
| 2.1b | 985874581 | 2024 | current | lonnskostnad | Lønnskostnad l, 2 | `l 743 196` | 1 743 196 | – |

## Unmatched labels

The rows whose own folded label is closest to the target (ratio, label as read, plain figures).

| Set | Orgnr | Year | Column | Field | Nearest rows |
|---|---|---|---|---|---|
| reference | 885583822 | 2022 | current | avskrivninger | 0.56 "Immaterielle eiendeler" (– / –); 0.52 "Avskrivning på varige" (– / –); 0.51 "Sum varige driftsmidler" (287 102 / 229 202) |
| reference | 885583822 | 2022 | prior | avskrivninger | 0.56 "Immaterielle eiendeler" (– / –); 0.52 "Avskrivning på varige" (– / –); 0.51 "Sum varige driftsmidler" (287 102 / 229 202) |
| reference | 911561972 | 2024 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (19 689 267 / 21 056 735); 0.56 "immaterielle eiendeler" (1 390 183 / 1 216 410); 0.56 "Immaterielle eiendeler" (– / –) |
| reference | 911561972 | 2024 | prior | avskrivninger | 0.59 "Sun immaterielle eiendeler" (19 689 267 / 21 056 735); 0.56 "immaterielle eiendeler" (1 390 183 / 1 216 410); 0.56 "Immaterielle eiendeler" (– / –) |
| reference | 912197905 | 2022 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (1 395 536 / 1 491 210); 0.56 "immaterielle eiendeler 3" (109 500 / 182 118); 0.56 "immaterielle eiendeler 3" (– / –) |
| reference | 912197905 | 2022 | prior | avskrivninger | 0.59 "Sun immaterielle eiendeler" (1 395 536 / 1 491 210); 0.56 "immaterielle eiendeler 3" (109 500 / 182 118); 0.56 "immaterielle eiendeler 3" (– / –) |
| reference | 915648479 | 2021 | current | avskrivninger | 0.63 "Avskrivning av driftsmidler 2" (200 052 / 225 747); 0.59 "Sun immaterielle eiendeler 2" (333 000 / 476 437); 0.56 "Immaterielle eiendeler" (– / –) |
| reference | 915648479 | 2021 | prior | avskrivninger | 0.63 "Avskrivning av driftsmidler 2" (200 052 / 225 747); 0.59 "Sun immaterielle eiendeler 2" (333 000 / 476 437); 0.56 "Immaterielle eiendeler" (– / –) |
| reference | 918618716 | 2025 | current | avskrivninger | 0.56 "immaterielle eiendeler 2" (64 200 / 11 938); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (768 767 / 382 467) |
| reference | 918618716 | 2025 | prior | avskrivninger | 0.56 "immaterielle eiendeler 2" (64 200 / 11 938); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (768 767 / 382 467) |
| reference | 921716257 | 2021 | current | annen_driftskostnad | 0.84 "Andre driftskostnader" (95 575 / –); 0.61 "Finanskostnader" (1 364 / –); 0.58 "Datakostnader" (7 602 / –) |
| reference | 922184534 | 2025 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (97 042 461 / 131 784 163); 0.56 "immaterielle eiendeler 5" (59 405 139 / 15 118 394); 0.56 "immaterielle eiendeler 5" (– / –) |
| reference | 922184534 | 2025 | prior | avskrivninger | 0.59 "Sun immaterielle eiendeler" (97 042 461 / 131 784 163); 0.56 "immaterielle eiendeler 5" (59 405 139 / 15 118 394); 0.56 "immaterielle eiendeler 5" (– / –) |
| reference | 927533235 | 2023 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (154 127 / 198 899); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (38 685 / 42 614) |
| reference | 927533235 | 2023 | prior | avskrivninger | 0.59 "Sun immaterielle eiendeler" (154 127 / 198 899); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (38 685 / 42 614) |
| reference | 929821092 | 2022 | current | avskrivninger | 0.56 "immaterielle eiendeler 2" (4 628 / –); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler 2" (37 026 / –) |
| reference | 995318733 | 2021 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (910 924 / –); 0.56 "immaterielle eiendeler 5" (891 828 / 815 697); 0.56 "Immaterielle eiendeler" (– / –) |
| reference | 995318733 | 2021 | prior | avskrivninger | 0.59 "Sun immaterielle eiendeler" (910 924 / –); 0.56 "immaterielle eiendeler 5" (891 828 / 815 697); 0.56 "Immaterielle eiendeler" (– / –) |
| 2.1b | 911737671 | 2022 | current | avskrivninger | 0.56 "Immaterielle eiendeler" (– / –); 0.39 "Annen driftskostnad 4" (1 536 280 / 990 110); 0.37 "BALANSE - EIENDELER" (– / –) |
| 2.1b | 911737671 | 2022 | current | nedskrivninger | 0.55 "Immaterielle eiendeler" (– / –); 0.37 "BALANSE - EIENDELER" (– / –); 0.36 "Annen driftskostnad 4" (1 536 280 / 990 110) |
| 2.1b | 912787281 | 2022 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (29 523 / 29 953); 0.56 "immaterielle eiendeler" (7 096 / –); 0.56 "Immaterielle eiendeler" (– / –) |
| 2.1b | 912787281 | 2022 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (29 523 / 29 953); 0.55 "immaterielle eiendeler" (7 096 / –); 0.55 "Immaterielle eiendeler" (– / –) |
| 2.1b | 913425251 | 2023 | current | varekostnad | 0.75 "skattekostnad" (600 315 / 407 915); 0.75 "skattekostnad" (454 864 / 306 408); 0.71 "Annen rentekostnad" (282 / 388) |
| 2.1b | 913425251 | 2023 | current | lonnskostnad | 0.74 "finanskostnader" (– / –); 0.67 "Kostnader" (– / –); 0.67 "Sun kostnader 3" (15 013 689 / 10 109 690) |
| 2.1b | 913425251 | 2023 | current | avskrivninger | 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (952 473 / 52 273); 0.50 "Varige driftsmidler" (– / –) |
| 2.1b | 913425251 | 2023 | current | nedskrivninger | 0.55 "Immaterielle eiendeler" (– / –); 0.50 "Sum varige driftsmidler" (952 473 / 52 273); 0.49 "Varige driftsmidler" (– / –) |
| 2.1b | 913425251 | 2023 | current | annen_driftskostnad | 0.80 "Annen rentekostnad" (282 / 388); 0.61 "finanskostnader" (– / –); 0.56 "Driftsresultat" (602 717 / 414 806) |
| 2.1b | 914085837 | 2023 | current | varekostnad | 0.75 "skattekostnad" (7 295 353 / 12 044 654); 0.75 "skattekostnad" (5 616 512 / 9 385 474); 0.71 "Annen rentekostnad" (21 794 / 8 121) |
| 2.1b | 914085837 | 2023 | current | lonnskostnad | 0.92 "Lønnskostnader 3" (15 309 770 / –); 0.74 "finans kostnader" (– / –); 0.67 "Kostnader" (– / –) |
| 2.1b | 914085837 | 2023 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (90 399 / 80 360); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (71 380 / 154 679) |
| 2.1b | 914085837 | 2023 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (90 399 / 80 360); 0.55 "Immaterielle eiendeler" (– / –); 0.50 "Sum varige driftsmidler" (71 380 / 154 679) |
| 2.1b | 914085837 | 2023 | current | annen_driftskostnad | 0.84 "Andre driftskostnader" (3 625 900 / 3 297 237); 0.80 "Annen rentekostnad" (21 794 / 8 121); 0.78 "Annen finanskostnad" (623 686 / 346 592) |
| 2.1b | 914085837 | 2024 | current | varekostnad | 0.71 "Annen rentekostnad" (9 792 / 21 794); 0.70 "Kostnader" (– / –); 0.65 "Andre driftskostnader" (3 004 175 / 3 625 900) |
| 2.1b | 914085837 | 2024 | current | lonnskostnad | 0.92 "Lønnskostnader 3" (12 736 165 / 15 309 770); 0.74 "finans kostnader" (– / –); 0.67 "Kostnader" (– / –) |
| 2.1b | 914085837 | 2024 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (92 668 / 90 399); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (52 751 / 71 380) |
| 2.1b | 914085837 | 2024 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (92 668 / 90 399); 0.55 "Immaterielle eiendeler" (– / –); 0.50 "Sum varige driftsmidler" (52 751 / 71 380) |
| 2.1b | 914085837 | 2024 | current | annen_driftskostnad | 0.84 "Andre driftskostnader" (3 004 175 / 3 625 900); 0.80 "Annen rentekostnad" (9 792 / 21 794); 0.78 "Annen finanskostnad" (448 535 / 623 686) |
| 2.1b | 918543198 | 2023 | current | lonnskostnad | 0.92 "Lønnskostnad ll, 2, 3" (3 673 524 / 3 231 782); 0.74 "finans kostnader" (– / –); 0.67 "Kostnader" (– / –) |
| 2.1b | 918543198 | 2023 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (– / –); 0.55 "immaterielle eiendeler 4" (159 225 / 247 567); 0.55 "Immaterielle eiendeler" (– / –) |
| 2.1b | 921673310 | 2023 | current | lonnskostnad | 0.92 "Lønnskostnad ll, 2, 3" (17 724 818 / 13 633 603); 0.74 "finanskostnader" (– / –); 0.67 "Kostnader" (– / –) |
| 2.1b | 921673310 | 2023 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (51 219 / 49 077); 0.55 "immaterielle eiendeler 4" (112 448 / 121 342); 0.55 "Immaterielle eiendeler" (– / –) |
| 2.1b | 922201080 | 2023 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (13 034 603 / 7 767 631); 0.56 "immaterielle eiendeler 2" (– / 865 992); 0.56 "immaterielle eiendeler 2" (– / –) |
| 2.1b | 922201080 | 2023 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (13 034 603 / 7 767 631); 0.55 "immaterielle eiendeler 2" (– / 865 992); 0.55 "immaterielle eiendeler 2" (– / –) |
| 2.1b | 927901013 | 2022 | current | lonnskostnad | 0.74 "finans kostnader" (– / –); 0.67 "Kostnader" (– / –); 0.67 "Annen driftskostnad 3" (2 295 005 / –) |
| 2.1b | 927901013 | 2022 | current | avskrivninger | 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (1 825 782 / –); 0.50 "Varige driftsmidler" (– / –) |
| 2.1b | 927901013 | 2022 | current | nedskrivninger | 0.55 "Immaterielle eiendeler" (– / –); 0.50 "Sum varige driftsmidler" (1 825 782 / –); 0.49 "Varige driftsmidler" (– / –) |
| 2.1b | 928414116 | 2022 | current | lonnskostnad | 0.74 "finans kostnader" (– / –); 0.67 "Kostnader" (– / –); 0.67 "Annen driftskostnad" (1 164 433 / 5 570) |
| 2.1b | 928414116 | 2022 | current | avskrivninger | 0.56 "Immaterielle eiendeler" (– / –); 0.39 "Annen driftskostnad" (1 164 433 / 5 570); 0.37 "BALANSE - EIENDELER" (– / –) |
| 2.1b | 928414116 | 2022 | current | nedskrivninger | 0.55 "Immaterielle eiendeler" (– / –); 0.37 "BALANSE - EIENDELER" (– / –); 0.36 "Annen driftskostnad" (1 164 433 / 5 570) |
| 2.1b | 929286022 | 2022 | current | varekostnad | 0.75 "skattekostnad" (-2 629 272 / –); 0.75 "skattekostnad" (-2 629 272 / –); 0.70 "Kostnader" (– / –) |
| 2.1b | 929286022 | 2022 | current | lonnskostnad | 0.92 "Lønnskostnad ll, 2, 3" (2 490 911 / –); 0.67 "Kostnader" (– / –); 0.67 "Annen driftskostnad" (528 172 / –) |
| 2.1b | 929286022 | 2022 | current | avskrivninger | 0.56 "immaterielle eiendeler 4" (22 627 / –); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (178 672 / –) |
| 2.1b | 929286022 | 2022 | current | nedskrivninger | 0.55 "immaterielle eiendeler 4" (22 627 / –); 0.55 "Immaterielle eiendeler" (– / –); 0.50 "Sum varige driftsmidler" (178 672 / –) |
| 2.1b | 931695630 | 2023 | current | lonnskostnad | 0.74 "finans kostnader" (– / –); 0.67 "Kostnader" (– / –); 0.67 "Annen driftskostnad" (208 597 / 0) |
| 2.1b | 931695630 | 2023 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (– / –); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (– / –) |
| 2.1b | 931695630 | 2023 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (– / –); 0.55 "Immaterielle eiendeler" (– / –); 0.50 "Sum varige driftsmidler" (– / –) |
| 2.1b | 937199090 | 2021 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (17 354 / 31 023); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (1 017 343 / 1 130 825) |
| 2.1b | 937199090 | 2021 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (17 354 / 31 023); 0.55 "Immaterielle eiendeler" (– / –); 0.50 "Sum varige driftsmidler" (1 017 343 / 1 130 825) |
| 2.1b | 983594123 | 2023 | current | varekostnad | 0.75 "skattekostnad" (-44 241 684 / -28 438 805); 0.75 "skattekostnad" (-44 241 684 / -28 438 805); 0.71 "Annen rentekostnad" (398 233 / 214 596) |
| 2.1b | 983594123 | 2023 | current | lonnskostnad | 0.74 "finanskostnader" (– / –); 0.67 "Kostnader" (– / –); 0.67 "Sun kostnader" (80 345 336 / 66 454 534) |
| 2.1b | 983594123 | 2023 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (30 563 791 / 25 265 952); 0.56 "immaterielle eiendeler 4" (– / –); 0.56 "Immaterielle eiendeler" (– / –) |
| 2.1b | 983594123 | 2023 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (30 563 791 / 25 265 952); 0.55 "immaterielle eiendeler 4" (– / –); 0.55 "Immaterielle eiendeler" (– / –) |
| 2.1b | 983594123 | 2023 | current | annen_driftskostnad | 0.80 "Annen rentekostnad" (398 233 / 214 596); 0.61 "finanskostnader" (– / –); 0.56 "Driftsresultat" (-47 514 219 / -29 898 848) |
| 2.1b | 983594123 | 2024 | current | varekostnad | 0.71 "Annen rentekostnad" (383 259 / 398 233); 0.70 "Kostnader" (– / –); 0.62 "finanskostnader" (– / –) |
| 2.1b | 983594123 | 2024 | current | lonnskostnad | 0.74 "finanskostnader" (– / –); 0.67 "Kostnader" (– / –); 0.67 "Sun kostnader" (99 360 371 / 80 345 336) |
| 2.1b | 983594123 | 2024 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (34 244 757 / 30 563 791); 0.56 "immaterielle eiendeler 4" (– / –); 0.56 "Immaterielle eiendeler" (– / –) |
| 2.1b | 983594123 | 2024 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (34 244 757 / 30 563 791); 0.55 "immaterielle eiendeler 4" (– / –); 0.55 "Immaterielle eiendeler" (– / –) |
| 2.1b | 983594123 | 2024 | current | annen_driftskostnad | 0.80 "Annen rentekostnad" (383 259 / 398 233); 0.61 "finanskostnader" (– / –); 0.56 "Driftsresultat" (-59 948 108 / -47 514 219) |
| 2.1b | 985874581 | 2024 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (– / –); 0.56 "Immaterielle eiendeler" (– / –); 0.51 "Sum varige driftsmidler" (– / –) |
| 2.1b | 985874581 | 2024 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (– / –); 0.55 "Immaterielle eiendeler" (– / –); 0.50 "Sum varige driftsmidler" (– / –) |
| 2.1b | 986051155 | 2025 | current | lonnskostnad | 0.92 "Lønnskostnad ll, 2, 3" (9 929 981 / –); 0.74 "finanskostnader" (– / –); 0.67 "Kostnader" (– / –) |
| 2.1b | 986051155 | 2025 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (2 500 481 / 1 039 117); 0.55 "immaterielle eiendeler 4" (594 570 / 361 801); 0.55 "Immaterielle eiendeler" (– / –) |
| 2.1b | 992097000 | 2023 | current | varekostnad | 0.75 "skattekostnad" (3 649 157 / 2 980 380); 0.75 "skattekostnad" (2 846 342 / 2 324 696); 0.70 "Kostnader" (– / –) |
| 2.1b | 992097000 | 2023 | current | lonnskostnad | 0.92 "Lønnskostnader 1" (19 024 235 / 15 742 897); 0.74 "finans kostnader" (– / –); 0.67 "Kostnader" (– / –) |
| 2.1b | 992097000 | 2023 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (2 592 / 6 708); 0.56 "Immaterielle eiendeler" (– / –); 0.43 "Andre driftskostnader" (6 276 939 / 5 660 657) |
| 2.1b | 992097000 | 2023 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (2 592 / 6 708); 0.55 "Immaterielle eiendeler" (– / –); 0.40 "Andre driftskostnader" (6 276 939 / 5 660 657) |
| 2.1b | 992097000 | 2023 | current | annen_driftskostnad | 0.84 "Andre driftskostnader" (6 276 939 / 5 660 657); 0.68 "Andre finanskostnader" (– / 3 041); 0.62 "Lønnskostnader 1" (19 024 235 / 15 742 897) |
| 2.1b | 994176021 | 2021 | current | lonnskostnad | 1.00 "Lønnskostnad 2" (– / –); 0.74 "finanskostnader" (– / –); 0.67 "Kostnader" (– / –) |
| 2.1b | 994176021 | 2021 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (8 417 065 / 7 985 960); 0.56 "immaterielle eiendeler 3" (– / –); 0.56 "Immaterielle eiendeler" (– / –) |
| 2.1b | 994176021 | 2021 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (8 417 065 / 7 985 960); 0.55 "immaterielle eiendeler 3" (– / –); 0.55 "Immaterielle eiendeler" (– / –) |
| 2.1b | 997780973 | 2023 | current | lonnskostnad | 0.74 "finanskostnader" (– / –); 0.67 "Kostnader" (– / –); 0.67 "Annen driftskostnad 3" (841 774 / 158 956) |
| 2.1b | 997780973 | 2023 | current | avskrivninger | 0.59 "Sun immaterielle eiendeler" (17 041 / 20 911); 0.56 "immaterielle eiendeler 2" (4 100 / 4 100); 0.56 "Immaterielle eiendeler" (– / –) |
| 2.1b | 997780973 | 2023 | current | nedskrivninger | 0.58 "Sun immaterielle eiendeler" (17 041 / 20 911); 0.55 "immaterielle eiendeler 2" (4 100 / 4 100); 0.55 "Immaterielle eiendeler" (– / –) |

## Other causes

| Set | Orgnr | Year | Column | Field | Cause | Label (OCR) | Tokens |
|---|---|---|---|---|---|---|---|

## Labels of the intangible parts

Every balance row whose folded label names a part, as Tesseract reads it.

| Orgnr | Year | Label (OCR) | Folded | Plain this year / last year | Tokens |
|---|---|---|---|---|---|
| 911561972 | 2024 | Konsesjoner, patenter o.l1. | `konsesjonerpatenterol` | 19 636 331 / 21 026 514 | `19 636 331` / `21 026 514` |
| 911561972 | 2024 | Utsatt skattefordel 2 | `utsattskattefordel` | 52 936 / 30 221 | `52 936` / `30 221` |
| 912197905 | 2022 | Utsatt skattefordel å | `utsattskattefordela` | 1 395 536 / – | `1 395 536` / `l 411 210` |
| 915648479 | 2021 | Forskning og utvikling | `forskningogutvikling` | 333 000 / 476 437 | `333 000` / `476 437` |
| 917526729 | 2025 | Utsatt skattefordel 2 | `utsattskattefordel` | – / – | `` / `` |
| 918618716 | 2025 | Utsatt skattefordel 4 | `utsattskattefordel` | – / – | `` / `` |
| 922184534 | 2025 | Konsesjoner, patenter o.l1. | `konsesjonerpatenterol` | – / 28 949 094 | `l1 790 539` / `28 949 094` |
| 927533235 | 2023 | Konsesjoner, patenter, | `konsesjonerpatenter` | – / – | `` / `` |
| 929151178 | 2023 | Konsesjoner, patenter, | `konsesjonerpatenter` | – / – | `` / `` |
| 929151178 | 2023 | Goodwill 3 | `goodwill` | 0 / 0 | `0` / `0` |
| 929481151 | 2022 | Forskning og utvikling | `forskningogutvikling` | 0 / 0 | `0` / `0` |
| 929481151 | 2022 | Konsesjoner, patenter, | `konsesjonerpatenter` | – / – | `` / `` |
| 929481151 | 2022 | Utsatt skattefordel | `utsattskattefordel` | 0 / 0 | `0` / `0` |
| 929481151 | 2022 | Goodwill | `goodwill` | 0 / 0 | `0` / `0` |
| 981564782 | 2024 | Utsatt skattefordel 3 | `utsattskattefordel` | – / – | `` / `` |
| 992036079 | 2023 | Utsatt skattefordel 8 | `utsattskattefordel` | 928 686 / 2 751 068 | `928 686` / `2 751 068` |
| 992036079 | 2023 | Goodwill 10 | `goodwill` | 233 580 / 295 867 | `233 580` / `295 867` |
| 995318733 | 2021 | Utsatt skattefordel 4 | `utsattskattefordel` | 335 452 / – | `335 452` / `` |
| 912787281 | 2022 | Utsatt skattefordel 4 | `utsattskattefordel` | 29 523 / 29 953 | `29 523` / `29 953` |
| 914085837 | 2023 | Utsatt skattefordel 6 | `utsattskattefordel` | 90 399 / 80 360 | `90 399` / `80 360` |
| 914085837 | 2024 | Utsatt skattefordel 6 | `utsattskattefordel` | 92 668 / 90 399 | `92 668` / `90 399` |
| 921673310 | 2023 | Konsesjoner, patenter, | `konsesjonerpatenter` | – / – | `` / `` |
| 921673310 | 2023 | Utsatt skattefordel 6, 7 | `utsattskattefordel` | – / 49 077 | `5l 219` / `49 077` |
| 922201080 | 2023 | Konsesjoner, patenter o.l1. 2 | `konsesjonerpatenterol` | – / – | `` / `` |
| 922201080 | 2023 | Utsatt skattefordel 3 | `utsattskattefordel` | – / – | `` / `` |
| 922201080 | 2023 | Goodwill 2 | `goodwill` | – / – | `` / `` |
| 937199090 | 2021 | Utsatt skattefordel 7 | `utsattskattefordel` | 17 354 / 31 023 | `17 354` / `31 023` |
| 983594123 | 2023 | Concessions, patents and | `concessionspatentsand` | – / – | `` / `` |
| 983594123 | 2023 | Utsatt skattefordel 6 | `utsattskattefordel` | – / – | `` / `` |
| 983594123 | 2024 | Concessions, patents and | `concessionspatentsand` | – / – | `` / `` |
| 983594123 | 2024 | Utsatt skattefordel 6 | `utsattskattefordel` | – / – | `` / `` |
| 986051155 | 2025 | Konsesjoner, patenter, | `konsesjonerpatenter` | – / – | `` / `` |
| 986051155 | 2025 | Utsatt skattefordel 5, 6 | `utsattskattefordel` | 76 336 / – | `76 336` / `O` |
| 992097000 | 2023 | Utsatt skattefordel 2 | `utsattskattefordel` | 2 592 / 6 708 | `2 592` / `6 708` |
| 994176021 | 2021 | Utsatt skattefordel 8 | `utsattskattefordel` | 160 161 / 16 325 | `160 161` / `16 325` |
| 997780973 | 2023 | Utsatt skattefordel | `utsattskattefordel` | 358 / 128 | `358` / `128` |
| 997780973 | 2023 | Goodwill 2 | `goodwill` | 16 683 / 20 783 | `16 683` / `20 783` |
