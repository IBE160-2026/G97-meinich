// The Verdi tab as a view (Story 3.5; FR-30, FR-31, FR-62; EXPERIENCE.md
// "Closable-share control", "Amount card", "Above median", "Below median",
// "Driftsmargin is a strength"; `docs/key-figures.md`, "From gap to
// kroner"). Two halves, both pure:
//
// - `verdiWire` (the server): from the engine's benchmarks over the shown
//   group, everything the tab needs that does not depend on the share. The
//   exact values cross to the browser as `WireDecimal` strings (AD-6,
//   decision 5): the profit uplift at full convergence and at the median
//   step, the exact s_med, and the capital amounts (9), (10), their total
//   and (11) at full convergence, all the subject's own. Every other value
//   is a finished string, the cards' median lines included.
// - `verdiCards` (the server's render and the browser): the wire and a
//   closable share in, every step label, card value, line, median line and
//   the announcement out, as strings. Amounts are scaled through
//   `src/engine/closable.ts` and rounded once (`formatKronerExact`), so the
//   server and the browser write the same bytes for the same wire values
//   (e2e/wire-identity.spec.ts).
//
// The three cards are never summed: no function here adds one card's amount
// to another's (test/analysis/verdi-view.test.ts "no displayed total adds
// two cards").
//
// Story 3.6 (FR-32, FR-55): `verdiCards` also takes the multiple the user
// entered, a `Multiple` from the URL or none, and writes the EV section:
// "Økt selskapsverdi" = round(exact profit uplift at the share × m), by
// `valueAtShare` on the same wire values as the profit card (no new wire
// value), with its product line, "≈" by `productIsApproximate`; the empty
// sentence without a multiple; and the profit card's own words as the
// reason the field is disabled where the profit card has no amount. The
// value is its own amount: nothing here adds it to a card.
import {
  workingCapitalReleased,
  type ApiBenchmark,
  type CapitalGap,
  type DocumentBenchmark,
} from '../engine/benchmark.ts';
import {
  closableSteps,
  medianShare,
  medianStep,
  profitAtMedian,
  productIsApproximate,
  profitAtShare,
  scaleAmount,
  valueAtShare,
  type ClosableShare,
  type MedianStepReason,
  type Multiple,
} from '../engine/closable.ts';
import type { Decimal } from '../engine/decimal.ts';
import type { DocumentBasis } from '../engine/document-inputs.ts';
import { formatKronerExact, formatMultiple, formatWholePercent, formatWholePercentNumber, lowerFirst, wholePercent } from '../engine/format.ts';
import { apiInputsFromRow } from '../engine/inputs.ts';
import { resolveApiInputs } from '../engine/key-figures.ts';
import type { Comparison, Direction } from '../engine/types.ts';
import { fromWire, toWire, type WireDecimal } from '../engine/wire.ts';
import { t, type MessageId } from '../messages/index.ts';
import { keyFigureRows, type KeyFigureRow } from './key-figure-rows.ts';
import type { SubjectKeyFigures } from './view.ts';

/** The median step as it crosses: its exact s_med, or why there is none in words. */
export type StepWire =
  | { readonly kind: 'exists'; readonly sMed: WireDecimal }
  | { readonly kind: 'none'; readonly reason: string };

/** Words in place of an amount, with an optional explanation (an absence's detail). */
type TextWire = { readonly kind: 'text'; readonly text: string; readonly detail: string | null };

export type ProfitWire =
  | {
      readonly kind: 'amount';
      /** (T − r) × sumDriftsinntekter, exact øre. */
      readonly full: WireDecimal;
      /** (M − r) × sumDriftsinntekter, exact øre; null where there is no median step. */
      readonly atMedian: WireDecimal | null;
      readonly median: string | null;
    }
  | (TextWire & { readonly median: string | null });

export type CapitalWire =
  | { readonly kind: 'amount'; readonly full: WireDecimal; readonly median: string | null }
  | (TextWire & { readonly median: string | null });

export type PartWire = {
  readonly label: string;
  readonly value: { readonly kind: 'amount'; readonly full: WireDecimal } | { readonly kind: 'text'; readonly text: string };
  readonly median: string | null;
};

export type WorkingCapitalWire =
  | TextWire
  | {
      readonly kind: 'parts';
      readonly kfd: PartWire;
      readonly lgd: PartWire;
      /** The total (9) + (10) at full convergence, its words, or nothing to show. */
      readonly total: { readonly kind: 'amount'; readonly full: WireDecimal } | { readonly kind: 'text'; readonly text: string } | null;
    };

