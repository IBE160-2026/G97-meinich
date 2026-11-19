// Oversikt's three small cards (Story 3.4, decisions 1–3; FR-27, FR-29,
// FR-30): the engine's capital choice (`largestCapitalGap`) and the views
// that word the three cards (src/analysis/oversikt-cards.ts). Every fixture
// is synthetic and hand-made: gaps and comparisons written out, so each
// expected card can be read off the fixture.
import { describe, expect, it } from 'vitest';
import {
  capitalCard,
  missingBasisCard,
  NEVER_STRENGTH,
  oversiktCards,
  strengthCard,
} from '../../src/analysis/oversikt-cards.ts';
import { KEY_FIGURE_ROWS, keyFigureRows, type FigureKey } from '../../src/analysis/key-figure-rows.ts';
import {
  largestCapitalGap,
  type ApiBenchmark,
  type CapitalGap,
  type DocumentBenchmark,
  type DocumentFigureBenchmark,
  type FigureBenchmark,
  type KronerGap,
} from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { DOCUMENT_FIGURE_DIRECTIONS } from '../../src/engine/document-key-figures.ts';
import type { DocumentKeyFigure } from '../../src/engine/document-absence.ts';
import { formatKronerExact } from '../../src/engine/format.ts';
import { API_FIGURE_DIRECTIONS } from '../../src/engine/key-figures.ts';
import type { Comparison, Direction } from '../../src/engine/types.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const amount = (ore: string): CapitalGap => ({ kind: 'amount', ore: new Decimal(ore), oneOff: true });
const STRENGTH: CapitalGap = { kind: 'strength' };
const NOT_NOK: CapitalGap = { kind: 'not_nok' };
const BELOW: CapitalGap = { kind: 'none', reason: 'no_comparison' };

describe('largestCapitalGap', () => {
  it('the largest amount wins, compared exactly', () => {
    // Fixture: (9) 100 + (10) 200 = 300 øre of working capital; (11) 301 øre, larger.
    expect(largestCapitalGap(amount('100'), amount('200'), amount('301'))).toEqual({
      kind: 'amount',
      figure: 'oml',
      ore: new Decimal('301'),
      oneOff: true,
    });
    // (11) smaller: the working-capital total, the one sum shown.
    expect(largestCapitalGap(amount('100'), amount('200'), amount('299'))).toEqual({
      kind: 'amount',
      figure: 'working_capital',
      ore: new Decimal('300'),
      oneOff: true,
    });
  });

  it('one of 9 and 10 alone is shown as that part; beside a strength it is the working-capital total', () => {
    // Fixture: (9) an amount, (10) below the floor, (11) none: (9) alone, no total.
    expect(largestCapitalGap(amount('500'), BELOW, BELOW)).toEqual({ kind: 'amount', figure: 'kfd', ore: new Decimal('500'), oneOff: true });
    expect(largestCapitalGap(BELOW, amount('700'), BELOW)).toEqual({ kind: 'amount', figure: 'lgd', ore: new Decimal('700'), oneOff: true });
    // Story 3.5, decision 1: beside a strength, which counts as 0, the same amount is the working-capital total.
    expect(largestCapitalGap(amount('500'), STRENGTH, BELOW)).toEqual({
      kind: 'amount',
      figure: 'working_capital',
      ore: new Decimal('500'),
      oneOff: true,
    });
    expect(largestCapitalGap(STRENGTH, amount('700'), BELOW)).toEqual({
      kind: 'amount',
      figure: 'working_capital',
      ore: new Decimal('700'),
      oneOff: true,
    });
    // (9) alone against a smaller (11): (9), never 9 + 11.
    expect(largestCapitalGap(amount('500'), BELOW, amount('400'))).toEqual({ kind: 'amount', figure: 'kfd', ore: new Decimal('500'), oneOff: true });
  });

  it('a tie goes to the lower figure number', () => {
    // Fixture: working capital 150 + 150 = 300 øre and (11) 300 øre exactly.
    expect(largestCapitalGap(amount('150'), amount('150'), amount('300'))).toMatchObject({ figure: 'working_capital' });
    // (10) alone against an equal (11): (10).
    expect(largestCapitalGap(BELOW, amount('300'), amount('300'))).toMatchObject({ figure: 'lgd' });
    // (10) beside a strength is the working-capital total, against an equal (11): working capital.
    expect(largestCapitalGap(STRENGTH, amount('300'), amount('300'))).toMatchObject({ figure: 'working_capital' });
  });

  it('compared before rounding', () => {
    // Fixture: amounts 0,2 øre apart that both display as 1 000 000 kr.
    const wc = largestCapitalGap(amount('50000000'), amount('50000020.4'), amount('100000020.2'));
    expect(formatKronerExact('100000020.4')).toBe(formatKronerExact('100000020.2'));
    expect(wc).toMatchObject({ figure: 'working_capital', ore: new Decimal('100000020.4') });
    // And the other way: (11) larger by a fraction of an øre wins, though both round alike.
    expect(largestCapitalGap(amount('50000000'), amount('50000020.4'), amount('100000020.5'))).toMatchObject({ figure: 'oml' });
  });

  it('no amount: not in kroner, all strengths, otherwise no gap', () => {
    // Fixture: no amount among the three; the first reason that applies.
    expect(largestCapitalGap(NOT_NOK, STRENGTH, STRENGTH)).toEqual({ kind: 'none', reason: 'not_nok' });
    expect(largestCapitalGap(STRENGTH, STRENGTH, STRENGTH)).toEqual({ kind: 'none', reason: 'all_strengths' });
    expect(largestCapitalGap(STRENGTH, BELOW, STRENGTH)).toEqual({ kind: 'none', reason: 'no_gap' });
    expect(largestCapitalGap(BELOW, BELOW, { kind: 'none', reason: 'target_not_positive' })).toEqual({ kind: 'none', reason: 'no_gap' });
  });
});

