// The analysis URL (AD-5, FR-69, UX-DR79): the one module that reads and
// writes it. Every link to an analysis and every control that changes one
// goes through `parse` and `serialize`; no other file in `src/` builds or
// reads an analysis path (test/url-module-boundary.test.ts). It imports only
// from the engine, so it is safe in client components.
//
// Grammar:
//   path   /analyse/{orgnr}  or  /analyse/{orgnr}/{fane}
//          fane ∈ oversikt | peers | nokkeltall | verdi
//   query  ekskl      excluded peers: orgnrs, comma-separated, sorted,
//                     de-duplicated, at most 20, each in the candidate pool
//          band       0 | 1 | 2                       (default 0, Standard)
//          andel      0 | 25 | 50 | 75 | 100 | median (default 50)
//          multippel  (0, 50] in steps of 0.1; read with a point or a
//                     decimal comma, written with a point (default none)
//
// Every value `parse` cannot keep falls back to its default and sets the one
// `invalidSettings` flag, so nothing is dropped silently. Canonicalising —
// sorting and de-duplicating `ekskl`, stripping spaces, "6,5" → "6.5",
// "6.50" → "6.5" — is not a fallback. Unknown parameters (fbclid, utm_…)
// are ignored without the flag and are not written back.

import { Decimal } from '../engine/decimal.ts';
import { isValidOrgnr } from '../engine/orgnr.ts';
import type { SizeBand } from '../engine/peers.ts';

const PATH_PREFIX = '/analyse/';

export const FANER = ['oversikt', 'peers', 'nokkeltall', 'verdi'] as const;
export type Fane = (typeof FANER)[number];

export const BANDS = [0, 1, 2] as const satisfies readonly SizeBand[];
/** The engine's size-band step; the URL module imports only from the engine. */
export type Band = SizeBand;

export const ANDELER = [0, 25, 50, 75, 100, 'median'] as const;
export type Andel = (typeof ANDELER)[number];

export const DEFAULT_BAND: Band = 0;
export const DEFAULT_ANDEL: Andel = 50;

/** The most exclusions a URL keeps; any beyond are dropped with the flag. */
export const MAX_EKSKL = 20;
/** The multiple's bounds: greater than 0, at most 50, in steps of 0.1. */
export const MULTIPPEL_MAX = new Decimal(50);
export const MULTIPPEL_STEP = new Decimal('0.1');

export type AnalysisState = {
  /** Nine digits passing modulus 11. */
  readonly orgnr: string;
  /** `null` for the bare path `/analyse/{orgnr}`. */
  readonly fane: Fane | null;
  /** Sorted, de-duplicated, at most 20 valid orgnrs, never the subject. */
  readonly ekskl: readonly string[];
  readonly band: Band;
  readonly andel: Andel;
  /** Never a float; `null` when no multiple is set. */
  readonly multippel: Decimal | null;
};

export type ParseResult =
  | { readonly kind: 'analysis'; readonly state: AnalysisState; readonly invalidSettings: boolean }
  /**
   * `length`: not nine digits after removing spaces; `checksum`: nine digits
   * failing modulus 11. `input` is the orgnr segment as typed, decoded, for
   * the search field that shows the message.
   */
  | { readonly kind: 'invalid-orgnr'; readonly reason: 'length' | 'checksum'; readonly input: string }
  | { readonly kind: 'not-analysis' };

export type ParseContext = {
  /**
   * Whether `peerOrgnr` is in the subject's candidate pool at `band` (funnel
   * stages 1–3, Story 1.7). The pool depends on the band, and the band is
   * read from the same URL, so `parse` reads `band` first and passes the
   * parsed value; a caller could not close over a band it has not parsed.
   * An `ekskl` item it rejects is dropped with the flag.
   */
  readonly isCandidate: (peerOrgnr: string, band: Band) => boolean;
  /**
   * Whether a median step s_med exists for this peer group. Called only for
   * `andel=median`, with the parsed orgnr, band and exclusions; when false,
   * `andel` falls back to 50 with the flag.
   */
  readonly medianStepExists: (peers: {
    readonly orgnr: string;
    readonly band: Band;
    readonly ekskl: readonly string[];
  }) => boolean;
};

/** The state a plain link to `orgnr` opens: every setting at its default. */
export function defaultState(orgnr: string): AnalysisState {
  return { orgnr, fane: null, ekskl: [], band: DEFAULT_BAND, andel: DEFAULT_ANDEL, multippel: null };
}

function stripSpaces(text: string): string {
  return text.replace(/\s/g, '');
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A malformed escape is left as it is; it can never be nine digits.
    return segment;
  }
}

function isFane(text: string): text is Fane {
  return (FANER as readonly string[]).includes(text);
}

/**
 * Reads a multiple as typed or as found in a URL: digits with an optional
 * point or decimal comma and decimals. Returns the value when it is greater
 * than 0, at most 50 and a whole number of tenths; otherwise `null`.
 */
export function parseMultippel(text: string): Decimal | null {
  if (!/^\d+([.,]\d+)?$/.test(text)) return null;
  const value = new Decimal(text.replace(',', '.'));
  if (value.lte(0) || value.gt(MULTIPPEL_MAX)) return null;
  // Exact: no more decimal places than the step has. Dividing by the step
  // would round at precision 40 and keep 6.5000…0001.
  if (value.decimalPlaces() > MULTIPPEL_STEP.decimalPlaces()) return null;
  return value;
}

function parseBand(text: string): Band | null {
  for (const band of BANDS) {
    if (text === String(band)) return band;
  }
  return null;
}

