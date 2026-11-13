// The Peers tab's list (Stories 1.7, 2.7): the count, the funnel, the table
// and the phone cards, ✦ on exactly the two classification bases and the
// flag, the empty states, the scroll region, and no orgnr in the markup.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PeerDisplayRow } from '../../src/analysis/peer-rows.ts';
import { PHONE_CARDS, PeerList } from '../../src/components/analysis/peer-list.tsx';
import type { FunnelCounts } from '../../src/engine/peers.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const NBSP = ' ';
const GLYPH = '✦';

const row = (overrides: Partial<PeerDisplayRow> = {}): PeerDisplayRow => ({
  navn: 'STOR AS',
  omsetning: `23,5${NBSP}mill.${NBSP}kr`,
  driftsmargin: `4,2${NBSP}%`,
  hvorforMed: 'Samme bransje, omsetning 1,4× ADMMIT AS',
  grunnlag: nb['peers.basis.accounts_only'],
  grunnlagKi: false,
  flagg: null,
  ...overrides,
});

// The four bases, the first flagged.
const rows: PeerDisplayRow[] = [
  row({ navn: 'A AS', grunnlag: nb['peers.basis.description_and_accounts'], grunnlagKi: true, flagg: nb['peers.flag'] }),
  row({ navn: 'B AS', grunnlag: nb['peers.basis.description_and_accounts'], grunnlagKi: true }),
  row({ navn: 'C AS', grunnlag: nb['peers.basis.accounts_only'] }),
  row({ navn: 'D AS', grunnlag: nb['peers.basis.description_only'], grunnlagKi: true }),
  row({ navn: 'E AS', grunnlag: nb['peers.basis.industry_and_size_only'] }),
];

const counts: FunnelCounts = {
  stage1: 20,
  stage2: 15,
  stage3: { legalForm: 12 },
  stage4: { businessModel: 8 },
  stage5: { classification: 5, flagged: 1 },
};

function render(props: Partial<Parameters<typeof PeerList>[0]> = {}): string {
  return renderToString(createElement(PeerList, { rows, counts, emptyReason: null, filingYear: 2025, ...props }));
}

