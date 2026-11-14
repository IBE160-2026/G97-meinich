// The peer-group changes as pure functions (Story 2.8): the state each
// change asks for, and the sentence that announces it, the singular form
// for one peer included.
import { describe, expect, it } from 'vitest';
import { announcement, exclusionCapReached, nextState, type PeerChange } from '../../src/analysis/peer-change.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };
import { MAX_EKSKL, defaultState, serialize, type AnalysisState } from '../../src/url/analysis-state.ts';

const fill = (id: keyof typeof nb, vars: Record<string, string> = {}) =>
  Object.entries(vars).reduce((text, [name, value]) => text.replace(`{${name}}`, value), nb[id]);

const base: AnalysisState = {
  ...defaultState('813235552'),
  fane: 'peers',
  ekskl: ['900000001'],
  band: 1,
  andel: 75,
  multippel: new Decimal('6.5'),
};

describe('nextState', () => {
  it('exclude adds the orgnr once', () => {
    expect(nextState(base, { kind: 'exclude', orgnr: '900000002', navn: 'B AS' }).ekskl).toEqual(['900000001', '900000002']);
    expect(nextState(base, { kind: 'exclude', orgnr: '900000001', navn: 'A AS' }).ekskl).toEqual(['900000001']);
  });

  it('restore removes the orgnr', () => {
    expect(nextState(base, { kind: 'restore', orgnr: '900000001', navn: 'A AS' }).ekskl).toEqual([]);
  });

  it('band sets the band and keeps the exclusions', () => {
    expect(nextState(base, { kind: 'band', band: 2 })).toMatchObject({ band: 2, ekskl: ['900000001'] });
  });

  it('reset clears the exclusions and the band, and keeps tab, share and multiple', () => {
    const reset = nextState(base, { kind: 'reset' });
    expect(reset).toMatchObject({ ekskl: [], band: 0, fane: 'peers', andel: 75 });
    expect(reset.multippel?.toString()).toBe('6.5');
    expect(serialize(reset)).toBe('/analyse/813235552/peers?andel=75&multippel=6.5');
  });
});

describe('announcement', () => {
  const at = (count: number) => ({ href: '/analyse/813235552/peers', count, bandLabel: '0,33–3×' });
  const cases: readonly [PeerChange, string, string][] = [
    [
      { kind: 'exclude', orgnr: '900000001', navn: 'A AS' },
      fill('peers.announce.excludedOne', { navn: 'A AS' }),
      fill('peers.announce.excluded', { navn: 'A AS', m: '2' }),
    ],
    [
      { kind: 'restore', orgnr: '900000001', navn: 'A AS' },
      fill('peers.announce.restoredOne', { navn: 'A AS' }),
      fill('peers.announce.restored', { navn: 'A AS', m: '2' }),
    ],
    [{ kind: 'band', band: 1 }, fill('peers.announce.bandOne', { b: '0,33–3×' }), fill('peers.announce.band', { b: '0,33–3×', n: '2' })],
    [{ kind: 'reset' }, nb['peers.announce.resetOne'], fill('peers.announce.reset', { n: '2' })],
  ];

  it.each(cases)('%o: the singular for one, the plural for two', (change, one, two) => {
    expect(announcement(change, at(1))).toBe(one);
    expect(announcement(change, at(2))).toBe(two);
    expect(one).toContain('1 sammenlignbart');
    expect(two).toContain('2 sammenlignbare');
  });
});

// Story 2.10 (FR-17): the cap is reached at MAX_EKSKL exclusions, and its
// text is the approved copy, verbatim.
describe('the exclusion cap', () => {
  const ekskl = (n: number) => Array.from({ length: n }, (_, i) => `9000000${String(i).padStart(2, '0')}`);

  it('is reached at 20 exclusions, not at 19', () => {
    expect(MAX_EKSKL).toBe(20);
    expect(exclusionCapReached({ ekskl: ekskl(19) })).toBe(false);
    expect(exclusionCapReached({ ekskl: ekskl(20) })).toBe(true);
  });

  it('says so in the approved words', () => {
    expect(nb['peers.exclusionCap']).toBe('Du kan ekskludere opptil 20 selskaper. Ta med et selskap igjen for å ekskludere et annet.');
  });
});
