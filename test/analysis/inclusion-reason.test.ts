// "Hvorfor med" (Story 2.7; FR-16): written by rules from the profile
// fields the peer shares with the subject, never from the model's
// classification. Synthetic fingerprints.
import { describe, expect, it } from 'vitest';
import { inclusionReason, type ProfileFields } from '../../src/analysis/inclusion-reason.ts';
import type { BandRange, Fingerprint } from '../../src/engine/fingerprint.ts';
import type { SubjectFiling } from '../../src/engine/peers.ts';

const NBSP = ' ';
const known = (band: BandRange['lo']): BandRange => ({ lo: band, hi: band });

// Cost of goods low, no inventory, no capitalised intangibles, personnel
// cost high, asset intensity low: konsulent.
const KONSULENT: Fingerprint = {
  costOfGoods: known('low'),
  personnelCost: known('high'),
  assetIntensity: known('low'),
  inventory: false,
  capitalisedIntangibles: false,
};

// 10 000 000 kr in øre.
const S = 1_000_000_000n;
const profile = (overrides: Partial<ProfileFields> = {}): ProfileFields => ({
  naeringskode1: '62.100',
  sumDriftsinntekter: S,
  fingerprint: null,
  ...overrides,
});

describe('inclusionReason', () => {
  it('names the industry, the revenue ratio and the subject', () => {
    expect(inclusionReason(profile(), profile({ sumDriftsinntekter: 2n * S }), 'ADMMIT AS')).toBe(
      'Samme bransje, omsetning 2× ADMMIT AS',
    );
  });

  it('computes the ratio peer / subject exactly, shown with up to one decimal', () => {
    expect(inclusionReason(profile(), profile({ sumDriftsinntekter: 1_400_000_000n }), 'A AS')).toBe(
      'Samme bransje, omsetning 1,4× A AS',
    );
    // 0.55 rounds half away from zero to 0,6.
    expect(inclusionReason(profile(), profile({ sumDriftsinntekter: 550_000_000n }), 'A AS')).toBe(
      'Samme bransje, omsetning 0,6× A AS',
    );
    // An odd subject revenue: 2/3 = 0,666… → 0,7, never a float.
    expect(inclusionReason(profile({ sumDriftsinntekter: 3n }), profile({ sumDriftsinntekter: 2n }), 'A AS')).toBe(
      'Samme bransje, omsetning 0,7× A AS',
    );
  });

  it('names shared fingerprint categories in order, at most two', () => {
    const both = profile({ fingerprint: KONSULENT });
    // Five known and equal: cost of goods and inventory come first.
    expect(inclusionReason(both, both, 'A AS')).toBe(
      'Samme bransje, omsetning 1× A AS, varekostnadsandel i samme bånd, uten varelager',
    );
    // Cost of goods unknown on one side: inventory, then intangibles.
    const range = profile({ fingerprint: { ...KONSULENT, costOfGoods: { lo: 'low', hi: 'mid' } } });
    expect(inclusionReason(both, range, 'A AS')).toBe(
      `Samme bransje, omsetning 1× A AS, uten varelager, immaterielle eiendeler under 5${NBSP}% av omsetningen`,
    );
    // Only the later three left: intangibles (held), personnel cost.
    const held = { ...KONSULENT, inventory: null, capitalisedIntangibles: true };
    expect(
      inclusionReason(
        profile({ fingerprint: { ...held, costOfGoods: known('mid') } }),
        profile({ fingerprint: held }),
        'A AS',
      ),
    ).toBe(
      `Samme bransje, omsetning 1× A AS, balanseførte immaterielle eiendeler minst 5${NBSP}% av omsetningen, lønnskostnadsandel i samme bånd`,
    );
    // Only asset intensity shared.
    const subject = profile({
      fingerprint: { ...KONSULENT, costOfGoods: known('mid'), inventory: true, capitalisedIntangibles: true, personnelCost: known('low') },
    });
    expect(inclusionReason(subject, both, 'A AS')).toBe('Samme bransje, omsetning 1× A AS, kapitalbinding i samme bånd');
  });

  it('names no category when one side has no fingerprint, or nothing is shared', () => {
    const both = profile({ fingerprint: KONSULENT });
    expect(inclusionReason(both, profile(), 'A AS')).toBe('Samme bransje, omsetning 1× A AS');
    expect(inclusionReason(profile(), both, 'A AS')).toBe('Samme bransje, omsetning 1× A AS');
    const other: Fingerprint = {
      costOfGoods: known('high'),
      personnelCost: known('low'),
      assetIntensity: known('high'),
      inventory: true,
      capitalisedIntangibles: true,
    };
    expect(inclusionReason(both, profile({ fingerprint: other }), 'A AS')).toBe('Samme bransje, omsetning 1× A AS');
  });

  it('same inputs give the same text, whatever the classification', () => {
    const base: SubjectFiling = {
      orgnr: '813235552',
      naeringskode1: '62.100',
      filingYear: 2025,
      sumDriftsinntekter: S,
      regnskapstype: 'SELSKAP',
      periodeFra: '2025-01-01',
      periodeTil: '2025-12-31',
      valuta: 'NOK',
      regnskapsregler: 'regnskapslovenAlminneligRegler',
      smaaForetak: true,
      avviklingsregnskap: false,
      fingerprint: KONSULENT,
      classification: null,
    };
    const peer = { ...base, orgnr: '900000001', sumDriftsinntekter: 3n * S };
    const texts = new Set(
      (['produkt', 'konsulent', 'forhandler', 'annet', null] as const).flatMap((classification) => {
        // A whole filing, classification included, passes as ProfileFields;
        // the function cannot read the field (its type has none).
        const classifiedSubject: SubjectFiling = { ...base, classification };
        const classifiedPeer: SubjectFiling = { ...peer, classification };
        return [
          inclusionReason(classifiedSubject, peer, 'A AS'),
          inclusionReason(base, classifiedPeer, 'A AS'),
          inclusionReason(base, peer, 'A AS'),
        ];
      }),
    );
    expect([...texts]).toEqual(['Samme bransje, omsetning 3× A AS, varekostnadsandel i samme bånd, uten varelager']);
  });

  it('the input type has no model field', () => {
    // @ts-expect-error -- ProfileFields has no classification: pnpm typecheck fails if one is added.
    type Classification = ProfileFields['classification'];
    const keys: (keyof ProfileFields)[] = ['naeringskode1', 'sumDriftsinntekter', 'fingerprint'];
    expect(keys).toHaveLength(3);
    const unused: Classification | undefined = undefined;
    expect(unused).toBeUndefined();
  });

  it('carries no ✦', () => {
    const both = profile({ fingerprint: KONSULENT });
    expect(inclusionReason(both, both, 'A AS')).not.toContain('✦');
  });

  it('refuses a pair stage 1 would never admit', () => {
    expect(() => inclusionReason(profile(), profile({ naeringskode1: '62.200' }), 'A AS')).toThrow(TypeError);
    expect(() => inclusionReason(profile({ naeringskode1: null }), profile({ naeringskode1: null }), 'A AS')).toThrow(TypeError);
    expect(() => inclusionReason(profile(), profile({ sumDriftsinntekter: null }), 'A AS')).toThrow(TypeError);
    expect(() => inclusionReason(profile({ sumDriftsinntekter: 0n }), profile(), 'A AS')).toThrow(TypeError);
  });
});
