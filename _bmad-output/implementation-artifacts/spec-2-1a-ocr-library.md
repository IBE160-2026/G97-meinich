---
title: 'Story 2.1a: Read a filed document (OCR library and image)'
type: 'feature'
created: '2026-10-19'
status: 'ready-for-dev'
baseline_commit: 'f6651e1b7256eb804a195a4b81f9ad0428fc111e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Twelve of the fifteen key figures need lines that exist only in the filed document, and that document is image-only. The spike in `analysis/ocr/` showed those lines can be read. It is analysis code, though, and has gaps: it runs Tesseract 5.3 from Bookworm, with no pinned model; it folds no look-alike letters; and its digits-only fallback is not gated on reconciliation.

**Approach:** Port the spike into step 1 as a pure library: `read_document(pdf bytes) → DocumentRead`. The library classifies page 1, reads both figure columns of the generated section and runs the four within-document checks. Step 1's image gains Tesseract 5.5 and the pinned `nor` best model. Every known OCR failure gets a fixture. There is no database, fetch or write; that is Story 2.1b. The acceptance criteria are in `epics.md` Story 2.1a, which wins on a conflict.

**Decisions (human, Meinich, 2026-10-19):**
- **PDF rendering.** PyMuPDF, pinned `==`, as in the spike, so the spike's measurement carries over. Its AGPL-3.0 licence is recorded in the stage-2 licence assessment (technical note, "Deferred", Hosted deployment).
- **Årsverk.** Årsverk is not read: it sits in the company's notes, outside the generated section. `deferred-work.md` names the two figures that stay absent (#7 and #8) and points to Story 2.9 for their reason.
- **The split.** Story 2.1 is split into 2.1a and 2.1b. 2.1a also removes `minimumReleaseAgeExclude` from `pnpm-workspace.yaml` (deferred-work).
- **Whole units only (at approval).** Figures are read only when "Beløp i:" is a bare currency code, which means whole units. Anything else gives the document no columns, never a guessed scale. That includes a unit or scale such as "NOK 1000" or "tusen kroner", and a header that cannot be read. The refusal is signalled in the output, not silent. A fixture with a unit in "Beløp i:" tests it.

**Decisions (agent, open to change at approval):**
- **Output shape.** The output is plain dataclasses, with no database type.
  - Fields:
    - `layout`: `generated`, `paper` or `unknown`.
    - `valuta`: the "Beløp i:" value when it is a bare `^[A-Z]{3}$` code. Otherwise `valuta` is None, both columns are absent, and `refusal = 'reporting_unit'` together with the raw header text says why. A generated document whose year header cannot be read is refused the same way, with `refusal = 'year_header'`.
    - Two `Column`s, `current` and `prior`. Each has the `year` from the year header, `figures: dict[field, int | None]` in whole kroner as printed, the check results `c1`…`c4` (`pass`, `fail` or `not_evaluable`) and `digits_pass_fields`.
  - Conversion to øre is Story 2.1b's writer.
- **The digits-pass gate.** A digits-only figure is kept only if both of these hold:
  - the field takes part in a check that is evaluable once the figure is filled in;
  - every evaluable check of that column then passes.
  - A field that is in no check never takes a digits-only figure. It is absent. This is stricter than the spike; Story 2.3 measures the cost.
- **Tolerance.** The checks use the spike's 5 kr absolute bound as one named constant. Story 2.2 moves it into configuration.
- **Target fields** are the generated-layout lines. They are:
  - the check totals;
  - the key-figure sources on these pages;
  - the fingerprint inputs: varer, sum immaterielle eiendeler and sum varige driftsmidler.
  - Names follow `docs/key-figures.md` in snake_case. Where that file has no name, they follow `register.key_figures`' transliteration.
- **Tesseract runs in-process.** Step 1 runs inside the image, so `tesseract` is called by subprocess, with no `docker run`. Pages run in parallel with `OMP_THREAD_LIMIT=1`. Any file handed to Tesseract (its page list) is written LF.
- **Two-sided verification.**
  - Committed fixtures: `979607008-2025.pdf` (NLOD, credited in the fixtures README), its recorded plain and digits TSVs, and `expected-979607008-2025.json`.
  - Host tests read the TSVs. The image check reads the PDF. Both must equal the same JSON.
  - Look-alike and split/merge cases are hand-built TSVs.

## Boundaries & Constraints

**Always:**
- A figure is absent (None), never 0 and never guessed.
- The only arithmetic is the four checks (AD-1).
- The image is pinned by tag, the Tesseract package by exact version, and `nor.traineddata` by commit and sha256, checked in the build.
- Every Python dependency is pinned with `==` (`test_pins.py`).
- Host `pnpm test:ingest` needs no Tesseract.

