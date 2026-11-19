// The Verdi tab as a view (Story 3.5, decisions 1–5; FR-30, FR-31): the
// wire the server builds from the engine's benchmarks, and the strings
// `verdiCards` writes from it at each share. Every fixture is synthetic and
// hand-made: comparisons and gaps written out, so each expected text can be
// read off the fixture, whose state each test asserts first.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KEY_FIGURE_ROWS, type FigureKey } from '../../src/analysis/key-figure-rows.ts';
import { verdiCards, verdiWire, type VerdiWire } from '../../src/analysis/verdi-view.ts';
import type { SubjectKeyFigures } from '../../src/analysis/view.ts';
import { ClosableShareControl } from '../../src/components/analysis/closable-share.tsx';
import type {
  ApiBenchmark,
  CapitalGap,
  DocumentBenchmark,
  DocumentFigureBenchmark,
  FigureBenchmark,
  KronerGap,
} from '../../src/engine/benchmark.ts';
import { FIXED_SHARES, type ClosableShare } from '../../src/engine/closable.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import type { DocumentKeyFigure } from '../../src/engine/document-absence.ts';
import type { DocumentBasis } from '../../src/engine/document-inputs.ts';
import { DOCUMENT_FIGURE_DIRECTIONS } from '../../src/engine/document-key-figures.ts';
import { API_FIGURE_DIRECTIONS } from '../../src/engine/key-figures.ts';
import type { Comparison, Direction } from '../../src/engine/types.ts';
import { t } from '../../src/messages/index.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const d = (value: string | number) => new Decimal(value);
const N = (text: string) => text.replaceAll(' ', ' ');
const SHARES: readonly ClosableShare[] = [...FIXED_SHARES, 'median'];

/** A compared figure: own r, median M and beste fjerdedel T in the figure's direction (none: no T). */
function compared(direction: Direction, r: string, m: string, best: string): Comparison {
  const lowerIsBetter = direction === 'lower_is_better';
  return {
    kind: 'compared',
    subject: d(r),
    source: 'document',
    count: 12,
    leftOut: 0,
    median: d(m),
    lowerQuartile: lowerIsBetter ? d(best) : d(m).minus(1),
    upperQuartile: lowerIsBetter ? d(m).plus(1) : d(best),
    p5: d(m).minus(100),
    p95: d(m).plus(100),
    best: direction === 'none' ? null : { quartile: d(best), percentile: d(50) },
  };
}

const belowFloor = (count: number): Comparison => ({
  kind: 'below_floor',
  subject: d('0.5'),
  source: 'document',
  absence: { reason: 'below_floor', count },
  count,
  leftOut: 0,
});

const NOTES: Comparison = { kind: 'subject_absent', absence: { reason: 'not_read_in_v1', scope: 'notes' }, count: 0, leftOut: 12 };

const amount = (ore: string): CapitalGap => ({ kind: 'amount', ore: d(ore), oneOff: true });
const STRENGTH: CapitalGap = { kind: 'strength' };
const NOT_NOK: CapitalGap = { kind: 'not_nok' };
const NO_COMPARISON: CapitalGap = { kind: 'none', reason: 'no_comparison' };

const KEYS = Object.keys(KEY_FIGURE_ROWS) as FigureKey[];

function directionOf(key: FigureKey): Direction {
  return key in API_FIGURE_DIRECTIONS
    ? API_FIGURE_DIRECTIONS[key as keyof typeof API_FIGURE_DIRECTIONS]
    : DOCUMENT_FIGURE_DIRECTIONS[key as DocumentKeyFigure];
}

type Override = { readonly comparison?: Comparison; readonly gap?: CapitalGap; readonly profit?: KronerGap };

/**
 * The default subject: revenue 100 000 kr; driftsmargin −5 % against median
 * −3 % and beste fjerdedel 5 % (s_med 0,2; full 10 000 kr; at the median
 * 2 000 kr); receivable days 60 against 50 and 40, payable days 20 against
 * 30 and 40, operating asset turnover 1 against 2 and 3 (each reaching its
 * median at 50 %), with amounts 1 000 kr, 2 000 kr and 3 500 kr; every other
 * figure compared at its median.
 */
