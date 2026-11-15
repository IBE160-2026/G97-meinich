---
title: 'Story 3.1a: The engine computes every key figure'
type: 'feature'
created: '2026-11-15'
status: 'ready-for-dev'
baseline_commit: '365d51b00223905e6ec4cd4969889746755434b6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/docs/key-figures.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The engine computes only figures 1, 12 and 13. The twelve document figures (2–11, 14, kontantandel) exist only as absences (`src/engine/document-absence.ts`, Story 2.9, "null: 3.1a computes it"). No identity is tested, and no kroner exist for (9), (10) or (11) (FR-21, FR-23, FR-24, FR-29, NFR28/SM-6; issue #66).

**Approach:** Add pure engine functions that turn a company's document basis and API inputs into every figure's value or absence, its direction, its comparison and its kroner at full convergence. Pin each one with hand-calculated reference cases from the OCR reference set's transcriptions, and pin the identities with exact rational arithmetic. Settle Epic 2 retro B1–B3. Nothing is rendered: Story 3.1b shows the figures.

**Decisions (Meinich, 2026-11-15):**

1. **Empty cost lines.** These are the five cost lines `varekostnad`, `lonnskostnad`, `avskrivninger`, `nedskrivninger` and `annenDriftskostnad` of one current column, derived from its stated `sumDriftskostnad`. The remainder is `sumDriftskostnad` minus the stated lines.
   - **A remainder within ±5 kr (inclusive)** is the register's rounding. Every empty line is then derived as 0, also when the remainder is positive, with one empty line or several.
   - **Exactly one line empty and a remainder above +5 kr.** The line is derived as the remainder. AGENTS.md: "Derive missing components … do not default to zero."
   - **Exactly one line empty and a remainder below −5 kr.** The line is undefined (`component_missing`).
   - **Several lines empty and the remainder outside ±5 kr.** Each one is undefined (`component_missing`).
   - **Every derived line is marked `derived`.**
   - **Lines with no total to derive from.** Balance lines and `salgsinntekt` stay undefined when empty.
   - **Where the rule is written.** It is added to `docs/key-figures.md` in the same commit as its code.
   - **Measured on 2 614 reconciled current columns:** 1 962 get all five lines (41 with none empty, 959 with one and the remainder within ±5 kr, 37 with one and the remainder above 5 kr, 925 with several and the remainder within ±5 kr). 13 have one empty line and a remainder below −5 kr, and 639 have several empty and the remainder outside ±5 kr.
2. **Growth's prior column.** Revenue growth (14) uses the prior column only when it reconciled. It is undefined (`line_not_read_safely`) when that column's `api_check` fails on `sum_driftsinntekter`. A prior column with no API filing to check against (`api_check` `not_evaluable`) is used, and is recorded as an unguarded path under AD-15 in the technical note, with its count.
3. **B1.** The fingerprint keeps the stated document `sumDriftsinntekter`. The derived branch is unreachable on reconciled data (check c1). Fingerprints, digests, `pnpm derive` and the seed are unchanged.
4. **B2.** `pnpm derive` and the request path both read R3's `sumOmloepsmidler` from the filing in `register.document.brreg_id`, through one shared SQL fragment. The two differ in 0 of 2 778 current columns today.
5. **B3.** A fingerprint remainder bounded by an API subtotal (`sumAnleggsmidler`, `sumOmloepsmidler`) takes the between-sources rule, max(5 kr, 0.001 %). The cost-line remainder and the `sumEiendeler` fallback keep 5 kr. This changes 0 fingerprints today.
6. **Kroner outside NOK.** Figures 9, 10 and 11 give no kroner when the subject's filing is not in NOK. The engine returns its own reason, `not_nok`, as for profit (1). This is written into `docs/key-figures.md` in the same commit as its code.

## Boundaries & Constraints

**Always:**
- **Engine.** Pure functions in `src/engine`. Money is `bigint` øre or `Decimal` from `src/engine/decimal.ts`, never a `number`. Rounding happens only in `src/engine/format.ts`.
- **Formulas.** Each formula is exactly as in `docs/key-figures.md`. A formula or rule change edits that document and the code in the same commit.
- **Sources.** Every input of a document figure comes from one current column of one document. The only exception is growth (14), which also reads the same document's prior column. Document inputs pass `documentFigures` → `guardCurrentAssets`.
- **Derivation.** Derivations are one level deep, from stated values only, and marked `derived`. A derived denominator of 5 kr or less is not positive, and that includes a derived document `sumDriftsinntekter`.
- **Data rules.**
  - Reference cases come only from the OCR reference set's allow-listed orgnrs that are not in the labelled set (885583822, 911561972, 915338534, 915648479, 917397198, 917526729, 918618716, 927533235, 929821092, 936252710, 989081799, 992036079) or from Story 1.4's API cases.
  - Each case records orgnr, filing year and the page of the printed figure.
  - Any measurement over the database prints totals only.

