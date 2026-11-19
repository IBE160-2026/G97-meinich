// The Nøkkeltall og gap table as a view (Stories 1.8, 3.1b; FR-21–FR-24,
// FR-27, FR-29, FR-55, FR-56, FR-71; EXPERIENCE.md "Benchmark row",
// "Benchmark table semantics", "State Patterns"): one row per key figure of
// `docs/key-figures.md`, in its order and grouped as it groups them, each
// row's state taken from the engine's comparison and gap.
//
// Pure: the engine's two benchmarks (`ApiBenchmark`, `DocumentBenchmark`)
// in, strings and strip geometry out. This is the payload boundary (AD-4):
// nothing in a row is a `Decimal`, a `bigint`, an amount in øre or a
// document basis, so the table that renders it cannot pass one to the page
// (test/analysis/key-figure-rows.test.ts). Every number goes through
// format.ts, once; every word through t().
import type {
  ApiBenchmark,
  CapitalGap,
  DocumentBenchmark,
  FigureBenchmark,
  KronerGap,
  TurnoverBenchmark,
} from '../engine/benchmark.ts';
import type { DocumentKeyFigure } from '../engine/document-absence.ts';
import {
  formatDays,
  formatKronerExact,
  formatPercent,
  formatTurnover,
  formatWholePercent,
} from '../engine/format.ts';
import { MIN_PEERS, type ApiKeyFigures, type Comparison, type Direction } from '../engine/types.ts';
import type { MarginWaterfall } from '../engine/waterfall.ts';
import { t, type MessageId } from '../messages/index.ts';
import { decompositionView, type DecompositionView } from './decomposition-view.ts';
import { capitalAmountText, kronerAmountText } from './kroner-amount.ts';
import { absenceDetail, absenceText } from './figure-text.ts';
import { DIRECTION_WORDS, stripMarks, type StripMarks } from './strip-marks.ts';
import { middleHalfText, type Unit } from './middle-half.ts';
import { waterfallView, type WaterfallView } from './waterfall-view.ts';

export { DIRECTION_WORDS, middleHalfText, stripMarks, type StripMarks };

/** A row's key: the API figure's (`ApiKeyFigures`) or the document figure's (`DOCUMENT_KEY_FIGURES`). */
export type FigureKey = keyof ApiKeyFigures | DocumentKeyFigure;


/**
 * A figure's place in the table: a benchmarked figure, a cost share (3–5:
 * no kroner of its own, explained by the margin decomposition), or the check
 * row (6: total cost share, never ranked).
 */
type Role = 'figure' | 'cost_share' | 'check';

type RowDefinition = {
  readonly key: FigureKey;
  readonly label: MessageId;
  /** The words for a zero or negative denominator; null for 7 and 8 (see AbsenceContext). */
  readonly denominator: MessageId | null;
  readonly unit: Unit;
  readonly role: Role;
};

const REVENUE: MessageId = 'analysis.figures.reason.revenueNotPositive';
const ASSETS: MessageId = 'analysis.figures.reason.assetsNotPositive';

/** Every key figure, in `docs/key-figures.md` order. */
export const KEY_FIGURE_ROWS: Readonly<Record<FigureKey, RowDefinition>> = {
  driftsmargin: { key: 'driftsmargin', label: 'fig.driftsmargin', denominator: REVENUE, unit: 'percent', role: 'figure' },
  ebitda: { key: 'ebitda', label: 'fig.ebitda', denominator: REVENUE, unit: 'percent', role: 'figure' },
  vare: { key: 'vare', label: 'fig.vare', denominator: REVENUE, unit: 'percent', role: 'cost_share' },
  lonn: { key: 'lonn', label: 'fig.lonn', denominator: REVENUE, unit: 'percent', role: 'cost_share' },
  andre: { key: 'andre', label: 'fig.andre', denominator: REVENUE, unit: 'percent', role: 'cost_share' },
  total: { key: 'total', label: 'fig.total', denominator: REVENUE, unit: 'percent', role: 'check' },
  omsArsverk: { key: 'omsArsverk', label: 'fig.omsArsverk', denominator: null, unit: 'kroner', role: 'figure' },
  lonnArsverk: { key: 'lonnArsverk', label: 'fig.lonnArsverk', denominator: null, unit: 'kroner', role: 'figure' },
  kfd: { key: 'kfd', label: 'fig.kfd', denominator: 'analysis.figures.reason.salesNotPositive', unit: 'days', role: 'figure' },
  lgd: { key: 'lgd', label: 'fig.lgd', denominator: 'analysis.figures.reason.costsNotPositive', unit: 'days', role: 'figure' },
  oml: {
    key: 'oml',
    label: 'fig.oml',
    denominator: 'analysis.figures.reason.operatingAssetsNotPositive',
    unit: 'turnover',
    role: 'figure',
  },
  totalkapitalrentabilitet: {
    key: 'totalkapitalrentabilitet',
    label: 'fig.tkr',
    denominator: ASSETS,
    unit: 'percent',
    role: 'figure',
  },
  egenkapitalandel: { key: 'egenkapitalandel', label: 'fig.ek', denominator: ASSETS, unit: 'percent', role: 'figure' },
  kontant: { key: 'kontant', label: 'fig.kontant', denominator: ASSETS, unit: 'percent', role: 'figure' },
  vekst: {
    key: 'vekst',
    label: 'fig.vekst',
    denominator: 'analysis.figures.reason.priorRevenueNotPositive',
    unit: 'percent',
    role: 'figure',
  },
};

