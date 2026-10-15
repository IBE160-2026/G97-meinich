// The analysis URL module (Story 1.6a; AD-5, FR-69, UX-DR79). Every
// parameter and every fallback of the grammar, the caller-supplied
// predicates both ways, and the fixed point serialize(parse(u)) over every
// URL in this file. These tests exist before Epic 2 adds any control.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/engine/decimal.ts';
import { isValidOrgnr } from '../../src/engine/orgnr.ts';
import {
  MAX_EKSKL,
  MULTIPPEL_MAX,
  defaultState,
  parse,
  parseMultippel,
  serialize,
  type AnalysisState,
  type ParseContext,
  type ParseResult,
} from '../../src/url/analysis-state.ts';

// 1·3+2·2+3·7+4·6+5·5+6·4+7·3+8·2 = 138, 138 mod 11 = 6, check digit 5.
const SUBJECT = '123456785';

/** The first `n` valid orgnrs from 910000000 upwards, ascending. */
function validOrgnrs(n: number): string[] {
  const found: string[] = [];
  for (let candidate = 910_000_000; found.length < n; candidate += 1) {
    const text = String(candidate);
    if (isValidOrgnr(text)) found.push(text);
  }
  return found;
}

const PEERS = validOrgnrs(30);
const [A, B, C] = PEERS as [string, string, string];

const ACCEPT_ALL: ParseContext = { isCandidate: () => true, medianStepExists: () => false };
const WITH_MEDIAN: ParseContext = { isCandidate: () => true, medianStepExists: () => true };

// Every URL parsed in this file, for the fixed-point test at the end.
const seen: { href: string; context: ParseContext }[] = [];

function run(href: string, context: ParseContext = ACCEPT_ALL): ParseResult {
  seen.push({ href, context });
  return parse(href, context);
}

function analysis(href: string, context: ParseContext = ACCEPT_ALL): { state: AnalysisState; invalidSettings: boolean } {
  const result = run(href, context);
  if (result.kind !== 'analysis') throw new Error(`${href}: expected an analysis, got ${result.kind}`);
  return { state: result.state, invalidSettings: result.invalidSettings };
}

function canonical(href: string, context: ParseContext = ACCEPT_ALL): string {
  return serialize(analysis(href, context).state);
}

describe('path', () => {
  it('reads the bare path with no tab and writes it back bare', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}`);
    expect(state).toEqual(defaultState(SUBJECT));
    expect(state.fane).toBeNull();
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}`);
  });

  it.each(['oversikt', 'peers', 'nokkeltall', 'verdi'] as const)('reads the tab %s', (fane) => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}/${fane}`);
    expect(state.fane).toBe(fane);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}/${fane}`);
  });

  it.each(['foo', 'Peers', 'nøkkeltall'])('falls back to oversikt for the unknown tab %s, with the flag', (fane) => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}/${encodeURIComponent(fane)}`);
    expect(state.fane).toBe('oversikt');
    expect(invalidSettings).toBe(true);
  });

  it('falls back to oversikt for a malformed escape as the tab, with the flag', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}/%zz`);
    expect(state.fane).toBe('oversikt');
    expect(invalidSettings).toBe(true);
  });

  it('strips spaces in the orgnr, including %20, without the flag', () => {
    const { state, invalidSettings } = analysis('/analyse/123%20456%20785/peers');
    expect(state.orgnr).toBe(SUBJECT);
    expect(invalidSettings).toBe(false);
    expect(analysis('/analyse/123 456 785').state.orgnr).toBe(SUBJECT);
  });

  it('tolerates one trailing slash, ignores the hash and accepts an absolute URL', () => {
    expect(canonical(`/analyse/${SUBJECT}/`)).toBe(`/analyse/${SUBJECT}`);
    expect(canonical(`/analyse/${SUBJECT}/peers/`)).toBe(`/analyse/${SUBJECT}/peers`);
    expect(canonical(`/analyse/${SUBJECT}/peers#tabell`)).toBe(`/analyse/${SUBJECT}/peers`);
    expect(canonical(`https://example.org/analyse/${SUBJECT}/verdi?band=1`)).toBe(`/analyse/${SUBJECT}/verdi?band=1`);
  });

  it.each([
    ['12345678', 'length'],
    ['abc', 'length'],
    ['1234567850', 'length'],
    ['%E2%80%8B', 'length'],
    ['%zz', 'length'],
    ['%', 'length'],
    ['123456789', 'checksum'],
  ] as const)('refuses the orgnr %s with reason %s', (orgnr, reason) => {
    expect(run(`/analyse/${orgnr}`)).toEqual({ kind: 'invalid-orgnr', reason });
    expect(run(`/analyse/${orgnr}/peers?band=1`)).toEqual({ kind: 'invalid-orgnr', reason });
  });

  it.each(['/', '/analyse', '/analyse/', `/analyse/${SUBJECT}/peers/extra`, '/analyse/x/y/z', `/annet/${SUBJECT}`])(
    'is not an analysis: %s',
    (href) => {
      expect(run(href)).toEqual({ kind: 'not-analysis' });
    },
  );
});