**Never:**
- Repair a non-digit into a digit.
- Use OCR confidence.
- Add a second Tesseract Dockerfile.
- Touch the database, `run.py`'s flow or the CLI arguments.
- Change `analysis/output/**`, whose bytes are checksummed.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected | What fails if the guard is deleted |
|---|---|---|---|
| Contract (host) | the 979607008/2025 TSVs | both columns, years 2025/2024 and `valuta` `NOK` equal the expected JSON | `test_documents.py::test_contract_979607008_2025` |
| Contract (image) | the PDF in the built image | the same JSON; `tesseract --version` is 5.5.x | CI step `ocr-image-check` (`python -m peerless_ingest.image_check`) |
| Paper cover | page 1 says "VEDLEGG TIL … regnskapsåret" | `paper`, no columns read | `test_layout.py::test_paper_cover_with_regnskapsaaret` |
| Unknown page 1 | neither heading | `unknown`, no columns | `test_layout.py::test_unknown_first_page` |
| Digits pass drops a digit | plain 6 228 521, digits "622821" | 6 228 521 | `test_documents.py::test_digits_never_override_plain` |
| Digits pass fills a gap | plain None; the column reconciles / does not | kept / None | `test_documents.py::test_digits_kept_only_if_column_reconciles` |
| Digits pass, field in no check | plain None for varekostnad | None | `test_documents.py::test_digits_unused_outside_checks` |
| Sum confusion | "Annen driftskostnad", "Sum innskutt egenkapital" | never matched to the sum fields | `test_layout.py::test_exact_first_no_sum_confusion` |
| s→o font | "Driftoreoultat" | matches `driftsresultat` | `test_layout.py::test_s_to_o_fuzzy` |
| Look-alike labels | Cyrillic `Р` in the heading; "Lonnskostnad", "Arsresultat" | they match | `test_layout.py::test_lookalike_heading_and_diacritics` |
| Look-alike figures | `이`, `o`, `l` in a token | None | `test_layout.py::test_non_digit_token_is_absent` |
| Bad grouping | "12 34 567", groups more than one space apart | None | `test_layout.py::test_only_generated_digit_groups` |
| Unit in "Beløp i:" | "Beløp i: NOK 1000"; "Beløp i: tusen kroner"; the header missing or unreadable | `generated`, no columns, `refusal='reporting_unit'` | `test_documents.py::test_scaled_or_unreadable_unit_gives_no_columns` |
| Split/merge | `722 632 310`, `8 335 514` | the column's check that uses it is `fail` | `test_documents.py::test_split_merge_fails_check` |
| Wrapped label | "Avskrivning på varige / driftsmidler og / immaterielle eiendeler" | matches `avskrivning` | `test_layout.py::test_wrapped_label_joins_rows` |
| CRLF | a page list written on Windows | no `\r` in the bytes | `test_ocr.py::test_page_list_is_lf` |
| Second image | another Dockerfile installs tesseract | the test fails | `test/one-tesseract-image.test.ts` |

</frozen-after-approval>

## Code Map

- `analysis/ocr/ocr_accuracy.py`: the code to port. Do not edit its logic; switch its image only.
  - `render` (:112): PyMuPDF at `Matrix(2.5, 2.5)`, pages 1–4.
  - `ocr_all` (:122): `-l nor --psm 6 tsv`.
  - `read_tsv` (:157), `normalise` (:171), `group_lines` (:195).
  - `column_edges` (:203): pitch is (wa + wb)/8.
  - `parse_number` (:214), `parse_page` (:238): number zone, row tolerance 0.6·h + 8 px, continuation pages.
  - `similar` (:273, ≥ 0.85, length ±1), `extract` (:282, exact `endswith` first), `checks` (:325).
  - The combined read (:424): missing the gate.
  - Digits whitelist `0123456789-` (:67). `TARGETS` (:71) holds the label variants to extend.
- `analysis/ocr/era_screening.py:112` `classify`: the page-1 rule, at 150 dpi, top 30 %.
- `analysis/ocr/Dockerfile`: delete it. Point both spike scripts at `peerless-ingest:local` with `--entrypoint tesseract` (`era_screening.py:23`, `ocr_accuracy.py` docker call).
- `ingest/Dockerfile`:
  - It is `python:3.14.7-slim-trixie`, runs as non-root `ingest`, and ships no apt packages yet.
  - Add `apt-get install tesseract-ocr=<exact trixie 5.5 version>` with no `-nor` package.
  - `ADD`/curl `nor.traineddata` from `tesseract-ocr/tessdata_best` at a pinned commit into `TESSDATA_PREFIX`, then `sha256sum -c`.
- `ingest/pyproject.toml` + `uv.lock`: add `pymupdf==<exact>`.
- `ingest/src/peerless_ingest/`, new modules:
  - `ocr.py`: render, run tesseract, write the LF page list, parse the TSV.
  - `layout.py`: normalise and fold, classify, rows and edges, numbers, label match.
  - `documents.py`: `FIELDS`, the combined read, checks, `read_document`.
  - `image_check.py`: version, model hash, PDF vs JSON. Exits non-zero on a mismatch.
  - `fetch.py`, `run.py`, `write.py` and `parse.py` stay unchanged.
