// The Oversikt hero (Story 1.9), rendered on the server: every row of the
// spec's I/O matrix, the amount equal to the table's gap cell for the same
// benchmark, the link to the table keeping the query, the empty group's
// reason as on the Peers tab, and no red or green.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KeyFigureTable } from '../../src/components/analysis/key-figure-table.tsx';
import { OversiktHero } from '../../src/components/analysis/oversikt-hero.tsx';
import { PeerList } from '../../src/components/analysis/peer-list.tsx';
import { benchmarkApiFigures, type ApiBenchmark } from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import type { EmptyReason } from '../../src/engine/peers.ts';
import type { ApiInputs } from '../../src/engine/types.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };
import type { AnalysisState } from '../../src/url/analysis-state.ts';

const NBSP = ' ';
const MINUS = '−';

const NONE: ApiInputs = {
  sumDriftsinntekter: null,
  driftsresultat: null,
  sumDriftskostnad: null,
  sumEiendeler: null,
  sumEgenkapitalGjeld: null,
  sumEgenkapital: null,
  sumGjeld: null,
};

// EXPERIENCE.md's climax company: driftsresultat −613 386 kr on 12 518 082 kr (r ≈ −4,9 %).
const CLIMAX: ApiInputs = {
  ...NONE,
  sumDriftsinntekter: 1_251_808_200n,
  driftsresultat: -61_338_600n,
  sumEiendeler: 1_000_000_000n,
  sumEgenkapital: 400_000_000n,
};

function peer(margin: string): ApiInputs {
  return {
    ...NONE,
    sumDriftsinntekter: 100_000_000n,
    driftsresultat: BigInt(new Decimal(margin).mul(100_000_000).toFixed(0)),
    sumEiendeler: 200_000_000n,
    sumEgenkapital: 80_000_000n,
  };
}

// Median −3,2 %, beste fjerdedel (upper quartile) 9,1 %.
const PEERS = ['-0.1', '-0.09', '-0.08', '-0.07', '-0.032', '-0.032', '0.091', '0.091', '0.1', '0.2'].map(peer);

const STATE: AnalysisState = {
  orgnr: '912345678',
  fane: 'oversikt',
  ekskl: ['910000004'],
  band: 1,
  andel: 50,
  multippel: null,
};

