// The twelve document key figures computed (Story 3.1a; FR-21, FR-23;
// `docs/key-figures.md`). Pure: a company's document basis
// (`documentBasis` in `document-inputs.ts`) in, each figure's value or its
// absence out. Every input comes from one current column of one document;
// revenue growth (14) also reads the same document's prior-year column.
//
// The order, for each figure:
// 1. `documentFigureAbsence` (Story 2.9): the basis, the notes (7 and 8), R3,
//    an underivable revenue, and growth's prior column. When it names a
//    reason, that is the figure's.
// 2. A missing component: a balance line, `salgsinntekt` or `driftsresultat`
//    that the column leaves empty (there is no total to derive it from), or
//    a cost line `documentCostLines` cannot derive (decision 1) →
//    `component_missing`. Checked before the denominator's sign.
// 3. The denominator: zero or negative, or derived and 5 kr or less →
//    `denominator_not_positive`. A denominator is derived when any amount in
//    it is (a derived revenue, a derived cost line).
// 4. Otherwise the formula, as an exact fraction divided once.
//
// Nothing here rounds, and nothing here is a kroner amount (`benchmark.ts`).
import { type DocumentKeyFigure, DOCUMENT_KEY_FIGURE_KEYS, documentFigureAbsence } from './document-absence.ts';
import {
  type DocumentAmount,
  type DocumentBasis,
  type DocumentField,
  type DocumentFigures,
  documentCostLines,
  documentRevenue,
} from './document-inputs.ts';
import { fraction } from './fraction.ts';
import { DERIVED_ZERO_BOUND_ORE, type ExactFigure, toFigureResult } from './key-figures.ts';
import type { Direction, FigureAbsence, FigureInput, FigureResult } from './types.ts';

/**
 * Each document figure's direction (`docs/key-figures.md`, "Key figures"):
 * ↑ higher is better, ↓ lower is better, or none. A figure with no direction
 * has no beste fjerdedel, no Plassering and no kroner.
 */
export const DOCUMENT_FIGURE_DIRECTIONS = {
  ebitda: 'higher_is_better',
  vare: 'lower_is_better',
  lonn: 'lower_is_better',
  andre: 'lower_is_better',
  total: 'none',
  omsArsverk: 'higher_is_better',
  lonnArsverk: 'none',
  kfd: 'lower_is_better',
  lgd: 'higher_is_better',
  oml: 'higher_is_better',
  vekst: 'none',
  kontant: 'none',
} as const satisfies Record<DocumentKeyFigure, Direction>;

/**
 * Whether a figure may be ranked: given a Plassering, sorted by it, or named
 * Største styrke. Only a figure with a direction. Total cost share (6) is a
 * check row, and kontantandel a diagnostic that is never ranked or sorted.
 */
export const DOCUMENT_FIGURE_RANKABLE: Readonly<Record<DocumentKeyFigure, boolean>> = Object.fromEntries(
  DOCUMENT_KEY_FIGURE_KEYS.map((figure) => [figure, DOCUMENT_FIGURE_DIRECTIONS[figure] !== 'none']),
) as Record<DocumentKeyFigure, boolean>;

/** Days in a year, for receivable and payable days (9, 10). */
export const DAYS_PER_YEAR = 365n;

/**
 * A document figure as an exact fraction, with the two amounts in øre it is
 * the quotient of (before × 365 for 9 and 10): the kroner of 9, 10 and 11
 * read them (`capitalGap` in `benchmark.ts`).
 */
export type DocumentExactFigure =
  | (Extract<ExactFigure, { readonly kind: 'value' }> & {
      readonly numeratorOre: bigint;
      readonly denominatorOre: bigint;
    })
  | Extract<ExactFigure, { readonly kind: 'absent' }>;

/** One amount of a formula: what it is, where it was read, and the amount or why it is missing. */
type Operand = {
  readonly field: DocumentField;
  readonly column: 'current' | 'prior';
  readonly amount: DocumentAmount;
  /** +1 added, −1 subtracted. */
  readonly sign: 1n | -1n;
};

