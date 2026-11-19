// The margin waterfall against the peer group as a whole (Story 3.3; FR-29,
// FR-30; `docs/key-figures.md`, "Margin decomposition against the peer group
// as a whole"): who enters the common peer set P, the 10-peer floor at 9 and
// 10, the revenue-weighted aggregate, the exact identities, and the display
// rounding, by hand and over 1 000 seeded random cases. Every company is
// synthetic.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/engine/decimal.ts';
import type { DocumentBasis } from '../../src/engine/document-inputs.ts';
import { documentKeyFigureFractions } from '../../src/engine/document-key-figures.ts';
import { type Fraction, equals, fraction, toDecimal } from '../../src/engine/fraction.ts';
import {
  aggregateShares,
  commonPeerSet,
  displayWaterfall,
  marginComponents,
  marginWaterfall,
  WATERFALL_BARS,
  type MarginComponents,
} from '../../src/engine/waterfall.ts';
import { FAILED, NOT_IN_DATASET, readBasis, type Lines } from '../analysis/document-fixture.ts';

const YEAR = 2025;

/**
 * A read company: revenue and the four parts in whole kroner; every line
 * stated, `nedskrivninger` 0, `sumDriftskostnad` their sum and
 * `driftsresultat` revenue less it, so the residual is `avskrivninger`.
 */
function company(
  revenueKr: bigint,
  vareKr: bigint,
  lonnKr: bigint,
  annenKr: bigint,
  avskrKr: bigint,
  lines: Lines = {},
): DocumentBasis {
  const kr = (amount: bigint) => (amount * 100n).toString();
  const costs = vareKr + lonnKr + annenKr + avskrKr;
  return readBasis({
    sumDriftsinntekter: kr(revenueKr),
    salgsinntekt: kr(revenueKr),
    varekostnad: kr(vareKr),
    lonnskostnad: kr(lonnKr),
    annenDriftskostnad: kr(annenKr),
    avskrivninger: kr(avskrKr),
    nedskrivninger: '0',
    sumDriftskostnad: kr(costs),
    driftsresultat: kr(revenueKr - costs),
    ...lines,
  });
}

const SUBJECT = company(16_714_286n, 852_000n, 11_182_000n, 4_078_000n, 251_286n);
const peerAt = (i: number) => company(10_000_000n + BigInt(i) * 1_000_000n, 1_000_000n, 6_000_000n, 2_000_000n, 300_000n + BigInt(i) * 10_000n);
const TEN: readonly DocumentBasis[] = Array.from({ length: 10 }, (_, i) => peerAt(i));

/** The same basis for another filing year. */
function ofYear(basis: DocumentBasis, year: number): DocumentBasis {
  if (basis.kind !== 'read') throw new Error('a read basis');
  return { ...basis, filingYear: year };
}

const sum = (fractions: readonly Fraction[]): Fraction =>
  fractions.reduce((a, b) => fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator), fraction(0n, 1n));

