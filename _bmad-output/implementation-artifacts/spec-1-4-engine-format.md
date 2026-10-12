---
title: 'Story 1.4: The engine calculates and formats correctly'
type: 'feature'
created: '2026-10-12'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/key-figures.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing computes or displays a key figure yet. Stories 1.7–1.9 need a pure engine for the three API figures and their distributions, and one formatter, before any figure reaches a page.

**Approach:**
- `src/engine`: one configured decimal.js constructor; the three API figures from øre inputs, with derivation of a missing input and named absence reasons; `PERCENTILE.INC` statistics, direction-aware beste fjerdedel and percentile, the 10-peer floor and the same-source rule.
- `src/engine/format.ts`: the only display formatter, per EXPERIENCE.md "Number formatting".
- A parser from postgres.js strings to `bigint`/`Decimal`.
- Story ACs: GitHub issue #5 and `epics.md` Story 1.4 (authoritative; `epics.md` wins on conflict).

**Decisions (human, 2026-10-12):**
- Branch `story/1.4-engine-format` from `main` at `a04346d`.
- **Derivation with a ±5 kr bound (Q1 option a).** A missing input is derived (Design Notes). A *derived* denominator within ±5 kr of zero counts as not positive → `undefined`/`denominator_not_positive`. A stated value is used as it is, however small. `docs/key-figures.md` states the reason: a derived figure inherits the rounding uncertainty of the totals it is computed from, so a derived amount within ±5 kr of zero cannot be told apart from zero. The bound applies to derived figures only.
- **Dormant companies are a selection question, not an engine one.** Companies with zero or near-zero revenue (4 268 filings in the seed) should not be peers at all; recorded in deferred-work for Story 1.7.
- **Currency is not the engine's.** The ratios are currency-neutral and the engine does not read `valuta`. `formatKroner`, `formatSignedKroner` and `formatMillions` write "kr" and assume NOK. The check belongs downstream: Story 1.7 refuses an unknown `valuta` (e.g. `EDT`) in stage 2 for subject and peers alike and never maps it to NOK; Story 1.8 shows a kroner amount only when the subject's `valuta` is `NOK`. The deferred-work entry from 1.3a is updated to say so.
- **Spec length:** kept whole, about 2 700 tokens (human).
- **Reference cases are hand-checkable:** each case in the test file carries a comment with the calculation step by step, in kroner, so the human can recompute at least one by hand before merge.

## Boundaries & Constraints

**Always:**
- Engine modules import only `decimal.js` (and only `src/engine/decimal.ts` does) and each other, with relative `.ts` imports, so Node step-2 scripts can run them later.
- Every ratio, statistic and intermediate is a `Decimal` from the engine's constructor: precision 40, `ROUND_HALF_UP` (half away from zero), `toExpNeg -9e15`, `toExpPos 9e15` so `toString()` never uses exponents.
- Rounding happens only in `format.ts`, through one `roundHalfAwayFromZero(value, places)`. No `Number()` on an amount or ratio anywhere.
- The formatter takes decimal strings and writes U+00A0 as thousands separator and before "kr", "%", "pp", "mill. kr" and "dager"; decimal comma; U+2212 minus. A value that rounds to zero has no sign.
- Absence is a discriminated union naming exactly one reason: `undefined` (cause `denominator_not_positive` or `component_missing`), `below_floor` (with count), `not_in_dataset`, `failed_reconciliation`. The last two are typed now and produced from Story 2.9.

