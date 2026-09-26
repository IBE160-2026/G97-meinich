# OCR consistency of the generated section, by era

Generated 2026-09-26 by `analysis/ocr/ocr_accuracy.py`. 18 companies from `filing-eras.md`; 185 filings in 2011–2016 and 2021–2025, of which 180 are generated. Tesseract 5, Norwegian model, untuned apart from the digits-only pass. Each filing gives two columns (this year, last year).

**This measures consistency, not accuracy.** No hand-transcribed truth exists yet. A column passes when every evaluable check holds within 5 kroner and both core checks (C1 income statement, C3 balance) could be evaluated.

## Plain pass (labels and figures from one read)

| Years | Filings | Figures recovered | Columns passing | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|---|---|
| 2011–2013 | 40 | 67 % | 96 % of 25 | 98 % | – | 100 % | 100 % |
| 2014–2016 | 51 | 73 % | 98 % of 46 | 98 % | 50 % | 100 % | 100 % |
| 2021–2025 | 89 | 94 % | 100 % of 127 | 100 % | 100 % | 100 % | 100 % |
| All | 180 | 82 % | 99 % of 198 | 99 % | 99 % | 100 % | 100 % |

## Digits-only pass for the figures

| Years | Filings | Figures recovered | Columns passing | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|---|---|
| 2011–2013 | 40 | 86 % | 67 % of 75 | 71 % | – | 96 % | 94 % |
| 2014–2016 | 51 | 87 % | 66 % of 94 | 78 % | 50 % | 97 % | 88 % |
| 2021–2025 | 89 | 99 % | 93 % of 166 | 95 % | 98 % | 99 % | 98 % |
| All | 180 | 93 % | 80 % of 335 | 85 % | 98 % | 98 % | 94 % |

## Combined: plain where well-formed, digits-only as fallback

| Years | Filings | Figures recovered | Columns passing | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|---|---|
| 2011–2013 | 40 | 86 % | 66 % of 76 | 70 % | – | 96 % | 94 % |
| 2014–2016 | 51 | 87 % | 66 % of 94 | 78 % | 50 % | 97 % | 88 % |
| 2021–2025 | 89 | 99 % | 93 % of 168 | 95 % | 98 % | 99 % | 98 % |
| All | 180 | 93 % | 80 % of 338 | 85 % | 98 % | 98 % | 94 % |

## Independent comparisons (combined)

- **Last year's column against the previous filing's own figure:** 1142 of 1217 agree (94 %). Two readings of the same figure from two different documents.
- **Latest filing against the key figures API:** 71 of 71 agree (100 %).

## Failing columns (combined)

| Orgnr | Year | Column | Failed |
|---|---|---|---|
| 834095742 | 2011 | last year | C1 |
| 834095742 | 2014 | last year | C4 |
| 834095742 | 2015 | this year | C1 |
| 834095742 | 2015 | last year | C1 |
| 874350672 | 2014 | last year | C4 |
| 874350672 | 2015 | last year | C1 |
| 874350672 | 2023 | this year | C1 |
| 911586738 | 2021 | this year | C1 |
| 931924672 | 2011 | last year | C1 |
| 931924672 | 2012 | this year | C1 |
| 931924672 | 2013 | last year | C1 |
| 931924672 | 2015 | this year | C1 |
| 933565831 | 2011 | last year | C1 |
| 933565831 | 2012 | this year | C1 |
| 933565831 | 2013 | this year | C1 |
| 933565831 | 2013 | last year | C1 |
| 933565831 | 2014 | this year | C3, C4 |
| 933565831 | 2014 | last year | C1 |
| 933565831 | 2015 | last year | C3, C4 |
| 933565831 | 2021 | last year | C4 |
| 942896204 | 2011 | this year | C1 |
| 942896204 | 2011 | last year | C1 |
| 942896204 | 2012 | this year | C4 |
| 942896204 | 2012 | last year | C1 |
| 942896204 | 2013 | this year | C1, C3, C4 |
| 942896204 | 2014 | last year | C1 |
| 942896204 | 2015 | this year | C1 |
| 950308508 | 2011 | this year | C3 |
| 950308508 | 2015 | this year | C4 |
| 950308508 | 2015 | last year | C4 |
| 950308508 | 2022 | this year | C1, C2 |
| 950308508 | 2023 | last year | C1, C2 |
| 976570626 | 2011 | last year | C1 |
| 976570626 | 2012 | this year | C1 |
| 976570626 | 2012 | last year | C3, C4 |
| 976570626 | 2016 | this year | C1 |
| 976570626 | 2022 | this year | C4 |
| 976570626 | 2023 | last year | C1, C3, C4 |
| 979775377 | 2011 | this year | C1, C4 |
| 979775377 | 2012 | this year | C1 |
| 979775377 | 2012 | last year | C1, C4 |
| 979775377 | 2013 | last year | C1 |
| 979775377 | 2015 | last year | C1 |
| 979775377 | 2016 | this year | C1, C4 |
| 979775377 | 2021 | this year | C1 |
| 979775377 | 2022 | last year | C1 |
| 979775377 | 2024 | last year | C1, C2 |
| 980015033 | 2014 | this year | C1 |
| 980015033 | 2015 | last year | C1 |
| 980015033 | 2016 | last year | C1 |
| 987307749 | 2011 | this year | C1 |
| 987307749 | 2011 | last year | C1 |
| 987307749 | 2012 | last year | C1 |
| 987307749 | 2023 | last year | C1 |
| 991051228 | 2013 | last year | C1 |
| 991051228 | 2014 | this year | C4 |
| 991051228 | 2014 | last year | C1 |
| 991051228 | 2015 | last year | C4 |
| 991051228 | 2016 | this year | C1 |
| 996941566 | 2015 | this year | C1 |
| 996941566 | 2015 | last year | C1 |
| 996941566 | 2016 | this year | C1 |
| 997003543 | 2014 | this year | C2, C4 |
| 997003543 | 2014 | last year | C4 |
| 997746848 | 2013 | last year | C1 |
| 997746848 | 2014 | this year | C1 |
| 997746848 | 2016 | last year | C1 |
| 998711282 | 2014 | this year | C1 |
| 998711282 | 2014 | last year | C4 |
| 998711282 | 2015 | last year | C1 |
| 998711282 | 2016 | last year | C3 |
