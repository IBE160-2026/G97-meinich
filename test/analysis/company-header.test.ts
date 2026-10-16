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
  regnskapstype: 'SELSKAP',
  periodeFra: '2025-01-01',
  periodeTil: '2025-12-31',
  regnskapsregler: 'regnskapslovenAlminneligRegler',
  smaaForetak: true,
  avviklingsregnskap: false,
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
  organisasjonsform: 'AS',
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

describe('CompanyHeader peer count (Story 1.7)', () => {
  const items = (peerCount?: number): string[] => {
    const html = renderToString(createElement(CompanyHeader, { subject, peerCount }));
    return [...html.matchAll(/<span>([^<]*)<\/span>/g)].map((match) => match[1] ?? '');
  };

  it('shows "{n} sammenlignbare" right after the revenue', () => {
    const shown = items(23);
    expect(shown[shown.indexOf(`Omsetning 16,7${NBSP}mill.${NBSP}kr`) + 1]).toBe('23 sammenlignbare');
  });

  it('shows "1 sammenlignbart" for a group of one', () => {
    expect(items(1)).toContain('1 sammenlignbart');
    expect(items(1)).not.toContain('1 sammenlignbare');
  });

  it('shows "0 sammenlignbare" for an empty group', () => {
    expect(items(0)).toContain('0 sammenlignbare');
  });

  it('shows no count without a peer group', () => {
    expect(items().join(' ')).not.toContain('sammenlignbare');
  });
});
