// Which state an analysis URL opens in (Story 1.6b): every row of the
// spec's I/O matrix, decided by the pure analysisView.
import { describe, expect, it } from 'vitest';
import { URL_CONTEXT, analysisView, displayName, type Subject } from '../../src/analysis/view.ts';
import { parse, parseSegments } from '../../src/url/analysis-state.ts';

// Valid modulus-11 numbers; which company they stand for is set below.
const COVERED = '813235552';
const UNCOVERED = '967534579';
const NO_FILING = '813069032';
const ABSENT = '910000004';

const filing = {
  filingYear: 2025,
  valuta: 'NOK',
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
  naeringskode1: '00.001',
  naeringskode1Beskrivelse: 'Dekket bransje',
  kommune: 'VINDAFJORD',
  covered: true,
  filing,
};
const uncovered: Subject = { ...covered, orgnr: UNCOVERED, navn: 'KANTALL AS', naeringskode1: '00.002', covered: false };
const noFiling: Subject = { ...covered, orgnr: NO_FILING, navn: 'UTEN REGNSKAP AS', filing: null };

function view(subject: Subject | null, segments: { orgnr: string; fane?: string }, search = '') {
  return analysisView(subject, parseSegments(segments, search, URL_CONTEXT), search);
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
    const landed = analysisView(subject, parse(target, URL_CONTEXT), url.search);
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

describe('URL_CONTEXT', () => {
  it('accepts every candidate until Story 1.7 and has no median step until Story 3.5', () => {
    expect(URL_CONTEXT.isCandidate('910000004')).toBe(true);
    expect(URL_CONTEXT.medianStepExists({ orgnr: COVERED, band: 0, ekskl: [] })).toBe(false);
  });
});
