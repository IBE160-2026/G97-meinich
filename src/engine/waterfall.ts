// The margin waterfall against the peer group as a whole (Story 3.3; FR-29,
// FR-30; `docs/key-figures.md`, "Margin decomposition against the peer group
// as a whole"). Pure: the subject's and each peer's document basis in, the
// four exact bars and their display rounding out.
//
// - The common peer set P: every peer whose `driftsresultat`, `varekostnad`,
//   `lonnskostnad` and `annenDriftskostnad` come from the one reconciled
//   current column of its benchmark-year document (basis `read`, that year),
//   with `sumDriftsinntekter` > 0 (Story 3.3, decision 1). One set for every
//   bar. Revenue may be derived (`documentRevenue`) and a cost line derived
//   (`documentCostLines`), as for key figures 3–5 (decision 2); R2
//   (`costLinesShortOfTotal`) leaves a company out.
// - The aggregate, revenue-weighted: Aₓ = Σ numeratorₓ / Σ revenue and M =
//   Σ driftsresultat / Σ revenue over P, never a mean of ratios.
// - The four bars: (Aₓ − cₓ) × the subject's revenue, the fourth being the
//   residual "Avskrivninger og øvrige poster", so margin = 1 − the four shares
//   for every company and the bars sum exactly to (m − M) × revenue.
//
// Every amount is an exact fraction of øre; nothing is a Number. The display
// rounding (`displayWaterfall`) rounds the total once, half away from zero,
// and the bars by signed largest remainder, so start + bars = end in whole
// kroner. It works on exact fractions with bigint arithmetic rather than
// `roundHalfAwayFromZero` on a Decimal: a Decimal of a non-terminating
// quotient carries 40 significant digits, so two bars whose fractional parts
// are exactly equal could compare unequal after it, and a tie would no
// longer go in bar order.
//
// The waterfall explains the margin gap; it is never a gap to close, never
// scaled by the closable share and never added to any total (FR-30,
// test/engine/no-double-counting.test.ts). `src/engine/amounts.ts` registers
// its functions as `explanation`.
import type { Decimal } from './decimal.ts';
import {
  type DocumentAmount,
  type DocumentBasis,
  type DocumentFigures,
  costLinesShortOfTotal,
  COST_LINES,
  documentCostLines,
  documentRevenue,
} from './document-inputs.ts';
import { type Fraction, fraction, toDecimal } from './fraction.ts';
import { DERIVED_ZERO_BOUND_ORE } from './key-figures.ts';
import { MIN_PEERS, type FigureAbsence } from './types.ts';

/** The four bars, in bar order: the order the chart draws them and ties of the display rounding go in. */
export const WATERFALL_BARS = ['varekostnad', 'lonnskostnad', 'annenDriftskostnad', 'residual'] as const;
export type WaterfallBar = (typeof WATERFALL_BARS)[number];

/** The cost-share key figure each bar explains (3–5); the residual explains none. */
export const BAR_FIGURE = {
  varekostnad: 'vare',
  lonnskostnad: 'lonn',
  annenDriftskostnad: 'andre',
  residual: null,
} as const satisfies Record<WaterfallBar, 'vare' | 'lonn' | 'andre' | null>;

/**
 * One company's five figures from its current document column, in øre, and
 * the residual: `sumDriftsinntekter` − `driftsresultat` − the three cost
 * lines, which is depreciation, impairment and every other item. Revenue is
 * positive.
 */
export type MarginComponents = {
  readonly revenue: bigint;
  readonly driftsresultat: bigint;
  readonly varekostnad: bigint;
  readonly lonnskostnad: bigint;
  readonly annenDriftskostnad: bigint;
  readonly residual: bigint;
};

/** R2: the four main cost lines are read and fall short of `sumDriftskostnad` by more than 5 kr. */
export type ShortOfTotal = { readonly reason: 'cost_lines_short_of_total' };

/** Why a company has no margin components: a key figure's absence, or R2. */
export type ComponentsAbsence = FigureAbsence | ShortOfTotal;

export type ComponentsResult =
  | { readonly kind: 'value'; readonly components: MarginComponents }
  | { readonly kind: 'absent'; readonly absence: ComponentsAbsence };

const COMPONENT_MISSING = { reason: 'undefined', cause: 'component_missing' } as const;
const NOT_POSITIVE: FigureAbsence = { reason: 'undefined', cause: 'denominator_not_positive' };