/** What the Verdi tab receives from the server: strings, booleans and `WireDecimal`s only (AD-4, AD-6). */
export type VerdiWire = {
  readonly step: StepWire;
  readonly profit: ProfitWire;
  readonly workingCapital: WorkingCapitalWire;
  readonly oml: CapitalWire;
};

// ---- The server half --------------------------------------------------------

function rowOf(rows: readonly KeyFigureRow[], key: KeyFigureRow['key']): KeyFigureRow {
  const found = rows.find((row) => row.key === key);
  if (found === undefined) throw new Error(`the key-figure rows have no ${key}`);
  return found;
}

const STEP_REASON: Readonly<Record<Exclude<MedianStepReason, 'own_missing'>, MessageId>> = {
  above_median: 'verdi.median.above',
  at_median: 'verdi.median.at',
  median_is_best: 'verdi.median.isBest',
  below_floor: 'verdi.median.belowFloor',
};

/**
 * One figure's median line (decision 4): where it reaches its own median on
 * its own gap, "Median nås ved x %"; at or beyond it, the profit card's
 * "allerede over" or a capital card's "allerede nådd" (N12: "over" reads
 * wrongly for kundefordringsdager, where low is good). Null without a target.
 */
function medianLine(comparison: Comparison, direction: Direction, card: 'profit' | 'capital'): string | null {
  const share = medianShare(comparison, direction);
  if (share === null) return null;
  if (share.kind === 'reached') return t(card === 'profit' ? 'verdi.cardMedian.above' : 'verdi.cardMedian.reached');
  const percent = share.share.mul(100).toString();
  // N9 and N10 only for a share strictly between 0 and 1 that rounds to an end; at exactly 1
  // (the figure's median equals its beste fjerdedel) the median is reached at 100 %.
  if (share.share.lt(1)) {
    const whole = wholePercent(percent);
    if (whole.eq(0)) return t('verdi.cardMedian.under');
    if (whole.eq(100)) return t('verdi.cardMedian.over');
  }
  return t('verdi.cardMedian.share', { x: formatWholePercentNumber(percent) });
}

/** "Ikke beregnet – for få sammenlignbare på {figur}", the figure's name mid-sentence. */
function noTarget(row: KeyFigureRow): string {
  return t('verdi.noTarget', { figur: lowerFirst(row.label) });
}

/** A capital figure's words where it has no amount; null where it has one. */
function capitalWords(gap: CapitalGap, row: KeyFigureRow): TextWire | null {
  switch (gap.kind) {
    case 'amount':
      return null;
    case 'strength':
      return { kind: 'text', text: t('keyFigures.strength'), detail: null };
    case 'not_nok':
      return { kind: 'text', text: t('keyFigures.notInKroner'), detail: null };
    case 'none':
      if (gap.reason === 'target_not_positive') return { kind: 'text', text: t('keyFigures.targetNotPositive'), detail: null };
      if (row.comparison.kind === 'below_floor') return { kind: 'text', text: noTarget(row), detail: null };
      return { kind: 'text', text: row.own.text, detail: row.own.detail };
  }
}

function capitalWire(gap: CapitalGap, comparison: Comparison, direction: Direction, row: KeyFigureRow): CapitalWire {
  // No median line on a strength or on a card without a target.
  const hasTarget = gap.kind === 'amount' || gap.kind === 'not_nok';
  const median = hasTarget ? medianLine(comparison, direction, 'capital') : null;
  if (gap.kind === 'amount') return { kind: 'amount', full: toWire(gap.ore), median };
  const words = capitalWords(gap, row);
  if (words === null) throw new Error('a capital amount has words');
  return { ...words, median };
}

function partWire(gap: CapitalGap, comparison: Comparison, direction: Direction, row: KeyFigureRow): PartWire {
  const median = gap.kind === 'amount' || gap.kind === 'not_nok' ? medianLine(comparison, direction, 'capital') : null;
  if (gap.kind === 'amount') return { label: row.label, value: { kind: 'amount', full: toWire(gap.ore) }, median };
  // A part below the floor names its reason as the row does ("For få sammenlignbare (7 av 10)").
  const text =
    gap.kind === 'none' && row.comparison.kind === 'below_floor'
      ? row.comparison.text
      : (capitalWords(gap, row)?.text ?? row.own.text);
  return { label: row.label, value: { kind: 'text', text }, median };
}