/** The groups of `docs/key-figures.md`, each its own `<tbody>`; only the cost-share group has a heading (decision 1). */
export const KEY_FIGURE_GROUPS: readonly {
  readonly id: string;
  readonly heading: MessageId | null;
  readonly rows: readonly FigureKey[];
}[] = [
  { id: 'margin', heading: null, rows: ['driftsmargin', 'ebitda'] },
  { id: 'cost', heading: 'keyFigures.costShare.group', rows: ['vare', 'lonn', 'andre', 'total'] },
  { id: 'productivity', heading: null, rows: ['omsArsverk', 'lonnArsverk'] },
  { id: 'workingCapital', heading: null, rows: ['kfd', 'lgd'] },
  { id: 'capital', heading: null, rows: ['oml', 'totalkapitalrentabilitet', 'egenkapitalandel', 'kontant'] },
  { id: 'context', heading: null, rows: ['vekst'] },
];

/** A cell's visible text and, where it shows only a dash, what a screen reader hears instead. */
export type CellText = { readonly text: string; readonly srOnly?: string };

/**
 * The kroner cell: the main text (an amount is 600), an optional slate
 * subline. `waterfall`: the text is a link that opens the margin waterfall
 * fold-out and moves focus to its heading (a cost share, Story 3.3).
 */
export type GapCell = {
  readonly text: string;
  readonly sub?: string;
  readonly srOnly?: string;
  readonly amount: boolean;
  readonly waterfall?: true;
};

export type KeyFigureRow = {
  readonly key: FigureKey;
  readonly label: string;
  /** In the cost-share row group: indented under Driftsmargin. */
  readonly indent: boolean;
  /** "{direction} · {n} sammenlignbare brukt · {k} utelatt"; the check row names itself instead of a direction. */
  readonly subline: string;
  readonly direction: string;
  readonly counts: string;
  readonly own: {
    /** The own value, or the absence's words ("Kan ikke beregnes: …", "Ikke i demodataene", …). */
    readonly text: string;
    /** The explanation of "Ikke lest i denne versjonen", or null. */
    readonly detail: string | null;
    readonly defined: boolean;
    /** Outside the demo data: the cell points to the State block and carries the popover. */
    readonly notInDataset: boolean;
  };
  readonly comparison:
    | {
        readonly kind: 'compared';
        readonly median: string;
        readonly best: CellText;
        readonly placement: CellText;
        readonly middleHalf: string;
        readonly strip: StripMarks;
      }
    | { readonly kind: 'below_floor'; readonly text: string; readonly short: string }
    | { readonly kind: 'subject_absent' };
  readonly gap: GapCell | null;
};

export type KeyFigureGroup = { readonly id: string; readonly heading: string | null; readonly rows: readonly KeyFigureRow[] };

export type KeyFigureTableView = {
  readonly groups: readonly KeyFigureGroup[];
  /** The two decomposition fold-outs' factor pairs (Story 3.2). */
  readonly decompositions: DecompositionView;
  /** The margin waterfall fold-out under Driftsmargin (Story 3.3). */
  readonly waterfall: WaterfallView;
  /** Some row's own value is "Ikke i demodataene": the State block above the table is shown. */
  readonly notInDataset: boolean;
  /** A subject that is not a small enterprise, with any figure below the floor. */
  readonly nonSmall: boolean;
};

