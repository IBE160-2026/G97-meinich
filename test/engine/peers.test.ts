// Funnel stages 1–3 (Story 1.7; FR-8): every row of the spec's I/O matrix
// that the engine decides — the band bounds at each step to the øre, one
// candidate per stage-2 field, legal form, the benchmark filing, the
// non-calendar and dormant subjects, dormant candidates — and the counts.
import { describe, expect, it } from 'vitest';
import {
  SIZE_BANDS,
  assemblePeerGroup,
  benchmarkFiling,
  isCalendarYear,
  isKnownCurrency,
  withoutExcluded,
  type CandidateFiling,
  type SizeBand,
  type SubjectFiling,
} from '../../src/engine/peers.ts';

// 10 000 000 kr, in øre: every band bound is a whole number of øre.
const S = 1_000_000_000n;

const subject: SubjectFiling = {
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
};

let nextId = 1n;
function candidate(orgnr: string, overrides: Partial<CandidateFiling> = {}): CandidateFiling {
  nextId += 1n;
  return {
    orgnr,
    naeringskode1: '62.100',
    organisasjonsform: 'AS',
    brregId: nextId,
    filingYear: 2025,
    sumDriftsinntekter: S,
    regnskapstype: 'SELSKAP',
    periodeFra: '2025-01-01',
    periodeTil: '2025-12-31',
    valuta: 'NOK',
    regnskapsregler: 'regnskapslovenAlminneligRegler',
    smaaForetak: true,
    avviklingsregnskap: false,
    ...overrides,
  };
}

const poolOf = (candidates: readonly CandidateFiling[], band: SizeBand = 0, of: SubjectFiling = subject) =>
  assemblePeerGroup(of, candidates, band).pool.map((peer) => peer.orgnr);

describe('stage 1: the size band, both bounds included, exact to the øre', () => {
  // lo×s and hi×s for s = 1 000 000 000 øre: 0.5/2, 0.33/3, 0.25/4.
  it.each([
    [0, 500_000_000n, 2_000_000_000n],
    [1, 330_000_000n, 3_000_000_000n],
    [2, 250_000_000n, 4_000_000_000n],
  ] as const)('band %i keeps lo×s = %s and hi×s = %s, and drops one øre outside each', (band, lo, hi) => {
    const candidates = [
      candidate('900000001', { sumDriftsinntekter: lo }),
      candidate('900000002', { sumDriftsinntekter: hi }),
      candidate('900000003', { sumDriftsinntekter: lo - 1n }),
      candidate('900000004', { sumDriftsinntekter: hi + 1n }),
    ];
    expect(poolOf(candidates, band).sort()).toEqual(['900000001', '900000002']);
    expect(assemblePeerGroup(subject, candidates, band).counts.stage1).toBe(2);
  });

  it('computes the bound in decimals, not floats: an odd subject revenue keeps the exact half', () => {
    // s = 3 øre: lo×s = 1.5 øre, so 1 øre is out and 2 øre is in.
    const odd = { ...subject, sumDriftsinntekter: 3n };
    expect(poolOf([candidate('900000001', { sumDriftsinntekter: 1n }), candidate('900000002', { sumDriftsinntekter: 2n })], 0, odd)).toEqual([
      '900000002',
    ]);
  });

  it('defines the band factors as exact decimals', () => {
    expect(Object.fromEntries(Object.entries(SIZE_BANDS).map(([band, f]) => [band, [f.lo.toString(), f.hi.toString()]]))).toEqual({
      0: ['0.5', '2'],
      1: ['0.33', '3'],
      2: ['0.25', '4'],
    });
  });

  it('keeps only the same primary industry', () => {
    expect(poolOf([candidate('900000001', { naeringskode1: '62.200' }), candidate('900000002', { naeringskode1: null })])).toEqual([]);
  });

  it('keeps no one when the subject has no industry code', () => {
    expect(poolOf([candidate('900000001', { naeringskode1: null })], 0, { ...subject, naeringskode1: null })).toEqual([]);
  });

  describe.each([0, 1, 2] as const)('dormant companies at band %i', (band) => {
    it.each([
      ['zero', 0n],
      ['null', null],
    ] as const)('a candidate with %s revenue is out at stage 1', (_label, revenue) => {
      const group = assemblePeerGroup(subject, [candidate('900000001', { sumDriftsinntekter: revenue })], band);
      expect(group.pool).toEqual([]);
      expect(group.counts.stage1).toBe(0);
    });

    it.each([
      ['zero', 0n],
      ['negative', -100n],
      ['null', null],
    ] as const)('a subject with %s revenue gets an empty group', (_label, revenue) => {
      const dormant = { ...subject, sumDriftsinntekter: revenue };
      const candidates = [
        candidate('900000001', { sumDriftsinntekter: 0n }),
        candidate('900000002', { sumDriftsinntekter: revenue }),
        candidate('900000003', { sumDriftsinntekter: S }),
      ];
      const group = assemblePeerGroup(dormant, candidates, band);
      expect(group.pool).toEqual([]);
      expect(group.counts).toEqual({ stage1: 0, stage2: 0, stage3: { legalForm: 0 } });
      expect(group.emptyReason).toBe('subject_no_revenue');
    });
  });
});

