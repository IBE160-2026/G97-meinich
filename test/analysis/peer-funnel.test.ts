// The funnel (Story 2.7; FR-15, FR-9, FR-14): five stages with their
// counts, the Segment criterion with its own count, the flagged count with
// ✦, and bars proportional to stage 1, whatever the group's size.
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
  it('shows all five stages and the flagged count with a group of 7', () => {
    const html = render(seven);
    const stages = stagesOf(html);
    expect(stages).toHaveLength(5);
    const names = [
      nb['peers.funnel.stage1'],
      nb['peers.funnel.stage2'],
      nb['peers.funnel.stage3'],
      nb['peers.funnel.stage4'],
      nb['peers.funnel.stage5'],
    ];
    const counts = ['40', '31', '27', '9', '7'];
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
    // The flagged count with ✦, said once as "KI-generert".
    const flagged = /data-testid="funnel-flagged">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
    expect(text(flagged)).toBe(`${GLYPH}${nb['peers.ai']} ${nb['peers.funnel.flagged'].replace('{n}', '2')}`);
    expect(flagged).toContain(`<span aria-hidden="true" class="mr-1 text-slate" data-testid="ai-mark">${GLYPH}</span>`);
  });

  it('puts ✦ on no stage name and no count', () => {
    for (const stage of stagesOf(render(seven))) expect(stage).not.toContain(GLYPH);
  });

  it('is an ordered list named by its visible heading', () => {
    const html = render(seven);
    expect(html).toContain(`<h3 id="trakt-tittel" class="m-0 mb-2 text-base font-semibold">${nb['peers.funnel.heading']}</h3>`);
    expect(html).toMatch(/<ol aria-labelledby="trakt-tittel"/);
  });

  it('draws no bar, and divides by nothing, when stage 1 is empty', () => {
    expect(barWidth(0, 0)).toBe('0%');
    expect(barWidth(7, 40)).toBe('calc(100% * 7 / 40)');
    const empty = render({ stage1: 0, stage2: 0, stage3: { legalForm: 0 }, stage4: { businessModel: 0 }, stage5: { classification: 0, flagged: 0 } });
    expect(empty.match(/style="width:0%"/g)).toHaveLength(5);
  });
});
