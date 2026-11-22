// The margin waterfall fold-out as a view (Story 3.3; FR-29, FR-30;
// EXPERIENCE.md "Margin waterfall"; DESIGN.md "Margin waterfall"): the
// engine's `MarginWaterfall` in, strings and bar geometry out.
//
// - Shown: the reference tag, the never-added sentence, the start column
//   ("Peer-gruppen samlet", margin M), the four bars each with signed kroner,
//   ▲/▼ and a word, "own mot samlet" shares and, where its cost-share row and
//   the bar point opposite ways, "Mot peer-gruppen samlet, ikke medianen", the
//   end column (the company, its document margin), the legend's three kinds,
//   the chart's summary and the "Vis tallene" table.
// - Absent: one sentence, in this order: the subject's own reason (R2's own
//   words; otherwise the words of its Varekostnadsandel row, "Ikke i
//   demodataene" outside the demo data), "Beløpet er ikke i kroner", N1 when
//   P plus the peers outside the demo data would reach 10, otherwise the
//   too-few sentence with n = |P|.
//
// The margins shown are the document's, the one the bars sum to (decision
// 10): within the tolerance between sources it can read 0,1 pp from the
// Driftsmargin row, which is the API's (`docs/ai-log.md`).
//
// Pure, and a payload boundary (AD-4): nothing here is a `Decimal`, a
// `Fraction`, a `bigint` or an amount in øre; geometry is a Number only for
// drawing (test/analysis/waterfall-view.test.ts). The waterfall is never
// scaled by the closable share: no share reaches this module.
import type { DocumentBenchmark } from '../engine/benchmark.ts';
import { Decimal } from '../engine/decimal.ts';
import { formatKroner, formatPercent, formatSignedKroner } from '../engine/format.ts';
import { MIN_PEERS, type Comparison } from '../engine/types.ts';
import { BAR_FIGURE, type MarginWaterfall, type WaterfallBar } from '../engine/waterfall.ts';
import { t, type MessageId } from '../messages/index.ts';
import { absenceText } from './figure-text.ts';

/** A column's extent on the chart's shared kroner scale, 0 (the lowest level) to 1 (the highest). Geometry, not figures. */
export type BarGeometry = {
  /** The lower end. */
  readonly from: number;
  /** The upper end. */
  readonly to: number;
  /** Where the column ends: its data end, rounded; for a step, the level the next column starts at. */
  readonly end: number;
};

/** How a bar is drawn: petrol, amber, or slate for the residual whatever its sign. */
export type BarKind = 'favourable' | 'unfavourable' | 'residual';

export type WaterfallColumn = {
  readonly label: string;
  /** Whole kroner: "83 571 kr". */
  readonly value: string;
  /** "margin 0,5 %". */
  readonly margin: string;
  readonly geometry: BarGeometry;
};

export type WaterfallStepView = {
  /** The bar's id on the page: its cost share's key (`vare`, `lonn`, `andre`) or `residual`, never an engine field name (AD-4). */
  readonly key: 'vare' | 'lonn' | 'andre' | 'residual';
  readonly label: string;
  /** Signed whole kroner: "+1 019 571 kr", "−501 428 kr". */
  readonly value: string;
  readonly kind: BarKind;
  /** ▲ raises the margin against samlet, ▼ lowers it; null for a bar of exactly 0. Shown aria-hidden; `word` carries it. */
  readonly glyph: '▲' | '▼' | null;
  /** "lavere enn samlet" / "høyere enn samlet": the own share against samlet's; null when equal. */
  readonly word: string | null;
  /** "5,1 % mot 11,2 %". */
  readonly shares: string;
  /** "Mot peer-gruppen samlet, ikke medianen" where the cost-share row and the bar disagree; else null. */
  readonly notMedian: string | null;
  readonly geometry: BarGeometry;
};

