// The three API key figures benchmarked against the shown peer group (Story
// 1.8; FR-22, FR-24, FR-27, FR-29): each figure compared with
// `compareFigure`, the driftsmargin gap translated to kroner at full
// convergence, and where a value sits on the distribution strip. Pure:
// figures in, figures out (`docs/key-figures.md`, "From gap to kroner").
//
// The median is never the kroner target, and only driftsmargin has a kroner
// translation among the three: totalkapitalrentabilitet has none, and
// egenkapitalandel has no direction, so no beste fjerdedel to close towards.
import { Decimal } from './decimal.ts';
import { DOCUMENT_KEY_FIGURE_KEYS, type DocumentKeyFigure } from './document-absence.ts';
import type { DocumentBasis } from './document-inputs.ts';
import {
  DAYS_PER_YEAR,
  DOCUMENT_FIGURE_DIRECTIONS,
  DOCUMENT_FIGURE_RANKABLE,
  type DocumentExactFigure,
  documentKeyFigureFractions,
} from './document-key-figures.ts';
import {
  API_FIGURE_DIRECTIONS,
  apiKeyFigureFractions,
  computeApiKeyFigures,
  resolveApiInputs,
  toFigureResult,
} from './key-figures.ts';
import { compareFigure } from './statistics.ts';
import type { ApiInputs, ApiKeyFigures, Comparison, Direction } from './types.ts';

/**
 * The driftsmargin gap in kroner, at full convergence to beste fjerdedel:
 * - `amount`: the subject is worse than beste fjerdedel; `ore` is
 *   (beste fjerdedel − own margin) × sumDriftsinntekter, the exact
 *   non-integer øre, rounded once at display (`formatKronerExact`);
 * - `strength`: own margin at or above beste fjerdedel, no amount;
 * - `not_nok`: there would be an amount, but the subject's filing is not in
 *   NOK, and the formatter writes "kr" (human decision 2026-10-16);
 * - `none`: no comparison (below the floor, own value undefined), or a
 *   figure with no kroner translation.
 */
export type KronerGap =
  | { readonly kind: 'amount'; readonly ore: Decimal }
  | { readonly kind: 'strength' }
  | { readonly kind: 'not_nok' }
  | { readonly kind: 'none' };

/**
 * Whether a compared figure is a strength (FR-29): its own value at or
 * beyond beste fjerdedel in the figure's direction, compared exactly — at or
 * above it where higher is better, at or below it where lower is better.
 * False for a figure with no direction (no beste fjerdedel), below the floor
 * or with no own value. The one test of a strength: the kroner gaps, the
 * table's "▲ Styrke" and Oversikt's "Største styrke" (Story 3.4) all read it.
 */
export function atOrBeyondBest(comparison: Comparison, direction: Direction): boolean {
  if (comparison.kind !== 'compared' || comparison.best === null || direction === 'none') return false;
  const target = comparison.best.quartile;
  return direction === 'lower_is_better' ? comparison.subject.lte(target) : comparison.subject.gte(target);
}

/**
 * The driftsmargin gap for a comparison. `revenueOre` is the resolved
 * (stated or derived) sumDriftsinntekter behind the subject's margin — the
 * exact øre, never a rounded figure. `valuta` is the subject's filing's.
 */
export function driftsmarginGap(comparison: Comparison, revenueOre: bigint | null, valuta: string | null): KronerGap {
  if (comparison.kind !== 'compared' || comparison.best === null) return { kind: 'none' };
  const target = comparison.best.quartile;
  if (atOrBeyondBest(comparison, API_FIGURE_DIRECTIONS.driftsmargin)) return { kind: 'strength' };
  if (valuta !== 'NOK') return { kind: 'not_nok' };
  // A compared margin has a defined, positive revenue behind it.
  if (revenueOre === null) throw new RangeError('a compared driftsmargin needs its revenue');
  return { kind: 'amount', ore: target.minus(comparison.subject).mul(new Decimal(revenueOre.toString())) };
}

export type FigureBenchmark = {
  readonly direction: Direction;
  readonly comparison: Comparison;
  readonly gap: KronerGap;
};

export type ApiBenchmark = Readonly<Record<keyof ApiKeyFigures, FigureBenchmark>>;