**Never:**
- Rendering, or new copy in `nb.json`. If any text becomes necessary, Meinich sees it first.
- A migration.
- `pnpm classify`.
- Deleting a dump.
- Setting a missing value to 0 by default. A 0 derived under decision 1 is a derivation, not a default.
- A tolerance in an identity test.
- A new dependency, or a second decimal library.
- Any figure, fingerprint or classification per orgnr for the labelled set.
- A push before Meinich says so.

## I/O & Edge-Case Matrix

Rows are listed by test file and test name; "Fails if deleted" names the guard the implementation report removes and shows failing.

| Scenario | Input | Expected | Fails if deleted |
|---|---|---|---|
| Each formula | each reference case | value = hand fraction | `test/engine/reference-cases.test.ts` "{orgnr} {year}: {figure}" per figure |
| Wrong formula | formula altered | its test fails | same, one per figure |
| One empty, remainder > 5 kr | four stated lines, remainder +5.01 kr | that line = remainder, `derived` | `test/engine/document-key-figures.test.ts` "one empty cost line above 5 kr is the remainder" |
| Rounding | one or several empty, remainder −5 kr, 0, +5 kr | each empty line 0, `derived` | "a remainder within ±5 kr derives every empty line as 0" |
| One empty, remainder < −5 kr | remainder −5.01 kr | `component_missing` | "one empty cost line below −5 kr is undefined" |
| Several empty, remainder off | remainder ±5.01 kr | each `component_missing` | "several empty cost lines outside ±5 kr are undefined" |
| Prior fails API check | prior reconciled, `api_check` fail on revenue | 14 `line_not_read_safely` | "growth over a prior column the register disagrees with is not read safely" |
| Kroner not NOK | 9, 10, 11 worse than T, `valuta` USD | `not_nok`, no amount | `test/engine/document-benchmark.test.ts` "capital kroner outside NOK: not_nok" |
| B1 | reconciled column, revenue NULL | no fingerprint | `test/engine/fingerprint.test.ts` "a reconciled column with no stated revenue has no fingerprint"; `test/fingerprint-seed.test.ts` "every committed reconciled column states its revenue" |
| B2 | every current column | same `sum_omloepsmidler` in derive and request | `test/db/document-filing.test.ts` "derive and the request read the same sum_omloepsmidler for every current column" |
| B3 | API-bound remainder −5.01 kr on a subtotal > 501 000 kr | fingerprint; the same from `sumEiendeler` → `negative_balance_remainder` | `fingerprint.test.ts` "an API-bound remainder takes the between-sources rule; a within-document one takes 5 kr" |
| Derived doc revenue ≤ 5 kr | NULL revenue, parts give +5 kr | `undefined`/`denominator_not_positive` | `test/engine/document-key-figures.test.ts` "a derived document revenue of 5 kr or less is not positive" |
| Not 0 | a needed line NULL and underivable | `undefined`/`component_missing` | "an empty line is never 0" |
| R3 | `kundefordringer` > subtotal + max(5 kr, 0.001 %) | 9 and 11 `line_not_read_safely`; 10 defined | "a line above its API subtotal leaves 9 and 11 undefined" |
| Growth, prior failed | prior `failed_reconciliation` | 14 `component_missing` | `reference-cases.test.ts` "936252710 2024: revenue growth" |
| Negative equity | 927533235 2023 | 13 negative, defined | "927533235 2023: …" |
| Zero revenue | 989081799 2025 | revenue figures `denominator_not_positive` | "989081799 2025: …" |
| Non-calendar | 992036079 2023 as candidate and as subject | excluded at stage 2, in no distribution; subject gets no peers | `test/engine/peers.test.ts` "a non-calendar reference case is excluded at stage 2" |
| Identities | every case + generated øre | `Decimal.eq`, exact | `test/engine/identities.test.ts` "ROA = margin × turnover", "personnel share = per-FTE ratio" |
| No kroner | 3, 4, 5, 6, 8, 13, 14, kontantandel | `gap.kind === 'none'` | `test/engine/document-benchmark.test.ts` "no kroner without a translation" |
| No direction | 6, 8, 13, 14, kontantandel | `best === null` | "no direction: median and midtre halvdel only" |
| Kontantandel | — | not rankable | "kontantandel is never ranked" |
| Kroner 9, 10, 11 | r worse than T | exact hand vectors, `oneOff: true` | "receivable / payable / turnover capital at full convergence" |
| Strength | r at or beyond T | `strength`, no amount | "at or beyond beste fjerdedel: strength" |
| 11, T ≤ 0 | T = 0 | no amount, reason | "turnover target not positive: no amount" |
| Floor | subject has a value, 9 peers from the same source | `below_floor`, 9, no kroner | "below the floor: no comparison, no kroner" |

