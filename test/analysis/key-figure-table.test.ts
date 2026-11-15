// The Nøkkeltall og gap table (Stories 1.8, 3.1b), rendered on the server:
// every row of the specs' I/O matrices, the merged cell's `headers`, the
// decorative strip, the sr-only cells of rows with no direction, the
// non-small notice, the phone table's expansion buttons, the scroll region
// and its edge fade; and, since Story 3.1b, every key figure's row in
// `docs/key-figures.md` order, the cost-share row group, the check row, the
// capital kroner, each absence's words and the outside-the-demo-data state.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DistributionStrip } from '../../src/components/analysis/distribution-strip.tsx';
import { keyFigureTableView, middleHalfText, stripMarks } from '../../src/analysis/key-figure-rows.ts';
import { KeyFigureTable } from '../../src/components/analysis/key-figure-table.tsx';
import {
  benchmarkApiFigures,
  benchmarkDocumentFigures,
  type ApiBenchmark,
  type DocumentBenchmark,
} from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { compareFigure } from '../../src/engine/statistics.ts';
import type { ApiInputs, Comparison, FigureResult } from '../../src/engine/types.ts';
import type { DocumentBasis } from '../../src/engine/document-inputs.ts';
import { formatKronerExact } from '../../src/engine/format.ts';
import { t } from '../../src/messages/index.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };
import { daysBasis, FAILED, NOT_IN_DATASET, readBasis, TEN_PEERS } from './document-fixture.ts';

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

// EXPERIENCE.md's reference company: 351 000 kr on 16 714 286 kr, assets 10 000 000 kr, equity 40 %.
const SUBJECT: ApiInputs = {
  ...NONE,
  sumDriftsinntekter: 1_671_428_600n,
  driftsresultat: 35_100_000n,
  sumEiendeler: 1_000_000_000n,
  sumEgenkapital: 400_000_000n,
};

function peer(margin: string, ek: string): ApiInputs {
  return {
    ...NONE,
    sumDriftsinntekter: 100_000_000n,
    driftsresultat: BigInt(new Decimal(margin).mul(100_000_000).toFixed(0)),
    sumEiendeler: 200_000_000n,
    sumEgenkapital: BigInt(new Decimal(ek).mul(200_000_000).toFixed(0)),
  };
}

// Upper quartile of driftsmargin exactly 0,091.
const MARGINS = ['0.01', '0.02', '0.03', '0.04', '0.05', '0.06', '0.091', '0.091', '0.091', '0.2'];
const EK = ['0.1', '0.2', '0.3', '0.35', '0.4', '0.45', '0.5', '0.55', '0.6', '0.7'];
const TEN = MARGINS.map((m, i) => peer(m, EK[i] ?? '0.4'));

/** The document figures of a subject outside the demo data: every document row is absent. */
const OUTSIDE: DocumentBenchmark = benchmarkDocumentFigures({ kind: 'not_in_dataset' }, [], 'NOK');

function render(benchmark: ApiBenchmark, smaaForetak: boolean | null = true, documentBenchmark: DocumentBenchmark = OUTSIDE): string {
  return renderToString(
    createElement(KeyFigureTable, { benchmark, documentBenchmark, companyName: 'FJORDKODE AS', smaaForetak, filingYear: 2025 }),
  );
}

const showNonSmallNotice = (benchmark: ApiBenchmark, smaaForetak: boolean | null) =>
  keyFigureTableView({ api: benchmark, document: OUTSIDE, filingYear: 2025, smaaForetak }).nonSmall;

const standard = () => benchmarkApiFigures(SUBJECT, TEN, 'NOK');

/** The desktop table, or the phone table. */
function table(html: string, layout: 'desktop' | 'phone'): string {
  const match = new RegExp(`<table[^>]*data-layout="${layout}"[^>]*>[\\s\\S]*?</table>`).exec(html);
  if (match === null) throw new Error(`no ${layout} table`);
  return match[0];
}

/** One desktop row by its figure. */
function row(html: string, figure: string): string {
  const match = new RegExp(`<tr[^>]*data-figure="${figure}"[^>]*>[\\s\\S]*?</tr>`).exec(table(html, 'desktop'));
  if (match === null) throw new Error(`no row for ${figure}`);
  return match[0];
}

