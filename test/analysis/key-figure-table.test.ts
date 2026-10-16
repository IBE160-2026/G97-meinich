// The Nøkkeltall og gap table (Story 1.8), rendered on the server: every row
// of the spec's I/O matrix, the merged cell's `headers`, the decorative
// strip, egenkapitalandel's sr-only cells, the non-small notice, the phone
// table's expansion buttons, the scroll region and its edge fade.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DistributionStrip } from '../../src/components/analysis/distribution-strip.tsx';
import {
  KeyFigureTable,
  middleHalfText,
  showNonSmallNotice,
  stripMarks,
} from '../../src/components/analysis/key-figure-table.tsx';
import { benchmarkApiFigures, type ApiBenchmark } from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { compareFigure } from '../../src/engine/statistics.ts';
import type { ApiInputs, Comparison, FigureResult } from '../../src/engine/types.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };

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

function render(benchmark: ApiBenchmark, smaaForetak: boolean | null = true): string {
  return renderToString(createElement(KeyFigureTable, { benchmark, companyName: 'FJORDKODE AS', smaaForetak }));
}

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
    expect(html).toMatch(/data-testid="state-block"[^>]*>[\s\S]*Peerless sammenligner foreløpig bare små foretak/);
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
    const fig = (v: string): FigureResult => ({ kind: 'value', value: new Decimal(v), source: 'api', denominatorDerived: false });
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
