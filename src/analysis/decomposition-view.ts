// The two decomposition fold-outs of the Nøkkeltall og gap tab as a view
// (Story 3.2; FR-26; `docs/key-figures.md`, "Decompositions"; EXPERIENCE.md
// "Fold-out", "Factor pair"):
// - "Margin eller kapitalbruk?" under Totalkapitalrentabilitet: driftsmargin
//   and totalkapitalens omløpshastighet (`sumDriftsinntekter /
//   sumEiendeler`, a derived factor, never key figure 11);
// - "Lønnsnivå eller produktivitet?" under Lønnskostnadsandel: lønnskostnad
//   per årsverk and omsetning per årsverk, which v1 does not read, so both
//   show Story 2.9's not-read-in-v1 state and carry no median.
//
// Each factor stands alone: its own median, its own strip, its own 10-peer
// gate and its own count, as the engine compared it. The factors are never
// multiplied, here or anywhere (test/analysis/never-multiplied.test.ts): the
// median margin × the median turnover is not the median return on assets.
// No factor carries beste fjerdedel, Plassering or kroner; the driftsmargin
// row keeps its own.
//
// Pure: the engine's comparisons in, strings and strip geometry out. This is
// a payload boundary (AD-4): nothing here is a `Decimal`, a `bigint` or an
// amount in øre (test/analysis/decomposition-view.test.ts).
import {
  TOTAL_ASSET_TURNOVER_DIRECTION,
  type ApiBenchmark,
  type DocumentBenchmark,
  type TurnoverBenchmark,
} from '../engine/benchmark.ts';
import { formatPercent, formatTurnover } from '../engine/format.ts';
import { MIN_PEERS, type Comparison, type Direction } from '../engine/types.ts';
import { t, type MessageId } from '../messages/index.ts';
import { absenceDetail, absenceText } from './figure-text.ts';
import { middleHalfText } from './middle-half.ts';
import { DIRECTION_WORDS, stripMarks, type StripMarks } from './strip-marks.ts';

/** A factor compared against its own peers: its value, their median, its count and its strip. */
export type ComparedFactorView = {
  readonly label: string;
  /** The subject's value, labelled with the company name where it is shown. */
  readonly own: string;
  readonly median: string;
  /** "{n} sammenlignbare brukt · {k} utelatt": this factor's own count. */
  readonly counts: string;
  readonly strip: StripMarks;
  /** The strip is aria-hidden, so the quartiles are text too: "Midtre halvdel: {lo}–{hi} %" or "Midtre halvdel: {lo}–{hi}". */
  readonly middleHalf: string;
  /** "↑ Høyere er bedre" for driftsmargin, "Ingen retning" for turnover. */
  readonly direction: string;
};

/** A factor below the floor: the subject's value stays, with "For få sammenlignbare (n av 10)". */
export type BelowFloorFactorView = {
  readonly label: string;
  readonly own: string;
  readonly belowFloor: string;
  readonly counts: string;
  readonly direction: string;
};

/** A factor the subject has no value for: the absence's words and, for "Ikke lest i denne versjonen", its explanation. */
export type AbsentFactorView = {
  readonly label: string;
  readonly own: string;
  readonly detail: string | null;
};

export type FactorView = ComparedFactorView | BelowFloorFactorView | AbsentFactorView;

export type FactorPairView = {
  readonly heading: string;
  readonly factors: readonly [FactorView, FactorView];
};

export type DecompositionView = {
  /** "Margin eller kapitalbruk?", under Totalkapitalrentabilitet. */
  readonly margin: FactorPairView;
  /** "Lønnsnivå eller produktivitet?", under Lønnskostnadsandel. */
  readonly pay: FactorPairView;
};

type Factor = {
  readonly label: MessageId;
  readonly comparison: Comparison;
  readonly direction: Direction;
  readonly format: (value: string) => string;
  /** The unit `middleHalfText` writes the midtre halvdel in. */
  readonly unit: 'percent' | 'turnover';
  /** The words for a zero or negative denominator. */
  readonly denominator: MessageId;
};

function factorView(factor: Factor, filingYear: number): FactorView {
  const c = factor.comparison;
  const label = t(factor.label);
  if (c.kind === 'subject_absent') {
    const context = { denominator: factor.denominator, filingYear };
    return { label, own: absenceText(c.absence, context), detail: absenceDetail(c.absence, context) };
  }
  const own = factor.format(c.subject.toString());
  const counts = t('keyFigures.counts', { n: String(c.count), k: String(c.leftOut) });
  const direction = t(DIRECTION_WORDS[factor.direction]);
  if (c.kind === 'below_floor') {
    return {
      label,
      own,
      belowFloor: t('keyFigures.belowFloor', { n: String(c.count), min: String(MIN_PEERS) }),
      counts,
      direction,
    };
  }
  // Each factor is read against its own median: the strip draws no beste
  // fjerdedel, which for driftsmargin stays in its row (decision 3).
  const strip: StripMarks = { ...stripMarks(c, factor.direction), best: null };
  const middleHalf = middleHalfText(c.lowerQuartile.toString(), c.upperQuartile.toString(), true, factor.unit);
  return { label, own, median: factor.format(c.median.toString()), counts, strip, middleHalf, direction };
}

/**
 * A pay factor (7 or 8). v1 reads no `aarsverk`, so the engine gives both
 * `not_read_in_v1` on every basis (document-absence.ts); anything else would
 * need a median and a strip in kroner per årsverk, which v1 never shows.
 */
function payFactorView(label: MessageId, comparison: Comparison, filingYear: number): AbsentFactorView {
  if (comparison.kind !== 'subject_absent' || comparison.absence.reason !== 'not_read_in_v1') {
    throw new Error('the pay factors are not read in v1');
  }
  // The context's denominator is never read for a figure that is not read.
  const context = { denominator: null, filingYear };
  return {
    label: t(label),
    own: absenceText(comparison.absence, context),
    detail: absenceDetail(comparison.absence, context),
  };
}

/**
 * Both fold-outs' factor pairs. `api` gives the driftsmargin factor (the
 * same comparison as its row), `turnover` total asset turnover, `document`
 * the pay factors; all against the same peers (the group less `ekskl`).
 */
export function decompositionView({
  api,
  turnover,
  document,
  filingYear,
}: {
  readonly api: ApiBenchmark;
  readonly turnover: TurnoverBenchmark;
  readonly document: DocumentBenchmark;
  readonly filingYear: number;
}): DecompositionView {
  return {
    margin: {
      heading: t('keyFigures.foldout.margin'),
      factors: [
        factorView(
          {
            label: 'fig.driftsmargin',
            comparison: api.driftsmargin.comparison,
            direction: api.driftsmargin.direction,
            format: formatPercent,
            unit: 'percent',
            denominator: 'analysis.figures.reason.revenueNotPositive',
          },
          filingYear,
        ),
        factorView(
          {
            label: 'fig.tkOml',
            comparison: turnover.comparison,
            direction: TOTAL_ASSET_TURNOVER_DIRECTION,
            format: formatTurnover,
            unit: 'turnover',
            denominator: 'analysis.figures.reason.assetsNotPositive',
          },
          filingYear,
        ),
      ],
    },
    pay: {
      heading: t('keyFigures.foldout.pay'),
      factors: [
        payFactorView('fig.lonnArsverk', document.lonnArsverk.comparison, filingYear),
        payFactorView('fig.omsArsverk', document.omsArsverk.comparison, filingYear),
      ],
    },
  };
}
