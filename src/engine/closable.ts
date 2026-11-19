// How much of a gap is closable (Story 3.5; FR-31, FR-62; `docs/key-figures.md`,
// "From gap to kroner"). The target is beste fjerdedel at every share s; s
// only scales the gap to it: s = 0 gives no kroner, s = 1 is full
// convergence. Besides the fixed steps, the "to the median" step is the
// share at which the subject's driftsmargin reaches the peer median M:
//
//   s_med = (M − r) / (T − r)
//
// computed exactly from the comparison and never from the whole percent its
// label shows. It exists only where r < M < T.
//
// The profit at the median step is (M − r) × sumDriftsinntekter, never the
// full amount × s_med: (T − r) cancels exactly, so the amount carries no
// division, and at 40 significant digits the two can round to different
// kroner (decision 2; test/engine/closable.test.ts). Capital amounts at the
// median step are full × s_med: nothing cancels there.
//
// Pure: Decimals in, Decimals out. The browser runs `scaleAmount` and
// `profitAtShare` on values that crossed the wire (src/engine/wire.ts), the
// same functions the server runs (AD-6).
import { Decimal } from './decimal.ts';
import type { Comparison, Direction } from './types.ts';

/** The fixed steps of the closable-share control, in percent. */
export const FIXED_SHARES = [0, 25, 50, 75, 100] as const;
export type FixedShare = (typeof FIXED_SHARES)[number];

/** A closable share: a fixed step in percent, or the median step (`andel=median`). */
export type ClosableShare = FixedShare | 'median';

/**
 * Why there is no median step (decision 3), in the order they are decided:
 * the subject's own driftsmargin is missing; the figure is below the floor;
 * the subject is above the median (a strength included); at it; or the
 * median equals beste fjerdedel, so reaching it is 100 %.
 */
export type MedianStepReason = 'own_missing' | 'below_floor' | 'above_median' | 'at_median' | 'median_is_best';

export type MedianStep =
  /** `share` is the exact s_med, strictly between 0 and 1. */
  | { readonly kind: 'exists'; readonly share: Decimal }
  | { readonly kind: 'none'; readonly reason: MedianStepReason };

/**
 * The median step on driftsmargin (higher is better), from its comparison
 * against the shown group: exact s_med where r < M < T, otherwise the reason
 * there is none.
 */
export function medianStep(comparison: Comparison): MedianStep {
  if (comparison.kind === 'subject_absent') return { kind: 'none', reason: 'own_missing' };
  if (comparison.kind === 'below_floor') return { kind: 'none', reason: 'below_floor' };
  if (comparison.best === null) throw new RangeError('the median step needs a beste fjerdedel: driftsmargin has a direction');
  const r = comparison.subject;
  const m = comparison.median;
  const target = comparison.best.quartile;
  if (r.gt(m)) return { kind: 'none', reason: 'above_median' };
  if (r.eq(m)) return { kind: 'none', reason: 'at_median' };
  if (m.eq(target)) return { kind: 'none', reason: 'median_is_best' };
  return { kind: 'exists', share: m.minus(r).div(target.minus(r)) };
}

/**
 * Where a figure reaches its own median on its own gap (decision 4: each
 * Verdi card's median line is for its own figure): `share` is (M − r) /
 * (T − r) for that figure, exact; `reached` when the subject is at or beyond
 * the median in the figure's direction; null when there is no comparison or
 * no beste fjerdedel (no target). The sign of (M − r) and (T − r) is the
 * same on both sides of a lower-is-better figure, so one formula serves
 * both directions.
 */
export type MedianShare = { readonly kind: 'share'; readonly share: Decimal } | { readonly kind: 'reached' };

export function medianShare(comparison: Comparison, direction: Direction): MedianShare | null {
  if (comparison.kind !== 'compared' || comparison.best === null || direction === 'none') return null;
  const r = comparison.subject;
  const m = comparison.median;
  const reached = direction === 'lower_is_better' ? r.lte(m) : r.gte(m);
  if (reached) return { kind: 'reached' };
  return { kind: 'share', share: m.minus(r).div(comparison.best.quartile.minus(r)) };
}

/**
 * The order of the control's steps (decision 3): the fixed steps, with the
 * median step in its place by its exact s_med, right after a fixed step it
 * equals. With no median step it stands last, disabled.
 */
export function closableSteps(sMed: Decimal | null): ClosableShare[] {
  const steps: ClosableShare[] = [...FIXED_SHARES];
  if (sMed === null) return [...steps, 'median'];
  const percent = sMed.mul(100);
  let at = 0;
  for (const [index, step] of FIXED_SHARES.entries()) if (percent.gte(step)) at = index + 1;
  steps.splice(at, 0, 'median');
  return steps;
}

/**
 * The profit uplift at the median step: (M − r) × sumDriftsinntekter, the
 * exact non-integer øre, rounded once at display. `revenueOre` is the
 * subject's resolved revenue behind its margin. Null where there is no
 * median step.
 */
export function profitAtMedian(comparison: Comparison, revenueOre: bigint): { readonly ore: Decimal } | null {
  const step = medianStep(comparison);
  if (step.kind !== 'exists' || comparison.kind !== 'compared') return null;
  return { ore: comparison.median.minus(comparison.subject).mul(new Decimal(revenueOre.toString())) };
}

function fixedFactor(share: FixedShare): Decimal {
  return new Decimal(share).div(100);
}

/**
 * A capital amount at a share: the full-convergence amount × s / 100 for a
 * fixed step, × the exact s_med for the median step. It sums nothing.
 */
export function scaleAmount(full: Decimal, share: ClosableShare, sMed: Decimal | null): { readonly ore: Decimal } {
  if (share === 'median') {
    if (sMed === null) throw new RangeError('the median step needs s_med');
    return { ore: full.mul(sMed) };
  }
  return { ore: full.mul(fixedFactor(share)) };
}

/**
 * The profit uplift at a share: the full-convergence amount × s / 100 for a
 * fixed step, and at the median step (M − r) × sumDriftsinntekter
 * (`profitAtMedian`), never full × s_med. It sums nothing.
 */
export function profitAtShare(full: Decimal, atMedian: Decimal | null, share: ClosableShare): { readonly ore: Decimal } {
  if (share === 'median') {
    if (atMedian === null) throw new RangeError('the median step needs the profit at the median');
    return { ore: atMedian };
  }
  return { ore: full.mul(fixedFactor(share)) };
}
