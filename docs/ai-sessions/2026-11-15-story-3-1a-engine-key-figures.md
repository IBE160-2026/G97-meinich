# Story 3.1a: the engine computes every key figure

**Date:** 2026-11-15
**Tool:** Claude Code (Opus 5.5), running `bmad-build`. The BMAD session dispatched an implementation subagent and three review subagents.
**Story / issue:** #66, Story 3.1a
**Result:**
- Spec: `f5125af`.
- Engine and tests: `875b4cd` to `587fa86`.
- Review fixes: `dbc5140`.
- The PR is not opened yet (no push before Meinich says so).

## Goal

Compute every key figure in `docs/key-figures.md` in the engine, and pin each one with hand-calculated reference cases. Assert both identities exactly. Add the capital kroner for 9, 10 and 11. Decide Epic 2 retro items B1–B3.

## Prompts that mattered

- **Meinich's opening prompt** asked for a checkpoint before any code change, covering (a) to (h): deferred work, the key figures, derivation, reference cases, kroner, the floor, B1–B3 and the identities. Its rules: totals only for the labelled set, document figures only from allow-listed companies, and no push.
- **Meinich's answers at the checkpoint (2026-11-15)**, recorded as decisions 1–6 in the spec:
  - **Empty cost lines.** A remainder within ±5 kr is rounding and gives 0. With one empty line, a remainder above 5 kr is the line. Below −5 kr, or with several lines empty and the remainder outside ±5 kr, the lines are undefined. Meinich amended the BMAD session's proposal twice: first to derive one empty line from the remainder, then to treat ±5 kr as rounding in both cases.
  - **Growth.** It is not read safely when the prior column's API check fails on revenue.
  - **B1–B3.** All three as recommended.
  - **Kroner outside NOK.** No amount, with its own reason.
- **Meinich on the R3 matrix row:** "Koden følger docs/key-figures.md … og raden var feil."

## What came back, and what was done with it

- **Accepted:**
  - Exact bigint fractions divided once, so the identities hold with `Decimal.eq`.
  - `FigureResult.inputs`, which closes the deferred FR-64 entry.
  - `documentCostLines`, `computeDocumentKeyFigures`, `capitalGap`, `benchmarkDocumentFigures` and `DOCUMENT_FILING_JOIN`.
  - B3 in the fingerprint.
  - The reference cases from Meinich's transcriptions, with PDF pages.
- **Corrected by the BMAD session's matrix audit:** the spec's own R3 row, written by the BMAD session at planning, said that `kundefordringer` makes figure 11 undefined. The code followed the formula. Meinich decided to correct the row.
- **Corrected in review pass 1** (Blind Hunter, Edge Case Hunter and Verification Gap; all three run by the BMAD session):
  - Seven findings were fixed in `dbc5140`, among them an untested mapping of the prior column's API failures, and capital kroner computed from a rounded ratio rather than the filed øre.
  - Ten findings were rejected with their refutation.
  - The full triage is in the spec's Review Triage Log.
- **Not taken:** the derived document revenue is unreachable on reconciled data (B1). The 5 kr rule on it stays as a tested defensive branch, because the epics AC requires it.

## Measurements (totals only, local document run)

- **Empty cost lines:** 1 962 of 2 614 reconciled current columns get all five cost lines under decision 1.
- **Prior columns:** 1 017 of 2 430 reconciled prior columns cannot be checked against the API. They are recorded as unguarded under AD-15.
- **B2:** the two sources differ in 0 of 2 778 current columns.
- **B1 and B3:** both change 0 fingerprints.

## Links

- Spec: `_bmad-output/implementation-artifacts/spec-3-1a-the-engine-computes-every-key-figure.md`, with the Spec Change Log and the Review Triage Log.
- AI log: "2026-11-15 — Story 3.1a: every key figure computed, and the capital kroner of 9, 10 and 11".
- Documents updated: `docs/key-figures.md`, the technical note (AD-15, fingerprint rules), the PRD (FR-23, FR-58) and `AGENTS.md`.
