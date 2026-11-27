// The decomposition fold-outs' view (Story 3.2; FR-26; docs/key-figures.md,
// "Decompositions"): each factor against its own median, with its own gate
// and count; total asset turnover as a derived factor with no beste
// fjerdedel, Plassering or kroner, never labelled key figure 11; the pay
// factors not read in v1 on every basis; and the payload boundary: strings
// and strip marks only (AD-4).
import { describe, expect, it } from 'vitest';
import {
  decompositionView,
  type DecompositionView,
  type FactorView,
} from '../../src/analysis/decomposition-view.ts';
import {
  benchmarkApiFigures,
  benchmarkDocumentFigures,
  benchmarkTotalAssetTurnover,
} from '../../src/engine/benchmark.ts';
import type { DocumentBasis } from '../../src/engine/document-inputs.ts';
import type { ApiInputs } from '../../src/engine/types.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };
import { daysBasis, FAILED, NOT_IN_DATASET, TEN_PEERS } from './document-fixture.ts';

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

// Revenue 10 000 000 kr, driftsresultat 210 000 kr (2,1 %), assets 4 000 000 kr (turnover 2,5).
const SUBJECT: ApiInputs = {
  ...NONE,
  sumDriftsinntekter: 1_000_000_000n,
  driftsresultat: 21_000_000n,
  sumEiendeler: 400_000_000n,
  sumEgenkapital: 160_000_000n,
};

// Ten peers: revenue 1 000 000 kr, margin 1 … 10 %, assets 1 000 000 … 10 000 000 kr (turnover 1 … 0,1).
const PEERS: ApiInputs[] = Array.from({ length: 10 }, (_, i) => ({
  ...NONE,
  sumDriftsinntekter: 100_000_000n,
  driftsresultat: BigInt((i + 1) * 1_000_000),
  sumEiendeler: BigInt((i + 1) * 100_000_000),
  sumEgenkapital: 40_000_000n,
}));

function view(
  peers: readonly ApiInputs[] = PEERS,
  subject: ApiInputs = SUBJECT,
  basis: DocumentBasis = daysBasis(50n, 5n),
): DecompositionView {
  return decompositionView({
    api: benchmarkApiFigures(subject, peers, 'NOK'),
    turnover: benchmarkTotalAssetTurnover(subject, peers),
    document: benchmarkDocumentFigures(basis, TEN_PEERS, 'NOK'),
    filingYear: 2025,
  });
}

const keys = (factor: FactorView) => Object.keys(factor).sort();
const strings = (value: unknown): string => JSON.stringify(value);

