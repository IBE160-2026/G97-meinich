# Story 2.1a: the OCR library and the one Tesseract image

**Date:** 2026-10-19
**Tool:** Claude Code (Opus 5.5): an orchestrating session and an implementation subagent working from the frozen spec
**Story / issue:** #31, Story 2.1a
**Result:** [PR #33](https://github.com/IBE160-2026/G97-meinich/pull/33), merged 2026-10-19, from branch `story/2.1a-ocr-library`: commits `75e02d4`, `7801884`, `02397cb`, `c486dfa`, `1f66653`, `77d0559` (docs), `e468fcd` (the human's digits-only rule), `bd6c4ad` (review fixes), `00913d5` (review record) and `e890a76` (PR link).

## Goal

Implement `_bmad-output/implementation-artifacts/spec-2-1a-ocr-library.md`: the spike's reading rules as a pure step-1 library, Tesseract 5.5 and the pinned `nor` model in step 1's image, and a regression test for every known OCR failure. No database.

## Prompts that mattered

To the implementation subagent, from the orchestrating session:

> Read C:\Dev\ibe160\_bmad-output\implementation-artifacts\spec-2-1a-ocr-library.md fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start.

From the human, passed on mid-task:

> commit this story in several logical commits on branch story/2.1a-ocr-library, not one commit at the end (AGENTS.md "Git workflow"). Each commit should be a coherent step that passes on its own, with a message saying what and why […] Do not push; never commit to main.

## What came back, and what was done with it

Commits:
- `75e02d4` `.gitattributes` (`ingest/** text eol=lf`, `*.pdf binary`) and `minimumReleaseAgeExclude` removed; `pnpm install --frozen-lockfile` still passes.
- `7801884` the image: `tesseract-ocr=5.5.0-1+b1`, `nor.traineddata` from `tessdata_best` `e12c65a` with `sha256sum -c`, `pymupdf==1.28.2`; `analysis/ocr/Dockerfile` removed, spike scripts repointed; `test/one-tesseract-image.test.ts`.
- `02397cb` `ocr.py` and `layout.py` with `test_ocr.py`, `test_layout.py` and the TSV builder.
- `c486dfa` `documents.py`: the combined read with its gate, the four checks, the refusals; `test_documents.py`.
- `1f66653` the 979607008/2025 fixture (PDF, recorded TSVs, expected JSON), the contract test, `image_check` and the CI step `ocr-image-check`.
- Docs: `docs/data-sources-brreg.md` (the as-built gate, folding, "Beløp i"), `AGENTS.md` (stack line), `docs/ai-log.md`, `deferred-work.md` (the release-age entry resolved), this file.

Choices made by the subagent, open to the human:
- **The expected JSON follows the gate, not the Design Notes table**, for three figures (annen driftskostnad 2025, leverandørgjeld both years). Recorded in the spec's Implementation Notes and in `docs/ai-log.md`; every other figure equals the table, checked against the PDF pages by eye.
- **PyMuPDF 1.28.2, not 2.0.** 2.0 was released on the day of the session; 1.28.2 (2026-08-06) is past any release-age window and has the `cp310-abi3` wheels Python 3.14 uses.
- **Tesseract through `xargs -P` over an LF page list**, no shell, so the page list that spike error 2 was about still exists and is tested.

Corrected during the session, caught by the subagent:
- The first image put `nor.traineddata` in its own `TESSDATA_PREFIX`; Tesseract then had no `tsv` config and wrote `.txt`. Moved into the package's tessdata directory.
- The first test of the split figure in the recorded words replaced both "72" tokens on page 2 (sum inntekter and sum kostnader), so C1 still passed. Now only the first.
- The first `.gitattributes` comment held a literal carriage return that split a comment line; git reported an invalid attribute and the text was rewritten.
- The first commit swept in the staged removal of `analysis/ocr/Dockerfile`; it was undone with a soft reset and the removal moved to the image commit.
- Each guard was checked by deleting it and running the tests: the label length rule, the gate, plain-over-digits and the look-alike fold each fail at least one test. The plain-over-digits check first went undetected, because the gate also rejected the overriding figure; `test_digits_never_override_plain` gained a case where the overriding figure would reconcile.

## Review

Three review layers ran on the diff: a blind reviewer with no context, an edge-case reviewer, and a verification-gap reviewer. They raised 32 findings, all triaged in the spec's Review Triage Log.

- **Human decisions (Meinich, 2026-10-19):**
  - **The digits-only gate is amended.** A check confirms a digits-only figure only against an operand from the plain pass. Raised by the edge-case reviewer: sum eiendeler and sum egenkapital og gjeld print the same number, so one dropped digit in both passed C3. Commit `e468fcd`, test `test_digits_never_confirm_each_other`, with no revert.
  - **Three figures stay absent.** Annen driftskostnad 2025 and leverandørgjeld 2025/2024 are absent from the 979607008/2025 read. Sub-total checks are deferred to Story 2.2.
- **Fixed in one commit, `bd6c4ad`, credited to the reviewer who raised each:**
  - Edge-case and blind reviewers:
    - year checks (prior = current − 1, every page agreeing);
    - a statement page with no year header to read or inherit now refuses;
    - a unit is required on every page with its own year header.
  - Blind reviewer:
    - the gap check now covers a standalone minus;
    - the digits pass may fill a row the plain pass left empty;
    - a notes page is no longer read after the balance sheet;
    - AI-log claims now name their tests;
    - the missing `l 731 356` is added;
    - a real paper cover is in the image check;
    - README lines for the image.
  - Verification-gap reviewer:
    - a test of the digits gate in the prior column;
    - the image check now compares the real digits pass;
    - tests of the `OcrError` paths.
  - Blind reviewer: a test that `CHECK_FIELDS` matches the checks.
  - Edge-case reviewer: `differences` reports a key missing on either side.
- **Deferred:**
  - The apt pin installs from the live Debian mirror (blind reviewer).
  - `OcrError` messages need diagnostic detail (blind reviewer). Both entries are in `deferred-work.md`.
- **Rejected:** 14 findings, each with its evidence in the triage log, among them overlapping tokens, raw exceptions that fail loudly, binaries that do not exist, and spec-only edits.
- **Verified by the orchestrating session after the fixes:**
  - `pnpm test:ingest`: 137 passed.
  - `pnpm test`: 753 passed.
  - lint, typecheck, pins and the frozen lockfile pass.
  - The image check reports "979607008-2011: matches" and "979607008-2025: matches".

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-1a-ocr-library.md` (Implementation Notes)
- AI log: "2026-10-19 — Story 2.1a: the OCR library and the one Tesseract image"

## Merge

The review was posted on PR #33 before merge as a GitHub review with five line comments, the first PR to follow retro action 10. The review session drafted the comments, and they were posted at the human's request, which the review's summary says. CI on `e890a76`, the first GitHub run of `ocr-image-check`, was green at 20:17, and the PR was merged at 20:22. The review session updated this header and the spec status on `main` after the merge.