// ---- Hand-made benchmarks for the card views --------------------------------

const KEYS = Object.keys(KEY_FIGURE_ROWS) as FigureKey[];

function directionOf(key: FigureKey): Direction {
  return key in API_FIGURE_DIRECTIONS
    ? API_FIGURE_DIRECTIONS[key as keyof typeof API_FIGURE_DIRECTIONS]
    : DOCUMENT_FIGURE_DIRECTIONS[key as DocumentKeyFigure];
}

/**
 * A compared figure: own value `subject`, quartiles 0,4 and 0,6, median 0,5,
 * beste fjerdedel the favourable quartile (none without a direction) and
 * Plassering `percentile`.
 */
function compared(direction: Direction, subject: string, percentile = '50'): Comparison {
  const d = (value: string) => new Decimal(value);
  return {
    kind: 'compared',
    subject: d(subject),
    source: 'document',
    count: 12,
    leftOut: 0,
    median: d('0.5'),
    lowerQuartile: d('0.4'),
    upperQuartile: d('0.6'),
    p5: d('0.1'),
    p95: d('0.9'),
    best:
      direction === 'none'
        ? null
        : { quartile: d(direction === 'higher_is_better' ? '0.6' : '0.4'), percentile: d(percentile) },
  };
}

const belowFloor = (count: number): Comparison => ({
  kind: 'below_floor',
  subject: new Decimal('0.5'),
  source: 'document',
  absence: { reason: 'below_floor', count },
  count,
  leftOut: 0,
});

const NOTES: Comparison = { kind: 'subject_absent', absence: { reason: 'not_read_in_v1', scope: 'notes' }, count: 0, leftOut: 12 };

type Override = { readonly comparison?: Comparison; readonly direction?: Direction; readonly gap?: CapitalGap; readonly profit?: KronerGap };

/**
 * Every figure compared at the median (no strength), each capital figure
 * with an amount and driftsmargin with a profit gap, except 7 and 8, which
 * v1 never reads (as on every analysis); then `overrides` per figure.
 */
function benchmarks(overrides: Partial<Record<FigureKey, Override>> = {}): { api: ApiBenchmark; document: DocumentBenchmark } {
  const api = {} as Record<keyof ApiBenchmark, FigureBenchmark>;
  const document = {} as Record<DocumentKeyFigure, DocumentFigureBenchmark>;
  for (const key of KEYS) {
    const o = overrides[key] ?? {};
    const direction = o.direction ?? directionOf(key);
    const comparison = o.comparison ?? (key === 'omsArsverk' || key === 'lonnArsverk' ? NOTES : compared(direction, '0.5'));
    if (key === 'driftsmargin' || key === 'totalkapitalrentabilitet' || key === 'egenkapitalandel') {
      const gap: KronerGap = key === 'driftsmargin' ? (o.profit ?? { kind: 'amount', ore: new Decimal('100000') }) : { kind: 'none' };
      api[key] = { direction, comparison, gap };
    } else {
      const capital = key === 'kfd' || key === 'lgd' || key === 'oml';
      document[key] = {
        direction,
        rankable: direction !== 'none',
        comparison,
        gap: capital ? (o.gap ?? amount('100000')) : { kind: 'none', reason: 'no_translation' },
      };
    }
  }
  return { api, document };
}

