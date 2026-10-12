import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/engine/decimal.ts';
import { formatWholePercent } from '../../src/engine/format.ts';
import { compareFigure, percentileInc, percentileRank } from '../../src/engine/statistics.ts';
import { type Comparison, type FigureResult, MIN_PEERS, type Source } from '../../src/engine/types.ts';

const d = (values: readonly string[]): Decimal[] => values.map((v) => new Decimal(v));

function figure(v: string, source: Source = 'api'): FigureResult {
  return { kind: 'value', value: new Decimal(v), source, denominatorDerived: false };
}

const undefinedFigure: FigureResult = {
  kind: 'absent',
  absence: { reason: 'undefined', cause: 'denominator_not_positive' },
};

function quartiles(values: readonly string[]): [string, string, string] {
  const sorted = d(values);
  return [
    percentileInc(sorted, '0.25').toString(),
    percentileInc(sorted, '0.5').toString(),
    percentileInc(sorted, '0.75').toString(),
  ];
}

describe('percentileInc equals Excel PERCENTILE.INC', () => {
  // Rank h = (n − 1) × p; result = x[⌊h⌋] + (h − ⌊h⌋) × (x[⌊h⌋+1] − x[⌊h⌋]), x zero-based.

  it('odd n = 7', () => {
    // x = −0.05, 0.01, 0.02, 0.02, 0.1, 0.3, 0.31; h = 6p
    // p 0.25: h 1.5  → 0.01 + 0.5 × (0.02 − 0.01) = 0.015
    // p 0.5:  h 3    → x[3] = 0.02
    // p 0.75: h 4.5  → 0.1 + 0.5 × (0.3 − 0.1) = 0.2
    expect(quartiles(['-0.05', '0.01', '0.02', '0.02', '0.1', '0.3', '0.31'])).toEqual(['0.015', '0.02', '0.2']);
  });

  it('even n = 6', () => {
    // x = 1, 2, 4, 7, 11, 16; h = 5p
    // p 0.25: h 1.25 → 2 + 0.25 × (4 − 2) = 2.5
    // p 0.5:  h 2.5  → 4 + 0.5 × (7 − 4) = 5.5
    // p 0.75: h 3.75 → 7 + 0.75 × (11 − 7) = 10
    expect(quartiles(['1', '2', '4', '7', '11', '16'])).toEqual(['2.5', '5.5', '10']);
  });

  it('ties, n = 4', () => {
    // x = 2, 2, 2, 5; h = 3p
    // p 0.25: h 0.75 → 2 + 0.75 × (2 − 2) = 2
    // p 0.5:  h 1.5  → 2 + 0.5 × (2 − 2) = 2
    // p 0.75: h 2.25 → 2 + 0.25 × (5 − 2) = 2.75
    expect(quartiles(['2', '2', '2', '5'])).toEqual(['2', '2', '2.75']);
  });

  it('even n = 10 with negative values', () => {
    // x = −0.4, −0.1, −0.05, 0, 0.02, 0.03, 0.08, 0.1, 0.12, 0.5; h = 9p
    // p 0.25: h 2.25 → −0.05 + 0.25 × (0 − (−0.05)) = −0.0375
    // p 0.5:  h 4.5  → 0.02 + 0.5 × (0.03 − 0.02) = 0.025
    // p 0.75: h 6.75 → 0.08 + 0.75 × (0.1 − 0.08) = 0.095
    expect(quartiles(['-0.4', '-0.1', '-0.05', '0', '0.02', '0.03', '0.08', '0.1', '0.12', '0.5'])).toEqual([
      '-0.0375',
      '0.025',
      '0.095',
    ]);
  });

  it('n = 1 and the ends', () => {
    expect(quartiles(['0.3'])).toEqual(['0.3', '0.3', '0.3']);
    expect(percentileInc(d(['1', '2', '3']), '0').toString()).toBe('1');
    expect(percentileInc(d(['1', '2', '3']), '1').toString()).toBe('3');
  });

  it('refuses an empty, unsorted or out-of-range input', () => {
    expect(() => percentileInc([], '0.5')).toThrow(RangeError);
    expect(() => percentileInc(d(['2', '1']), '0.5')).toThrow(RangeError);
    expect(() => percentileInc(d(['1', '2']), '1.5')).toThrow(RangeError);
  });
});

describe('percentileRank', () => {
  const peers = d(['-0.1', '-0.02', '0', '0.01', '0.02', '0.05', '0.07', '0.1', '0.2', '0.3']);

  it('counts peers worse and half the ties, higher is better', () => {
    // worse (< 0.05): 5, equal: 1 → (5 + 0.5) / 10 × 100 = 55
    expect(percentileRank(new Decimal('0.05'), peers, 'higher_is_better').toString()).toBe('55');
  });

  it('counts peers worse and half the ties, lower is better', () => {
    // worse (> 0.05): 4, equal: 1 → (4 + 0.5) / 10 × 100 = 45
    expect(percentileRank(new Decimal('0.05'), peers, 'lower_is_better').toString()).toBe('45');
  });

  it('is exact: 14 worse of 23 is 60.869565…', () => {
    const many = [...d(Array.from({ length: 14 }, () => '0')), ...d(Array.from({ length: 9 }, () => '1'))];
    const rank = percentileRank(new Decimal('0.5'), many, 'higher_is_better');
    expect(rank.eq(new Decimal(1400).div(23))).toBe(true);
    expect(formatWholePercent(rank.toString())).toBe('61 %');
  });
});