/**
 * The subject's three API figures against `peers`, the shown group (the pool
 * at the URL's band minus `ekskl`). Each figure is gated by the 10-peer floor
 * on its own; only driftsmargin carries a kroner gap. `valuta` is the
 * subject's filing's currency.
 */
export function benchmarkApiFigures(
  subject: ApiInputs,
  peers: readonly ApiInputs[],
  valuta: string | null,
): ApiBenchmark {
  const own = computeApiKeyFigures(subject);
  const others = peers.map(computeApiKeyFigures);
  const compare = (key: keyof ApiKeyFigures): Comparison =>
    compareFigure(
      own[key],
      others.map((figures) => figures[key]),
      API_FIGURE_DIRECTIONS[key],
    );
  const driftsmargin = compare('driftsmargin');
  const revenue = resolveApiInputs(subject).sumDriftsinntekter;
  return {
    driftsmargin: {
      direction: API_FIGURE_DIRECTIONS.driftsmargin,
      comparison: driftsmargin,
      gap: driftsmarginGap(driftsmargin, revenue === null ? null : revenue.ore, valuta),
    },
    totalkapitalrentabilitet: {
      direction: API_FIGURE_DIRECTIONS.totalkapitalrentabilitet,
      comparison: compare('totalkapitalrentabilitet'),
      gap: { kind: 'none' },
    },
    egenkapitalandel: {
      direction: API_FIGURE_DIRECTIONS.egenkapitalandel,
      comparison: compare('egenkapitalandel'),
      gap: { kind: 'none' },
    },
  };
}

/**
 * Total asset turnover (`sumDriftsinntekter / sumEiendeler`) against the
 * shown group (Story 3.2; FR-26; `docs/key-figures.md`, "Decompositions"):
 * the second factor of the return-on-assets decomposition. A derived factor,
 * not a numbered key figure: it has no direction, so no beste fjerdedel and
 * no Plassering (`compareFigure` with 'none' gives `best: null`), and no
 * kroner, so there is no `gap` field at all. It is compared with its own
 * median, gated by the 10-peer floor on its own and counts its own peers:
 * a peer whose `sumEiendeler` is not positive drops out of this factor only.
 * It is never multiplied by the driftsmargin factor.
 */
export type TurnoverBenchmark = {
  readonly comparison: Comparison;
};

/** The factor's direction: none, so it is never ranked. */
export const TOTAL_ASSET_TURNOVER_DIRECTION: Direction = 'none';

export function benchmarkTotalAssetTurnover(subject: ApiInputs, peers: readonly ApiInputs[]): TurnoverBenchmark {
  const turnover = (inputs: ApiInputs) => toFigureResult(apiKeyFigureFractions(inputs).totalAssetTurnover, 'api');
  return { comparison: compareFigure(turnover(subject), peers.map(turnover), TOTAL_ASSET_TURNOVER_DIRECTION) };
}

/** The document figures with a capital translation (`docs/key-figures.md`, "From gap to kroner"). */
export type CapitalFigure = 'kfd' | 'lgd' | 'oml';

/** Why a document figure has no kroner amount. */
export type NoKronerReason =
  // The figure has no kroner translation: 2–8, 14 and kontantandel.
  | 'no_translation'
  // No comparison: the subject's value is undefined or below the floor.
  | 'no_comparison'
  // Operating asset turnover (11) with beste fjerdedel at or below 0:
  // sumDriftsinntekter / T is not a capital base.
  | 'target_not_positive';

/**
 * A document figure's gap in kroner at full convergence to beste fjerdedel
 * (Story 3.1a; FR-24, FR-29):
 * - `amount`: the capital released, the exact non-integer øre, rounded once
 *   at display. `oneOff`: a one-time amount (engangsbeløp), not per year,
 *   never added to the profit uplift;
 * - `strength`: the subject at or beyond beste fjerdedel, no amount;
 * - `not_nok`: there would be an amount, but the subject's filing is not in
 *   NOK (decision 6, as for profit);
 * - `none`: no amount, with the reason.
 */
