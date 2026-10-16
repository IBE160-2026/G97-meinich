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
import { API_FIGURE_DIRECTIONS, computeApiKeyFigures, resolveApiInputs } from './key-figures.ts';
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
 * The driftsmargin gap for a comparison. `revenueOre` is the resolved
 * (stated or derived) sumDriftsinntekter behind the subject's margin — the
 * exact øre, never a rounded figure. `valuta` is the subject's filing's.
 */
export function driftsmarginGap(comparison: Comparison, revenueOre: bigint | null, valuta: string | null): KronerGap {
  if (comparison.kind !== 'compared' || comparison.best === null) return { kind: 'none' };
  const target = comparison.best.quartile;
  if (comparison.subject.gte(target)) return { kind: 'strength' };
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
