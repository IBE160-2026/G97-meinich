// The funnel (Story 2.7; FR-15, FR-9): in v1 (Story 5.2) stages 1–3 with
// their counts, the Segment criterion with its own count, bars proportional
// to stage 1 whatever the group's size, and the sentence that stages 4 and
// 5 are not applied. No stage 4 or 5, no flagged count, no ✦.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PeerFunnel, barWidth } from '../../src/components/analysis/peer-funnel.tsx';
import type { FunnelCounts } from '../../src/engine/peers.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const GLYPH = '✦';
const text = (markup: string) => markup.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');

// A group of 7: below the 10-peer floor.
const seven: FunnelCounts = {
  stage1: 40,
  stage2: 31,
  stage3: { legalForm: 27 },
  stage4: { businessModel: 9 },
  stage5: { classification: 7, flagged: 2 },
};

const render = (counts: FunnelCounts) => renderToString(createElement(PeerFunnel, { counts }));
const stagesOf = (html: string) => [...html.matchAll(/<li[^>]*data-testid="funnel-stage"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1] ?? '');

describe('PeerFunnel', () => {
  it('shows stages 1–3 in a three-column grid from md, with a group of 7', () => {
    const html = render(seven);
    const stages = stagesOf(html);
    expect(stages).toHaveLength(3);
    expect(html).toMatch(/<ol aria-labelledby="trakt-tittel" class="[^"]*md:grid md:grid-cols-3/);
    const names = [nb['peers.funnel.stage1'], nb['peers.funnel.stage2'], nb['peers.funnel.stage3']];
    const counts = ['40', '31', '27'];
    stages.forEach((stage, i) => {
      expect(text(stage)).toContain(names[i]);
      expect(/data-testid="funnel-count">(\d+)</.exec(stage)?.[1]).toBe(counts[i]);
      // An 8px navy-700 bar, n of stage 1, decorative.
      expect(stage).toContain(`style="width:calc(100% * ${counts[i]} / 40)"`);
      expect(stage).toMatch(/<div aria-hidden="true" class="[^"]*h-2[^"]*" data-testid="funnel-bar"><div class="h-2 bg-navy-700"/);
    });
    // Segment names its criterion, AS only, with its own count.
    expect(text(stages[2] ?? '')).toContain(nb['peers.funnel.segment.legalForm']);
    expect(/data-testid="funnel-criterion-count">(\d+)</.exec(stages[2] ?? '')?.[1]).toBe('27');
    // FR-9's words: v1 admits AS only.
    expect(text(stages[2] ?? '')).toContain(nb['peers.funnel.segment.note']);
    expect(nb['peers.funnel.segment.note']).toBe('Peerless sammenligner foreløpig bare aksjeselskaper.');
  });

  it('says under the stages that business model and classification are not applied, verbatim', () => {
    expect(nb['peers.funnel.notApplied']).toBe(
      'Forretningsmodell og klassifisering ble målt mot et fasitsett og ga ikke klart bedre treff, så de brukes ikke til å velge sammenlignbare selskaper i denne versjonen.',
    );
    const html = render(seven);
    const note = /data-testid="funnel-not-applied">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
    expect(text(note)).toBe(nb['peers.funnel.notApplied']);
    expect(html.indexOf('data-testid="funnel-not-applied"')).toBeGreaterThan(html.lastIndexOf('data-testid="funnel-stage"'));
  });

  it('shows no stage 4 or 5, no flagged count and no ✦', () => {
    const html = render(seven);
    // No stage is named after stages 4 or 5 (the note names them in a sentence).
    const names = stagesOf(html).map((stage) => /<span class="text-\[13px\] text-slate">([^<]*)<\/span>/.exec(stage)?.[1]);
    expect(names).toEqual([nb['peers.funnel.stage1'], nb['peers.funnel.stage2'], nb['peers.funnel.stage3']]);
    const outsideNote = html.replace(/<p[^>]*data-testid="funnel-not-applied"[\s\S]*?<\/p>/, '');
    expect(text(outsideNote)).not.toContain(nb['peers.funnel.stage4']);
    expect(text(outsideNote)).not.toContain(nb['peers.funnel.stage5']);
    expect(html).not.toContain('funnel-flagged');
    expect(text(html)).not.toContain(nb['peers.funnel.flagged'].replace('{n}', '2'));
    expect(html).not.toContain(GLYPH);
    expect(html).not.toContain(nb['peers.ai']);
  });

  it('is an ordered list named by its visible heading', () => {
    const html = render(seven);
    expect(html).toContain(`<h3 id="trakt-tittel" class="m-0 mb-2 text-base font-semibold">${nb['peers.funnel.heading']}</h3>`);
    expect(html).toMatch(/<ol aria-labelledby="trakt-tittel"/);
  });

  // Triage 9: the stages and the note follow the funnel's options, not a v1 literal.
  describe('follows the signals the funnel read', () => {
    const withOptions = (textSignal: boolean, fingerprintSignal: boolean) =>
      renderToString(createElement(PeerFunnel, { counts: seven, options: { textSignal, fingerprintSignal } }));
    const names = (html: string) =>
      stagesOf(html).map((stage) => /<span class="text-\[13px\] text-slate">([^<]*)<\/span>/.exec(stage)?.[1]);
    const base = [nb['peers.funnel.stage1'], nb['peers.funnel.stage2'], nb['peers.funnel.stage3']];

    it('both off (v1): stages 1–3 and the note', () => {
      const html = withOptions(false, false);
      expect(names(html)).toEqual(base);
      expect(html).toContain('data-testid="funnel-not-applied"');
      expect(render(seven)).toBe(html);
    });

    it('both on: five stages in five columns, and no note', () => {
      const html = withOptions(true, true);
      expect(names(html)).toEqual([...base, nb['peers.funnel.stage4'], nb['peers.funnel.stage5']]);
      expect(/data-testid="funnel-count">(\d+)</g.exec(stagesOf(html)[4] ?? '')?.[1]).toBe('7');
      expect(html).toMatch(/md:grid md:grid-cols-5/);
      expect(html).not.toContain('funnel-not-applied');
    });

    it('one on: its stage alone, four columns, and no note', () => {
      const fingerprintOnly = withOptions(false, true);
      expect(names(fingerprintOnly)).toEqual([...base, nb['peers.funnel.stage4']]);
      expect(fingerprintOnly).toMatch(/md:grid md:grid-cols-4/);
      expect(fingerprintOnly).not.toContain('funnel-not-applied');
      const textOnly = withOptions(true, false);
      expect(names(textOnly)).toEqual([...base, nb['peers.funnel.stage5']]);
      expect(textOnly).not.toContain('funnel-not-applied');
    });
  });

  it('draws no bar, and divides by nothing, when stage 1 is empty', () => {
    expect(barWidth(0, 0)).toBe('0%');
    expect(barWidth(7, 40)).toBe('calc(100% * 7 / 40)');
    const empty = render({ stage1: 0, stage2: 0, stage3: { legalForm: 0 }, stage4: { businessModel: 0 }, stage5: { classification: 0, flagged: 0 } });
    expect(empty.match(/style="width:0%"/g)).toHaveLength(3);
  });
});
