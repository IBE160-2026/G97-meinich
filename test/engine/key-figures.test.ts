import { describe, expect, it } from 'vitest';
import {
  API_FIGURE_DIRECTIONS,
  DERIVED_ZERO_BOUND_ORE,
  computeApiKeyFigures,
  resolveApiInputs,
} from '../../src/engine/key-figures.ts';
import type { ApiInputs, FigureResult } from '../../src/engine/types.ts';

const NONE: ApiInputs = {
  sumDriftsinntekter: null,
  driftsresultat: null,
  sumDriftskostnad: null,
  sumEiendeler: null,
  sumEgenkapitalGjeld: null,
  sumEgenkapital: null,
  sumGjeld: null,
};

// 1 000 000 kr revenue, 50 000 kr operating profit, 400 000 kr assets, 160 000 kr equity.
const NORMAL: ApiInputs = {
  ...NONE,
  sumDriftsinntekter: 100_000_000n,
  driftsresultat: 5_000_000n,
  sumDriftskostnad: 95_000_000n,
  sumEiendeler: 40_000_000n,
  sumEgenkapitalGjeld: 40_000_000n,
  sumEgenkapital: 16_000_000n,
  sumGjeld: 24_000_000n,
};

function value(result: FigureResult): string {
  if (result.kind !== 'value') throw new Error(`expected a value, got ${JSON.stringify(result.absence)}`);
  return result.value.toString();
}

const notPositive = { kind: 'absent', absence: { reason: 'undefined', cause: 'denominator_not_positive' } };
const missing = { kind: 'absent', absence: { reason: 'undefined', cause: 'component_missing' } };

describe('the three API key figures', () => {
  it('computes margin, ROA and equity ratio as exact fractions with source api', () => {
    const f = computeApiKeyFigures(NORMAL);
    expect(value(f.driftsmargin)).toBe('0.05');
    expect(value(f.totalkapitalrentabilitet)).toBe('0.125');
    expect(value(f.egenkapitalandel)).toBe('0.4');
    for (const figure of [f.driftsmargin, f.totalkapitalrentabilitet, f.egenkapitalandel]) {
      expect(figure).toMatchObject({ kind: 'value', source: 'api', denominatorDerived: false });
    }
  });

  it('has the directions ↑, ↑ and none', () => {
    expect(API_FIGURE_DIRECTIONS).toEqual({
      driftsmargin: 'higher_is_better',
      totalkapitalrentabilitet: 'higher_is_better',
      egenkapitalandel: 'none',
    });
  });

  it('keeps every digit of an amount above 2^53 øre', () => {
    const f = computeApiKeyFigures({ ...NORMAL, driftsresultat: 9007199254740993n, sumDriftsinntekter: 10n ** 18n });
    expect(value(f.driftsmargin)).toBe('0.009007199254740993');
  });
});

describe('zero or negative denominator', () => {
  it('makes margin undefined on zero revenue and leaves the others computed', () => {
    const f = computeApiKeyFigures({ ...NORMAL, sumDriftsinntekter: 0n });
    expect(f.driftsmargin).toEqual(notPositive);
    expect(value(f.totalkapitalrentabilitet)).toBe('0.125');
    expect(value(f.egenkapitalandel)).toBe('0.4');
  });

  it('makes ROA and equity ratio undefined on negative assets (−17 767 kr) and leaves margin computed', () => {
    const f = computeApiKeyFigures({ ...NORMAL, sumEiendeler: -1_776_700n });
    expect(f.totalkapitalrentabilitet).toEqual(notPositive);
    expect(f.egenkapitalandel).toEqual(notPositive);
    expect(value(f.driftsmargin)).toBe('0.05');
  });

  it('computes over a stated 1 kr revenue: the ±5 kr bound is for derived figures only', () => {
    const f = computeApiKeyFigures({ ...NORMAL, sumDriftsinntekter: 100n, driftsresultat: -1_700_300n });
    expect(value(f.driftsmargin)).toBe('-17003');
  });
});

