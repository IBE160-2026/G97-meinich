// The Peers tab's rows (Stories 2.7, 2.8; AD-4): each peer as the strings
// the list shows, its orgnr for the exclude action and whether it is
// excluded, and nothing else. Synthetic peers.
import { describe, expect, it } from 'vitest';
import { peerRows, type PeerInput } from '../../src/analysis/peer-rows.ts';
import type { SubjectKeyFigures } from '../../src/analysis/view.ts';
import type { BandRange, Fingerprint } from '../../src/engine/fingerprint.ts';
import type { FunnelSubject } from '../../src/engine/peers.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };

const NBSP = ' ';
const known = (band: BandRange['lo']): BandRange => ({ lo: band, hi: band });
const KONSULENT: Fingerprint = {
  costOfGoods: known('low'),
  personnelCost: known('high'),
  assetIntensity: known('low'),
  inventory: false,
  capitalisedIntangibles: false,
};
const FORHANDLER: Fingerprint = { ...KONSULENT, costOfGoods: known('high'), inventory: true };

const comparability = {
  regnskapstype: 'SELSKAP',
  periodeFra: '2025-01-01',
  periodeTil: '2025-12-31',
  valuta: 'NOK',
  regnskapsregler: 'regnskapslovenAlminneligRegler',
  smaaForetak: true,
  avviklingsregnskap: false,
};

const subject: FunnelSubject = {
  orgnr: '813235552',
  naeringskode1: '62.100',
  filingYear: 2025,
  sumDriftsinntekter: 1_000_000_000n,
  fingerprint: KONSULENT,
  classification: 'konsulent',
  ...comparability,
};

const figures = (revenue: string, result: string | null): SubjectKeyFigures => ({
  sum_driftsinntekter_ore: revenue,
  driftsresultat_ore: result,
  sum_driftskostnad_ore: null,
  sum_eiendeler_ore: '500000000',
  sum_egenkapital_gjeld_ore: null,
  sum_egenkapital_ore: '200000000',
  sum_gjeld_ore: null,
});

let id = 0n;
function peer(orgnr: string, overrides: Partial<PeerInput> = {}): PeerInput {
  id += 1n;
  return {
    orgnr,
    navn: `PEER ${orgnr} AS`,
    organisasjonsform: 'AS',
    naeringskode1: '62.100',
    brregId: id,
    filingYear: 2025,
    sumDriftsinntekter: 1_500_000_000n,
    fingerprint: KONSULENT,
    classification: 'konsulent',
    keyFigures: figures('1500000000', '150000000'),
    ...comparability,
    ...overrides,
  };
}

describe('peerRows', () => {
  it('a row has only the shown fields', () => {
    const [row] = peerRows(subject, 'ADMMIT AS', [peer('900000001')], 'NOK');
    expect(Object.keys(row ?? {}).sort()).toEqual(
      ['driftsmargin', 'excluded', 'hvorforMed', 'navn', 'omsetning', 'orgnr'].sort(),
    );
    expect(row).toEqual({
      orgnr: '900000001',
      excluded: false,
      navn: 'PEER 900000001 AS',
      omsetning: `15,0${NBSP}mill.${NBSP}kr`,
      driftsmargin: `10,0${NBSP}%`,
      // v1 names no fingerprint category (Story 5.2).
      hvorforMed: 'Samme bransje, omsetning 1,5× ADMMIT AS',
    });
  });

  it('carries no øre amount, fingerprint category or business type, and the orgnr only as its own field', () => {
    const rows = peerRows(
      subject,
      'ADMMIT AS',
      [peer('900000001', { navn: 'NAVN AS' }), peer('900000002', { navn: 'ANNET AS', fingerprint: FORHANDLER })],
      'NOK',
    );
    expect(rows.map((row) => row.orgnr)).toEqual(['900000001', '900000002']);
    const text = JSON.stringify(rows.map((row) => ({ ...row, orgnr: '' })));
    expect(text).not.toMatch(/9000000\d\d/);
    expect(text).not.toMatch(/1500000000|150000000|500000000|200000000/);
    expect(text).not.toMatch(/\b(low|mid|high|produkt|konsulent|forhandler|annet)\b/);
  });

  it('names a peer with no name by its orgnr, grouped', () => {
    const [row] = peerRows(subject, 'ADMMIT AS', [peer('900000001', { navn: null })], 'NOK');
    expect(row?.navn).toBe(`900${NBSP}000${NBSP}001`);
  });

  // The v1 funnel flags no one (Story 5.2); the row still tags an orgnr it is given.
  // v1 (Story 5.2): no match basis and no flag reach the page.
  it('carries no match basis and no flag, whatever the signals', () => {
    const rows = peerRows(
      subject,
      'ADMMIT AS',
      [peer('900000001'), peer('900000002', { fingerprint: FORHANDLER }), peer('900000003', { classification: null })],
      'NOK',
    );
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain('grunnlag');
      expect(Object.keys(row)).not.toContain('grunnlagKi');
      expect(Object.keys(row)).not.toContain('flagg');
    }
    const text = JSON.stringify(rows);
    for (const id of ['peers.basis.description_and_accounts', 'peers.basis.accounts_only', 'peers.basis.description_only', 'peers.basis.industry_and_size_only', 'peers.flag'] as const) {
      expect(text).not.toContain(nb[id]);
    }
    expect(text).not.toContain('✦');
  });

  it('shows "Kan ikke beregnes" with its reason for a driftsmargin the filing cannot give', () => {
    const [row] = peerRows(subject, 'ADMMIT AS', [peer('900000001', { keyFigures: figures('1500000000', null) })], 'NOK');
    expect(row?.driftsmargin).toBe('Kan ikke beregnes: en regnskapslinje mangler');
  });

  it('reads "Ikke i kroner" for revenue outside NOK', () => {
    const [row] = peerRows(subject, 'ADMMIT AS', [peer('900000001')], 'USD');
    expect(row?.omsetning).toBe(nb['peers.otherCurrency']);
  });

  // Story 2.8: an excluded peer keeps its row, marked.
  it('marks the peers in ekskl as excluded and keeps their rows', () => {
    const rows = peerRows(subject, 'ADMMIT AS', [peer('900000001'), peer('900000002'), peer('900000003')], 'NOK', [
      '900000002',
      '900000009',
    ]);
    expect(rows.map((row) => [row.orgnr, row.excluded])).toEqual([
      ['900000001', false],
      ['900000002', true],
      ['900000003', false],
    ]);
  });

  it('keeps the peers’ order', () => {
    const rows = peerRows(subject, 'ADMMIT AS', [peer('900000002'), peer('900000001')], 'NOK');
    expect(rows.map((row) => row.navn)).toEqual(['PEER 900000002 AS', 'PEER 900000001 AS']);
  });
});