/** A line with no total to derive it from (`driftsresultat`): as stated, or missing. Never 0. */
function stated(figures: DocumentFigures, field: 'driftsresultat'): DocumentAmount {
  const figure = figures[field];
  if (figure.kind === 'absent') {
    return figure.absence.reason === 'exceeds_api_subtotal' ? { kind: 'absent', absence: COMPONENT_MISSING } : { kind: 'absent', absence: figure.absence };
  }
  if (figure.ore === null) return { kind: 'absent', absence: COMPONENT_MISSING };
  return { kind: 'value', ore: figure.ore, derived: false };
}

/** The cost lines as R2 reads them: as filed, an empty line null. */
function filedCostLines(figures: DocumentFigures): Readonly<Record<(typeof COST_LINES)[number], bigint | null>> {
  const out = {} as Record<(typeof COST_LINES)[number], bigint | null>;
  for (const line of COST_LINES) {
    const figure = figures[line];
    out[line] = figure.kind === 'value' ? figure.ore : null;
  }
  return out;
}

/**
 * A company's margin components from its document basis, or why it has none,
 * in this order:
 * 1. a basis that passes no column: its own reason (`not_in_dataset`,
 *    `failed_reconciliation`, …), as for every document figure;
 * 2. R2 (`costLinesShortOfTotal`): `cost_lines_short_of_total`;
 * 3. a missing component: revenue neither stated nor derivable,
 *    `driftsresultat` empty, or a cost line `documentCostLines` cannot
 *    derive → `component_missing`, checked before the denominator's sign;
 * 4. revenue not positive (a derived one of 5 kr or less counts as not
 *    positive, as for key figures 3–5) → `denominator_not_positive`.
 */
export function marginComponents(basis: DocumentBasis): ComponentsResult {
  switch (basis.kind) {
    case 'not_in_dataset':
      return { kind: 'absent', absence: { reason: 'not_in_dataset' } };
    case 'not_read_in_v1':
      return { kind: 'absent', absence: { reason: 'not_read_in_v1', scope: basis.scope } };
    case 'document_missing':
      return { kind: 'absent', absence: { reason: 'document_missing' } };
    case 'refused':
      return { kind: 'absent', absence: { reason: 'refused' } };
    case 'failed_reconciliation':
      return { kind: 'absent', absence: { reason: 'failed_reconciliation' } };
    case 'not_reconciled':
      return { kind: 'absent', absence: { reason: 'not_reconciled' } };
    case 'read':
      break;
  }
  const current = basis.current;
  const total = current.sumDriftskostnad;
  if (costLinesShortOfTotal(total.kind === 'value' ? total.ore : null, filedCostLines(current))) {
    return { kind: 'absent', absence: { reason: 'cost_lines_short_of_total' } };
  }
  const revenue = documentRevenue(current);
  if (revenue.kind === 'absent') return revenue;
  const result = stated(current, 'driftsresultat');
  if (result.kind === 'absent') return result;
  const lines = documentCostLines(current);
  const { varekostnad, lonnskostnad, annenDriftskostnad } = lines;
  if (varekostnad.kind === 'absent') return varekostnad;
  if (lonnskostnad.kind === 'absent') return lonnskostnad;
  if (annenDriftskostnad.kind === 'absent') return annenDriftskostnad;
  const notPositive = revenue.derived ? revenue.ore <= DERIVED_ZERO_BOUND_ORE : revenue.ore <= 0n;
  if (notPositive) return { kind: 'absent', absence: NOT_POSITIVE };
  const components = {
    revenue: revenue.ore,
    driftsresultat: result.ore,
    varekostnad: varekostnad.ore,
    lonnskostnad: lonnskostnad.ore,
    annenDriftskostnad: annenDriftskostnad.ore,
  };
  return {
    kind: 'value',
    components: {
      ...components,
      residual:
        components.revenue -
        components.driftsresultat -
        components.varekostnad -
        components.lonnskostnad -
        components.annenDriftskostnad,
    },
  };
}

/**
 * Why a peer is outside P (Story 3.8, the drill-down's "Ikke med" list), in
 * the order the copy lists them: its basis passes no column (outside the
 * demo data, no document, a year or a paper filing v1 does not read, refused
 * or not yet reconciled at reading, failed reconciliation), R2, a component
 * missing, revenue not positive, or a document of another year. Each
 * absence maps to one reason; `refused` and `not_reconciled` are one,
 * "kunne ikke leses sikkert", as on the data-quality line.
 */