describe('ekskl', () => {
  it('sorts and de-duplicates without the flag, written with literal commas', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=${B},${A},${A}`);
    expect(state.ekskl).toEqual([A, B]);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}?ekskl=${A},${B}`);
  });

  it('strips spaces and reads encoded commas as canonicalising, not a fallback', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=${B}%2C%20${A.slice(0, 3)}+${A.slice(3)}`);
    expect(state.ekskl).toEqual([A, B]);
    expect(invalidSettings).toBe(false);
  });

  it('drops an item failing modulus 11, keeps the rest, with the flag', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=${A},123456789,${B}`);
    expect(state.ekskl).toEqual([A, B]);
    expect(invalidSettings).toBe(true);
  });

  it.each(['12345678', 'abc', '1234567850'])('drops the item %s that is not nine digits, with the flag', (item) => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=${item},${A}`);
    expect(state.ekskl).toEqual([A]);
    expect(invalidSettings).toBe(true);
  });

  it('keeps the first 20 after sorting when given 22, with the flag', () => {
    const many = PEERS.slice(0, 22);
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=${[...many].reverse().join(',')}`);
    expect(state.ekskl).toEqual(many.slice(0, MAX_EKSKL));
    expect(invalidSettings).toBe(true);
  });

  it('keeps exactly 20 without the flag', () => {
    const twenty = PEERS.slice(0, 20);
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=${twenty.join(',')}`);
    expect(state.ekskl).toEqual(twenty);
    expect(invalidSettings).toBe(false);
  });

  it('drops an item outside the candidate pool, with the flag', () => {
    const context: ParseContext = { isCandidate: (peer) => peer !== B, medianStepExists: () => false };
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=${A},${B},${C}`, context);
    expect(state.ekskl).toEqual([A, C]);
    expect(invalidSettings).toBe(true);
  });

  it('drops rejected items before the cap, so they never take a place', () => {
    const rejected = new Set(PEERS.slice(0, 5));
    const context: ParseContext = { isCandidate: (peer) => !rejected.has(peer), medianStepExists: () => false };
    const { state } = analysis(`/analyse/${SUBJECT}?ekskl=${PEERS.slice(0, 25).join(',')}`, context);
    expect(state.ekskl).toEqual(PEERS.slice(5, 25));
  });

  it('drops the subject itself even when isCandidate accepts it, with the flag', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=${SUBJECT},${A}`);
    expect(state.ekskl).toEqual([A]);
    expect(invalidSettings).toBe(true);
  });

  it('asks isCandidate only about valid orgnrs other than the subject', () => {
    const asked: string[] = [];
    const context: ParseContext = {
      isCandidate: (peer) => {
        asked.push(peer);
        return true;
      },
      medianStepExists: () => false,
    };
    analysis(`/analyse/${SUBJECT}?ekskl=${A},123456789,${SUBJECT},abc`, context);
    expect(asked).toEqual([A]);
  });

  it('reads an empty value as absent, without the flag', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?ekskl=`);
    expect(state.ekskl).toEqual([]);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}`);
  });
});

describe('band', () => {
  it.each([
    ['1', 1],
    ['2', 2],
  ] as const)('keeps band=%s', (text, band) => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?band=${text}`);
    expect(state.band).toBe(band);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}?band=${text}`);
  });

  it('reads band=0 as the default and omits it', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?band=0`);
    expect(state.band).toBe(0);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}`);
  });

  it.each(['3', 'x', '-1', '01', '1.0'])('falls back to 0 for band=%s, with the flag', (text) => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?band=${text}`);
    expect(state.band).toBe(0);
    expect(invalidSettings).toBe(true);
  });
});