export type CapitalGap =
  | { readonly kind: 'amount'; readonly ore: Decimal; readonly oneOff: true }
  | { readonly kind: 'strength' }
  | { readonly kind: 'not_nok' }
  | { readonly kind: 'none'; readonly reason: NoKronerReason };

const NO_COMPARISON: CapitalGap = { kind: 'none', reason: 'no_comparison' };

function dec(amount: bigint): Decimal {
  return new Decimal(amount.toString());
}

/**
 * The capital gap of 9, 10 or 11 for a comparison, at s = 1. `exact` is the
 * subject's figure, whose two amounts the formulas read:
 * - 9 receivable days: (r − T) / 365 × `salgsinntekt`;
 * - 10 payable days: (T − r) / 365 × (`varekostnad` + `annenDriftskostnad`);
 * - 11 operating asset turnover: (`sumEiendeler` − `bankinnskudd`) −
 *   `sumDriftsinntekter` / T.
 * Each is evaluated from the filed amounts, not from the rounded ratio r:
 * since r = `kundefordringer` × 365 / `salgsinntekt`, 9 is `kundefordringer`
 * − T × `salgsinntekt` / 365, and 10 is T × (`varekostnad` +
 * `annenDriftskostnad`) / 365 − `leverandorgjeld`, exactly the same amounts.
 * Worse than T is above it for 9 and below it for 10 and 11. `valuta` is the
 * subject's filing's.
 */
export function capitalGap(
  figure: CapitalFigure,
  comparison: Comparison,
  exact: DocumentExactFigure,
  valuta: string | null,
): CapitalGap {
  if (comparison.kind !== 'compared' || comparison.best === null || exact.kind !== 'value') return NO_COMPARISON;
  const target = comparison.best.quartile;
  if (atOrBeyondBest(comparison, DOCUMENT_FIGURE_DIRECTIONS[figure])) return { kind: 'strength' };
  if (figure === 'oml' && target.lte(0)) return { kind: 'none', reason: 'target_not_positive' };
  if (valuta !== 'NOK') return { kind: 'not_nok' };
  const days = dec(DAYS_PER_YEAR);
  const numerator = dec(exact.numeratorOre);
  const denominator = dec(exact.denominatorOre);
  switch (figure) {
    case 'kfd':
      // kundefordringer − T × salgsinntekt / 365
      return { kind: 'amount', ore: numerator.minus(target.mul(denominator).div(days)), oneOff: true };
    case 'lgd':
      // T × (varekostnad + annenDriftskostnad) / 365 − leverandorgjeld
      return { kind: 'amount', ore: target.mul(denominator).div(days).minus(numerator), oneOff: true };
    case 'oml':
      // (sumEiendeler − bankinnskudd) − sumDriftsinntekter / T
      return { kind: 'amount', ore: denominator.minus(numerator.div(target)), oneOff: true };
  }
}

/**
 * Working capital released (`docs/key-figures.md`, "Two amounts that must
 * never be added"; Story 3.3, decision 7; Story 3.5, decision 1): receivable
 * days (9) plus payable days (10), which are safe to add because one is an
 * asset and the other a liability. The total exists when both clear the
 * floor and the filing is in NOK, and a part that is a strength (at or
 * beyond beste fjerdedel) counts as 0 in it:
 * - both an amount: their sum;
 * - one an amount, the other a strength: that amount alone, under the
 *   total's name;
 * - both strengths: `strength`, no kroner;
 * - otherwise (either below the floor, undefined or not in NOK): `none`,
 *   and each part is shown as its own line.
 * Operating asset turnover (11) is never added to it: its capital base
 * already holds `kundefordringer`. A one-off amount, never added to the
 * profit uplift. Registered in `src/engine/amounts.ts` as a total.
 */
export type WorkingCapitalReleased =
  | { readonly kind: 'amount'; readonly ore: Decimal; readonly oneOff: true }
  | { readonly kind: 'strength' }
  | { readonly kind: 'none' };

