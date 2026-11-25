// Which state an analysis URL opens in (Stories 1.6b and 1.7): every row of
// the specs' I/O matrices, decided by the pure analysisView, and the
// precedence no filing → uncovered → non-AS → covered.
import { describe, expect, it } from 'vitest';
import {
  PATH_CONTEXT,
  analysisView,
  displayName,
  funnelSubject,
  hasPeerGroup,
  urlContext,
  type Subject,
} from '../../src/analysis/view.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import type { Comparison } from '../../src/engine/types.ts';
import { parse, parseSegments, type Band } from '../../src/url/analysis-state.ts';

// Valid modulus-11 numbers; which company they stand for is set below.
const COVERED = '813235552';
const UNCOVERED = '967534579';
const NO_FILING = '813069032';
const NON_AS = '811873772';
const ABSENT = '910000004';

const filing = {
  filingYear: 2025,
  valuta: 'NOK',
  regnskapstype: 'SELSKAP',
  periodeFra: '2025-01-01',
  periodeTil: '2025-12-31',
  regnskapsregler: 'regnskapslovenAlminneligRegler',
  smaaForetak: true,
  avviklingsregnskap: false,
  readAt: new Date('2026-10-11T13:36:34Z'),
  brregId: 1n,
  fingerprint: null,
  classification: null,
  documentBasis: { kind: 'not_in_dataset' },
  documentFacts: { readAt: null, brregId: null, current: null },
  keyFigures: {
    sum_driftsinntekter_ore: '1670000000',
    driftsresultat_ore: '35070000',
    sum_driftskostnad_ore: null,
    sum_eiendeler_ore: '800000000',
    sum_egenkapital_gjeld_ore: null,
    sum_egenkapital_ore: '300000000',
    sum_gjeld_ore: null,
  },
} as const;

const covered: Subject = {
  orgnr: COVERED,
  navn: 'ADMMIT AS',
  organisasjonsform: 'AS',
  naeringskode1: '00.001',
  naeringskode1Beskrivelse: 'Dekket bransje',
  kommune: 'VINDAFJORD',
  covered: true,
  filing,
};
const uncovered: Subject = { ...covered, orgnr: UNCOVERED, navn: 'KANTALL AS', naeringskode1: '00.002', covered: false };
const noFiling: Subject = { ...covered, orgnr: NO_FILING, navn: 'UTEN REGNSKAP AS', filing: null };
const nonAs: Subject = { ...covered, orgnr: NON_AS, navn: 'UTENLANDSK NUF', organisasjonsform: 'NUF' };

function view(subject: Subject | null, segments: { orgnr: string; fane?: string }, search = '') {
  return analysisView(subject, parseSegments(segments, search, PATH_CONTEXT), search);
}