export type WaterfallTable = {
  readonly caption: string;
  /** "Post", then the company's name (the component adds it), "Samlet", "Kroner". */
  readonly heads: { readonly post: string; readonly all: string; readonly kroner: string };
  /**
   * The start, the four parts and (Story 3.8) "Sum av postene", each with its
   * shares (none for the start's own or the sum) and its kroner with sign and
   * word. `key` names the row's drill-down (`WaterfallProvenance`).
   */
  readonly rows: readonly {
    readonly key: 'start' | 'vare' | 'lonn' | 'andre' | 'residual' | 'sum';
    readonly head: string;
    readonly own: string;
    readonly all: string;
    /** The kroner, signed for a step. */
    readonly kroner: string;
    /** ▲/▼ for a step, shown aria-hidden (EXPERIENCE.md "Accessibility Floor"); null for the start or a bar of 0. */
    readonly glyph: '▲' | '▼' | null;
    /** "lavere enn samlet" / "høyere enn samlet"; null for the start or a share equal to samlet's. */
    readonly word: string | null;
  }[];
  /** The end row, headed by the company's name (the component writes it): its margin and driftsresultat. */
  readonly end: { readonly own: string; readonly kroner: string };
  /** The last row: "Referanse" and the tag. */
  readonly reference: { readonly head: string; readonly text: string };
};

export type WaterfallView =
  | { readonly kind: 'absent'; readonly text: string }
  | {
      readonly kind: 'shown';
      readonly heading: string;
      /** "Mot peer-gruppen samlet: 0,5 %, ikke beste fjerdedel". */
      readonly tag: string;
      /** "Dette forklarer avviket. …", directly above the bars. */
      readonly sentence: string;
      /** The chart's aria-label: "Fra … (peer-gruppen samlet) til …, fire poster, sum …". */
      readonly summary: string;
      readonly start: WaterfallColumn;
      readonly steps: readonly WaterfallStepView[];
      /** The company's column; its label is the company's name, which the component writes. */
      readonly end: Omit<WaterfallColumn, 'label'>;
      /** Where 0 kr lies on the scale. */
      readonly zero: number;
      readonly legend: { readonly favourable: string; readonly unfavourable: string; readonly residual: string };
      readonly table: WaterfallTable;
      readonly showNumbers: string;
      readonly hideNumbers: string;
    };

const BAR_LABEL: Readonly<Record<WaterfallBar, MessageId>> = {
  varekostnad: 'waterfall.bar.varekostnad',
  lonnskostnad: 'waterfall.bar.lonnskostnad',
  annenDriftskostnad: 'waterfall.bar.annenDriftskostnad',
  residual: 'waterfall.bar.residual',
};

/** Whole kroner as the formatter takes them: øre as a whole-number string. */
const ore = (kroner: bigint): string => (kroner * 100n).toString();

type Compared = Extract<Comparison, { readonly kind: 'compared' }>;

/**
 * Which side of the median a cost-share row reads: 'better' when its own
 * value is better than the median or a strength (at or beyond beste
 * fjerdedel), 'worse' when it is worse, null when at the median or not
 * compared. Cost shares are lower-is-better.
 */
function rowSide(comparison: Comparison): 'better' | 'worse' | null {
  if (comparison.kind !== 'compared') return null;
  const c: Compared = comparison;
  if (c.best !== null && c.subject.lte(c.best.quartile)) return 'better';
  if (c.subject.lt(c.median)) return 'better';
  if (c.subject.gt(c.median)) return 'worse';
  return null;
}

/** Positions on the shared scale: each level (in whole kroner) as a share of [lo, hi]. */
function scale(levels: readonly bigint[]): (value: bigint) => number {
  const lo = levels.reduce((a, b) => (b < a ? b : a), 0n);
  const hi = levels.reduce((a, b) => (b > a ? b : a), 0n);
  if (hi === lo) return () => 0.5;
  const span = new Decimal((hi - lo).toString());
  // toNumber only for geometry.
  return (value) => new Decimal((value - lo).toString()).div(span).toNumber();
}

function geometry(position: (value: bigint) => number, from: bigint, to: bigint): BarGeometry {
  const a = position(from);
  const b = position(to);
  return { from: Math.min(a, b), to: Math.max(a, b), end: b };
}

/** The sentence for a waterfall that is not shown. */
function absentText(waterfall: Exclude<MarginWaterfall, { readonly kind: 'decomposition' }>, filingYear: number): string {
  switch (waterfall.kind) {
    case 'subject_absent':
      if (waterfall.absence.reason === 'cost_lines_short_of_total') return t('waterfall.shortOfTotal', { aar: String(filingYear) });
      // The words of the subject's Varekostnadsandel row (Stories 2.9, 3.1a).
      return absenceText(waterfall.absence, { denominator: 'analysis.figures.reason.revenueNotPositive', filingYear });
    case 'not_nok':
      return t('keyFigures.notInKroner');
    case 'too_few':
      if (waterfall.n + waterfall.notInDataset >= MIN_PEERS) return t('waterfall.notLoaded');
      return t('waterfall.tooFew', { n: String(waterfall.n) });
  }
}

