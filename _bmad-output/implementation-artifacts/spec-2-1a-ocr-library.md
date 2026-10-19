---
title: 'Story 2.1a: Read a filed document (OCR library and image)'
type: 'feature'
created: '2026-10-19'
status: 'done'
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
- [x] `ingest/Dockerfile`, `pyproject.toml`, `uv.lock`: Tesseract 5.5, the pinned model with its checksum, and pymupdf.
- [x] `analysis/ocr/{Dockerfile,era_screening.py,ocr_accuracy.py}`: delete the Dockerfile and repoint both scripts to the one image.
- [x] `ingest/src/peerless_ingest/{ocr,layout,documents,image_check}.py`: the port, plus folding, the gated digits pass and `valuta`.
- [x] `ingest/tests/fixtures/documents/*`: generate the TSVs by running the image on the PDF, hand-build the trap TSVs, and write the expected JSON from Design Notes.
- [x] `ingest/tests/test_{ocr,layout,documents}.py`: every matrix row.
- [x] `test/one-tesseract-image.test.ts`, `.github/workflows/ci.yml`, `.gitattributes`, `pnpm-workspace.yaml`.
- [x] Docs:
  - `docs/data-sources-brreg.md`: correct the "kept only where it reconciles" claim (:185) to the as-built gate, add the folding and "Beløp i".
  - `AGENTS.md`: add PyMuPDF and Tesseract to the stack line.
  - `docs/ai-log.md`: what could go wrong.
  - The session file.
  - The issue.

**Acceptance Criteria:** `epics.md` Story 2.1a and the matrix above. In addition: given a fresh clone, when `pnpm test:ingest` runs on a host without Tesseract, then it passes, and no test is skipped for a missing binary.

## Implementation Notes

- **Needs a human decision: Design Notes vs the gate.** Three figures in the Design Notes table cannot come out of the approved read: annen driftskostnad 2025 and leverandørgjeld 2025/2024. The plain pass misread a digit in each ("l0 170 8365", "l 001 605", "l 731 356"), and neither field is in a check, so the digits-only figure is refused (for annen driftskostnad it was also wrong, "101708365"). `expected-979607008-2025.json` holds the gated read with those three absent; every other value equals the table, re-checked against the PDF. `test_contract_979607008_2025` asserts both (`FILED_979607008_2025`, `ABSENT_BY_GATE`). If the table is meant as the read's output, the gate decision must change, not the JSON.
- **Field names.** `avskrivninger` and `nedskrivninger` (docs/key-figures.md), not the matrix's `avskrivning`. `bankinnskudd` is read from "Sum bankinnskudd, kontanter og lignende". The others are `register.key_figures`' names without `_ore`.
- **Output shape additions.** `DocumentRead.unit_text` carries the "Beløp i:" text as read (the "raw header text" of the refusal). Units that differ between pages are refused as `reporting_unit`. A missing year header is checked before the unit.
- **Tesseract.** In-process through `xargs -P 8 -a <page list> tesseract … tsv`, no shell. `nor.traineddata` goes into the package's own tessdata directory (`TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata`), because the `tsv` output config lives there. The image also carries Debian's `eng` and `osd` (dependencies of `tesseract-ocr`); only `nor` is used.
- **Spike scripts.** They keep `--entrypoint sh` (their shell loops are their logic, which the Code Map says not to edit) and gain `-w /work`, since the step-1 image's workdir is `/app`. The image runs as uid 10001, so on a Linux host the bind-mounted cache must be writable by it.
- **Hand-built TSVs** are generated in the tests by `ingest/tests/tsv_builder.py` in the recorded document's geometry, rather than committed as files, so each test states the word it is about.

## Spec Change Log