describe('covered company with a filing', () => {
  // FR-71 (Story 2.9): a subject whose own document failed reconciliation,
  // or that has none at all, keeps its tabs and peer group.
  it('a failed filing stays covered', () => {
    for (const documentBasis of [
      { kind: 'failed_reconciliation', filingYear: 2025 },
      { kind: 'refused', filingYear: 2025 },
      { kind: 'document_missing', filingYear: 2025 },
      { kind: 'not_read_in_v1', scope: 'paper', filingYear: 2025 },
    ] as const) {
      const failed: Subject = { ...covered, filing: { ...filing, documentBasis } };
      expect(view(failed, { orgnr: COVERED, fane: 'peers' }), documentBasis.kind).toEqual(
        view(covered, { orgnr: COVERED, fane: 'peers' }),
      );
      expect(view(failed, { orgnr: COVERED, fane: 'nokkeltall' }).state).toBe('covered');
      expect(view(failed, { orgnr: COVERED }).redirect).toBe(`/analyse/${COVERED}/oversikt`);
    }
  });

  it('redirects the bare path to Oversikt', () => {
    expect(view(covered, { orgnr: COVERED })).toEqual({
      state: 'covered',
      redirect: `/analyse/${COVERED}/oversikt`,
      fane: null,
      notice: false,
      medianNotice: false,
      title: 'Peerless',
    });
  });

  it('keeps the query on that redirect, canonically when nothing fell back', () => {
    expect(view(covered, { orgnr: COVERED }, '?utm_source=x&band=1').redirect).toBe(`/analyse/${COVERED}/oversikt?band=1`);
  });

  it('keeps the query as it came when a value fell back, so the target shows the notice', () => {
    expect(view(covered, { orgnr: COVERED }, '?band=x').redirect).toBe(`/analyse/${COVERED}/oversikt?band=x`);
  });

  it.each([
    ['oversikt', 'Oversikt'],
    ['peers', 'Peers'],
    ['nokkeltall', 'Nøkkeltall og gap'],
  ] as const)('renders the %s tab with its title', (fane, label) => {
    expect(view(covered, { orgnr: COVERED, fane })).toEqual({
      state: 'covered',
      redirect: null,
      fane,
      notice: false,
      medianNotice: false,
      title: `ADMMIT AS – ${label} – Peerless`,
    });
  });

  it('renders Peers with the notice when a setting fell back', () => {
    expect(view(covered, { orgnr: COVERED, fane: 'peers' }, '?band=x')).toMatchObject({
      redirect: null,
      fane: 'peers',
      notice: true,
    });
  });

  it('renders Verdi with no notice (Story 3.5)', () => {
    expect(view(covered, { orgnr: COVERED, fane: 'verdi' })).toEqual({
      state: 'covered',
      redirect: null,
      fane: 'verdi',
      notice: false,
      medianNotice: false,
      title: 'ADMMIT AS – Verdi – Peerless',
    });
  });

  it.each(['foo'])('renders Oversikt for /%s with the notice and no redirect', (fane) => {
    expect(view(covered, { orgnr: COVERED, fane })).toEqual({
      state: 'covered',
      redirect: null,
      fane: 'oversikt',
      notice: true,
      medianNotice: false,
      title: 'ADMMIT AS – Oversikt – Peerless',
    });
  });

  it('titles a company without a name by its orgnr in groups of three', () => {
    // Grouped with U+00A0, as formatOrgnr writes it.
    expect(view({ ...covered, navn: null }, { orgnr: COVERED, fane: 'peers' }).title).toBe(
      '813 235 552 – Peers – Peerless',
    );
    expect(displayName({ orgnr: COVERED, navn: null })).toBe('813 235 552');
  });
});

describe.each([
  ['uncovered', uncovered, UNCOVERED, 'KANTALL AS'],
  ['no-filing', noFiling, NO_FILING, 'UTEN REGNSKAP AS'],
  ['non-as', nonAs, NON_AS, 'UTENLANDSK NUF'],
] as const)('%s company', (state, subject, orgnr, navn) => {
  it('renders the bare path with no tabs', () => {
    expect(view(subject, { orgnr })).toEqual({
      state,
      redirect: null,
      fane: null,
      notice: false,
      medianNotice: false,
      title: `${navn} – Peerless`,
    });
  });

  it('shows the notice on the bare path when a setting fell back', () => {
    expect(view(subject, { orgnr }, '?andel=33').notice).toBe(true);
  });

  it.each(['oversikt', 'peers', 'nokkeltall', 'verdi', 'foo'])('redirects /%s to the bare path', (fane) => {
    expect(view(subject, { orgnr, fane }).redirect).toBe(`/analyse/${orgnr}`);
  });

  it('keeps the query on that redirect', () => {
    expect(view(subject, { orgnr, fane: 'peers' }, '?band=1').redirect).toBe(`/analyse/${orgnr}?band=1`);
    expect(view(subject, { orgnr, fane: 'peers' }, '?band=x').redirect).toBe(`/analyse/${orgnr}?band=x`);
  });

  // The tab is irrelevant here (no tabs), so a fallback in the tab itself is
  // dropped by the redirect; only a fallback in the query reaches the target.
  it.each([
    ['verdi', '', false],
    ['foo', '', false],
    ['foo', '?band=1', false],
    ['verdi', '?band=x', true],
    ['foo', '?band=x', true],
  ])('/%s%s redirects to a target that shows the notice: %s', (fane, search, notice) => {
    const target = view(subject, { orgnr, fane }, search).redirect;
    if (target === null) throw new Error('expected a redirect');
    const url = new URL(target, 'http://x');
    const landed = analysisView(subject, parse(target, PATH_CONTEXT), url.search);
    expect(landed).toMatchObject({ state, redirect: null, notice });
  });
});

it('a company with no SELSKAP filing is in the no-filing state even when its industry is uncovered', () => {
  expect(view({ ...uncovered, filing: null }, { orgnr: UNCOVERED }).state).toBe('no-filing');
});

