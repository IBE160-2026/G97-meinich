# Cost lines that do not sum, and narrow digit tokens (Story 2.5c probe)

Generated 2026-11-06 by `analysis/ocr/cost_sum.py`, read-only, in step 1's image (tesseract 5.5.0). Step 1's own recognition, row parsing and combined read; nothing written to the database; no fingerprint or business type computed. Figures are whole kroner.

Documents: the OCR reference set (20); the 48 reconciled 2.1b columns, in 44 documents, whose new `avskrivninger` and the other three main cost lines are read and miss `sum_driftskostnad` by more than 5 kr; and a seeded draw (seed 20261106) of 100 of the other 1722 2.1b documents; and the 200 reconciled 2.1b columns where an unguarded line exceeds a total it is part of (180 further documents).

Sanity: the probe's read equals the stored figures in 688 of 688 columns.

## (a) Columns off their total, by cause

| Side | Role | Cause | Columns |
|---|---|---|---|
| over | current | unexplained | 11 |
| over | current | unmatched_cost_row | 1 |
| over | prior | unexplained | 14 |
| over | prior | unmatched_cost_row | 1 |
| under | current | unexplained | 17 |
| under | prior | unexplained | 4 |

### Evidence, column by column

Each column's cost block as read (label as OCR read it; plain / digits-pass figure in the column; the field the read gave the row).

- **815244672 2023 current**, over by 12 650 783 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Endring i beholdning av` → —: – / – ``
  - `varer under tilvirkning` → —: – / – ``
  - `og ferdig tilvirkede varer` → varer: -12 650 783 / -12 650 783 `-12 650 783`
  - `Varekostnad 2` → varekostnad: 16 634 458 / 16 634 458 `16 634 458`
  - `Lønnskostnad 3` → lonnskostnad: 25 255 322 / 25 255 322 `25 255 322`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 4` → avskrivninger: 288 300 / 288 300 `288 300`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 4` → nedskrivninger: – / – ``
  - `Annen driftskostnad 3` → annen_driftskostnad: 17 228 282 / 17 228 282 `17 228 282`
  - `Sun kostnader` → sum_driftskostnad: 46 755 579 / 46 755 579 `46 755 579`
- **816202612 2025 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 3 257 043 / 3 257 043 `3 257 043`
  - `Lønnskostnad 2` → lonnskostnad: 3 768 143 / 3 768 143 `3 768 143`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 3 806 089 / 3 806 089 `3 806 089`
  - `Annen driftskostnad` → annen_driftskostnad: 3 924 316 / 3 924 316 `3 924 316`
  - `Sun kostnader` → sum_driftskostnad: – / 14 756 091 `l4 756 091`
- **822349412 2023 current**, under by 501 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 632 624 / 632 624 `632 624`
  - `Lønnskostnad 1` → lonnskostnad: 4 930 253 / 4 930 253 `4 930 253`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 2 640 800 / 2 640 800 `2 640 800`
  - `Annen driftskostnad` → annen_driftskostnad: 2 879 356 / 2 879 356 `2 879 356`
  - `Sun kostnader` → sum_driftskostnad: 11 083 534 / 11 083 534 `11 083 534`
- **883759702 2021 prior**, over by 21 000 001 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 2 569 055 / 2 569 055 `2 569 055`
  - `Lønnskostnad 1` → lonnskostnad: 7 592 127 / 7 592 127 `7 592 127`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 23 844 245 / 23 844 245 `23 844 245`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler` → nedskrivninger: – / – ``
  - `Annen driftskostnad 1` → annen_driftskostnad: 4 541 379 / 4 541 379 `4 541 379`
  - `Sun kostnader` → sum_driftskostnad: 17 546 805 / 17 546 805 `17 546 805`
- **911801663 2024 current**, under by 9 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 119 / 119 `119`
  - `Lønnskostnad 1` → lonnskostnad: 8 089 156 / 8 089 156 `8 089 156`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 8 587 640 / 8 587 640 `8 587 640`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 7 119 031 / 7 119 031 `7 119 031`
  - `Sun kostnader` → sum_driftskostnad: 23 795 955 / 23 795 955 `23 795 955`
- **911801663 2025 prior**, under by 9 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 119 / 119 `119`
  - `Lønnskostnad 1` → lonnskostnad: 8 089 156 / 8 089 156 `8 089 156`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 8 587 640 / 8 587 640 `8 587 640`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → nedskrivninger: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 7 119 031 / 7 119 031 `7 119 031`
  - `Sun kostnader` → sum_driftskostnad: 23 795 955 / 23 795 955 `23 795 955`
- **912171752 2022 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 976 754 / 976 754 `976 754`
  - `Lønnskostnad 2` → lonnskostnad: 4 268 955 / 4 268 955 `4 268 955`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3, 4` → avskrivninger: 2 832 758 / 2 832 758 `2 832 758`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3, 4` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 3 785 314 / 3 785 314 `3 785 314`
  - `Sun kostnader` → sum_driftskostnad: 11 864 281 / 11 864 281 `11 864 281`
- **912624382 2023 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 1 097 476 / 1 097 476 `1 097 476`
  - `Lønnskostnad 1` → lonnskostnad: 8 924 544 / 8 924 544 `8 924 544`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 80 425 / 80 425 `80 425`
  - `Annen driftskostnad` → annen_driftskostnad: 3 541 344 / 3 541 344 `3 541 344`
  - `Sun kostnader` → sum_driftskostnad: 13 644 289 / 13 644 289 `13 644 289`
- **913704665 2022 current**, under by 1 649 989 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 4 421 921 / 4 421 921 `4 421 921`
  - `Lønnskostnad 3` → lonnskostnad: 15 376 755 / 15 376 755 `15 376 755`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 4` → avskrivninger: 7 243 194 / 7 243 194 `7 243 194`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler` → nedskrivninger: – / 1 649 938 `l 649 938`
  - `Annen driftskostnad 3` → annen_driftskostnad: 9 183 834 / 9 183 834 `9 183 834`
  - `Sun kostnader` → sum_driftskostnad: 37 875 693 / 37 875 693 `37 875 693`
- **913866185 2025 prior**, over by 111 000 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 123 696 566 / 123 696 566 `123 696 566`
  - `Lønnskostnad 1` → lonnskostnad: 7 760 892 / 7 760 892 `7 760 892`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 284 491 / 284 491 `284 491`
  - `Annen driftskostnad` → annen_driftskostnad: 4 624 488 / 4 624 488 `4 624 488`
  - `Sun kostnader` → sum_driftskostnad: 25 366 437 / 25 366 437 `25 366 437`
- **913919467 2024 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 28 350 / 28 350 `28 350`
  - `Lønnskostnad 1` → lonnskostnad: 15 943 319 / 15 943 319 `15 943 319`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler 2` → avskrivninger: 26 522 / 26 522 `26 522`
  - `Annen driftskostnad 1` → annen_driftskostnad: 4 890 369 / 4 890 369 `4 890 369`
  - `Sun kostnader` → sum_driftskostnad: 20 889 060 / 20 889 060 `20 889 060`
- **916530889 2025 current**, under by 1 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 8 304 084 / 8 304 084 `8 304 084`
  - `Lønnskostnad 2` → lonnskostnad: 28 941 348 / 28 941 348 `28 941 348`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 136 954 / 136 954 `136 954`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 2 363 326 / 2 363 326 `2 363 326`
  - `Sun kostnader` → sum_driftskostnad: 39 746 712 / 39 746 712 `39 746 712`
- **918579117 2024 current**, over by 797 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 1 677 273 / 1 677 273 `1 677 273`
  - `Lønnskostnad 2` → lonnskostnad: 4 869 214 / 4 869 214 `4 869 214`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 885 990 / 885 990 `885 990`
  - `Annen driftskostnad 2` → annen_driftskostnad: 2 195 450 / 2 195 450 `2 195 450`
  - `Sun kostnader` → sum_driftskostnad: 8 830 927 / 8 830 927 `8 830 927`
- **919134216 2022 prior**, over by 8 518 379 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Endring i beholdning av` → —: – / – ``
  - `varer under tilvirkning` → —: – / – ``
  - `og ferdig tilvirkede varer` → varer: -8 518 380 / -8 518 380 `-8 518 380`
  - `Varekostnad` → varekostnad: 48 296 / 48 296 `48 296`
  - `Lønnskostnad 2` → lonnskostnad: 4 900 799 / 4 900 799 `4 900 799`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 2 698 572 / 2 698 572 `2 698 572`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 6 535 763 / 6 535 763 `6 535 763`
  - `Sun kostnader` → sum_driftskostnad: 5 665 051 / 5 665 051 `5 665 051`
- **919653477 2021 current**, under by 10 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 1 711 344 / 1 711 344 `1 711 344`
  - `Lønnskostnad l,2` → lonnskostnad: 32 756 129 / 32 756 129 `32 756 129`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler 3` → avskrivninger: 33 029 / 33 029 `33 029`
  - `Annen driftskostnad` → annen_driftskostnad: 4 773 082 / 4 773 082 `4 773 082`
  - `Sun kostnader` → sum_driftskostnad: 39 273 594 / 39 273 594 `39 273 594`
- **919825723 2022 prior**, over by 50 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 50 617 / 50 617 `50 617`
  - `Lønnskostnad 3,4,5` → lonnskostnad: 2 996 559 / 2 996 559 `2 996 559`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler 6` → avskrivninger: 594 171 / 594 171 `594 171`
  - `Annen driftskostnad 3` → annen_driftskostnad: 2 320 625 / 2 320 625 `2 320 625`
  - `Sun kostnader` → sum_driftskostnad: 5 961 922 / 5 961 922 `5 961 922`
- **921475063 2022 current**, under by 50 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 7 374 397 / 7 374 397 `7 374 397`
  - `Lønnskostnad 1` → lonnskostnad: 3 535 298 / 3 535 298 `3 535 298`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler` → avskrivninger: 228 000 / 228 000 `228 000`
  - `Annen driftskostnad` → annen_driftskostnad: 1 919 925 / 1 919 925 `1 919 925`
  - `Sun kostnader` → sum_driftskostnad: 13 107 620 / 13 107 620 `13 107 620`
- **921891806 2022 prior**, under by 5 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 1 551 084 / 1 551 084 `1 551 084`
  - `Lønnskostnad 2` → lonnskostnad: 2 993 647 / 2 993 647 `2 993 647`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 101 262 / 101 262 `101 262`
  - `Annen driftskostnad 2` → annen_driftskostnad: 2 252 496 / 2 252 496 `2 252 496`
  - `Sun kostnader` → sum_driftskostnad: 6 903 489 / 6 903 489 `6 903 489`
- **923816925 2022 current**, under by 100 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 132 599 / 132 599 `132 599`
  - `Lønnskostnad l, 2` → lonnskostnad: 10 600 411 / 10 600 411 `10 600 411`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 4 212 392 / 4 212 392 `4 212 392`
  - `Annen driftskostnad 2` → annen_driftskostnad: 13 426 564 / 13 426 564 `13 426 564`
  - `Sun kostnader` → sum_driftskostnad: 28 372 066 / 28 372 066 `28 372 066`
- **925976105 2023 current**, over by 55 612 998 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 29 288 582 / 29 288 582 `29 288 582`
  - `Lønnskostnad l, 2, 3,` → —: 13 949 939 / 13 949 939 `13 949 939`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 6` → avskrivninger: 83 842 / 83 842 `83 842`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 9` → —: – / – ``
  - `Annen driftskostnad l, 2, 3,` → —: 16 108 623 / 16 108 623 `16 108 623`
  - `Sun kostnader` → sum_driftskostnad: 59 430 986 / 59 430 986 `59 430 986`
- **926103520 2022 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 6 174 655 / 6 174 655 `6 174 655`
  - `Lønnskostnad 1` → lonnskostnad: 4 345 380 / 4 345 380 `4 345 380`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler 2` → avskrivninger: 480 000 / 480 000 `480 000`
  - `Annen driftskostnad` → annen_driftskostnad: 4 380 736 / 4 380 736 `4 380 736`
  - `Sun kostnader` → sum_driftskostnad: 15 381 271 / 15 381 271 `15 381 271`
