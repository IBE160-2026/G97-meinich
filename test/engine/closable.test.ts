// How much of a gap is closable (Story 3.5, decisions 2 and 3;
// `docs/key-figures.md`, "From gap to kroner"): the median step's exact
// s_med, where it exists and why not, its place among the fixed steps and
// its label, and the amounts at a share, each rounded once at display.
// Every fixture is hand-made, its state asserted before it is used.
import { describe, expect, it } from 'vitest';
import { medianStepLabel } from '../../src/analysis/verdi-view.ts';
import {
  closableSteps,
  medianStep,
  profitAtMedian,
  productIsApproximate,
  profitAtShare,
  scaleAmount,
  valueAtShare,
  type ClosableShare,
  type Multiple,
} from '../../src/engine/closable.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { formatKronerExact } from '../../src/engine/format.ts';
import type { Comparison } from '../../src/engine/types.ts';
import { t } from '../../src/messages/index.ts';
import { parseMultippel } from '../../src/url/analysis-state.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const d = (value: string | number) => new Decimal(value);
/** A kroner amount as format.ts writes it: no-break spaces in the digits and before "kr". */
const N = (text: string) => text.replaceAll(' ', ' ');

/** A compared driftsmargin (higher is better): own r, median M, beste fjerdedel T (the upper quartile). */
function compared(r: Decimal, m: Decimal, best: Decimal): Comparison {
  return {
    kind: 'compared',
    subject: r,
    source: 'api',
    count: 12,
    leftOut: 0,
    median: m,
    lowerQuartile: m.minus(1),
    upperQuartile: best,
    p5: m.minus(2),
    p95: best.plus(1),
    // A hand-made comparison: no test here reads its distribution (Story 3.7's "Vis fordelingen").
    sorted: [],
    best: { quartile: best, percentile: d(50) },
  };
}

const kr = (ore: Decimal) => formatKronerExact(ore.toString());

/** A multiple as the user enters it, through the one function that makes one. */
function multiple(text: string): Multiple {
  const parsed = parseMultippel(text);
  if (parsed === null) throw new Error(`not a multiple: ${text}`);
  return parsed;
}
const profitText = (a: Decimal, full: Decimal) => t('verdi.profit.value', { a: kr(a), full: kr(full) });

describe('the median step', () => {
  it('the median step exists only where r < M < T', () => {
    const step = medianStep(compared(d('-0.05'), d('-0.03'), d('0.05')));
    expect(step.kind).toBe('exists');
    // s_med = (M − r) / (T − r) = 0.02 / 0.10, exactly.
    if (step.kind === 'exists') expect(step.share.eq(d('0.2'))).toBe(true);
    // Every other order of r, M and T has none.
    expect(medianStep(compared(d('0'), d('-0.03'), d('0.05'))).kind).toBe('none');
    expect(medianStep(compared(d('-0.03'), d('-0.03'), d('0.05'))).kind).toBe('none');
    expect(medianStep(compared(d('-0.05'), d('0.05'), d('0.05'))).kind).toBe('none');
    expect(medianStep(compared(d('0.06'), d('-0.03'), d('0.05'))).kind).toBe('none');
  });

  it('each disabled case gives its reason', () => {
    const cases: readonly [Comparison, string][] = [
      // r > M, a strength included (r ≥ T).
      [compared(d('0'), d('-0.03'), d('0.05')), 'above_median'],
      [compared(d('0.07'), d('-0.03'), d('0.05')), 'above_median'],
      [compared(d('-0.03'), d('-0.03'), d('0.05')), 'at_median'],
      [compared(d('-0.05'), d('0.05'), d('0.05')), 'median_is_best'],
      [
        { kind: 'below_floor', subject: d('-0.05'), source: 'api', absence: { reason: 'below_floor', count: 7 }, count: 7, leftOut: 0 },
        'below_floor',
      ],
      [
        { kind: 'subject_absent', absence: { reason: 'undefined', cause: 'denominator_not_positive' }, count: 12, leftOut: 0 },
        'own_missing',
      ],
    ];
    for (const [comparison, reason] of cases) expect(medianStep(comparison), reason).toEqual({ kind: 'none', reason });
  });

  it('the step stands after an equal fixed step', () => {
    // Fixture: s_med 0,2 sits between 0 and 25; exactly 0,25 stands right after 25; 0,99 between 75 and 100.
    expect(closableSteps(d('0.2'))).toEqual([0, 'median', 25, 50, 75, 100]);
    expect(closableSteps(d('0.25'))).toEqual([0, 25, 'median', 50, 75, 100]);
    expect(closableSteps(d('0.2499999999999999999999999999999999999999'))).toEqual([0, 'median', 25, 50, 75, 100]);
    expect(closableSteps(d('0.99'))).toEqual([0, 25, 50, 75, 'median', 100]);
    // No median step: it stands last, disabled.
    expect(closableSteps(null)).toEqual([0, 25, 50, 75, 100, 'median']);
  });

  it('under 1 % and over 99 %', () => {
    // Fixture: s_med that rounds to 0 and to 100 whole percent, and one that does not.
    expect(medianStepLabel(d('0.004'))).toBe(nb['verdi.step.medianUnder']);
    expect(medianStepLabel(d('0.996'))).toBe(nb['verdi.step.medianOver']);
    expect(medianStepLabel(d('0.005'))).toBe(nb['verdi.step.median'].replace('{n}', '1'));
    expect(medianStepLabel(d('0.1214'))).toBe(nb['verdi.step.median'].replace('{n}', '12'));
  });
});

