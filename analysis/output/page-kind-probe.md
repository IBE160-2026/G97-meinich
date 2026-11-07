# Does `page_kind` explain R4's gap? Story 2.5d's probe

Written by `analysis/ocr/page_kind_probe.py`: every document whose recognised words the probes cached, parsed with the working tree's `ingest/src`, on the host, no OCR. Totals only.

Documents cached 363; read with both columns 363; skipped (not generated, or no columns) 0.

## Pages

| Headings in the labels; the page's kind | Count |
|---|---|
| balance heading only; kind balanse | 444 |
| balance heading only; kind other | 101 |
| both headings, kind resultat: "balanse" only in "balanseført" | 4 |
| both headings; kind other | 66 |
| both headings; kind resultat | 4 |
| income-statement heading only; kind other | 4 |
| income-statement heading only; kind resultat | 363 |
| neither heading; kind balanse | 278 |
| neither heading; kind other | 69 |
| neither heading; kind resultat | 123 |

## Rows `varer` would match

| Page kind | Count |
|---|---|
| kind balanse | 78 |
| kind resultat | 14 |

## `varer` under another rule, against R4 as built

Per column. "Neighbour": the same company-year read from the neighbouring filing year's document, where cached.

| Rule: difference, origin, check | Count |
|---|---|
| any: changed, from the income statement's row, differs from the neighbour | 3 |
| any: changed, from the income statement's row, no neighbour cached | 6 |
| any: lost, from none, differs from the neighbour | 1 |
| any: lost, from none, no neighbour cached | 1 |
| any: new, from the income statement's row, differs from the neighbour | 1 |
| any: new, from the income statement's row, no neighbour cached | 9 |
| split: no column differs | 0 |

## The gap in the cache

| Column | Count |
|---|---|
| current: empty, the neighbouring year holds it; a balance `varer` row, plain figure refused or missing, digits pass differs from the neighbour | 1 |
| prior: empty, the neighbouring year holds it; a balance `varer` row, plain figure refused or missing, digits pass differs from the neighbour | 1 |
