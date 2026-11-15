// The Peers tab's list (Stories 1.7, 2.7, 2.8): the count, the funnel, the
// table and the phone cards (in v1, Story 5.2, no match basis, no flag and
// no ✦ key), the empty states, the scroll region, the orgnr only in the
// exclude action, the excluded rows, the too-small, all-excluded and
// widened blocks, the size-band control and reset.
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PeerDisplayRow } from '../../src/analysis/peer-rows.ts';
import { bandSteps } from '../../src/analysis/size-band.ts';
import { PHONE_CARDS, PeerList } from '../../src/components/analysis/peer-list.tsx';
import { PeerAction, PeerChangeLink } from '../../src/components/analysis/peer-action.tsx';
import { ShowAllToggle } from '../../src/components/analysis/show-all-toggle.tsx';
import { SizeBandControl } from '../../src/components/analysis/size-band.tsx';
import type { FunnelCounts } from '../../src/engine/peers.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };
import { defaultState, type AnalysisState } from '../../src/url/analysis-state.ts';

const NBSP = ' ';
const GLYPH = '✦';

const row = (overrides: Partial<PeerDisplayRow> = {}): PeerDisplayRow => ({
  orgnr: '900000001',
  excluded: false,
  navn: 'STOR AS',
  omsetning: `23,5${NBSP}mill.${NBSP}kr`,
  driftsmargin: `4,2${NBSP}%`,
  hvorforMed: 'Samme bransje, omsetning 1,4× ADMMIT AS',
  ...overrides,
});

const rows: PeerDisplayRow[] = ['A AS', 'B AS', 'C AS', 'D AS', 'E AS'].map((navn) => row({ navn }));

const counts: FunnelCounts = {
  stage1: 20,
  stage2: 15,
  stage3: { legalForm: 12 },
  stage4: { businessModel: 8 },
  stage5: { classification: 5, flagged: 1 },
};

const SUBJECT = '813235552';
type Props = Parameters<typeof PeerList>[0];

/** PeerList's props: the counts follow the rows unless given. */
function props(overrides: Partial<Props> = {}): Props {
  const shown = overrides.rows ?? rows;
  return {
    rows: shown,
    counts,
    emptyReason: null,
    filingYear: 2025,
    valuta: 'NOK',
    unstatedField: null,
    state: defaultState(SUBJECT),
    steps: bandSteps(1_000_000_000n, 'NOK'),
    analysisCount: shown.filter((r) => !r.excluded).length,
    excludedCount: shown.filter((r) => r.excluded).length,
    ...overrides,
  };
}

function render(overrides: Partial<Props> = {}): string {
  return renderToString(createElement(PeerList, props(overrides)));
}

const at = (state: Partial<AnalysisState>): AnalysisState => ({ ...defaultState(SUBJECT), fane: 'peers', ...state });
const ten = Array.from({ length: 10 }, (_, i) => row({ orgnr: `90000000${i}`, navn: `P${i} AS` }));