describe('stage 2: comparability, one field at a time', () => {
  it.each([
    ['valuta', { valuta: 'EUR' }],
    ['valuta (null)', { valuta: null }],
    ['regnskapsregler', { regnskapsregler: 'IFRS' }],
    ['regnskapsregler (null)', { regnskapsregler: null }],
    ['smaaForetak', { smaaForetak: false }],
    ['smaaForetak (null)', { smaaForetak: null }],
    ['avviklingsregnskap', { avviklingsregnskap: true }],
    ['avviklingsregnskap (null)', { avviklingsregnskap: null }],
    ['regnskapstype', { regnskapstype: 'KONSERN' }],
    ['the period (another calendar year’s dates)', { periodeFra: '2024-01-01', periodeTil: '2024-12-31' }],
    ['the period (non-calendar)', { periodeFra: '2024-07-01', periodeTil: '2025-06-30' }],
    ['the period (short year)', { periodeFra: '2025-03-01', periodeTil: '2025-12-31' }],
  ] as const)('a candidate differing only on %s is out at stage 2', (_label, overrides) => {
    const group = assemblePeerGroup(subject, [candidate('900000001'), candidate('900000002', overrides)], 0);
    expect(group.pool.map((peer) => peer.orgnr)).toEqual(['900000001']);
    expect(group.counts).toEqual({ stage1: 2, stage2: 1, stage3: { legalForm: 1 } });
  });

  it('an unknown valuta matches nothing, not even itself, and is never read as NOK', () => {
    const edt = { ...subject, valuta: 'EDT' };
    const group = assemblePeerGroup(edt, [candidate('900000001', { valuta: 'EDT' }), candidate('900000002')], 0);
    expect(group.pool).toEqual([]);
    expect(group.counts.stage2).toBe(0);
    expect(isKnownCurrency('EDT')).toBe(false);
    expect(isKnownCurrency(null)).toBe(false);
    expect(isKnownCurrency('NOK')).toBe(true);
    expect(isKnownCurrency('nok')).toBe(false);
    // ISO 4217 List One, 2026: the digital bolívar VED sits beside VES.
    expect(isKnownCurrency('VED')).toBe(true);
    expect(isKnownCurrency('VES')).toBe(true);
  });

  it('another known currency compares with itself', () => {
    const usd = { ...subject, valuta: 'USD' };
    expect(poolOf([candidate('900000001', { valuta: 'USD' }), candidate('900000002')], 0, usd)).toEqual(['900000001']);
  });

  it('a null field on the subject matches nothing', () => {
    expect(poolOf([candidate('900000001', { smaaForetak: null })], 0, { ...subject, smaaForetak: null })).toEqual([]);
  });

  it('a non-calendar subject gets an empty group with its reason', () => {
    const nonCalendar = { ...subject, periodeFra: '2024-07-01', periodeTil: '2025-06-30' };
    const group = assemblePeerGroup(
      nonCalendar,
      [candidate('900000001', { periodeFra: '2024-07-01', periodeTil: '2025-06-30' }), candidate('900000002')],
      0,
    );
    expect(group.pool).toEqual([]);
    expect(group.counts).toEqual({ stage1: 2, stage2: 0, stage3: { legalForm: 0 } });
    expect(group.emptyReason).toBe('subject_non_calendar');
  });

  it('reads a calendar year from the dates alone', () => {
    expect(isCalendarYear({ periodeFra: '2025-01-01', periodeTil: '2025-12-31' })).toBe(true);
    expect(isCalendarYear({ periodeFra: '2024-01-01', periodeTil: '2025-12-31' })).toBe(false);
    expect(isCalendarYear({ periodeFra: '2025-01-02', periodeTil: '2025-12-31' })).toBe(false);
    expect(isCalendarYear({ periodeFra: '2025-01-01', periodeTil: '2025-12-30' })).toBe(false);
  });
});