/** The desktop table's markup. */
const table = (html: string) => /<table[\s\S]*<\/table>/.exec(html)?.[0] ?? '';
/** The phone cards' markup. */
const cards = (html: string) => /data-testid="peer-cards"[\s\S]*$/.exec(html)?.[0] ?? '';
const cellsOf = (tr: string) => [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1] ?? '');
const bodyRows = (html: string) => [...table(html).matchAll(/<tbody>([\s\S]*)<\/tbody>/g)].flatMap((m) => [...(m[1] ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => r[1] ?? ''));
const text = (markup: string) => markup.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
const spokenKi = (markup: string) => markup.split(`<span class="sr-only">${nb['peers.ai']} </span>`).length - 1;
const glyphs = (markup: string) => markup.split(GLYPH).length - 1;

describe('PeerList', () => {
  it('shows the count and one table row per peer with the six columns', () => {
    const html = render();
    expect(html).toContain('5 sammenlignbare selskaper');
    expect(text(table(html).match(/<thead>[\s\S]*<\/thead>/)?.[0] ?? '')).toBe(
      [nb['peers.col.selskap'], nb['peers.col.omsetning'], nb['fig.driftsmargin'], nb['peers.col.reason'], nb['peers.col.basis'], nb['peers.col.flag']].join(''),
    );
    // The flag column's header is for screen readers only.
    expect(table(html)).toContain(`<span class="sr-only">${nb['peers.col.flag']}</span>`);
    const first = cellsOf(bodyRows(html)[0] ?? '').map(text);
    expect(first).toEqual([
      'A AS',
      `23,5${NBSP}mill.${NBSP}kr`,
      `4,2${NBSP}%`,
      'Samme bransje, omsetning 1,4× ADMMIT AS',
      `${GLYPH}${nb['peers.ai']} ${nb['peers.basis.description_and_accounts']}`,
      `${GLYPH}${nb['peers.ai']} ${nb['peers.flag']}`,
    ]);
    expect(bodyRows(html)).toHaveLength(5);
  });

  it('✦ on exactly the two classification bases and the flag', () => {
    const html = render();
    const [flagged, both, accounts, description, neither] = bodyRows(html).map(cellsOf);
    const basis = (cells: string[] | undefined) => cells?.[4] ?? '';
    const flag = (cells: string[] | undefined) => cells?.[5] ?? '';
    // One glyph and one "KI-generert" per marked cell.
    for (const cells of [flagged, both, description]) {
      expect(glyphs(basis(cells))).toBe(1);
      expect(spokenKi(basis(cells))).toBe(1);
    }
    expect(glyphs(flag(flagged))).toBe(1);
    expect(spokenKi(flag(flagged))).toBe(1);
    for (const cells of [accounts, neither]) {
      expect(glyphs(basis(cells))).toBe(0);
      expect(spokenKi(basis(cells))).toBe(0);
    }
    for (const cells of [both, accounts, description, neither]) expect(flag(cells)).toBe('');
    // Never on the name, a number or the reason, and always hidden from screen readers.
    for (const cells of [flagged, both, accounts, description, neither]) {
      for (const index of [0, 1, 2, 3]) expect(glyphs(cells?.[index] ?? '')).toBe(0);
    }
    expect(html.match(new RegExp(`<span[^>]*>${GLYPH}</span>`, 'g'))?.every((span) => span.includes('aria-hidden="true"'))).toBe(true);

    // Phone: basis and flag share a cell, so "KI-generert" is said once for both.
    const phone = cards(html);
    const shared = [...phone.matchAll(/<dd class="m-0 flex[^"]*">([\s\S]*?)<\/dd>/g)].map((m) => m[1] ?? '');
    expect(shared.map(glyphs)).toEqual([2, 1, 0, 1, 0]);
    expect(shared.map(spokenKi)).toEqual([1, 1, 0, 1, 0]);
  });

  it('carries the visible key "✦ KI-generert" in the caption', () => {
    const caption = /<caption[^>]*>([\s\S]*?)<\/caption>/.exec(render())?.[1] ?? '';
    expect(text(caption)).toBe(`${nb['peers.regionLabel']}. ${GLYPH}${nb['peers.ai']}`);
    expect(caption).not.toContain('class="sr-only">KI');
  });

  it('writes no ungrouped orgnr into the markup', () => {
    expect(render()).not.toMatch(/\d{9}/);
  });

  it('sits in a focusable, labelled scroll region', () => {
    expect(render()).toMatch(
      new RegExp(`<div role="region" tabindex="0" aria-label="${nb['peers.regionLabel']}" class="[^"]*scroll-region`),
    );
  });

  it(`shows ${PHONE_CARDS} cards on the phone, the rest behind "Vis alle {n}"`, () => {
    const many = Array.from({ length: 11 }, (_, i) => row({ navn: `P${i} AS` }));
    const phone = cards(render({ rows: many }));
    const lists = [...phone.matchAll(/<ul([^>]*)>([\s\S]*?)<\/ul>/g)];
    expect(lists).toHaveLength(2);
    expect(lists[0]?.[2]?.match(/data-testid="peer-card"/g)).toHaveLength(PHONE_CARDS);
    expect(lists[1]?.[1]).toContain('hidden');
    expect(lists[1]?.[2]?.match(/data-testid="peer-card"/g)).toHaveLength(3);
    expect(phone).toContain(`>${nb['peers.showAll'].replace('{n}', '11')}</button>`);
    expect(phone).toMatch(/<button type="button" aria-expanded="false" aria-controls="flere-sammenlignbare"/);
  });

  it('shows no "Vis alle" when every card fits', () => {
    expect(cards(render())).not.toContain('<button');
  });

  it('shows the funnel above the list', () => {
    const html = render();
    expect(html.indexOf('data-testid="peer-funnel"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="peer-funnel"')).toBeLessThan(html.indexOf('<table'));
  });

  it('shows "Fant ingen sammenlignbare selskaper." with the funnel and no table when the group is empty', () => {
    const html = render({ rows: [], counts: { ...counts, stage4: { businessModel: 0 }, stage5: { classification: 0, flagged: 0 } } });
    expect(html).toContain('0 sammenlignbare selskaper');
    expect(html).toContain(nb['peers.none']);
    expect(html).toContain('data-testid="peer-funnel"');
    expect(html).not.toContain('<table');
  });

  it('says "1 sammenlignbart selskap" for a group of one', () => {
    const html = render({ rows: rows.slice(0, 1) });
    expect(html).toContain(nb['peers.countOne']);
    expect(html).not.toContain('1 sammenlignbare');
  });

  it('a subject that cannot have peers shows its sentence and no funnel', () => {
    const zero: FunnelCounts = { stage1: 0, stage2: 0, stage3: { legalForm: 0 }, stage4: { businessModel: 0 }, stage5: { classification: 0, flagged: 0 } };
    const noRevenue = render({ rows: [], counts: zero, emptyReason: 'subject_no_revenue', filingYear: 2024 });
    expect(noRevenue).toContain(
      'Peerless finner sammenlignbare selskaper ut fra omsetning, og regnskapet for 2024 har ingen positiv omsetning å sammenligne med.',
    );
    const nonCalendar = render({ rows: [], counts: zero, emptyReason: 'subject_non_calendar' });
    expect(nonCalendar).toContain(nb['peers.nonCalendar']);
    for (const html of [noRevenue, nonCalendar]) {
      expect(html).not.toContain(nb['peers.none']);
      expect(html).not.toContain('data-testid="peer-funnel"');
      expect(html).not.toContain('<table');
    }
  });
});
