// The wire codec (Story 3.5; AD-6): exact values cross from server to
// browser as full-precision decimal strings, and a malformed one throws.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/engine/decimal.ts';
import { fromWire, toWire } from '../../src/engine/wire.ts';

describe('the wire codec', () => {
  it('round-trips a 40-digit, a negative and a zero value exactly', () => {
    const values = [
      // 40 significant digits: one ninth of an amount in øre.
      new Decimal('175253146').div(9),
      new Decimal('-0.04900003035569648097394155380289658012547'),
      new Decimal('-61338600'),
      new Decimal(0),
      new Decimal('-0'),
      new Decimal('0.0000000000000000000000000001'),
      new Decimal('123456789012345678901234567890.1234567891'),
    ];
    expect(values[0]?.precision(true)).toBe(40);
    for (const value of values) {
      const wire = toWire(value);
      expect(fromWire(wire).eq(value), wire).toBe(true);
      // No exponent and no pre-rounding: every digit toString has.
      expect(wire).not.toMatch(/e/i);
      expect(wire).toBe(value.isZero() ? '0' : value.toString());
    }
    expect(toWire(new Decimal('-0'))).toBe('0');
  });

  it.each(['', '-', '+1', '1e5', '1E-7', '01', '1.', '.5', '1.50', '-0', '1,5', ' 1', 'NaN', 'Infinity', '0x10', '1_000'])(
    'a malformed string throws: %j',
    (text) => {
      expect(() => fromWire(text)).toThrow(TypeError);
    },
  );

  it('refuses a value that is not finite', () => {
    expect(() => toWire(new Decimal(Infinity))).toThrow(RangeError);
    expect(() => toWire(new Decimal(NaN))).toThrow(RangeError);
  });
});