it('a valid orgnr not in the database is not found, titled "Peerless"', () => {
  expect(view(null, { orgnr: ABSENT })).toEqual({
    state: 'not-found',
    redirect: null,
    fane: null,
    notice: false,
    medianNotice: false,
    title: 'Peerless',
  });
});

it.each(['12345678', '123456789', '1234567890', 'abc'])('%s is an invalid orgnr, titled "Peerless"', (orgnr) => {
  expect(view(null, { orgnr })).toEqual({
    state: 'invalid-orgnr',
    redirect: null,
    fane: null,
    notice: false,
    medianNotice: false,
    title: 'Peerless',
  });
});

describe('precedence: no filing, then uncovered, then non-AS, then covered', () => {
  it.each([
    ['no filing, uncovered, not an AS', { ...covered, filing: null, covered: false, organisasjonsform: 'ENK' }, 'no-filing'],
    ['no filing, covered, not an AS', { ...covered, filing: null, organisasjonsform: 'ENK' }, 'no-filing'],
    ['uncovered, not an AS', { ...covered, covered: false, organisasjonsform: 'NUF' }, 'uncovered'],
    ['covered, an ASA', { ...covered, organisasjonsform: 'ASA' }, 'non-as'],
    ['covered, no legal form', { ...covered, organisasjonsform: null }, 'non-as'],
    ['covered, an AS', covered, 'covered'],
  ] as const)('%s → %s', (_label, subject, state) => {
    expect(view(subject, { orgnr: COVERED }).state).toBe(state);
    expect(hasPeerGroup(subject)).toBe(state === 'covered');
  });
});

describe('PATH_CONTEXT', () => {
  it('accepts every candidate and has no median step (path-only parsing)', () => {
    expect(PATH_CONTEXT.isCandidate('910000004', 0)).toBe(true);
    expect(PATH_CONTEXT.medianStepExists({ orgnr: COVERED, band: 0, ekskl: [] })).toBe(false);
  });
});

describe('urlContext resolves the median step (Story 3.5)', () => {
  const PEER = '910000004';
  /** Driftsmargin −5 % against median m and beste fjerdedel 5 %. */
  const margin = (m: string): Comparison => ({
    kind: 'compared',
    subject: new Decimal('-0.05'),
    source: 'api',
    count: 12,
    leftOut: 0,
    median: new Decimal(m),
    lowerQuartile: new Decimal('-0.1'),
    upperQuartile: new Decimal('0.05'),
    p5: new Decimal('-0.2'),
    p95: new Decimal('0.2'),
    // A hand-made comparison: no test here reads its distribution (Story 3.7's "Vis fordelingen").
    sorted: [],
    best: { quartile: new Decimal('0.05'), percentile: new Decimal('40') },
  });
  const asked: { band: Band; ekskl: readonly string[] }[] = [];
  // Fixture: at band 0 with no exclusion r < M < T (a step exists); excluding PEER moves the median below r (none).
  const context = urlContext(
    () => new Set([PEER]),
    (band, ekskl) => {
      asked.push({ band, ekskl });
      return ekskl.includes(PEER) ? margin('-0.06') : margin('-0.03');
    },
  );

  it('urlContext resolves the median step', () => {
    const kept = parseSegments({ orgnr: COVERED, fane: 'verdi' }, '?andel=median', context);
    expect(kept).toMatchObject({ kind: 'analysis', state: { andel: 'median' }, invalidSettings: false });
    expect(analysisView(covered, kept, '?andel=median').notice).toBe(false);
    // The predicate is asked about the group the URL names: its band and its exclusions.
    const search = `?ekskl=${PEER}&band=1&andel=median`;
    const dropped = parseSegments({ orgnr: COVERED, fane: 'verdi' }, search, context);
    expect(dropped).toMatchObject({
      kind: 'analysis',
      state: { andel: 50, ekskl: [PEER], band: 1 },
      invalidSettings: false,
      medianFallback: true,
    });
    expect(asked).toEqual([
      { band: 0, ekskl: [] },
      { band: 1, ekskl: [PEER] },
    ]);
    // Story 5.4: the median notice, not the invalid-settings notice.
    expect(analysisView(covered, dropped, search)).toMatchObject({ notice: false, medianNotice: true });
    // No group: no median step.
    const none = urlContext(() => new Set(), () => null);
    expect(parseSegments({ orgnr: COVERED, fane: 'verdi' }, '?andel=median', none)).toMatchObject({
      state: { andel: 50 },
      invalidSettings: false,
      medianFallback: true,
    });
  });

  // Story 5.4 (deferred from Story 3.5): a peer change that leaves no median
  // step shows analysis.notice.median, on the tab and on the bare path's
  // redirect target, and a kept median shows neither notice.
  it('andel=median with no median step shows the median notice, not analysis.notice', () => {
    const none = urlContext(() => new Set(), () => null);
    const onTab = parseSegments({ orgnr: COVERED, fane: 'verdi' }, '?andel=median', none);
    expect(analysisView(covered, onTab, '?andel=median')).toMatchObject({ redirect: null, notice: false, medianNotice: true });
    const bare = parseSegments({ orgnr: COVERED }, '?andel=median', none);
    const target = analysisView(covered, bare, '?andel=median').redirect;
    expect(target).toBe(`/analyse/${COVERED}/oversikt?andel=median`);
    const landed = parseSegments({ orgnr: COVERED, fane: 'oversikt' }, '?andel=median', none);
    expect(analysisView(covered, landed, '?andel=median')).toMatchObject({ notice: false, medianNotice: true });
    const kept = parseSegments({ orgnr: COVERED, fane: 'verdi' }, '?andel=median', context);
    expect(analysisView(covered, kept, '?andel=median')).toMatchObject({ notice: false, medianNotice: false });
  });
});