- **2026-10-19, Meinich (review, finding #1): the digits-only gate is amended.** A check confirms a digits-only figure only if at least one of its other operands came from the plain pass. Why: sum eiendeler and sum egenkapital og gjeld are printed as the same number, so the same dropped digit in both passed C3 on two wrong figures. The fix is applied as a review patch, with no revert. Test: both C3 totals digits-only with the same dropped digit → both absent. KEEP: everything else in the gate (plain never overridden; a field in no check takes no digits figure; any failing check drops the column's digits figures).
- **2026-10-19, Meinich (review): the three absent figures stand.** Annen driftskostnad 2025 and leverandørgjeld 2025/2024 are absent in the 979607008/2025 read: the plain pass misread a digit and neither field is in a check. The Design Notes table is the filed document, and `expected-979607008-2025.json` is the gated read. Sub-total checks that could confirm such fields are deferred to Story 2.2 (`deferred-work.md`).
- **2026-10-19 (implementation, recorded at review): names and spike entrypoint.** The field names follow `docs/key-figures.md`: `avskrivninger` and `nedskrivninger` where the matrix and Design Notes say `avskrivning`/`nedskrivning`, and `bankinnskudd` for "Sum bankinnskudd, kontanter og lignende". The spike scripts keep `--entrypoint sh` with `-w /work` rather than `--entrypoint tesseract`, because their shell loops are their logic and the Code Map forbids editing it.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge E2 | A digits-only figure can confirm itself when every operand of the passing check is digits-only (C3: sum eiendeler and sum EK og gjeld print the same number, and the same dropped digit gives equal misreads) | medium | `combine` counts any passing check; the two C3 totals are identical strings, so a consistent digits-pass misread passes C3. The frozen gate allows it. | intent_gap → resolved by Meinich: gate amended (Spec Change Log), patched without revert in `e468fcd` |
| 2 | edge E3, E4; blind B3 | Column years are never checked: not that prior = current − 1, and not that pages agree | medium | `read_words` takes the years from the first page with edges, unchecked; "2023" for "2025" passes `YEAR`. | patch — fixed in `bd6c4ad` |
| 3 | edge E8; blind B1 | A statement page with no readable year header and nothing to inherit loses all its rows silently, while a later page supplies edges | medium | `parse_page` returns `Page(kind, None, unit)` with no rows; `read_words` finds edges on page 3, so there is no refusal. | patch — fixed in `bd6c4ad` |
| 4 | edge E6; blind B2 | A statement page with its own year header but an unread "Beløp i:" is accepted when another page says NOK | medium | `units` skips None, so the whole-units rule holds only for the headers that were read. | patch — fixed in `bd6c4ad` |
| 5 | blind B4 | A standalone "-" is dropped before the gap check, so a stray dash in the number zone flips the sign | medium | `parse_number` removes the minus word from `words` before the gap loop. | patch — fixed in `bd6c4ad` |
| 6 | blind B6 | A row where the plain pass found nothing in the number zone is treated as label-only, so the digits pass can never fill it | medium | `has_number` reads only the plain `line`; such a row is never a candidate. | patch — fixed in `bd6c4ad` |
| 7 | blind B7 | A notes page inherits kind and edges, so a notes line can fill a field the statements lack (`varer`) | medium | The `parse_page` continuation rule has no end; page index 4 is parsed as balanse. | patch: no inheritance after "SUM EGENKAPITAL OG GJELD" — fixed in `bd6c4ad` |
| 8 | verif V1 | No test gates a digits-only figure in the prior column | medium | grep `prior=` in ingest/tests: none; the contract's prior column has no digits candidate in a check. | patch (test) — fixed in `bd6c4ad` |
| 9 | verif V2 | The image check cannot detect a broken real digits pass | medium | Expected JSON has no digits figure; `image_check` compares only the final read. | patch: compare the digits pages' extract with the recorded digits TSVs — fixed in `bd6c4ad` |
| 10 | verif V3 | `OcrError` paths are untested | low | grep `OcrError` in tests: none. Monkeypatch test is direct. | patch (test) — fixed in `bd6c4ad` |
| 11 | blind B5 | `CHECK_FIELDS` and `checks()` can drift | low | Two sources of truth; a derivation test pins them. | patch (test) — fixed in `bd6c4ad` |
| 12 | edge E14 | `image_check.differences` misses a key dropped from the read when expected is null | low | `got.get(key)` gives None == None. Direct correction. | patch — fixed in `bd6c4ad` |
| 13 | blind B8 | The AI-log entry's items 2, 4, 5 and "Caught by" name no test (AGENTS.md, L3) | medium | Entry text in the diff. | patch (docs) — fixed in `bd6c4ad` |
| 14 | blind B9 (part) | `docs/data-sources-brreg.md` omits `l 731 356` | low | Direct correction. | patch — fixed in `bd6c4ad` |
| 15 | blind B10 | The paper-cover regression is hand-built; the real `read_document` paper path never runs on a real document | low | `image_check` has only the 2025 generated PDF; 979607008-2011.pdf (paper) is cached. | patch: add it to the image check — fixed in `bd6c4ad` |
| 16 | blind B12 | README does not say the step-1 image now carries Tesseract or how to run the image check locally | low | README unchanged in the diff. | patch (docs) — fixed in `bd6c4ad` |
| 17 | blind B11 | The apt pin comes from the live trixie mirror; a replaced `5.5.0-1+b1` breaks the build, and leptonica floats | medium | `apt-get install tesseract-ocr=5.5.0-1+b1` with no snapshot source. | defer |
| 18 | blind B14 | `OcrError` carries no page or stderr line for diagnosis | low | `_run` message has the pass and exit only; 2.1b is the first caller and owns logging. | defer |
| 19 | blind B9 (rest) | Design Notes and matrix names (`avskrivning`) disagree with the code and the JSON | false | Spec edit, not code: recorded in the Spec Change Log after the human decision. | reject (spec) |
| 20 | verif other | Code Map says `--entrypoint tesseract`; the spike keeps `sh` | false | Spec edit; Implementation Notes record why. | reject (spec) |
| 21 | verif other | `classify` runs twice | low | Harmless and cheap. | reject |
| 22 | verif other | The hash test only matches Dockerfile text | low | Build `sha256sum -c` and `image_check` are the real guards; the test pins the two copies together, as intended. | reject |
| 23 | edge E1 | Overlapping tokens from two rows could join | low | The y window (0.6·h + 8 ≈ 35 px) is under half the 75 px line step; overlap needs a misplaced word. | reject |
| 24 | edge E5 | Edges could come from a notes page | low | Only if every statement page lacks a header, which #3 now refuses. | reject |
| 25 | edge E7 | A notes page's own scale could refuse a readable document | low | No generated notes page with "Beløp i:" seen; a refusal is safe. | reject |
| 26 | edge E9 | A one-page PDF is refused as `year_header` | low | Unlikely for a generated filing; a new refusal value is new surface. | reject |
| 27 | edge E10 | The fuzzy pass could reuse a row already matched exactly | low | Field variants differ by far more than the 0.85/±1 bound. | reject |
| 28 | edge E11, E12, E15 | Raw exceptions instead of `OcrError` / a traceback in `image_check` | false | They fail loudly; no silent fallback. | reject |
| 29 | edge E13 | `errors='replace'` could blank a label | low | A replaced character makes a figure None (safe) and a label unmatched; Tesseract writes UTF-8. | reject |
| 30 | edge E16 | An unset `TESSDATA_PREFIX` hashes a file in the cwd | false | The image sets it; the check runs only there. | reject |
| 31 | edge E17 | Other binaries under `ingest/` would get EOL treatment | low | None exist. | reject |
| 32 | blind B13 | The one-image test misses script installs and borrows a helper | low | Unlikely; works. | reject |

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