/** A desktop cell's text content, tags stripped. */
function cellText(rowHtml: string, name: string): string {
  const match = new RegExp(`<td[^>]*data-cell="${name}"[^>]*>([\\s\\S]*?)</td>`).exec(rowHtml);
  if (match === null) throw new Error(`no ${name} cell`);
  return text(match[1] ?? '');
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    // Not \s: it would turn the formatter's U+00A0 into a space.
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();

/** The phone row (button row + expansion row) for a figure. */
function phoneRows(html: string, figure: string): { readonly row: string; readonly expansion: string } {
  const phone = table(html, 'phone');
  const expansion = new RegExp(`<tr id="kf-p-exp-${figure}"[^>]*>[\\s\\S]*?</tr>`).exec(phone)?.[0];
  const button = new RegExp(`<tr[^>]*>(?:(?!<tr).)*?aria-controls="kf-p-exp-${figure}"[\\s\\S]*?</tr>`, 's').exec(phone)?.[0];
  if (expansion === undefined || button === undefined) throw new Error(`no phone rows for ${figure}`);
  return { row: button, expansion };
}

describe('the driftsmargin kroner cell', () => {
  it('shows "1 170 000 kr" per år from the exact revenue, on desktop and in the phone row and expansion', () => {
    const html = render(standard());
    const amount = `1${NBSP}170${NBSP}000${NBSP}kr`;
    expect(cellText(row(html, 'driftsmargin'), 'gap')).toBe(`${amount} ${nb['keyFigures.perYear']}`);
    const phone = phoneRows(html, 'driftsmargin');
    expect(text(phone.row)).toContain(amount);
    expect(text(phone.expansion)).toContain(amount);
    // The amount from a revenue rounded to 16,7 mill. kr is not shown.
    expect(html).not.toContain(`1${NBSP}169${NBSP}000`);
  });

  it('shows "▲ Styrke" and no amount at beste fjerdedel exactly', () => {
    const atTarget: ApiInputs = { ...SUBJECT, sumDriftsinntekter: 100_000_000n, driftsresultat: 9_100_000n };
    const html = render(benchmarkApiFigures(atTarget, TEN, 'NOK'));
    expect(cellText(row(html, 'driftsmargin'), 'gap')).toBe(nb['keyFigures.strength']);
    expect(html).not.toMatch(/\d kr/);
  });

  it('above beste fjerdedel too', () => {
    const above: ApiInputs = { ...SUBJECT, sumDriftsinntekter: 100_000_000n, driftsresultat: 30_000_000n };
    expect(cellText(row(render(benchmarkApiFigures(above, TEN, 'NOK')), 'driftsmargin'), 'gap')).toBe(
      nb['keyFigures.strength'],
    );
  });

  it('reads "Beløpet er ikke i kroner" for a subject not in NOK, desktop and phone expansion, with no amount', () => {
    const html = render(benchmarkApiFigures(SUBJECT, TEN, 'USD'));
    expect(cellText(row(html, 'driftsmargin'), 'gap')).toBe(nb['keyFigures.notInKroner']);
    expect(text(phoneRows(html, 'driftsmargin').expansion)).toContain(nb['keyFigures.notInKroner']);
    expect(html).not.toMatch(/\d kr/);
  });
});

describe('the rows', () => {
  it('show own, median, beste fjerdedel, Plassering in whole percent and the subline', () => {
    const r = row(render(standard()), 'driftsmargin');
    expect(cellText(r, 'own')).toBe(`2,1${NBSP}%`);
    // Median of the ten margins: (0,05 + 0,06) / 2.
    expect(cellText(r, 'median')).toBe(`5,5${NBSP}%`);
    expect(cellText(r, 'best')).toBe(`9,1${NBSP}%`);
    // Worse: 0,01 and 0,02 → 2 of 10 = 20 %.
    expect(cellText(r, 'placement')).toBe(`bedre enn 20${NBSP}%`);
    expect(text(r)).toContain(`${nb['keyFigures.dir.higher']} · 10 sammenlignbare brukt · 0 utelatt`);
    expect(cellText(r, 'distribution')).toBe(`midtre halvdel 3,3–9,1${NBSP}%`);
  });

  it('totalkapitalrentabilitet reads "Ingen kronebeløp", on desktop and in the phone expansion', () => {
    const html = render(standard());
    expect(cellText(row(html, 'totalkapitalrentabilitet'), 'gap')).toBe(nb['keyFigures.noKroner']);
    expect(text(phoneRows(html, 'totalkapitalrentabilitet').expansion)).toContain(nb['keyFigures.noKroner']);
    expect(text(phoneRows(html, 'totalkapitalrentabilitet').row)).toContain(nb['keyFigures.noKroner']);
  });

  it('egenkapitalandel: own, median, "Midtre halvdel: …", "Ingen retning", sr-only "ikke relevant – ingen retning" in the three inapplicable cells', () => {
    const r = row(render(standard()), 'egenkapitalandel');
    expect(cellText(r, 'own')).toBe(`40,0${NBSP}%`);
    expect(cellText(r, 'median')).toBe(`42,5${NBSP}%`);
    expect(text(r)).toMatch(new RegExp(`^${nb['fig.ek']} ${nb['keyFigures.dir.none']} · `));
    expect(cellText(r, 'distribution')).toMatch(/^Midtre halvdel: \d/);
    const sr = `<span class="sr-only">${nb['keyFigures.notApplicableNoDirection']}</span>`;
    for (const name of ['best', 'placement', 'gap']) {
      const cell = new RegExp(`<td[^>]*data-cell="${name}"[^>]*>([\\s\\S]*?)</td>`).exec(r)?.[1] ?? '';
      expect(cell, name).toContain(sr);
      expect(cell, name).toContain('<span aria-hidden="true">–</span>');
    }
    // Unmirrored with no "Bedre" label; no beste fjerdedel triangle.
    expect(r).not.toContain(nb['keyFigures.betterRight']);
    expect(r).not.toContain('data-mark="best"');
    expect(r).not.toMatch(/bedre enn/);
  });

  it('below the floor: the own value stays, one merged italic cell "For få sammenlignbare (9 av 10)" whose headers name the five columns', () => {
    const html = render(benchmarkApiFigures(SUBJECT, TEN.slice(0, 9), 'NOK'));
    const r = row(html, 'driftsmargin');
    expect(cellText(r, 'own')).toBe(`2,1${NBSP}%`);
    const merged = /<td([^>]*)data-cell="merged"[^>]*>([\s\S]*?)<\/td>/.exec(r);
    expect(merged).not.toBeNull();
    const attributes = merged?.[1] ?? '';
    expect(attributes).toContain('colSpan="5"');
    const headers = /headers="([^"]*)"/.exec(attributes)?.[1]?.split(' ') ?? [];
    for (const id of ['kf-d-col-median', 'kf-d-col-best', 'kf-d-col-placement', 'kf-d-col-distribution', 'kf-d-col-gap']) {
      expect(headers).toContain(id);
      expect(html).toContain(`id="${id}"`);
    }
    expect(r).toMatch(/class="[^"]*italic[^"]*" data-cell="merged"/);
    expect(text(merged?.[2] ?? '')).toBe('For få sammenlignbare (9 av 10)');
    expect(text(r)).toContain('9 sammenlignbare brukt · 0 utelatt');
    expect(r).not.toMatch(/\d kr/);
    const phone = phoneRows(html, 'driftsmargin');
    expect(text(phone.row)).toContain('For få (9 av 10)');
  });

  it('below the floor keeps "{k} utelatt" in the subline', () => {
    const noAssets = { ...peer('0.05', '0.4'), sumEiendeler: null };
    const html = render(benchmarkApiFigures(SUBJECT, [...TEN.slice(0, 9), noAssets], 'NOK'));
    expect(text(row(html, 'totalkapitalrentabilitet'))).toContain('9 sammenlignbare brukt · 1 utelatt');
    expect(cellText(row(html, 'totalkapitalrentabilitet'), 'merged')).toBe('For få sammenlignbare (9 av 10)');
  });

  it('an undefined own value reads "Kan ikke beregnes: omsetningen er null eller negativ", keeps the count, merges the comparison cells empty', () => {
    const html = render(benchmarkApiFigures({ ...SUBJECT, sumDriftsinntekter: 0n }, TEN, 'NOK'));
    const r = row(html, 'driftsmargin');
    expect(cellText(r, 'own')).toBe('Kan ikke beregnes: omsetningen er null eller negativ');
    expect(text(r)).toContain('10 sammenlignbare brukt · 0 utelatt');
    const merged = /<td[^>]*data-cell="merged"[^>]*>([\s\S]*?)<\/td>/.exec(r)?.[1] ?? '';
    // A visible dash for sighted users, as on the phone, and the words for a screen reader.
    expect(merged).toBe(`<span aria-hidden="true">–</span><span class="sr-only">${nb['keyFigures.notApplicable']}</span>`);
    expect(text(phoneRows(html, 'driftsmargin').row)).toContain('Kan ikke beregnes');
  });

  it('a missing component reads "Kan ikke beregnes: en regnskapslinje mangler"', () => {
    const html = render(benchmarkApiFigures({ ...SUBJECT, driftsresultat: null }, TEN, 'NOK'));
    expect(cellText(row(html, 'driftsmargin'), 'own')).toBe('Kan ikke beregnes: en regnskapslinje mangler');
  });
});