describe('the common peer set P and the floor', () => {
  it('P of 10 gives a decomposition', () => {
    const result = marginWaterfall(SUBJECT, TEN, YEAR, 'NOK');
    expect(result.kind).toBe('decomposition');
    if (result.kind !== 'decomposition') return;
    expect(result.n).toBe(10);
    expect(result.steps.map((step) => step.bar)).toEqual(WATERFALL_BARS);
  });

  it('P of 9 gives none, with n', () => {
    // One peer lacks lonnskostnad and has no total to derive it from.
    const peers = [...TEN.slice(0, 9), company(10_000_000n, 1_000_000n, 6_000_000n, 2_000_000n, 300_000n, { lonnskostnad: null, sumDriftskostnad: null })];
    expect(marginWaterfall(SUBJECT, peers, YEAR, 'NOK')).toEqual({ kind: 'too_few', n: 9, notInDataset: 0 });
  });

  it('who enters P', () => {
    const left: Readonly<Record<string, DocumentBasis>> = {
      failed: FAILED,
      notReconciled: { kind: 'not_reconciled', filingYear: YEAR },
      refused: { kind: 'refused', filingYear: YEAR },
      noDocument: { kind: 'document_missing', filingYear: YEAR },
      paper: { kind: 'not_read_in_v1', scope: 'paper', filingYear: YEAR },
      notInDataset: NOT_IN_DATASET,
      lineMissing: company(10_000_000n, 100n, 200n, 300n, 400n, { varekostnad: null, lonnskostnad: null }),
      driftsresultatMissing: company(10_000_000n, 1n, 2n, 3n, 4n, { driftsresultat: null }),
      revenueZero: company(0n, 1n, 2n, 3n, 4n),
      revenueNegative: company(-5n, 1n, 2n, 3n, 4n),
      // A derived revenue of 5 kr is not positive, as for key figures 3–5: driftsresultat 1 + sumDriftskostnad 4.
      derivedRevenueFiveKroner: company(5n, 1n, 1n, 1n, 1n, { sumDriftsinntekter: null }),
      anotherYear: ofYear(company(10_000_000n, 1n, 2n, 3n, 4n), 2024),
    };
    for (const [name, basis] of Object.entries(left)) {
      expect(commonPeerSet([basis], YEAR), name).toHaveLength(0);
    }
    // A derived line and a derived revenue count, as for key figures 3–5.
    const derivedLine = company(10_000_000n, 1_000_000n, 6_000_000n, 2_000_000n, 300_000n, { lonnskostnad: null });
    const derivedRevenue = company(10_000_000n, 1_000_000n, 6_000_000n, 2_000_000n, 300_000n, { sumDriftsinntekter: null });
    expect(commonPeerSet([derivedLine, derivedRevenue], YEAR)).toHaveLength(2);
    expect(commonPeerSet([TEN[0] as DocumentBasis], YEAR)).toHaveLength(1);
  });

  it('a derived revenue of 5 kr or less is not positive, and a missing line is checked before the sign', () => {
    expect(marginComponents(company(5n, 1n, 1n, 1n, 1n, { sumDriftsinntekter: null }))).toEqual({
      kind: 'absent',
      absence: { reason: 'undefined', cause: 'denominator_not_positive' },
    });
    // 6 kr derived is positive.
    expect(marginComponents(company(6n, 1n, 1n, 1n, 1n, { sumDriftsinntekter: null })).kind).toBe('value');
    // Revenue 0 and two lines missing (300 kr unexplained): component missing, not revenue not positive.
    expect(marginComponents(company(0n, 100n, 200n, 300n, 400n, { varekostnad: null, lonnskostnad: null }))).toEqual({
      kind: 'absent',
      absence: { reason: 'undefined', cause: 'component_missing' },
    });
  });

  it('R2 leaves a peer out of P', () => {
    // The four main lines read and 6 kr short of sumDriftskostnad, nedskrivninger empty.
    const short = company(10_000_000n, 1_000_000n, 6_000_000n, 2_000_000n, 300_000n, {
      nedskrivninger: null,
      sumDriftskostnad: ((9_300_000n + 6n) * 100n).toString(),
    });
    expect(marginComponents(short)).toEqual({ kind: 'absent', absence: { reason: 'cost_lines_short_of_total' } });
    expect(commonPeerSet([short], YEAR)).toHaveLength(0);
    // 5 kr short is the register's rounding: it stays.
    const rounding = company(10_000_000n, 1_000_000n, 6_000_000n, 2_000_000n, 300_000n, {
      nedskrivninger: null,
      sumDriftskostnad: ((9_300_000n + 5n) * 100n).toString(),
    });
    expect(commonPeerSet([rounding], YEAR)).toHaveLength(1);
  });

  it('counts the peers outside the demo data for decision 3', () => {
    const peers = [...TEN.slice(0, 4), NOT_IN_DATASET, NOT_IN_DATASET, NOT_IN_DATASET, NOT_IN_DATASET, NOT_IN_DATASET, NOT_IN_DATASET];
    expect(marginWaterfall(SUBJECT, peers, YEAR, 'NOK')).toEqual({ kind: 'too_few', n: 4, notInDataset: 6 });
  });

  it('the subject without its components, or failing R2, or not in NOK, has no waterfall', () => {
    expect(marginWaterfall(NOT_IN_DATASET, TEN, YEAR, 'NOK')).toEqual({ kind: 'subject_absent', absence: { reason: 'not_in_dataset' } });
    expect(marginWaterfall(FAILED, TEN, YEAR, 'NOK')).toEqual({ kind: 'subject_absent', absence: { reason: 'failed_reconciliation' } });
    const short = company(10_000_000n, 1_000_000n, 6_000_000n, 2_000_000n, 300_000n, {
      nedskrivninger: null,
      sumDriftskostnad: ((9_300_000n + 100n) * 100n).toString(),
    });
    expect(marginWaterfall(short, TEN, YEAR, 'NOK')).toEqual({ kind: 'subject_absent', absence: { reason: 'cost_lines_short_of_total' } });
    expect(marginWaterfall(SUBJECT, TEN, YEAR, 'USD')).toEqual({ kind: 'not_nok' });
  });
});

