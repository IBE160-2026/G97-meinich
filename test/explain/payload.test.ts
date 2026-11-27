// The explanation payload (Story 4.1; FR-52; AD-7, AD-13): the slot table
// and payload built from a company's default analysis, and the digest of
// its wire encoding. The default analyses are computed from the committed
// demo seed (test/explain/seed-analysis.ts), so no database is needed.
// Expected values are written by hand from the built app (spec, "Sources
// for the matrix"), never read from the module under test.
import { describe, expect, it } from 'vitest';
import {
  analysisDigest,
  defaultAnalysis,
  type AnalysisWire,
  type DefaultAnalysis,
  type DefaultCandidate,
  type ExplanationAnalysis,
  type PayloadItem,
} from '../../src/analysis/explanation-payload.ts';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { DOCUMENT_KEY_FIGURE_KEYS } from '../../src/engine/document-absence.ts';
import type { Fingerprint } from '../../src/engine/fingerprint.ts';
import { fromWire, toWire } from '../../src/engine/wire.ts';
import { narrow } from '../narrow.ts';
import { apiOnlySubject, companyName, seedInput, type SeedInput } from './seed-analysis.ts';

const [A, B] = DEMO_COMPANIES;
const NBSP = ' ';

function analysisOf(input: SeedInput): DefaultAnalysis<DefaultCandidate> {
  return defaultAnalysis(input.funnel, input.filing, input.candidates);
}

function explained(orgnr: string): ExplanationAnalysis {
  return narrow(analysisOf(seedInput(orgnr)), 'analysis').analysis;
}

const names = (items: readonly PayloadItem[]) => items.map((item) => item.name);
const slot = (analysis: ExplanationAnalysis, id: string) => analysis.slots.find((entry) => entry.id === id);

// The first covered AS outside the document list with a peer group (a fixed rule; its orgnr is printed nowhere).
const API_ONLY = apiOnlySubject((orgnr) => analysisOf(seedInput(orgnr)).kind === 'analysis');

describe('the payload', () => {
  it("demo A's payload", () => {
    const analysis = explained(A.orgnr);
    const { payload } = analysis;
    // /analyse/922425620, Oversikt: "(13,3 % − 3,4 %) × 21 473 080 kr ≈ 2 125 096 kr per år".
    expect(names(payload.profit_gaps_per_year)).toEqual(['Driftsmargin']);
    expect(slot(analysis, 'driftsmargin.gap')?.text).toBe(`2${NBSP}125${NBSP}096${NBSP}kr`);
    expect(slot(analysis, 'driftsmargin.egen')?.text).toBe(`3,4${NBSP}%`);
    expect(slot(analysis, 'driftsmargin.beste')?.text).toBe(`13,3${NBSP}%`);
    // Største kapitalgap "Arbeidskapital", then its two parts.
    expect(names(payload.capital_gaps_one_off)).toEqual([
      'Arbeidskapital (kundefordringsdager og leverandørgjeldsdager)',
      'Kundefordringsdager',
      'Leverandørgjeldsdager',
    ]);
    expect(['arbeidskapital.rang', 'kfd.rang', 'lgd.rang'].map((id) => slot(analysis, id)?.text)).toEqual([
      'det største kapitalgapet',
      'nest største kapitalgapet',
      'tredje største kapitalgapet',
    ]);
    // Største styrke "Varekostnadsandel", then the other two.
    expect(names(payload.strengths)).toEqual([
      'Varekostnadsandel',
      'Omløpshastighet driftseiendeler',
      'Andel andre driftskostnader',
    ]);
    expect(slot(analysis, 'driftsmargin.retning')?.text).toBe('over medianen');
    expect(slot(analysis, 'vare.retning')?.text).toBe('under medianen');
    expect(payload.notes).toEqual([]);
    expect(payload.year).toEqual({ id: 'aar', text: '2025' });
  });

  it('every slot the payload names is in the slot table, and the table holds no other', () => {
    const analysis = explained(A.orgnr);
    const { payload } = analysis;
    const named = [
      payload.year,
      payload.peer_count,
      ...[...payload.profit_gaps_per_year, ...payload.capital_gaps_one_off, ...payload.strengths].flatMap((item) => item.slots),
      ...payload.notes,
    ];
    expect(named.map((entry) => entry.id).sort()).toEqual(analysis.slots.map((entry) => entry.id).sort());
    expect(named).not.toHaveLength(0);
    expect(analysis.slots).toHaveLength(named.length);
    for (const entry of named) expect(slot(analysis, entry.id)?.text, entry.id).toBe(entry.text);
  });

  it("a non-allow-listed company's payload contains no document figure", () => {
    const input = seedInput(API_ONLY);
    expect(input.filing.documentBasis.kind).toBe('not_in_dataset');
    const analysis = narrow(analysisOf(input), 'analysis').analysis;
    const documentIds = new Set<string>([...DOCUMENT_KEY_FIGURE_KEYS, 'arbeidskapital']);
    expect(analysis.slots.filter((entry) => documentIds.has(entry.id.split('.')[0] ?? ''))).toEqual([]);
    expect(analysis.payload.capital_gaps_one_off).toEqual([]);
    expect(analysis.payload.notes).toEqual([
      { id: 'mangler.dokument', text: 'Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen.' },
    ]);
  });

  describe('holds no identity, fingerprint or classification', () => {
    const STRUCTURAL = new Set(['year', 'peer_count', 'profit_gaps_per_year', 'capital_gaps_one_off', 'strengths', 'notes', 'name', 'slots', 'id', 'text']);
    const FINGERPRINT: Fingerprint = {
      costOfGoods: { lo: 'high', hi: 'high' },
      personnelCost: { lo: 'low', hi: 'low' },
      assetIntensity: { lo: 'high', hi: 'high' },
      inventory: true,
      capitalisedIntangibles: true,
    };
    const keysOf = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.flatMap(keysOf)
        : typeof value === 'object' && value !== null
          ? Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)])
          : [];

    it.each([
      ['demo A', A.orgnr],
      ['demo B', B.orgnr],
      ['the API-only subject', API_ONLY],
    ])('%s', (_label, orgnr) => {
      const input = seedInput(orgnr);
      const analysis = narrow(analysisOf(input), 'analysis').analysis;
      const json = JSON.stringify(analysis.payload);
      expect(new Set(keysOf(analysis.payload))).toEqual(STRUCTURAL);
      // No orgnr: neither the subject's nor any candidate's, and no nine digits in a row.
      expect(json).not.toMatch(/\d{9}/);
      expect(input.candidates.length).toBeGreaterThan(0);
      expect(input.candidates.filter((candidate) => json.includes(candidate.orgnr))).toEqual([]);
      const name = companyName(orgnr);
      expect(name).not.toBeNull();
      expect(json).not.toContain(name);
      // A fingerprint and a classification on every company change nothing the model sees.
      const signalled = analysisOf({
        funnel: { ...input.funnel, fingerprint: FINGERPRINT, classification: 'produkt' },
        filing: input.filing,
        candidates: input.candidates.map((candidate) => ({ ...candidate, fingerprint: FINGERPRINT, classification: 'konsulent' })),
      });
      expect(narrow(signalled, 'analysis').analysis).toEqual(analysis);
      expect(json).not.toMatch(/produkt|konsulent|forhandler|fingerprint|classification/i);
    });
  });
});

