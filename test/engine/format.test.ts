// Formatter output pinned code point by code point (EXPERIENCE.md "Number
// formatting"): U+00A0 no-break space, U+2212 minus, decimal comma.
import { describe, expect, it } from 'vitest';
import {
  formatDays,
  formatKommune,
  formatKroner,
  formatKronerExact,
  formatMillions,
  formatMultiple,
  formatOrgnr,
  formatPercent,
  formatPercentagePoints,
  formatPercentNumber,
  formatReadDate,
  formatSignedKroner,
  formatTurnover,
  formatWholePercent,
  lowerFirst,
} from '../../src/engine/format.ts';

const codePoints = (s: string): number[] => [...s].map((c) => c.codePointAt(0) ?? -1);

function expectBytes(actual: string, expected: string): void {
  expect(codePoints(actual)).toEqual(codePoints(expected));
}

const NBSP = ' ';
const MINUS = '−';

describe('formatter bytes', () => {
  it.each([
    ['formatKroner 117 000 000 øre', formatKroner('117000000'), `1${NBSP}170${NBSP}000${NBSP}kr`],
    ['formatSignedKroner −50 142 800 øre', formatSignedKroner('-50142800'), `${MINUS}501${NBSP}428${NBSP}kr`],
    ['formatSignedKroner 101 957 100 øre', formatSignedKroner('101957100'), `+1${NBSP}019${NBSP}571${NBSP}kr`],
    ['formatMillions 1 670 000 000 øre', formatMillions('1670000000'), `16,7${NBSP}mill.${NBSP}kr`],
    ['formatPercent 0.021', formatPercent('0.021'), `2,1${NBSP}%`],
    ['formatWholePercent 61', formatWholePercent('61'), `61${NBSP}%`],
    ['formatPercentagePoints 0.07', formatPercentagePoints('0.07'), `7,0${NBSP}pp`],
    ['formatDays 48', formatDays('48'), `48${NBSP}dager`],
    ['formatTurnover 2.85', formatTurnover('2.85'), '2,85'],
    ['formatMultiple 6.5', formatMultiple('6.5'), '6,5'],
    ['formatOrgnr 912345678', formatOrgnr('912345678'), `912${NBSP}345${NBSP}678`],
  ])('%s', (_label, actual, expected) => {
    expectBytes(actual, expected);
  });

  it('writes the literal characters from EXPERIENCE.md', () => {
    expect(codePoints(formatSignedKroner('-50142800'))).toEqual([
      0x2212, 0x35, 0x30, 0x31, 0xa0, 0x34, 0x32, 0x38, 0xa0, 0x6b, 0x72,
    ]);
    expect(codePoints(formatPercent('0.021'))).toEqual([0x32, 0x2c, 0x31, 0xa0, 0x25]);
  });
});

describe('rounding, once, half away from zero', () => {
  it.each([
    ['-250', `${MINUS}3${NBSP}kr`],
    ['250', `3${NBSP}kr`],
    ['249', `2${NBSP}kr`],
    ['-249', `${MINUS}2${NBSP}kr`],
  ])('formatKroner %s øre', (ore, expected) => {
    expectBytes(formatKroner(ore), expected);
  });

  it.each([
    ['-0.0005', `${MINUS}0,1${NBSP}%`],
    ['0.0005', `0,1${NBSP}%`],
    ['-0.00049', `0,0${NBSP}%`],
    ['0.2075654093013029618713627223550873972236', `20,8${NBSP}%`],
    ['-2.762566739223531737082301784189360747834', `${MINUS}276,3${NBSP}%`],
  ])('formatPercent %s', (fraction, expected) => {
    expectBytes(formatPercent(fraction), expected);
  });

  it('writes no sign on a value that rounds to zero', () => {
    expectBytes(formatKroner('-49'), `0${NBSP}kr`);
    expectBytes(formatSignedKroner('-49'), `0${NBSP}kr`);
    expectBytes(formatSignedKroner('49'), `0${NBSP}kr`);
    expectBytes(formatSignedKroner('0'), `0${NBSP}kr`);
    expectBytes(formatPercentagePoints('-0.0004'), `0,0${NBSP}pp`);
    expectBytes(formatMultiple('-0.04'), '0');
  });

  it('rounds the percentile, days, turnover, multiple and millions', () => {
    expectBytes(formatWholePercent('60.869565217391304347826086956521739130'), `61${NBSP}%`);
    expectBytes(formatWholePercent('60.5'), `61${NBSP}%`);
    expectBytes(formatDays('47.5'), `48${NBSP}dager`);
    expectBytes(formatTurnover('2.845'), '2,85');
    expectBytes(formatTurnover('3'), '3,00');
    expectBytes(formatMultiple('6'), '6');
    expectBytes(formatMultiple('6.04'), '6');
    expectBytes(formatMultiple('6.05'), '6,1');
    expectBytes(formatMillions('1665000000'), `16,7${NBSP}mill.${NBSP}kr`);
    expectBytes(formatMillions('-1665000000'), `${MINUS}16,7${NBSP}mill.${NBSP}kr`);
  });

  it('keeps every digit of an amount above 2^53 øre', () => {
    expectBytes(
      formatKroner('900719925474099300'),
      `9${NBSP}007${NBSP}199${NBSP}254${NBSP}740${NBSP}993${NBSP}kr`,
    );
  });
});