describe('the midtre halvdel text', () => {
  it('reads "midtre halvdel 18,4–49,0 %", and "−6,3 til 9,1 %" when a bound is negative', () => {
    expect(middleHalfText('0.184', '0.49', false)).toBe(`midtre halvdel 18,4–49,0${NBSP}%`);
    expect(middleHalfText('-0.063', '0.091', false)).toBe(`midtre halvdel ${MINUS}6,3 til 9,1${NBSP}%`);
    expect(middleHalfText('-0.2', '-0.063', false)).toBe(`midtre halvdel ${MINUS}20,0 til ${MINUS}6,3${NBSP}%`);
  });

  it('is prefixed "Midtre halvdel:" for a figure with no direction', () => {
    expect(middleHalfText('0.184', '0.49', true)).toBe(`Midtre halvdel: 18,4–49,0${NBSP}%`);
    expect(middleHalfText('-0.063', '0.091', true)).toBe(`Midtre halvdel: ${MINUS}6,3 til 9,1${NBSP}%`);
  });
});

describe('the non-small notice', () => {
  const belowFloor = () => benchmarkApiFigures(SUBJECT, TEN.slice(0, 9), 'NOK');
  const count = (html: string) => html.split(nb['keyFigures.nonSmall']).length - 1;

  it('is shown once for a non-small subject with a figure below the floor', () => {
    expect(showNonSmallNotice(belowFloor(), false)).toBe(true);
    const html = render(belowFloor(), false);
    expect(count(html)).toBe(1);
    expect(html).toMatch(/data-testid="non-small-notice"[^>]*><div data-testid="state-block"[^>]*><p[^>]*>Peerless sammenligner foreløpig bare små foretak/);
  });

  it('is not shown for a small subject below the floor', () => {
    expect(count(render(belowFloor(), true))).toBe(0);
  });

  it('is not shown for a non-small subject whose comparisons all clear the floor', () => {
    expect(count(render(standard(), false))).toBe(0);
  });
});