describe('the digest (AD-13)', () => {
  const analysis = explained(A.orgnr);
  const input = seedInput(A.orgnr);
  const shown = narrow(analysisOf(input), 'analysis').shown;
  const base: AnalysisWire = {
    subject: A.orgnr,
    filing_year: analysis.filingYear,
    band: 0,
    peers: shown.peers.map((peer) => peer.orgnr).sort(),
    slots: analysis.slots,
  };

  it('the same analysis gives the same digest', () => {
    expect(explained(A.orgnr).digest).toBe(analysis.digest);
    expect(analysisDigest(base)).toBe(analysis.digest);
    expect(analysis.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a changed peer changes the digest', () => {
    expect(base.peers.length).toBeGreaterThan(1);
    const changed = { ...base, peers: [...base.peers.slice(1), '000000108'] };
    expect(analysisDigest(changed)).not.toBe(analysis.digest);
  });

  it('a changed slot value changes the digest', () => {
    const at = base.slots.findIndex((entry) => entry.id === 'driftsmargin.gap');
    const gap = base.slots[at];
    if (gap?.value === null || gap === undefined) throw new Error("demo A has no driftsmargin gap value");
    // One øre in the 40th digit would not change the shown text: only the exact value moves.
    const value = toWire(fromWire(gap.value).plus(new Decimal('0.0000001')));
    const slots = base.slots.map((entry, i) => (i === at ? { ...entry, value } : entry));
    expect(slots[at]?.text).toBe(gap.text);
    expect(analysisDigest({ ...base, slots })).not.toBe(analysis.digest);
  });

  it('a changed slot text changes the digest', () => {
    const at = base.slots.findIndex((entry) => entry.id === 'driftsmargin.retning');
    expect(at).toBeGreaterThanOrEqual(0);
    const slots = base.slots.map((entry, i) => (i === at ? { ...entry, text: 'under medianen' } : entry));
    expect(analysisDigest({ ...base, slots })).not.toBe(analysis.digest);
  });
});