describe('the margin decomposition', () => {
  it('turnover has no best, Plassering or kroner', () => {
    const [margin, turnover] = view().margin.factors;
    // Exactly these fields: no beste fjerdedel, no Plassering, no percentile, no gap.
    expect(keys(turnover)).toEqual(['counts', 'direction', 'label', 'median', 'middleHalf', 'own', 'strip']);
    if (!('strip' in turnover)) throw new Error('turnover is compared');
    expect(turnover.own).toBe('2,50');
    // PERCENTILE.INC at 0,5 of 0,1 … 1 by tenths' reciprocals: (1/5 + 1/6) / 2 = 0,1833… → 0,18.
    expect(turnover.median).toBe('0,18');
    expect(turnover.counts).toBe('10 sammenlignbare brukt · 0 utelatt');
    expect(turnover.direction).toBe(nb['keyFigures.dir.none']);
    // The strip is aria-hidden: the midtre halvdel is text too (Spec Change Log, 2026-11-19).
    // PERCENTILE.INC at 0,25 and 0,75 of 1/10 … 1: 0,1(3)… → 0,13 and 0,3125 → 0,31.
    expect(turnover.middleHalf).toBe('Midtre halvdel: 0,13–0,31');
    expect(turnover.strip.best).toBeNull();
    expect(turnover.strip.mirrored).toBe(false);
    expect(strings(turnover)).not.toMatch(/bedre enn|beste fjerdedel|kr\b|kronebeløp|engangsbeløp/i);
    // The driftsmargin factor has the same fields: its beste fjerdedel,
    // Plassering and kroner stay in the Driftsmargin row (decision 3).
    expect(keys(margin)).toEqual(['counts', 'direction', 'label', 'median', 'middleHalf', 'own', 'strip']);
    if (!('strip' in margin)) throw new Error('driftsmargin is compared');
    expect(margin.own).toBe(`2,1${NBSP}%`);
    expect(margin.median).toBe(`5,5${NBSP}%`);
    // 1 % … 10 %: lower quartile 3,25 %, upper quartile 7,75 %.
    expect(margin.middleHalf).toBe(`Midtre halvdel: 3,3–7,8${NBSP}%`);
    expect(margin.direction).toBe(nb['keyFigures.dir.higher']);
    // Its strip draws no beste fjerdedel either: that stays in the row.
    expect(margin.strip.best).toBeNull();
    expect(strings(margin)).not.toMatch(/bedre enn|kr\b|kronebeløp/);
  });

  it('turnover is never labelled key figure 11', () => {
    const pair = view().margin;
    expect(pair.heading).toBe(nb['keyFigures.foldout.margin']);
    const [margin, turnover] = pair.factors;
    expect(margin.label).toBe(nb['fig.driftsmargin']);
    expect(turnover.label).toBe(nb['fig.tkOml']);
    expect(turnover.label).not.toBe(nb['fig.oml']);
    expect(turnover.label).not.toMatch(/11|drift/i);
    expect(strings(pair)).not.toContain(nb['fig.oml']);
    expect(strings(pair)).not.toMatch(/driftsmidlenes|driftseiendeler/i);
  });

  it('each factor is gated on its own', () => {
    // One peer with no positive assets: driftsmargin compared on ten, turnover below the floor on nine.
    const peers = [...PEERS.slice(0, 9), { ...PEERS[9]!, sumEiendeler: 0n }];
    const [margin, turnover] = view(peers).margin.factors;
    expect('median' in margin).toBe(true);
    expect(margin).toMatchObject({ counts: '10 sammenlignbare brukt · 0 utelatt' });
    expect('median' in turnover).toBe(false);
    expect(turnover).toMatchObject({
      own: '2,50',
      belowFloor: 'For få sammenlignbare (9 av 10)',
      counts: '9 sammenlignbare brukt · 1 utelatt',
    });
  });

  it('a factor below the floor keeps its value', () => {
    const [margin, turnover] = view(PEERS.slice(0, 9)).margin.factors;
    for (const factor of [margin, turnover]) {
      expect(keys(factor)).toEqual(['belowFloor', 'counts', 'direction', 'label', 'own']);
      expect(factor).toMatchObject({ belowFloor: 'For få sammenlignbare (9 av 10)' });
    }
    expect(margin.own).toBe(`2,1${NBSP}%`);
    expect(turnover.own).toBe('2,50');
  });

  it('an undefined driftsmargin factor reads its reason, as its row', () => {
    const [margin] = view(PEERS, { ...SUBJECT, sumDriftsinntekter: 0n }).margin.factors;
    expect(keys(margin)).toEqual(['detail', 'label', 'own']);
    expect(margin.own).toBe(`Kan ikke beregnes: ${nb['analysis.figures.reason.revenueNotPositive']}`);
  });

  it('an undefined factor reads its reason', () => {
    const [margin, turnover] = view(PEERS, { ...SUBJECT, sumEiendeler: 0n }).margin.factors;
    expect('median' in margin).toBe(true);
    expect(keys(turnover)).toEqual(['detail', 'label', 'own']);
    expect(turnover.own).toBe(`Kan ikke beregnes: ${nb['analysis.figures.reason.assetsNotPositive']}`);
  });
});

