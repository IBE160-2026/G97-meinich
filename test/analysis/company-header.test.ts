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
  fingerprint: null,
  classification: null,
  documentBasis: { kind: 'not_in_dataset' },
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
    return [...html.matchAll(/<span(?: data-testid="[^"]*")?>([^<]*)<\/span>/g)].map((match) => match[1] ?? '');
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

  // Story 2.8: a widened band tags the count "Utvidet"; Standard does not.
  it('tags the count "Utvidet" when the band is widened', () => {
    const widened = renderToString(createElement(CompanyHeader, { subject, peerCount: 23, widened: true }));
    expect(widened).toMatch(/data-testid="header-peer-count">23 sammenlignbare<span[^>]*data-testid="widened-tag">Utvidet<\/span>/);
    expect(renderToString(createElement(CompanyHeader, { subject, peerCount: 23 }))).not.toContain('widened-tag');
  });
});

// Story 2.9 (FR-57, FR-71): a slate subline below the meta line says why the
// subject's own document is not read; no badge.
describe('CompanyHeader document subline', () => {
  const html = (documentBasis: SubjectFiling['documentBasis']): string =>
    renderToString(createElement(CompanyHeader, { subject: { ...subject, filing: { ...filing, documentBasis } }, peerCount: 23 }));
  const sublineOf = (documentBasis: SubjectFiling['documentBasis']): string | null => {
    const match = /<p[^>]*data-testid="document-subline"[^>]*>([^<]*)<\/p>/.exec(html(documentBasis));
    return match === null ? null : (match[1] ?? '');
  };

  it('a failed filing shows the subline', () => {
    const shown = html({ kind: 'failed_reconciliation', filingYear: 2025 });
    expect(sublineOf({ kind: 'failed_reconciliation', filingYear: 2025 })).toBe('Regnskapet for 2025 kunne ikke leses sikkert');
    // Below the meta line, in slate, and the meta line is unchanged.
    expect(shown.indexOf('data-testid="company-meta"')).toBeLessThan(shown.indexOf('data-testid="document-subline"'));
    expect(shown).toMatch(/<p class="[^"]*text-slate[^"]*" data-testid="document-subline"/);
    expect(shown).toContain('23 sammenlignbare');
  });

  it('a refused filing shows the failed subline', () => {
    expect(sublineOf({ kind: 'refused', filingYear: 2025 })).toBe('Regnskapet for 2025 kunne ikke leses sikkert');
    expect(sublineOf({ kind: 'not_reconciled', filingYear: 2025 })).toBe('Regnskapet for 2025 kunne ikke leses sikkert');
  });

  it('a filing year not read shows its subline', () => {
    expect(sublineOf({ kind: 'not_read_in_v1', scope: 'filing_year', filingYear: 2026 })).toBe(
      'Regnskapet for 2026 er ikke lest i denne versjonen',
    );
    expect(sublineOf({ kind: 'not_read_in_v1', scope: 'paper', filingYear: 2025 })).toBe(
      'Regnskapet for 2025 er ikke lest i denne versjonen',
    );
  });

  it('a listed company with no stored document shows that it is not read in', () => {
    expect(sublineOf({ kind: 'document_missing', filingYear: 2025 })).toBe('Regnskapet for 2025 er ikke lest inn');
  });

  it('shows no subline outside the demo data or for a document that was read', () => {
    expect(sublineOf({ kind: 'not_in_dataset' })).toBeNull();
    expect(text(subject)).not.toContain('Regnskapet for');
  });

  it('shows no subline without a filing', () => {
    expect(renderToString(createElement(CompanyHeader, { subject: { ...subject, filing: null } }))).not.toContain(
      'document-subline',
    );
  });
});
