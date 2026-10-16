// The API figures against the shown group (Story 1.8): the driftsmargin gap
// in kroner on the exact revenue, strength at equality, no kroner where
// there is no comparison or no translation, a derived revenue, the currency
// gate, and the distribution strip's clipped, mirrored domain. The Oversikt
// hero's context line (Story 1.9): the sides of the median and of beste
// fjerdedel, and the distance to beste fjerdedel.
import { describe, expect, it } from 'vitest';
import {
  benchmarkApiFigures,
  driftsmarginGap,
  heroContext,
  stripPosition,
  type KronerGap,
} from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { formatKronerExact, formatPercentagePoints } from '../../src/engine/format.ts';
import { compareFigure } from '../../src/engine/statistics.ts';
import type { ApiInputs, Comparison, FigureResult } from '../../src/engine/types.ts';

const NBSP = ' ';

const NONE: ApiInputs = {
  sumDriftsinntekter: null,
  driftsresultat: null,
  sumDriftskostnad: null,
  sumEiendeler: null,
  sumEgenkapitalGjeld: null,
  sumEgenkapital: null,
  sumGjeld: null,
};

// EXPERIENCE.md's reference: driftsresultat 351 000 kr on 16 714 286 kr
// revenue (r = 2,1 %), beste fjerdedel 9,1 %.
const SUBJECT: ApiInputs = {
  ...NONE,
  sumDriftsinntekter: 1_671_428_600n,
  driftsresultat: 35_100_000n,
  sumEiendeler: 1_000_000_000n,
  sumEgenkapital: 400_000_000n,
};

/** A peer with 1 000 000 kr revenue and the given driftsmargin; assets 2 000 000 kr, equity `ek` of them. */
function peer(margin: string, ek = '0.4'): ApiInputs {
  const revenue = 100_000_000n;
  const result = BigInt(new Decimal(margin).mul(revenue.toString()).toFixed(0));
  return {
    ...NONE,
    sumDriftsinntekter: revenue,
    driftsresultat: result,
    sumEiendeler: 200_000_000n,
    sumEgenkapital: BigInt(new Decimal(ek).mul(200_000_000).toFixed(0)),
  };
}

// Ten peers whose upper quartile (h = 6.75 between two 0,091 values) is 0,091 exactly.
const TEN = ['0.01', '0.02', '0.03', '0.04', '0.05', '0.06', '0.091', '0.091', '0.091', '0.2'].map((m) => peer(m));

function compared(c: Comparison): Extract<Comparison, { kind: 'compared' }> {
  if (c.kind !== 'compared') throw new Error(`expected a comparison, got ${c.kind}`);
  return c;
}

function amount(gap: KronerGap): string {
  if (gap.kind !== 'amount') throw new Error(`expected an amount, got ${gap.kind}`);
  return formatKronerExact(gap.ore.toString());
}