const capitalOf = (b: ReturnType<typeof benchmarks>, basis: Parameters<typeof capitalCard>[1] = 'read') =>
  capitalCard(b.document, basis, keyFigureRows(b.api, b.document, 2025));
const strengthOf = (b: ReturnType<typeof benchmarks>) => strengthCard(b.api, b.document, keyFigureRows(b.api, b.document, 2025));
const missingOf = (b: ReturnType<typeof benchmarks>) => missingBasisCard(keyFigureRows(b.api, b.document, 2025));

describe('Største kapitalgap', () => {
  it('the largest amount wins, compared exactly: (11) with its label, and the two fixed lines', () => {
    // Fixture: (9) 1 000 kr + (10) 2 000 kr, (11) 3 500 kr.
    const card = capitalOf(benchmarks({ kfd: { gap: amount('100000') }, lgd: { gap: amount('200000') }, oml: { gap: amount('350000') } }));
    expect(card).toEqual({
      kind: 'shown',
      name: nb['fig.oml'],
      value: nb['oversikt.capital.amount'].replace('{belop}', formatKronerExact('350000')),
      topNote: true,
      lines: [nb['oversikt.capital.notPerYear']],
    });
  });

  it('one of 9 and 10 alone is shown as that part, and the total under its own label', () => {
    // Fixture: (9) 1 000 kr, (10) below the floor, (11) none; then (10) a strength; then both 9 and 10 amounts.
    const alone = capitalOf(
      benchmarks({ lgd: { gap: BELOW, comparison: belowFloor(3) }, oml: { gap: BELOW, comparison: belowFloor(3) } }),
    );
    expect(alone).toMatchObject({ kind: 'shown', name: nb['fig.kfd'], value: nb['oversikt.capital.amount'].replace('{belop}', formatKronerExact('100000')) });
    // Story 3.5, decision 1: beside a strength the part is the total, named as the total, with the same amount.
    const besideStrength = capitalOf(benchmarks({ lgd: { gap: STRENGTH }, oml: { gap: BELOW, comparison: belowFloor(3) } }));
    expect(besideStrength).toMatchObject({
      kind: 'shown',
      name: nb['oversikt.capital.workingCapital'],
      value: nb['oversikt.capital.amount'].replace('{belop}', formatKronerExact('100000')),
    });
    const both = capitalOf(benchmarks({ oml: { gap: BELOW, comparison: belowFloor(3) } }));
    expect(both).toMatchObject({ name: nb['oversikt.capital.workingCapital'], value: nb['oversikt.capital.amount'].replace('{belop}', formatKronerExact('200000')) });
  });


  it('the capital card never reads the profit gap', () => {
    // Fixture: the same capital gaps under three profit gaps, from none to far above them.
    const cards = (
      [{ kind: 'strength' }, { kind: 'not_nok' }, { kind: 'amount', ore: new Decimal('999999999999') }] as const satisfies readonly KronerGap[]
    ).map((profit) => oversiktCards({ ...benchmarks({ driftsmargin: { profit } }), basis: 'read', filingYear: 2025 }).capital);
    expect(cards[1]).toEqual(cards[0]);
    expect(cards[2]).toEqual(cards[0]);
  });

  it('cost shares never qualify', () => {
    // Fixture: the three cost shares far worse than beste fjerdedel; the capital figures below the floor.
    const worse = { comparison: compared('lower_is_better', '0.95', '1') };
    const b = benchmarks({
      vare: worse,
      lonn: worse,
      andre: worse,
      kfd: { gap: BELOW, comparison: belowFloor(4) },
      lgd: { gap: BELOW, comparison: belowFloor(4) },
      oml: { gap: BELOW, comparison: belowFloor(4) },
    });
    expect(capitalOf(b)).toEqual({ kind: 'empty', text: nb['oversikt.capital.noGap'], detail: null });
  });

  it('capital card states, in order', () => {
    // Fixture 1: the subject's document is outside the demo data: every capital figure is absent for that reason.
    const outside = { comparison: { kind: 'subject_absent', absence: { reason: 'not_in_dataset' }, count: 0, leftOut: 12 } as Comparison, gap: BELOW };
    const notInDataset = benchmarks({ kfd: outside, lgd: outside, oml: outside });
    expect(capitalOf(notInDataset, 'not_in_dataset')).toEqual({ kind: 'empty', text: nb['analysis.figures.notInDataset'], detail: null });
    // Fixture 1b: the other bases that are not read, each with its own words and, where it has one, its detail line.
    for (const [basis, absence, text, detail] of [
      ['failed_reconciliation', { reason: 'failed_reconciliation' }, 'Regnskapet for 2025 kunne ikke leses sikkert', null],
      ['document_missing', { reason: 'document_missing' }, 'Regnskapet for 2025 er ikke lest inn', null],
      [
        'not_read_in_v1',
        { reason: 'not_read_in_v1', scope: 'paper' },
        nb['analysis.figures.notReadInV1'],
        'Regnskapet for 2025 er levert på papir. Denne versjonen av Peerless leser ikke papirregnskap.',
      ],
    ] as const) {
      const absent = { comparison: { kind: 'subject_absent', absence, count: 0, leftOut: 12 } as Comparison, gap: BELOW };
      const b = benchmarks({ kfd: absent, lgd: absent, oml: absent });
      const kfdRow = keyFigureRows(b.api, b.document, 2025).find((row) => row.key === 'kfd');
      expect(kfdRow?.own, basis).toMatchObject({ text, detail });
      expect(capitalOf(b, basis), basis).toEqual({ kind: 'empty', text, detail });
    }
    // Rule 1 comes first: outside the demo data, even when another rule would apply.
    expect(capitalOf(benchmarks({ kfd: { gap: NOT_NOK }, lgd: { gap: NOT_NOK }, oml: { gap: NOT_NOK } }), 'not_in_dataset').kind).toBe('empty');
    // Fixture 2: read, an amount there would be not in NOK, the others strengths: "Beløpet er ikke i kroner" before the strengths.
    expect(capitalOf(benchmarks({ kfd: { gap: NOT_NOK }, lgd: { gap: STRENGTH }, oml: { gap: STRENGTH } }))).toEqual({
      kind: 'empty',
      text: nb['keyFigures.notInKroner'],
      detail: null,
    });
    // Fixture 3: all three strengths.
    expect(capitalOf(benchmarks({ kfd: { gap: STRENGTH }, lgd: { gap: STRENGTH }, oml: { gap: STRENGTH } }))).toEqual({
      kind: 'empty',
      text: nb['oversikt.capital.none'],
      detail: null,
    });
    // Fixture 4: mixed, a strength and two below the floor: K2.
    expect(
      capitalOf(benchmarks({ kfd: { gap: STRENGTH }, lgd: { gap: BELOW, comparison: belowFloor(2) }, oml: { gap: BELOW, comparison: belowFloor(2) } })),
    ).toEqual({ kind: 'empty', text: nb['oversikt.capital.noGap'], detail: null });
  });
});