const DEFAULTS: Partial<Record<FigureKey, Required<Pick<Override, 'comparison'>> & Override>> = {
  driftsmargin: { comparison: compared('higher_is_better', '-0.05', '-0.03', '0.05'), profit: { kind: 'amount', ore: d('1000000') } },
  kfd: { comparison: compared('lower_is_better', '60', '50', '40'), gap: amount('100000') },
  lgd: { comparison: compared('higher_is_better', '20', '30', '40'), gap: amount('200000') },
  oml: { comparison: compared('higher_is_better', '1', '2', '3'), gap: amount('350000') },
  // 7 and 8: never read in v1, as on every analysis.
  omsArsverk: { comparison: NOTES },
  lonnArsverk: { comparison: NOTES },
};

const KEY_FIGURES: SubjectKeyFigures = {
  sum_driftsinntekter_ore: '10000000',
  driftsresultat_ore: '-500000',
  sum_driftskostnad_ore: '10500000',
  sum_eiendeler_ore: '5000000',
  sum_egenkapital_gjeld_ore: '5000000',
  sum_egenkapital_ore: '2000000',
  sum_gjeld_ore: '3000000',
};

function benchmarks(overrides: Partial<Record<FigureKey, Override>> = {}): { api: ApiBenchmark; document: DocumentBenchmark } {
  const api = {} as Record<keyof ApiBenchmark, FigureBenchmark>;
  const document = {} as Record<DocumentKeyFigure, DocumentFigureBenchmark>;
  for (const key of KEYS) {
    const direction = directionOf(key);
    const o = { ...DEFAULTS[key], ...overrides[key] };
    const comparison = o.comparison ?? compared(direction, '0.5', '0.5', direction === 'lower_is_better' ? '0.4' : '0.6');
    if (key === 'driftsmargin' || key === 'totalkapitalrentabilitet' || key === 'egenkapitalandel') {
      api[key] = { direction, comparison, gap: key === 'driftsmargin' ? (o.profit ?? { kind: 'none' }) : { kind: 'none' } };
    } else {
      const capital = key === 'kfd' || key === 'lgd' || key === 'oml';
      document[key] = {
        direction,
        rankable: direction !== 'none',
        comparison,
        gap: capital ? (o.gap ?? NO_COMPARISON) : { kind: 'none', reason: 'no_translation' },
      };
    }
  }
  return { api, document };
}

function wireOf(overrides: Partial<Record<FigureKey, Override>> = {}, basis: DocumentBasis['kind'] = 'read'): VerdiWire {
  return verdiWire({ ...benchmarks(overrides), basis, filingYear: 2025, keyFigures: KEY_FIGURES, selskap: 'SYNTETISK AS' });
}

describe('the median step on the control', () => {
  it('the disabled step is described by its reason', () => {
    const cases: readonly [Partial<Record<FigureKey, Override>>, string][] = [
      [{ driftsmargin: { comparison: compared('higher_is_better', '0', '-0.03', '0.05') } }, t('verdi.median.above', { selskap: 'SYNTETISK AS' })],
      [{ driftsmargin: { comparison: compared('higher_is_better', '-0.03', '-0.03', '0.05') } }, t('verdi.median.at', { selskap: 'SYNTETISK AS' })],
      [{ driftsmargin: { comparison: compared('higher_is_better', '-0.05', '0.05', '0.05') } }, nb['verdi.median.isBest']],
      [{ driftsmargin: { comparison: belowFloor(7), profit: { kind: 'none' } } }, nb['verdi.median.belowFloor']],
      [
        {
          driftsmargin: {
            comparison: { kind: 'subject_absent', absence: { reason: 'undefined', cause: 'denominator_not_positive' }, count: 12, leftOut: 0 },
            profit: { kind: 'none' },
          },
        },
        t('analysis.figures.undefined', { grunn: nb['analysis.figures.reason.revenueNotPositive'] }),
      ],
    ];
    for (const [overrides, reason] of cases) {
      const view = verdiCards(wireOf(overrides), 50);
      const median = view.steps.find((step) => step.share === 'median');
      expect(median, reason).toEqual({ share: 'median', label: nb['verdi.step.medianNone'], disabled: true });
      expect(view.line, reason).toBe(reason);
      // "Medianen gjelder driftsmargin." shows in every state, once.
      expect(view.applies === null ? view.line.endsWith(nb['verdi.median.applies']) : view.applies === nb['verdi.median.applies']).toBe(true);
      // The control renders it aria-disabled, focusable, and described by the line.
      const html = renderToString(
        createElement(ClosableShareControl, { steps: view.steps, current: 50, line: view.line, applies: view.applies, onChoose: () => {} }),
      );
      expect(html).toMatch(/role="radio"[^>]*aria-checked="false"[^>]*aria-disabled="true"[^>]*aria-describedby="verdi-median-linje"/);
      expect(html).toContain(`id="verdi-median-linje"`);
    }
  });

  it('an existing step is enabled in its place, with its whole percent and line', () => {
    const view = verdiCards(wireOf(), 50);
    expect(view.steps.map((step) => step.share)).toEqual([0, 'median', 25, 50, 75, 100]);
    expect(view.steps[1]).toEqual({ share: 'median', label: nb['verdi.step.median'].replace('{n}', '20'), disabled: false });
    expect(view.line).toBe(nb['verdi.median.share'].replace('{n}', '20'));
    expect(view.applies).toBeNull();
  });
});