function parseAndel(text: string): Andel | null {
  if (text === 'median') return 'median';
  for (const andel of ANDELER) {
    if (andel !== 'median' && text === String(andel)) return andel;
  }
  return null;
}

/**
 * Parses an analysis URL: a path with an optional query (`/analyse/…?…`) or
 * an absolute URL. The hash is ignored and one trailing slash tolerated.
 */
export function parse(href: string, context: ParseContext): ParseResult {
  let url: URL;
  try {
    url = new URL(href, 'http://peerless.invalid');
  } catch {
    return { kind: 'not-analysis' };
  }
  let pathname = url.pathname;
  if (!pathname.startsWith(PATH_PREFIX)) return { kind: 'not-analysis' };
  if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  if (pathname.length < PATH_PREFIX.length) return { kind: 'not-analysis' };
  const segments = pathname.slice(PATH_PREFIX.length).split('/');
  if (segments.length > 2) return { kind: 'not-analysis' };

  const input = decodeSegment(segments[0] ?? '');
  const orgnr = stripSpaces(input);
  if (!/^\d{9}$/.test(orgnr)) return { kind: 'invalid-orgnr', reason: 'length', input };
  if (!isValidOrgnr(orgnr)) return { kind: 'invalid-orgnr', reason: 'checksum', input };

  let invalidSettings = false;

  let fane: Fane | null = null;
  const faneSegment = segments[1];
  if (faneSegment !== undefined) {
    const text = decodeSegment(faneSegment);
    if (isFane(text)) {
      fane = text;
    } else {
      fane = 'oversikt';
      invalidSettings = true;
    }
  }

  // One value per parameter. An empty value counts as absent, also when
  // repeated; a parameter with more than one non-empty value is a fallback.
  const single = (name: string): string | null => {
    const values = url.searchParams.getAll(name).filter((value) => value !== '');
    if (values.length > 1) {
      invalidSettings = true;
      return null;
    }
    return values[0] ?? null;
  };

  // The band first: whether an `ekskl` item is a candidate depends on it.
  let band: Band = DEFAULT_BAND;
  const bandText = single('band');
  if (bandText !== null) {
    const parsed = parseBand(bandText);
    if (parsed === null) invalidSettings = true;
    else band = parsed;
  }

  let ekskl: string[] = [];
  const eksklText = single('ekskl');
  if (eksklText !== null) {
    // Split, strip, de-duplicate, drop what is not a candidate, sort, then
    // cap — so a rejected item never takes one of the 20 places.
    const items = new Set(eksklText.split(',').map(stripSpaces).filter((item) => item !== ''));
    const kept: string[] = [];
    for (const item of items) {
      if (isValidOrgnr(item) && item !== orgnr && context.isCandidate(item, band)) {
        kept.push(item);
      } else {
        invalidSettings = true;
      }
    }
    kept.sort();
    if (kept.length > MAX_EKSKL) {
      invalidSettings = true;
      kept.length = MAX_EKSKL;
    }
    ekskl = kept;
  }

  let andel: Andel = DEFAULT_ANDEL;
  const andelText = single('andel');
  if (andelText !== null) {
    const parsed = parseAndel(andelText);
    if (parsed === null) {
      invalidSettings = true;
    } else if (parsed === 'median' && !context.medianStepExists({ orgnr, band, ekskl })) {
      invalidSettings = true;
    } else {
      andel = parsed;
    }
  }

  let multippel: Decimal | null = null;
  const multippelText = single('multippel');
  if (multippelText !== null) {
    multippel = parseMultippel(multippelText);
    if (multippel === null) invalidSettings = true;
  }

  return { kind: 'analysis', state: { orgnr, fane, ekskl, band, andel, multippel }, invalidSettings };
}

/**
 * Parses an analysis URL from its route segments, as a page receives them,
 * and its query string (with or without the leading "?"). Next.js 16 passes
 * segments still percent-encoded ("813%20235%20552"); a decoded segment is
 * accepted too. Each segment is decoded once and percent-encoded again
 * before `parse` decodes it, so either form reads the same, a segment
 * holding "/", "?" or "#" stays one segment, and pages never compose the
 * path themselves.
 */
export function parseSegments(
  segments: { readonly orgnr: string; readonly fane?: string },
  search: string,
  context: ParseContext,
): ParseResult {
  const encode = (segment: string): string => encodeURIComponent(decodeSegment(segment));
  let path = `${PATH_PREFIX}${encode(segments.orgnr)}`;
  if (segments.fane !== undefined) path += `/${encode(segments.fane)}`;
  const query = search === '' || search.startsWith('?') ? search : `?${search}`;
  return parse(path + query, context);
}

/**
 * Writes the canonical URL for `state`: defaults omitted, parameters in the
 * order ekskl, band, andel, multippel, literal commas in `ekskl`, the
 * multiple with a point and no trailing zero.
 */
export function serialize(state: AnalysisState): string {
  const path = state.fane === null ? `${PATH_PREFIX}${state.orgnr}` : `${PATH_PREFIX}${state.orgnr}/${state.fane}`;
  const query: string[] = [];
  const ekskl = [...new Set(state.ekskl)].sort();
  if (ekskl.length > 0) query.push(`ekskl=${ekskl.join(',')}`);
  if (state.band !== DEFAULT_BAND) query.push(`band=${state.band}`);
  if (state.andel !== DEFAULT_ANDEL) query.push(`andel=${state.andel}`);
  // Decimal.toString() never uses exponent notation (src/engine/decimal.ts)
  // and writes no trailing zero.
  if (state.multippel !== null) query.push(`multippel=${state.multippel.toString()}`);
  return query.length === 0 ? path : `${path}?${query.join('&')}`;
}
