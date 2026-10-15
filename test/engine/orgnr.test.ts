// FR-1 search-input rules (Story 1.5b): spaces stripped; digits only must be
// nine digits passing modulus 11 (weights 3,2,7,6,5,4,3,2); anything else is a
// name search.
import { describe, expect, it } from 'vitest';
import { classifySearchInput, isValidOrgnr } from '../../src/engine/orgnr.ts';

describe('isValidOrgnr', () => {
  it('accepts real organisation numbers from the demo seed', () => {
    // ADMMIT AS and EXEBENUS AS (src/demo-companies.ts).
    expect(isValidOrgnr('813235552')).toBe(true);
    expect(isValidOrgnr('814739082')).toBe(true);
  });

  it('accepts the unknown orgnr the end-to-end tests submit', () => {
    // 9·3+1·2 = 29, 29 mod 11 = 7, check digit 11 − 7 = 4. Not in the seed.
    expect(isValidOrgnr('910000004')).toBe(true);
  });

  it('accepts check digit 0 when the remainder is 0', () => {
    // 9·3+1·2+0+0+0+0+0+2·2 = 33, 33 mod 11 = 0.
    expect(isValidOrgnr('910000020')).toBe(true);
    expect(isValidOrgnr('910000021')).toBe(false);
  });

  it('rejects every number whose remainder is 1', () => {
    // 9·3+1·2+2·7+3·6+4·5+5·4+6·3+7·2 = 133, 133 mod 11 = 1: no check digit exists.
    for (const last of '0123456789') expect(isValidOrgnr(`91234567${last}`)).toBe(false);
  });

  it('rejects a mistyped digit', () => {
    expect(isValidOrgnr('813235553')).toBe(false);
    expect(isValidOrgnr('813253552')).toBe(false);
  });

  it('rejects anything that is not nine digits', () => {
    for (const value of ['', '81323555', '8132355520', '813 235 552', '81323555a']) {
      expect(isValidOrgnr(value), value).toBe(false);
    }
  });
});

describe('classifySearchInput', () => {
  it('reads a valid orgnr', () => {
    expect(classifySearchInput('813235552')).toEqual({ kind: 'orgnr', orgnr: '813235552' });
  });

  it('strips spaces, including the 3-3-3 form and a no-break space', () => {
    expect(classifySearchInput('813 235 552')).toEqual({ kind: 'orgnr', orgnr: '813235552' });
    expect(classifySearchInput(' 813 235 552 ')).toEqual({ kind: 'orgnr', orgnr: '813235552' });
    // U+00A0 written as an escape, so the no-break space is visible in the source.
    expect(classifySearchInput('813\u00a0235\u00a0552')).toEqual({ kind: 'orgnr', orgnr: '813235552' });
  });

  it('reports a mistyped orgnr as a checksum error', () => {
    expect(classifySearchInput('813235553')).toEqual({ kind: 'checksum' });
    expect(classifySearchInput('912 345 678')).toEqual({ kind: 'checksum' });
  });

  it('reports eight and ten digits as a length error', () => {
    expect(classifySearchInput('81323555')).toEqual({ kind: 'length' });
    expect(classifySearchInput('8132355520')).toEqual({ kind: 'length' });
    expect(classifySearchInput('813 235 55')).toEqual({ kind: 'length' });
  });

  it('treats a name containing digits as a name search', () => {
    expect(classifySearchInput('1881 Media')).toEqual({ kind: 'name', name: '1881 Media' });
    expect(classifySearchInput('81323555 AS')).toEqual({ kind: 'name', name: '81323555 AS' });
  });

  it('trims a name but keeps its inner spaces', () => {
    expect(classifySearchInput('  Ærlig  Søndre ')).toEqual({ kind: 'name', name: 'Ærlig  Søndre' });
  });

  it('reads empty and whitespace-only input as empty', () => {
    expect(classifySearchInput('')).toEqual({ kind: 'empty' });
    expect(classifySearchInput('   ')).toEqual({ kind: 'empty' });
  });
});