describe('the cards', () => {
  it('the profit card: the amount at the share of the full amount, per year', () => {
    // Fixture: full 10 000 kr, at the median 2 000 kr.
    const wire = wireOf();
    expect(wire.profit).toMatchObject({ kind: 'amount', full: '1000000', atMedian: '200000' });
    const at50 = verdiCards(wire, 50);
    expect(at50.profit.value).toEqual({ kind: 'amount', text: `${N('5 000 kr')} av ${N('10 000 kr')} per år` });
    expect(at50.profit.share).toBe(t('verdi.profit.share', { andel: N('50 %') }));
    expect(at50.announcement).toBe(t('verdi.announce.profit', { a: N('5 000 kr'), full: N('10 000 kr') }));
    expect(verdiCards(wire, 'median').profit.value?.text).toBe(`${N('2 000 kr')} av ${N('10 000 kr')} per år`);
    expect(verdiCards(wire, 0).profit.value?.text).toBe(`${N('0 kr')} av ${N('10 000 kr')} per år`);
  });

  it('working capital lines and total', () => {
    const lines = (view: ReturnType<typeof verdiCards>) => view.workingCapital.parts.map((part) => part.text);
    const kfd = nb['fig.kfd'];
    const lgd = nb['fig.lgd'];
    // Both amounts: two lines, the total (9) + (10) = 3 000 kr, at 50 %.
    const both = verdiCards(wireOf(), 50);
    expect(lines(both)).toEqual([`${kfd}: ${N('500 kr')} av ${N('1 000 kr')}`, `${lgd}: ${N('1 000 kr')} av ${N('2 000 kr')}`]);
    expect(both.workingCapital.value).toEqual({ kind: 'amount', text: `${N('1 500 kr')} av ${N('3 000 kr')}` });
    expect(both.workingCapital.share).toBe(t('verdi.capital.share', { andel: N('50 %') }));
    // Decision 1: (10) a strength counts as 0: its line reads "▲ Styrke" and the total is (9)'s amount.
    const strength = verdiCards(wireOf({ lgd: { gap: STRENGTH, comparison: compared('higher_is_better', '50', '30', '40') } }), 50);
    expect(lines(strength)).toEqual([`${kfd}: ${N('500 kr')} av ${N('1 000 kr')}`, `${lgd}: ${nb['keyFigures.strength']}`]);
    expect(strength.workingCapital.value).toEqual({ kind: 'amount', text: `${N('500 kr')} av ${N('1 000 kr')}` });
    // Both strengths: the card is a strength, with no kroner and no median line.
    const both2 = verdiCards(
      wireOf({
        kfd: { gap: STRENGTH, comparison: compared('lower_is_better', '30', '50', '40') },
        lgd: { gap: STRENGTH, comparison: compared('higher_is_better', '50', '30', '40') },
      }),
      50,
    );
    expect(both2.workingCapital).toEqual({ value: { kind: 'text', text: nb['keyFigures.strength'] }, detail: null, share: null, median: null, parts: [] });
    // One part below the floor: its reason on its line, and no total.
    const one = verdiCards(wireOf({ lgd: { gap: NO_COMPARISON, comparison: belowFloor(7) } }), 50);
    expect(lines(one)).toEqual([`${kfd}: ${N('500 kr')} av ${N('1 000 kr')}`, `${lgd}: ${t('keyFigures.belowFloor', { n: '7', min: '10' })}`]);
    expect(one.workingCapital.value).toEqual({ kind: 'text', text: nb['verdi.workingCapital.noTotal'] });
    // Neither part has an amount, nor are both strengths: the two lines, no total and no share.
    const none = verdiCards(
      wireOf({ kfd: { gap: NO_COMPARISON, comparison: belowFloor(4) }, lgd: { gap: NO_COMPARISON, comparison: belowFloor(7) } }),
      50,
    );
    expect(none.workingCapital.value).toBeNull();
    expect(none.workingCapital.share).toBeNull();
    expect(lines(none)).toHaveLength(2);
  });

  it('no displayed total adds two cards', () => {
    // Fixture: profit 10 000 kr, working capital 3 000 kr, (11) 3 500 kr at full convergence; at every share.
    const wire = wireOf();
    for (const share of SHARES) {
      const view = verdiCards(wire, share);
      const amounts = [view.profit, view.workingCapital, view.oml].map((card) => {
        if (card.value?.kind !== 'amount') throw new Error('every card has an amount in the fixture');
        // "{a} av {full}…": the amount at the share and the full amount, in øre-free kroner.
        return [...card.value.text.matchAll(/(\d[\d ]*) kr/g)].map((match) => BigInt((match[1] ?? '').replaceAll(' ', '')));
      });
      // The fixture's state: each card shows its amount at the share and its full amount.
      expect(amounts.map((pair) => pair.length), String(share)).toEqual([2, 2, 2]);
      const shown = amounts.flat();
      // Every pair and the triple, of the amounts at the share and of the full ones.
      for (const index of [0, 1]) {
        const [p = 0n, w = 0n, o = 0n] = amounts.map((pair) => pair[index] ?? 0n);
        for (const sum of [p + w, p + o, w + o, p + w + o]) {
          if (sum === 0n) continue;
          expect(shown, `${String(share)}: ${sum}`).not.toContain(sum);
        }
      }
      // And no text anywhere on the cards holds such a sum either.
      const texts = JSON.stringify(view);
      for (const sum of ['13 000 kr', '13 500 kr', '6 500 kr', '16 500 kr']) expect(texts).not.toContain(N(sum));
    }
  });

  it('each card’s median line is its own figure’s', () => {
    // Fixture: driftsmargin reaches its median at 20 %, (9), (10) and (11) each at 50 %.
    const view = verdiCards(
      wireOf({
        kfd: { comparison: compared('lower_is_better', '60', '55', '40') },
        oml: { comparison: compared('higher_is_better', '1', '1.003', '3') },
      }),
      50,
    );
    expect(view.profit.median).toBe(t('verdi.cardMedian.share', { x: '20' }));
    // (9): (55 − 60) / (40 − 60) = 25 %; (10): 50 %; (11): 0,003 / 2 = 0,15 %, under 1 %.
    expect(view.workingCapital.parts.map((part) => part.median)).toEqual([
      t('verdi.cardMedian.share', { x: '25' }),
      t('verdi.cardMedian.share', { x: '50' }),
    ]);
    expect(view.oml.median).toBe(nb['verdi.cardMedian.under']);
    // At or beyond its median: the profit card "allerede over", a capital card N12 "allerede nådd".
    const reached = verdiCards(
      wireOf({
        driftsmargin: { comparison: compared('higher_is_better', '-0.03', '-0.03', '0.05') },
        kfd: { comparison: compared('lower_is_better', '45', '50', '40') },
        oml: { comparison: compared('higher_is_better', '2.9995', '2', '3') },
      }),
      50,
    );
    expect(reached.profit.median).toBe(nb['verdi.cardMedian.above']);
    expect(reached.workingCapital.parts[0]?.median).toBe(nb['verdi.cardMedian.reached']);
    expect(reached.oml.median).toBe(nb['verdi.cardMedian.reached']);
    // Over 99 %: (10) at 20 against a median of 39,999 and beste fjerdedel 40.
    expect(verdiCards(wireOf({ lgd: { comparison: compared('higher_is_better', '20', '39.999', '40') } }), 50).workingCapital.parts[1]?.median).toBe(
      nb['verdi.cardMedian.over'],
    );
  });

  it('a card whose median equals its beste fjerdedel reaches it at 100 %', () => {
    // Fixture: (10) at 20 against a median and beste fjerdedel both 40, so its own share is exactly 1.
    const view = verdiCards(wireOf({ lgd: { comparison: compared('higher_is_better', '20', '40', '40') } }), 50);
    expect(view.workingCapital.parts[1]?.median).toBe(t('verdi.cardMedian.share', { x: '100' }));
    expect(view.workingCapital.parts[1]?.median).not.toBe(nb['verdi.cardMedian.over']);
  });

  it('a strength reads the story’s sentence', () => {
    const view = verdiCards(
      wireOf({ driftsmargin: { comparison: compared('higher_is_better', '0.06', '-0.03', '0.05'), profit: { kind: 'strength' } } }),
      50,
    );
    expect(view.profit).toEqual({ value: { kind: 'text', text: nb['verdi.profit.strength'] }, detail: null, share: null, median: null });
    expect(view.steps.find((step) => step.share === 'median')?.disabled).toBe(true);
    // No profit amount: the announcement names the share.
    expect(view.announcement).toBe(t('verdi.announce.share', { andel: N('50 %') }));
    // A capital strength: "▲ Styrke", no kroner, no median line.
    const oml = verdiCards(wireOf({ oml: { gap: STRENGTH, comparison: compared('higher_is_better', '4', '2', '3') } }), 50).oml;
    expect(oml).toEqual({ value: { kind: 'text', text: nb['keyFigures.strength'] }, detail: null, share: null, median: null });
  });

  it('a card without a target', () => {
    const view = verdiCards(
      wireOf({
        driftsmargin: { comparison: belowFloor(7), profit: { kind: 'none' } },
        oml: { comparison: belowFloor(3), gap: NO_COMPARISON },
      }),
      50,
    );
    expect(view.profit.value?.text).toBe(t('verdi.noTarget', { figur: 'driftsmargin' }));
    expect(view.oml.value?.text).toBe(t('verdi.noTarget', { figur: 'omløpshastighet driftseiendeler' }));
    expect(view.profit.median).toBeNull();
    expect(view.oml.median).toBeNull();
  });

  it('an unread basis names itself', () => {
    // Demo A and B: outside the demo data, every capital figure absent for that one reason.
    const absent: Comparison = { kind: 'subject_absent', absence: { reason: 'not_in_dataset' }, count: 0, leftOut: 12 };
    const view = verdiCards(
      wireOf(
        {
          kfd: { comparison: absent, gap: NO_COMPARISON },
          lgd: { comparison: absent, gap: NO_COMPARISON },
          oml: { comparison: absent, gap: NO_COMPARISON },
        },
        'not_in_dataset',
      ),
      50,
    );
    expect(view.workingCapital.value).toEqual({ kind: 'text', text: nb['analysis.figures.notInDataset'] });
    expect(view.workingCapital.parts).toEqual([]);
    expect(view.oml.value).toEqual({ kind: 'text', text: nb['analysis.figures.notInDataset'] });
    // The profit card is as normal.
    expect(view.profit.value?.kind).toBe('amount');
  });

  it('not NOK', () => {
    const view = verdiCards(
      wireOf({
        driftsmargin: { profit: { kind: 'not_nok' } },
        kfd: { gap: NOT_NOK },
        lgd: { gap: NOT_NOK },
        oml: { gap: NOT_NOK },
      }),
      'median',
    );
    // The step follows r < M < T as in NOK.
    expect(view.steps.find((step) => step.share === 'median')?.disabled).toBe(false);
    for (const card of [view.profit, view.workingCapital, view.oml]) expect(card.value).toEqual({ kind: 'text', text: nb['keyFigures.notInKroner'] });
    // Each keeps its own median line; no amount crosses the wire.
    expect(view.profit.median).toBe(t('verdi.cardMedian.share', { x: '20' }));
    expect(JSON.stringify(wireOf({ driftsmargin: { profit: { kind: 'not_nok' } }, kfd: { gap: NOT_NOK }, lgd: { gap: NOT_NOK }, oml: { gap: NOT_NOK } }))).not.toMatch(/"(full|atMedian)"/);
  });
});