describe('stage 3: legal form', () => {
  it.each(['ASA', 'NUF', 'ENK', 'as', null])('a candidate with legal form %s is out at stage 3', (form) => {
    const group = assemblePeerGroup(subject, [candidate('900000001'), candidate('900000002', { organisasjonsform: form })], 0);
    expect(group.pool.map((peer) => peer.orgnr)).toEqual(['900000001']);
    expect(group.counts).toEqual({ stage1: 2, stage2: 2, stage3: { legalForm: 1 } });
  });
});

describe('counts', () => {
  it('counts each stage on what survived the stage before', () => {
    const candidates = [
      candidate('900000001'), // in
      candidate('900000002', { sumDriftsinntekter: 1n }), // out at 1
      candidate('900000003', { valuta: 'EUR' }), // out at 2
      candidate('900000004', { valuta: 'EUR', organisasjonsform: 'NUF' }), // out at 2, not counted at 3
      candidate('900000005', { organisasjonsform: 'NUF' }), // out at 3
      candidate('900000006', { sumDriftsinntekter: 1n, organisasjonsform: 'NUF' }), // out at 1
    ];
    const group = assemblePeerGroup(subject, candidates, 0);
    expect(group.counts).toEqual({ stage1: 4, stage2: 2, stage3: { legalForm: 1 } });
    expect(group.emptyReason).toBeNull();
  });

  it('reports no empty reason for a group emptied by its candidates', () => {
    expect(assemblePeerGroup(subject, [], 0)).toEqual({
      pool: [],
      counts: { stage1: 0, stage2: 0, stage3: { legalForm: 0 } },
      emptyReason: null,
    });
  });
});

describe('the benchmark filing', () => {
  it('a candidate with no filing in the benchmark year is out before stage 1', () => {
    const group = assemblePeerGroup(subject, [candidate('900000001', { filingYear: 2024, periodeFra: '2024-01-01', periodeTil: '2024-12-31' })], 0);
    expect(group.pool).toEqual([]);
    expect(group.counts.stage1).toBe(0);
  });

  it('uses the benchmark-year filing when the candidate also has another year', () => {
    const filings = [
      candidate('900000001', { filingYear: 2024, periodeFra: '2024-01-01', periodeTil: '2024-12-31', sumDriftsinntekter: S }),
      candidate('900000001', { sumDriftsinntekter: 1n }),
    ];
    // The 2025 filing is out of band; the 2024 one is never read.
    expect(poolOf(filings)).toEqual([]);
  });

  it('prefers the subject’s regnskapstype, then the latest period end, start and id', () => {
    const konsern = candidate('900000001', { regnskapstype: 'KONSERN', periodeTil: '2025-12-31' });
    const early = candidate('900000001', { periodeFra: '2025-01-01', periodeTil: '2025-06-30' });
    const late = candidate('900000001', { periodeFra: '2025-07-01', periodeTil: '2025-12-31' });
    expect(benchmarkFiling([konsern, early, late], 2025, 'SELSKAP')).toBe(late);
    expect(benchmarkFiling([konsern], 2025, 'SELSKAP')).toBe(konsern);
    const lowId = candidate('900000001', { brregId: 10n });
    const highId = candidate('900000001', { brregId: 9_000_000_000_000_000_000n });
    expect(benchmarkFiling([highId, lowId], 2025, 'SELSKAP')).toBe(highId);
    expect(benchmarkFiling([lowId, highId], 2025, 'SELSKAP')).toBe(highId);
    const laterStart = candidate('900000001', { periodeFra: '2025-02-01' });
    expect(benchmarkFiling([candidate('900000001'), laterStart], 2025, 'SELSKAP')).toBe(laterStart);
    expect(benchmarkFiling([konsern], 2024, 'SELSKAP')).toBeNull();
  });

  it('a KONSERN filing chosen for want of a SELSKAP one is out at stage 2', () => {
    expect(poolOf([candidate('900000001', { regnskapstype: 'KONSERN' })])).toEqual([]);
  });

  it('never compares the subject with itself', () => {
    expect(poolOf([candidate(subject.orgnr)])).toEqual([]);
  });
});