export function workingCapitalReleased(kfd: CapitalGap, lgd: CapitalGap): WorkingCapitalReleased {
  if (kfd.kind === 'amount' && lgd.kind === 'amount') return { kind: 'amount', ore: kfd.ore.plus(lgd.ore), oneOff: true };
  // A strength counts as 0: the other part's amount is the total.
  if (kfd.kind === 'amount' && lgd.kind === 'strength') return { kind: 'amount', ore: kfd.ore, oneOff: true };
  if (kfd.kind === 'strength' && lgd.kind === 'amount') return { kind: 'amount', ore: lgd.ore, oneOff: true };
  if (kfd.kind === 'strength' && lgd.kind === 'strength') return { kind: 'strength' };
  return { kind: 'none' };
}

/** What "Største kapitalgap" can show: the working-capital total (9 + 10), or one capital figure alone. */
export type CapitalChoice = 'working_capital' | CapitalFigure;

/**
 * Oversikt's "Største kapitalgap" (Story 3.4, decision 1; FR-30;
 * `docs/key-figures.md`, "Two amounts that must never be added"):
 * - `amount`: the largest one-off amount at full convergence, the exact øre
 *   compared before any rounding; `figure` names what it is;
 * - `none`: no amount, with the first reason that applies: `not_nok` (an
 *   amount there would be is not in kroner), `all_strengths` (9, 10 and 11
 *   are each at or beyond beste fjerdedel), or `no_gap` (otherwise: some
 *   below the floor, undefined, a strength or without a capital base).
 */
export type LargestCapitalGap =
  | {
      readonly kind: 'amount';
      readonly figure: CapitalChoice;
      readonly ore: Decimal;
      readonly oneOff: true;
      /**
       * Every candidate compared, in figure order, the chosen one among them
       * (Story 3.7: the drill-down shows what was compared). Nothing here is
       * summed: each is `workingCapitalReleased`'s total or one gap.
       */
      readonly candidates: readonly { readonly figure: CapitalChoice; readonly ore: Decimal }[];
    }
  | { readonly kind: 'none'; readonly reason: 'not_nok' | 'all_strengths' | 'no_gap' };

/**
 * The largest capital gap among, in figure order: the working-capital total
 * when `workingCapitalReleased` gives one (both (9) and (10) amounts, or one
 * an amount and the other a strength, which counts as 0; the only sum this
 * function shows), otherwise whichever of the two is an amount, alone; and
 * (11). It chooses and sums nothing itself: (11) is never added to (9),
 * (10) or their total, only compared with them. The largest exact amount
 * wins; on a tie the lower figure number, so working capital before (11).
 * It never reads the profit gap: it is not ranked against the per-year hero.
 */
export function largestCapitalGap(kfd: CapitalGap, lgd: CapitalGap, oml: CapitalGap): LargestCapitalGap {
  const candidates: { readonly figure: CapitalChoice; readonly ore: Decimal }[] = [];
  const workingCapital = workingCapitalReleased(kfd, lgd);
  if (workingCapital.kind === 'amount') candidates.push({ figure: 'working_capital', ore: workingCapital.ore });
  else if (kfd.kind === 'amount') candidates.push({ figure: 'kfd', ore: kfd.ore });
  else if (lgd.kind === 'amount') candidates.push({ figure: 'lgd', ore: lgd.ore });
  if (oml.kind === 'amount') candidates.push({ figure: 'oml', ore: oml.ore });
  let chosen: (typeof candidates)[number] | null = null;
  // Strictly greater: an equal later candidate (a higher figure number) never replaces the earlier one.
  for (const candidate of candidates) if (chosen === null || candidate.ore.gt(chosen.ore)) chosen = candidate;
  if (chosen !== null) return { kind: 'amount', figure: chosen.figure, ore: chosen.ore, oneOff: true, candidates };
  const gaps = [kfd, lgd, oml];
  if (gaps.some((gap) => gap.kind === 'not_nok')) return { kind: 'none', reason: 'not_nok' };
  if (gaps.every((gap) => gap.kind === 'strength')) return { kind: 'none', reason: 'all_strengths' };
  return { kind: 'none', reason: 'no_gap' };
}

const CAPITAL_FIGURES: ReadonlySet<DocumentKeyFigure> = new Set<CapitalFigure>(['kfd', 'lgd', 'oml']);

function isCapitalFigure(figure: DocumentKeyFigure): figure is CapitalFigure {
  return CAPITAL_FIGURES.has(figure);
}

