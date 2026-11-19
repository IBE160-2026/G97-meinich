// Oversikt's three small cards (Story 3.4; FR-27, FR-29, FR-30;
// EXPERIENCE.md "Small card", "Small cards, nothing to show"; DESIGN.md
// "Small card"): "Største kapitalgap", "Største styrke" and "Mangler
// grunnlag", each chosen by a pure function from the engine's benchmarks and
// worded by the key-figure table's own rows, so a card and the table say the
// same thing about a figure.
//
// - Største kapitalgap: the engine's `largestCapitalGap` chooses (decision
//   1); this module only words it. The amount is rounded once, by
//   `capitalAmountText`. No amount: the subject's document basis's words
//   when it is not read, then "Beløpet er ikke i kroner", then the
//   all-strengths sentence, then K2.
// - Største styrke: the figure at or beyond beste fjerdedel with the highest
//   Plassering, ranked on the whole percent the table shows (`wholePercent`),
//   ties to the lower figure number (decision 2). No kroner.
// - Mangler grunnlag: the first row, in the table's order, whose comparison
//   is absent or below the floor, and how many more there are (decision 3).
//
// Pure, and a payload boundary (AD-4): strings out, never a Decimal, an
// amount in øre or a document basis.
import {
  atOrBeyondBest,
  largestCapitalGap,
  type ApiBenchmark,
  type CapitalChoice,
  type DocumentBenchmark,
} from '../engine/benchmark.ts';
import type { DocumentBasis } from '../engine/document-inputs.ts';
import { wholePercent } from '../engine/format.ts';
import type { Decimal } from '../engine/decimal.ts';
import { t, type MessageId } from '../messages/index.ts';
import { capitalAmountText } from './kroner-amount.ts';
import { KEY_FIGURE_ROWS, keyFigureRows, rowBenchmark, type FigureKey, type KeyFigureRow } from './key-figure-rows.ts';

/** A small card: shown with a figure, or one slate sentence in place of the value. */
export type SmallCardView =
  | {
      readonly kind: 'shown';
      /** The key figure's name (or, for working capital, C2). */
      readonly name: string;
      /** The value line: the capital amount (C1), the Plassering, or the own value or its absence. */
      readonly value: string;
      /**
       * The top note "Viser gap ved full tilnærming · Endre i Verdi" as the
       * first line under the value: the capital card's amount is at full
       * convergence (Story 3.5).
       */
      readonly topNote: boolean;
      /** Slate lines under the value (and the top note). */
      readonly lines: readonly string[];
    }
  | { readonly kind: 'empty'; readonly text: string; readonly detail: string | null };

export type MissingBasisView = SmallCardView & {
  /** "og {n} til", linking to the table; null when only one figure lacks a basis. */
  readonly more: string | null;
};

export type OversiktCardsView = {
  readonly capital: SmallCardView;
  readonly strength: SmallCardView;
  readonly missing: MissingBasisView;
};

const CAPITAL_LABEL: Readonly<Record<CapitalChoice, MessageId>> = {
  working_capital: 'oversikt.capital.workingCapital',
  kfd: 'fig.kfd',
  lgd: 'fig.lgd',
  oml: 'fig.oml',
};

/**
 * "Største kapitalgap" (decision 1). `basis` is the subject's document
 * basis: when it is not read, every capital figure is absent for that one
 * reason, and the card gives its words, as the rows do.
 */
export function capitalCard(document: DocumentBenchmark, basis: DocumentBasis['kind'], rows: readonly KeyFigureRow[]): SmallCardView {
  if (basis !== 'read') {
    const kfd = rows.find((row) => row.key === 'kfd');
    if (kfd === undefined) throw new Error('the key-figure rows have no kfd');
    return { kind: 'empty', text: kfd.own.text, detail: kfd.own.detail };
  }
  const choice = largestCapitalGap(document.kfd.gap, document.lgd.gap, document.oml.gap);
  if (choice.kind === 'amount') {
    return {
      kind: 'shown',
      name: t(CAPITAL_LABEL[choice.figure]),
      value: t('oversikt.capital.amount', { belop: capitalAmountText(choice) }),
      topNote: true,
      lines: [t('oversikt.capital.notPerYear')],
    };
  }
  switch (choice.reason) {
    case 'not_nok':
      return { kind: 'empty', text: t('keyFigures.notInKroner'), detail: null };
    case 'all_strengths':
      return { kind: 'empty', text: t('oversikt.capital.none'), detail: null };
    case 'no_gap':
      return { kind: 'empty', text: t('oversikt.capital.noGap'), detail: null };
  }
}