describe('the peer group as a whole', () => {
  it('the aggregate is revenue-weighted', () => {
    // A small peer with a −100 % margin and a large one with +10 %.
    const small: MarginComponents = { revenue: 100_00n, driftsresultat: -100_00n, varekostnad: 0n, lonnskostnad: 150_00n, annenDriftskostnad: 50_00n, residual: 0n };
    const large: MarginComponents = {
      revenue: 10_000_000_00n,
      driftsresultat: 1_000_000_00n,
      varekostnad: 2_000_000_00n,
      lonnskostnad: 5_000_000_00n,
      annenDriftskostnad: 1_500_000_00n,
      residual: 500_000_00n,
    };
    const aggregate = aggregateShares([small, large]);
    // Σ driftsresultat / Σ revenue = 999 900 / 10 000 100 …
    expect(equals(aggregate.margin, fraction(1_000_000_00n - 100_00n, 10_000_000_00n + 100_00n))).toBe(true);
    // … not the mean of ratios, (−1 + 0,1) / 2 = −0,45.
    expect(toDecimal(aggregate.margin).eq(new Decimal('-0.45'))).toBe(false);
    expect(equals(aggregate.shares.lonnskostnad, fraction(5_000_000_00n + 150_00n, 10_000_100_00n))).toBe(true);
  });

  it('the subject’s shares are key figures 3–5 exactly', () => {
    const result = marginWaterfall(SUBJECT, TEN, YEAR, 'NOK');
    if (result.kind !== 'decomposition') throw new Error('a decomposition');
    const figures = documentKeyFigureFractions(SUBJECT);
    const share = (key: 'vare' | 'lonn' | 'andre') => {
      const figure = figures[key];
      if (figure.kind !== 'value') throw new Error(key);
      return toDecimal(figure.fraction);
    };
    expect(result.steps[0]?.own.eq(share('vare'))).toBe(true);
    expect(result.steps[1]?.own.eq(share('lonn'))).toBe(true);
    expect(result.steps[2]?.own.eq(share('andre'))).toBe(true);
  });
});

// SplitMix64: a fixed seed, so every run draws the same cases.
function prng(seed: bigint): () => bigint {
  let state = seed;
  const mask = (1n << 64n) - 1n;
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & mask;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & mask;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & mask;
    return z ^ (z >> 31n);
  };
}

/** A whole amount in øre of up to `digits` digits, either sign. */
function amount(next: () => bigint, digits: bigint): bigint {
  const value = next() % 10n ** (1n + (next() % digits));
  return next() % 2n === 0n ? value : -value;
}

/** A random read company: revenue positive, the residual of either sign. */
function randomCompany(next: () => bigint): MarginComponents {
  const revenue = 1n + (next() % 10n ** 12n);
  const varekostnad = next() % revenue;
  const lonnskostnad = next() % revenue;
  const annenDriftskostnad = next() % revenue;
  const residual = amount(next, 10n);
  return {
    revenue,
    driftsresultat: revenue - varekostnad - lonnskostnad - annenDriftskostnad - residual,
    varekostnad,
    lonnskostnad,
    annenDriftskostnad,
    residual,
  };
}

