// An exact rational number of two bigints (Story 3.1a). Every key figure is
// computed as a reduced Fraction and turned into a Decimal by one division,
// at the end (`toDecimal`). That is what makes the decompositions in
// `docs/key-figures.md` hold exactly: (d/r) × (r/a) evaluated in Decimal
// rounds twice and is not d/a, but as fractions the product reduces to d/a,
// and dividing once gives return on assets' own Decimal.
//
// A Fraction is always reduced, with a positive denominator; zero is 0/1.
// Nothing here rounds.
import { Decimal } from './decimal.ts';

export type Fraction = {
  readonly numerator: bigint;
  /** Always positive. */
  readonly denominator: bigint;
};

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** numerator / denominator, reduced, with the sign on the numerator. A zero denominator throws. */
export function fraction(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === 0n) throw new RangeError('a fraction cannot have a zero denominator');
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return { numerator: (sign * numerator) / divisor, denominator: (sign * denominator) / divisor };
}

export function multiply(a: Fraction, b: Fraction): Fraction {
  return fraction(a.numerator * b.numerator, a.denominator * b.denominator);
}

/** a / b; `b` zero throws. */
export function divide(a: Fraction, b: Fraction): Fraction {
  return fraction(a.numerator * b.denominator, a.denominator * b.numerator);
}

export function subtract(a: Fraction, b: Fraction): Fraction {
  return fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
}

/** Whether two fractions are the same number: both are reduced, so their parts are equal. */
export function equals(a: Fraction, b: Fraction): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

/**
 * The fraction as a Decimal: one division, rounded once to the configured 40
 * significant digits (decimal.js rounds a quotient correctly, so equal
 * fractions give equal Decimals however they were written).
 */
export function toDecimal(value: Fraction): Decimal {
  return new Decimal(value.numerator.toString()).div(new Decimal(value.denominator.toString()));
}