const DASH = '–';

function value(unit: Unit, figure: string): string {
  switch (unit) {
    case 'percent':
      return formatPercent(figure);
    case 'days':
      return formatDays(figure);
    case 'turnover':
      return formatTurnover(figure);
    case 'kroner':
      return formatKronerExact(figure);
  }
}


/**
 * The benchmark of one row: its direction, its comparison, and its kroner as
 * the engine gives it, by kind: driftsmargin's profit gap (`KronerGap`), a
 * capital figure's (`CapitalGap`, 9–11), or none of its own (every other
 * figure, whose engine gap is `none`).
 */
type RowBenchmark = {
  readonly direction: Direction;
  readonly comparison: Comparison;
  readonly kroner:
    | { readonly kind: 'profit'; readonly gap: KronerGap }
    | { readonly kind: 'capital'; readonly gap: CapitalGap }
    | { readonly kind: 'none' };
};

const notApplicable = (): CellText => ({ text: DASH, srOnly: t('keyFigures.notApplicable') });
const notApplicableNoDirection = (): CellText => ({ text: DASH, srOnly: t('keyFigures.notApplicableNoDirection') });

function profitCell(gap: KronerGap): GapCell {
  switch (gap.kind) {
    case 'amount':
      return { text: kronerAmountText(gap), sub: t('keyFigures.perYear'), amount: true };
    case 'strength':
      return { text: t('keyFigures.strength'), amount: false };
    case 'not_nok':
      return { text: t('keyFigures.notInKroner'), amount: false };
    case 'none':
      // A compared driftsmargin has a beste fjerdedel, so the engine always gives it a gap.
      throw new Error('a compared driftsmargin has no kroner gap');
  }
}

function capitalCell(gap: CapitalGap): GapCell {
  switch (gap.kind) {
    case 'amount':
      return { text: capitalAmountText(gap), sub: t('keyFigures.oneOff'), amount: true };
    case 'strength':
      return { text: t('keyFigures.strength'), amount: false };
    case 'not_nok':
      return { text: t('keyFigures.notInKroner'), amount: false };
    case 'none':
      if (gap.reason === 'target_not_positive') return { text: t('keyFigures.targetNotPositive'), amount: false };
      // A compared capital figure always has a translation and a comparison.
      throw new Error(`a compared capital figure has no kroner gap (${gap.reason})`);
  }
}

/** The kroner cell of a compared row; null when the comparison cells are merged. */
function gapCell(definition: RowDefinition, benchmark: RowBenchmark): GapCell | null {
  if (benchmark.comparison.kind !== 'compared') return null;
  if (definition.role === 'check') return { ...notApplicable(), amount: false };
  if (benchmark.direction === 'none') return { ...notApplicableNoDirection(), amount: false };
  // Cost shares have no kroner of their own: the margin waterfall explains them, and the cell links to it (Story 3.3).
  if (definition.role === 'cost_share') return { text: t('keyFigures.costShare.kroner'), amount: false, waterfall: true };
  const kroner = benchmark.kroner;
  switch (kroner.kind) {
    case 'profit':
      return profitCell(kroner.gap);
    case 'capital':
      return capitalCell(kroner.gap);
    case 'none':
      return { text: t('keyFigures.noKroner'), amount: false };
  }
}