function basisOf(c: MarginComponents): DocumentBasis {
  const s = (v: bigint) => v.toString();
  return readBasis({
    sumDriftsinntekter: s(c.revenue),
    varekostnad: s(c.varekostnad),
    lonnskostnad: s(c.lonnskostnad),
    annenDriftskostnad: s(c.annenDriftskostnad),
    avskrivninger: s(c.residual),
    nedskrivninger: '0',
    sumDriftskostnad: s(c.varekostnad + c.lonnskostnad + c.annenDriftskostnad + c.residual),
    driftsresultat: s(c.driftsresultat),
  });
}

describe('the exact identities', () => {
  it('bars sum exactly to the margin gap', () => {
    const next = prng(33n);
    let residualSigns = { positive: 0, negative: 0 };
    for (let run = 0; run < 200; run += 1) {
      const subject = randomCompany(next);
      const peers = Array.from({ length: 10 + Number(next() % 6n) }, () => randomCompany(next));
      const result = marginWaterfall(basisOf(subject), peers.map(basisOf), YEAR, 'NOK');
      if (result.kind !== 'decomposition') throw new Error(`run ${run}: ${result.kind}`);
      const aggregate = aggregateShares(peers);
      const gap = fraction(
        (subject.driftsresultat * aggregate.margin.denominator - aggregate.margin.numerator * subject.revenue) * subject.revenue,
        subject.revenue * aggregate.margin.denominator,
      );
      // Σ four bars = (m − M) × S, as exact fractions and as one Decimal.
      expect(equals(sum(result.steps.map((step) => step.ore)), gap), `run ${run}`).toBe(true);
      expect(equals(result.totalOre, gap), `run ${run}`).toBe(true);
      expect(toDecimal(sum(result.steps.map((step) => step.ore))).eq(toDecimal(gap))).toBe(true);
      // margin = 1 − the four shares, for the subject and every peer.
      for (const c of [subject, ...peers]) {
        const shares = sum(WATERFALL_BARS.map((bar) => fraction(c[bar], c.revenue)));
        expect(equals(fraction(shares.denominator - shares.numerator, shares.denominator), fraction(c.driftsresultat, c.revenue))).toBe(true);
      }
      if (subject.residual > 0n) residualSigns = { ...residualSigns, positive: residualSigns.positive + 1 };
      if (subject.residual < 0n) residualSigns = { ...residualSigns, negative: residualSigns.negative + 1 };
    }
    // The residual took both signs.
    expect(residualSigns.positive).toBeGreaterThan(0);
    expect(residualSigns.negative).toBeGreaterThan(0);
  });
});

const kr = (numerator: bigint, denominator: bigint = 1n): Fraction => fraction(numerator * 100n, denominator);