- `ingest/tests/`: follow `test_parse.py`'s style. `conftest.py` blocks outbound sockets, so keep that. The new `fixtures/documents/` goes with a README in the format of `fixtures/recorded/README.md` (NLOD credit).
- `.github/workflows/ci.yml:81-103`: after `docker build --tag peerless-ingest:ci ingest`, add a step that runs `image_check` with `fixtures/documents` mounted read-only.
- `test/one-tesseract-image.test.ts` (new, Vitest): globs every `Dockerfile*` outside `node_modules` and expects tesseract installs in exactly `ingest/Dockerfile`.
- `.gitattributes`: `ingest/** text eol=lf`, then `*.pdf binary` after it.
- `pnpm-workspace.yaml`: drop `minimumReleaseAgeExclude` and its comment. `pnpm install --frozen-lockfile` must still pass.

## Tasks & Acceptance

**Execution:**
- [ ] `ingest/Dockerfile`, `pyproject.toml`, `uv.lock`: Tesseract 5.5, the pinned model with its checksum, and pymupdf.
- [ ] `analysis/ocr/{Dockerfile,era_screening.py,ocr_accuracy.py}`: delete the Dockerfile and repoint both scripts to the one image.
- [ ] `ingest/src/peerless_ingest/{ocr,layout,documents,image_check}.py`: the port, plus folding, the gated digits pass and `valuta`.
- [ ] `ingest/tests/fixtures/documents/*`: generate the TSVs by running the image on the PDF, hand-build the trap TSVs, and write the expected JSON from Design Notes.
- [ ] `ingest/tests/test_{ocr,layout,documents}.py`: every matrix row.
- [ ] `test/one-tesseract-image.test.ts`, `.github/workflows/ci.yml`, `.gitattributes`, `pnpm-workspace.yaml`.
- [ ] Docs:
  - `docs/data-sources-brreg.md`: correct the "kept only where it reconciles" claim (:185) to the as-built gate, add the folding and "Beløp i".
  - `AGENTS.md`: add PyMuPDF and Tesseract to the stack line.
  - `docs/ai-log.md`: what could go wrong.
  - The session file.
  - The issue.

**Acceptance Criteria:** `epics.md` Story 2.1a and the matrix above. In addition: given a fresh clone, when `pnpm test:ingest` runs on a host without Tesseract, then it passes, and no test is skipped for a missing binary.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

**The expected JSON for 979607008/2025.** Values are whole kroner, read from the filed document.

| Field | 2025 | 2024 |
|---|---|---|
| salgsinntekt | 71 987 157 | 66 799 459 |
| sum inntekter | 72 632 310 | 69 051 006 |
| varekostnad | 1 327 425 | 744 327 |
| lønnskostnad | 55 582 660 | 52 967 147 |
| avskrivning | 5 429 357 | 5 512 071 |
| nedskrivning | 0 | 328 527 |
| annen driftskostnad | 10 170 865 | 10 468 045 |
| sum kostnader | 72 510 307 | 70 020 117 |
| driftsresultat | 122 003 | −969 111 |
| netto finans | −826 511 | −1 102 745 |
| resultat før skattekostnad | −704 508 | −2 071 857 |
| årsresultat | −1 541 009 | −2 611 560 |
| sum immaterielle eiendeler | 16 213 245 | 14 615 003 |
| sum varige driftsmidler | 1 197 768 | 2 102 723 |
| varer | None (heading only) | None |
| kundefordringer | 8 421 893 | 11 253 243 |
| sum bankinnskudd, kontanter og lignende | 2 115 356 | 4 502 513 |
| sum eiendeler | 31 073 544 | 35 615 025 |
| sum egenkapital | 7 764 189 | 9 305 198 |
| leverandørgjeld | 1 001 605 | 1 731 356 |
| sum kortsiktig gjeld | 18 676 023 | 18 009 823 |
| sum gjeld | 23 309 355 | 26 309 827 |
| sum egenkapital og gjeld | 31 073 544 | 35 615 025 |

How the checks come out:
- C1 is exact in both years. Sum inntekter is 1 kr off its own components, but no check uses those.
- C2 is exact in 2025. In 2024 it is 1 kr off (−2 071 856 against −2 071 857), inside the 5 kr bound.
- C3 and C4 are exact in both years.

The values above are a transcription and are hand-checked again against the PDF before the JSON is committed. "Nedskrivning 0" is a printed 0, so it is stored as 0, not None.

## Verification

**Commands:**
- `pnpm test:ingest`: passes on the host with no Tesseract.
- `docker build --tag peerless-ingest:ci ingest`, then `docker run --rm --mount type=bind,src=$PWD/ingest/tests/fixtures/documents,dst=/fixtures,ro --entrypoint /app/.venv/bin/python peerless-ingest:ci -m peerless_ingest.image_check /fixtures`: exits 0.
- `pnpm lint && pnpm typecheck && pnpm test`: passes, including `one-tesseract-image`.
- `pnpm install --frozen-lockfile`: passes without `minimumReleaseAgeExclude`.