describe('formatter input', () => {
  it('takes plain decimal strings only', () => {
    expect(() => formatPercent('1e3')).toThrow(TypeError);
    expect(() => formatPercent('0,5')).toThrow(TypeError);
    expect(() => formatKroner('1.5')).toThrow(TypeError);
    expect(() => formatKroner(100 as unknown as string)).toThrow(TypeError);
    expect(() => formatOrgnr('91234567')).toThrow(TypeError);
  });
});

describe('formatKommune', () => {
  it.each([
    ['OSLO', 'Oslo'],
    ['AURSKOG-HØLAND', 'Aurskog-Høland'],
    ['PORSANGER - PORSÁŊGU - PORSANKI', 'Porsanger - Porsáŋgu - Porsanki'],
    ['KÅFJORD - GÁIVUOTNA - KAIVUONO', 'Kåfjord - Gáivuotna - Kaivuono'],
    ['ÆRØY', 'Ærøy'],
    ['NORDRE FOLLO', 'Nordre Follo'],
  ])('%s → %s', (stored, shown) => {
    expect(formatKommune(stored)).toBe(shown);
  });
});

describe('lowerFirst', () => {
  it('lower-cases the first letter only', () => {
    expect(lowerFirst('Dataprogrammeringstjenester')).toBe('dataprogrammeringstjenester');
    expect(lowerFirst('Ærlig Drift')).toBe('ærlig Drift');
    expect(lowerFirst('')).toBe('');
  });
});

describe('formatReadDate', () => {
  it('writes the date in Europe/Oslo, not UTC: 2026-10-02T23:30Z is 3 October in Oslo', () => {
    expect(formatReadDate(new Date('2026-10-02T23:30:00Z'))).toBe('3. okt. 2026');
  });

  it.each([
    ['2026-01-01T00:00:00+01:00', '1. jan. 2026'],
    ['2025-12-31T22:59:59Z', '31. des. 2025'],
    ['2025-12-31T23:00:00Z', '1. jan. 2026'],
    ['2026-03-29T00:30:00Z', '29. mar. 2026'],
    ['2026-05-17T12:00:00Z', '17. mai 2026'],
    ['2026-10-11T13:36:34Z', '11. okt. 2026'],
  ])('%s → %s', (iso, shown) => {
    expect(formatReadDate(new Date(iso))).toBe(shown);
  });

  it('refuses an invalid date', () => {
    expect(() => formatReadDate(new Date('not a date'))).toThrow(TypeError);
  });
});

describe('formatKronerExact (Story 1.8): exact øre with a fraction, rounded once', () => {
  it.each([
    ['117000002.6', `1${NBSP}170${NBSP}000${NBSP}kr`],
    ['117000050', `1${NBSP}170${NBSP}001${NBSP}kr`],
    ['117000049.999', `1${NBSP}170${NBSP}000${NBSP}kr`],
    ['-250', `${MINUS}3${NBSP}kr`],
    ['-49.9', `0${NBSP}kr`],
    ['0', `0${NBSP}kr`],
  ])('%s øre', (ore, expected) => {
    expectBytes(formatKronerExact(ore), expected);
  });

  it('refuses a value that is not a plain decimal string', () => {
    expect(() => formatKronerExact('1e5')).toThrow(TypeError);
  });
});

describe('formatPercentNumber (Story 1.8): a range bound, no unit', () => {
  it.each([
    ['0.184', '18,4'],
    ['0.49', '49,0'],
    ['-0.063', `${MINUS}6,3`],
    ['-0.0004', '0,0'],
    ['0.00049', '0,0'],
    ['0.0005', '0,1'],
  ])('%s', (fraction, expected) => {
    expectBytes(formatPercentNumber(fraction), expected);
  });
});