describe('benchmarkApiFigures: the driftsmargin gap in kroner', () => {
  it('gives "1 170 000 kr" on the exact revenue at beste fjerdedel 0,091', () => {
    const result = benchmarkApiFigures(SUBJECT, TEN, 'NOK');
    const c = compared(result.driftsmargin.comparison);
    expect(c.best?.quartile.toString()).toBe('0.091');
    expect(result.driftsmargin.direction).toBe('higher_is_better');
    // 0,091 × 1 671 428 600 − 35 100 000 = 117 000 002,6 øre.
    expect(amount(result.driftsmargin.gap)).toBe(`1${NBSP}170${NBSP}000${NBSP}kr`);
    if (result.driftsmargin.gap.kind === 'amount') {
      expect(result.driftsmargin.gap.ore.toDecimalPlaces(6).toString()).toBe('117000002.6');
    }
  });

  it('the same margin on a revenue rounded to 16,7 mill. kr gives 1 169 000 kr, which is not what is shown', () => {
    const c = benchmarkApiFigures(SUBJECT, TEN, 'NOK').driftsmargin.comparison;
    expect(amount(driftsmarginGap(c, 1_670_000_000n, 'NOK'))).toBe(`1${NBSP}169${NBSP}000${NBSP}kr`);
  });

  it('uses a derived revenue (driftsresultat + sumDriftskostnad) when none is stated', () => {
    const derived: ApiInputs = { ...SUBJECT, sumDriftsinntekter: null, sumDriftskostnad: 1_636_328_600n };
    const result = benchmarkApiFigures(derived, TEN, 'NOK');
    expect(amount(result.driftsmargin.gap)).toBe(`1${NBSP}170${NBSP}000${NBSP}kr`);
  });

  it('is a strength with no amount at beste fjerdedel exactly and above it', () => {
    const atTarget: ApiInputs = { ...SUBJECT, sumDriftsinntekter: 100_000_000n, driftsresultat: 9_100_000n };
    expect(benchmarkApiFigures(atTarget, TEN, 'NOK').driftsmargin.gap).toEqual({ kind: 'strength' });
    const above: ApiInputs = { ...atTarget, driftsresultat: 9_100_001n };
    expect(benchmarkApiFigures(above, TEN, 'NOK').driftsmargin.gap).toEqual({ kind: 'strength' });
  });

  it('is not an amount when the subject’s filing is not in NOK', () => {
    expect(benchmarkApiFigures(SUBJECT, TEN, 'USD').driftsmargin.gap).toEqual({ kind: 'not_nok' });
    expect(benchmarkApiFigures(SUBJECT, TEN, null).driftsmargin.gap).toEqual({ kind: 'not_nok' });
  });

  it('a strength stays a strength whatever the currency', () => {
    const above: ApiInputs = { ...SUBJECT, sumDriftsinntekter: 100_000_000n, driftsresultat: 50_000_000n };
    expect(benchmarkApiFigures(above, TEN, 'USD').driftsmargin.gap).toEqual({ kind: 'strength' });
  });

  it('has no kroner for totalkapitalrentabilitet and egenkapitalandel', () => {
    const result = benchmarkApiFigures(SUBJECT, TEN, 'NOK');
    expect(result.totalkapitalrentabilitet.comparison.kind).toBe('compared');
    expect(result.totalkapitalrentabilitet.gap).toEqual({ kind: 'none' });
    expect(result.egenkapitalandel.direction).toBe('none');
    expect(compared(result.egenkapitalandel.comparison).best).toBeNull();
    expect(result.egenkapitalandel.gap).toEqual({ kind: 'none' });
  });

  it('has no kroner below the floor: nine defined peers', () => {
    const result = benchmarkApiFigures(SUBJECT, TEN.slice(0, 9), 'NOK');
    expect(result.driftsmargin.comparison).toMatchObject({ kind: 'below_floor', count: 9 });
    expect(result.driftsmargin.gap).toEqual({ kind: 'none' });
  });

  it('has no kroner when the subject’s own margin is undefined, and keeps the peer count', () => {
    const zeroRevenue: ApiInputs = { ...SUBJECT, sumDriftsinntekter: 0n };
    const result = benchmarkApiFigures(zeroRevenue, TEN, 'NOK');
    expect(result.driftsmargin.comparison).toMatchObject({
      kind: 'subject_absent',
      absence: { reason: 'undefined', cause: 'denominator_not_positive' },
      count: 10,
      leftOut: 0,
    });
    expect(result.driftsmargin.gap).toEqual({ kind: 'none' });
    // The other two figures do not depend on revenue.
    expect(result.totalkapitalrentabilitet.comparison.kind).toBe('compared');
  });

  it('gates each figure on its own: a peer with no assets leaves only the asset figures', () => {
    const noAssets = { ...peer('0.05'), sumEiendeler: null };
    const result = benchmarkApiFigures(SUBJECT, [...TEN.slice(0, 9), noAssets], 'NOK');
    expect(result.driftsmargin.comparison).toMatchObject({ kind: 'compared', count: 10, leftOut: 0 });
    expect(result.totalkapitalrentabilitet.comparison).toMatchObject({ kind: 'below_floor', count: 9, leftOut: 1 });
    expect(result.egenkapitalandel.comparison).toMatchObject({ kind: 'below_floor', count: 9, leftOut: 1 });
  });
});

describe('driftsmarginGap', () => {
  it('is none for a comparison without a beste fjerdedel', () => {
    const values: FigureResult[] = TEN.map(() => ({
      kind: 'value',
      value: new Decimal('0.1'),
      source: 'api',
      denominatorDerived: false,
    }));
    const c = compareFigure(values[0] as FigureResult, values, 'none');
    expect(driftsmarginGap(c, 100n, 'NOK')).toEqual({ kind: 'none' });
  });
});

/** A compared figure over the given peer values, the subject `own`. */
function comparisonOf(own: string, values: readonly string[], direction: 'higher_is_better' | 'lower_is_better' | 'none') {
  const fig = (v: string): FigureResult => ({ kind: 'value', value: new Decimal(v), source: 'api', denominatorDerived: false });
  return compared(compareFigure(fig(own), values.map(fig), direction));
}