function workingCapitalWire(document: DocumentBenchmark, basis: DocumentBasis['kind'], rows: readonly KeyFigureRow[]): WorkingCapitalWire {
  const kfdRow = rowOf(rows, 'kfd');
  // The subject's document is not read: every capital figure is absent for that one reason, in the rows' words.
  if (basis !== 'read') return { kind: 'text', text: kfdRow.own.text, detail: kfdRow.own.detail };
  const { kfd, lgd } = document;
  const total = workingCapitalReleased(kfd.gap, lgd.gap);
  if (total.kind === 'strength') return { kind: 'text', text: t('keyFigures.strength'), detail: null };
  const notNok = kfd.gap.kind === 'not_nok' || lgd.gap.kind === 'not_nok';
  const oneAmount = (kfd.gap.kind === 'amount') !== (lgd.gap.kind === 'amount');
  return {
    kind: 'parts',
    kfd: partWire(kfd.gap, kfd.comparison, kfd.direction, kfdRow),
    lgd: partWire(lgd.gap, lgd.comparison, lgd.direction, rowOf(rows, 'lgd')),
    total:
      total.kind === 'amount'
        ? { kind: 'amount', full: toWire(total.ore) }
        : notNok
          ? { kind: 'text', text: t('keyFigures.notInKroner') }
          : oneAmount
            ? { kind: 'text', text: t('verdi.workingCapital.noTotal') }
            : null,
  };
}

function profitWire(api: ApiBenchmark, rows: readonly KeyFigureRow[], revenueOre: bigint | null): ProfitWire {
  const { comparison, gap, direction } = api.driftsmargin;
  const row = rowOf(rows, 'driftsmargin');
  if (comparison.kind === 'subject_absent') return { kind: 'text', text: row.own.text, detail: row.own.detail, median: null };
  if (comparison.kind === 'below_floor') return { kind: 'text', text: noTarget(row), detail: null, median: null };
  switch (gap.kind) {
    case 'strength':
      return { kind: 'text', text: t('verdi.profit.strength'), detail: null, median: null };
    case 'not_nok':
      return { kind: 'text', text: t('keyFigures.notInKroner'), detail: null, median: medianLine(comparison, direction, 'profit') };
    case 'none':
      throw new Error('a compared driftsmargin has no kroner gap');
    case 'amount': {
      if (revenueOre === null) throw new RangeError('a driftsmargin amount needs its revenue');
      const atMedian = profitAtMedian(comparison, revenueOre);
      return {
        kind: 'amount',
        full: toWire(gap.ore),
        atMedian: atMedian === null ? null : toWire(atMedian.ore),
        median: medianLine(comparison, direction, 'profit'),
      };
    }
  }
}

function stepWire(api: ApiBenchmark, rows: readonly KeyFigureRow[], selskap: string): StepWire {
  const step = medianStep(api.driftsmargin.comparison);
  if (step.kind === 'exists') return { kind: 'exists', sMed: toWire(step.share) };
  // The subject's own driftsmargin is missing: the same words as its row in the table.
  if (step.reason === 'own_missing') return { kind: 'none', reason: rowOf(rows, 'driftsmargin').own.text };
  return { kind: 'none', reason: t(STEP_REASON[step.reason], { selskap }) };
}

/**
 * Everything Verdi needs that does not depend on the share, for the shown
 * group: the engine's two benchmarks, the subject's document basis (its
 * kind), its benchmark year, its filing's key figures (for the resolved
 * revenue behind its margin) and its name.
 */
export function verdiWire({
  api,
  document,
  basis,
  filingYear,
  keyFigures,
  selskap,
}: {
  readonly api: ApiBenchmark;
  readonly document: DocumentBenchmark;
  readonly basis: DocumentBasis['kind'];
  readonly filingYear: number;
  readonly keyFigures: SubjectKeyFigures;
  readonly selskap: string;
}): VerdiWire {
  const rows = keyFigureRows(api, document, filingYear);
  const revenue = resolveApiInputs(apiInputsFromRow(keyFigures)).sumDriftsinntekter;
  const omlRow = rowOf(rows, 'oml');
  return {
    step: stepWire(api, rows, selskap),
    profit: profitWire(api, rows, revenue === null ? null : revenue.ore),
    workingCapital: workingCapitalWire(document, basis, rows),
    oml:
      basis !== 'read'
        ? { kind: 'text', text: omlRow.own.text, detail: omlRow.own.detail, median: null }
        : capitalWire(document.oml.gap, document.oml.comparison, document.oml.direction, omlRow),
  };
}

// ---- The server's render and the browser ------------------------------------

