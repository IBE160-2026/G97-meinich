// How covered industries are written in copy (src/messages/industry.ts): the
// code alone when the register gives no name, and the list joined in bokmål.
import { describe, expect, it } from 'vitest';
import { industryAtSentenceStart, industryInSentence, industryNamed, joinList } from '../src/messages/industry.ts';

const named = { code: '62.100', beskrivelse: 'Dataprogrammeringstjenester' };
const unnamed = { code: '62.100', beskrivelse: null };

describe('industryNamed', () => {
  it('writes code then name', () => {
    expect(industryNamed(named)).toBe('62.100 Dataprogrammeringstjenester');
  });

  it('writes the code alone when the name is NULL', () => {
    expect(industryNamed(unnamed)).toBe('62.100');
  });
});

describe('industryInSentence', () => {
  it('writes the name, first letter lower-cased, then the code in brackets', () => {
    expect(industryInSentence(named)).toBe('dataprogrammeringstjenester (62.100)');
  });

  it('writes the code alone when the name is NULL', () => {
    expect(industryInSentence(unnamed)).toBe('62.100');
  });
});

describe('industryAtSentenceStart', () => {
  it('writes the name as the register gives it, capital kept, then the code in brackets', () => {
    expect(industryAtSentenceStart(named)).toBe('Dataprogrammeringstjenester (62.100)');
  });

  it('differs from the mid-sentence form only in the first letter', () => {
    const atStart = industryAtSentenceStart(named);
    const inSentence = industryInSentence(named);
    expect(atStart).not.toBe(inSentence);
    expect(atStart.slice(1)).toBe(inSentence.slice(1));
    expect(atStart[0]).toBe(inSentence[0]?.toUpperCase());
  });

  it('writes the code alone when the name is NULL', () => {
    expect(industryAtSentenceStart(unnamed)).toBe('62.100');
  });
});

describe('joinList', () => {
  it.each([
    [[], ''],
    [['a'], 'a'],
    [['a', 'b'], 'a og b'],
    [['a', 'b', 'c'], 'a, b og c'],
  ])('%j → %s', (items, joined) => {
    expect(joinList(items)).toBe(joined);
  });
});
