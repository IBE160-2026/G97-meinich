// The company header's revenue rule (Story 1.6b): "Omsetning x mill. kr"
// only for a NOK filing with a stated sumDriftsinntekter; kroner are never
// written for another currency.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Subject, SubjectFiling } from '../../src/analysis/view.ts';
import { CompanyHeader } from '../../src/components/analysis/company-header.tsx';

const NBSP = ' ';

const filing: SubjectFiling = {
  filingYear: 2025,
  valuta: 'NOK',
  readAt: new Date('2026-10-02T23:30:00Z'),
  keyFigures: {
    sum_driftsinntekter_ore: '1670000000',
    driftsresultat_ore: '35070000',
    sum_driftskostnad_ore: null,
    sum_eiendeler_ore: '800000000',
    sum_egenkapital_gjeld_ore: null,
    sum_egenkapital_ore: '300000000',
    sum_gjeld_ore: null,
  },
};

const subject: Subject = {
  orgnr: '813235552',
  navn: 'ADMMIT AS',
  naeringskode1: '00.001',
  naeringskode1Beskrivelse: 'Dekket bransje',
  kommune: 'VINDAFJORD',
  covered: true,
  filing,
};

function text(s: Subject): string {
  return renderToString(createElement(CompanyHeader, { subject: s }))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'");
}

describe('CompanyHeader revenue', () => {
  it('shows "Omsetning x mill. kr" for a NOK filing', () => {
    expect(text(subject)).toContain(`Omsetning 16,7${NBSP}mill.${NBSP}kr`);
  });

  it('shows no revenue and no kroner for another currency', () => {
    const shown = text({ ...subject, filing: { ...filing, valuta: 'EUR' } });
    expect(shown).not.toContain('Omsetning');
    expect(shown).not.toMatch(/\bkr\b/);
  });

  it('shows no revenue when sumDriftsinntekter is not stated', () => {
    const shown = text({ ...subject, filing: { ...filing, keyFigures: { ...filing.keyFigures, sum_driftsinntekter_ore: null } } });
    expect(shown).not.toContain('Omsetning');
  });

  it('always shows the filing year and the read date in Europe/Oslo', () => {
    expect(text({ ...subject, filing: { ...filing, valuta: 'EUR' } })).toContain('Regnskapsår 2025 · hentet 3. okt. 2026');
  });
});