describe('amounts at a share', () => {
  // EXPERIENCE.md UJ-2: 12 518 082 kr revenue, −613 386 kr driftsresultat, median −3,2 %, beste fjerdedel 9,1 %.
  const revenue = 1_251_808_200n;
  const r = d(-61_338_600).div(d(revenue.toString()));
  const uj2 = compared(r, d('-0.032'), d('0.091'));
  const full = d('0.091').minus(r).mul(d(revenue.toString()));

  it('the median step uses the exact s, not the rounded n', () => {
    const step = medianStep(uj2);
    if (step.kind !== 'exists') throw new Error('UJ-2 has a median step');
    expect(medianStepLabel(step.share)).toBe(nb['verdi.step.median'].replace('{n}', '12'));
    const atMedian = profitAtMedian(uj2, revenue);
    if (atMedian === null) throw new Error('UJ-2 has a profit at the median');
    const shown = profitText(profitAtShare(full, atMedian.ore, 'median').ore, full);
    expect(shown).toBe(`${N('212 807 kr')} av ${N('1 752 531 kr')} per år`);
    // The amount at the rounded 12 % is another one.
    expect(kr(full.mul('0.12'))).toBe(N('210 304 kr'));
  });

  it('at the median the profit is (M − r) × revenue, rounded once', () => {
    // Decision 2's searched case: revenue 1 000 000 kr, driftsresultat −49 000 kr, M −0,0480005, T −0,04798593.
    const rev = 100_000_000n;
    const own = d(-4_900_000).div(d(rev.toString()));
    const c = compared(own, d('-0.0480005'), d('-0.04798593'));
    const step = medianStep(c);
    if (step.kind !== 'exists') throw new Error('the case has a median step');
    const fullAmount = d('-0.04798593').minus(own).mul(d(rev.toString()));
    // The fixture's state: full × s_med rounds to 999 kr at 40 digits.
    expect(kr(fullAmount.mul(step.share))).toBe(N('999 kr'));
    const atMedian = profitAtMedian(c, rev);
    if (atMedian === null) throw new Error('the case has a profit at the median');
    expect(kr(profitAtShare(fullAmount, atMedian.ore, 'median').ore)).toBe(N('1 000 kr'));
  });

  it('a fixed step scales the full amount', () => {
    const cases: readonly [ClosableShare, string][] = [
      [0, '0 kr'],
      [25, '438 133 kr'],
      [50, '876 266 kr'],
      [75, '1 314 399 kr'],
      [100, '1 752 531 kr'],
    ];
    for (const [share, text] of cases) {
      // full × s / 100, rounded once: 1 752 531,46 × 0,25 = 438 132,87 → 438 133.
      expect(kr(profitAtShare(full, null, share).ore), String(share)).toBe(N(text));
      expect(kr(scaleAmount(full, share, null).ore), String(share)).toBe(N(text));
    }
    // A capital amount at the median step is full × s_med: nothing cancels there.
    expect(scaleAmount(d(1000), 'median', d('0.25')).ore.eq(250)).toBe(true);
    expect(() => scaleAmount(d(1000), 'median', null)).toThrow(RangeError);
    expect(() => profitAtShare(d(1000), null, 'median')).toThrow(RangeError);
  });
});