export const OUTSIDE_REASONS = [
  'not_in_dataset',
  'document_missing',
  'not_read_in_v1',
  'not_read_safely',
  'failed_reconciliation',
  'cost_lines_short_of_total',
  'component_missing',
  'revenue_not_positive',
  'other_year',
] as const;
export type OutsideReason = (typeof OUTSIDE_REASONS)[number];

/** How many peers are outside P, per reason: counts, never names or amounts. */
export type OutsideCounts = Readonly<Record<OutsideReason, number>>;

function outsideReason(absence: ComponentsAbsence): OutsideReason {
  switch (absence.reason) {
    case 'not_in_dataset':
      return 'not_in_dataset';
    case 'document_missing':
      return 'document_missing';
    case 'not_read_in_v1':
      return 'not_read_in_v1';
    case 'refused':
    case 'not_reconciled':
      return 'not_read_safely';
    case 'failed_reconciliation':
      return 'failed_reconciliation';
    case 'cost_lines_short_of_total':
      return 'cost_lines_short_of_total';
    case 'undefined':
      return absence.cause === 'denominator_not_positive' ? 'revenue_not_positive' : 'component_missing';
  }
}

/**
 * Whether one peer enters P for `year`, with its components, or why not:
 * the one rule `commonPeerSet` and `outsideCommonSet` read, and the server
 * reads to take P's document read dates (src/analysis/shown-group.ts). Only
 * a `read` basis enters, and `documentBasis` gives `read` only to an orgnr
 * on the manifest (Story 3.8, decision 1).
 */
export function commonSetEntry(
  peer: DocumentBasis,
  year: number,
): { readonly kind: 'in'; readonly components: MarginComponents } | { readonly kind: 'out'; readonly reason: OutsideReason } {
  if (peer.kind === 'read' && peer.filingYear !== year) return { kind: 'out', reason: 'other_year' };
  const result = marginComponents(peer);
  return result.kind === 'value' ? { kind: 'in', components: result.components } : { kind: 'out', reason: outsideReason(result.absence) };
}

/**
 * The common peer set P (decision 1): each peer with a `read` basis for
 * `year` whose components are all there. A peer outside the demo data, with
 * a failed, unreconciled or missing document, a line missing, R2, revenue not
 * positive or a document of another year is left out.
 */
export function commonPeerSet(peers: readonly DocumentBasis[], year: number): readonly MarginComponents[] {
  const out: MarginComponents[] = [];
  for (const peer of peers) {
    const entry = commonSetEntry(peer, year);
    if (entry.kind === 'in') out.push(entry.components);
  }
  return out;
}

/** Who is outside P, counted by reason (Story 3.8): one count per `OutsideReason`. Not an amount. */
export function outsideCommonSet(peers: readonly DocumentBasis[], year: number): OutsideCounts {
  const counts = Object.fromEntries(OUTSIDE_REASONS.map((reason) => [reason, 0])) as Record<OutsideReason, number>;
  for (const peer of peers) {
    const entry = commonSetEntry(peer, year);
    if (entry.kind === 'out') counts[entry.reason] += 1;
  }
  return counts;
}

/** The numerator of a bar's share for one company. */
function numerator(company: MarginComponents, bar: WaterfallBar): bigint {
  return company[bar];
}

/**
 * The peer group as a whole over P: each component's share Aₓ = Σ
 * numeratorₓ / Σ revenue and the margin M = Σ driftsresultat / Σ revenue, as
 * exact fractions. Revenue-weighted, never a mean of ratios. P is not empty.
 */
export function aggregateShares(set: readonly MarginComponents[]): {
  readonly margin: Fraction;
  readonly shares: Readonly<Record<WaterfallBar, Fraction>>;
} {
  if (set.length === 0) throw new RangeError('the peer group as a whole needs at least one peer');
  let revenue = 0n;
  let result = 0n;
  const sums: Record<WaterfallBar, bigint> = { varekostnad: 0n, lonnskostnad: 0n, annenDriftskostnad: 0n, residual: 0n };
  for (const company of set) {
    revenue += company.revenue;
    result += company.driftsresultat;
    for (const bar of WATERFALL_BARS) sums[bar] += numerator(company, bar);
  }
  const shares = {} as Record<WaterfallBar, Fraction>;
  for (const bar of WATERFALL_BARS) shares[bar] = fraction(sums[bar], revenue);
  return { margin: fraction(result, revenue), shares };
}