describe('urlContext', () => {
  const IN_BAND_0 = '910000004';
  const IN_BAND_1 = '910000012';
  const context = urlContext(
    (band) => (band === 0 ? new Set([IN_BAND_0]) : new Set([IN_BAND_0, IN_BAND_1])),
    () => null,
  );

  it('asks the pool at the band it is given', () => {
    expect(context.isCandidate(IN_BAND_1, 0)).toBe(false);
    expect(context.isCandidate(IN_BAND_1, 1)).toBe(true);
    expect(context.medianStepExists({ orgnr: COVERED, band: 0, ekskl: [] })).toBe(false);
  });

  it('keeps a pool peer and drops one outside it with the notice', () => {
    const search = `?ekskl=${IN_BAND_0},${IN_BAND_1}`;
    const parsed = parseSegments({ orgnr: COVERED, fane: 'peers' }, search, context);
    expect(parsed).toMatchObject({ kind: 'analysis', state: { ekskl: [IN_BAND_0] }, invalidSettings: true });
    expect(analysisView(covered, parsed, search).notice).toBe(true);
  });

  it('keeps a widened-band peer only at that band', () => {
    const widened = parseSegments({ orgnr: COVERED, fane: 'peers' }, `?band=1&ekskl=${IN_BAND_1}`, context);
    expect(widened).toMatchObject({ state: { band: 1, ekskl: [IN_BAND_1] }, invalidSettings: false });
  });
});

describe('funnelSubject', () => {
  it('hands the engine the benchmark filing with revenue as bigint øre', () => {
    expect(funnelSubject(covered)).toEqual({
      orgnr: COVERED,
      naeringskode1: '00.001',
      filingYear: 2025,
      sumDriftsinntekter: 1670000000n,
      regnskapstype: 'SELSKAP',
      periodeFra: '2025-01-01',
      periodeTil: '2025-12-31',
      valuta: 'NOK',
      regnskapsregler: 'regnskapslovenAlminneligRegler',
      smaaForetak: true,
      avviklingsregnskap: false,
      fingerprint: null,
      classification: null,
    });
    expect(funnelSubject(noFiling)).toBeNull();
  });

  it('hands the engine the filing’s stored fingerprint', () => {
    const fingerprint = {
      costOfGoods: { lo: 'low', hi: 'low' },
      personnelCost: { lo: 'mid', hi: 'high' },
      assetIntensity: { lo: 'low', hi: 'low' },
      inventory: null,
      capitalisedIntangibles: false,
    } as const;
    const filing = covered.filing;
    if (filing === null) throw new Error('covered has a filing');
    expect(funnelSubject({ ...covered, filing: { ...filing, fingerprint } })?.fingerprint).toBe(fingerprint);
  });
});