describe('the value at a share (Story 3.6)', () => {
  it('the value at the median is (M − r) × revenue × m, rounded once', () => {
    // Decision 2's searched case again: (M − r) × revenue is 999,50 kr exactly.
    const rev = 100_000_000n;
    const own = d(-4_900_000).div(d(rev.toString()));
    const c = compared(own, d('-0.0480005'), d('-0.04798593'));
    const step = medianStep(c);
    const atMedian = profitAtMedian(c, rev);
    if (step.kind !== 'exists' || atMedian === null) throw new Error('the case has a median step');
    const fullAmount = d('-0.04798593').minus(own).mul(d(rev.toString()));
    const m = multiple('7');
    // The fixture's state: full × s_med × 7 is 6 996,4999… kr, which rounds to 6 996 kr.
    expect(atMedian.ore.eq(99_950)).toBe(true);
    expect(kr(fullAmount.mul(step.share).mul(m))).toBe(N('6 996 kr'));
    // (M − r) × revenue × 7 = 6 996,5 kr exactly, rounded once: 6 997 kr.
    const value = valueAtShare(fullAmount, atMedian.ore, 'median', m);
    expect(kr(value.ore)).toBe(N('6 997 kr'));
    expect(value.ore.eq(699_650)).toBe(true);
  });

  it('a fixed step is the profit at that step × m', () => {
    // UJ-2's full amount 1 752 531,46 kr; at 50 % × 6,5 = 5 695 727,26… kr.
    const revenue = 1_251_808_200n;
    const r = d(-61_338_600).div(d(revenue.toString()));
    const full = d('0.091').minus(r).mul(d(revenue.toString()));
    for (const share of [0, 25, 50, 75, 100] as const) {
      expect(valueAtShare(full, null, share, multiple('6,5')).ore.eq(profitAtShare(full, null, share).ore.mul('6.5')), String(share)).toBe(true);
    }
    expect(kr(valueAtShare(full, null, 0, multiple('50')).ore)).toBe(N('0 kr'));
    expect(() => valueAtShare(full, null, 'median', multiple('6'))).toThrow(RangeError);
  });

  it('the product is approximate exactly when the shown uplift × m is not the shown value', () => {
    // 585 000 kr exactly × 6,5 = 3 802 500 kr: exact, "=".
    const exact = d(58_500_000);
    expect(productIsApproximate(exact, exact.mul('6.5'), multiple('6.5'))).toBe(false);
    // 999,5 kr × 7: the uplift shows as 1 000 kr, 1 000 × 7 = 7 000, the value 6 996,5 → 6 997 kr: "≈".
    const half = d(99_950);
    expect(kr(half)).toBe(N('1 000 kr'));
    expect(productIsApproximate(half, half.mul(7), multiple('7'))).toBe(true);
    // 0,1 × 1 000 kr = 100 kr exactly: "="; 0,1 × 1 005 kr = 100,5 → 101 kr: "≈".
    expect(productIsApproximate(d(100_000), d(10_000), multiple('0,1'))).toBe(false);
    expect(productIsApproximate(d(100_500), d(10_050), multiple('0,1'))).toBe(true);
  });
});
