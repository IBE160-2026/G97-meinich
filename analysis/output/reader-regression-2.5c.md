# The reader before and after Story 2.5c, on cached words

Written by `analysis/ocr/reader_regression.py`: every document whose recognised words the probes cached, read with `ingest/src` at `e87f166` and at `c716bbd` (the last commit to `ingest/`), on the host, no OCR. Totals only.

`varer` origin: where the old figure came from, found by running the old reader's `layout.extract` on its income-statement pages alone and on its balance pages alone. A changed `varer` whose old figure came from a balance row is a real stock the new reader lost.

## The Story 2.5c probe's documents, set draw

Documents 100, columns 200; columns with c1–c4 changed: 0; figures refused, `varer` aside: 6.

| Field: kind | Figures |
|---|---|
| avskrivninger: refused | 3 |
| forskning_og_utvikling: refused | 1 |
| varekostnad: refused | 2 |
| varer: changed | 1 |
| varer: refused | 3 |

| `varer` changed: origin of the old figure | Columns |
|---|---|
| old figure from income statement row (negative) | 4 |

## The Story 2.5c probe's documents, set not_summing

Documents 44, columns 88; columns with c1–c4 changed: 0; figures refused, `varer` aside: 13.

| Field: kind | Figures |
|---|---|
| avskrivninger: refused | 8 |
| salgsinntekt: refused | 2 |
| varekostnad: refused | 3 |
| varer: changed | 2 |
| varer: new | 1 |
| varer: refused | 2 |

| `varer` changed: origin of the old figure | Columns |
|---|---|
| not read before | 1 |
| old figure from income statement row | 1 |
| old figure from income statement row (negative) | 3 |

## The Story 2.5c probe's documents, set ordering

Documents 180, columns 360; columns with c1–c4 changed: 0; figures refused, `varer` aside: 58.

| Field: kind | Figures |
|---|---|
| avskrivninger: refused | 2 |
| forskning_og_utvikling: refused | 2 |
| salgsinntekt: refused | 53 |
| varekostnad: refused | 1 |
| varer: changed | 6 |
| varer: new | 1 |
| varer: refused | 5 |

| `varer` changed: origin of the old figure | Columns |
|---|---|
| not read before | 1 |
| old figure from income statement row | 4 |
| old figure from income statement row (negative) | 7 |

## The Story 2.5c probe's documents, set reference

Documents 20, columns 40; columns with c1–c4 changed: 0; figures refused, `varer` aside: 0.

| Field: kind | Figures |
|---|---|

| `varer` changed: origin of the old figure | Columns |
|---|---|

## The Story 2.5c probe's 344 documents

Documents 344, columns 688; columns with c1–c4 changed: 0; figures refused, `varer` aside: 77.

| Field: kind | Figures |
|---|---|
| avskrivninger: refused | 13 |
| forskning_og_utvikling: refused | 3 |
| salgsinntekt: refused | 55 |
| varekostnad: refused | 6 |
| varer: changed | 9 |
| varer: new | 2 |
| varer: refused | 10 |

| `varer` changed: origin of the old figure | Columns |
|---|---|
| not read before | 2 |
| old figure from income statement row | 5 |
| old figure from income statement row (negative) | 14 |

## Every cached document (363)

Documents 363, columns 726; columns with c1–c4 changed: 0; figures refused, `varer` aside: 77.

| Field: kind | Figures |
|---|---|
| avskrivninger: refused | 13 |
| forskning_og_utvikling: refused | 3 |
| salgsinntekt: refused | 55 |
| varekostnad: refused | 6 |
| varer: changed | 9 |
| varer: new | 2 |
| varer: refused | 10 |

| `varer` changed: origin of the old figure | Columns |
|---|---|
| not read before | 2 |
| old figure from income statement row | 5 |
| old figure from income statement row (negative) | 14 |