describe('Største styrke', () => {
  const strong = (direction: Direction, percentile: string): Override => ({
    comparison: compared(direction, direction === 'lower_is_better' ? '0.3' : '0.7', percentile),
  });

  it('strength: ranked on the shown whole percent, ties to the lower figure number', () => {
    // Fixture: EBITDA-margin (2) at 86,6 % and operating asset turnover (11) at 87,4 %: both show 87 %.
    const card = strengthOf(benchmarks({ ebitda: strong('higher_is_better', '86.6'), oml: strong('higher_is_better', '87.4') }));
    expect(card).toEqual({
      kind: 'shown',
      name: nb['fig.ebitda'],
      value: 'bedre enn 87 %',
      topNote: false,
      lines: ['70,0 % mot 60,0 % i beste fjerdedel'],
    });
    // Fixture: receivable days (9) at 90,5 % shows 91 %, above EBITDA-margin's 90,4 % (90 %).
    expect(strengthOf(benchmarks({ ebitda: strong('higher_is_better', '90.4'), kfd: strong('lower_is_better', '90.5') }))).toMatchObject({
      name: nb['fig.kfd'],
      value: 'bedre enn 91 %',
    });
  });

  it('strength: only at or beyond beste fjerdedel', () => {
    // Fixture: driftsmargin with a high Plassering but below beste fjerdedel; Lønnskostnadsandel (4) at beste fjerdedel exactly.
    const card = strengthOf(
      benchmarks({
        driftsmargin: { comparison: compared('higher_is_better', '0.59', '99') },
        lonn: { comparison: compared('lower_is_better', '0.4', '60') },
      }),
    );
    expect(card).toMatchObject({ name: nb['fig.lonn'], value: 'bedre enn 60 %' });
  });

  it('strength: 6, 8, 13, 14 and kontant never chosen, even with a direction', () => {
    // Fixture: the five given a direction and a strength at 99 %; Totalkapitalrentabilitet (12) a strength at 60 %.
    const overrides: Partial<Record<FigureKey, Override>> = { totalkapitalrentabilitet: strong('higher_is_better', '60') };
    for (const key of NEVER_STRENGTH) overrides[key] = { direction: 'higher_is_better', ...strong('higher_is_better', '99') };
    expect([...NEVER_STRENGTH].sort()).toEqual(['egenkapitalandel', 'kontant', 'lonnArsverk', 'total', 'vekst']);
    const b = benchmarks(overrides);
    // The table has no words for a compared 8, so its rows are the v1 rows (8 not read); the choice reads `b`.
    const v1 = benchmarks({ ...overrides, lonnArsverk: {} });
    const rows = keyFigureRows(v1.api, v1.document, 2025);
    expect(strengthCard(b.api, b.document, rows)).toMatchObject({ name: nb['fig.tkr'], value: 'bedre enn 60 %' });
  });

  it('strength: none at or beyond beste fjerdedel', () => {
    // Fixture: every figure at its median.
    expect(strengthOf(benchmarks())).toEqual({ kind: 'empty', text: nb['oversikt.strength.none'], detail: null });
  });
});