/** One bar: its own share and the aggregate's, the exact amount in øre, and the displayed whole kroner. */
export type WaterfallStep = {
  readonly bar: WaterfallBar;
  /** The subject's share cₓ, from one division (equal to key figures 3–5 for the first three). */
  readonly own: Decimal;
  /** The peer group as a whole's share Aₓ. */
  readonly all: Decimal;
  /** Aₓ as an exact fraction, for `pooledOnRevenue`. Server only: the page shows it to two decimals. */
  readonly pooledShare: Fraction;
  /** (Aₓ − cₓ) × the subject's revenue, exactly, in øre. Positive raises the margin against samlet. */
  readonly ore: Fraction;
  /** The bar as displayed, in whole kroner (`displayWaterfall`). */
  readonly kroner: bigint;
};

/** The waterfall in whole kroner as displayed: start + Σ bars = end exactly. */
export type WaterfallDisplay = {
  /** The total `driftsresultat` − M × revenue, rounded once, half away from zero. */
  readonly totalKroner: bigint;
  /** The subject's `driftsresultat`, rounded half away from zero. */
  readonly endKroner: bigint;
  /** endKroner − totalKroner: the peer group's margin on the subject's revenue, as displayed. */
  readonly startKroner: bigint;
  /** Each bar, in bar order, by signed largest remainder; they sum to `totalKroner`. */
  readonly barKroner: readonly bigint[];
  /**
   * Each bar rounded on its own, half away from zero (Story 3.8): where it
   * differs from `barKroner`, the largest remainder moved that bar, and the
   * drill-down says so.
   */
  readonly ownKroner: readonly bigint[];
};

export type MarginWaterfall =
  /** The subject has no components: its reason, as its cost-share rows give it, or R2. */
  | { readonly kind: 'subject_absent'; readonly absence: ComponentsAbsence }
  /** The subject's filing is not in NOK: amounts are written in kroner (decision 5). */
  | { readonly kind: 'not_nok' }
  /** Fewer than 10 in P: `n` = |P|, and how many peers are outside the demo data (decision 3). */
  | { readonly kind: 'too_few'; readonly n: number; readonly notInDataset: number }
  | {
      readonly kind: 'decomposition';
      /** |P|. */
      readonly n: number;
      /** The subject's margin from its document, driftsresultat / sumDriftsinntekter: the one the bars sum to. */
      readonly subjectMargin: Decimal;
      /** M, the peer group as a whole's margin. */
      readonly aggregateMargin: Decimal;
      /** M as an exact fraction, for `pooledOnRevenue`. Server only. */
      readonly pooledMargin: Fraction;
      /** The subject's own components from its document, in øre: what its drill-downs show (Story 3.8). */
      readonly subject: MarginComponents;
      /** The four bars, in bar order. */
      readonly steps: readonly WaterfallStep[];
      /** The exact total, driftsresultat − M × revenue, in øre: Σ bars. */
      readonly totalOre: Fraction;
      readonly display: WaterfallDisplay;
    };

function subtract(a: Fraction, b: Fraction): Fraction {
  return fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
}

function scale(a: Fraction, by: bigint): Fraction {
  return fraction(a.numerator * by, a.denominator);
}

/**
 * A pooled share applied to the subject's revenue, Aₓ × R or M × R, exactly,
 * in øre (Story 3.8, decision 2): what the drill-down's kroner line starts
 * from (Aₓ × R − the subject's own line = the bar) and the start column's
 * M × R. An explanation: never a gap, never scaled by the closable share,
 * never added to any total (`src/engine/amounts.ts`).
 */
export function pooledOnRevenue(share: Fraction, revenueOre: bigint): { readonly ore: Fraction } {
  return { ore: scale(share, revenueOre) };
}

/** ⌊n / d⌋ towards negative infinity; d > 0. */
function floorDiv(n: bigint, d: bigint): bigint {
  const q = n / d;
  return n % d !== 0n && n < 0n ? q - 1n : q;
}

/** n / d rounded to a whole number, ties away from zero; d > 0. */
function roundHalfAway(n: bigint, d: bigint): bigint {
  const magnitude = n < 0n ? -n : n;
  const rounded = (2n * magnitude + d) / (2n * d);
  return n < 0n ? -rounded : rounded;
}

const ORE_PER_KRONE = 100n;