describe('stripPosition', () => {
  // 0,00 … 0,10 in steps of 0,005 would be 21; take 19 peers in 0–10 % and one at 400 %.
  const NINETEEN = Array.from({ length: 19 }, (_, i) => new Decimal(i).div(180).toString());
  const EXTREME = [...NINETEEN, '4'];

  it('takes [P5, P95] as the domain: one extreme peer does not stretch it to 400 %', () => {
    const c = comparisonOf('0.05', EXTREME, 'higher_is_better');
    expect(c.p95.lt(4)).toBe(true);
    expect(c.p95.lt('0.5')).toBe(true);
    // Median, quartiles and beste fjerdedel fall inside the domain.
    for (const v of [c.lowerQuartile, c.median, c.upperQuartile]) {
      const { at, clipped } = stripPosition(v, c, 'higher_is_better');
      expect(clipped).toBeNull();
      expect(at.gte(0) && at.lte(1)).toBe(true);
    }
  });

  it('clamps an own value of 400 % at the right edge with the out-of-range marker', () => {
    const c = comparisonOf('4', EXTREME, 'higher_is_better');
    expect(stripPosition(c.subject, c, 'higher_is_better')).toEqual({ at: new Decimal(1), clipped: 'high' });
    expect(stripPosition(new Decimal('-1'), c, 'higher_is_better')).toEqual({ at: new Decimal(0), clipped: 'low' });
  });

  it('places a value inside the domain linearly', () => {
    const c = comparisonOf('0.05', peersEven(), 'higher_is_better');
    // Peers 0,01 … 0,10: P5 0,0145, P95 0,0955.
    const mid = c.p5.plus(c.p95).div(2);
    expect(stripPosition(mid, c, 'higher_is_better').at.toString()).toBe('0.5');
    expect(stripPosition(c.p5, c, 'higher_is_better').at.toString()).toBe('0');
    expect(stripPosition(c.p95, c, 'higher_is_better').at.toString()).toBe('1');
  });

  it('mirrors a lower-is-better figure, so better is to the right', () => {
    const c = comparisonOf('0.05', peersEven(), 'lower_is_better');
    expect(stripPosition(c.p5, c, 'lower_is_better').at.toString()).toBe('1');
    expect(stripPosition(c.p95, c, 'lower_is_better').at.toString()).toBe('0');
    const quarter = c.p5.plus(c.p95.minus(c.p5).div(4));
    expect(stripPosition(quarter, c, 'lower_is_better').at.toString()).toBe('0.75');
    // Clipping names the side of the domain, not the side it is drawn on.
    expect(stripPosition(new Decimal('-1'), c, 'lower_is_better')).toEqual({ at: new Decimal(1), clipped: 'low' });
  });

  it('draws a no-direction figure unmirrored', () => {
    const c = comparisonOf('0.05', peersEven(), 'none');
    expect(stripPosition(c.p5, c, 'none').at.toString()).toBe('0');
  });

  it('puts every mark at the centre when P5 = P95', () => {
    const c = comparisonOf('0.3', Array.from({ length: 10 }, () => '0.1'), 'higher_is_better');
    expect(c.p5.eq(c.p95)).toBe(true);
    for (const v of [c.subject, c.median, c.upperQuartile]) {
      expect(stripPosition(v, c, 'higher_is_better')).toEqual({ at: new Decimal('0.5'), clipped: null });
    }
  });
});

function peersEven(): string[] {
  return Array.from({ length: 10 }, (_, i) => new Decimal(i + 1).div(100).toString());
}

describe('heroContext', () => {
  // Median −3,2 % ((−0,032 + −0,032) / 2), upper quartile 9,1 % (h = 6,75 between two 0,091).
  const CLIMAX = ['-0.1', '-0.09', '-0.08', '-0.07', '-0.032', '-0.032', '0.091', '0.091', '0.1', '0.2'];

  it('EXPERIENCE.md’s climax: −4,9 % against median −3,2 % and beste fjerdedel 9,1 % is below both, 14,0 pp', () => {
    const c = comparisonOf('-0.049', CLIMAX, 'higher_is_better');
    expect(c.median.toString()).toBe('-0.032');
    expect(c.best?.quartile.toString()).toBe('0.091');
    const context = heroContext(c);
    expect(context?.median).toBe('below');
    expect(context?.best).toBe('below');
    expect(context?.toBest.toString()).toBe('0.14');
    expect(formatPercentagePoints(context?.toBest.toString() ?? '')).toBe(`14,0${NBSP}pp`);
  });

  it('is above the median and below beste fjerdedel between them', () => {
    const context = heroContext(comparisonOf('0.021', CLIMAX, 'higher_is_better'));
    expect(context).toMatchObject({ median: 'above', best: 'below' });
    expect(context?.toBest.toString()).toBe('0.07');
  });

  it('is at the median and at beste fjerdedel on equality, with a distance of zero at beste fjerdedel', () => {
    expect(heroContext(comparisonOf('-0.032', CLIMAX, 'higher_is_better'))).toMatchObject({ median: 'at', best: 'below' });
    const atBest = heroContext(comparisonOf('0.091', CLIMAX, 'higher_is_better'));
    expect(atBest).toMatchObject({ median: 'above', best: 'at' });
    expect(atBest?.toBest.isZero()).toBe(true);
  });

  it('is above beste fjerdedel with a non-negative distance', () => {
    const context = heroContext(comparisonOf('0.15', CLIMAX, 'higher_is_better'));
    expect(context).toMatchObject({ median: 'above', best: 'above' });
    expect(context?.toBest.toString()).toBe('0.059');
  });

  it('is null without a comparison or without a beste fjerdedel', () => {
    expect(heroContext(benchmarkApiFigures(SUBJECT, TEN.slice(0, 9), 'NOK').driftsmargin.comparison)).toBeNull();
    expect(heroContext(benchmarkApiFigures({ ...SUBJECT, sumDriftsinntekter: 0n }, TEN, 'NOK').driftsmargin.comparison)).toBeNull();
    expect(heroContext(comparisonOf('0.1', CLIMAX, 'none'))).toBeNull();
  });
});
