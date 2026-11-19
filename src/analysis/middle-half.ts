// A comparison's midtre halvdel in words, shared by the key-figure table's
// rows (key-figure-rows.ts) and the decomposition fold-outs' factors
// (decomposition-view.ts), so neither of those modules imports the other.
import { formatDaysNumber, formatPercentNumber, formatTurnover } from '../engine/format.ts';
import { t, type MessageId } from '../messages/index.ts';

/** How a figure's value is written. */
export type Unit =
  /** A fraction as percent, one decimal: "2,1 %". */
  | 'percent'
  /** Whole days: "48 dager". */
  | 'days'
  /** A turnover ratio, two decimals: "2,85". */
  | 'turnover'
  /** Øre per årsverk as whole kroner (7 and 8; never a value in v1, which does not read `aarsverk`). */
  | 'kroner';

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