describe('the distribution strip', () => {
  const strips = (html: string) => [...html.matchAll(/<div aria-hidden="true"[^>]*data-testid="distribution-strip"[^>]*>[\s\S]*?<\/svg>/g)].map((m) => m[0]);

  it('is aria-hidden, holds nothing focusable and no hex colour (no red, no green)', () => {
    const found = strips(render(standard()));
    expect(found).toHaveLength(3);
    for (const strip of found) {
      expect(strip).toContain('focusable="false"');
      expect(strip).not.toMatch(/tabindex|<a |<button|role=/i);
      expect(strip).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(strip).not.toMatch(/red|green/i);
    }
  });

  it('draws the company dot in signature with a 2px navy-900 outline, a median tick, a hollow triangle and the band', () => {
    const strip = strips(render(standard()))[0] ?? '';
    expect(strip).toMatch(/data-mark="own"[^>]*fill="var\(--color-signature\)" stroke="var\(--color-navy-900\)" stroke-width="2"/);
    expect(strip).toMatch(/data-mark="median"[^>]*stroke="var\(--color-median\)" stroke-width="2"/);
    expect(strip).toMatch(/data-mark="best"[^>]*fill="var\(--color-background\)" stroke="var\(--color-slate\)"/);
    expect(strip).toContain('fill="var(--color-band)"');
    expect(strip).toContain('fill="var(--color-divider)"');
  });

  it('mirrors a lower-is-better fixture: better to the right, with "Bedre →"', () => {
    const fig = (v: string): FigureResult => ({ kind: 'value', value: new Decimal(v), source: 'api', denominatorDerived: false, inputs: [] });
    const values = Array.from({ length: 10 }, (_, i) => fig(new Decimal(i + 1).div(100).toString()));
    const lowest = compareFigure(fig('0.001'), values, 'lower_is_better') as Extract<Comparison, { kind: 'compared' }>;
    const marks = stripMarks(lowest, 'lower_is_better');
    // The lowest value is the best, drawn at the right edge (and clipped below P5).
    expect(marks.own).toEqual({ at: 1, clipped: true });
    expect(marks.mirrored).toBe(true);
    // Beste fjerdedel (the lower quartile) is right of the median.
    expect(marks.best ?? 0).toBeGreaterThan(marks.median);
    const html = renderToString(createElement(DistributionStrip, { marks }));
    expect(html).toContain(nb['keyFigures.betterRight']);
    expect(html).toMatch(/data-mark="own" cx="146"/);

    const higher = compareFigure(fig('0.001'), values, 'higher_is_better') as Extract<Comparison, { kind: 'compared' }>;
    const unmirrored = stripMarks(higher, 'higher_is_better');
    expect(unmirrored.own.at).toBe(0);
    // Higher is better: beste fjerdedel (the upper quartile) is also right of the median, unmirrored.
    expect(unmirrored.best ?? 0).toBeGreaterThan(unmirrored.median);
    expect(unmirrored.mirrored).toBe(false);
    expect(renderToString(createElement(DistributionStrip, { marks: unmirrored }))).not.toContain(
      nb['keyFigures.betterRight'],
    );
  });

  it('draws an own value outside [P5, P95] at the edge with the out-of-range chevron', () => {
    const extreme: ApiInputs = { ...SUBJECT, sumDriftsinntekter: 100_000_000n, driftsresultat: 400_000_000n };
    const r = row(render(benchmarkApiFigures(extreme, TEN, 'NOK')), 'driftsmargin');
    expect(r).toContain('data-mark="clipped"');
    expect(r).toMatch(/data-mark="own" cx="146"/);
    expect(row(render(standard()), 'driftsmargin')).not.toContain('data-mark="clipped"');
  });

  it('points the chevron outwards: right of the dot at the right edge, left of it at the left edge', () => {
    const chevron = (html: string) => {
      const d = /data-mark="clipped" d="M([\d.]+) [\d.]+l(-?[\d.]+) /.exec(html);
      if (d === null) throw new Error('no chevron');
      return { start: Number(d[1]), step: Number(d[2]) };
    };
    const cx = (html: string) => Number(/data-mark="own" cx="([\d.]+)"/.exec(html)?.[1]);
    const strip = (at: number) =>
      renderToString(
        createElement(DistributionStrip, {
          marks: { own: { at, clipped: true }, median: 0.5, bandFrom: 0.4, bandTo: 0.6, best: 0.6, mirrored: false },
        }),
      );
    const right = strip(1);
    expect(chevron(right).start).toBeGreaterThan(cx(right));
    expect(chevron(right).step).toBeGreaterThan(0);
    const left = strip(0);
    expect(chevron(left).start).toBeLessThan(cx(left));
    expect(chevron(left).step).toBeLessThan(0);
  });
});

