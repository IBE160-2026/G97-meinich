// The three API key figures (`docs/key-figures.md`, figures 1, 12 and 13).
// Inputs are øre as filed; a missing input is derived one level from stated
// values only, and an underivable or non-positive input makes the figure
// undefined with a named cause, never zero.
import { type Fraction, fraction, toDecimal } from './fraction.ts';
import type { ApiInputs, ApiKeyFigures, Direction, FigureInput, FigureResult, Source } from './types.ts';

/**
 * A derived amount within ±5 kr (500 øre) of zero cannot be told apart from
 * zero: it inherits the rounding of the whole-krone totals it is computed
 * from. A derived denominator of 5 kr or less (500 øre or less, so +5 kr
 * itself and any negative amount) counts as not positive. Applies to derived
 * denominators only; a stated one is used as it is.
 */
export const DERIVED_ZERO_BOUND_ORE = 500n;

export const API_FIGURE_DIRECTIONS = {
  driftsmargin: 'higher_is_better',
  totalkapitalrentabilitet: 'higher_is_better',
  egenkapitalandel: 'none',
} as const satisfies Record<keyof ApiKeyFigures, Direction>;

/** An input in øre and whether it was derived rather than stated. */
type Input = { readonly ore: bigint; readonly derived: boolean } | null;

function stated(ore: bigint | null): Input {
  return ore === null ? null : { ore, derived: false };
}

/** `a op b` from two stated values; null when either is missing. */
function derive(a: bigint | null, b: bigint | null, op: (x: bigint, y: bigint) => bigint): Input {
  return a === null || b === null ? null : { ore: op(a, b), derived: true };
}

/** A stated total taken as the derived value of another field (sumEiendeler = sumEgenkapitalGjeld). */
function derivedAs(ore: bigint | null): Input {
  return ore === null ? null : { ore, derived: true };
}

/**
 * The four inputs, each stated or else derived from stated values only. A
 * derived value never feeds another derivation.
 */
export function resolveApiInputs(inputs: ApiInputs): {
  readonly sumDriftsinntekter: Input;
  readonly driftsresultat: Input;
  readonly sumEiendeler: Input;
  readonly sumEgenkapital: Input;
} {
  const i = inputs;
  return {
    sumDriftsinntekter:
      stated(i.sumDriftsinntekter) ?? derive(i.driftsresultat, i.sumDriftskostnad, (x, y) => x + y),
    driftsresultat:
      stated(i.driftsresultat) ?? derive(i.sumDriftsinntekter, i.sumDriftskostnad, (x, y) => x - y),
    sumEiendeler: stated(i.sumEiendeler) ?? derivedAs(i.sumEgenkapitalGjeld),
    sumEgenkapital: stated(i.sumEgenkapital) ?? derive(i.sumEgenkapitalGjeld, i.sumGjeld, (x, y) => x - y),
  };
}

/** An API input by name, for a figure's `inputs`. */
type Named = { readonly field: FigureInput['field']; readonly input: Input };

/**
 * A figure as an exact fraction, with what it was computed from, or the
 * reason it is undefined. `computeApiKeyFigures` divides it once; the
 * decompositions multiply these fractions (`docs/key-figures.md`,
 * "Decompositions").
 */
export type ExactFigure =
  | {
      readonly kind: 'value';
      readonly fraction: Fraction;
      readonly denominatorDerived: boolean;
      readonly inputs: readonly FigureInput[];
    }
  | Extract<FigureResult, { readonly kind: 'absent' }>;

/** numerator / denominator, with a missing component checked before the denominator's sign. */
function ratio(numerator: Named, denominator: Named): ExactFigure {
  if (numerator.input === null || denominator.input === null) {
    return { kind: 'absent', absence: { reason: 'undefined', cause: 'component_missing' } };
  }
  const notPositive = denominator.input.derived
    ? denominator.input.ore <= DERIVED_ZERO_BOUND_ORE
    : denominator.input.ore <= 0n;
  if (notPositive) {
    return { kind: 'absent', absence: { reason: 'undefined', cause: 'denominator_not_positive' } };
  }
  return {
    kind: 'value',
    fraction: fraction(numerator.input.ore, denominator.input.ore),
    denominatorDerived: denominator.input.derived,
    inputs: [
      { field: numerator.field, column: 'api', derived: numerator.input.derived },
      { field: denominator.field, column: 'api', derived: denominator.input.derived },
    ],
  };
}

/** An exact figure as the engine returns it: one division, from `source`. */
export function toFigureResult(exact: ExactFigure, source: Source): FigureResult {
  if (exact.kind === 'absent') return exact;
  return {
    kind: 'value',
    value: toDecimal(exact.fraction),
    source,
    denominatorDerived: exact.denominatorDerived,
    inputs: exact.inputs,
  };
}

/**
 * The three API figures and total asset turnover (`sumDriftsinntekter /
 * sumEiendeler`, the decomposition's second factor: not a numbered key
 * figure, no direction, no kroner) as exact fractions.
 */
export function apiKeyFigureFractions(inputs: ApiInputs): Readonly<Record<keyof ApiKeyFigures | 'totalAssetTurnover', ExactFigure>> {
  const r = resolveApiInputs(inputs);
  const driftsresultat: Named = { field: 'driftsresultat', input: r.driftsresultat };
  const sumDriftsinntekter: Named = { field: 'sumDriftsinntekter', input: r.sumDriftsinntekter };
  const sumEiendeler: Named = { field: 'sumEiendeler', input: r.sumEiendeler };
  const sumEgenkapital: Named = { field: 'sumEgenkapital', input: r.sumEgenkapital };
  return {
    driftsmargin: ratio(driftsresultat, sumDriftsinntekter),
    totalkapitalrentabilitet: ratio(driftsresultat, sumEiendeler),
    egenkapitalandel: ratio(sumEgenkapital, sumEiendeler),
    totalAssetTurnover: ratio(sumDriftsinntekter, sumEiendeler),
  };
}

/**
 * Driftsmargin = driftsresultat / sumDriftsinntekter, totalkapitalrentabilitet
 * = driftsresultat / sumEiendeler, egenkapitalandel = sumEgenkapital /
 * sumEiendeler, each a fraction with source `api`, a Decimal to 40 significant
 * digits from one division of the exact fraction, rounded only at display.
 */
export function computeApiKeyFigures(inputs: ApiInputs): ApiKeyFigures {
  const exact = apiKeyFigureFractions(inputs);
  return {
    driftsmargin: toFigureResult(exact.driftsmargin, 'api'),
    totalkapitalrentabilitet: toFigureResult(exact.totalkapitalrentabilitet, 'api'),
    egenkapitalandel: toFigureResult(exact.egenkapitalandel, 'api'),
  };
}