/**
 * The fold-out's view. `document` gives the cost-share rows' comparisons
 * (for "Mot peer-gruppen samlet, ikke medianen"); `filingYear` the benchmark
 * filing's year, for an absence's words.
 */
export function waterfallView({
  waterfall,
  document,
  filingYear,
}: {
  readonly waterfall: MarginWaterfall;
  readonly document: DocumentBenchmark;
  readonly filingYear: number;
}): WaterfallView {
  if (waterfall.kind !== 'decomposition') return { kind: 'absent', text: absentText(waterfall, filingYear) };
  const { display } = waterfall;
  // The levels: start, after each bar, and the end (= the last level).
  const levels: bigint[] = [display.startKroner];
  for (const step of waterfall.steps) levels.push((levels[levels.length - 1] ?? 0n) + step.kroner);
  const position = scale([...levels, display.endKroner]);
  const aggregateMargin = formatPercent(waterfall.aggregateMargin.toString());
  const subjectMargin = formatPercent(waterfall.subjectMargin.toString());
  const tag = t('waterfall.tag', { x: aggregateMargin });

  const steps = waterfall.steps.map((step, i): WaterfallStepView => {
    const sign = step.ore.numerator;
    const figure = BAR_FIGURE[step.bar];
    const side = figure === null ? null : rowSide(document[figure].comparison);
    const favourable = sign > 0n;
    return {
      key: figure ?? 'residual',
      label: t(BAR_LABEL[step.bar]),
      value: formatSignedKroner(ore(step.kroner)),
      kind: step.bar === 'residual' ? 'residual' : favourable ? 'favourable' : 'unfavourable',
      glyph: sign > 0n ? '▲' : sign < 0n ? '▼' : null,
      word: step.own.lt(step.all) ? t('waterfall.lower') : step.own.gt(step.all) ? t('waterfall.higher') : null,
      shares: t('waterfall.shares', { own: formatPercent(step.own.toString()), all: formatPercent(step.all.toString()) }),
      notMedian: side !== null && sign !== 0n && (side === 'better') !== favourable ? t('waterfall.notMedian') : null,
      geometry: geometry(position, levels[i] ?? 0n, levels[i + 1] ?? 0n),
    };
  });

  const start: WaterfallColumn = {
    label: t('waterfall.start'),
    value: formatKroner(ore(display.startKroner)),
    margin: t('waterfall.margin', { m: aggregateMargin }),
    geometry: geometry(position, 0n, display.startKroner),
  };
  const end = {
    value: formatKroner(ore(display.endKroner)),
    margin: t('waterfall.margin', { m: subjectMargin }),
    geometry: geometry(position, 0n, display.endKroner),
  };
  return {
    kind: 'shown',
    heading: t('keyFigures.foldout.waterfall'),
    tag,
    sentence: t('waterfall.neverAdded'),
    summary: t('waterfall.summary', {
      start: start.value,
      end: end.value,
      sum: formatSignedKroner(ore(display.totalKroner)),
    }),
    start,
    steps,
    end,
    zero: position(0n),
    legend: {
      favourable: t('waterfall.legend.favourable'),
      unfavourable: t('waterfall.legend.unfavourable'),
      residual: t('waterfall.legend.residual'),
    },
    table: {
      caption: t('waterfall.table.caption'),
      heads: { post: t('waterfall.table.post'), all: t('waterfall.table.all'), kroner: t('waterfall.table.kroner') },
      rows: [
        { key: 'start' as const, head: start.label, own: '', all: aggregateMargin, kroner: start.value, glyph: null, word: null },
        ...steps.map((step, i) => ({
          key: step.key,
          head: step.label,
          own: formatPercent(waterfall.steps[i]?.own.toString() ?? '0'),
          all: formatPercent(waterfall.steps[i]?.all.toString() ?? '0'),
          kroner: step.value,
          glyph: step.glyph,
          word: step.word,
        })),
        // Story 3.8, decision 3: the bars' sum, with its own drill-down.
        {
          key: 'sum' as const,
          head: t('waterfall.table.sum'),
          own: '',
          all: '',
          kroner: formatSignedKroner(ore(display.totalKroner)),
          glyph: null,
          word: null,
        },
      ],
      end: { own: subjectMargin, kroner: end.value },
      reference: { head: t('waterfall.table.reference'), text: tag },
    },
    showNumbers: t('chart.showNumbers'),
    hideNumbers: t('chart.hideNumbers'),
  };
}
