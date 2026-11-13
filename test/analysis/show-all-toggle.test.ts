// "Vis alle {n}" across peer-group changes (Story 2.8; Story 2.7 triage row
// 14). A change remounts the page, so the open state is the band it was
// opened at, held by the peer-change provider in the layout: drawn open
// again after an exclude or a restore at the same band, closed at another
// band. PeerList keys the toggle by the band as well
// (test/analysis/peer-list.test.ts).
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PeerDisplayRow } from '../../src/analysis/peer-rows.ts';
import { PeerChangeContext, type PeerChangeValue } from '../../src/components/analysis/peer-change.tsx';
import { ShowAllToggle } from '../../src/components/analysis/show-all-toggle.tsx';
import type { Band } from '../../src/url/analysis-state.ts';

const row = (i: number): PeerDisplayRow => ({
  orgnr: `90000000${i}`,
  excluded: i === 1,
  navn: `P${i} AS`,
  omsetning: '1,0 mill. kr',
  driftsmargin: '1,0 %',
  hvorforMed: 'Samme bransje',
  grunnlag: 'Kun regnskap',
  grunnlagKi: false,
  flagg: null,
});

const labels = {
  omsetning: 'Omsetning',
  driftsmargin: 'Driftsmargin',
  reason: 'Hvorfor med',
  basis: 'Grunnlag',
  ki: 'KI-generert',
  excluded: 'Ekskludert',
};

function provider(showAllBand: Band | null): PeerChangeValue {
  const noop = () => undefined;
  return {
    isPending: false,
    failed: false,
    change: noop,
    commit: noop,
    hasChangeInFlight: () => false,
    fail: noop,
    showAllBand,
    openShowAll: noop,
  };
}

function render(showAllBand: Band | null, band: Band): string {
  const toggle = createElement(ShowAllToggle, { listId: 'flere', label: 'Vis alle 3', rows: [row(0), row(1), row(2)], labels, band });
  return renderToString(createElement(PeerChangeContext.Provider, { value: provider(showAllBand) }, toggle));
}

describe('ShowAllToggle across peer-group changes', () => {
  it('is drawn open when the provider says it was opened at this band: an exclude or restore keeps it open', () => {
    const html = render(1, 1);
    expect(html.match(/data-testid="peer-card"/g)).toHaveLength(3);
    expect(html).not.toContain('aria-controls="flere"');
    // An excluded peer's card keeps its restore action.
    expect(html).toContain('data-peer-action="900000001"');
  });

  it('is closed at another band: a band change closes it', () => {
    const html = render(1, 2);
    expect(html).not.toContain('data-testid="peer-card"');
    expect(html).toContain('aria-controls="flere"');
  });

  it('is closed until it is opened', () => {
    expect(render(null, 0)).toContain('aria-controls="flere"');
  });
});
