// The only display formatter in Peerless (EXPERIENCE.md "Number formatting",
// AD-6). Every function takes a plain decimal string, rounds once through
// roundHalfAwayFromZero, and writes fixed characters: U+00A0 as thousands
// separator and before the unit, a decimal comma, and U+2212 as minus. A
// value that rounds to zero carries no sign. No Intl.NumberFormat: its output
// differs between Node and browsers.
import { Decimal, roundHalfAwayFromZero } from './decimal.ts';
import { parseDecimal, parseOre } from './inputs.ts';

const NBSP = ' ';
const MINUS = '−';
const ORE_PER_KRONE = 100;
const ORE_PER_MILLION_KRONER = 100_000_000;

function ore(value: string): Decimal {
  const parsed = parseOre(value);
  if (parsed === null) throw new TypeError('an amount to format cannot be null');
  return new Decimal(parsed);
}

function decimal(value: string): Decimal {
  const parsed = parseDecimal(value);
  if (parsed === null) throw new TypeError('a value to format cannot be null');
  return parsed;
}

function groupThousands(digits: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += NBSP;
    out += digits[i];
  }
  return out;
}

type RenderOptions = {
  /** Write "+" before a positive value (signed kroner). */
  readonly plus?: boolean;
  /** Drop a fractional part that is all zeros ("6" rather than "6,0"). */
  readonly trimZeroFraction?: boolean;
};

/** Rounds `value` to `places` and writes it with grouped digits, decimal comma and true minus. */
function render(value: Decimal, places: number, options: RenderOptions = {}): string {
  const rounded = roundHalfAwayFromZero(value, places);
  const sign = rounded.isZero() ? '' : rounded.isNegative() ? MINUS : options.plus === true ? '+' : '';
  // toString never uses exponent notation (decimal.ts) and has at most
  // `places` fraction digits after rounding.
  const [whole = '0', fraction = ''] = rounded.abs().toString().split('.');
  const padded = fraction.padEnd(places, '0');
  const showFraction = places > 0 && !(options.trimZeroFraction === true && /^0*$/.test(padded));
  return sign + groupThousands(whole) + (showFraction ? `,${padded}` : '');
}

/** Øre (whole-number string) → whole kroner: "1 170 000 kr", "−501 428 kr". */
export function formatKroner(oreAmount: string): string {
  return `${render(ore(oreAmount).div(ORE_PER_KRONE), 0)}${NBSP}kr`;
}

/** Øre (whole-number string) → signed whole kroner: "+1 019 571 kr", "−501 428 kr", "0 kr". */
export function formatSignedKroner(oreAmount: string): string {
  return `${render(ore(oreAmount).div(ORE_PER_KRONE), 0, { plus: true })}${NBSP}kr`;
}

/** Øre (whole-number string) → millions of kroner, one decimal: "16,7 mill. kr". */
export function formatMillions(oreAmount: string): string {
  return `${render(ore(oreAmount).div(ORE_PER_MILLION_KRONER), 1)}${NBSP}mill.${NBSP}kr`;
}

/** A fraction (0.021) → percent, one decimal: "2,1 %". */
export function formatPercent(fraction: string): string {
  return `${render(decimal(fraction).mul(100), 1)}${NBSP}%`;
}

/** Percent (0–100, e.g. Plassering 61.36…) → whole percent: "61 %". */
export function formatWholePercent(percent: string): string {
  return `${render(decimal(percent), 0)}${NBSP}%`;
}

/** A fraction difference (0.07) → percentage points, one decimal: "7,0 pp". */
export function formatPercentagePoints(fraction: string): string {
  return `${render(decimal(fraction).mul(100), 1)}${NBSP}pp`;
}

/** Days → whole days: "48 dager". */
export function formatDays(days: string): string {
  return `${render(decimal(days), 0)}${NBSP}dager`;
}

/** A turnover ratio → two decimals: "2,85". */
export function formatTurnover(value: string): string {
  return render(decimal(value), 2);
}

/** A multiple → up to one decimal: "6,5", "6". */
export function formatMultiple(value: string): string {
  return render(decimal(value), 1, { trimZeroFraction: true });
}

/** A nine-digit organisation number → grouped 3-3-3: "912 345 678". */
export function formatOrgnr(orgnr: string): string {
  if (!/^\d{9}$/.test(orgnr)) throw new TypeError(`not a nine-digit orgnr: ${JSON.stringify(orgnr)}`);
  return groupThousands(orgnr);
}