export type DocumentFigureBenchmark = {
  readonly direction: Direction;
  /** Whether a Plassering may rank or sort it, or name it Største styrke (`DOCUMENT_FIGURE_RANKABLE`). */
  readonly rankable: boolean;
  readonly comparison: Comparison;
  readonly gap: CapitalGap;
};

export type DocumentBenchmark = Readonly<Record<DocumentKeyFigure, DocumentFigureBenchmark>>;

/**
 * The subject's twelve document figures against `peers`, the shown group,
 * each from its document basis. Each figure is gated by the 10-peer floor on
 * its own, counting only peers with a value from the same source
 * (`compareFigure`); only 9, 10 and 11 carry kroner. `valuta` is the
 * subject's filing's currency.
 */
export function benchmarkDocumentFigures(
  subject: DocumentBasis,
  peers: readonly DocumentBasis[],
  valuta: string | null,
): DocumentBenchmark {
  const own = documentKeyFigureFractions(subject);
  const others = peers.map(documentKeyFigureFractions);
  const out = {} as Record<DocumentKeyFigure, DocumentFigureBenchmark>;
  for (const figure of DOCUMENT_KEY_FIGURE_KEYS) {
    const direction = DOCUMENT_FIGURE_DIRECTIONS[figure];
    const comparison = compareFigure(
      toFigureResult(own[figure], 'document'),
      others.map((figures) => toFigureResult(figures[figure], 'document')),
      direction,
    );
    out[figure] = {
      direction,
      rankable: DOCUMENT_FIGURE_RANKABLE[figure],
      comparison,
      gap: isCapitalFigure(figure)
        ? capitalGap(figure, comparison, own[figure], valuta)
        : { kind: 'none', reason: 'no_translation' },
    };
  }
  return out;
}

/** Which side of a reference value the subject's own value lies on, compared exactly. */
export type Side = 'above' | 'at' | 'below';

/**
 * What the Oversikt hero's context line says about a compared figure
 * (Story 1.9): the side of the median and of beste fjerdedel the subject's
 * own value lies on, and its distance to beste fjerdedel as a non-negative
 * fraction (0.14 is 14,0 pp), from the exact values, rounded only at
 * display. The sides are numeric ("above" is a higher value), which for
 * driftsmargin, the hero's only figure, is also the better side. Null when
 * there is no comparison or no beste fjerdedel (no direction).
 */
export type HeroContext = {
  readonly median: Side;
  readonly best: Side;
  readonly toBest: Decimal;
};

export function heroContext(comparison: Comparison): HeroContext | null {
  if (comparison.kind !== 'compared' || comparison.best === null) return null;
  const own = comparison.subject;
  const side = (reference: Decimal): Side => (own.gt(reference) ? 'above' : own.lt(reference) ? 'below' : 'at');
  const best = comparison.best.quartile;
  return { median: side(comparison.median), best: side(best), toBest: own.minus(best).abs() };
}

/**
 * Where `value` sits on a distribution strip, as a share of its width from
 * the left: 0 is the left edge, 1 the right. The domain is [P5, P95] of the
 * peer values used, so one extreme peer cannot squeeze the rest; a value
 * outside it is drawn at the edge, with `clipped` naming the side of the
 * domain it fell outside ('low' below P5, 'high' above P95). Lower-is-better
 * figures are mirrored, so better is always to the right. When P5 = P95,
 * every mark sits at the centre. The result is geometry, not a figure.
 */
export function stripPosition(
  value: Decimal,
  comparison: Extract<Comparison, { readonly kind: 'compared' }>,
  direction: Direction,
): { readonly at: Decimal; readonly clipped: 'low' | 'high' | null } {
  const { p5, p95 } = comparison;
  if (p5.eq(p95)) return { at: new Decimal('0.5'), clipped: null };
  let clipped: 'low' | 'high' | null = null;
  let share: Decimal;
  if (value.lt(p5)) {
    clipped = 'low';
    share = new Decimal(0);
  } else if (value.gt(p95)) {
    clipped = 'high';
    share = new Decimal(1);
  } else {
    share = value.minus(p5).div(p95.minus(p5));
  }
  return { at: direction === 'lower_is_better' ? new Decimal(1).minus(share) : share, clipped };
}
