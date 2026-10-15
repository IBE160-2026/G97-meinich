// The organisation number rules shared by search (Story 1.5b) and the URL
// module (Story 1.6a). FR-1: spaces are ignored; input of digits only is an
// organisation number and must have nine digits that pass the modulus-11
// check; anything else, including a name containing digits ("1881 Media"),
// is a name search.

const WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2] as const;

export type SearchInput =
  /** Nothing but whitespace. */
  | { readonly kind: 'empty' }
  /** A name search; `name` is the input with surrounding whitespace trimmed. */
  | { readonly kind: 'name'; readonly name: string }
  /** Nine digits with a valid check digit, spaces removed. */
  | { readonly kind: 'orgnr'; readonly orgnr: string }
  /** Digits only, but not nine of them: "Organisasjonsnummeret må ha 9 siffer". */
  | { readonly kind: 'length' }
  /** Nine digits failing the modulus-11 check: "Ugyldig organisasjonsnummer". */
  | { readonly kind: 'checksum' };

/**
 * True when `digits` is nine digits whose last digit is the modulus-11 check
 * digit of the first eight (weights 3, 2, 7, 6, 5, 4, 3, 2). A remainder of 0
 * gives check digit 0; a remainder of 1 would need check digit 10, so no
 * number with that remainder is valid.
 */
export function isValidOrgnr(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  let sum = 0;
  WEIGHTS.forEach((weight, index) => {
    sum += weight * Number(digits[index]);
  });
  const remainder = sum % 11;
  if (remainder === 1) return false;
  const check = remainder === 0 ? 0 : 11 - remainder;
  return check === Number(digits[8]);
}

/** Classifies what a user typed into the search field. */
export function classifySearchInput(raw: string): SearchInput {
  const compact = raw.replace(/\s/g, '');
  if (compact === '') return { kind: 'empty' };
  if (/^\d+$/.test(compact)) {
    if (compact.length !== 9) return { kind: 'length' };
    return isValidOrgnr(compact) ? { kind: 'orgnr', orgnr: compact } : { kind: 'checksum' };
  }
  return { kind: 'name', name: raw.trim() };
}
