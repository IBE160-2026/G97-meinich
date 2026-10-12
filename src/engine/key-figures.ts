// The three API key figures (`docs/key-figures.md`, figures 1, 12 and 13).
// Inputs are øre as filed; a missing input is derived one level from stated
// values only, and an underivable or non-positive input makes the figure
// undefined with a named cause, never zero.
import { Decimal } from './decimal.ts';
import type { ApiInputs, ApiKeyFigures, Direction, FigureResult } from './types.ts';

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

/** numerator / denominator, with a missing component checked before the denominator's sign. */
function ratio(numerator: Input, denominator: Input): FigureResult {
  if (numerator === null || denominator === null) {
    return { kind: 'absent', absence: { reason: 'undefined', cause: 'component_missing' } };
  }
  const notPositive = denominator.derived
    ? denominator.ore <= DERIVED_ZERO_BOUND_ORE
    : denominator.ore <= 0n;
  if (notPositive) {
    return { kind: 'absent', absence: { reason: 'undefined', cause: 'denominator_not_positive' } };
  }
  return {
    kind: 'value',
    value: new Decimal(numerator.ore).div(new Decimal(denominator.ore)),
    source: 'api',
    denominatorDerived: denominator.derived,
  };
}

/**
 * Driftsmargin = driftsresultat / sumDriftsinntekter, totalkapitalrentabilitet
 * = driftsresultat / sumEiendeler, egenkapitalandel = sumEgenkapital /
 * sumEiendeler, each a fraction with source `api`, a Decimal to 40 significant
 * digits, rounded only at display.
 */
export function computeApiKeyFigures(inputs: ApiInputs): ApiKeyFigures {
  const r = resolveApiInputs(inputs);
  return {
    driftsmargin: ratio(r.driftsresultat, r.sumDriftsinntekter),
    totalkapitalrentabilitet: ratio(r.driftsresultat, r.sumEiendeler),
    egenkapitalandel: ratio(r.sumEgenkapital, r.sumEiendeler),
  };
}