describe('andel', () => {
  it.each([0, 25, 75, 100] as const)('keeps andel=%s', (andel) => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?andel=${andel}`);
    expect(state.andel).toBe(andel);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}?andel=${andel}`);
  });

  it('reads andel=50 as the default and omits it', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?andel=50`);
    expect(state.andel).toBe(50);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}`);
  });

  it.each(['33', 'x', '050', 'Median', '-25'])('falls back to 50 for andel=%s, with the flag', (text) => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?andel=${text}`);
    expect(state.andel).toBe(50);
    expect(invalidSettings).toBe(true);
  });

  it('falls back to 50 for andel=median when no median step exists, with the flag', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?andel=median`, ACCEPT_ALL);
    expect(state.andel).toBe(50);
    expect(invalidSettings).toBe(true);
  });

  it('keeps andel=median when a median step exists', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?andel=median`, WITH_MEDIAN);
    expect(state.andel).toBe('median');
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}?andel=median`);
  });

  it('gives the median predicate the parsed orgnr, band and exclusions', () => {
    const calls: unknown[] = [];
    const context: ParseContext = {
      isCandidate: () => true,
      medianStepExists: (peers) => {
        calls.push(peers);
        return true;
      },
    };
    analysis(`/analyse/${SUBJECT}?andel=median&band=2&ekskl=${B},${A},123456789`, context);
    expect(calls).toEqual([{ orgnr: SUBJECT, band: 2, ekskl: [A, B] }]);
  });

  it('does not ask the median predicate for any other andel', () => {
    let asked = false;
    const context: ParseContext = {
      isCandidate: () => true,
      medianStepExists: () => {
        asked = true;
        return true;
      },
    };
    analysis(`/analyse/${SUBJECT}?andel=25`, context);
    expect(asked).toBe(false);
  });
});

describe('multippel', () => {
  it.each([
    ['6.5', '6.5'],
    ['6,5', '6.5'],
    ['6.50', '6.5'],
    ['50', '50'],
    ['50.0', '50'],
    ['0.1', '0.1'],
    ['12', '12'],
  ])('keeps multippel=%s, written as %s, without the flag', (text, written) => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?multippel=${text}`);
    expect(state.multippel).toBeInstanceOf(Decimal);
    expect(state.multippel?.toString()).toBe(written);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}?multippel=${written}`);
  });

  it.each(['0', '0.0', '50.1', '6.55', '-1', 'x', '1e1', '.5', '5.', '6,5,0', ' 6', '6.500000000000000000000000000000000000000000001'])(
    'drops multippel=%s, with the flag',
    (text) => {
      const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?multippel=${encodeURIComponent(text)}`);
      expect(state.multippel).toBeNull();
      expect(invalidSettings).toBe(true);
    },
  );

  it('reads an empty value as absent, without the flag', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?multippel=`);
    expect(state.multippel).toBeNull();
    expect(invalidSettings).toBe(false);
  });

  it('parseMultippel holds the same bounds for the Verdi field', () => {
    expect(parseMultippel('6,5')?.toString()).toBe('6.5');
    expect(parseMultippel(MULTIPPEL_MAX.toString())?.eq(MULTIPPEL_MAX)).toBe(true);
    expect(parseMultippel('50.1')).toBeNull();
    expect(parseMultippel('0')).toBeNull();
    expect(parseMultippel('')).toBeNull();
  });
});

