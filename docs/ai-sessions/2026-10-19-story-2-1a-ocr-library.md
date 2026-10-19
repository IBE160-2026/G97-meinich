# Story 2.1a: the OCR library and the one Tesseract image

**Date:** 2026-10-19
**Tool:** Claude Code (Opus 5.5): an orchestrating session and an implementation subagent working from the frozen spec
**Story / issue:** #31, Story 2.1a
**Result:** branch `story/2.1a-ocr-library`, commits `75e02d4`, `7801884`, `02397cb`, `c486dfa`, `1f66653` and the docs commit; PR to follow

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

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-2-1a-ocr-library.md` (Implementation Notes)
- AI log: "2026-10-19 — Story 2.1a: the OCR library and the one Tesseract image"