function peersOf(count: number, source: Source = 'api'): FigureResult[] {
  // 0.01, 0.02, … in steps of 0.01
  return Array.from({ length: count }, (_, i) => figure(new Decimal(i + 1).div(100).toString(), source));
}

function compared(c: Comparison): Extract<Comparison, { kind: 'compared' }> {
  if (c.kind !== 'compared') throw new Error(`expected a comparison, got ${c.kind}`);
  return c;
}

describe('compareFigure', () => {
  it('has a floor of 10', () => {
    expect(MIN_PEERS).toBe(10);
  });

  it('returns only the subject value and the count with 9 defined peers', () => {
    const c = compareFigure(figure('0.05'), peersOf(9), 'higher_is_better');
    expect(c).toEqual({
      kind: 'below_floor',
      subject: new Decimal('0.05'),
      source: 'api',
      absence: { reason: 'below_floor', count: 9 },
      count: 9,
      leftOut: 0,
    });
    for (const key of ['median', 'lowerQuartile', 'upperQuartile', 'best']) expect(c).not.toHaveProperty(key);
  });

  it('returns the full comparison with 10 defined peers', () => {
    // peers 0.01 … 0.10; h = 9p: Q1 h 2.25 → 0.03 + 0.25 × 0.01 = 0.0325;
    // median h 4.5 → 0.055; Q3 h 6.75 → 0.07 + 0.75 × 0.01 = 0.0775.
    // subject 0.05: worse 4, equal 1 → 45.
    const c = compared(compareFigure(figure('0.05'), peersOf(10), 'higher_is_better'));
    expect(c.count).toBe(10);
    expect(c.leftOut).toBe(0);
    expect(c.lowerQuartile.toString()).toBe('0.0325');
    expect(c.median.toString()).toBe('0.055');
    expect(c.upperQuartile.toString()).toBe('0.0775');
    expect(c.best?.quartile.toString()).toBe('0.0775');
    expect(c.best?.percentile.toString()).toBe('45');
  });

  it('returns the same statistics for peers in any order', () => {
    const c = compared(compareFigure(figure('0.05'), [...peersOf(10)].reverse(), 'higher_is_better'));
    expect(c.lowerQuartile.toString()).toBe('0.0325');
    expect(c.median.toString()).toBe('0.055');
    expect(c.upperQuartile.toString()).toBe('0.0775');
    expect(c.best?.quartile.toString()).toBe('0.0775');
    expect(c.best?.percentile.toString()).toBe('45');
  });

  it('takes the lower quartile as beste fjerdedel where lower is better', () => {
    // subject 0.05 against 0.01 … 0.10, lower is better: worse 5, equal 1 → 55.
    const c = compared(compareFigure(figure('0.05'), peersOf(10), 'lower_is_better'));
    expect(c.best?.quartile.toString()).toBe('0.0325');
    expect(c.best?.percentile.toString()).toBe('55');
  });

  it('gives no beste fjerdedel or percentile without a direction', () => {
    const c = compared(compareFigure(figure('0.05'), peersOf(10), 'none'));
    expect(c.best).toBeNull();
    expect(c.median.toString()).toBe('0.055');
  });

  it('leaves out undefined peers and peers from another source, for this figure only', () => {
    const peers = [...peersOf(10), undefinedFigure, figure('0.5', 'document')];
    const c = compared(compareFigure(figure('0.05'), peers, 'higher_is_better'));
    expect(c.count).toBe(10);
    expect(c.leftOut).toBe(2);
    expect(c.median.toString()).toBe('0.055');
  });

  it('falls below the floor when left-out peers leave fewer than 10', () => {
    const peers = [...peersOf(9), undefinedFigure, figure('0.5', 'document')];
    const c = compareFigure(figure('0.05'), peers, 'higher_is_better');
    expect(c).toMatchObject({ kind: 'below_floor', count: 9, leftOut: 2 });
  });

  it('compares a document-sourced subject only with document-sourced peers', () => {
    const c = compareFigure(figure('0.05', 'document'), peersOf(12), 'higher_is_better');
    expect(c).toMatchObject({ kind: 'below_floor', count: 0, leftOut: 12 });
  });

  it('returns the absence reason and the peer count, and no statistics, for an absent subject', () => {
    const c = compareFigure(
      undefinedFigure,
      [...peersOf(11), figure('0.5', 'document'), undefinedFigure],
      'higher_is_better',
    );
    expect(c).toEqual({
      kind: 'subject_absent',
      absence: { reason: 'undefined', cause: 'denominator_not_positive' },
      count: 12,
      leftOut: 1,
    });
  });
});
