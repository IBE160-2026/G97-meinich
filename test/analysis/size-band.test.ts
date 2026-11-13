// The size-band control (Story 2.8; FR-18): the steps' labels and ranges
// from SIZE_BANDS around the subject's revenue, the too-small block's rule,
// and the radiogroup's markup with roving tabindex. The keyboard is tested
// in a real browser (e2e/peer-adjust.spec.ts).
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { bandFactors, bandSteps, groupTooSmall, widerBand } from '../../src/analysis/size-band.ts';
import { SizeBandControl } from '../../src/components/analysis/size-band.tsx';
import { formatBandFactor } from '../../src/engine/format.ts';
import { SIZE_BANDS } from '../../src/engine/peers.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };


describe('bandSteps', () => {
  it('labels the three steps from SIZE_BANDS, Standard first', () => {
    const steps = bandSteps(1_000_000_000n, 'NOK');
    expect(steps.map((step) => [step.band, step.factors, step.kind])).toEqual([
      [0, '0,5–2×', nb['peers.band.standard']],
      [1, '0,33–3×', nb['peers.band.widened']],
      [2, '0,25–4×', nb['peers.band.widened']],
    ]);
    for (const step of steps) {
      const { lo, hi } = SIZE_BANDS[step.band];
      expect(step.factors).toBe(`${formatBandFactor(lo.toString())}–${formatBandFactor(hi.toString())}×`);
    }
  });

  it('shows each step’s revenue range around the subject’s revenue, the unit once', () => {
    // 6,2 mill. kr: 0,5× = 3,1 and 2× = 12,4 (the checkpoint's example).
    expect(bandSteps(620_000_000n, 'NOK').map((step) => step.range)).toEqual([
      'Omsetning 3,1–12,4 mill. kr',
      'Omsetning 2,0–18,6 mill. kr',
      'Omsetning 1,6–24,8 mill. kr',
    ]);
    // Exact, then rounded once: 0,33 × 1 234 567 891 øre = 4,07… mill.
    expect(bandSteps(1_234_567_891n, 'NOK')[1]?.range).toBe('Omsetning 4,1–37,0 mill. kr');
  });

  it('shows no range without a positive NOK revenue', () => {
    for (const [revenue, valuta] of [
      [1_000_000_000n, 'USD'],
      [1_000_000_000n, null],
      [0n, 'NOK'],
      [null, 'NOK'],
    ] as const) {
      expect(bandSteps(revenue, valuta).map((step) => step.range)).toEqual([null, null, null]);
    }
  });

  it('widens one step at a time, nothing beyond 0,25–4×', () => {
    expect([widerBand(0), widerBand(1), widerBand(2)]).toEqual([1, 2, null]);
    expect(bandFactors(2)).toBe('0,25–4×');
  });
});

describe('groupTooSmall', () => {
  it('is null from 10 peers in the analysis', () => {
    expect(groupTooSmall(12, 10, 0)).toBeNull();
  });

  it('offers the next step below 10, except at the widest band', () => {
    expect(groupTooSmall(9, 9, 0)).toEqual({ text: nb['peers.tooSmall'].replace('{n}', '9'), widen: 1 });
    expect(groupTooSmall(9, 9, 1)).toEqual({ text: nb['peers.tooSmall'].replace('{n}', '9'), widen: 2 });
    expect(groupTooSmall(9, 9, 2)).toEqual({ text: nb['peers.tooSmallWidest'].replace('{n}', '9'), widen: null });
    expect(groupTooSmall(1, 1, 0)).toEqual({ text: nb['peers.tooSmallOne'], widen: 1 });
    expect(groupTooSmall(1, 1, 2)).toEqual({ text: nb['peers.tooSmallWidestOne'], widen: null });
  });

  it('an empty group: "Fant ingen …" alone; every peer excluded: its own sentence; neither offers widening', () => {
    expect(groupTooSmall(0, 0, 0)).toEqual({ text: nb['peers.none'], widen: null });
    expect(groupTooSmall(0, 0, 2)).toEqual({ text: nb['peers.none'], widen: null });
    expect(groupTooSmall(4, 0, 0)).toEqual({ text: nb['peers.allExcluded'], widen: null });
  });
});

describe('SizeBandControl', () => {
  const render = (band: 0 | 1 | 2) =>
    renderToString(
      createElement(SizeBandControl, {
        steps: bandSteps(620_000_000n, 'NOK'),
        band,
        label: nb['peers.band.label'],
        note: nb['peers.band.fixed'],
      }),
    );

  it('the size band is a radiogroup labelled "Størrelsesintervall" with the never-loosened sentence', () => {
    const html = render(0);
    expect(html).toMatch(/<p id="storrelsesintervall"[^>]*>Størrelsesintervall<\/p>/);
    expect(html).toMatch(/role="radiogroup" aria-labelledby="storrelsesintervall" aria-describedby="storrelsesintervall-merknad"/);
    expect(html).toContain(`>${nb['peers.band.fixed']}</p>`);
    // A three-column grid at every width.
    expect(html).toMatch(/class="grid w-full grid-cols-3/);
  });

  it.each([0, 1, 2] as const)('band %i: checked and in the tab order alone (roving tabindex)', (band) => {
    const radios = [...render(band).matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((m) => m[0]);
    expect(radios).toHaveLength(3);
    radios.forEach((radio, index) => {
      expect(radio).toContain(`data-band-step="${index}"`);
      expect(radio).toContain(`aria-checked="${index === band}"`);
      expect(radio).toContain(`tabindex="${index === band ? 0 : -1}"`);
    });
  });

  it('each step names its factors, Standard or Utvidet, and its range', () => {
    const texts = [...render(0).matchAll(/role="radio"[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
      (m[1] ?? '').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ''),
    );
    expect(texts[0]).toBe('0,5–2× /  StandardOmsetning 3,1–12,4 mill. kr');
    expect(texts[1]).toBe('0,33–3× /  UtvidetOmsetning 2,0–18,6 mill. kr');
  });
});