- **931456237 2021 prior**, under by 50 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 3 372 602 / 3 372 602 `3 372 602`
  - `Lønnskostnad 1` → lonnskostnad: 3 464 103 / 3 464 103 `3 464 103`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler 2` → avskrivninger: 47 000 / 47 000 `47 000`
  - `Annen driftskostnad 3` → annen_driftskostnad: 2 222 932 / 2 222 932 `2 222 932`
  - `Sun kostnader` → sum_driftskostnad: 9 106 687 / 9 106 687 `9 106 687`
- **932052237 2024 current**, under by 501 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 8 211 018 / 8 211 018 `8 211 018`
  - `Lønnskostnad 1` → lonnskostnad: 10 676 343 / 10 676 343 `10 676 343`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 3 346 273 / 3 346 273 `3 346 273`
  - `Annen driftskostnad` → annen_driftskostnad: 3 787 346 / 3 787 346 `3 787 346`
  - `Sun kostnader` → sum_driftskostnad: 26 021 481 / 26 021 481 `26 021 481`
- **946944483 2021 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 6 345 160 / 6 345 160 `6 345 160`
  - `Lønnskostnad l, 3, 12` → lonnskostnad: 20 782 578 / 20 782 578 `20 782 578`
  - `Avskrivning på` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 6` → avskrivninger: 519 802 / 519 802 `519 802`
  - `Annen driftskostnad 4` → annen_driftskostnad: 3 368 360 / 3 368 360 `3 368 360`
  - `Sun kostnader` → sum_driftskostnad: 31 016 400 / 31 016 400 `31 016 400`
- **946944483 2021 prior**, under by 2 999 949 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 6 579 323 / 6 579 323 `6 579 323`
  - `Lønnskostnad l, 3, 12` → lonnskostnad: 15 497 979 / 15 497 979 `15 497 979`
  - `Avskrivning på` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 6` → avskrivninger: 491 818 / 491 818 `491 818`
  - `Annen driftskostnad 4` → annen_driftskostnad: 3 075 283 / 3 075 283 `3 075 283`
  - `Sun kostnader` → sum_driftskostnad: 28 644 352 / 28 644 352 `28 644 352`
- **954976807 2022 current**, over by 160 000 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 172 796 905 / 172 796 905 `172 796 905`
  - `Lønnskostnad 1` → lonnskostnad: 11 799 210 / 11 799 210 `11 799 210`
  - `Avskrivninger 2` → avskrivninger: 2 817 923 / 2 817 923 `2 817 923`
  - `Annen driftskostnad 1` → annen_driftskostnad: 3 957 212 / 3 957 212 `3 957 212`
  - `Sun kostnader` → sum_driftskostnad: 31 371 250 / 31 371 250 `31 371 250`
- **981164660 2021 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 2 022 013 / 2 022 013 `2 022 013`
  - `Lønnskostnad 1` → lonnskostnad: 3 694 378 / 3 694 378 `3 694 378`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler 2` → avskrivninger: 5 834 / 5 834 `5 834`
  - `Annen driftskostnad 3` → annen_driftskostnad: 2 225 063 / 2 225 063 `2 225 063`
  - `Sun kostnader` → sum_driftskostnad: 7 947 788 / 7 947 788 `7 947 788`
- **981369432 2023 prior**, over by 1 000 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad 1` → varekostnad: 13 012 777 / 13 012 777 `13 012 777`
  - `Lønnskostnad 2` → lonnskostnad: 10 672 799 / 10 672 799 `10 672 799`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 783 404 / 783 404 `783 404`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 5 507 748 / 5 507 748 `5 507 748`
  - `Sun kostnader` → sum_driftskostnad: 28 976 728 / 28 976 728 `28 976 728`
- **982057892 2021 current**, over by 390 000 kr, hint `unmatched_cost_row`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Endring i beholdning av` → —: – / – ``
  - `egentilvirkede` → —: – / – ``
  - `anleggsmidler 2, å` → —: -390 000 / -390 000 `-390 000`
  - `Varekostnad` → varekostnad: 1 768 537 / 1 768 537 `1 768 537`
  - `Lønnskostnad 4` → lonnskostnad: 24 554 247 / 24 554 247 `24 554 247`
  - `Ordinær avskrivning 2` → avskrivninger: 1 219 501 / 1 219 501 `1 219 501`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 6 127 018 / 6 127 018 `6 127 018`
  - `Sun kostnader` → sum_driftskostnad: 33 279 303 / 33 279 303 `33 279 303`
- **982057892 2021 prior**, over by 296 000 kr, hint `unmatched_cost_row`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Endring i beholdning av` → —: – / – ``
  - `egentilvirkede` → —: – / – ``
  - `anleggsmidler 2, å` → —: -296 000 / -296 000 `-296 000`
  - `Varekostnad` → varekostnad: 1 733 995 / 1 733 995 `1 733 995`
  - `Lønnskostnad 4` → lonnskostnad: 17 172 241 / 17 172 241 `17 172 241`
  - `Ordinær avskrivning 2` → avskrivninger: 547 565 / 547 565 `547 565`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 3 874 621 / 3 874 621 `3 874 621`
  - `Sun kostnader` → sum_driftskostnad: 23 032 422 / 23 032 422 `23 032 422`
- **982927722 2021 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 295 422 / 295 422 `295 422`
  - `Lønnskostnad 1` → lonnskostnad: 19 594 360 / 19 594 360 `19 594 360`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler 2` → avskrivninger: 590 694 / 590 694 `590 694`
  - `Annen driftskostnad` → annen_driftskostnad: 2 922 003 / 2 922 003 `2 922 003`
  - `Sun kostnader` → sum_driftskostnad: 23 402 979 / 23 402 979 `23 402 979`
- **983453767 2022 prior**, over by 21 000 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 1 086 095 / 1 086 095 `1 086 095`
  - `Lønnskostnad 1` → lonnskostnad: 4 493 179 / 4 493 179 `4 493 179`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 23 375 956 / 23 375 956 `23 375 956`
  - `Annen driftskostnad 1` → annen_driftskostnad: 3 183 166 / 3 183 166 `3 183 166`
  - `Sun kostnader` → sum_driftskostnad: – / 11 138 396 `ll 138 396`
- **983607780 2021 prior**, over by 111 000 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 123 699 444 / 123 699 444 `123 699 444`
  - `Lønnskostnad 2` → lonnskostnad: 22 429 824 / 22 429 824 `22 429 824`
  - `Avskrivning 3` → avskrivninger: 149 647 / 149 647 `149 647`
  - `Annen driftskostnad 4` → annen_driftskostnad: 3 738 731 / 3 738 731 `3 738 731`
  - `Sun kostnader` → sum_driftskostnad: 39 017 646 / 39 017 646 `39 017 646`
- **984952953 2025 current**, over by 471 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 1 520 032 / 1 520 032 `1 520 032`
  - `Lønnskostnad 1` → lonnskostnad: 28 030 355 / 28 030 355 `28 030 355`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 523 977 / 523 977 `523 977`
  - `Annen driftskostnad` → annen_driftskostnad: 10 127 954 / 10 127 954 `10 127 954`
  - `Sun kostnader` → sum_driftskostnad: 39 731 318 / 39 731 318 `39 731 318`
- **985802572 2021 current**, over by 276 457 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Lønnskostnad 3` → lonnskostnad: 4 590 468 / 4 590 468 `4 590 468`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 1 668 542 / 1 668 542 `1 668 542`
  - `Annen driftskostnad` → annen_driftskostnad: 2 728 110 / 2 728 110 `2 728 110`
  - `Sun kostnader` → sum_driftskostnad: 8 987 120 / 8 987 120 `8 987 120`
- **985802572 2021 prior**, over by 3 535 585 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Lønnskostnad 3` → lonnskostnad: 5 024 571 / 5 024 571 `5 024 571`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 732 707 / 732 707 `732 707`
  - `Annen driftskostnad` → annen_driftskostnad: 2 216 695 / 2 216 695 `2 216 695`
  - `Sun kostnader` → sum_driftskostnad: 7 973 973 / 7 973 973 `7 973 973`
- **985802572 2022 current**, over by 1 747 615 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Lønnskostnad 2` → lonnskostnad: 5 248 935 / 5 248 935 `5 248 935`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 1 937 517 / 1 937 517 `1 937 517`
  - `Annen driftskostnad` → annen_driftskostnad: 2 796 237 / 2 796 237 `2 796 237`
  - `Sun kostnader` → sum_driftskostnad: 9 982 689 / 9 982 689 `9 982 689`
- **987493453 2025 current**, under by 500 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 146 225 / 146 225 `146 225`
  - `Lønnskostnad 3` → lonnskostnad: 19 120 521 / 19 120 521 `19 120 521`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 4` → avskrivninger: 4 041 548 / 4 041 548 `4 041 548`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 4` → —: – / – ``
  - `Annen driftskostnad 3` → annen_driftskostnad: 10 155 345 / 10 155 345 `10 155 345`
  - `Sun kostnader` → sum_driftskostnad: 33 464 139 / 33 464 139 `33 464 139`
- **989636790 2022 prior**, over by 21 000 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 372 331 / 372 331 `372 331`
  - `Lønnskostnad 1` → lonnskostnad: 357 455 / 357 455 `357 455`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 23 284 000 / 23 284 000 `23 284 000`
  - `Annen driftskostnad 1` → annen_driftskostnad: 2 324 579 / 2 324 579 `2 324 579`
  - `Sun kostnader` → sum_driftskostnad: 5 338 365 / 5 338 365 `5 338 365`
- **989636790 2023 prior**, over by 21 000 000 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 1 567 779 / 1 567 779 `1 567 779`
  - `Lønnskostnad 1` → lonnskostnad: 2 135 970 / 2 135 970 `2 135 970`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 23 630 000 / 23 630 000 `23 630 000`
  - `Annen driftskostnad 1` → annen_driftskostnad: 4 605 728 / 4 605 728 `4 605 728`
  - `Sun kostnader` → sum_driftskostnad: 10 939 477 / 10 939 477 `10 939 477`
- **990452458 2024 prior**, over by 21 000 001 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 589 503 / 589 503 `589 503`
  - `Lønnskostnad 1` → lonnskostnad: 12 693 454 / 12 693 454 `12 693 454`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 23 311 482 / 23 311 482 `23 311 482`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 6 281 877 / 6 281 877 `6 281 877`
  - `Sun kostnader` → sum_driftskostnad: 21 876 315 / 21 876 315 `21 876 315`
- **993425575 2023 current**, over by 13 778 739 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 2 834 571 / 2 834 571 `2 834 571`
  - `Lønnskostnad 2` → lonnskostnad: 15 961 307 / 15 961 307 `15 961 307`
  - `Balanseførte` → —: – / – ``
  - `utviklingskostnader 3` → —: -13 284 587 / -13 284 587 `-13 284 587`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3, 4` → avskrivninger: 2 231 774 / 2 231 774 `2 231 774`
  - `Avskrivnings korreksjon FOU 3` → —: -494 152 / -494 152 `-494 152`
  - `Annen driftskostnad` → annen_driftskostnad: 15 938 172 / 15 938 172 `15 938 172`
  - `Sun kostnader` → sum_driftskostnad: 23 187 085 / 23 187 085 `23 187 085`
- **993425575 2024 current**, over by 6 116 627 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 13 240 305 / 13 240 305 `13 240 305`
  - `Lønnskostnad 2` → lonnskostnad: 12 867 715 / 12 867 715 `12 867 715`
  - `Balanseførte` → —: – / – ``
  - `utviklingskostnader 3` → —: -3 895 343 / -3 895 343 `-3 895 343`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3, 4` → avskrivninger: 4 624 696 / 4 624 696 `4 624 696`
  - `Avskrivnings korreksjon FOU 3` → —: -2 221 284 / -2 221 284 `-2 221 284`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → nedskrivninger: 4 899 121 / 4 899 121 `4 899 121`
  - `Annen driftskostnad` → annen_driftskostnad: 6 890 229 / 6 890 229 `6 890 229`
  - `Sun kostnader` → sum_driftskostnad: 36 405 439 / 36 405 439 `36 405 439`
- **993425575 2025 current**, over by 10 355 012 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 13 283 814 / 13 283 814 `13 283 814`
  - `Lønnskostnad 2` → lonnskostnad: 19 871 798 / 19 871 798 `19 871 798`
  - `Balanseførte` → —: – / – ``
  - `utviklingskostnader 3` → —: -7 686 962 / -7 686 962 `-7 686 962`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3, 4` → avskrivninger: 3 579 874 / 3 579 874 `3 579 874`
  - `Avskrivnings korreksjon FOU 3` → —: -1 668 049 / -1 668 049 `-1 668 049`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler` → nedskrivninger: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 6 835 411 / 6 835 411 `6 835 411`
  - `Sun kostnader` → sum_driftskostnad: 33 215 885 / 33 215 885 `33 215 885`
- **993425575 2025 prior**, over by 6 116 627 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 13 240 305 / 13 240 305 `13 240 305`
  - `Lønnskostnad 2` → lonnskostnad: 12 867 715 / 12 867 715 `12 867 715`
  - `Balanseførte` → —: – / – ``
  - `utviklingskostnader 3` → —: -3 895 343 / -3 895 343 `-3 895 343`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3, 4` → avskrivninger: 4 624 696 / 4 624 696 `4 624 696`
  - `Avskrivnings korreksjon FOU 3` → —: -2 221 284 / -2 221 284 `-2 221 284`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler` → nedskrivninger: 4 899 121 / 4 899 121 `4 899 121`
  - `Annen driftskostnad` → annen_driftskostnad: 6 890 229 / 6 890 229 `6 890 229`
  - `Sun kostnader` → sum_driftskostnad: 36 405 439 / 36 405 439 `36 405 439`
- **993452890 2021 prior**, over by 329 188 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Endring i beholdning av` → —: – / – ``
  - `varer under tilvirkning` → —: – / – ``
  - `og ferdig tilvirkede varer` → varer: -329 188 / -329 188 `-329 188`
  - `Varekostnad` → varekostnad: 6 293 838 / 6 293 838 `6 293 838`
  - `Lønnskostnad 2` → lonnskostnad: 3 428 194 / 3 428 194 `3 428 194`
  - `Avskrivning på varige` → —: – / – ``
  - `driftsmidler 3` → avskrivninger: 476 876 / 476 876 `476 876`
  - `Annen driftskostnad` → annen_driftskostnad: 889 454 / 889 454 `889 454`
  - `Sun kostnader` → sum_driftskostnad: 10 759 174 / 10 759 174 `10 759 174`