function render(benchmark: ApiBenchmark, emptyReason: EmptyReason = null, state: AnalysisState = STATE): string {
  return renderToString(
    createElement(OversiktHero, { figure: benchmark.driftsmargin, state, emptyReason, filingYear: 2025 }),
  );
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    // Not \s: it would turn the formatter's U+00A0 into a space.
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();

/** An element's text by its data-testid; null when it is not rendered. */
function byTestId(html: string, id: string): string | null {
  const match = new RegExp(`<p[^>]*data-testid="${id}"[^>]*>([\\s\\S]*?)</p>`).exec(html);
  return match === null ? null : text(match[1] ?? '');
}

const amountOf = (inputs: ApiInputs, peers: readonly ApiInputs[] = PEERS, valuta: string | null = 'NOK') =>
  benchmarkApiFigures(inputs, peers, valuta);

describe('the hero with a gap', () => {
  const html = render(amountOf(CLIMAX));

  it('shows the kicker as an h3 labelling the section, the name and the direction tag', () => {
    expect(html).toMatch(/<section aria-labelledby="hero-kicker"/);
    expect(html).toMatch(new RegExp(`<h3 id="hero-kicker"[^>]*>${nb['hero.kicker']}</h3>`));
    expect(text(html)).toContain(`${nb['fig.driftsmargin']} ${nb['keyFigures.dir.higher']}`);
  });

  it('shows the full-convergence amount, "per år ved full tilnærming til beste fjerdedel" and own vs beste fjerdedel', () => {
    // (0,091 − (−613 386 / 12 518 082)) × 12 518 082 = 1 752 531,46 kr.
    expect(byTestId(html, 'hero-amount')).toBe(`1${NBSP}752${NBSP}531${NBSP}kr`);
    expect(text(html)).toContain(nb['hero.perYear']);
    expect(byTestId(html, 'hero-vs')).toBe(`${MINUS}4,9${NBSP}% mot 9,1${NBSP}% i beste fjerdedel`);
  });

  it('says "Under medianen" for a subject below it, with Plassering and 14,0 pp under beste fjerdedel', () => {
    // Worse: −0,1, −0,09, −0,08, −0,07 → 4 of 10.
    expect(byTestId(html, 'hero-context')).toBe(
      `Under medianen på ${MINUS}3,2${NBSP}% · bedre enn 40${NBSP}% · 14,0${NBSP}pp under beste fjerdedel`,
    );
    expect(html).not.toContain('Over medianen');
  });

  it('says "Over medianen" for a subject above it', () => {
    const above: ApiInputs = { ...CLIMAX, sumDriftsinntekter: 100_000_000n, driftsresultat: 2_100_000n };
    expect(byTestId(render(amountOf(above)), 'hero-context')).toBe(
      `Over medianen på ${MINUS}3,2${NBSP}% · bedre enn 60${NBSP}% · 7,0${NBSP}pp under beste fjerdedel`,
    );
  });

  it('shows the top note and the link to the table, keeping every setting', () => {
    expect(text(html)).toContain(nb['keyFigures.topNote']);
    expect(html).toContain(`href="/analyse/912345678/nokkeltall?ekskl=910000004&amp;band=1"`);
    expect(text(html)).toContain(nb['hero.link']);
    const bare = render(amountOf(CLIMAX), null, { ...STATE, ekskl: [], band: 0 });
    expect(bare).toContain('href="/analyse/912345678/nokkeltall"');
  });

  it('has no red, no green and no hex colour', () => {
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toMatch(/red|green/i);
  });
});

describe('the hero amount and the table', () => {
  const cell = (html: string) => {
    const row = /<tr[^>]*data-figure="driftsmargin"[^>]*>[\s\S]*?<\/tr>/.exec(html)?.[0] ?? '';
    const gap = /<td[^>]*data-cell="gap"[^>]*>\s*<span[^>]*>([^<]*)<\/span>/.exec(row)?.[1];
    if (gap === undefined) throw new Error('no gap cell');
    return gap;
  };

  it.each([
    ['the climax company', CLIMAX],
    ['EXPERIENCE.md’s reference company', { ...CLIMAX, sumDriftsinntekter: 1_671_428_600n, driftsresultat: 35_100_000n }],
    ['an amount that rounds half away from zero', { ...CLIMAX, sumDriftsinntekter: 100_000_000n, driftsresultat: 9_050_050n }],
  ])('are the same string for %s', (_label, inputs) => {
    const benchmark = amountOf(inputs);
    const table = renderToString(createElement(KeyFigureTable, { benchmark, companyName: 'X AS', smaaForetak: true }));
    const hero = byTestId(render(benchmark), 'hero-amount');
    expect(hero).not.toBeNull();
    expect(hero).toBe(cell(table));
  });
});

describe('the hero without an amount', () => {
  it('a strength: "▲ Styrke", own vs beste fjerdedel, "over beste fjerdedel", the no-gap sentence, no amount', () => {
    const above: ApiInputs = { ...CLIMAX, sumDriftsinntekter: 100_000_000n, driftsresultat: 15_000_000n };
    const html = render(amountOf(above));
    expect(byTestId(html, 'hero-strength')).toBe(nb['keyFigures.strength']);
    expect(byTestId(html, 'hero-vs')).toBe(`15,0${NBSP}% mot 9,1${NBSP}% i beste fjerdedel`);
    expect(byTestId(html, 'hero-context')).toBe(
      `Over medianen på ${MINUS}3,2${NBSP}% · bedre enn 90${NBSP}% · 5,9${NBSP}pp over beste fjerdedel`,
    );
    expect(text(html)).toContain(nb['hero.noGap']);
    expect(text(html)).toContain(nb['keyFigures.topNote']);
    expect(byTestId(html, 'hero-amount')).toBeNull();
    expect(html).not.toMatch(/\d kr/);
  });

  it('a strength at beste fjerdedel exactly: "på beste fjerdedel"', () => {
    const at: ApiInputs = { ...CLIMAX, sumDriftsinntekter: 100_000_000n, driftsresultat: 9_100_000n };
    const html = render(amountOf(at));
    expect(byTestId(html, 'hero-strength')).toBe(nb['keyFigures.strength']);
    expect(byTestId(html, 'hero-context')).toMatch(/· på beste fjerdedel$/);
  });

  it('below the floor: the own value and "For få sammenlignbare (9 av 10)"; no amount, vs, context or top note', () => {
    const html = render(amountOf(CLIMAX, PEERS.slice(0, 9)));
    expect(byTestId(html, 'hero-own')).toBe(`${MINUS}4,9${NBSP}%`);
    expect(text(html)).toContain('For få sammenlignbare (9 av 10)');
    for (const id of ['hero-amount', 'hero-vs', 'hero-context', 'hero-strength']) expect(byTestId(html, id), id).toBeNull();
    expect(text(html)).not.toContain(nb['keyFigures.topNote']);
    expect(html).not.toMatch(/\d kr/);
  });

  it('not in NOK: "Beløpet er ikke i kroner" with vs and context line, no amount', () => {
    const html = render(amountOf(CLIMAX, PEERS, 'USD'));
    expect(byTestId(html, 'hero-not-nok')).toBe(nb['keyFigures.notInKroner']);
    expect(byTestId(html, 'hero-vs')).not.toBeNull();
    expect(byTestId(html, 'hero-context')).toContain('Under medianen');
    expect(text(html)).toContain(nb['keyFigures.topNote']);
    expect(html).not.toMatch(/\d kr/);
  });

  it('an undefined own value: "Kan ikke beregnes: omsetningen er null eller negativ" and nothing else', () => {
    const html = render(amountOf({ ...CLIMAX, sumDriftsinntekter: 0n }));
    expect(byTestId(html, 'hero-own')).toBe('Kan ikke beregnes: omsetningen er null eller negativ');
    for (const id of ['hero-amount', 'hero-vs', 'hero-context', 'hero-strength', 'hero-not-nok']) {
      expect(byTestId(html, id), id).toBeNull();
    }
    expect(text(html)).not.toContain(nb['keyFigures.topNote']);
    expect(text(html)).not.toContain('For få');
  });
});

describe('an empty group with a reason, as on the Peers tab', () => {
  const peersSentence = (emptyReason: EmptyReason) =>
    text(renderToString(createElement(PeerList, { peers: [], valuta: 'NOK', emptyReason, filingYear: 2025 })));

  it('a non-calendar year: the own value and the Peers tab’s sentence, not "(0 av 10)"', () => {
    const html = render(amountOf(CLIMAX, []), 'subject_non_calendar');
    expect(byTestId(html, 'hero-own')).toBe(`${MINUS}4,9${NBSP}%`);
    expect(text(html)).toContain(nb['peers.nonCalendar']);
    expect(peersSentence('subject_non_calendar')).toContain(nb['peers.nonCalendar']);
    expect(text(html)).not.toContain('0 av 10');
    for (const id of ['hero-amount', 'hero-vs', 'hero-context']) expect(byTestId(html, id), id).toBeNull();
    expect(text(html)).not.toContain(nb['keyFigures.topNote']);
  });

  it('no revenue: "Kan ikke beregnes: …" and the Peers tab’s no-revenue sentence with the year', () => {
    const html = render(amountOf({ ...CLIMAX, sumDriftsinntekter: 0n }, []), 'subject_no_revenue');
    const sentence = nb['peers.noRevenue'].replace('{aar}', '2025');
    expect(byTestId(html, 'hero-own')).toBe('Kan ikke beregnes: omsetningen er null eller negativ');
    expect(text(html)).toContain(sentence);
    expect(peersSentence('subject_no_revenue')).toContain(sentence);
    expect(text(html)).not.toContain('0 av 10');
    expect(html).not.toMatch(/\d kr/);
  });
});