describe('the query as a whole', () => {
  it('falls back to the default for a repeated parameter, with the flag', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}?band=1&band=2`);
    expect(state.band).toBe(0);
    expect(invalidSettings).toBe(true);
    for (const href of [
      `/analyse/${SUBJECT}?andel=25&andel=25`,
      `/analyse/${SUBJECT}?multippel=6&multippel=7`,
      `/analyse/${SUBJECT}?ekskl=${A}&ekskl=${B}`,
    ]) {
      const result = analysis(href);
      expect(result.state).toEqual(defaultState(SUBJECT));
      expect(result.invalidSettings, href).toBe(true);
    }
  });

  it('reads a repeated empty value as absent, without the flag', () => {
    const empty = analysis(`/analyse/${SUBJECT}?ekskl=&ekskl=`);
    expect(empty.state).toEqual(defaultState(SUBJECT));
    expect(empty.invalidSettings).toBe(false);
    const band = analysis(`/analyse/${SUBJECT}?band=1&band=`);
    expect(band.state.band).toBe(1);
    expect(band.invalidSettings).toBe(false);
  });

  it('ignores unknown parameters without the flag and does not write them back', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}/peers?fbclid=x&band=1&utm_source=y`);
    expect(invalidSettings).toBe(false);
    expect(serialize(state)).toBe(`/analyse/${SUBJECT}/peers?band=1`);
  });

  it('writes parameters in the order ekskl, band, andel, multippel, whatever the input order', () => {
    expect(canonical(`/analyse/${SUBJECT}/verdi?multippel=7,0&andel=median&band=2&ekskl=${B},${A}`, WITH_MEDIAN)).toBe(
      `/analyse/${SUBJECT}/verdi?ekskl=${A},${B}&band=2&andel=median&multippel=7`,
    );
  });

  it('writes nothing for a state at every default', () => {
    expect(serialize(defaultState(SUBJECT))).toBe(`/analyse/${SUBJECT}`);
    expect(canonical(`/analyse/${SUBJECT}?band=0&andel=50&ekskl=&multippel=`)).toBe(`/analyse/${SUBJECT}`);
  });

  it('keeps settings that are valid when others fall back', () => {
    const { state, invalidSettings } = analysis(`/analyse/${SUBJECT}/foo?band=3&andel=75&multippel=6,5&ekskl=${A}`);
    expect(state).toEqual({ ...defaultState(SUBJECT), fane: 'oversikt', andel: 75, ekskl: [A], multippel: new Decimal('6.5') });
    expect(invalidSettings).toBe(true);
  });
});

describe('serialize', () => {
  it('sorts and de-duplicates exclusions a control hands it', () => {
    expect(serialize({ ...defaultState(SUBJECT), ekskl: [B, A, B] })).toBe(`/analyse/${SUBJECT}?ekskl=${A},${B}`);
  });

  it('writes a multiple with a point and no trailing zero', () => {
    expect(serialize({ ...defaultState(SUBJECT), multippel: new Decimal('6.50') })).toBe(`/analyse/${SUBJECT}?multippel=6.5`);
  });
});

// Last in file order, so it sees every URL parsed above.
describe('fixed point', () => {
  it('serialize(parse(u)) parses back to the same state and writes the same URL, for every URL above', () => {
    const analyses = seen.filter(({ href, context }) => parse(href, context).kind === 'analysis');
    expect(analyses.length).toBeGreaterThan(50);
    for (const { href, context } of analyses) {
      const first = parse(href, context);
      if (first.kind !== 'analysis') throw new Error(href);
      const written = serialize(first.state);
      const second = parse(written, context);
      expect(second, `${href} → ${written}`).toEqual({ kind: 'analysis', state: first.state, invalidSettings: false });
      expect(serialize((second as Extract<ParseResult, { kind: 'analysis' }>).state), href).toBe(written);
    }
  });
});