/** A sum of operands: its amount, whether any part was derived, and every part as an input. */
type Term =
  | { readonly kind: 'value'; readonly ore: bigint; readonly derived: boolean; readonly inputs: readonly FigureInput[] }
  | { readonly kind: 'absent'; readonly absence: FigureAbsence };

type UndefinedAbsence = Extract<FigureAbsence, { readonly reason: 'undefined' }>;
const COMPONENT_MISSING: UndefinedAbsence = { reason: 'undefined', cause: 'component_missing' };
const NOT_POSITIVE: UndefinedAbsence = { reason: 'undefined', cause: 'denominator_not_positive' };

function term(operands: readonly Operand[]): Term {
  let ore = 0n;
  let derived = false;
  const inputs: FigureInput[] = [];
  for (const operand of operands) {
    if (operand.amount.kind === 'absent') return { kind: 'absent', absence: operand.amount.absence };
    ore += operand.sign * operand.amount.ore;
    derived ||= operand.amount.derived;
    inputs.push({ field: operand.field, column: operand.column, derived: operand.amount.derived });
  }
  return { kind: 'value', ore, derived, inputs };
}

/**
 * (numerator × scale) / denominator. A missing component on either side is
 * checked before the denominator's sign; a derived denominator of 5 kr or
 * less counts as not positive.
 */
function quotient(numerator: Term, denominator: Term, scale: bigint = 1n): DocumentExactFigure {
  if (numerator.kind === 'absent') return numerator;
  if (denominator.kind === 'absent') return denominator;
  const notPositive = denominator.derived ? denominator.ore <= DERIVED_ZERO_BOUND_ORE : denominator.ore <= 0n;
  if (notPositive) return { kind: 'absent', absence: NOT_POSITIVE };
  return {
    kind: 'value',
    fraction: fraction(numerator.ore * scale, denominator.ore),
    denominatorDerived: denominator.derived,
    inputs: [...numerator.inputs, ...denominator.inputs],
    numeratorOre: numerator.ore,
    denominatorOre: denominator.ore,
  };
}

/**
 * A line with no total to derive it from (a balance line, `salgsinntekt`,
 * `driftsresultat`): as stated, or missing when the column leaves it empty.
 * Never 0.
 */
function statedLine(figures: DocumentFigures, field: DocumentField): DocumentAmount {
  const figure = figures[field];
  if (figure.kind === 'absent') {
    // R3: `documentFigureAbsence` has already made the figure
    // `line_not_read_safely`; should a caller skip it, the line is missing.
    if (figure.absence.reason === 'exceeds_api_subtotal') return { kind: 'absent', absence: COMPONENT_MISSING };
    return { kind: 'absent', absence: figure.absence };
  }
  if (figure.ore === null) return { kind: 'absent', absence: COMPONENT_MISSING };
  return { kind: 'value', ore: figure.ore, derived: false };
}

const add = (field: DocumentField, amount: DocumentAmount, column: 'current' | 'prior' = 'current'): Operand => ({
  field,
  column,
  amount,
  sign: 1n,
});
const less = (field: DocumentField, amount: DocumentAmount): Operand => ({ field, column: 'current', amount, sign: -1n });

