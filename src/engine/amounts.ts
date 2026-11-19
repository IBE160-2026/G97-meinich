// Every engine function that returns a kroner amount, and what kind of amount
// it is (Story 3.3, decision 7; FR-30; `docs/key-figures.md`, "From gap to
// kroner", "Two amounts that must never be added", "Margin decomposition
// against the peer group as a whole"). The registry no-double-counting tests
// read (test/engine/no-double-counting.test.ts): they find the engine's
// amount functions themselves, with the TypeScript compiler, and fail on one
// that is not classified here, and on a total that references a waterfall
// bar, a cost-share amount or operating asset turnover (11).
//
// An amount function is one whose return type holds, at any depth, a
// property named `ore` or ending in `Ore` that is a Decimal or a Fraction (a
// computed amount in exact øre; a filed amount is a bigint and is not one),
// or a property named `kroner` or ending in `Kroner` (an amount as
// displayed).
//
// Stories 3.4 and 3.5 register every amount function they add here, and it
// passes the FR-30 tests (epics.md).

/**
 * - `gap`: one figure's gap in kroner, profit (1) or capital (9–11);
 * - `benchmark`: a figure's gaps collected beside its comparison, summing nothing;
 * - `total`: a sum of amounts (working capital released, and from Story 3.5
 *   the profit uplift at a share and EV): never a waterfall bar, a cost
 *   share's amount or 11;
 * - `explanation`: the margin waterfall, which explains the margin gap
 *   against the peer group as a whole, is never scaled by the closable share
 *   and is never added to any total.
 */
export type AmountRole = 'gap' | 'benchmark' | 'total' | 'explanation';

export type AmountEntry = {
  /** The module under src/engine that exports it. */
  readonly module: string;
  readonly role: AmountRole;
};

export const AMOUNT_FUNCTIONS = {
  driftsmarginGap: { module: 'benchmark.ts', role: 'gap' },
  capitalGap: { module: 'benchmark.ts', role: 'gap' },
  benchmarkApiFigures: { module: 'benchmark.ts', role: 'benchmark' },
  benchmarkDocumentFigures: { module: 'benchmark.ts', role: 'benchmark' },
  workingCapitalReleased: { module: 'benchmark.ts', role: 'total' },
  marginWaterfall: { module: 'waterfall.ts', role: 'explanation' },
  displayWaterfall: { module: 'waterfall.ts', role: 'explanation' },
} as const satisfies Readonly<Record<string, AmountEntry>>;

export type AmountFunction = keyof typeof AMOUNT_FUNCTIONS;