/** The desktop table's markup. */
const table = (html: string) => /<table[\s\S]*<\/table>/.exec(html)?.[0] ?? '';
/** The phone cards' markup. */
const cards = (html: string) => /data-testid="peer-cards"[\s\S]*$/.exec(html)?.[0] ?? '';
const cellsOf = (tr: string) => [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1] ?? '');
const bodyRows = (html: string) => [...table(html).matchAll(/<tbody>([\s\S]*)<\/tbody>/g)].flatMap((m) => [...(m[1] ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => r[1] ?? ''));
const text = (markup: string) => markup.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');
const spokenKi = (markup: string) => markup.split(`<span class="sr-only">${nb['peers.ai']} </span>`).length - 1;
const glyphs = (markup: string) => markup.split(GLYPH).length - 1;

/** The 'use client' components the list renders, which findElement does not call. */
const CLIENT_COMPONENTS: ReadonlySet<unknown> = new Set([PeerAction, PeerChangeLink, SizeBandControl, ShowAllToggle]);

/** The first element of `type` in the tree, calling the function components on the way (server components are pure). */
function findElement<P>(node: ReactNode, type: (props: P) => ReactNode): ReactElement<P> | undefined {
  if (Array.isArray(node)) {
    for (const child of node as ReactNode[]) {
      const found = findElement(child, type);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === type) return node as ReactElement<P>;
  if (typeof element.type === 'function') {
    // A client component calls hooks, which need a renderer, and holds no list part: skipped by identity.
    if (CLIENT_COMPONENTS.has(element.type)) return undefined;
    return findElement((element.type as (props: unknown) => ReactNode)(element.props), type);
  }
  return findElement(element.props.children, type);
}

describe('PeerList', () => {
  it('shows the count and one table row per peer with the four columns and the action', () => {
    const html = render();
    expect(html).toContain('5 sammenlignbare selskaper');
    expect(text(table(html).match(/<thead>[\s\S]*<\/thead>/)?.[0] ?? '')).toBe(
      [
        nb['peers.col.selskap'],
        nb['peers.col.omsetning'],
        nb['fig.driftsmargin'],
        nb['peers.col.reason'],
        nb['peers.col.action'],
      ].join(''),
    );
    // The action column's header is for screen readers only.
    expect(table(html)).toContain(`<span class="sr-only">${nb['peers.col.action']}</span>`);
    const first = cellsOf(bodyRows(html)[0] ?? '').map(text);
    expect(first).toEqual([
      'A AS',
      `23,5${NBSP}mill.${NBSP}kr`,
      `4,2${NBSP}%`,
      'Samme bransje, omsetning 1,4× ADMMIT AS',
      nb['peers.action.exclude'],
    ]);
    expect(bodyRows(html)).toHaveLength(5);
  });

  // v1 (Story 5.2, Meinich 2026-11-15): no "Grunnlag for treff", no
  // "Merknad" and no ✦ "KI-generert" key, in the table or the cards.
  it('shows no match basis, no flag column and no ✦ anywhere in the table or the cards', () => {
    const html = render();
    for (const markup of [table(html), cards(html)]) {
      expect(markup).not.toContain(nb['peers.col.basis']);
      expect(markup).not.toContain(nb['peers.col.flag']);
      expect(markup).not.toContain(nb['peers.ai']);
      expect(markup).not.toContain(nb['peers.flag']);
      expect(glyphs(markup)).toBe(0);
      expect(spokenKi(markup)).toBe(0);
    }
    expect(glyphs(html)).toBe(0);
    for (const cells of bodyRows(html).map(cellsOf)) expect(cells).toHaveLength(5);
  });

  it('names the table for screen readers in its caption, with no visible key', () => {
    const caption = /<caption([^>]*)>([\s\S]*?)<\/caption>/.exec(render());
    expect(caption?.[1]).toBe(' class="sr-only"');
    expect(text(caption?.[2] ?? '')).toBe(nb['peers.regionLabel']);
  });

  // AD-4 as amended on 2026-11-13: a group member's orgnr reaches the page,
  // in its exclude action only.
  it('writes each peer’s orgnr only into its exclude actions', () => {
    const html = render({ rows: ten });
    const orgnrs = [...html.matchAll(/\d{9}/g)];
    const inActions = [...html.matchAll(/data-peer-action="(\d{9})"/g)];
    expect(orgnrs).toHaveLength(inActions.length);
    expect(new Set(inActions.map((m) => m[1]))).toEqual(new Set(ten.map((r) => r.orgnr)));
  });

  it('sits in a focusable, labelled scroll region', () => {
    expect(render()).toMatch(
      new RegExp(`<div role="region" tabindex="0" aria-label="${nb['peers.regionLabel']}" class="[^"]*scroll-region`),
    );
  });

  it(`shows ${PHONE_CARDS} cards on the phone, the rest sent as strings to "Vis alle {n}"`, () => {
    const many = Array.from({ length: 11 }, (_, i) => row({ navn: `P${i} AS` }));
    const phone = cards(render({ rows: many }));
    const lists = [...phone.matchAll(/<ul([^>]*)>([\s\S]*?)<\/ul>/g)];
    expect(lists).toHaveLength(2);
    expect(lists[0]?.[2]?.match(/data-testid="peer-card"/g)).toHaveLength(PHONE_CARDS);
    // The rest are not in the HTML: the toggle draws them when pressed.
    expect(lists[1]?.[1]).toContain('hidden');
    expect(lists[1]?.[2]).toBe('');
    expect(phone).not.toContain('P8 AS');
    expect(phone).toContain(`>${nb['peers.showAll'].replace('{n}', '11')}</button>`);
    expect(phone).toMatch(/<button type="button" aria-expanded="false" aria-controls="flere-sammenlignbare"/);
    // What the toggle receives: the remaining rows in order and the card labels, all strings.
    const toggle = findElement(createElement(PeerList, props({ rows: many })), ShowAllToggle);
    expect(toggle?.props.rows).toEqual(many.slice(PHONE_CARDS));
    expect(toggle?.props.label).toBe(nb['peers.showAll'].replace('{n}', '11'));
    expect(toggle?.props.labels).toEqual({
      omsetning: nb['peers.col.omsetning'],
      driftsmargin: nb['fig.driftsmargin'],
      reason: nb['peers.col.reason'],
      excluded: nb['peers.excluded'],
    });
    expect(toggle?.props.band).toBe(0);
    // Keyed by the band: a band change draws a closed toggle.
    expect(toggle?.key).toBe('0');
  });

  it('shows no "Vis alle" when every card fits', () => {
    expect(cards(render())).not.toContain('aria-controls="flere-sammenlignbare"');
  });

  it('shows the funnel above the list', () => {
    const html = render();
    expect(html.indexOf('data-testid="peer-funnel"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="peer-funnel"')).toBeLessThan(html.indexOf('<table'));
  });

  it('shows "Fant ingen sammenlignbare selskaper." above the funnel and no table when the group is empty', () => {
    const html = render({ rows: [], counts: { ...counts, stage4: { businessModel: 0 }, stage5: { classification: 0, flagged: 0 } } });
    expect(html).toContain('0 sammenlignbare selskaper');
    expect(html).toContain(nb['peers.none']);
    expect(html.indexOf(nb['peers.none'])).toBeLessThan(html.indexOf('data-testid="peer-funnel"'));
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

  // Story 2.10 (R2): no stated revenue has its own sentence, never "ingen positiv omsetning".
  it('a subject with no stated revenue shows its own sentence alone, never the no-revenue one', () => {
    const zero: FunnelCounts = { stage1: 0, stage2: 0, stage3: { legalForm: 0 }, stage4: { businessModel: 0 }, stage5: { classification: 0, flagged: 0 } };
    const html = render({ rows: [], counts: zero, emptyReason: 'subject_revenue_not_stated', filingYear: 2024 });
    expect(html).toContain('Peerless finner sammenlignbare selskaper ut fra omsetning, og regnskapet for 2024 oppgir ikke omsetningen.');
    expect(html).not.toContain(nb['peers.noRevenue'].replace('{aar}', '2024'));
    expect(html).not.toContain(nb['peers.none']);
    expect(html).not.toContain('data-testid="peer-funnel"');
  });

  // Story 2.10 (R3): a group stage 2 emptied for the subject's own fields
  // says why, with the funnel, never "Fant ingen …" alone.
  describe('stage 2 emptied by the subject: the sentence with the funnel', () => {
    const stage2Empty: FunnelCounts = { stage1: 7, stage2: 0, stage3: { legalForm: 0 }, stage4: { businessModel: 0 }, stage5: { classification: 0, flagged: 0 } };
    const empty = (overrides: Partial<Props>) => render({ rows: [], counts: stage2Empty, ...overrides });
    const withFunnel = (html: string, sentence: string) => {
      expect(html).toContain(sentence);
      expect(html).toContain('data-testid="peer-funnel"');
      expect(html.indexOf(sentence)).toBeLessThan(html.indexOf('data-testid="peer-funnel"'));
      expect(html).not.toContain(nb['peers.none']);
      expect(html).not.toContain('<table');
    };

    it.each([
      ['valuta', 'valuta'],
      ['regnskapsregler', 'regnskapsregler'],
      ['smaaForetak', 'om selskapet er et lite foretak'],
      ['avviklingsregnskap', 'om regnskapet er et avviklingsregnskap'],
    ] as const)('%s not stated: the sentence names it', (field, felt) => {
      const html = empty({ emptyReason: 'subject_field_not_stated', unstatedField: field, valuta: field === 'valuta' ? null : 'NOK' });
      withFunnel(html, `Regnskapet for 2025 oppgir ikke ${felt}, og Peerless sammenligner bare regnskap der dette er oppgitt.`);
    });

    it.each(['USD', 'EDT'])('a subject in %s: the sentence names the currency twice', (valuta) => {
      withFunnel(
        empty({ emptyReason: 'subject_currency', valuta }),
        `Regnskapet for 2025 er ført i ${valuta}, og ingen selskaper i samme næring og størrelse fører regnskap i ${valuta}.`,
      );
    });

    it('any other empty stage 2: the not-comparable sentence', () => {
      withFunnel(
        empty({ emptyReason: 'subject_not_comparable' }),
        'Ingen selskaper i samme næring og størrelse fører regnskapet etter de samme reglene som regnskapet for 2025.',
      );
    });

    // Review pass 1, row 2: "Utvid størrelsesintervallet" stays where a
    // wider band can help, and only when a wider step exists.
    const widenLink = (html: string) => html.includes(`>${nb['peers.tooSmallWiden']}</a>`);
    it.each([
      ['a known currency', { emptyReason: 'subject_currency', valuta: 'USD' }],
      ['not comparable', { emptyReason: 'subject_not_comparable' }],
    ] as const)('%s keeps the one-step widen action, except at the widest band', (_label, overrides) => {
      expect(widenLink(empty({ ...overrides }))).toBe(true);
      expect(empty({ ...overrides })).toContain('band=1');
      expect(widenLink(empty({ ...overrides, state: at({ band: 1 }) }))).toBe(true);
      expect(widenLink(empty({ ...overrides, state: at({ band: 2 }) }))).toBe(false);
    });

    it.each([
      ['an unstated field', { emptyReason: 'subject_field_not_stated', unstatedField: 'smaaForetak' }],
      ['an unknown currency', { emptyReason: 'subject_currency', valuta: 'EDT' }],
    ] as const)('%s offers no widen action', (_label, overrides) => {
      expect(widenLink(empty({ ...overrides }))).toBe(false);
    });

    it('refuses a reason without what its sentence names, rather than a sentence with a gap', () => {
      expect(() => empty({ emptyReason: 'subject_field_not_stated', unstatedField: null })).toThrow(/without an unstated field/);
      expect(() => empty({ emptyReason: 'subject_currency', valuta: null })).toThrow(/without a valuta/);
    });
  });

  // Story 2.10 (FR-17): at the cap every "Ekskluder" is aria-disabled,
  // still a focusable button, described by the cap text shown once.
  describe('the exclusion cap', () => {
    const peers = Array.from({ length: 22 }, (_, i) => row({ orgnr: `9000000${String(i).padStart(2, '0')}`, navn: `P${i} AS` }));
    const capped = (excludedCount: number) => {
      // The last ones excluded, so the first phone cards hold both actions.
      const ekskl = peers.slice(peers.length - excludedCount).map((peer) => peer.orgnr);
      const shownRows = peers.map((peer) => ({ ...peer, excluded: ekskl.includes(peer.orgnr) }));
      return { rows: shownRows, state: at({ ekskl }) };
    };
    const buttons = (markup: string) => [...markup.matchAll(/<button[^>]*data-peer-action[^>]*>/g)].map((m) => m[0]);

    it('with 20 exclusions: every "Ekskluder" aria-disabled and described by the cap text, shown once', () => {
      const html = render(capped(20));
      expect(html.split(`id="ekskluderingsgrense"`)).toHaveLength(2);
      expect(html).toContain(`<p id="ekskluderingsgrense" class="m-0 mt-3 text-[13px] text-slate" data-testid="exclusion-cap">${nb['peers.exclusionCap']}</p>`);
      for (const markup of [table(html), cards(html)]) {
        const all = buttons(markup);
        const exclude = all.filter((b) => b.includes(`aria-label="${nb['peers.action.excludeName'].split(' ')[0]} `));
        const restore = all.filter((b) => b.includes(`aria-label="${nb['peers.action.restoreName'].replace(' {navn}', '')} `));
        expect(exclude.length).toBeGreaterThan(0);
        expect(restore.length).toBeGreaterThan(0);
        for (const b of exclude) {
          expect(b).toContain('aria-disabled="true"');
          expect(b).toContain('aria-describedby="ekskluderingsgrense"');
          // aria-disabled, never disabled: it stays in the tab order.
          expect(b).not.toMatch(/\sdisabled[\s=>]/);
          expect(b).not.toContain('tabindex="-1"');
        }
        for (const b of restore) {
          expect(b).not.toContain('aria-disabled="');
          expect(b).not.toContain('aria-describedby');
        }
      }
      const toggle = findElement(createElement(PeerList, props(capped(20))), ShowAllToggle);
      expect(toggle?.props.capReached).toBe(true);
    });

    it('with 19 exclusions: no button aria-disabled and no cap text', () => {
      const html = render(capped(19));
      expect(html).not.toContain('aria-disabled="');
      expect(html).not.toContain('ekskluderingsgrense');
      expect(html).not.toContain(nb['peers.exclusionCap']);
      expect(findElement(createElement(PeerList, props(capped(19))), ShowAllToggle)?.props.capReached).toBe(false);
    });
  });

  // Story 2.8 (FR-17): an excluded peer stays in the list.
  it('draws an excluded row struck through, tagged "Ekskludert", with "Ta med igjen {Navn}"', () => {
    const shown = [row({ orgnr: '900000001', navn: 'A AS' }), row({ orgnr: '900000002', navn: 'B AS', excluded: true })];
    const html = render({ rows: shown });
    const [kept, excluded] = bodyRows(html);
    expect(kept).toContain(`aria-label="${nb['peers.action.excludeName'].replace('{navn}', 'A AS')}"`);
    expect(text(cellsOf(kept ?? '')[4] ?? '')).toBe(nb['peers.action.exclude']);
    expect(text(cellsOf(excluded ?? '')[0] ?? '')).toBe(`B AS ${nb['peers.excluded']}`);
    expect(cellsOf(excluded ?? '')[0]).toContain('<span class="line-through">B AS</span>');
    expect(excluded).toContain(`aria-label="${nb['peers.action.restoreName'].replace('{navn}', 'B AS')}"`);
    expect(text(cellsOf(excluded ?? '')[4] ?? '')).toBe(nb['peers.action.restore']);
    expect(html).toMatch(/<tr data-excluded="true" class="text-slate">/);
    // The phone card too.
    expect(cards(html)).toMatch(/<li data-testid="peer-card" data-excluded="true" class="text-slate">/);
    // The count is the peers in the analysis.
    expect(html).toContain(nb['peers.countOne']);
  });

  it('too-small block at each band', () => {
    const five = ten.slice(0, 5);
    const blockOf = (html: string) => /<div[^>]*data-testid="too-small-block"[\s\S]*?<\/div><\/div>/.exec(html)?.[0] ?? '';
    // Standard and 0,33–3×: the sentence and "Utvid størrelsesintervallet", one step wider.
    for (const [band, wider] of [
      [0, 1],
      [1, 2],
    ] as const) {
      const html = render({ rows: five, state: at({ band }) });
      const block = blockOf(html);
      expect(text(block)).toBe(`${nb['peers.tooSmall'].replace('{n}', '5')}${nb['peers.tooSmallWiden']}`);
      expect(block).toContain(`href="/analyse/${SUBJECT}/peers?band=${wider}"`);
      // Above the funnel.
      expect(html.indexOf('data-testid="too-small-block"')).toBeLessThan(html.indexOf('data-testid="peer-funnel"'));
    }
    // The widest band: no action, "… også med det videste intervallet".
    const widest = blockOf(render({ rows: five, state: at({ band: 2 }) }));
    expect(text(widest)).toBe(nb['peers.tooSmallWidest'].replace('{n}', '5'));
    expect(widest).not.toContain('<a ');
    // One peer: the singular.
    expect(text(blockOf(render({ rows: five.slice(0, 1) })))).toContain(nb['peers.tooSmallOne']);
    // Zero: "Fant ingen sammenlignbare selskaper." alone, at any band.
    for (const band of [0, 2] as const) {
      const empty = blockOf(render({ rows: [], state: at({ band }) }));
      expect(text(empty)).toBe(nb['peers.none']);
      expect(empty).not.toContain('<a ');
    }
    // Ten: no block.
    expect(render({ rows: ten })).not.toContain('data-testid="too-small-block"');
  });

  it('a group excluded entirely', () => {
    const all = ten.slice(0, 3).map((r) => ({ ...r, excluded: true }));
    const ekskl = all.map((r) => r.orgnr);
    const html = render({ rows: all, state: at({ ekskl }) });
    expect(html).toContain(nb['peers.allExcluded']);
    expect(html).not.toContain(nb['peers.none']);
    expect(html).not.toContain(nb['peers.tooSmallWiden']);
    expect(text(/data-testid="funnel-excluded"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '')).toBe(
      nb['peers.funnel.excluded'].replace('{n}', '3').replace('{m}', '0'),
    );
    // Every row is still listed, to be restored.
    expect(bodyRows(html)).toHaveLength(3);
    expect(html).toContain('0 sammenlignbare selskaper');
  });

  it('shows "{n} ekskludert av deg → {m} i analysen" only with exclusions', () => {
    const shown = ten.map((r, i) => ({ ...r, excluded: i < 2 }));
    expect(text(/data-testid="funnel-excluded"[^>]*>([\s\S]*?)<\/p>/.exec(render({ rows: shown }))?.[1] ?? '')).toBe(
      nb['peers.funnel.excluded'].replace('{n}', '2').replace('{m}', '8'),
    );
    expect(render({ rows: ten })).not.toContain('data-testid="funnel-excluded"');
  });

  it('widened: the State block with "Tilbake til standard (0,5–2×)", and no block at Standard', () => {
    const html = render({ rows: ten, state: at({ band: 1, ekskl: ['900000003'] }) });
    const block = /<div[^>]*data-testid="widened-block"[\s\S]*?<\/div><\/div>/.exec(html)?.[0] ?? '';
    expect(text(block)).toBe(
      `${nb['peers.widened.body'].replace('{b}', '0,33–3×')}${nb['peers.widened.back'].replace('{b}', '0,5–2×')}`,
    );
    // The link keeps the exclusions and returns the band to Standard.
    expect(block).toContain(`href="/analyse/${SUBJECT}/peers?ekskl=900000003"`);
    expect(render({ rows: ten })).not.toContain('data-testid="widened-block"');
  });

  it('"Tilbakestill til standard" only when the group is not the standard one, to the URL without ekskl or band', () => {
    const reset = (html: string) => /<a href="([^"]*)"[^>]*>Tilbakestill til standard<\/a>/.exec(html)?.[1];
    expect(reset(render({ rows: ten }))).toBeUndefined();
    expect(reset(render({ rows: ten, state: at({ ekskl: ['900000003'] }) }))).toBe(`/analyse/${SUBJECT}/peers`);
    expect(reset(render({ rows: ten, state: at({ band: 2 }) }))).toBe(`/analyse/${SUBJECT}/peers`);
    expect(nb['peers.reset']).toBe('Tilbakestill til standard');
  });

  it('the size band: a labelled radiogroup with the never-loosened sentence, and no other loosening control', () => {
    const html = render({ rows: ten, state: at({ band: 1 }) });
    expect(html).toMatch(/role="radiogroup" aria-labelledby="storrelsesintervall"/);
    expect(html).toContain(nb['peers.band.fixed']);
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    // No control names a comparability field, legal form, industry or geography.
    const controls = [...html.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2] ?? '')).join(' | ');
    expect(controls).not.toMatch(/valuta|regnskapsregler|småforetak|avvikling|periode|regnskapstype|selskapsform|bransje|kommune|geografi/i);
  });
});
