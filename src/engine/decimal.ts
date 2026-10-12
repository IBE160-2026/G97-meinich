// The engine's one decimal constructor (AD-8). Every ratio, statistic and
// intermediate in Peerless is a Decimal made here; no other module imports
// decimal.js or changes its configuration (test/no-other-decimal.test.ts).
//
// precision 40: significant digits kept by division and other inexact
//   operations; far beyond any amount the register can hold (bigint øre has
//   at most 19 digits), so a ratio carries more digits than it can ever show.
// ROUND_HALF_UP: decimal.js's name for half away from zero (−2.5 → −3,
//   2.5 → 3), as `docs/key-figures.md` ("Arithmetic") defines rounding.
// toExpNeg/toExpPos: toString() never switches to exponent notation, so the
//   formatter always receives plain decimal strings.
import DecimalJs from 'decimal.js';

export const Decimal = DecimalJs.clone({
  precision: 40,
  rounding: DecimalJs.ROUND_HALF_UP,
  toExpNeg: -9e15,
  toExpPos: 9e15,
});

export type Decimal = InstanceType<typeof Decimal>;

/**
 * Rounds `value` to `places` decimal places, ties away from zero. The only
 * rounding in Peerless; called only by `format.ts`, at display.
 */
export function roundHalfAwayFromZero(value: Decimal, places: number): Decimal {
  if (!Number.isInteger(places) || places < 0) {
    throw new RangeError(`places must be a whole number ≥ 0, got ${places}`);
  }
  return new Decimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}