describe('the pool', () => {
  it('is sorted by revenue descending, then orgnr', () => {
    const candidates = [
      candidate('900000003', { sumDriftsinntekter: S }),
      candidate('900000001', { sumDriftsinntekter: S }),
      candidate('900000002', { sumDriftsinntekter: S * 2n }),
      candidate('900000004', { sumDriftsinntekter: S / 2n }),
    ];
    expect(poolOf(candidates)).toEqual(['900000002', '900000001', '900000003', '900000004']);
  });

  it('each band’s pool contains the narrower band’s', () => {
    const candidates = [300_000_000n, 400_000_000n, 600_000_000n, 2_500_000_000n, 3_500_000_000n].map((revenue, i) =>
      candidate(`90000000${i}`, { sumDriftsinntekter: revenue }),
    );
    const [b0, b1, b2] = ([0, 1, 2] as const).map((band) => new Set(poolOf(candidates, band)));
    expect([...(b0 ?? [])].every((orgnr) => b1?.has(orgnr))).toBe(true);
    expect([...(b1 ?? [])].every((orgnr) => b2?.has(orgnr))).toBe(true);
    expect([b0?.size, b1?.size, b2?.size]).toEqual([1, 3, 5]);
  });

  it('carries what the caller attached to each candidate', () => {
    const named = { ...candidate('900000001'), navn: 'PEER AS' };
    expect(assemblePeerGroup(subject, [named], 0).pool[0]?.navn).toBe('PEER AS');
  });
});

describe('withoutExcluded', () => {
  it('removes the excluded peers and keeps the order', () => {
    const pool = [candidate('900000002'), candidate('900000001'), candidate('900000003')];
    expect(withoutExcluded(pool, ['900000001', '999999999']).map((peer) => peer.orgnr)).toEqual(['900000002', '900000003']);
  });
});

// Never select on a benchmarked measure, nor on assets or the register's
// employee count: the input types have no field for any of them, so the
// funnel cannot read one. Fails to compile if one is added.
type Forbidden =
  | `${string}${'iendeler' | 'Eiendeler'}${string}`
  | `${string}${'nsatte' | 'Ansatte' | 'mployee'}${string}`
  | `${string}${'resultat' | 'Resultat' | 'margin' | 'Margin'}${string}`
  | `${string}${'aarsverk' | 'Aarsverk'}${string}`;
type AssertNever<T extends never> = T;
export type NoForbiddenSubjectField = AssertNever<Extract<keyof SubjectFiling, Forbidden>>;
export type NoForbiddenCandidateField = AssertNever<Extract<keyof CandidateFiling, Forbidden>>;

it('the funnel inputs hold no assets, employee or performance field', () => {
  const keys = [...Object.keys(subject), ...Object.keys(candidate('900000001'))];
  expect(keys.filter((key) => /eiendeler|ansatte|employee|resultat|margin|aarsverk/i.test(key))).toEqual([]);
});