/**
 * The display rounding (`docs/key-figures.md`; spec Design Notes, "Rounding
 * bound"). `bars` are the exact bars in øre, in bar order; `driftsresultatOre`
 * the subject's.
 * - The total T = Σ bars is rounded once to whole kroner, half away from zero: D.
 * - Each bar is rounded down (towards negative infinity) to whole kroner; the
 *   remainder R = D − Σ⌊barᵢ⌋ lies in 0…k, k the bars with a fractional part
 *   (so 0 ≤ R ≤ 4), and goes one krone at a time to the bars with the largest
 *   fractional parts, ties in bar order. No special case for a negative bar.
 * - End E = `driftsresultat` rounded half away from zero; start = E − D.
 * Every comparison is exact (bigint over a common denominator).
 */
export function displayWaterfall(bars: readonly Fraction[], driftsresultatOre: bigint): WaterfallDisplay {
  // A common denominator: the product of the bars' own, in kroner.
  const common = bars.reduce((d, bar) => d * bar.denominator, 1n) * ORE_PER_KRONE;
  const numerators = bars.map((bar) => (bar.numerator * common) / (bar.denominator * ORE_PER_KRONE));
  const total = numerators.reduce((sum, n) => sum + n, 0n);
  const totalKroner = roundHalfAway(total, common);
  const floors = numerators.map((n) => floorDiv(n, common));
  // Each fractional part as a numerator over `common`: 0 ≤ part < common.
  const parts = numerators.map((n, i) => n - (floors[i] ?? 0n) * common);
  let remainder = totalKroner - floors.reduce((sum, f) => sum + f, 0n);
  if (remainder < 0n || remainder > BigInt(parts.filter((p) => p > 0n).length)) {
    throw new Error(`the remainder ${remainder} is outside 0…k`);
  }
  // Largest fractional part first; a stable sort keeps ties in bar order.
  const order = parts
    .map((part, index) => ({ part, index }))
    .sort((a, b) => (a.part === b.part ? 0 : a.part > b.part ? -1 : 1));
  const barKroner = [...floors];
  for (const { index } of order) {
    if (remainder === 0n) break;
    barKroner[index] = (barKroner[index] ?? 0n) + 1n;
    remainder -= 1n;
  }
  const endKroner = roundHalfAway(driftsresultatOre, ORE_PER_KRONE);
  const ownKroner = bars.map((bar) => roundHalfAway(bar.numerator, bar.denominator * ORE_PER_KRONE));
  return { totalKroner, endKroner, startKroner: endKroner - totalKroner, barKroner, ownKroner };
}

/**
 * The margin waterfall of `subject` against `peers` (the shown group, the
 * group less `ekskl`) for the benchmark `year`, in this order: the subject's
 * components (its reason, or R2), then its currency (`not_nok`), then P (10
 * or more, or `too_few` with |P|). `valuta` is the subject's filing's.
 */
export function marginWaterfall(
  subject: DocumentBasis,
  peers: readonly DocumentBasis[],
  year: number,
  valuta: string | null,
): MarginWaterfall {
  const own = marginComponents(subject);
  if (own.kind === 'absent') return { kind: 'subject_absent', absence: own.absence };
  if (valuta !== 'NOK') return { kind: 'not_nok' };
  const set = commonPeerSet(peers, year);
  if (set.length < MIN_PEERS) {
    return { kind: 'too_few', n: set.length, notInDataset: peers.filter((peer) => peer.kind === 'not_in_dataset').length };
  }
  const company = own.components;
  const aggregate = aggregateShares(set);
  const steps = WATERFALL_BARS.map((bar) => {
    const ownShare = fraction(numerator(company, bar), company.revenue);
    const all = aggregate.shares[bar];
    return { bar, ownShare, all, ore: scale(subtract(all, ownShare), company.revenue) };
  });
  const subjectMargin = fraction(company.driftsresultat, company.revenue);
  const totalOre = scale(subtract(subjectMargin, aggregate.margin), company.revenue);
  const display = displayWaterfall(
    steps.map((step) => step.ore),
    company.driftsresultat,
  );
  return {
    kind: 'decomposition',
    n: set.length,
    subjectMargin: toDecimal(subjectMargin),
    aggregateMargin: toDecimal(aggregate.margin),
    pooledMargin: aggregate.margin,
    subject: company,
    steps: steps.map((step, i) => ({
      bar: step.bar,
      own: toDecimal(step.ownShare),
      all: toDecimal(step.all),
      pooledShare: step.all,
      ore: step.ore,
      kroner: display.barKroner[i] ?? 0n,
    })),
    totalOre,
    display,
  };
}