export type StepView = {
  readonly share: ClosableShare;
  readonly label: string;
  /** The median step where none exists: `aria-disabled`, still focusable, described by `line`. */
  readonly disabled: boolean;
};

/** A card's value: an amount (the `amount` type style) or words in its place. */
export type CardValue = { readonly kind: 'amount' | 'text'; readonly text: string };

export type CardView = {
  readonly value: CardValue | null;
  /** An absence's explanation, under the words. */
  readonly detail: string | null;
  /** N6 or N7: the share the amount is at. */
  readonly share: string | null;
  readonly median: string | null;
};

export type WorkingCapitalView = CardView & {
  /** One line per part, N8 "{figur}: {verdi}", each with its own median line. */
  readonly parts: readonly { readonly text: string; readonly median: string | null }[];
};

/**
 * The EV section (Story 3.6, decisions 3, 6 and 7). `field` is the multiple
 * field's text on load, `formatMultiple` of the URL's multiple or "", the
 * same on the server and in the browser; `error` the words an invalid entry
 * shows; `cleared` what clearing the field announces (the empty sentence).
 */
export type EvView = {
  readonly field: string;
  readonly error: string;
  readonly cleared: string;
} & (
  | {
      /** The profit card has no amount: the field is aria-disabled, described by the profit card's own words. */
      readonly kind: 'disabled';
      readonly reason: string;
    }
  | {
      /** No multiple: the empty sentence, no value. */
      readonly kind: 'empty';
      readonly text: string;
    }
  | {
      readonly kind: 'value';
      /** "Økt selskapsverdi", rounded once from the exact value. */
      readonly value: string;
      /** E1 "{a} × {m} = {v}" or E2 "{a} × {m} ≈ {v}". */
      readonly product: string;
      /** E3, under the product line. */
      readonly explanation: string;
      /** "Økt selskapsverdi: {v}.", once, when the multiple is entered. */
      readonly announcement: string;
    }
);

export type VerdiCardsView = {
  readonly steps: readonly StepView[];
  /** Under the control: "Median nås ved n % av gapet. …", or the reason there is no median step. */
  readonly line: string;
  /** "Medianen gjelder driftsmargin." when `line` does not already say it (a missing own value). */
  readonly applies: string | null;
  readonly profit: CardView;
  readonly workingCapital: WorkingCapitalView;
  readonly oml: CardView;
  readonly ev: EvView;
  /** The one announcement after a share change. */
  readonly announcement: string;
};

/** s_med as the whole percent its texts write: "12", or the words at the ends. */
function medianPercentNumber(sMed: Decimal): string {
  const percent = sMed.mul(100).toString();
  const whole = wholePercent(percent);
  if (whole.eq(0)) return t('verdi.share.under');
  if (whole.eq(100)) return t('verdi.share.over');
  return formatWholePercentNumber(percent);
}

/** The median step's label: "Til medianen for driftsmargin (n %)", N1 or N2 at the ends. */
export function medianStepLabel(sMed: Decimal): string {
  const whole = wholePercent(sMed.mul(100).toString());
  if (whole.eq(0)) return t('verdi.step.medianUnder');
  if (whole.eq(100)) return t('verdi.step.medianOver');
  return t('verdi.step.median', { n: formatWholePercentNumber(sMed.mul(100).toString()) });
}

/** The share as its texts write it: "25 %", or the median step's whole percent. */
function shareText(share: ClosableShare, sMed: Decimal | null): string {
  if (share !== 'median') return t('verdi.share.percent', { n: String(share) });
  if (sMed === null) throw new RangeError('the median step needs s_med');
  return t('verdi.share.percent', { n: medianPercentNumber(sMed) });
}

function kroner(ore: Decimal): string {
  return formatKronerExact(ore.toString());
}

function textCard(wire: TextWire & { readonly median?: string | null }): CardView {
  return { value: { kind: 'text', text: wire.text }, detail: wire.detail, share: null, median: wire.median ?? null };
}

/**
 * The EV section at `share` with `multiple` (Story 3.6): disabled with the
 * profit card's own words where it has no amount (a strength, below the
 * floor, not in NOK, the subject's own driftsmargin missing), the empty
 * sentence without a multiple, otherwise the value, rounded once from
 * `valueAtShare`, and its product line from the profit card's displayed
 * amount {a}.
 */