/**
 * The figures that never qualify as Største styrke (decision 2): the check
 * row (6), personnel cost per FTE (8), equity ratio (13), revenue growth
 * (14) and cash share. Each has no direction in the engine as well; the set
 * keeps the rule even if a direction were added.
 */
export const NEVER_STRENGTH: ReadonlySet<FigureKey> = new Set<FigureKey>([
  'total',
  'lonnArsverk',
  'egenkapitalandel',
  'vekst',
  'kontant',
]);

/** "Største styrke" (decision 2): ranked on the shown whole percent, ties to the lower figure number. */
export function strengthCard(api: ApiBenchmark, document: DocumentBenchmark, rows: readonly KeyFigureRow[]): SmallCardView {
  let chosen: { readonly row: KeyFigureRow; readonly rank: Decimal } | null = null;
  // KEY_FIGURE_ROWS is in figure-number order for every figure that can qualify (kontant, unnumbered, never does).
  for (const key of Object.keys(KEY_FIGURE_ROWS) as FigureKey[]) {
    if (NEVER_STRENGTH.has(key)) continue;
    const { direction, comparison } = rowBenchmark(key, api, document);
    if (direction === 'none' || comparison.kind !== 'compared' || comparison.best === null) continue;
    if (!atOrBeyondBest(comparison, direction)) continue;
    const rank = wholePercent(comparison.best.percentile.toString());
    // Strictly greater: an equal whole percent later in the order (a higher number) never replaces the earlier.
    if (chosen === null || rank.gt(chosen.rank)) {
      const row = rows.find((candidate) => candidate.key === key);
      if (row === undefined) throw new Error(`the key-figure rows have no ${key}`);
      chosen = { row, rank };
    }
  }
  if (chosen === null) return { kind: 'empty', text: t('oversikt.strength.none'), detail: null };
  const { row } = chosen;
  if (row.comparison.kind !== 'compared') throw new Error('a strength is compared');
  return {
    kind: 'shown',
    name: row.label,
    value: row.comparison.placement.text,
    topNote: false,
    lines: [t('hero.vs', { own: row.own.text, best: row.comparison.best.text })],
  };
}

/** "Mangler grunnlag" (decision 3): the first row without a comparison, in the table's order. */
export function missingBasisCard(rows: readonly KeyFigureRow[]): MissingBasisView {
  const missing = rows.filter((row) => row.comparison.kind === 'subject_absent' || row.comparison.kind === 'below_floor');
  const first = missing[0];
  if (first === undefined) return { kind: 'empty', text: t('oversikt.missing.none'), detail: null, more: null };
  const reason =
    first.comparison.kind === 'below_floor' ? first.comparison.text : first.own.detail;
  return {
    kind: 'shown',
    name: first.label,
    value: first.own.text,
    topNote: false,
    lines: reason === null ? [] : [reason],
    more: missing.length > 1 ? t('oversikt.missing.more', { n: String(missing.length - 1) }) : null,
  };
}

/** The three cards for one analysis: the engine's benchmarks over the shown group, and the subject's document basis. */
export function oversiktCards({
  api,
  document,
  basis,
  filingYear,
}: {
  readonly api: ApiBenchmark;
  readonly document: DocumentBenchmark;
  readonly basis: DocumentBasis['kind'];
  readonly filingYear: number;
}): OversiktCardsView {
  const rows = keyFigureRows(api, document, filingYear);
  return {
    capital: capitalCard(document, basis, rows),
    strength: strengthCard(api, document, rows),
    missing: missingBasisCard(rows),
  };
}