function row(definition: RowDefinition, benchmark: RowBenchmark, filingYear: number, indent: boolean): KeyFigureRow {
  const { direction, comparison: c } = benchmark;
  const check = definition.role === 'check';
  const directionText = check ? t('keyFigures.checkRow') : t(DIRECTION_WORDS[direction]);
  const counts = t('keyFigures.counts', { n: String(c.count), k: String(c.leftOut) });
  const context = { denominator: definition.denominator, filingYear };
  const own =
    c.kind === 'subject_absent'
      ? {
          text: absenceText(c.absence, context),
          detail: absenceDetail(c.absence, context),
          defined: false,
          notInDataset: c.absence.reason === 'not_in_dataset',
        }
      : { text: value(definition.unit, c.subject.toString()), detail: null, defined: true, notInDataset: false };
  const blank = check ? notApplicable() : notApplicableNoDirection();
  let shown: KeyFigureRow['comparison'];
  if (c.kind === 'compared') {
    shown = {
      kind: 'compared',
      median: value(definition.unit, c.median.toString()),
      best: c.best === null ? blank : { text: value(definition.unit, c.best.quartile.toString()) },
      placement:
        c.best === null
          ? blank
          : { text: t('keyFigures.placement', { v: formatWholePercent(c.best.percentile.toString()) }) },
      middleHalf: middleHalfText(c.lowerQuartile.toString(), c.upperQuartile.toString(), direction === 'none', definition.unit),
      strip: stripMarks(c, direction),
    };
  } else if (c.kind === 'below_floor') {
    const vars = { n: String(c.count), min: String(MIN_PEERS) };
    shown = { kind: 'below_floor', text: t('keyFigures.belowFloor', vars), short: t('keyFigures.belowFloorShort', vars) };
  } else {
    shown = { kind: 'subject_absent' };
  }
  return {
    key: definition.key,
    label: t(definition.label),
    indent,
    subline: `${directionText} · ${counts}`,
    direction: directionText,
    counts,
    own,
    comparison: shown,
    gap: gapCell(definition, benchmark),
  };
}

function apiRow(figure: FigureBenchmark, profit: boolean): RowBenchmark {
  return {
    direction: figure.direction,
    comparison: figure.comparison,
    kroner: profit ? { kind: 'profit', gap: figure.gap } : { kind: 'none' },
  };
}

function benchmarkOf(key: FigureKey, api: ApiBenchmark, document: DocumentBenchmark): RowBenchmark {
  switch (key) {
    case 'driftsmargin':
      return apiRow(api.driftsmargin, true);
    case 'totalkapitalrentabilitet':
    case 'egenkapitalandel':
      // The engine gives neither a kroner translation.
      return apiRow(api[key], false);
    case 'kfd':
    case 'lgd':
    case 'oml': {
      const figure = document[key];
      return { direction: figure.direction, comparison: figure.comparison, kroner: { kind: 'capital', gap: figure.gap } };
    }
    default: {
      const figure = document[key];
      return { direction: figure.direction, comparison: figure.comparison, kroner: { kind: 'none' } };
    }
  }
}

/** A fold-out of the table: one of the two decompositions (Story 3.2) or the margin waterfall (Story 3.3). */
export type FoldOutKind = keyof DecompositionView | 'waterfall';

/**
 * Which fold-out opens under which row (Stories 3.2, 3.3; EXPERIENCE.md
 * "Fold-out"): on the desktop right after the row, on the phone after the
 * row's group.
 */
export const DECOMPOSITION_UNDER: Readonly<Partial<Record<FigureKey, FoldOutKind>>> = {
  driftsmargin: 'waterfall',
  totalkapitalrentabilitet: 'margin',
  lonn: 'pay',
};

/**
 * The whole table: every key figure's row, in its group, and the two
 * decompositions. `filingYear` is the benchmark filing's, for an absence's
 * words; `smaaForetak` the subject's filing's, for the non-small notice;
 * `turnover` total asset turnover against the same peers.
 */
export function keyFigureTableView({
  api,
  turnover,
  document,
  waterfall,
  filingYear,
  smaaForetak,
}: {
  readonly api: ApiBenchmark;
  readonly turnover: TurnoverBenchmark;
  readonly document: DocumentBenchmark;
  /** The engine's margin waterfall over the same peers (Story 3.3). */
  readonly waterfall: MarginWaterfall;
  readonly filingYear: number;
  readonly smaaForetak: boolean | null;
}): KeyFigureTableView {
  const groups = KEY_FIGURE_GROUPS.map((group) => ({
    id: group.id,
    heading: group.heading === null ? null : t(group.heading),
    rows: group.rows.map((key) =>
      row(KEY_FIGURE_ROWS[key], benchmarkOf(key, api, document), filingYear, group.heading !== null),
    ),
  }));
  const rows = groups.flatMap((group) => group.rows);
  return {
    groups,
    decompositions: decompositionView({ api, turnover, document, filingYear }),
    waterfall: waterfallView({ waterfall, document, filingYear }),
    notInDataset: rows.some((r) => r.own.notInDataset),
    nonSmall: smaaForetak === false && rows.some((r) => r.comparison.kind === 'below_floor'),
  };
}