/** The formula of each figure over a read basis, once `documentFigureAbsence` has found no reason. */
function formula(
  figure: DocumentKeyFigure,
  current: DocumentFigures,
  prior: DocumentFigures | null,
): DocumentExactFigure {
  const costs = documentCostLines(current);
  const revenue = term([add('sumDriftsinntekter', documentRevenue(current))]);
  const line = (field: DocumentField) => add(field, statedLine(current, field));
  switch (figure) {
    case 'ebitda':
      return quotient(
        term([
          line('driftsresultat'),
          add('avskrivninger', costs.avskrivninger),
          add('nedskrivninger', costs.nedskrivninger),
        ]),
        revenue,
      );
    case 'vare':
      return quotient(term([add('varekostnad', costs.varekostnad)]), revenue);
    case 'lonn':
      return quotient(term([add('lonnskostnad', costs.lonnskostnad)]), revenue);
    case 'andre':
      return quotient(term([add('annenDriftskostnad', costs.annenDriftskostnad)]), revenue);
    case 'total':
      return quotient(
        term([
          add('varekostnad', costs.varekostnad),
          add('lonnskostnad', costs.lonnskostnad),
          add('annenDriftskostnad', costs.annenDriftskostnad),
        ]),
        revenue,
      );
    case 'kfd':
      return quotient(term([line('kundefordringer')]), term([line('salgsinntekt')]), DAYS_PER_YEAR);
    case 'lgd':
      return quotient(
        term([line('leverandorgjeld')]),
        term([add('varekostnad', costs.varekostnad), add('annenDriftskostnad', costs.annenDriftskostnad)]),
        DAYS_PER_YEAR,
      );
    case 'oml':
      return quotient(revenue, term([line('sumEiendeler'), less('bankinnskudd', statedLine(current, 'bankinnskudd'))]));
    case 'vekst': {
      // documentFigureAbsence has ruled out a missing prior column.
      if (prior === null) return { kind: 'absent', absence: COMPONENT_MISSING };
      const before = documentRevenue(prior);
      // (current − prior) / prior = current / prior − 1, as one fraction.
      const growth = quotient(
        term([add('sumDriftsinntekter', documentRevenue(current)), { ...add('sumDriftsinntekter', before, 'prior'), sign: -1n }]),
        term([add('sumDriftsinntekter', before, 'prior')]),
      );
      if (growth.kind === 'absent') return growth;
      // The inputs are the two revenues, each once.
      return { ...growth, inputs: growth.inputs.slice(0, 2) };
    }
    case 'kontant':
      return quotient(term([line('bankinnskudd')]), term([line('sumEiendeler')]));
    case 'omsArsverk':
    case 'lonnArsverk':
      // `aarsverk` is in the notes, which v1 does not read; documentFigureAbsence
      // returns not_read_in_v1 for both before this is reached.
      return { kind: 'absent', absence: { reason: 'not_read_in_v1', scope: 'notes' } };
  }
}

/** Every document figure of a company as an exact fraction, or its absence with exactly one reason. */
export function documentKeyFigureFractions(basis: DocumentBasis): Readonly<Record<DocumentKeyFigure, DocumentExactFigure>> {
  const out = {} as Record<DocumentKeyFigure, DocumentExactFigure>;
  for (const figure of DOCUMENT_KEY_FIGURE_KEYS) {
    const absence = documentFigureAbsence(basis, figure);
    if (absence !== null) out[figure] = { kind: 'absent', absence };
    else if (basis.kind !== 'read') throw new Error('documentFigureAbsence passes only a read basis');
    else out[figure] = formula(figure, basis.current, basis.prior);
  }
  return out;
}

/** Every document figure of a company, with source `document`: a value from one division, or its absence. */
export function computeDocumentKeyFigures(basis: DocumentBasis): Readonly<Record<DocumentKeyFigure, FigureResult>> {
  const exact = documentKeyFigureFractions(basis);
  return Object.fromEntries(
    DOCUMENT_KEY_FIGURE_KEYS.map((figure) => [figure, toFigureResult(exact[figure], 'document')]),
  ) as Record<DocumentKeyFigure, FigureResult>;
}

/**
 * Key figures 7 and 8 per årsverk (`docs/key-figures.md`, "Productivity"):
 * an amount in øre over `aarsverk`, given in tenths (it is printed with one
 * decimal), as an exact fraction in øre per årsverk. v1 does not read
 * `aarsverk`, so no figure of a company reaches this; it exists so the
 * decomposition personnel share = cost per årsverk ÷ revenue per årsverk is
 * asserted on test inputs. A missing amount or årsverk is
 * `component_missing`; zero or negative årsverk is not positive.
 */
export function perAarsverk(
  amount: { readonly field: 'sumDriftsinntekter' | 'lonnskostnad'; readonly amount: DocumentAmount },
  aarsverkTenths: bigint | null,
): DocumentExactFigure {
  const aarsverk: Term =
    aarsverkTenths === null
      ? { kind: 'absent', absence: COMPONENT_MISSING }
      : { kind: 'value', ore: aarsverkTenths, derived: false, inputs: [{ field: 'aarsverk', column: 'current', derived: false }] };
  // ore × 10 / tenths = ore / (tenths / 10).
  return quotient(term([add(amount.field, amount.amount)]), aarsverk, 10n);
}
