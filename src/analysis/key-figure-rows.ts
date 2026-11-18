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
} from '../engine/benchmark.ts';
import { stripPosition } from '../engine/benchmark.ts';
import type { DocumentKeyFigure } from '../engine/document-absence.ts';
import {
  formatDays,
  formatDaysNumber,
  formatKronerExact,
  formatPercent,
  formatPercentNumber,
  formatTurnover,
  formatWholePercent,
} from '../engine/format.ts';
import { MIN_PEERS, type ApiKeyFigures, type Comparison, type Direction } from '../engine/types.ts';
import { t, type MessageId } from '../messages/index.ts';
import { capitalAmountText, kronerAmountText } from './kroner-amount.ts';
import { absenceDetail, absenceText } from './figure-text.ts';

/** A row's key: the API figure's (`ApiKeyFigures`) or the document figure's (`DOCUMENT_KEY_FIGURES`). */
export type FigureKey = keyof ApiKeyFigures | DocumentKeyFigure;

/** How a figure's value is written. */
type Unit =
  /** A fraction as percent, one decimal: "2,1 %". */
  | 'percent'
  /** Whole days: "48 dager". */
  | 'days'
  /** A turnover ratio, two decimals: "2,85". */
  | 'turnover'
  /** Øre per årsverk as whole kroner (7 and 8; never a value in v1, which does not read `aarsverk`). */
  | 'kroner';

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

/** A figure's direction in words: "↑ Høyere er bedre", "↓ Lavere er bedre", "Ingen retning". */
export const DIRECTION_WORDS: Readonly<Record<Direction, MessageId>> = {
  higher_is_better: 'keyFigures.dir.higher',
  lower_is_better: 'keyFigures.dir.lower',
  none: 'keyFigures.dir.none',
};

/** Mark positions as a share of the strip's width from the left, 0–1. Geometry, not figures. */
export type StripMarks = {
  readonly own: { readonly at: number; readonly clipped: boolean };
  readonly median: number;
  /** The midtre halvdel's ends, left and right as drawn. */
  readonly bandFrom: number;
  readonly bandTo: number;
  /** Null for a figure with no direction. */
  readonly best: number | null;
  /** Lower is better: drawn mirrored and labelled "Bedre →". */
  readonly mirrored: boolean;
};

/** A cell's visible text and, where it shows only a dash, what a screen reader hears instead. */
export type CellText = { readonly text: string; readonly srOnly?: string };

/** The kroner cell: the main text (an amount is 600), an optional slate subline. */
export type GapCell = { readonly text: string; readonly sub?: string; readonly srOnly?: string; readonly amount: boolean };

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
  /** Some row's own value is "Ikke i demodataene": the State block above the table is shown. */
  readonly notInDataset: boolean;
  /** A subject that is not a small enterprise, with any figure below the floor. */
  readonly nonSmall: boolean;
};

type Compared = Extract<Comparison, { readonly kind: 'compared' }>;

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

const MIDDLE_HALF: Readonly<
  Record<Exclude<Unit, 'kroner'>, Readonly<Record<'plain' | 'negative' | 'labelled' | 'labelledNegative', MessageId>>>
> = {
  percent: {
    plain: 'keyFigures.middleHalf',
    negative: 'keyFigures.middleHalfNegative',
    labelled: 'keyFigures.middleHalfLabelled',
    labelledNegative: 'keyFigures.middleHalfLabelledNegative',
  },
  days: {
    plain: 'keyFigures.middleHalfDays',
    negative: 'keyFigures.middleHalfDaysNegative',
    labelled: 'keyFigures.middleHalfDaysLabelled',
    labelledNegative: 'keyFigures.middleHalfDaysLabelledNegative',
  },
  turnover: {
    plain: 'keyFigures.middleHalfTurnover',
    negative: 'keyFigures.middleHalfTurnoverNegative',
    labelled: 'keyFigures.middleHalfTurnoverLabelled',
    labelledNegative: 'keyFigures.middleHalfTurnoverLabelledNegative',
  },
};

function bound(unit: Exclude<Unit, 'kroner'>, figure: string): string {
  switch (unit) {
    case 'percent':
      return formatPercentNumber(figure);
    case 'days':
      return formatDaysNumber(figure);
    case 'turnover':
      return formatTurnover(figure);
  }
}

/**
 * "midtre halvdel 18,4–49,0 %", or "… −6,3 til 9,1 %" when a bound is
 * negative; "Midtre halvdel: …" with no direction. Days and turnover have
 * their own words (Story 3.1b, decision 5).
 */
export function middleHalfText(lower: string, upper: string, labelled: boolean, unit: Unit = 'percent'): string {
  // 7 and 8 are never compared in v1, and no words are approved for a band in kroner per årsverk.
  if (unit === 'kroner') throw new TypeError('no midtre halvdel words for a figure per årsverk');
  const lo = bound(unit, lower);
  const hi = bound(unit, upper);
  const negative = lo.startsWith('−') || hi.startsWith('−');
  const ids = MIDDLE_HALF[unit];
  const id = labelled ? (negative ? ids.labelledNegative : ids.labelled) : negative ? ids.negative : ids.plain;
  return t(id, { lo, hi });
}

/** The strip's marks from the engine's positions; `toNumber` only for geometry. */
export function stripMarks(comparison: Compared, direction: Direction): StripMarks {
  const at = (mark: Compared['median']) => stripPosition(mark, comparison, direction).at.toNumber();
  const own = stripPosition(comparison.subject, comparison, direction);
  return {
    own: { at: own.at.toNumber(), clipped: own.clipped !== null },
    median: at(comparison.median),
    bandFrom: at(comparison.lowerQuartile),
    bandTo: at(comparison.upperQuartile),
    best: comparison.best === null ? null : at(comparison.best.quartile),
    mirrored: direction === 'lower_is_better',
  };
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
  // Cost shares have no kroner of their own: the margin decomposition explains them (Story 3.3 links it).
  if (definition.role === 'cost_share') return { text: t('keyFigures.costShare.kroner'), amount: false };
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

/**
 * The whole table: every key figure's row, in its group. `filingYear` is the
 * benchmark filing's, for an absence's words; `smaaForetak` the subject's
 * filing's, for the non-small notice.
 */
export function keyFigureTableView({
  api,
  document,
  filingYear,
  smaaForetak,
}: {
  readonly api: ApiBenchmark;
  readonly document: DocumentBenchmark;
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
    notInDataset: rows.some((r) => r.own.notInDataset),
    nonSmall: smaaForetak === false && rows.some((r) => r.comparison.kind === 'below_floor'),
  };
}