- **994035053 2023 current**, over by 20 999 999 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 3 916 442 / 3 916 442 `3 916 442`
  - `Lønnskostnad l, 2` → lonnskostnad: 20 823 917 / 20 823 917 `20 823 917`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → avskrivninger: 23 879 171 / 23 879 171 `23 879 171`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 3` → nedskrivninger: – / – ``
  - `Annen driftskostnad 1` → annen_driftskostnad: 8 852 713 / 8 852 713 `8 852 713`
  - `Sun kostnader` → sum_driftskostnad: 36 472 244 / 36 472 244 `36 472 244`
- **994035053 2024 prior**, over by 20 999 999 kr, hint `unexplained`, read equals stored: True
  - `Kostnader` → —: – / – ``
  - `Varekostnad` → varekostnad: 3 916 442 / 3 916 442 `3 916 442`
  - `Lønnskostnad 1` → lonnskostnad: 20 823 917 / 20 823 917 `20 823 917`
  - `Avskrivning av` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → avskrivninger: 23 879 171 / 23 879 171 `23 879 171`
  - `Nedskrivning av varige` → —: – / – ``
  - `driftsmidler og` → —: – / – ``
  - `immaterielle eiendeler 2` → —: – / – ``
  - `Annen driftskostnad` → annen_driftskostnad: 8 852 713 / 8 852 713 `8 852 713`
  - `Sun kostnader` → sum_driftskostnad: 36 472 244 / 36 472 244 `36 472 244`

## (b) The width rule, measured

Width ratio: a token's width over (its digits × `Edges.pitch`).

| Set | Digits | Tokens | Min | 1st percentile | Median | Max |
|---|---|---|---|---|---|---|
| reference | 1 | 822 | 0.684 | 0.684 | 0.759 | 1.806 |
| reference | 2 | 501 | 0.361 | 0.839 | 0.929 | 1.458 |
| reference | 3 | 3201 | 0.628 | 0.912 | 0.963 | 1.316 |
| reference | 4 | 96 | 0.696 | 0.696 | 1.0 | 1.01 |
| reference | 5 | 1 | 0.578 | 0.578 | 0.578 | 0.578 |
| not_summing | 1 | 2158 | 0.684 | 0.684 | 0.767 | 1.806 |
| not_summing | 2 | 1418 | 0.348 | 0.839 | 0.933 | 1.43 |
| not_summing | 3 | 9108 | 0.228 | 0.912 | 0.963 | 1.316 |
| not_summing | 4 | 229 | 0.69 | 0.696 | 1.0 | 1.01 |
| not_summing | 5 | 7 | 0.557 | 0.557 | 0.568 | 0.774 |
| ordering | 1 | 8247 | 0.684 | 0.684 | 0.767 | 1.806 |
| ordering | 2 | 4718 | 0.345 | 0.839 | 0.933 | 1.458 |
| ordering | 3 | 32990 | 0.228 | 0.92 | 0.963 | 1.316 |
| ordering | 4 | 872 | 0.69 | 0.696 | 1.0 | 1.01 |
| ordering | 5 | 30 | 0.552 | 0.552 | 0.57 | 0.594 |
| ordering | 6 | 3 | 0.473 | 0.473 | 0.482 | 0.482 |
| draw | 1 | 4351 | 0.684 | 0.684 | 0.767 | 1.806 |
| draw | 2 | 2699 | 0.342 | 0.839 | 0.933 | 1.458 |
| draw | 3 | 17620 | 0.554 | 0.92 | 0.963 | 1.316 |
| draw | 4 | 477 | 0.684 | 0.696 | 1.0 | 1.01 |
| draw | 5 | 16 | 0.547 | 0.547 | 0.568 | 0.594 |
| draw | 6 | 1 | 0.482 | 0.482 | 0.482 | 0.482 |

A lone "1", width over pitch: reference {'n': 146, 'min': 0.759, 'median': 0.818, 'max': 1.806}; not_summing {'n': 347, 'min': 0.759, 'median': 0.774, 'max': 1.806}; ordering {'n': 1473, 'min': 0.759, 'median': 0.81, 'max': 1.806}; draw {'n': 694, 'min': 0.759, 'median': 0.774, 'max': 1.806}

### Tokens refused, per candidate rule

Refused when width < k × digits × pitch, a "1" counted as `one` of a digit.

| Rule | Reference: tokens, refused | Not summing | Ordering | Draw |
|---|---|---|---|---|
| k=0.5 one=1.0 | 4621, 2 | 12920, 12 | 46860, 24 | 25164, 9 |
| k=0.5 one=0.5 | 4621, 2 | 12920, 12 | 46860, 23 | 25164, 9 |
| k=0.6 one=1.0 | 4621, 3 | 12920, 23 | 46860, 103 | 25164, 31 |
| k=0.6 one=0.5 | 4621, 3 | 12920, 17 | 46860, 55 | 25164, 24 |
| k=0.7 one=1.0 | 4621, 228 | 12920, 307 | 46860, 1300 | 25164, 610 |
| k=0.7 one=0.5 | 4621, 228 | 12920, 303 | 46860, 1284 | 25164, 609 |
| k=0.8 one=1.0 | 4621, 738 | 12920, 1867 | 46860, 7174 | 25164, 3899 |
| k=0.8 one=0.5 | 4621, 667 | 12920, 1663 | 46860, 6436 | 25164, 3511 |

### Figures the combined read changes, per candidate rule

Against the transcription on the reference set: correct lost (a cost), wrong lost or fixed (a gain).

| Rule | Set | Columns | Figures changed | Correct lost | Wrong lost | Wrong fixed | Unknown (2.1b) | Columns with a check changed |
|---|---|---|---|---|---|---|---|---|
| k=0.5 one=1.0 | reference | 40 | 0 | 0 | 0 | 0 | 0 | 0 |
| k=0.5 one=1.0 | not_summing | 88 | 9 | 0 | 0 | 0 | 9 | 0 |
| k=0.5 one=1.0 | ordering | 360 | 13 | 0 | 0 | 0 | 13 | 0 |
| k=0.5 one=1.0 | draw | 200 | 3 | 0 | 0 | 0 | 3 | 0 |
| k=0.5 one=0.5 | reference | 40 | 0 | 0 | 0 | 0 | 0 | 0 |
| k=0.5 one=0.5 | not_summing | 88 | 9 | 0 | 0 | 0 | 9 | 0 |
| k=0.5 one=0.5 | ordering | 360 | 13 | 0 | 0 | 0 | 13 | 0 |
| k=0.5 one=0.5 | draw | 200 | 3 | 0 | 0 | 0 | 3 | 0 |
| k=0.6 one=1.0 | reference | 40 | 0 | 0 | 0 | 0 | 0 | 0 |
| k=0.6 one=1.0 | not_summing | 88 | 13 | 0 | 0 | 0 | 13 | 0 |
| k=0.6 one=1.0 | ordering | 360 | 58 | 0 | 0 | 0 | 58 | 0 |
| k=0.6 one=1.0 | draw | 200 | 6 | 0 | 0 | 0 | 6 | 0 |
| k=0.6 one=0.5 | reference | 40 | 0 | 0 | 0 | 0 | 0 | 0 |
| k=0.6 one=0.5 | not_summing | 88 | 9 | 0 | 0 | 0 | 9 | 0 |
| k=0.6 one=0.5 | ordering | 360 | 17 | 0 | 0 | 0 | 17 | 0 |
| k=0.6 one=0.5 | draw | 200 | 3 | 0 | 0 | 0 | 3 | 0 |
| k=0.7 one=1.0 | reference | 40 | 46 | 45 | 1 | 0 | 0 | 1 |
| k=0.7 one=1.0 | not_summing | 88 | 108 | 0 | 0 | 0 | 108 | 0 |
| k=0.7 one=1.0 | ordering | 360 | 420 | 0 | 0 | 0 | 420 | 0 |
| k=0.7 one=1.0 | draw | 200 | 172 | 0 | 0 | 0 | 172 | 1 |
| k=0.7 one=0.5 | reference | 40 | 46 | 45 | 1 | 0 | 0 | 1 |
| k=0.7 one=0.5 | not_summing | 88 | 107 | 0 | 0 | 0 | 107 | 0 |
| k=0.7 one=0.5 | ordering | 360 | 412 | 0 | 0 | 0 | 412 | 0 |
| k=0.7 one=0.5 | draw | 200 | 172 | 0 | 0 | 0 | 172 | 1 |
| k=0.8 one=1.0 | reference | 40 | 168 | 167 | 1 | 0 | 0 | 16 |
| k=0.8 one=1.0 | not_summing | 88 | 520 | 0 | 0 | 0 | 520 | 21 |
| k=0.8 one=1.0 | ordering | 360 | 2153 | 0 | 0 | 0 | 2153 | 145 |
| k=0.8 one=1.0 | draw | 200 | 1102 | 0 | 0 | 0 | 1102 | 76 |
| k=0.8 one=0.5 | reference | 40 | 157 | 156 | 1 | 0 | 0 | 16 |
| k=0.8 one=0.5 | not_summing | 88 | 484 | 0 | 0 | 0 | 484 | 21 |
| k=0.8 one=0.5 | ordering | 360 | 2016 | 0 | 0 | 0 | 2016 | 145 |
| k=0.8 one=0.5 | draw | 200 | 1035 | 0 | 0 | 0 | 1035 | 76 |

### The narrowest tokens of two or more digits

| Set | Orgnr | Year | Token | Width | Pitch | Ratio |
|---|---|---|---|---|---|---|
| not_summing | 981164660 | 2021 | `949` | 27 | 39.5 | 0.23 |
| ordering | 814739082 | 2021 | `949` | 27 | 39.5 | 0.23 |
| ordering | 999159958 | 2021 | `949` | 27 | 39.5 | 0.23 |
| ordering | 921600070 | 2025 | `949` | 27 | 38.8 | 0.23 |
| ordering | 925536725 | 2023 | `949` | 27 | 38.8 | 0.23 |
| ordering | 998859247 | 2023 | `949` | 27 | 38.8 | 0.23 |
| draw | 989636790 | 2021 | `23` | 27 | 39.5 | 0.34 |
| ordering | 916492642 | 2022 | `94` | 27 | 39.1 | 0.35 |
| ordering | 919300388 | 2022 | `94` | 27 | 39.1 | 0.35 |
| ordering | 985874581 | 2022 | `94` | 27 | 39.1 | 0.35 |
| draw | 823633882 | 2022 | `23` | 27 | 39.1 | 0.35 |
| not_summing | 815244672 | 2023 | `23` | 27 | 38.8 | 0.35 |
| not_summing | 994035053 | 2023 | `23` | 27 | 38.8 | 0.35 |
| ordering | 883759702 | 2025 | `23` | 27 | 38.8 | 0.35 |
| draw | 814739082 | 2024 | `83` | 27 | 38.8 | 0.35 |
| not_summing | 883759702 | 2021 | `23` | 28 | 39.5 | 0.35 |
| ordering | 918494480 | 2021 | `23` | 28 | 39.5 | 0.35 |
| ordering | 919300388 | 2021 | `94` | 28 | 39.5 | 0.35 |
| draw | 989636790 | 2021 | `23` | 28 | 39.5 | 0.35 |
| not_summing | 983453767 | 2022 | `23` | 28 | 39.1 | 0.36 |
| not_summing | 989636790 | 2022 | `23` | 28 | 39.1 | 0.36 |
| not_summing | 989636790 | 2022 | `23` | 28 | 39.1 | 0.36 |
| not_summing | 989636790 | 2022 | `32` | 28 | 39.1 | 0.36 |
| ordering | 893938192 | 2022 | `23` | 28 | 39.1 | 0.36 |
| ordering | 912181960 | 2022 | `94` | 28 | 39.1 | 0.36 |

## (c) Lines no within-document check covers

Reference set, reconciled columns, stored against transcribed:

| Field | correct | not read | misread | phantom | blank |
|---|---|---|---|---|---|
| salgsinntekt | 22 | 8 | 0 | 0 | 2 |
| kundefordringer | 24 | 5 | 0 | 0 | 3 |
| bankinnskudd | 30 | 2 | 0 | 0 | 0 |
| leverandorgjeld | 27 | 3 | 0 | 0 | 2 |

Ordering checks against totals read today (5 kr):

| Set: check | Evaluable | Fails |
|---|---|---|
| reference, transcribed: salgsinntekt<=sum_driftsinntekter | 35 | 0 |
| reference, transcribed: leverandorgjeld<=sum_kortsiktig_gjeld | 36 | 0 |
| reference, transcribed: varer+kundefordringer+bankinnskudd+anlegg<=sum_eiendeler | 38 | 0 |
| reference, stored: salgsinntekt<=sum_driftsinntekter | 22 | 0 |
| reference, stored: leverandorgjeld<=sum_kortsiktig_gjeld | 27 | 0 |
| reference, stored: varer+kundefordringer+bankinnskudd+anlegg<=sum_eiendeler | 31 | 0 |
| 2.1b, stored: salgsinntekt<=sum_driftsinntekter | 2833 | 180 |
| 2.1b, stored: leverandorgjeld<=sum_kortsiktig_gjeld | 2908 | 12 |
| 2.1b, stored: varer+kundefordringer+bankinnskudd+anlegg<=sum_eiendeler | 3548 | 23 |

### The 2.1b ordering failures, by cause

Cause from the document's own rows (`classify_ordering`). "Width rule" counts the failures whose figure the candidate rule refuses or changes. A part-against-total check in `src/engine` on stored figures (no re-read) flags every row here by construction; a genuine one it flags is a cost.

| Check | Role | Cause | Columns | Companies | Width rule k=0.5 one=1.0 | Width rule k=0.5 one=0.5 | Width rule k=0.6 one=1.0 | Width rule k=0.6 one=0.5 | Width rule k=0.7 one=1.0 | Width rule k=0.7 one=0.5 | Width rule k=0.8 one=1.0 | Width rule k=0.8 one=0.5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kundefordringer>api_sum_omloepsmidler | current | digit_as_two (confirmed) | 3 | 3 | 0 | 0 | 0 | 0 | 3 | 0 | 3 | 3 |
| kundefordringer>api_sum_omloepsmidler | current | digit_as_two (plausible) | 3 | 3 | 0 | 0 | 0 | 0 | 2 | 0 | 2 | 2 |
| kundefordringer>api_sum_omloepsmidler | current | unexplained | 2 | 2 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 1 |
| leverandorgjeld>sum_kortsiktig_gjeld | current | digit_as_two (confirmed) | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |
| leverandorgjeld>sum_kortsiktig_gjeld | current | digit_as_two (plausible) | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |
| leverandorgjeld>sum_kortsiktig_gjeld | current | genuine | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| leverandorgjeld>sum_kortsiktig_gjeld | current | unexplained | 2 | 2 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 1 |
| leverandorgjeld>sum_kortsiktig_gjeld | prior | digit_as_two (confirmed) | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| leverandorgjeld>sum_kortsiktig_gjeld | prior | digit_as_two (plausible) | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| leverandorgjeld>sum_kortsiktig_gjeld | prior | genuine | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 1 |
| leverandorgjeld>sum_kortsiktig_gjeld | prior | unexplained | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| salgsinntekt>sum_driftsinntekter | current | digit_as_two (confirmed) | 11 | 11 | 3 | 3 | 10 | 3 | 11 | 10 | 11 | 11 |
| salgsinntekt>sum_driftsinntekter | current | digit_as_two (plausible) | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| salgsinntekt>sum_driftsinntekter | current | genuine | 40 | 30 | 0 | 0 | 0 | 0 | 1 | 1 | 9 | 8 |
| salgsinntekt>sum_driftsinntekter | current | other_misread | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| salgsinntekt>sum_driftsinntekter | prior | digit_as_two (confirmed) | 45 | 43 | 3 | 3 | 37 | 6 | 45 | 45 | 45 | 45 |
| salgsinntekt>sum_driftsinntekter | prior | digit_as_two (plausible) | 30 | 29 | 0 | 0 | 1 | 0 | 1 | 1 | 1 | 1 |
| salgsinntekt>sum_driftsinntekter | prior | genuine | 42 | 32 | 0 | 0 | 0 | 0 | 5 | 5 | 10 | 9 |
| salgsinntekt>sum_driftsinntekter | prior | other_misread | 7 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 7 | 7 |

Not probed (document not read by the probe): 0.

### Evidence, a sample per cause

- kundefordringer>api_sum_omloepsmidler, current, digit_as_two (confirmed): 917448043 2025: line 106 873 219, total 15 988 509, tokens `106 873 219`, one digit less 6 873 219; {"printed_sum_omlopsmidler": 15988509, "printed_sum_fordringer": 11741603}
- kundefordringer>api_sum_omloepsmidler, current, digit_as_two (confirmed): 917577293 2025: line 106 568 779, total 14 607 140, tokens `106 568 779`, one digit less 6 568 779; {"printed_sum_omlopsmidler": 14607140, "printed_sum_fordringer": 11238748}
- kundefordringer>api_sum_omloepsmidler, current, digit_as_two (confirmed): 997444345 2023: line 106 158 784, total 13 452 427, tokens `106 158 784`, one digit less 6 158 784; {"printed_sum_omlopsmidler": 13452427, "printed_sum_fordringer": 10786064}
- kundefordringer>api_sum_omloepsmidler, current, digit_as_two (plausible): 914000076 2025: line 106 098 034, total 12 090 264, tokens `106 098 034`, one digit less 6 098 034; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 10144479}
- kundefordringer>api_sum_omloepsmidler, current, digit_as_two (plausible): 918351701 2024: line 106 401 997, total 22 107 393, tokens `106 401 997`, one digit less 6 401 997; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 14810037}
- kundefordringer>api_sum_omloepsmidler, current, digit_as_two (plausible): 990452458 2025: line 16 121 376, total 15 303 845, tokens `16 121 376`, one digit less 1 121 376; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 11128667}
- kundefordringer>api_sum_omloepsmidler, current, unexplained: 919300388 2024: line 2 526 606, total 2 420 819, tokens `2 526 606`, one digit less –; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 2840129}
- kundefordringer>api_sum_omloepsmidler, current, unexplained: 925624896 2023: line 777 313, total -3 907 772, tokens `777 313`, one digit less –; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 880925}
- leverandorgjeld>sum_kortsiktig_gjeld, current, digit_as_two (confirmed): 995992566 2023: line 106 979 580, total 23 750 384, tokens `106 979 580`, one digit less 6 979 580; {"printed_sum_omlopsmidler": 28476769, "printed_sum_fordringer": 5232452}
- leverandorgjeld>sum_kortsiktig_gjeld, current, digit_as_two (plausible): 925514721 2024: line 106 559 348, total 14 090 282, tokens `106 559 348`, one digit less 6 559 348; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 38240743}
- leverandorgjeld>sum_kortsiktig_gjeld, current, genuine: 931851926 2023: line -4 832 801, total -4 954 539, tokens `-4 832 801`, one digit less –; {"printed_sum_omlopsmidler": 4480405, "printed_sum_fordringer": 4170723}
- leverandorgjeld>sum_kortsiktig_gjeld, current, unexplained: 917540640 2021: line 349 276, total -68 478, tokens `349 276`, one digit less –; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 582685}
- leverandorgjeld>sum_kortsiktig_gjeld, current, unexplained: 919478497 2022: line 2 037 293, total 1 398 733, tokens `2 037 293`, one digit less –; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 2023308}
- leverandorgjeld>sum_kortsiktig_gjeld, prior, digit_as_two (confirmed): 917213496 2021: line 713 390, total 593 853, tokens `713 390`, one digit less 13 390; {"printed_sum_omlopsmidler": 314979, "printed_sum_fordringer": 73866}
- leverandorgjeld>sum_kortsiktig_gjeld, prior, digit_as_two (plausible): 921337817 2021: line 100 178, total 97 642, tokens `100 178`, one digit less 178; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 37875}
- leverandorgjeld>sum_kortsiktig_gjeld, prior, digit_as_two (plausible): 921600070 2021: line 161 960, total 161 512, tokens `161 960`, one digit less 11 960; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 141539}
- leverandorgjeld>sum_kortsiktig_gjeld, prior, genuine: 929608275 2023: line 0, total -1 489, tokens `0`, one digit less –; {"printed_sum_omlopsmidler": 22558, "printed_sum_fordringer": null}
- leverandorgjeld>sum_kortsiktig_gjeld, prior, unexplained: 917540640 2022: line 349 276, total -68 478, tokens `349 276`, one digit less –; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 582685}
- leverandorgjeld>sum_kortsiktig_gjeld, prior, unexplained: 919478497 2023: line 2 037 293, total 1 414 663, tokens `2 037 293`, one digit less –; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 2039237}
- leverandorgjeld>sum_kortsiktig_gjeld, prior, unexplained: 931851926 2024: line -4 832 801, total -4 954 539, tokens `-4 832 801`, one digit less –; {"printed_sum_omlopsmidler": null, "printed_sum_fordringer": 4170723}
- salgsinntekt>sum_driftsinntekter, current, digit_as_two (confirmed): 893938192 2022: line 123 073 343, total 12 373 421, tokens `123 073 343`, one digit less 12 073 343; {"revenue_rows": [["Salgsinntekt", 123073343], ["Annen driftsinntekt 1", 300078]], "annen_driftsinntekt": 300078}
- salgsinntekt>sum_driftsinntekter, current, digit_as_two (confirmed): 911737671 2024: line 123 213 240, total 12 214 831, tokens `123 213 240`, one digit less 12 213 240; {"revenue_rows": [["Salgsinntekt", 123213240], ["Annen driftsinntekt", 1591]], "annen_driftsinntekt": 1591}
- salgsinntekt>sum_driftsinntekter, current, digit_as_two (confirmed): 912181960 2022: line 94 094 303, total 9 094 303, tokens `94 094 303`, one digit less 9 094 303; {"revenue_rows": [["Salgsinntekt", 94094303]], "annen_driftsinntekt": null}
- salgsinntekt>sum_driftsinntekter, current, digit_as_two (plausible): 920188141 2023: line 17 713 019, total 17 712 022, tokens `17 713 019`, one digit less 1 713 019; {"revenue_rows": [["Salgsinntekt", 17713019], ["Annen driftsinntekt", 3]], "annen_driftsinntekt": 3}
- salgsinntekt>sum_driftsinntekter, current, digit_as_two (plausible): 930676721 2024: line 17 301 946, total 12 301 946, tokens `17 301 946`, one digit less 1 301 946; {"revenue_rows": [["Salgsinntekt", 17301946]], "annen_driftsinntekt": null}
- salgsinntekt>sum_driftsinntekter, current, digit_as_two (plausible): 998359767 2023: line 10 847 938, total 10 740 781, tokens `10 847 938`, one digit less 847 938; {"revenue_rows": [["Salgsinntekt", 10847938]], "annen_driftsinntekt": null}
- salgsinntekt>sum_driftsinntekter, current, genuine: 820478452 2021: line 29 476 166, total 29 412 627, tokens `29 476 166`, one digit less –; {"revenue_rows": [["Salgsinntekt", 29476166], ["Annen driftsinntekt", -63539]], "annen_driftsinntekt": -63539}
- salgsinntekt>sum_driftsinntekter, current, genuine: 826571802 2021: line 6 069 400, total 5 967 441, tokens `6 069 400`, one digit less –; {"revenue_rows": [["Salgsinntekt", 6069400], ["Annen driftsinntekt", -101959]], "annen_driftsinntekt": -101959}
- salgsinntekt>sum_driftsinntekter, current, genuine: 895210862 2022: line 10 423 806, total 10 417 206, tokens `10 423 806`, one digit less –; {"revenue_rows": [["Salgsinntekt", 10423806], ["Annen driftsinntekt", -6600]], "annen_driftsinntekt": -6600}
- salgsinntekt>sum_driftsinntekter, current, other_misread: 981164660 2021: line 7 908 455, total 7 857 325, tokens `7 908 455`, one digit less –; {"revenue_rows": [["Salgsinntekt", 7908455], ["Annen driftsinntekt", -51160]], "annen_driftsinntekt": -51160}
- salgsinntekt>sum_driftsinntekter, prior, digit_as_two (confirmed): 813235552 2023: line 185 710 069, total 19 795 951, tokens `185 710 069`, one digit less 18 710 069; {"revenue_rows": [["Salgsinntekt", 185710069], ["Annen driftsinntekt", 1085883]], "annen_driftsinntekt": 1085883}
- salgsinntekt>sum_driftsinntekter, prior, digit_as_two (confirmed): 819529272 2025: line 185 902 205, total 27 384 422, tokens `185 902 205`, one digit less 18 902 205; {"revenue_rows": [["Salgsinntekt", 185902205], ["Annen driftsinntekt 2", 8482217]], "annen_driftsinntekt": 8482217}
- salgsinntekt>sum_driftsinntekter, prior, digit_as_two (confirmed): 823239882 2023: line 385 793 464, total 38 793 464, tokens `385 793 464`, one digit less 38 793 464; {"revenue_rows": [["Salgsinntekt", 385793464], ["Annen driftsinntekt", null]], "annen_driftsinntekt": null}
- salgsinntekt>sum_driftsinntekter, prior, digit_as_two (plausible): 814054462 2022: line 13 279 750, total 12 279 750, tokens `13 279 750`, one digit less 1 279 750; {"revenue_rows": [["Salgsinntekt", 13279750]], "annen_driftsinntekt": null}
- salgsinntekt>sum_driftsinntekter, prior, digit_as_two (plausible): 816812402 2023: line 13 448 301, total 12 448 581, tokens `13 448 301`, one digit less 1 448 301; {"revenue_rows": [["Salgsinntekt", 13448301], ["Annen driftsinntekt", 280]], "annen_driftsinntekt": 280}
- salgsinntekt>sum_driftsinntekter, prior, digit_as_two (plausible): 893938192 2021: line 13 971 790, total 13 184 210, tokens `13 971 790`, one digit less 1 971 790; {"revenue_rows": [["Salgsinntekt", 13971790], ["Annen driftsinntekt", 212420]], "annen_driftsinntekt": 212420}
- salgsinntekt>sum_driftsinntekter, prior, genuine: 819544182 2021: line 5 160 722, total 4 813 067, tokens `5 160 722`, one digit less –; {"revenue_rows": [["Salgsinntekt", 5160722], ["Annen driftsinntekt", -347655]], "annen_driftsinntekt": -347655}
- salgsinntekt>sum_driftsinntekter, prior, genuine: 820478452 2022: line 29 476 166, total 29 412 627, tokens `29 476 166`, one digit less –; {"revenue_rows": [["Salgsinntekt", 29476166], ["Annen driftsinntekt", -63539]], "annen_driftsinntekt": -63539}
- salgsinntekt>sum_driftsinntekter, prior, genuine: 826571802 2022: line 6 069 400, total 5 967 441, tokens `6 069 400`, one digit less –; {"revenue_rows": [["Salgsinntekt", 6069400], ["Annen driftsinntekt", -101959]], "annen_driftsinntekt": -101959}
- salgsinntekt>sum_driftsinntekter, prior, other_misread: 814739082 2021: line 949 273 778, total 12 559 200, tokens `949 273 778`, one digit less –; {"revenue_rows": [["Salgsinntekt", 949273778], ["Annen driftsinntekt l, 2", 3285422]], "annen_driftsinntekt": null}
- salgsinntekt>sum_driftsinntekter, prior, other_misread: 921600070 2025: line 949 040 745, total 9 040 745, tokens `949 040 745`, one digit less –; {"revenue_rows": [["Salgsinntekt", 949040745], ["Annen driftsinntekt", null]], "annen_driftsinntekt": null}
- salgsinntekt>sum_driftsinntekter, prior, other_misread: 925536725 2023: line 949 045 028, total 9 045 028, tokens `949 045 028`, one digit less –; {"revenue_rows": [["Salgsinntekt", 949045028]], "annen_driftsinntekt": null}

### The 2.1b ordering failures, column by column

Stored line and total, the row's plain tokens with their widths and the page pitch, and the figure under each candidate rule (– is refused).

| Orgnr | Year | Role | Check | Line | Total | Tokens (width) | Pitch | k=0.5 one=1.0 | k=0.5 one=0.5 | k=0.6 one=1.0 | k=0.6 one=0.5 | k=0.7 one=1.0 | k=0.7 one=0.5 | k=0.8 one=1.0 | k=0.8 one=0.5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 813235552 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 185 710 069 | 19 795 951 | `185(67) 710(110) 069(112)` | 38.8 | 185 710 069 | 185 710 069 | – | 185 710 069 | – | – | – | – |
| 814054462 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 13 279 750 | 12 279 750 | `13(65) 279(113) 750(112)` | 39.1 | 13 279 750 | 13 279 750 | 13 279 750 | 13 279 750 | 13 279 750 | 13 279 750 | 13 279 750 | 13 279 750 |
| 814739082 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 949 273 778 | 12 559 200 | `949(27) 273(110) 778(112)` | 39.5 | – | – | – | – | – | – | – | – |
| 816812402 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 13 448 301 | 12 448 581 | `13(65) 448(113) 301(118)` | 38.8 | 13 448 301 | 13 448 301 | 13 448 301 | 13 448 301 | 13 448 301 | 13 448 301 | 13 448 301 | 13 448 301 |
| 819529272 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 185 902 205 | 27 384 422 | `185(67) 902(107) 205(115)` | 38.8 | 185 902 205 | 185 902 205 | – | 185 902 205 | – | – | – | – |
| 819544182 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 5 160 722 | 4 813 067 | `5(30) 160(110) 722(110)` | 39.5 | 5 160 722 | 5 160 722 | 5 160 722 | 5 160 722 | 5 160 722 | 5 160 722 | – | – |
| 820478452 | 2021 | current | salgsinntekt>sum_driftsinntekter | 29 476 166 | 29 412 627 | `29(73) 476(115) 166(110)` | 39.5 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 |
| 820478452 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 29 476 166 | 29 412 627 | `29(70) 476(113) 166(112)` | 39.1 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 | 29 476 166 |
| 823239882 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 385 793 464 | 38 793 464 | `385(70) 793(107) 464(115)` | 38.8 | 385 793 464 | 385 793 464 | 385 793 464 | 385 793 464 | – | – | – | – |
| 826571802 | 2021 | current | salgsinntekt>sum_driftsinntekter | 6 069 400 | 5 967 441 | `6(28) 069(112) 400(112)` | 39.5 | 6 069 400 | 6 069 400 | 6 069 400 | 6 069 400 | 6 069 400 | 6 069 400 | – | – |
| 826571802 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 6 069 400 | 5 967 441 | `6(27) 069(110) 400(115)` | 39.1 | 6 069 400 | 6 069 400 | 6 069 400 | 6 069 400 | – | – | – | – |
| 826571802 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 123 745 560 | 12 745 560 | `123(65) 745(110) 560(115)` | 38.8 | 123 745 560 | 123 745 560 | – | 123 745 560 | – | – | – | – |
| 883759702 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 385 234 685 | 38 234 685 | `385(70) 234(113) 685(112)` | 38.8 | 385 234 685 | 385 234 685 | 385 234 685 | 385 234 685 | – | – | – | – |
| 893938192 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 13 971 790 | 13 184 210 | `13(65) 971(112) 790(112)` | 39.5 | 13 971 790 | 13 971 790 | 13 971 790 | 13 971 790 | 13 971 790 | 13 971 790 | 13 971 790 | 13 971 790 |
| 893938192 | 2022 | current | salgsinntekt>sum_driftsinntekter | 123 073 343 | 12 373 421 | `123(67) 073(110) 343(110)` | 39.1 | 123 073 343 | 123 073 343 | – | 123 073 343 | – | – | – | – |
| 893938192 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 123 868 244 | 12 868 244 | `123(65) 868(110) 244(115)` | 39.1 | 123 868 244 | 123 868 244 | – | 123 868 244 | – | – | – | – |
| 895210862 | 2022 | current | salgsinntekt>sum_driftsinntekter | 10 423 806 | 10 417 206 | `10(70) 423(113) 806(110)` | 39.1 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 |
| 895210862 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 10 423 806 | 10 417 206 | `10(67) 423(110) 806(112)` | 38.8 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 | 10 423 806 |
| 898426122 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 185 211 960 | 18 238 859 | `185(67) 211(115) 960(112)` | 39.1 | 185 211 960 | 185 211 960 | – | 185 211 960 | – | – | – | – |
| 911737671 | 2024 | current | salgsinntekt>sum_driftsinntekter | 123 213 240 | 12 214 831 | `123(67) 213(113) 240(112)` | 38.8 | 123 213 240 | 123 213 240 | – | 123 213 240 | – | – | – | – |
| 911737671 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 13 213 240 | 12 214 831 | `13(65) 213(110) 240(115)` | 38.8 | 13 213 240 | 13 213 240 | 13 213 240 | 13 213 240 | 13 213 240 | 13 213 240 | 13 213 240 | 13 213 240 |
| 911801663 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 13 590 985 | 12 722 351 | `13(65) 590(113) 985(112)` | 38.8 | 13 590 985 | 13 590 985 | 13 590 985 | 13 590 985 | 13 590 985 | 13 590 985 | 13 590 985 | 13 590 985 |
| 912181960 | 2022 | current | salgsinntekt>sum_driftsinntekter | 94 094 303 | 9 094 303 | `94(28) 094(112) 303(110)` | 39.1 | – | – | – | – | – | – | – | – |
| 912181960 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 13 420 287 | 12 420 287 | `13(65) 420(113) 287(115)` | 38.8 | 13 420 287 | 13 420 287 | 13 420 287 | 13 420 287 | 13 420 287 | 13 420 287 | 13 420 287 | 13 420 287 |
| 912355233 | 2021 | current | salgsinntekt>sum_driftsinntekter | 31 521 129 | 31 138 548 | `31(75) 521(118) 129(110)` | 39.5 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 |
| 912355233 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 32 535 742 | 32 331 972 | `32(68) 535(113) 742(110)` | 39.5 | 32 535 742 | 32 535 742 | 32 535 742 | 32 535 742 | 32 535 742 | 32 535 742 | 32 535 742 | 32 535 742 |
| 912355233 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 31 521 129 | 31 138 548 | `31(73) 521(115) 129(112)` | 39.1 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 | 31 521 129 |
| 912355233 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 31 252 502 | 31 105 209 | `31(73) 252(110) 502(113)` | 38.8 | 31 252 502 | 31 252 502 | 31 252 502 | 31 252 502 | 31 252 502 | 31 252 502 | 31 252 502 | 31 252 502 |
| 912624382 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 13 143 591 | 12 180 016 | `13(65) 143(107) 591(118)` | 38.8 | 13 143 591 | 13 143 591 | 13 143 591 | 13 143 591 | 13 143 591 | 13 143 591 | 13 143 591 | 13 143 591 |
| 912663272 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 158 882 640 | 28 455 003 | `158(67) 882(107) 640(112)` | 39.5 | 158 882 640 | 158 882 640 | – | 158 882 640 | – | – | – | – |
| 914000076 | 2025 | current | kundefordringer>api_sum_omloepsmidler | 106 098 034 | 12 090 264 | `106(70) 098(112) 034(110)` | 38.8 | 106 098 034 | 106 098 034 | 106 098 034 | 106 098 034 | – | 106 098 034 | – | – |
| 914397111 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 28 126 818 | 25 502 586 | `28(70) 126(110) 818(112)` | 38.8 | 28 126 818 | 28 126 818 | 28 126 818 | 28 126 818 | 28 126 818 | 28 126 818 | 28 126 818 | 28 126 818 |
| 914869757 | 2021 | current | salgsinntekt>sum_driftsinntekter | 7 576 342 | 7 186 303 | `7(28) 576(115) 342(110)` | 39.5 | 7 576 342 | 7 576 342 | 7 576 342 | 7 576 342 | 7 576 342 | 7 576 342 | – | – |
| 914869757 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 7 576 342 | 7 186 303 | `7(27) 576(113) 342(113)` | 39.1 | 7 576 342 | 7 576 342 | 7 576 342 | 7 576 342 | – | – | – | – |
| 914869757 | 2025 | current | salgsinntekt>sum_driftsinntekter | 29 366 849 | 29 268 282 | `29(73) 366(115) 849(110)` | 38.8 | 29 366 849 | 29 366 849 | 29 366 849 | 29 366 849 | 29 366 849 | 29 366 849 | 29 366 849 | 29 366 849 |
| 915071422 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 885 422 153 | 89 271 800 | `885(67) 422(110) 153(110)` | 38.8 | 885 422 153 | 885 422 153 | – | – | – | – | – | – |
| 915210600 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 13 714 418 | 12 770 627 | `13(65) 714(110) 418(115)` | 38.8 | 13 714 418 | 13 714 418 | 13 714 418 | 13 714 418 | 13 714 418 | 13 714 418 | 13 714 418 | 13 714 418 |
| 915210600 | 2025 | current | salgsinntekt>sum_driftsinntekter | 18 636 231 | 18 633 035 | `18(70) 636(112) 231(115)` | 38.8 | 18 636 231 | 18 636 231 | 18 636 231 | 18 636 231 | 18 636 231 | 18 636 231 | 18 636 231 | 18 636 231 |
| 915224628 | 2024 | current | salgsinntekt>sum_driftsinntekter | 94 619 693 | 13 197 924 | `94(28) 619(112) 693(108)` | 38.8 | – | – | – | – | – | – | – | – |
| 915487467 | 2022 | current | salgsinntekt>sum_driftsinntekter | 18 306 302 | 18 155 492 | `18(70) 306(115) 302(110)` | 39.1 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 |
| 915487467 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 17 393 754 | 15 920 596 | `17(67) 393(110) 754(112)` | 39.1 | 17 393 754 | 17 393 754 | 17 393 754 | 17 393 754 | 17 393 754 | 17 393 754 | 17 393 754 | 17 393 754 |
| 915487467 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 18 306 302 | 18 155 492 | `18(67) 306(113) 302(113)` | 38.8 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 | 18 306 302 |
| 916075847 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 123 524 030 | 12 524 030 | `123(65) 524(113) 030(112)` | 38.8 | 123 524 030 | 123 524 030 | – | 123 524 030 | – | – | – | – |
| 916492642 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 94 181 593 | 9 317 211 | `94(27) 181(112) 593(113)` | 39.1 | – | – | – | – | – | – | – | – |
| 916530889 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 31 152 289 | 31 152 042 | `31(73) 152(107) 289(115)` | 38.8 | 31 152 289 | 31 152 289 | 31 152 289 | 31 152 289 | 31 152 289 | 31 152 289 | 31 152 289 | 31 152 289 |
| 917213496 | 2021 | prior | leverandorgjeld>sum_kortsiktig_gjeld | 713 390 | 593 853 | `713(107) 390(115)` | 39.5 | 713 390 | 713 390 | 713 390 | 713 390 | 713 390 | 713 390 | 713 390 | 713 390 |
| 917448043 | 2025 | current | kundefordringer>api_sum_omloepsmidler | 106 873 219 | 15 988 509 | `106(70) 873(110) 219(112)` | 38.8 | 106 873 219 | 106 873 219 | 106 873 219 | 106 873 219 | – | 106 873 219 | – | – |
| 917540640 | 2021 | current | leverandorgjeld>sum_kortsiktig_gjeld | 349 276 | -68 478 | `349(115) 276(112)` | 39.5 | 349 276 | 349 276 | 349 276 | 349 276 | 349 276 | 349 276 | 349 276 | 349 276 |
| 917540640 | 2022 | prior | leverandorgjeld>sum_kortsiktig_gjeld | 349 276 | -68 478 | `349(113) 276(115)` | 39.1 | 349 276 | 349 276 | 349 276 | 349 276 | 349 276 | 349 276 | 349 276 | 349 276 |
| 917577293 | 2023 | current | salgsinntekt>sum_driftsinntekter | 30 451 153 | 30 358 938 | `30(73) 451(118) 153(108)` | 38.8 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 |
| 917577293 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 30 451 153 | 30 358 938 | `30(70) 451(115) 153(110)` | 38.8 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 | 30 451 153 |
| 917577293 | 2025 | current | kundefordringer>api_sum_omloepsmidler | 106 568 779 | 14 607 140 | `106(70) 568(115) 779(110)` | 38.8 | 106 568 779 | 106 568 779 | 106 568 779 | 106 568 779 | – | 106 568 779 | – | – |
| 918351701 | 2024 | current | kundefordringer>api_sum_omloepsmidler | 106 401 997 | 22 107 393 | `106(70) 401(118) 997(110)` | 38.8 | 106 401 997 | 106 401 997 | 106 401 997 | 106 401 997 | – | 106 401 997 | – | – |
| 918494480 | 2021 | current | salgsinntekt>sum_driftsinntekter | 8 147 790 | 8 142 398 | `8(28) 147(112) 790(110)` | 39.5 | 8 147 790 | 8 147 790 | 8 147 790 | 8 147 790 | 8 147 790 | 8 147 790 | – | – |
| 918494480 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 185 056 619 | 18 056 619 | `185(67) 056(110) 619(112)` | 38.8 | 185 056 619 | 185 056 619 | – | 185 056 619 | – | – | – | – |
| 918543198 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 123 696 047 | 12 696 047 | `123(65) 696(110) 047(112)` | 38.8 | 123 696 047 | 123 696 047 | – | 123 696 047 | – | – | – | – |
| 918744150 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 123 675 113 | 15 643 499 | `123(65) 675(110) 113(110)` | 39.1 | 123 675 113 | 123 675 113 | – | 123 675 113 | – | – | – | – |
| 918874224 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 1 514 490 | 1 280 263 | `1(30) 514(113) 490(115)` | 39.5 | 1 514 490 | 1 514 490 | 1 514 490 | 1 514 490 | 1 514 490 | 1 514 490 | – | 1 514 490 |
| 919300388 | 2021 | current | salgsinntekt>sum_driftsinntekter | 94 052 597 | 9 052 597 | `94(28) 052(110) 597(112)` | 39.5 | – | – | – | – | – | – | – | – |
| 919300388 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 94 052 597 | 9 052 597 | `94(27) 052(107) 597(115)` | 39.1 | – | – | – | – | – | – | – | – |
| 919300388 | 2024 | current | kundefordringer>api_sum_omloepsmidler | 2 526 606 | 2 420 819 | `2(27) 526(115) 606(110)` | 38.8 | 2 526 606 | 2 526 606 | 2 526 606 | 2 526 606 | – | – | – | – |
| 919300388 | 2024 | current | salgsinntekt>sum_driftsinntekter | 18 009 591 | 17 980 177 | `18(70) 009(112) 591(115)` | 38.8 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 |
| 919300388 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 185 549 617 | 18 549 617 | `185(67) 549(113) 617(112)` | 38.8 | 185 549 617 | 185 549 617 | – | 185 549 617 | – | – | – | – |
| 919300388 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 18 009 591 | 17 980 177 | `18(67) 009(110) 591(118)` | 38.8 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 | 18 009 591 |
| 919478497 | 2022 | current | leverandorgjeld>sum_kortsiktig_gjeld | 2 037 293 | 1 398 733 | `2(27) 037(112) 293(110)` | 39.1 | 2 037 293 | 2 037 293 | 2 037 293 | 2 037 293 | – | – | – | – |
| 919478497 | 2023 | prior | leverandorgjeld>sum_kortsiktig_gjeld | 2 037 293 | 1 414 663 | `2(28) 037(110) 293(113)` | 38.8 | 2 037 293 | 2 037 293 | 2 037 293 | 2 037 293 | 2 037 293 | 2 037 293 | – | – |
| 919564369 | 2022 | current | salgsinntekt>sum_driftsinntekter | 8 250 434 | 8 044 887 | `8(28) 250(115) 434(112)` | 39.1 | 8 250 434 | 8 250 434 | 8 250 434 | 8 250 434 | 8 250 434 | 8 250 434 | – | – |
| 919564369 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 8 250 434 | 8 044 887 | `8(27) 250(113) 434(115)` | 38.8 | 8 250 434 | 8 250 434 | 8 250 434 | 8 250 434 | – | – | – | – |
| 919808632 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 127 812 435 | 12 861 410 | `127(65) 812(107) 435(115)` | 38.8 | 127 812 435 | 127 812 435 | – | 127 812 435 | – | – | – | – |
| 919941189 | 2021 | current | salgsinntekt>sum_driftsinntekter | 123 335 262 | 12 335 262 | `123(67) 335(115) 262(110)` | 39.5 | 123 335 262 | 123 335 262 | – | 123 335 262 | – | – | – | – |
| 919941189 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 13 335 262 | 12 335 262 | `13(65) 335(113) 262(113)` | 39.1 | 13 335 262 | 13 335 262 | 13 335 262 | 13 335 262 | 13 335 262 | 13 335 262 | 13 335 262 | 13 335 262 |
| 920018734 | 2022 | current | salgsinntekt>sum_driftsinntekter | 4 507 272 | 4 207 272 | `4(30) 507(115) 272(110)` | 39.1 | 4 507 272 | 4 507 272 | 4 507 272 | 4 507 272 | 4 507 272 | 4 507 272 | – | – |
| 920018734 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 4 507 272 | 4 207 272 | `4(30) 507(113) 272(113)` | 38.8 | 4 507 272 | 4 507 272 | 4 507 272 | 4 507 272 | 4 507 272 | 4 507 272 | – | – |
| 920024742 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 385 413 644 | 38 413 644 | `385(70) 413(110) 644(112)` | 38.8 | 385 413 644 | 385 413 644 | 385 413 644 | 385 413 644 | – | – | – | – |
| 920188141 | 2023 | current | salgsinntekt>sum_driftsinntekter | 17 713 019 | 17 712 022 | `17(70) 713(110) 019(110)` | 38.8 | 17 713 019 | 17 713 019 | 17 713 019 | 17 713 019 | 17 713 019 | 17 713 019 | 17 713 019 | 17 713 019 |
| 920766838 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 185 984 880 | 18 984 880 | `185(67) 984(110) 880(112)` | 38.8 | 185 984 880 | 185 984 880 | – | 185 984 880 | – | – | – | – |
| 920868797 | 2021 | current | salgsinntekt>sum_driftsinntekter | 172 029 767 | 12 029 767 | `172(67) 029(112) 767(110)` | 39.5 | 172 029 767 | 172 029 767 | – | 172 029 767 | – | – | – | – |
| 920868797 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 13 029 767 | 12 029 767 | `13(65) 029(110) 767(112)` | 39.1 | 13 029 767 | 13 029 767 | 13 029 767 | 13 029 767 | 13 029 767 | 13 029 767 | 13 029 767 | 13 029 767 |
| 921147325 | 2021 | current | salgsinntekt>sum_driftsinntekter | 3 046 062 | 3 005 452 | `3(27) 046(112) 062(108)` | 39.5 | 3 046 062 | 3 046 062 | 3 046 062 | 3 046 062 | – | – | – | – |
| 921147325 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 5 841 154 | 5 125 127 | `5(30) 841(112) 154(112)` | 39.5 | 5 841 154 | 5 841 154 | 5 841 154 | 5 841 154 | 5 841 154 | 5 841 154 | – | – |
| 921147325 | 2023 | current | salgsinntekt>sum_driftsinntekter | 13 380 651 | 12 930 731 | `13(67) 380(115) 651(113)` | 38.8 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 |
| 921147325 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 13 380 651 | 12 930 731 | `13(65) 380(113) 651(115)` | 38.8 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 | 13 380 651 |
| 921337817 | 2021 | current | salgsinntekt>sum_driftsinntekter | 15 373 022 | 14 774 721 | `15(70) 373(113) 022(108)` | 39.5 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 |
| 921337817 | 2021 | prior | leverandorgjeld>sum_kortsiktig_gjeld | 100 178 | 97 642 | `100(110) 178(112)` | 39.5 | 100 178 | 100 178 | 100 178 | 100 178 | 100 178 | 100 178 | 100 178 | 100 178 |
| 921337817 | 2022 | current | salgsinntekt>sum_driftsinntekter | 18 037 887 | 17 622 844 | `18(70) 037(112) 887(110)` | 39.1 | 18 037 887 | 18 037 887 | 18 037 887 | 18 037 887 | 18 037 887 | 18 037 887 | 18 037 887 | 18 037 887 |
| 921337817 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 15 373 022 | 14 774 721 | `15(67) 373(110) 022(110)` | 39.1 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 | 15 373 022 |
| 921600070 | 2021 | prior | leverandorgjeld>sum_kortsiktig_gjeld | 161 960 | 161 512 | `161(112) 960(112)` | 39.5 | 161 960 | 161 960 | 161 960 | 161 960 | 161 960 | 161 960 | 161 960 | 161 960 |
| 921600070 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 949 040 745 | 9 040 745 | `949(27) 040(110) 745(112)` | 38.8 | – | – | – | – | – | – | – | – |
| 921673310 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 33 205 840 | 33 205 800 | `33(68) 205(113) 840(112)` | 38.8 | 33 205 840 | 33 205 840 | 33 205 840 | 33 205 840 | 33 205 840 | 33 205 840 | 33 205 840 | 33 205 840 |
| 921891806 | 2022 | current | salgsinntekt>sum_driftsinntekter | 1 452 173 | -3 530 499 | `1(30) 452(113) 173(108)` | 39.1 | 1 452 173 | 1 452 173 | 1 452 173 | 1 452 173 | 1 452 173 | 1 452 173 | – | 1 452 173 |
| 921891806 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 123 950 045 | 16 345 975 | `123(65) 950(110) 045(112)` | 38.8 | 123 950 045 | 123 950 045 | – | 123 950 045 | – | – | – | – |
| 921995296 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 385 547 006 | 38 547 006 | `385(70) 547(113) 006(112)` | 38.8 | 385 547 006 | 385 547 006 | 385 547 006 | 385 547 006 | – | – | – | – |
| 922359989 | 2024 | current | salgsinntekt>sum_driftsinntekter | 5 965 197 | 5 926 737 | `5(30) 965(112) 197(110)` | 38.8 | 5 965 197 | 5 965 197 | 5 965 197 | 5 965 197 | 5 965 197 | 5 965 197 | – | – |
| 922359989 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 5 965 197 | 5 926 737 | `5(30) 965(110) 197(112)` | 38.8 | 5 965 197 | 5 965 197 | 5 965 197 | 5 965 197 | 5 965 197 | 5 965 197 | – | – |
| 923147497 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 13 220 682 | 12 220 682 | `13(65) 220(113) 682(110)` | 39.5 | 13 220 682 | 13 220 682 | 13 220 682 | 13 220 682 | 13 220 682 | 13 220 682 | 13 220 682 | 13 220 682 |
| 923232001 | 2025 | current | salgsinntekt>sum_driftsinntekter | 158 444 574 | 18 444 574 | `158(70) 444(115) 574(112)` | 38.8 | 158 444 574 | 158 444 574 | 158 444 574 | 158 444 574 | – | 158 444 574 | – | – |
| 923661832 | 2023 | current | salgsinntekt>sum_driftsinntekter | 6 949 739 | 6 592 461 | `6(28) 949(112) 739(110)` | 38.8 | 6 949 739 | 6 949 739 | 6 949 739 | 6 949 739 | 6 949 739 | 6 949 739 | – | – |
| 923661832 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 6 949 739 | 6 592 461 | `6(27) 949(110) 739(112)` | 38.8 | 6 949 739 | 6 949 739 | 6 949 739 | 6 949 739 | – | – | – | – |
| 924505478 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 123 551 763 | 14 779 816 | `123(65) 551(115) 763(110)` | 38.8 | 123 551 763 | 123 551 763 | – | 123 551 763 | – | – | – | – |
| 924812699 | 2022 | current | salgsinntekt>sum_driftsinntekter | 39 720 146 | 39 477 348 | `39(73) 720(112) 146(110)` | 39.1 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 |
| 924812699 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 39 720 146 | 39 477 348 | `39(70) 720(110) 146(112)` | 38.8 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 | 39 720 146 |
| 924963840 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 123 935 082 | 12 935 082 | `123(65) 935(110) 082(110)` | 39.1 | 123 935 082 | 123 935 082 | – | 123 935 082 | – | – | – | – |
| 924963840 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 123 375 827 | 12 375 827 | `123(65) 375(113) 827(112)` | 38.8 | 123 375 827 | 123 375 827 | – | 123 375 827 | – | – | – | – |
| 925514721 | 2024 | current | leverandorgjeld>sum_kortsiktig_gjeld | 106 559 348 | 14 090 282 | `106(70) 559(115) 348(112)` | 38.8 | 106 559 348 | 106 559 348 | 106 559 348 | 106 559 348 | – | 106 559 348 | – | – |
| 925536725 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 949 045 028 | 9 045 028 | `949(27) 045(110) 028(112)` | 38.8 | – | – | – | – | – | – | – | – |
| 925624896 | 2023 | current | kundefordringer>api_sum_omloepsmidler | 777 313 | -3 907 772 | `777(112) 313(110)` | 38.8 | 777 313 | 777 313 | 777 313 | 777 313 | 777 313 | 777 313 | 777 313 | 777 313 |
| 925814385 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 185 908 723 | 18 908 723 | `185(67) 908(110) 723(110)` | 38.8 | 185 908 723 | 185 908 723 | – | 185 908 723 | – | – | – | – |
| 925879819 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 13 194 873 | 12 194 873 | `13(65) 194(110) 873(110)` | 39.1 | 13 194 873 | 13 194 873 | 13 194 873 | 13 194 873 | 13 194 873 | 13 194 873 | 13 194 873 | 13 194 873 |
| 925906093 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 385 943 561 | 38 945 640 | `385(70) 943(107) 561(118)` | 38.8 | 385 943 561 | 385 943 561 | 385 943 561 | 385 943 561 | – | – | – | – |
| 926103520 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 123 260 863 | 12 260 863 | `123(65) 260(113) 863(110)` | 38.8 | 123 260 863 | 123 260 863 | – | 123 260 863 | – | – | – | – |
| 926403699 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 185 663 307 | 18 663 307 | `185(67) 663(107) 307(115)` | 38.8 | 185 663 307 | 185 663 307 | – | 185 663 307 | – | – | – | – |
| 927611074 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 6 079 424 | 6 077 026 | `6(27) 079(110) 424(115)` | 38.8 | 6 079 424 | 6 079 424 | 6 079 424 | 6 079 424 | – | – | – | – |
| 927678594 | 2025 | current | salgsinntekt>sum_driftsinntekter | 21 448 559 | 20 322 069 | `21(75) 448(115) 559(112)` | 38.8 | 21 448 559 | 21 448 559 | 21 448 559 | 21 448 559 | 21 448 559 | 21 448 559 | 21 448 559 | 21 448 559 |
| 927721031 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 185 806 787 | 18 806 787 | `185(67) 806(110) 787(112)` | 38.8 | 185 806 787 | 185 806 787 | – | 185 806 787 | – | – | – | – |
| 927901013 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 13 807 225 | 13 144 974 | `13(65) 807(110) 225(115)` | 38.8 | 13 807 225 | 13 807 225 | 13 807 225 | 13 807 225 | 13 807 225 | 13 807 225 | 13 807 225 | 13 807 225 |
| 928431037 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 123 573 220 | 12 577 620 | `123(65) 573(110) 220(115)` | 38.8 | 123 573 220 | 123 573 220 | – | 123 573 220 | – | – | – | – |
| 928657043 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 123 725 888 | 12 725 888 | `123(65) 725(110) 888(112)` | 39.1 | 123 725 888 | 123 725 888 | – | 123 725 888 | – | – | – | – |
| 929608275 | 2023 | prior | leverandorgjeld>sum_kortsiktig_gjeld | 0 | -1 489 | `0(27)` | 38.8 | 0 | 0 | 0 | 0 | – | – | – | – |
| 930520101 | 2024 | current | salgsinntekt>sum_driftsinntekter | 49 685 347 | 49 367 821 | `49(73) 685(112) 347(112)` | 38.8 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 |
| 930520101 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 49 685 347 | 49 367 821 | `49(70) 685(110) 347(115)` | 38.8 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 | 49 685 347 |
| 930676721 | 2024 | current | salgsinntekt>sum_driftsinntekter | 17 301 946 | 12 301 946 | `17(67) 301(118) 946(110)` | 38.8 | 17 301 946 | 17 301 946 | 17 301 946 | 17 301 946 | 17 301 946 | 17 301 946 | 17 301 946 | 17 301 946 |
| 930676721 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 13 301 946 | 12 301 946 | `13(65) 301(115) 946(112)` | 38.8 | 13 301 946 | 13 301 946 | 13 301 946 | 13 301 946 | 13 301 946 | 13 301 946 | 13 301 946 | 13 301 946 |
| 931050478 | 2025 | current | salgsinntekt>sum_driftsinntekter | 172 899 284 | 12 899 284 | `172(67) 899(112) 284(112)` | 38.8 | 172 899 284 | 172 899 284 | – | 172 899 284 | – | – | – | – |
| 931456237 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 123 746 904 | 12 746 904 | `123(65) 746(110) 904(112)` | 39.1 | 123 746 904 | 123 746 904 | – | 123 746 904 | – | – | – | – |
| 931851926 | 2023 | current | leverandorgjeld>sum_kortsiktig_gjeld | -4 832 801 | -4 954 539 | `-4(68) 832(110) 801(113)` | 38.8 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 |
| 931851926 | 2024 | prior | leverandorgjeld>sum_kortsiktig_gjeld | -4 832 801 | -4 954 539 | `-4(65) 832(107) 801(115)` | 38.8 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 | -4 832 801 |
| 932213478 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 485 454 450 | 48 454 450 | `485(70) 454(113) 450(115)` | 38.8 | 485 454 450 | 485 454 450 | 485 454 450 | 485 454 450 | – | – | – | – |
| 957383327 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 13 622 524 | 12 622 524 | `13(65) 622(107) 524(115)` | 39.1 | 13 622 524 | 13 622 524 | 13 622 524 | 13 622 524 | 13 622 524 | 13 622 524 | 13 622 524 | 13 622 524 |
| 957383327 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 123 499 754 | 12 499 754 | `123(65) 499(113) 754(112)` | 38.8 | 123 499 754 | 123 499 754 | – | 123 499 754 | – | – | – | – |
| 976006631 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 13 193 349 | 12 601 649 | `13(65) 193(107) 349(115)` | 38.8 | 13 193 349 | 13 193 349 | 13 193 349 | 13 193 349 | 13 193 349 | 13 193 349 | 13 193 349 | 13 193 349 |
| 976865251 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 13 986 160 | 12 986 160 | `13(65) 986(110) 160(112)` | 38.8 | 13 986 160 | 13 986 160 | 13 986 160 | 13 986 160 | 13 986 160 | 13 986 160 | 13 986 160 | 13 986 160 |
| 979955138 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 13 234 410 | 12 234 410 | `13(65) 234(113) 410(115)` | 38.8 | 13 234 410 | 13 234 410 | 13 234 410 | 13 234 410 | 13 234 410 | 13 234 410 | 13 234 410 | 13 234 410 |
| 981164660 | 2021 | current | salgsinntekt>sum_driftsinntekter | 7 908 455 | 7 857 325 | `7(28) 908(112) 455(112)` | 39.5 | 7 908 455 | 7 908 455 | 7 908 455 | 7 908 455 | 7 908 455 | 7 908 455 | – | – |
| 981164660 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 949 093 320 | 9 162 315 | `949(27) 093(107) 320(115)` | 39.5 | – | – | – | – | – | – | – | – |
| 981479076 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 13 510 954 | 12 511 094 | `13(65) 510(113) 954(112)` | 38.8 | 13 510 954 | 13 510 954 | 13 510 954 | 13 510 954 | 13 510 954 | 13 510 954 | 13 510 954 | 13 510 954 |
| 982375681 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 123 518 056 | 12 518 056 | `123(65) 518(113) 056(112)` | 38.8 | 123 518 056 | 123 518 056 | – | 123 518 056 | – | – | – | – |
| 982433223 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 13 227 783 | 12 251 130 | `13(65) 227(113) 783(110)` | 39.5 | 13 227 783 | 13 227 783 | 13 227 783 | 13 227 783 | 13 227 783 | 13 227 783 | 13 227 783 | 13 227 783 |
| 982927722 | 2022 | current | salgsinntekt>sum_driftsinntekter | 28 728 977 | 28 728 872 | `28(73) 728(112) 977(110)` | 39.1 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 |
| 982927722 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 28 728 977 | 28 728 872 | `28(70) 728(110) 977(112)` | 38.8 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 | 28 728 977 |
| 984337639 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 20 531 971 | 20 531 911 | `20(70) 531(115) 971(115)` | 38.8 | 20 531 971 | 20 531 971 | 20 531 971 | 20 531 971 | 20 531 971 | 20 531 971 | 20 531 971 | 20 531 971 |
| 984794452 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 385 671 062 | 38 671 062 | `385(70) 671(112) 062(110)` | 39.5 | 385 671 062 | 385 671 062 | – | – | – | – | – | – |
| 985094888 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 13 751 822 | 12 751 822 | `13(65) 751(112) 822(110)` | 39.5 | 13 751 822 | 13 751 822 | 13 751 822 | 13 751 822 | 13 751 822 | 13 751 822 | 13 751 822 | 13 751 822 |
| 985094888 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 158 917 294 | 18 917 294 | `158(67) 917(110) 294(115)` | 38.8 | 158 917 294 | 158 917 294 | – | 158 917 294 | – | – | – | – |
| 985874581 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 94 780 456 | 9 780 456 | `94(27) 780(110) 456(115)` | 39.1 | – | – | – | – | – | – | – | – |
| 985874581 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 13 053 396 | 12 053 396 | `13(65) 053(107) 396(115)` | 38.8 | 13 053 396 | 13 053 396 | 13 053 396 | 13 053 396 | 13 053 396 | 13 053 396 | 13 053 396 | 13 053 396 |
| 986051155 | 2024 | current | salgsinntekt>sum_driftsinntekter | 19 074 463 | 18 946 989 | `19(70) 074(112) 463(110)` | 38.8 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 |
| 986051155 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 19 074 463 | 18 946 989 | `19(67) 074(110) 463(113)` | 38.8 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 | 19 074 463 |
| 986977740 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 223 601 024 | 22 601 024 | `223(68) 601(112) 024(112)` | 39.1 | 223 601 024 | 223 601 024 | – | – | – | – | – | – |
| 987493453 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 123 053 663 | 12 053 663 | `123(65) 053(107) 663(110)` | 38.8 | 123 053 663 | 123 053 663 | – | 123 053 663 | – | – | – | – |
| 989364413 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 13 018 101 | 12 297 874 | `13(65) 018(110) 101(115)` | 38.8 | 13 018 101 | 13 018 101 | 13 018 101 | 13 018 101 | 13 018 101 | 13 018 101 | 13 018 101 | 13 018 101 |
| 990452458 | 2025 | current | kundefordringer>api_sum_omloepsmidler | 16 121 376 | 15 303 845 | `16(70) 121(115) 376(112)` | 38.8 | 16 121 376 | 16 121 376 | 16 121 376 | 16 121 376 | 16 121 376 | 16 121 376 | 16 121 376 | 16 121 376 |
| 991939490 | 2021 | current | salgsinntekt>sum_driftsinntekter | 123 423 183 | 12 423 183 | `123(67) 423(113) 183(108)` | 39.5 | 123 423 183 | 123 423 183 | – | 123 423 183 | – | – | – | – |
| 991939490 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 13 403 428 | 12 403 428 | `13(65) 403(110) 428(115)` | 38.8 | 13 403 428 | 13 403 428 | 13 403 428 | 13 403 428 | 13 403 428 | 13 403 428 | 13 403 428 | 13 403 428 |
| 993452890 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 15 546 803 | 14 321 602 | `15(67) 546(113) 803(110)` | 39.5 | 15 546 803 | 15 546 803 | 15 546 803 | 15 546 803 | 15 546 803 | 15 546 803 | 15 546 803 | 15 546 803 |
| 993452890 | 2022 | current | salgsinntekt>sum_driftsinntekter | 31 580 152 | 29 952 219 | `31(75) 580(115) 152(108)` | 39.1 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 |
| 993452890 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 31 580 152 | 29 952 219 | `31(73) 580(113) 152(110)` | 38.8 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 | 31 580 152 |
| 993452890 | 2024 | current | salgsinntekt>sum_driftsinntekter | 28 552 282 | 28 483 559 | `28(73) 552(113) 282(110)` | 38.8 | 28 552 282 | 28 552 282 | 28 552 282 | 28 552 282 | 28 552 282 | 28 552 282 | 28 552 282 | 28 552 282 |
| 993492353 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 385 254 693 | 38 254 693 | `385(70) 254(113) 693(110)` | 38.8 | 385 254 693 | 385 254 693 | 385 254 693 | 385 254 693 | – | – | – | – |
| 993555002 | 2024 | current | salgsinntekt>sum_driftsinntekter | 32 152 746 | 32 149 506 | `32(70) 152(110) 746(110)` | 38.8 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 |
| 993555002 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 32 152 746 | 32 149 506 | `32(68) 152(107) 746(112)` | 38.8 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 | 32 152 746 |
| 994925687 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 485 254 952 | 48 254 952 | `485(70) 254(113) 952(110)` | 38.8 | 485 254 952 | 485 254 952 | 485 254 952 | 485 254 952 | – | – | – | – |
| 995772957 | 2021 | current | salgsinntekt>sum_driftsinntekter | 172 940 365 | 12 940 365 | `172(67) 940(112) 365(112)` | 39.5 | 172 940 365 | 172 940 365 | – | 172 940 365 | – | – | – | – |
| 995772957 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 123 940 365 | 12 940 365 | `123(65) 940(110) 365(115)` | 39.1 | 123 940 365 | 123 940 365 | – | 123 940 365 | – | – | – | – |
| 995992566 | 2023 | current | leverandorgjeld>sum_kortsiktig_gjeld | 106 979 580 | 23 750 384 | `106(70) 979(112) 580(112)` | 38.8 | 106 979 580 | 106 979 580 | 106 979 580 | 106 979 580 | – | 106 979 580 | – | – |
| 996296490 | 2024 | current | salgsinntekt>sum_driftsinntekter | 23 537 239 | 23 537 119 | `23(70) 537(115) 239(112)` | 38.8 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 |
| 996296490 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 23 537 239 | 23 537 119 | `23(68) 537(113) 239(115)` | 38.8 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 | 23 537 239 |
| 996678601 | 2022 | current | salgsinntekt>sum_driftsinntekter | 31 955 294 | 29 950 723 | `31(75) 955(112) 294(112)` | 39.1 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 |
| 996678601 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 31 955 294 | 29 950 723 | `31(73) 955(110) 294(115)` | 38.8 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 | 31 955 294 |
| 996678601 | 2024 | current | salgsinntekt>sum_driftsinntekter | 27 664 915 | 27 604 950 | `27(73) 664(112) 915(110)` | 38.8 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 |
| 996678601 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 27 664 915 | 27 604 950 | `27(70) 664(110) 915(112)` | 38.8 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 | 27 664 915 |
| 997001877 | 2023 | current | salgsinntekt>sum_driftsinntekter | 21 218 123 | 21 208 123 | `21(75) 218(115) 123(108)` | 38.8 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 |
| 997001877 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 21 218 123 | 21 208 123 | `21(73) 218(113) 123(110)` | 38.8 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 | 21 218 123 |
| 997444345 | 2023 | current | kundefordringer>api_sum_omloepsmidler | 106 158 784 | 13 452 427 | `106(70) 158(112) 784(110)` | 38.8 | 106 158 784 | 106 158 784 | 106 158 784 | 106 158 784 | – | 106 158 784 | – | – |
| 997465733 | 2021 | current | salgsinntekt>sum_driftsinntekter | 23 469 218 | 23 202 146 | `23(70) 469(115) 218(112)` | 39.5 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 |
| 997465733 | 2022 | current | salgsinntekt>sum_driftsinntekter | 23 528 793 | 23 424 642 | `23(70) 528(115) 793(108)` | 39.1 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 |
| 997465733 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 23 469 218 | 23 202 146 | `23(68) 469(113) 218(115)` | 39.1 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 | 23 469 218 |
| 997465733 | 2023 | current | salgsinntekt>sum_driftsinntekter | 22 694 075 | 22 665 320 | `22(70) 694(112) 075(110)` | 38.8 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 |
| 997465733 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 23 528 793 | 23 424 642 | `23(68) 528(113) 793(110)` | 38.8 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 | 23 528 793 |
| 997465733 | 2024 | current | salgsinntekt>sum_driftsinntekter | 18 052 061 | 18 007 606 | `18(70) 052(110) 061(113)` | 38.8 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 |
| 997465733 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 22 694 075 | 22 665 320 | `22(68) 694(110) 075(112)` | 38.8 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 | 22 694 075 |
| 997465733 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 18 052 061 | 18 007 606 | `18(67) 052(107) 061(115)` | 38.8 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 | 18 052 061 |
| 997950879 | 2023 | current | salgsinntekt>sum_driftsinntekter | 31 102 026 | 30 142 434 | `31(75) 102(110) 026(110)` | 38.8 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 |
| 997950879 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 31 102 026 | 30 142 434 | `31(73) 102(107) 026(112)` | 38.8 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 | 31 102 026 |
| 998003334 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 123 551 813 | 16 026 509 | `123(65) 551(115) 813(110)` | 39.5 | 123 551 813 | 123 551 813 | – | 123 551 813 | – | – | – | – |
| 998054419 | 2023 | current | salgsinntekt>sum_driftsinntekter | 29 870 814 | 29 774 367 | `29(73) 870(112) 814(110)` | 38.8 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 |
| 998054419 | 2024 | current | salgsinntekt>sum_driftsinntekter | 28 594 706 | 28 518 046 | `28(73) 594(115) 706(110)` | 38.8 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 |
| 998054419 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 29 870 814 | 29 774 367 | `29(70) 870(110) 814(112)` | 38.8 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 | 29 870 814 |
| 998054419 | 2025 | current | salgsinntekt>sum_driftsinntekter | 20 750 932 | 20 666 939 | `20(73) 750(112) 932(108)` | 38.8 | 20 750 932 | 20 750 932 | 20 750 932 | 20 750 932 | 20 750 932 | 20 750 932 | 20 750 932 | 20 750 932 |
| 998054419 | 2025 | prior | salgsinntekt>sum_driftsinntekter | 28 594 706 | 28 518 046 | `28(70) 594(113) 706(112)` | 38.8 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 | 28 594 706 |
| 998359767 | 2023 | current | salgsinntekt>sum_driftsinntekter | 10 847 938 | 10 740 781 | `10(70) 847(112) 938(110)` | 38.8 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 |
| 998359767 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 10 847 938 | 10 740 781 | `10(67) 847(110) 938(112)` | 38.8 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 | 10 847 938 |
| 998580706 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 123 277 650 | 12 277 650 | `123(65) 277(113) 650(112)` | 38.8 | 123 277 650 | 123 277 650 | – | 123 277 650 | – | – | – | – |
| 998859247 | 2022 | prior | salgsinntekt>sum_driftsinntekter | 3 390 695 | 2 765 563 | `3(28) 390(113) 695(112)` | 39.1 | 3 390 695 | 3 390 695 | 3 390 695 | 3 390 695 | 3 390 695 | 3 390 695 | – | – |
| 998859247 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 949 193 966 | 9 339 555 | `949(27) 193(107) 966(112)` | 38.8 | – | – | – | – | – | – | – | – |
| 999104134 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 13 019 382 | 12 019 382 | `13(65) 019(110) 382(113)` | 38.8 | 13 019 382 | 13 019 382 | 13 019 382 | 13 019 382 | 13 019 382 | 13 019 382 | 13 019 382 | 13 019 382 |
| 999104134 | 2024 | current | salgsinntekt>sum_driftsinntekter | 56 076 791 | 38 053 933 | `56(73) 076(112) 791(113)` | 38.8 | 56 076 791 | 56 076 791 | 56 076 791 | 56 076 791 | 56 076 791 | 56 076 791 | 56 076 791 | 56 076 791 |
| 999104134 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 50 120 211 | 35 334 215 | `50(70) 120(110) 211(118)` | 38.8 | 50 120 211 | 50 120 211 | 50 120 211 | 50 120 211 | 50 120 211 | 50 120 211 | 50 120 211 | 50 120 211 |
| 999159958 | 2021 | prior | salgsinntekt>sum_driftsinntekter | 949 351 908 | 9 474 816 | `949(27) 351(115) 908(112)` | 39.5 | – | – | – | – | – | – | – | – |
| 999307523 | 2023 | prior | salgsinntekt>sum_driftsinntekter | 123 027 690 | 12 029 820 | `123(65) 027(110) 690(112)` | 38.8 | 123 027 690 | 123 027 690 | – | 123 027 690 | – | – | – | – |
| 999307523 | 2024 | prior | salgsinntekt>sum_driftsinntekter | 13 159 221 | 12 162 652 | `13(65) 159(110) 221(118)` | 38.8 | 13 159 221 | 13 159 221 | 13 159 221 | 13 159 221 | 13 159 221 | 13 159 221 | 13 159 221 | 13 159 221 |

Printed sub-total rows found in the reference documents (documents with the row):

- sum_fordringer: 19 of 20
- sum_omlopsmidler: 8 of 20
- sum_anleggsmidler: 19 of 20
- annen_driftsinntekt: 12 of 20
- sum_bankinnskudd: 0 of 20
