import { describe, expect, it } from 'vitest';
import { Decimal, roundHalfAwayFromZero } from '../../src/engine/decimal.ts';

describe('the engine decimal constructor (AD-8)', () => {
  it('is configured with precision 40, half away from zero, and no exponents', () => {
    expect(Decimal.precision).toBe(40);
    expect(Decimal.rounding).toBe(Decimal.ROUND_HALF_UP);
    expect(new Decimal('1e-30').toString()).toBe(`0.${'0'.repeat(29)}1`);
    expect(new Decimal('1e30').toString()).toBe(`1${'0'.repeat(30)}`);
  });

  it('divides to 40 significant digits', () => {
    expect(new Decimal(1).div(3).toString()).toBe(`0.${'3'.repeat(40)}`);
  });

  it('builds exactly from a bigint above 2^53', () => {
    expect(new Decimal(9007199254740993n).toString()).toBe('9007199254740993');
  });
});

describe('roundHalfAwayFromZero', () => {
  it.each([
    ['-2.5', 0, '-3'],
    ['2.5', 0, '3'],
    ['-0.05', 1, '-0.1'],
    ['0.05', 1, '0.1'],
    ['2.4999', 0, '2'],
    ['-2.4999', 0, '-2'],
    ['1.005', 2, '1.01'],
  ])('rounds %s to %i places as %s', (value, places, expected) => {
    expect(roundHalfAwayFromZero(new Decimal(value), places).toString()).toBe(expected);
  });

  it('refuses a negative or fractional number of places', () => {
    expect(() => roundHalfAwayFromZero(new Decimal(1), -1)).toThrow(RangeError);
    expect(() => roundHalfAwayFromZero(new Decimal(1), 0.5)).toThrow(RangeError);
  });
});