describe('the scroll region and the phone table', () => {
  it('puts the desktop table in a focusable, labelled region with the edge-fade class, shown from md', () => {
    const html = render(standard());
    expect(html).toMatch(
      new RegExp(`<div role="region" tabindex="0" aria-label="${nb['keyFigures.regionLabel']}" class="scroll-region[^"]*hidden md:block`),
    );
    expect(html).toContain(`<caption class="sr-only">${nb['keyFigures.caption']}</caption>`);
    expect(html).toContain(nb['keyFigures.topNote']);
    expect(html).toContain(`>${nb['keyFigures.col.distribution']}<`);
  });

  it('defines .scroll-region with overflow-x: auto, a focus style and a CSS-only edge fade', () => {
    const css = readFileSync(path.resolve(import.meta.dirname, '../../src/app/globals.css'), 'utf8');
    const rule = /\.scroll-region \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('overflow-x: auto');
    expect(rule).toMatch(/no-repeat local/);
    expect(rule).toMatch(/no-repeat scroll/);
    expect(css).toMatch(/\.scroll-region:focus-visible \{[^}]*outline: 2px solid/);
  });

  it('has a phone table, hidden from md, whose row names are buttons controlling hidden expansion rows', () => {
    const html = render(standard());
    const phone = table(html, 'phone');
    expect(phone).toMatch(/^<table class="[^"]*md:hidden/);
    const heads = [...phone.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual([nb['keyFigures.col.figure'], 'FJORDKODE AS', nb['keyFigures.col.gap']]);
    for (const figure of ['driftsmargin', 'totalkapitalrentabilitet', 'egenkapitalandel']) {
      expect(phone).toMatch(new RegExp(`<button type="button" aria-expanded="false" aria-controls="kf-p-exp-${figure}"`));
      expect(phone).toMatch(new RegExp(`<tr id="kf-p-exp-${figure}" hidden=""`));
      const { expansion } = phoneRows(html, figure);
      expect(text(expansion)).toContain(nb['keyFigures.col.direction']);
      expect(text(expansion)).toContain('10 sammenlignbare brukt');
    }
    const dm = text(phoneRows(html, 'driftsmargin').expansion);
    for (const part of [nb['keyFigures.col.median'], nb['keyFigures.col.best'], nb['keyFigures.col.placement'], 'midtre halvdel']) {
      expect(dm).toContain(part);
    }
  });

  it('writes every id once', () => {
    const ids = [...render(standard()).matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// Story 3.1b: every key figure, its row group and each state of a document row.
describe('the full key-figure table (Story 3.1b)', () => {
  // Receivable and payable days 50 and turnover 5 against the fixture's ten
  // peers: worse than beste fjerdedel on 9 (T 32,5), 10 (T 77,5) and 11 (T 19).
  const SUBJECT_DOC = daysBasis(50n, 5n);
  const documents = (subject: DocumentBasis = SUBJECT_DOC, peers: readonly DocumentBasis[] = TEN_PEERS, valuta = 'NOK') =>
    benchmarkDocumentFigures(subject, peers, valuta);
  const full = (subject: DocumentBasis = SUBJECT_DOC, peers: readonly DocumentBasis[] = TEN_PEERS, valuta = 'NOK') =>
    render(benchmarkApiFigures(SUBJECT, TEN, valuta), true, documents(subject, peers, valuta));
  const ORDER = [
    'driftsmargin',
    'ebitda',
    'vare',
    'lonn',
    'andre',
    'total',
    'omsArsverk',
    'lonnArsverk',
    'kfd',
    'lgd',
    'oml',
    'totalkapitalrentabilitet',
    'egenkapitalandel',
    'kontant',
    'vekst',
  ];
  const LABELS = [
    'fig.driftsmargin',
    'fig.ebitda',
    'fig.vare',
    'fig.lonn',
    'fig.andre',
    'fig.total',
    'fig.omsArsverk',
    'fig.lonnArsverk',
    'fig.kfd',
    'fig.lgd',
    'fig.oml',
    'fig.tkr',
    'fig.ek',
    'fig.kontant',
    'fig.vekst',
  ] as const;
  const API_ROWS = ['driftsmargin', 'totalkapitalrentabilitet', 'egenkapitalandel'];
  // The document rows that take the basis's reason: 7 and 8 are not read in v1 on every basis.
  const BASIS_ROWS = ORDER.filter((key) => !API_ROWS.includes(key) && key !== 'omsArsverk' && key !== 'lonnArsverk');
  const rawCell = (rowHtml: string, name: string) =>
    new RegExp(`<td[^>]*data-cell="${name}"[^>]*>([\\s\\S]*?)</td>`).exec(rowHtml)?.[1] ?? '';
  const NOT_APPLICABLE = `<span aria-hidden="true">–</span><span class="sr-only">${nb['keyFigures.notApplicable']}</span>`;
  const NO_DIRECTION = `<span aria-hidden="true">–</span><span class="sr-only">${nb['keyFigures.notApplicableNoDirection']}</span>`;

  it('every key figure has a row, in key-figures order', () => {
    const html = full();
    const desktop = [...table(html, 'desktop').matchAll(/<tr[^>]*data-figure="([^"]+)"/g)].map((m) => m[1]);
    expect(desktop).toEqual(ORDER);
    const phone = [...table(html, 'phone').matchAll(/aria-controls="kf-p-exp-([^"]+)"/g)].map((m) => m[1]);
    expect(phone).toEqual(ORDER);
    const labels = [...table(html, 'desktop').matchAll(/<th scope="row"[^>]*><span class="block font-semibold">([^<]*)</g)].map(
      (m) => m[1],
    );
    expect(labels).toEqual(LABELS.map((id) => nb[id]));
    // One tbody per group of docs/key-figures.md, separated by a rule.
    for (const layout of ['desktop', 'phone'] as const) {
      const groups = [...table(html, layout).matchAll(/<tbody data-group="([^"]+)"( class="[^"]*")?/g)];
      expect(groups.map((m) => m[1])).toEqual(['margin', 'cost', 'productivity', 'workingCapital', 'capital', 'context']);
      expect(groups.slice(1).every((m) => (m[2] ?? '').includes('border-t-2'))).toBe(true);
    }
    // Decision 8: no sort control and no aria-sort.
    expect(html).not.toContain('aria-sort');
    expect(/<thead>[\s\S]*?<\/thead>/.exec(table(html, 'desktop'))?.[0]).not.toContain('<button');
  });

  it('cost shares sit in their own row group and point to the margin explanation', () => {
    const html = full();
    for (const layout of ['desktop', 'phone'] as const) {
      const group = /<tbody data-group="cost"[^>]*>([\s\S]*?)<\/tbody>/.exec(table(html, layout))?.[1] ?? '';
      // The group's first row is its rowgroup heading, the only one in the table.
      expect(group).toMatch(new RegExp(`^<tr[^>]*><th scope="rowgroup"[^>]*>${nb['keyFigures.costShare.group']}</th></tr>`));
      expect(table(html, layout).match(/scope="rowgroup"/g)).toHaveLength(1);
      for (const key of ['vare', 'lonn', 'andre', 'total']) {
        expect(group, `${layout} ${key}`).toMatch(new RegExp(`(data-figure="${key}"|aria-controls="kf-p-exp-${key}")`));
      }
    }
    for (const key of ['vare', 'lonn', 'andre']) {
      const r = row(html, key);
      // Indented: 30 px on the desktop, 16 px (pl-4) on the phone (decision 7).
      expect(r).toMatch(/<th scope="row"[^>]*class="[^"]*pl-\[30px\]/);
      expect(phoneRows(html, key).row).toMatch(/<th scope="row" class="[^"]*pl-4/);
      expect(cellText(r, 'gap')).toBe(nb['keyFigures.costShare.kroner']);
      expect(text(phoneRows(html, key).row)).toContain(nb['keyFigures.costShare.kroner']);
      // Not a link until Story 3.3.
      expect(rawCell(r, 'gap')).not.toMatch(/<a /);
      expect(text(r)).not.toMatch(/\d kr/);
    }
    // The rows outside the group are not indented.
    expect(row(html, 'driftsmargin')).not.toContain('pl-[30px]');
    expect(phoneRows(html, 'ebitda').row).not.toMatch(/<th scope="row" class="[^"]*pl-4/);
  });

  it('total cost share is a check row', () => {
    const html = full();
    const r = row(html, 'total');
    // (16 500 000 + 600 000 000 + 20 000 000) / 1 000 000 000 = 63,65 %, for every company.
    expect(cellText(r, 'own')).toBe(`63,7${NBSP}%`);
    expect(cellText(r, 'median')).toBe(`63,7${NBSP}%`);
    expect(cellText(r, 'distribution')).toBe(`Midtre halvdel: 63,7–63,7${NBSP}%`);
    // Its subline names the check, not a direction.
    expect(text(r)).toContain(`${nb['keyFigures.checkRow']} · 10 sammenlignbare brukt · 0 utelatt`);
    expect(text(r)).not.toContain(nb['keyFigures.dir.none']);
    for (const name of ['best', 'placement', 'gap']) expect(rawCell(r, name), name).toBe(NOT_APPLICABLE);
    // Unmirrored, no beste fjerdedel triangle, no "Bedre".
    expect(r).toContain('data-mark="own"');
    expect(r).not.toContain('data-mark="best"');
    expect(r).not.toContain(nb['keyFigures.betterRight']);
    expect(text(phoneRows(html, 'total').expansion)).toContain(nb['keyFigures.checkRow']);
  });

  it('no-direction rows: median and midtre halvdel only', () => {
    const html = full();
    for (const key of ['egenkapitalandel', 'kontant']) {
      const r = row(html, key);
      expect(cellText(r, 'median'), key).toMatch(new RegExp(`${NBSP}%$`));
      expect(cellText(r, 'distribution'), key).toMatch(/^Midtre halvdel: /);
      expect(text(r), key).toContain(`${nb['keyFigures.dir.none']} · `);
      for (const name of ['best', 'placement', 'gap']) expect(rawCell(r, name), `${key} ${name}`).toBe(NO_DIRECTION);
      expect(r, key).not.toMatch(/bedre enn|\d kr/);
      expect(r, key).not.toContain('data-mark="best"');
    }
    // Growth (14) from a reconciled prior column: 1 000 000 000 / 800 000 000 − 1 = 25,0 %.
    const growth = readBasis({}, { sumDriftsinntekter: '800000000' });
    const peers = TEN_PEERS.map((_, i) => readBasis({}, { sumDriftsinntekter: String(800_000_000 + i * 10_000_000) }));
    const g = row(full(growth, peers), 'vekst');
    expect(cellText(g, 'own')).toBe(`25,0${NBSP}%`);
    expect(cellText(g, 'distribution')).toMatch(/^Midtre halvdel: /);
    expect(text(g)).toContain(`${nb['keyFigures.dir.none']} · 10 sammenlignbare brukt`);
    for (const name of ['best', 'placement', 'gap']) expect(rawCell(g, name), name).toBe(NO_DIRECTION);
    // Personnel cost per årsverk (8) has no direction either; it is not read in v1.
    expect(cellText(row(html, 'lonnArsverk'), 'own')).toContain(nb['analysis.figures.notReadInV1']);
  });

  it('kontantandel is a diagnostic row', () => {
    const html = full();
    const r = row(html, 'kontant');
    // Bank 1 000 000 kr of 3 000 000 kr in assets.
    expect(cellText(r, 'own')).toBe(`33,3${NBSP}%`);
    expect(r).not.toMatch(/bedre enn|aria-sort|<button/);
    expect(text(r)).not.toMatch(/kr\b/);
    const phone = phoneRows(html, 'kontant');
    expect(text(phone.row)).not.toMatch(/kr\b/);
    expect(text(phone.expansion)).not.toMatch(/bedre enn|kr\b/);
  });

  it('capital kroner: one rounding, engangsbeløp', () => {
    // 9: kundefordringer 4 250 050 øre against T × salgsinntekt / 365 =
    // 3 250 000 øre: 1 000 050 øre = 10 000,50 kr, rounded once to 10 001 kr.
    // Rounding the days first (42,5005 → 43) would give 10 500 kr.
    const subject = daysBasis(50n, 5n, { kundefordringer: '4250050' });
    const b = documents(subject);
    const html = full(subject);
    const amount = (key: 'kfd' | 'lgd' | 'oml') => {
      const gap = b[key].gap;
      if (gap.kind !== 'amount') throw new Error(`${key} has no amount`);
      return formatKronerExact(gap.ore.toString());
    };
    expect(amount('kfd')).toBe(`10${NBSP}001${NBSP}kr`);
    // 10: T × 365 000 kr / 365 − leverandorgjeld = 77 500 − 50 000 kr.
    expect(amount('lgd')).toBe(`27${NBSP}500${NBSP}kr`);
    // 11: 2 000 000 kr − 10 000 000 kr / 19 = 1 473 684,21… kr.
    expect(amount('oml')).toBe(`1${NBSP}473${NBSP}684${NBSP}kr`);
    for (const key of ['kfd', 'lgd', 'oml'] as const) {
      expect(cellText(row(html, key), 'gap'), key).toBe(`${amount(key)} ${nb['keyFigures.oneOff']}`);
      expect(text(phoneRows(html, key).row), key).toContain(amount(key));
      expect(text(phoneRows(html, key).expansion), key).toContain(`${amount(key)} ${nb['keyFigures.oneOff']}`);
      expect(cellText(row(html, key), 'gap'), key).not.toContain(nb['keyFigures.perYear']);
    }
    // Days whole, turnover two decimals, each rounded once.
    expect(cellText(row(html, 'kfd'), 'own')).toBe(`43${NBSP}dager`);
    expect(cellText(row(html, 'kfd'), 'best')).toBe(`33${NBSP}dager`);
    expect(cellText(row(html, 'kfd'), 'distribution')).toBe(`${nb['keyFigures.betterRight']} midtre halvdel 33–78${NBSP}dager`);
    expect(cellText(row(html, 'oml'), 'own')).toBe('5,00');
    expect(cellText(row(html, 'oml'), 'distribution')).toBe('midtre halvdel 4,25–19,00');
  });

  it('at or beyond beste fjerdedel: strength, no amount', () => {
    // 100 days and turnover 40: 9 is worse, 10 and 11 at or beyond T.
    const html = full(daysBasis(100n, 40n));
    expect(cellText(row(html, 'lgd'), 'gap')).toBe(nb['keyFigures.strength']);
    expect(cellText(row(html, 'oml'), 'gap')).toBe(nb['keyFigures.strength']);
    expect(cellText(row(html, 'kfd'), 'gap')).toMatch(new RegExp(`\\d${NBSP}kr ${nb['keyFigures.oneOff']}$`));
    // Exactly at T: receivable days 32,5.
    const at = full(daysBasis(50n, 5n, { kundefordringer: '3250000' }));
    expect(cellText(row(at, 'kfd'), 'gap')).toBe(nb['keyFigures.strength']);
    expect(rawCell(row(at, 'kfd'), 'gap')).not.toMatch(/\dkr/);
  });

  it('capital kroner absent with its reason', () => {
    const usd = full(SUBJECT_DOC, TEN_PEERS, 'USD');
    for (const key of ['kfd', 'lgd', 'oml']) expect(cellText(row(usd, key), 'gap'), key).toBe(nb['keyFigures.notInKroner']);
    expect(table(usd, 'desktop')).not.toMatch(new RegExp(`\\d${NBSP}kr`));
    // T = 0 on 11: ten peers with no revenue (turnover 0), and a subject whose negative revenue is worse.
    const zero = TEN_PEERS.map(() => readBasis({ sumDriftsinntekter: '0', driftsresultat: '-656500000' }));
    const subject = readBasis({ sumDriftsinntekter: '-100000000', driftsresultat: '-756500000' });
    expect(documents(subject, zero).oml.gap).toEqual({ kind: 'none', reason: 'target_not_positive' });
    expect(cellText(row(full(subject, zero), 'oml'), 'gap')).toBe(nb['keyFigures.targetNotPositive']);
  });

  it('no kroner translation: Ingen kronebeløp', () => {
    const html = full();
    for (const key of ['ebitda', 'totalkapitalrentabilitet']) {
      expect(cellText(row(html, key), 'gap'), key).toBe(nb['keyFigures.noKroner']);
      expect(text(phoneRows(html, key).row), key).toContain(nb['keyFigures.noKroner']);
    }
  });

  it('below the floor: no comparison, counts kept', () => {
    const html = full(SUBJECT_DOC, TEN_PEERS.slice(0, 9));
    for (const key of ['ebitda', 'vare', 'total', 'kfd', 'lgd', 'oml', 'kontant']) {
      const r = row(html, key);
      expect(cellText(r, 'merged'), key).toBe('For få sammenlignbare (9 av 10)');
      expect(text(r), key).toContain('9 sammenlignbare brukt · 0 utelatt');
      expect(r, key).not.toMatch(new RegExp(`\\d${NBSP}kr`));
      expect(text(phoneRows(html, key).row), key).toContain('For få (9 av 10)');
    }
    // The own value stays.
    expect(cellText(row(html, 'kfd'), 'own')).toBe(`50${NBSP}dager`);
  });

  it('each undefined reason has its words', () => {
    const because = (id: Parameters<typeof t>[0]) => t('analysis.figures.undefined', { grunn: t(id) });
    const own = (subject: DocumentBasis, key: string) => cellText(row(full(subject), key), 'own');
    // A zero or negative denominator, in each figure's own words.
    expect(own(readBasis({ salgsinntekt: '0' }), 'kfd')).toBe(because('analysis.figures.reason.salesNotPositive'));
    expect(
      own(readBasis({ varekostnad: '0', annenDriftskostnad: '0', sumDriftskostnad: '620000000', driftsresultat: '380000000' }), 'lgd'),
    ).toBe(because('analysis.figures.reason.costsNotPositive'));
    expect(own(readBasis({ sumEiendeler: '100000000' }), 'oml')).toBe(because('analysis.figures.reason.operatingAssetsNotPositive'));
    expect(own(readBasis({}, { sumDriftsinntekter: '0' }), 'vekst')).toBe(because('analysis.figures.reason.priorRevenueNotPositive'));
    expect(own(readBasis({ sumDriftsinntekter: '0', driftsresultat: '-656500000' }), 'ebitda')).toBe(
      because('analysis.figures.reason.revenueNotPositive'),
    );
    expect(own(readBasis({ sumEiendeler: '0', bankinnskudd: '0' }), 'kontant')).toBe(because('analysis.figures.reason.assetsNotPositive'));
    // A missing component, and a line not read safely (above the API subtotal, R3).
    expect(own(readBasis({ kundefordringer: null }), 'kfd')).toBe(because('analysis.figures.reason.componentMissing'));
    expect(own(readBasis({ kundefordringer: '900000000' }), 'kfd')).toBe(because('analysis.figures.reason.lineNotReadSafely'));
    // Every other document reason, from the subject's basis, on every row that takes it.
    const failed = t('analysis.documentFailed', { aar: '2025' });
    const bases: [DocumentBasis, string][] = [
      [{ kind: 'failed_reconciliation', filingYear: 2025 }, failed],
      [{ kind: 'not_reconciled', filingYear: 2025 }, failed],
      [{ kind: 'refused', filingYear: 2025 }, failed],
      [{ kind: 'document_missing', filingYear: 2025 }, t('analysis.figures.documentMissing', { aar: '2025' })],
      [
        { kind: 'not_read_in_v1', scope: 'paper', filingYear: 2025 },
        `${nb['analysis.figures.notReadInV1']} ${t('analysis.figures.notReadInV1.paper', { aar: '2025' })}`,
      ],
      [
        { kind: 'not_read_in_v1', scope: 'filing_year', filingYear: 2019 },
        `${nb['analysis.figures.notReadInV1']} ${t('analysis.figures.notReadInV1.filingYear', { fra: '2021', til: '2025', aar: '2025' })}`,
      ],
      [{ kind: 'not_in_dataset' }, `${nb['analysis.figures.notInDataset']} ⓘ ${nb['keyFigures.moreAbout']} ${nb['keyFigures.notInDataset.popover']}`],
    ];
    for (const [basis, words] of bases) {
      const html = full(basis);
      for (const key of BASIS_ROWS) {
        const r = row(html, key);
        expect(cellText(r, 'own'), `${basis.kind} ${key}`).toBe(words);
        expect(rawCell(r, 'merged'), `${basis.kind} ${key}`).toBe(NOT_APPLICABLE);
      }
      // The API rows keep their comparison (FR-71).
      expect(cellText(row(html, 'driftsmargin'), 'median'), basis.kind).toBe(`5,5${NBSP}%`);
    }
  });

  it('figures 7 and 8 are not read in v1', () => {
    for (const basis of [SUBJECT_DOC, NOT_IN_DATASET, FAILED]) {
      const html = full(basis);
      for (const key of ['omsArsverk', 'lonnArsverk']) {
        const r = row(html, key);
        expect(cellText(r, 'own'), key).toBe(`${nb['analysis.figures.notReadInV1']} ${nb['analysis.figures.notReadInV1.notes']}`);
        expect(rawCell(r, 'merged'), key).toBe(NOT_APPLICABLE);
        expect(r, key).not.toContain('aria-describedby');
        const phone = phoneRows(html, key);
        expect(text(phone.row), key).toContain(nb['analysis.figures.notReadInV1']);
        expect(text(phone.expansion), key).toContain(nb['analysis.figures.notReadInV1.notes']);
      }
    }
  });

  it('outside the demo data: one State block, cells point to it', () => {
    const html = full(NOT_IN_DATASET);
    // One State block, with the approved sentence, whose paragraph every such cell names.
    expect(html.split(nb['keyFigures.notInDataset.state']).length - 1).toBe(1);
    const id = /<p class="m-0" id="([^"]+)">Regnskapstallene for dette selskapet/.exec(html)?.[1];
    expect(id).toBe('kf-not-in-dataset');
    for (const key of BASIS_ROWS) {
      const own = /<td([^>]*)data-cell="own"([^>]*)>([\s\S]*?)<\/td>/.exec(row(html, key));
      expect(`${own?.[1]}${own?.[2]}`, key).toContain(`aria-describedby="${id}"`);
      const content = own?.[3] ?? '';
      // A real button with a visible ⓘ, closed, controlling the popover text.
      expect(content, key).toMatch(
        new RegExp(
          `<button type="button" aria-expanded="false" aria-controls="kf-d-pop-${key}"[^>]*><span aria-hidden="true">ⓘ</span><span class="sr-only">${nb['keyFigures.moreAbout']}</span></button>`,
        ),
      );
      expect(content, key).toMatch(new RegExp(`<span id="kf-d-pop-${key}" hidden=""[^>]*>${nb['keyFigures.notInDataset.popover']}</span>`));
      const phoneOwn = /<td[^>]*data-cell="own"[^>]*>[\s\S]*?<\/td>/.exec(phoneRows(html, key).row)?.[0] ?? '';
      expect(phoneOwn, key).toContain(`aria-describedby="${id}"`);
      expect(phoneOwn, key).toContain(`aria-controls="kf-p-pop-${key}"`);
    }
    // The API rows are compared and point nowhere.
    for (const key of API_ROWS) expect(row(html, key), key).not.toContain('aria-describedby');
    // A subject in the demo data has no such block.
    expect(full()).not.toContain(nb['keyFigures.notInDataset.state']);
  });
});
