// The uncovered state's three API figures (Story 1.6b): a value as a
// percent, or "Kan ikke beregnes: {grunn}" with the reason that applies.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SubjectFiling, SubjectKeyFigures } from '../../src/analysis/view.ts';
import { ApiFigures } from '../../src/components/analysis/api-figures.tsx';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const base: SubjectKeyFigures = {
  sum_driftsinntekter_ore: '1000000000',
  driftsresultat_ore: '100000000',
  sum_driftskostnad_ore: '900000000',
  sum_eiendeler_ore: '500000000',
  sum_egenkapital_gjeld_ore: '500000000',
  sum_egenkapital_ore: '200000000',
  sum_gjeld_ore: '300000000',
};

function figures(keyFigures: Partial<SubjectKeyFigures>): Record<string, string> {
  const filing: SubjectFiling = {
    filingYear: 2025,
    valuta: 'NOK',
    readAt: new Date('2026-10-11T12:00:00Z'),
    keyFigures: { ...base, ...keyFigures },
  };
  const html = renderToString(createElement(ApiFigures, { filing }));
  const out: Record<string, string> = {};
  for (const match of html.matchAll(/data-testid="figure-(\w+)"[^>]*>([^<]*)</g)) out[match[1] ?? ''] = match[2] ?? '';
  return out;
}

const undefinedBecause = (reason: keyof typeof nb) =>
  nb['analysis.figures.undefined'].replace('{grunn}', nb[reason]);

describe('ApiFigures', () => {
  it('shows each defined figure as a percent', () => {
    expect(figures({})).toEqual({
      driftsmargin: '10,0 %',
      totalkapitalrentabilitet: '20,0 %',
      egenkapitalandel: '40,0 %',
    });
  });

  it('gives the revenue reason for driftsmargin when revenue is zero or negative', () => {
    for (const revenue of ['0', '-100']) {
      expect(figures({ sum_driftsinntekter_ore: revenue }).driftsmargin).toBe(
        undefinedBecause('analysis.figures.reason.revenueNotPositive'),
      );
    }
  });

  it('gives the assets reason for the two asset-based figures when assets are zero or negative', () => {
    const shown = figures({ sum_eiendeler_ore: '-100' });
    expect(shown.totalkapitalrentabilitet).toBe(undefinedBecause('analysis.figures.reason.assetsNotPositive'));
    expect(shown.egenkapitalandel).toBe(undefinedBecause('analysis.figures.reason.assetsNotPositive'));
    expect(shown.driftsmargin).toBe('10,0 %');
  });

  it('says "en regnskapslinje mangler" when a component cannot be derived', () => {
    const shown = figures({ driftsresultat_ore: null, sum_driftskostnad_ore: null });
    expect(shown.driftsmargin).toBe(undefinedBecause('analysis.figures.reason.componentMissing'));
    expect(shown.totalkapitalrentabilitet).toBe(undefinedBecause('analysis.figures.reason.componentMissing'));
    expect(shown.egenkapitalandel).toBe('40,0 %');
  });
});