describe('derivation of a missing input, one level, from stated values', () => {
  it('derives sumDriftsinntekter = driftsresultat + sumDriftskostnad', () => {
    const f = computeApiKeyFigures({ ...NORMAL, sumDriftsinntekter: null });
    expect(f.driftsmargin).toMatchObject({ kind: 'value', denominatorDerived: true });
    expect(value(f.driftsmargin)).toBe('0.05');
  });

  it('derives driftsresultat = sumDriftsinntekter − sumDriftskostnad', () => {
    const f = computeApiKeyFigures({ ...NORMAL, driftsresultat: null });
    expect(value(f.driftsmargin)).toBe('0.05');
    expect(value(f.totalkapitalrentabilitet)).toBe('0.125');
    expect(f.driftsmargin).toMatchObject({ denominatorDerived: false });
  });

  it('derives sumEiendeler = sumEgenkapitalGjeld', () => {
    const f = computeApiKeyFigures({ ...NORMAL, sumEiendeler: null });
    expect(value(f.totalkapitalrentabilitet)).toBe('0.125');
    expect(f.egenkapitalandel).toMatchObject({ kind: 'value', denominatorDerived: true });
  });

  it('derives sumEgenkapital = sumEgenkapitalGjeld − sumGjeld', () => {
    const f = computeApiKeyFigures({ ...NORMAL, sumEgenkapital: null });
    expect(value(f.egenkapitalandel)).toBe('0.4');
  });

  it('never feeds a derived value into another derivation', () => {
    // driftsresultat and sumDriftsinntekter both missing: neither can be
    // derived from the other.
    const r = resolveApiInputs({ ...NORMAL, driftsresultat: null, sumDriftsinntekter: null });
    expect(r.driftsresultat).toBeNull();
    expect(r.sumDriftsinntekter).toBeNull();
  });

  it('prefers a stated value to a derivable one', () => {
    const r = resolveApiInputs({ ...NORMAL, sumEiendeler: 39_999_900n });
    expect(r.sumEiendeler).toEqual({ ore: 39_999_900n, derived: false });
  });
});

describe('a derived denominator within ±5 kr of zero', () => {
  it('is bounded at 500 øre', () => {
    expect(DERIVED_ZERO_BOUND_ORE).toBe(500n);
  });

  // Revenue derived as driftsresultat + sumDriftskostnad = target.
  const withDerivedRevenue = (revenueOre: bigint): ApiInputs => ({
    ...NONE,
    driftsresultat: -1_700_300n,
    sumDriftskostnad: 1_700_300n + revenueOre,
  });

  it.each([
    ['1 kr (JOAKIM BORDING AS 2025)', 100n],
    ['−5 kr', -500n],
    ['+5 kr', 500n],
    ['−6 kr', -600n],
    ['0 kr', 0n],
  ])('makes margin undefined at %s', (_label, revenueOre) => {
    expect(computeApiKeyFigures(withDerivedRevenue(revenueOre)).driftsmargin).toEqual(notPositive);
  });

  it('computes margin at +6 kr', () => {
    const f = computeApiKeyFigures(withDerivedRevenue(600n));
    // −17 003 kr / 6 kr = −2 833.8333… (40 significant digits)
    expect(value(f.driftsmargin)).toBe(`-2833.8${'3'.repeat(35)}`);
    expect(f.driftsmargin).toMatchObject({ denominatorDerived: true });
  });

  it('applies the bound to derived assets too', () => {
    const f = computeApiKeyFigures({ ...NORMAL, sumEiendeler: null, sumEgenkapitalGjeld: 500n });
    expect(f.totalkapitalrentabilitet).toEqual(notPositive);
    expect(f.egenkapitalandel).toEqual(notPositive);
  });
});

describe('a missing component that cannot be derived', () => {
  it('makes margin and ROA component_missing when driftsresultat and sumDriftskostnad are NULL', () => {
    const f = computeApiKeyFigures({ ...NORMAL, driftsresultat: null, sumDriftskostnad: null });
    expect(f.driftsmargin).toEqual(missing);
    expect(f.totalkapitalrentabilitet).toEqual(missing);
    expect(value(f.egenkapitalandel)).toBe('0.4');
  });

  it('checks the missing component before the denominator', () => {
    const f = computeApiKeyFigures({
      ...NORMAL,
      driftsresultat: null,
      sumDriftskostnad: null,
      sumDriftsinntekter: 0n,
      sumEiendeler: -100n,
    });
    expect(f.driftsmargin).toEqual(missing);
    expect(f.totalkapitalrentabilitet).toEqual(missing);
  });

  it('makes every figure component_missing on an empty filing', () => {
    const f = computeApiKeyFigures(NONE);
    expect([f.driftsmargin, f.totalkapitalrentabilitet, f.egenkapitalandel]).toEqual([missing, missing, missing]);
  });
});