function evView(profit: ProfitWire, share: ClosableShare, multiple: Multiple | null): EvView {
  const common = {
    field: multiple === null ? '' : formatMultiple(multiple.toString()),
    error: t('verdi.ev.error'),
    cleared: t('verdi.ev.empty'),
  };
  if (profit.kind === 'text') return { ...common, kind: 'disabled', reason: profit.text };
  if (multiple === null) return { ...common, kind: 'empty', text: t('verdi.ev.empty') };
  const full = fromWire(profit.full);
  const atMedian = profit.atMedian === null ? null : fromWire(profit.atMedian);
  const uplift = profitAtShare(full, atMedian, share).ore;
  const value = valueAtShare(full, atMedian, share, multiple).ore;
  const v = kroner(value);
  const product = { a: kroner(uplift), m: common.field, v };
  return {
    ...common,
    kind: 'value',
    value: v,
    product: productIsApproximate(uplift, value, multiple) ? t('verdi.ev.productApprox', product) : t('verdi.ev.product', product),
    explanation: t('verdi.ev.explanation'),
    announcement: t('verdi.ev.announce', { v }),
  };
}

/**
 * Every string of the Verdi tab at `share`, from the wire, with the
 * multiple the URL holds (or none). `share` is 'median' only where the
 * median step exists: the URL module refuses it elsewhere, and the control
 * never offers it.
 */
export function verdiCards(wire: VerdiWire, share: ClosableShare, multiple: Multiple | null): VerdiCardsView {
  const sMed = wire.step.kind === 'exists' ? fromWire(wire.step.sMed) : null;
  if (share === 'median' && sMed === null) throw new RangeError('andel=median where there is no median step');
  const andel = shareText(share, sMed);

  const steps = closableSteps(sMed).map((step): StepView => {
    if (step !== 'median') return { share: step, label: formatWholePercent(String(step)), disabled: false };
    return sMed === null
      ? { share: step, label: t('verdi.step.medianNone'), disabled: true }
      : { share: step, label: medianStepLabel(sMed), disabled: false };
  });
  const line = wire.step.kind === 'exists' ? t('verdi.median.share', { n: medianPercentNumber(fromWire(wire.step.sMed)) }) : wire.step.reason;
  const appliesText = t('verdi.median.applies');

  let profit: CardView;
  let announcement = t('verdi.announce.share', { andel });
  if (wire.profit.kind === 'amount') {
    const full = fromWire(wire.profit.full);
    const atMedian = wire.profit.atMedian === null ? null : fromWire(wire.profit.atMedian);
    const a = kroner(profitAtShare(full, atMedian, share).ore);
    const fullText = kroner(full);
    profit = {
      value: { kind: 'amount', text: t('verdi.profit.value', { a, full: fullText }) },
      detail: null,
      share: t('verdi.profit.share', { andel }),
      median: wire.profit.median,
    };
    announcement = t('verdi.announce.profit', { a, full: fullText });
  } else {
    profit = textCard(wire.profit);
  }

  const capitalValue = (full: WireDecimal): string => {
    const exact = fromWire(full);
    return t('verdi.capital.value', { a: kroner(scaleAmount(exact, share, sMed).ore), full: kroner(exact) });
  };
  const capitalShare = t('verdi.capital.share', { andel });

  const oml: CardView =
    wire.oml.kind === 'amount'
      ? { value: { kind: 'amount', text: capitalValue(wire.oml.full) }, detail: null, share: capitalShare, median: wire.oml.median }
      : textCard(wire.oml);

  let workingCapital: WorkingCapitalView;
  const wc = wire.workingCapital;
  if (wc.kind === 'text') {
    workingCapital = { ...textCard(wc), parts: [] };
  } else {
    const parts = [wc.kfd, wc.lgd].map((part) => ({
      text: t('verdi.part', {
        figur: part.label,
        verdi: part.value.kind === 'amount' ? capitalValue(part.value.full) : part.value.text,
      }),
      median: part.median,
    }));
    const anyAmount = wc.total?.kind === 'amount' || wc.kfd.value.kind === 'amount' || wc.lgd.value.kind === 'amount';
    workingCapital = {
      value:
        wc.total === null
          ? null
          : wc.total.kind === 'amount'
            ? { kind: 'amount', text: capitalValue(wc.total.full) }
            : { kind: 'text', text: wc.total.text },
      detail: null,
      share: anyAmount ? capitalShare : null,
      // Each part carries its own median line.
      median: null,
      parts,
    };
  }

  return {
    steps,
    line,
    applies: line.endsWith(appliesText) ? null : appliesText,
    profit,
    workingCapital,
    oml,
    ev: evView(wire.profit, share, multiple),
    announcement,
  };
}
