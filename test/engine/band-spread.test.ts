// The within-band spread measure (Story 2.5, D3): n and the interquartile
// range in percentage points per band, PERCENTILE.INC as everywhere else.
import { describe, expect, it } from 'vitest';
import { bandSpread } from '../../src/engine/band-spread.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import type { Band } from '../../src/engine/fingerprint.ts';

const d = (value: string) => new Decimal(value);

describe('bandSpread', () => {
  it('counts each band and gives Q3 − Q1 × 100, inclusive method', () => {
    // low: 0.01, 0.02, 0.03, 0.04, 0.05 → Q1 0.02, Q3 0.04 → 2 pp.
    const points: { band: Band; share: Decimal }[] = ['0.05', '0.01', '0.04', '0.02', '0.03'].map((share) => ({ band: 'low' as const, share: d(share) }));
    // mid: 0.1, 0.3 → Q1 0.15, Q3 0.25 → 10 pp.
    points.push({ band: 'mid', share: d('0.3') }, { band: 'mid', share: d('0.1') });
    const spread = bandSpread(points);
    expect(spread.low.n).toBe(5);
    expect(spread.low.iqrPercentagePoints?.toString()).toBe('2');
    expect(spread.low.iqr?.toString()).toBe('0.02');
    expect(spread.mid.n).toBe(2);
    expect(spread.mid.iqrPercentagePoints?.toString()).toBe('10');
    expect(spread.high).toEqual({ n: 0, iqr: null, iqrPercentagePoints: null });
  });

  it('gives a zero range for one share or identical shares', () => {
    expect(bandSpread([{ band: 'high', share: d('0.7') }]).high.iqrPercentagePoints?.toString()).toBe('0');
    expect(
      bandSpread([
        { band: 'high', share: d('0.7') },
        { band: 'high', share: d('0.7') },
      ]).high.iqrPercentagePoints?.toString(),
    ).toBe('0');
  });
});