describe('the pay decomposition', () => {
  it('refuses a pay factor that is not "not read in v1"', () => {
    const document = benchmarkDocumentFigures(daysBasis(50n, 5n), TEN_PEERS, 'NOK');
    const read = {
      ...document,
      lonnArsverk: { ...document.lonnArsverk, comparison: document.vare.comparison },
    };
    expect(() =>
      decompositionView({
        api: benchmarkApiFigures(SUBJECT, PEERS, 'NOK'),
        turnover: benchmarkTotalAssetTurnover(SUBJECT, PEERS),
        document: read,
        filingYear: 2025,
      }),
    ).toThrow('the pay factors are not read in v1');
  });

  it('pay factors are not read in v1 and carry no median', () => {
    for (const basis of [daysBasis(50n, 5n), NOT_IN_DATASET, FAILED]) {
      const pair = view(PEERS, SUBJECT, basis).pay;
      expect(pair.heading).toBe(nb['keyFigures.foldout.pay']);
      expect(pair.factors.map((factor) => factor.label)).toEqual([nb['fig.lonnArsverk'], nb['fig.omsArsverk']]);
      for (const factor of pair.factors) {
        // No median, no strip, no count.
        expect(keys(factor), basis.kind).toEqual(['detail', 'label', 'own']);
        expect(factor).toEqual({
          label: factor.label,
          own: nb['analysis.figures.notReadInV1'],
          detail: nb['analysis.figures.notReadInV1.notes'],
        });
      }
    }
  });
});

type Walk = {
  /** Every leaf with its path, outside the strip marks. */
  readonly leaves: { path: string; value: unknown }[];
  readonly strips: { path: string; strip: Record<string, unknown> }[];
  /** Every object and array on the way, for the plain-object check. */
  readonly objects: { path: string; value: object }[];
};

/** Collects the parts of `value`; `expectMarks` asserts over each list, so no expect sits in a branch. */
function walk(value: unknown, path: string, out: Walk = { leaves: [], strips: [], objects: [] }): Walk {
  if (path.endsWith('.strip')) {
    out.strips.push({ path, strip: value as Record<string, unknown> });
  } else if (value !== null && typeof value === 'object') {
    out.objects.push({ path, value });
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, out);
  } else {
    out.leaves.push({ path, value });
  }
  return out;
}

function expectMarks(parts: Walk): void {
  for (const { path, strip } of parts.strips) {
    expect(Object.keys(strip).sort(), path).toEqual(['bandFrom', 'bandTo', 'best', 'median', 'mirrored', 'own']);
    for (const key of ['bandFrom', 'bandTo', 'median']) expect(typeof strip[key], `${path}.${key}`).toBe('number');
    expect(strip.best === null || typeof strip.best === 'number', `${path}.best`).toBe(true);
    expect(typeof strip.mirrored, `${path}.mirrored`).toBe('boolean');
    expect(Object.keys(strip.own as object).sort(), `${path}.own`).toEqual(['at', 'clipped']);
  }
  // Plain arrays and objects only: a Decimal, a Fraction or any class instance is not.
  for (const { path, value } of parts.objects) {
    const proto = Object.getPrototypeOf(value);
    expect(proto === Object.prototype || proto === Array.prototype, `${path} is a plain object`).toBe(true);
  }
}

describe('the payload boundary', () => {
  it('decomposition view holds only strings and strip marks', () => {
    const cases = [
      view(),
      view(PEERS.slice(0, 9)),
      view(PEERS, { ...SUBJECT, sumEiendeler: 0n }),
      view(PEERS, SUBJECT, NOT_IN_DATASET),
    ];
    let strips = 0;
    for (const decompositions of cases) {
      const parts = walk(decompositions, 'view');
      expectMarks(parts);
      strips += parts.strips.length;
      const found = parts.leaves;
      expect(found.length).toBeGreaterThan(10);
      for (const { path, value } of found) {
        // No number outside the strip, no bigint, no Decimal.
        expect(typeof value === 'string' || value === null, `${path}: ${typeof value}`).toBe(true);
      }
      // No amount in øre reaches a string.
      const text = found.map((leaf) => String(leaf.value)).join('\n');
      for (const ore of ['1000000000', '21000000', '400000000', '100000000']) {
        expect(text).not.toMatch(new RegExp(`(?<!\\d)${ore}(?!\\d)`));
      }
    }
    // The strip checks ran: the compared cases draw strips.
    expect(strips).toBeGreaterThan(0);
  });
});
