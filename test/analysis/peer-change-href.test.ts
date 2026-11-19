// The URL a peer-group change pushes (Story 3.5, decision 6; Epic 2 retro
// B6): the exclusions and the band from the base (the change in flight or
// the last good URL, which the server parsed), the share and the multiple
// from the live URL, each parsed with the server's median step.
import { describe, expect, it } from 'vitest';
import { peerChangeHref, type PeerChange } from '../../src/analysis/peer-change.ts';
import { isValidOrgnr } from '../../src/engine/orgnr.ts';

const SUBJECT = '813235552';
// Valid modulus-11 orgnrs.
const PEER = '910000004';
const DROPPED = '910000012';
const page = (query: string) => `/analyse/${SUBJECT}/peers${query === '' ? '' : `?${query}`}`;

const CHANGES: readonly [string, PeerChange][] = [
  ['exclude', { kind: 'exclude', orgnr: PEER, navn: 'A AS' }],
  ['band', { kind: 'band', band: 1 }],
];

describe('peerChangeHref', () => {
  it.each(CHANGES)('keeps andel=median: %s', (_label, change) => {
    // Fixture: the server kept andel=median (its median step exists) and the live URL shows it.
    const base = page('andel=median');
    const href = peerChangeHref({ base, live: base, medianStep: true, change });
    expect(href).not.toBeNull();
    expect(new URL(href ?? '', 'http://x').searchParams.get('andel')).toBe('median');
  });

  it('keeps andel=median across restore and reset', () => {
    const base = page(`ekskl=${PEER}&band=1&andel=median`);
    expect(peerChangeHref({ base, live: base, medianStep: true, change: { kind: 'restore', orgnr: PEER, navn: 'A AS' } })).toBe(
      page('band=1&andel=median'),
    );
    expect(peerChangeHref({ base, live: base, medianStep: true, change: { kind: 'reset' } })).toBe(page('andel=median'));
  });

  it('takes the share and the multiple from the live URL', () => {
    // Fixture: Verdi wrote andel=75 and the multiple with replaceState after the last commit.
    const href = peerChangeHref({
      base: page(''),
      live: page('andel=75&multippel=6.5'),
      medianStep: false,
      change: { kind: 'band', band: 2 },
    });
    expect(href).toBe(page('band=2&andel=75&multippel=6.5'));
    // A live andel=median the server has no step for is not kept.
    expect(peerChangeHref({ base: page(''), live: page('andel=median'), medianStep: false, change: { kind: 'band', band: 2 } })).toBe(
      page('band=2'),
    );
  });

  it('a rejected ekskl stays gone: the exclusions come from the base, never the live URL', () => {
    // Fixture: the browser still shows the link with DROPPED, which the server rejected; the last good URL has none.
    const live = page(`ekskl=${DROPPED}&andel=median`);
    const href = peerChangeHref({ base: page('andel=median'), live, medianStep: true, change: { kind: 'exclude', orgnr: PEER, navn: 'A AS' } });
    expect(href).toBe(page(`ekskl=${PEER}&andel=median`));
  });

  it('pushes nothing for a change that changes nothing, or an exclude at the cap', () => {
    expect(peerChangeHref({ base: page(''), live: page(''), medianStep: false, change: { kind: 'reset' } })).toBeNull();
    // Fixture: 20 valid exclusions, the cap.
    const twenty: string[] = [];
    for (let prefix = 92000000; twenty.length < 20; prefix += 1) {
      for (let digit = 0; digit <= 9; digit += 1) {
        if (isValidOrgnr(`${prefix}${digit}`)) twenty.push(`${prefix}${digit}`);
      }
    }
    expect(twenty).toHaveLength(20);
    const base = page(`ekskl=${twenty.join(',')}&andel=median`);
    expect(peerChangeHref({ base, live: base, medianStep: true, change: { kind: 'exclude', orgnr: PEER, navn: 'A AS' } })).toBeNull();
  });
});
