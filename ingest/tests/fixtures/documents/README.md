# Filed documents

A filed annual-accounts document from Brønnøysundregistrene, its recorded Tesseract output, and the read it must give (Story 2.1a). The host tests read the recorded TSVs and need no Tesseract (`tests/test_documents.py`); the CI step `ocr-image-check` reads the PDF inside the built step-1 image (`python -m peerless_ingest.image_check`). Both must equal the same `expected-*.json`, so the two reads agree.

Inneholder data under Norsk lisens for offentlige data (NLOD) 2.0 tilgjengeliggjort av Brønnøysundregistrene (<https://data.norge.no/nlod/no/2.0>). Source: <https://data.brreg.no>.

| File | Source | Recorded | Used for |
|---|---|---|---|
| `979607008-2025.pdf` | `https://data.brreg.no/regnskapsregisteret/regnskap/aarsregnskap/kopi/979607008/2025` | 2026-09-26 (copied byte for byte from the gitignored `analysis/.cache/ocr`, fetched by `analysis/ocr/ocr_accuracy.py`) | The image check: the whole read from the PDF |
| `979607008-2025.top.tsv` | Tesseract 5.5.0, `nor` from tessdata_best `e12c65a`, in `peerless-ingest:local`: page 1's top 30 % at 150 dpi, plain pass (`ocr.ocr_top`) | 2026-10-19 | Page 1's classification in the contract test |
| `979607008-2025.p{2,3,4,5}.plain.tsv` | The same engine: zero-based pages 1–4 at 2.5x, plain pass (`ocr.ocr_figure_pages`) | 2026-10-19 | Labels and plain figures in the contract test |
| `979607008-2025.p{2,3,4,5}.digits.tsv` | The same pages, digits-only pass (`tessedit_char_whitelist=0123456789-`) | 2026-10-19 | The digits-only figures in the contract test |
| `expected-979607008-2025.json` | `documents.to_json` of the read, every figure hand-checked against the PDF (`FILED_979607008_2025` in `tests/test_documents.py`) | 2026-10-19 | The one expected read for both sides |

The expected read leaves three printed figures absent: annen driftskostnad 2025 and leverandørgjeld in both years. The plain pass misread a digit in each ("l0 170 8365", "l 001 605", "l 731 356"), and neither field is in a within-document check, so the digits-only figure is refused (`ABSENT_BY_GATE`). Story 2.3 measures what that gate costs.

To re-record after an engine change, run the two `ocr` functions in the image with a bind-mounted work directory, copy the TSVs here under these names, and check the expected read again by hand. A changed TSV or JSON is a changed measurement, never a formatting fix.
