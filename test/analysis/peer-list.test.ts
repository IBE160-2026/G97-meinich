// The Peers tab's list (Story 1.7): the count, one row per peer with name,
// revenue and municipality, the fallbacks, the empty states, the scroll
// region, and no orgnr in the markup.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PeerList, type PeerRow } from '../../src/components/analysis/peer-list.tsx';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const NBSP = ' ';

const peers: PeerRow[] = [
  { orgnr: '900000001', navn: 'STOR AS', kommune: 'AURSKOG-HØLAND', sumDriftsinntekter: 2_345_000_000n },
  { orgnr: '900000002', navn: null, kommune: null, sumDriftsinntekter: 1_000_000_000n },
];

function render(props: Partial<Parameters<typeof PeerList>[0]> = {}): string {
  return renderToString(createElement(PeerList, { peers, valuta: 'NOK', emptyReason: null, filingYear: 2025, ...props }));
}

const cells = (html: string) => [...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((match) => match[1]);

describe('PeerList', () => {
  it('shows the count and one row per peer: name, revenue in millions, municipality', () => {
    const html = render();
    expect(html).toContain('2 sammenlignbare selskaper');
    expect(cells(html)).toEqual([
      'STOR AS',
      `23,5${NBSP}mill.${NBSP}kr`,
      'Aurskog-Høland',
      `900${NBSP}000${NBSP}002`,
      `10,0${NBSP}mill.${NBSP}kr`,
      nb['peers.unknownKommune'],
    ]);
  });

  it('writes no ungrouped orgnr into the markup', () => {
    expect(render()).not.toMatch(/9000000\d\d/);
  });

  it('reads "Ikke i kroner" for revenue when the group is not in NOK', () => {
    const html = render({ valuta: 'USD' });
    expect(cells(html).filter((cell) => cell === nb['peers.otherCurrency'])).toHaveLength(2);
    expect(html).not.toMatch(/\bkr\b/);
  });

  it('sits in a focusable, labelled scroll region', () => {
    expect(render()).toMatch(
      new RegExp(`<div role="region" tabindex="0" aria-label="${nb['peers.regionLabel']}" class="[^"]*scroll-region`),
    );
  });

  it('shows "Fant ingen sammenlignbare selskaper." and no table when the group is empty', () => {
    const html = render({ peers: [] });
    expect(html).toContain('0 sammenlignbare selskaper');
    expect(html).toContain(nb['peers.none']);
    expect(html).not.toContain('<table');
  });

  it('says "1 sammenlignbart selskap" for a group of one', () => {
    const html = render({ peers: peers.slice(0, 1) });
    expect(html).toContain(nb['peers.countOne']);
    expect(html).not.toContain('1 sammenlignbare');
  });

  it('names the table with a visually hidden caption', () => {
    expect(render()).toContain(`<caption class="sr-only">${nb['peers.regionLabel']}</caption>`);
  });

  it('says why, with the year, when the subject has no positive revenue', () => {
    const html = render({ peers: [], emptyReason: 'subject_no_revenue', filingYear: 2024 });
    expect(html).toContain(
      'Peerless finner sammenlignbare selskaper ut fra omsetning, og regnskapet for 2024 har ingen positiv omsetning å sammenligne med.',
    );
    expect(html).not.toContain(nb['peers.none']);
    expect(html).not.toContain('<table');
  });

  it('says why when the subject’s own year is not a calendar year', () => {
    const html = render({ peers: [], emptyReason: 'subject_non_calendar' });
    expect(html).toContain(nb['peers.nonCalendar']);
    expect(html).not.toContain(nb['peers.none']);
  });
});