describe('display rounding', () => {
  it('display rounding: negative bars', () => {
    // −10,4 + 3,7 + 5,2 + 0,3 = −1,2 → −1. Floors −11, 3, 5, 0 = −3; R = 2 to the largest fractions, 0,7 then 0,6.
    const d = displayWaterfall([kr(-104n, 10n), kr(37n, 10n), kr(52n, 10n), kr(3n, 10n)], 100_000n);
    expect(d.totalKroner).toBe(-1n);
    expect(d.barKroner).toEqual([-10n, 4n, 5n, 0n]);
    expect(d.endKroner).toBe(1_000n);
    expect(d.startKroner).toBe(1_001n);
  });

  it('display rounding: ties go in bar order', () => {
    // 0,5 each: total 2; R = 2, all four fractions tie, the first two take it.
    expect(displayWaterfall([kr(1n, 2n), kr(1n, 2n), kr(1n, 2n), kr(1n, 2n)], 0n).barKroner).toEqual([1n, 1n, 0n, 0n]);
    // Thirds: exactly equal fractional parts with different whole parts, which a
    // 40-digit Decimal would tell apart (333 333,33… keeps fewer decimals than 0,33…).
    expect(displayWaterfall([kr(1_000_000n, 3n), kr(1n, 3n), kr(1n, 3n), kr(0n)], 0n).barKroner).toEqual([333_334n, 0n, 0n, 0n]);
  });

  it('display rounding: the total half away from zero, once', () => {
    // 0,25 × 3 − 1,25 = −0,5 → −1; floors 0, 0, 0, −2; R = 1 to the residual (0,75).
    const d = displayWaterfall([kr(1n, 4n), kr(1n, 4n), kr(1n, 4n), kr(-5n, 4n)], 0n);
    expect(d.totalKroner).toBe(-1n);
    expect(d.barKroner).toEqual([0n, 0n, 0n, -1n]);
    expect(displayWaterfall([kr(1n, 4n), kr(1n, 4n), kr(0n), kr(0n)], 0n).totalKroner).toBe(1n);
  });

  it('display rounding: a residual of either sign', () => {
    expect(displayWaterfall([kr(102n, 10n), kr(-20n), kr(5n), kr(7n, 2n)], 0n).barKroner).toEqual([10n, -20n, 5n, 4n]);
    expect(displayWaterfall([kr(102n, 10n), kr(-20n), kr(5n), kr(-7n, 2n)], 0n).barKroner).toEqual([10n, -20n, 5n, -3n]);
  });

  it('display rounding: øre in driftsresultat', () => {
    // 123 456,50 kr → 123 457 (half away); −0,50 kr → −1.
    const d = displayWaterfall([kr(100n), kr(0n), kr(0n), kr(0n)], 12_345_650n);
    expect(d.endKroner).toBe(123_457n);
    expect(d.startKroner + d.barKroner.reduce((a, b) => a + b, 0n)).toBe(d.endKroner);
    expect(displayWaterfall([kr(0n), kr(0n), kr(0n), kr(0n)], -50n).endKroner).toBe(-1n);
  });

  it('display rounding: 1 000 seeded random cases keep every rule', () => {
    const next = prng(20_261_119n);
    for (let run = 0; run < 1_000; run += 1) {
      const bars = Array.from({ length: 4 }, () => {
        const denominator = next() % 4n === 0n ? 2n : 1n + (next() % 10n ** (1n + (next() % 8n)));
        return fraction(amount(next, 14n), denominator);
      });
      const driftsresultat = amount(next, 14n);
      const d = displayWaterfall(bars, driftsresultat);
      const shown = d.barKroner.reduce((a, b) => a + b, 0n);
      // Σ shown = total, start + bars = end.
      expect(shown, `run ${run}`).toBe(d.totalKroner);
      expect(d.startKroner + shown, `run ${run}`).toBe(d.endKroner);
      // The total is the exact sum in kroner rounded half away from zero: |D − T| ≤ ½, and at ½, |D| > |T|.
      const total = sum(bars);
      const diff = d.totalKroner * 100n * total.denominator - total.numerator; // (D − T) × 100 × denominator
      const half = 50n * total.denominator;
      const absolute = diff < 0n ? -diff : diff;
      expect(absolute <= half, `run ${run}`).toBe(true);
      if (absolute === half) expect(total.numerator < 0n ? diff < 0n : diff > 0n, `run ${run}`).toBe(true);
      // Every bar is its floor or its floor + 1, and the remainder 0 ≤ R ≤ 4.
      let remainder = 0n;
      d.barKroner.forEach((shownBar, i) => {
        const bar = bars[i] as Fraction;
        const exact = bar.numerator; // øre over bar.denominator
        const floor = (() => {
          const q = exact / (100n * bar.denominator);
          return exact % (100n * bar.denominator) !== 0n && exact < 0n ? q - 1n : q;
        })();
        expect([floor, floor + 1n], `run ${run} bar ${i}`).toContain(shownBar);
        remainder += shownBar - floor;
      });
      expect(remainder >= 0n && remainder <= 4n, `run ${run}`).toBe(true);
    }
  });
});