describe('Mangler grunnlag', () => {
  it('missing basis: rows in table order', () => {
    // Fixture: Leverandørgjeldsdager (10) below the floor, Driftsmargin (1) below the floor, Egenkapitalandel (13) absent.
    const card = missingOf(
      benchmarks({
        lgd: { comparison: belowFloor(7), gap: BELOW },
        driftsmargin: { comparison: belowFloor(7), profit: { kind: 'none' } },
        egenkapitalandel: { comparison: NOTES },
      }),
    );
    // Driftsmargin first in the table's order; its own value and "For få sammenlignbare (7 av 10)";
    // 7 and 8 (never read in v1), 10 and 13 are the four more.
    expect(card).toEqual({
      kind: 'shown',
      name: nb['fig.driftsmargin'],
      value: '50,0 %',
      topNote: false,
      lines: ['For få sammenlignbare (7 av 10)'],
      more: 'og 4 til',
    });
  });

  it('missing basis: 7 and 8 only', () => {
    // Fixture: every figure compared but Omsetning per årsverk (7) and Lønnskostnad per årsverk (8), not read in v1.
    const card = missingOf(benchmarks());
    expect(card).toEqual({
      kind: 'shown',
      name: nb['fig.omsArsverk'],
      value: nb['analysis.figures.notReadInV1'],
      topNote: false,
      lines: [nb['analysis.figures.notReadInV1.notes']],
      more: 'og 1 til',
    });
  });

  it('missing basis: none (unit fixture only: unreachable in v1)', () => {
    // Fixture: every figure compared, 7 and 8 included, which v1 never reads: their rows given
    // EBITDA-margin's comparison cells, since the table has no words for a compared 7 or 8.
    const b = benchmarks();
    const rows = keyFigureRows(b.api, b.document, 2025);
    const ebitda = rows.find((row) => row.key === 'ebitda');
    if (ebitda === undefined) throw new Error('no ebitda row');
    const all = rows.map((row) => (row.key === 'omsArsverk' || row.key === 'lonnArsverk' ? { ...row, comparison: ebitda.comparison } : row));
    expect(missingBasisCard(all)).toEqual({ kind: 'empty', text: nb['oversikt.missing.none'], detail: null, more: null });
  });
});

describe('the three cards together', () => {
  it('reads the rows in the table order', () => {
    // Fixture: the default hand-made benchmarks; the rows are the table's, in KEY_FIGURE_ROWS order.
    const b = benchmarks();
    expect(keyFigureRows(b.api, b.document, 2025).map((row) => row.key)).toEqual(KEYS);
    expect(oversiktCards({ ...b, basis: 'read', filingYear: 2025 }).missing).toMatchObject({ name: nb['fig.omsArsverk'] });
  });
});
