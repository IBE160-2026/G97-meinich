// The one codec for exact values a server component passes to a client
// component (AD-6, Story 3.5): a Decimal travels as its full-precision
// decimal string, never pre-rounded and never as a `number`, under the
// branded `WireDecimal` type, so a `number` or a plain `string` where a
// client prop holds money or a ratio is a type error (test/types/wire-props.ts).
//
// The grammar is strict: an optional minus, an integer part without leading
// zeros, and an optional fraction without trailing zeros; no exponent, no
// plus sign, no "-0". `toWire` writes exactly that (Decimal.toString never
// uses exponent notation, src/engine/decimal.ts), and `fromWire` throws on
// anything else, so a malformed value fails loudly instead of being read as
// some other number. `fromWire(toWire(d))` equals d (test/engine/wire.test.ts).
import { Decimal } from './decimal.ts';

declare const WIRE: unique symbol;

/** An exact decimal as it crosses from server to browser. Made only by `toWire`. */
export type WireDecimal = string & { readonly [WIRE]: true };

const GRAMMAR = /^-?(0|[1-9]\d*)(\.\d*[1-9])?$/;

function check(text: string): void {
  if (!GRAMMAR.test(text) || text === '-0') throw new TypeError(`not a wire decimal: ${JSON.stringify(text)}`);
}

/** A Decimal → its wire string, every significant digit kept. */
export function toWire(value: Decimal): WireDecimal {
  if (!value.isFinite()) throw new RangeError('a wire decimal must be finite');
  // Decimal keeps the sign of zero; the wire has one zero.
  const text = value.isZero() ? '0' : value.toString();
  check(text);
  return text as WireDecimal;
}

/** A wire string → the Decimal it was made from. Throws on anything `toWire` cannot have written. */
export function fromWire(text: string): Decimal {
  check(text);
  return new Decimal(text);
}