**Never:**
- No kroner gap (Story 1.8, FR-29), no document figures or general component derivation (Stories 2.9, 3.1a), no database query or `src/server/db.ts` (Story 1.5), no UI.
- No `Intl.NumberFormat`, `Math.round` or `toFixed` for a figure.
- No second decimal library or `Decimal.clone`/`config`/`set` outside `src/engine/decimal.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| figures | øre `bigint` inputs | margin `driftsresultat/sumDriftsinntekter`, ROA `driftsresultat/sumEiendeler`, equity ratio `sumEgenkapital/sumEiendeler` |
| zero / negative denominator | `sumDriftsinntekter` 0; `sumEiendeler` −17 767 kr | that figure `undefined`/`denominator_not_positive`; the others still computed |
| missing, derivable | see Design Notes rules | figure computed from the derived input |
| derived ≈ 0 | `sumDriftsinntekter` NULL, derived 1 kr (JOAKIM BORDING 2025); also −5, +5, ±6 kr synthetic | within ±5 kr: margin `undefined`/`denominator_not_positive`; 6 kr: computed. A *stated* 1 kr revenue is computed |
| missing, underivable | `driftsresultat` and `sumDriftskostnad` NULL | margin and ROA `undefined`/`component_missing` (checked before the denominator) |
| quartiles | odd n, even n, ties | equal Excel `PERCENTILE.INC` at 0.25/0.5/0.75 (vectors hand-checked in the test) |
| direction | ↑ / ↓ / none | beste fjerdedel = upper / lower quartile / none; percentile none for equity ratio |
| percentile | subject vs peers | `(worse + 0.5 × equal) / n × 100`, exact; "61 %" |
| floor | 9 and 10 defined peers | 9: subject value + count only; 10: full comparison |
| left out | peers with absent value or other source | excluded from that figure only; `leftOut` returned |
| subject absent | subject figure undefined | absence reason + peer count; no statistics |
| rounding | −2.5, 2.5, −0.0005, 0.0005 | −3, 3, "−0,1 %", "0,1 %" |
| bytes | formatter | "1 170 000 kr", "−501 428 kr", "+1 019 571 kr", "16,7 mill. kr", "2,1 %", "61 %", "7,0 pp", "48 dager", "2,85", "6,5", "912 345 678" — exact code points pinned |
| parse | `"9007199254740993"`, `"1.5"`, `null`, `"1e3"`, a `number` | exact `bigint`/`Decimal`, `null`, throws, throws |

</frozen-after-approval>

## Code Map

- `eslint.config.mjs` -- `roundingRestriction` (engine and `*format*` files) and `serverImportRestriction`. Add `Intl.NumberFormat` to a `no-restricted-properties` list applied to `src/**` and `scripts/**`; the engine/format block must keep its own entries, because a later flat-config block replaces the rule's options.
- `test/lint.test.ts` + `test/fixtures/lint/` -- the lint fixture pattern (`ruleIds`, `inlineRuleIds`). Add the `Intl.NumberFormat` case here.
- `test/no-industry-literal.test.ts` -- the source-scan pattern with `listRepositoryFiles` from `scripts/check-no-public-env.ts`. Reuse it for the decimal-constructor scan.
- `test/db/db-env.ts` -- `setting()`; DB tests connect with `READER_DATABASE_URL`. Read-only test, no writes.
- `supabase/migrations/20261011120000_register_step1_tables.sql` -- `register.key_figures` columns `<field>_ore bigint`; the row type mirrors them. Do not change.
- `seed/demo/{key_figures,filing}.csv` -- source of the reference cases (values in øre).
- `tsconfig.json` -- strict, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` (no enums), `.ts` import extensions allowed.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` -- add `decimal.js` `10.6.0` (exact) to dependencies; `pnpm install`.
- [ ] `src/engine/decimal.ts` -- the one `Decimal.clone` (config above), `roundHalfAwayFromZero`.
- [ ] `src/engine/types.ts` -- `ApiInputs` (`bigint | null` per register field), `Source`, `Direction`, `FigureResult` (value with source | absence), `Comparison` union (`subject_absent` | `below_floor` | `compared`, the last with `best: { quartile, percentile } | null`), `MIN_PEERS = 10`.
- [ ] `src/engine/key-figures.ts` -- input derivation, then `computeApiKeyFigures(inputs)` → the three `FigureResult`s with source `api`; directions ↑, ↑, none.
- [ ] `src/engine/statistics.ts` -- `percentileInc(sorted, p)`, `percentileRank(subject, peers, direction)`, `compareFigure(subject, peers, direction)` applying source match, floor and `leftOut`.
- [ ] `src/engine/inputs.ts` -- `parseOre`, `parseDecimal` (strings matching `^-?\d+$` / `^-?\d+(\.\d+)?$` only; anything else throws), `apiInputsFromRow(row)` from the `key_figures` column names.
- [ ] `src/engine/format.ts` -- `formatKroner(ore)`, `formatSignedKroner(ore)`, `formatMillions(ore)`, `formatPercent(fraction)`, `formatWholePercent(percent)`, `formatPercentagePoints(fraction)`, `formatDays`, `formatTurnover`, `formatMultiple`, `formatOrgnr`.
- [ ] `src/engine/index.ts` -- re-exports.
- [ ] `test/engine/*.test.ts` -- every matrix row; formatter bytes compared as code-point arrays.
- [ ] `test/engine/reference-cases.test.ts` -- the six cases below, inputs copied from `seed/demo/key_figures.csv`; above each case a comment with orgnr, name, filing year and the calculation step by step in kroner (inputs, any derivation, each division, the result to 20 significant digits and as displayed). The expected values come from that hand calculation, not from the engine.
- [ ] `test/no-other-decimal.test.ts` -- only `src/engine/decimal.ts` imports `decimal.js` or calls `clone`/`config`/`set` on it.
- [ ] `test/db/read-types.test.ts` -- as `reader`, `select 9007199254740993::bigint, 12.345::numeric, null::bigint` arrive as strings/null and parse exactly.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` -- add the Story 1.7 dormant-company entry; rewrite the 1.3a negative-`sumEiendeler`/`valuta` entry so it points at 1.7 (asset band, unknown `valuta`) and 1.8 (kroner only for NOK), and records that 1.4 makes ratios over a negative `sumEiendeler` undefined.
- [ ] Docs: `docs/key-figures.md` (General rules: the four derivation rules and the ±5 kr bound with its reason); `AGENTS.md` (ESLint list, decimal.js); `docs/ai-log.md` (what could go wrong with money handling); `docs/ai-sessions/` file; sprint-status.

**Acceptance Criteria:**
- Given the reference cases — 979803125 BMC SOFTWARE AS 2025 (normal), 921708750 TRACSENSE AS 2020 (negative equity), 924971487 PAF SOFTWARE AS 2021 (stated zero revenue), 926662600 APP1 AS 2023 (`driftsresultat` underivable), 919728574 JOAKIM BORDING AS 2025 (`sumEgenkapital` derived: 196 779 − 30 327 = 166 452 kr; its revenue also derives to 1 kr, the Q1 case), 931165992 SIGMA DATA SOLUTIONS AS 2023 (negative assets) — when the engine runs them, every figure equals the hand calculation (fraction, then 20 significant digits) and its formatted percent, and each case names orgnr and filing year.
- Given `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db`, then all pass, including the lint fixture with `Intl.NumberFormat` in `src/` failing.

## Design Notes

**Derivation (four API inputs, one level, stated values only):** `sumDriftsinntekter = driftsresultat + sumDriftskostnad`; `driftsresultat = sumDriftsinntekter − sumDriftskostnad`; `sumEiendeler = sumEgenkapitalGjeld`; `sumEgenkapital = sumEgenkapitalGjeld − sumGjeld`. A derived value never feeds another derivation. `DERIVED_ZERO_BOUND_ORE = 500n` lives in `key-figures.ts`; a figure's result remembers whether its denominator was derived, so the bound is applied to derived denominators only.

**Units at the formatter boundary:** amounts in øre (`bigint.toString()`), ratios as fractions, the percentile in percent (0–100, as the formula reads). Each function's comment names its unit.

**Comparison shape:**
```ts
compareFigure(subject: FigureResult, peers: FigureResult[], direction: Direction): Comparison
// peers count only when defined AND source === subject's source; leftOut = peers.length - count
```

## Verification

**Commands:**
- `pnpm check:pins && pnpm lint && pnpm typecheck && pnpm test` -- expected: pass.
- `pnpm test:db` -- expected: pass (read-only; the local data stays).
