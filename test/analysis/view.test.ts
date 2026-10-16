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
import { parse, parseSegments } from '../../src/url/analysis-state.ts';

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
  it('redirects the bare path to Oversikt', () => {
    expect(view(covered, { orgnr: COVERED })).toEqual({
      state: 'covered',
      redirect: `/analyse/${COVERED}/oversikt`,
      fane: null,
      notice: false,
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

  it.each(['verdi', 'foo'])('renders Oversikt for /%s with the notice and no redirect', (fane) => {
    expect(view(covered, { orgnr: COVERED, fane })).toEqual({
      state: 'covered',
      redirect: null,
      fane: 'oversikt',
      notice: true,
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
    title: 'Peerless',
  });
});

it.each(['12345678', '123456789', '1234567890', 'abc'])('%s is an invalid orgnr, titled "Peerless"', (orgnr) => {
  expect(view(null, { orgnr })).toEqual({
    state: 'invalid-orgnr',
    redirect: null,
    fane: null,
    notice: false,
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
  it('accepts every candidate (path-only parsing) and has no median step until Story 3.5', () => {
    expect(PATH_CONTEXT.isCandidate('910000004', 0)).toBe(true);
    expect(PATH_CONTEXT.medianStepExists({ orgnr: COVERED, band: 0, ekskl: [] })).toBe(false);
  });
});

describe('urlContext', () => {
  const IN_BAND_0 = '910000004';
  const IN_BAND_1 = '910000012';
  const context = urlContext((band) => (band === 0 ? new Set([IN_BAND_0]) : new Set([IN_BAND_0, IN_BAND_1])));

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
    });
    expect(funnelSubject(noFiling)).toBeNull();
  });
});