</frozen-after-approval>

## Code Map

- `src/engine/key-figures.ts` -- `computeApiKeyFigures`, `resolveApiInputs`, `ratio()` (private), `API_FIGURE_DIRECTIONS`, `DERIVED_ZERO_BOUND_ORE` -- reuse the ratio and the 5 kr bound for document revenue. Do not change the API outputs.
- `src/engine/document-inputs.ts` -- `documentFigures`, `guardCurrentAssets`, `documentRevenue` (`derived`), `documentBasis` (`current`, `prior`), `aboveSubtotal` and the `BETWEEN_SOURCES_*` constants (B3).
- `src/engine/document-absence.ts` -- `DOCUMENT_KEY_FIGURES` (number, lines, revenue, prior) and `documentFigureAbsence`. The new computation starts where this returns null.
- `src/engine/types.ts` -- `FigureResult` (`value`, `source`, `denominatorDerived`), `Absence`, `Comparison`, `MIN_PEERS`.
- `src/engine/statistics.ts` -- `compareFigure` already floors per source and gives `best: null` for `'none'`. Reuse it.
- `src/engine/benchmark.ts` -- `driftsmarginGap`, `KronerGap`, `benchmarkApiFigures`. Capital gaps go beside them.
- `src/engine/fingerprint.ts` -- `fingerprintOf` reads stated revenue (264–265), and `settled()` uses `ROUNDING_TOLERANCE_ORE` (187–193, 287–305): B1, B3.
- `scripts/derive.ts` 107–150 and `src/analysis/document-basis.ts` (`DOCUMENT_JOINS`, `documentBasisOf`) -- B2.
- `test/engine/reference-cases.test.ts` -- Story 1.4's API cases, inputs copied from `seed/demo/key_figures.csv`. Extend this file.
- `analysis/ocr-reference/transcriptions.csv` (Meinich's hand transcriptions, whole kroner) and `.local/ocr-reference/{orgnr}-{year}.pdf` (gitignored, for the page number); `seed/demo/document_column.csv`.
- Consumers of a changed `FigureResult` or `Comparison`: `src/analysis/absence-state.ts` (exhaustive switch), `src/components/analysis/key-figure-table.tsx`, `kroner-amount.ts`, `oversikt-hero.tsx`. Keep their shapes compatible.

## Tasks & Acceptance

**Execution:**
- [ ] `src/engine/fraction.ts` -- an exact bigint fraction (reduce, mul, `toDecimal` with one division) -- the identities hold exactly only in rationals.
- [ ] `src/engine/document-key-figures.ts` + `test/engine/document-key-figures.test.ts` -- figures 2–11, 14 and kontantandel from a basis, with directions, `rankable`, and decisions 1, 2 and 6 -- the core.
- [ ] `src/engine/benchmark.ts` -- `capitalGap` for 9, 10, 11 (`oneOff: true`, `strength`, `none` with reason), plus `benchmarkDocumentFigures` over `compareFigure` -- FR-24, FR-29.
- [ ] `test/engine/identities.test.ts` -- every reference case, plus 5 000 seeded-PRNG øre vectors (1 øre to 10¹⁸, both signs, 500/501 øre, 2⁵³ ± 1).
- [ ] `test/engine/reference-cases.test.ts` -- the document cases. The test asserts that each seed figure used equals the transcription. The page is recorded in a comment.
- [ ] `test/engine/peers.test.ts` -- the non-calendar case.
- [ ] B1, B2 and B3, as decided, with their tests.
- [ ] `docs/key-figures.md`, `docs/ai-log.md`, `AGENTS.md` (if it names something changed), and `deferred-work.md` -- in the same commits as their code.

**Acceptance Criteria:**
- Given the deferred FR-64 entry (derived numerators), when 3.1a lands, then `FigureResult` carries `derived` for every input of a figure, not only the denominator, so the entry closes here.
- Given a full `pnpm seed` → `pnpm restore:documents`, then the four counts are reported, and `pnpm test`, `pnpm test:db`, `pnpm test:ingest`, lint, typecheck and e2e (one worker) all pass.

## Design Notes

**Exact identities.** (d/r) × (r/a) evaluated in `Decimal` rounds twice, so it is not d/a. The engine computes each figure as a reduced `Fraction` and divides once, so the margin × turnover product reduces to the same fraction as ROA and gives an identical `Decimal`.

**A hand value.** A hand value is the printed figures from the PDF page as a fraction, for example 74 186 / 263 958. The test compares `Decimal(74186).div(263958)` with the engine's value.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- green.
- `pnpm test:db && pnpm test:ingest` -- green after `pnpm seed`.
- `pnpm restore:documents` -- the four counts printed.
- `pnpm build && pnpm test:e2e` -- green, `workers: 1`.
