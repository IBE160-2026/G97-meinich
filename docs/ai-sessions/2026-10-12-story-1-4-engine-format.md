# Story 1.4: the engine calculates and formats correctly

**Date:** 2026-10-12
**Tool:** Claude Code (Opus 5.5), `bmad-build` workflow: an orchestrating session and one implementation subagent working from the frozen spec
**Story / issue:** #5, Story 1.4
**Result:** branch `story/1.4-engine-format`, reviewed (blind hunter, edge-case hunter, verification gap) and committed; PR to follow.

## Goal

A pure engine for the three API key figures and their distributions, and the one display formatter, so that Stories 1.7–1.9 can put figures on a page that trace to a hand calculation.

## Prompts that mattered

- The dispatch to the implementation subagent: "Read `spec-1-4-engine-format.md` fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start."
- The human decisions frozen in the spec: derivation with a ±5 kr bound on derived denominators only (Q1 option a); dormant companies are a selection question for Story 1.7; currency is not the engine's (Stories 1.7 and 1.8 check `valuta`); reference cases carry their calculation step by step in kroner so one can be recomputed by hand before merge.

## What came back, and what was done with it

- **Accepted:**
  - `src/engine/decimal.ts` holds the one `Decimal.clone` (precision 40, `ROUND_HALF_UP`, `toExpNeg`/`toExpPos` ±9e15) and `roundHalfAwayFromZero`; `index.ts` does not re-export the rounding function, so only `format.ts` rounds.
  - Absence is `{ reason: 'undefined', cause } | { reason: 'below_floor', count } | { reason: 'not_in_dataset' } | { reason: 'failed_reconciliation' }`; a single figure's result cannot be `below_floor` (that is a comparison's absence).
  - A missing component is checked before the denominator's sign, so APP1 AS 2023 (no `driftsresultat`, stated zero revenue) reads `component_missing`, not `denominator_not_positive`.
  - `compareFigure` for an absent subject returns the count of defined peers whatever their source, since the subject has no source to match.
  - The formatter writes U+00A0 inside "mill. kr" as well as before it, so the unit never breaks across lines.
- **Corrected, and how it was caught:**
  - The reference-case comparison first compared 20-significant-digit strings; decimal.js drops a trailing zero (`0.59626431042383640310` prints as `…6403031`). The test now normalises the expected value through `Decimal` before comparing.
- **Verification:** `pnpm check:pins`, `check:env`, `lint`, `typecheck`, `pnpm test` (239), `pnpm test:db` (62, read-only on the local 1.3a data). Mutations tried and reverted: the derived bound set to 0, the bound applied to stated denominators, half-even rounding, and the `Intl` entry removed from the engine's lint list; each made tests fail.

## Review

Three review layers on the diff; 16 findings, triaged in the spec's Review Triage Log.
- **Patched (8):** a shuffled-peers test for `compareFigure` (deleting its sort broke no test); a document peer in the absent-subject count test; the decimal scan now also refuses an aliased `Decimal` and direct assignment to its settings; the `Intl.NumberFormat` globs cover `.cjs`/`.mts`/`.cts`; a catalog test ties `apiInputsFromRow`'s seven columns to `register.key_figures`; "exact" corrected to "40 significant digits" in comments; the ±5 kr bound worded as "5 kr or less"; two overstated claims in the AI-log entry corrected.
- **Deferred (4):** rounding/`toLocaleString` bans where numbers are displayed (Story 1.8, touches AGENTS.md); the app client's read types (Story 1.5); balance sheets that do not balance; numerator provenance for FR-64.
- **Rejected (4)**, with reasons in the triage log.
- After the patches: `pnpm test` 242, `pnpm test:db` 63, lint and typecheck clean.

## Links

- AI log: "2026-10-12 — Story 1.4: the engine's arithmetic and formatter, and where money can still go wrong".
- Updated: `docs/key-figures.md` (General rules: derivation and the ±5 kr bound), `AGENTS.md` (ESLint list, decimal.js), `deferred-work.md` (1.3a entry rewritten, dormant-company entry for 1.7), sprint status.
