// Shared by the analysis specs (split from e2e/analysis.spec.ts in Story
// 2.7, Epic 1 retro action 11): the seed CSVs read as the server reads the
// database, the demo and state subjects picked from them, the engine's
// expected peer group and benchmark on the seed, and the page locators the
// specs share. The orgnrs come from the seed CSVs and ingest/config.toml,
// not from literals.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from './fixtures.ts';
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { benchmarkApiFigures, type ApiBenchmark } from '../src/engine/benchmark.ts';
import { formatMillions, formatOrgnr, formatReadDate } from '../src/engine/format.ts';
import { businessTypeFromColumn, fingerprintFromColumns } from '../src/engine/fingerprint.ts';
import { apiInputsFromRow } from '../src/engine/inputs.ts';
import { assemblePeerGroup, type CandidateFiling, type SizeBand, type SubjectFiling } from '../src/engine/peers.ts';
import { peerRows, type PeerDisplayRow } from '../src/analysis/peer-rows.ts';
import { parseCsv } from '../scripts/seed-format.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };

export const root = path.resolve(import.meta.dirname, '..');

export function csv(name: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(readFileSync(path.join(root, 'seed/demo', name), 'utf8'));
  if (header === undefined) throw new Error(`${name} is empty`);
  return rows
    .filter((row) => row.length === header.length)
    .map((row) => Object.fromEntries(header.map((column, i) => [column, row[i] ?? ''])));
}

/** A timestamptz as COPY writes it ("2026-10-11 10:09:57.319216+00") → Date. */
export function timestamp(text: string): Date {
  return new Date(text.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
}

export const covered = new Set(
  (JSON.parse(readFileSync(path.join(root, 'seed/coverage.json'), 'utf8')) as { code: string }[]).map((e) => e.code),
);
export const companies = csv('company.csv');
export const filings = csv('filing.csv').filter((f) => f.regnskapstype === 'SELSKAP');
export const keyFigures = new Map(csv('key_figures.csv').map((k) => [k.brreg_id, k]));
export const withFiling = new Set(filings.map((f) => f.orgnr));

// The subject's filing as SUBJECT_SQL picks it: newest filing_year, then
// periode_til, periode_fra and brreg_id, each descending.
export const filingOrder = (a: Record<string, string>, b: Record<string, string>): number =>
  Number(b.filing_year) - Number(a.filing_year) ||
  (b.periode_til ?? '').localeCompare(a.periode_til ?? '') ||
  (b.periode_fra ?? '').localeCompare(a.periode_fra ?? '') ||
  (BigInt(b.brreg_id ?? '0') > BigInt(a.brreg_id ?? '0') ? 1 : BigInt(b.brreg_id ?? '0') < BigInt(a.brreg_id ?? '0') ? -1 : 0);

export function newestFiling(orgnr: string): Record<string, string> {
  const own = filings.filter((f) => f.orgnr === orgnr).sort(filingOrder);
  if (own[0] === undefined) throw new Error(`${orgnr} has no filing in the seed`);
  return own[0];
}

export function company(orgnr: string): Record<string, string> {
  const found = companies.find((c) => c.orgnr === orgnr);
  if (found === undefined) throw new Error(`${orgnr} is not in the seed`);
  return found;
}

/** `value`, or an error naming what the seed lacks. An exported const keeps the narrowed type. */
function present<T>(value: T | undefined, missing: string): T {
  if (value === undefined) throw new Error(missing);
  return value;
}

// Demo company A: covered, with a NOK filing (test/db/demo-companies.test.ts).
export const A = company(DEMO_COMPANIES[0].orgnr);
// Demo company C: chosen in Story 1.3a, read from step 1's configuration.
export const C_ORGNR = present(
  /\[demo_company_c\][^[]*?orgnr\s*=\s*"(\d{9})"/.exec(readFileSync(path.join(root, 'ingest/config.toml'), 'utf8'))?.[1],
  'no [demo_company_c] orgnr in ingest/config.toml',
);
export const C = company(C_ORGNR);
// A covered company with no SELSKAP filing and a municipality.
export const NO_FILING = present(
  companies.find(
    (c) => covered.has(c.naeringskode1 ?? '') && !withFiling.has(c.orgnr ?? '') && c.forretningsadresse_kommune !== '',
  ),
  'no covered company without a filing in the seed',
);
export const ABSENT = '910000004'; // valid modulus 11, not in the seed
if (companies.some((c) => c.orgnr === ABSENT)) throw new Error(`${ABSENT} is in the seed`);
// A covered NUF with a SELSKAP filing (the non-AS state), and a covered ENK
// with none (the no-filing state comes first).
export const NON_AS = present(
  companies.find(
    (c) => covered.has(c.naeringskode1 ?? '') && c.organisasjonsform === 'NUF' && withFiling.has(c.orgnr ?? ''),
  ),
  'no covered NUF with a filing in the seed',
);
export const NON_AS_NO_FILING = present(
  companies.find(
    (c) => covered.has(c.naeringskode1 ?? '') && c.organisasjonsform === 'ENK' && !withFiling.has(c.orgnr ?? ''),
  ),
  'no covered ENK without a filing in the seed',
);

// The expected peer group, computed by the engine from the seed CSVs as the
// server computes it from the database.
export const companyByOrgnr = new Map(companies.map((c) => [c.orgnr ?? '', c]));
export const allFilings = csv('filing.csv');
export const bool = (text: string | undefined): boolean | null => (text === 't' ? true : text === 'f' ? false : null);
export const ore = (text: string | undefined): bigint | null => (text === undefined || text === '' ? null : BigInt(text));
export const orNull = (text: string | undefined): string | null => (text === undefined || text === '' ? null : text);
export function comparability(f: Record<string, string>) {
  return {
    regnskapstype: f.regnskapstype ?? '',
    periodeFra: f.periode_fra ?? '',
    periodeTil: f.periode_til ?? '',
    valuta: orNull(f.valuta),
    regnskapsregler: orNull(f.regnskapsregler),
    smaaForetak: bool(f.smaa_foretak),
    avviklingsregnskap: bool(f.avviklingsregnskap),
  };
}
// Story 2.5: the stored fingerprints, by orgnr and filing year, as the
// server's left join reads them.
export const fingerprints = new Map(
  csv('fingerprint.csv').map((f) => [
    `${f.orgnr}/${f.filing_year}`,
    fingerprintFromColumns({
      cost_of_goods_lo: orNull(f.cost_of_goods_lo),
      cost_of_goods_hi: orNull(f.cost_of_goods_hi),
      personnel_cost_lo: orNull(f.personnel_cost_lo),
      personnel_cost_hi: orNull(f.personnel_cost_hi),
      asset_intensity_lo: orNull(f.asset_intensity_lo),
      asset_intensity_hi: orNull(f.asset_intensity_hi),
      inventory: bool(f.inventory),
      capitalised_intangibles: bool(f.capitalised_intangibles),
    }),
  ]),
);
// Story 2.6: the stored classifications' types, by orgnr, as funnel stage 5 reads them.
export const classifications = new Map(
  csv('classification.csv')
    .filter((c) => c.status === 'classified')
    .map((c) => [c.orgnr, businessTypeFromColumn(orNull(c.business_type))]),
);
export const classificationOf = (orgnr: string | undefined) => classifications.get(orgnr) ?? null;
export const fingerprintOf = (orgnr: string | undefined, year: string | undefined) =>
  fingerprints.get(`${orgnr ?? ''}/${year ?? ''}`) ?? null;
export type SeedCandidate = CandidateFiling & { readonly navn: string };
/** The subject's benchmark filing as the funnel reads it. */
export function expectedSubject(orgnr: string): SubjectFiling {
  const own = company(orgnr);
  const filing = newestFiling(orgnr);
  return {
    orgnr,
    naeringskode1: orNull(own.naeringskode1),
    filingYear: Number(filing.filing_year),
    sumDriftsinntekter: ore(keyFigures.get(filing.brreg_id ?? '')?.sum_driftsinntekter_ore),
    fingerprint: fingerprintOf(orgnr, filing.filing_year),
    classification: classificationOf(orgnr),
    ...comparability(filing),
  };
}
export function expectedPeerGroup(orgnr: string, band: SizeBand) {
  const own = company(orgnr);
  const filing = newestFiling(orgnr);
  const subject = expectedSubject(orgnr);
  const candidates: SeedCandidate[] = allFilings
    .filter((f) => f.filing_year === filing.filing_year && f.orgnr !== orgnr)
    .filter((f) => companyByOrgnr.get(f.orgnr ?? '')?.naeringskode1 === own.naeringskode1)
    .map((f) => {
      const c = companyByOrgnr.get(f.orgnr ?? '');
      return {
        orgnr: f.orgnr ?? '',
        navn: c?.navn === undefined || c.navn === '' ? formatOrgnr(f.orgnr ?? '') : c.navn,
        organisasjonsform: orNull(c?.organisasjonsform),
        naeringskode1: orNull(c?.naeringskode1),
        brregId: BigInt(f.brreg_id ?? '0'),
        filingYear: Number(f.filing_year),
        sumDriftsinntekter: ore(keyFigures.get(f.brreg_id ?? '')?.sum_driftsinntekter_ore),
        fingerprint: fingerprintOf(f.orgnr, f.filing_year),
        classification: classificationOf(f.orgnr),
        ...comparability(f),
      };
    });
  return assemblePeerGroup(subject, candidates, band);
}
/** The group after stage 4: what the Peers tab lists and every aggregate uses. */
export const expectedGroup = (orgnr: string, band: SizeBand) => expectedPeerGroup(orgnr, band).group;
/** The candidate pool, stages 1–3: what `ekskl` is checked against. */
export const expectedPool = (orgnr: string, band: SizeBand) => expectedPeerGroup(orgnr, band).pool;

export const coverageSentence = 'dataprogrammeringstjenester (62.100)';
export const dataDate = (orgnr: string) => {
  const filing = newestFiling(orgnr);
  return `Regnskapsår ${filing.filing_year} · hentet ${formatReadDate(timestamp(filing.read_at ?? ''))}`;
};
export const revenue = (orgnr: string) =>
  `Omsetning ${formatMillions(keyFigures.get(newestFiling(orgnr).brreg_id ?? '')?.sum_driftsinntekter_ore ?? '')}`;

export const h1 = (page: Page) => page.locator('main h1');
// The rendered page, not the Suspense fallback: while the stream swaps one
// for the other, both <main> elements can be in the document.
export const rendered = (page: Page) => page.locator('main:not([aria-busy="true"])');
export const tabs = (page: Page) => page.getByRole('navigation', { name: nb['tabs.label'] });
export const notice = (page: Page) => page.getByTestId('settings-notice');
export const headerSearch = (page: Page) => page.getByRole('banner').getByRole('combobox');

export async function noSidewaysScroll(page: Page): Promise<void> {
  const scroll = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(scroll.doc).toBeLessThanOrEqual(scroll.inner);
  expect(scroll.body).toBeLessThanOrEqual(scroll.inner);
}

// The engine's benchmark on the seed, as the server computes it from the
// database: the subject's newest filing against the shown group.
export function keyFigureRow(brregId: string) {
  const k = keyFigures.get(brregId);
  const value = (column: string): string | null => {
    const text = k?.[column];
    return text === undefined || text === '' ? null : text;
  };
  return {
    sum_driftsinntekter_ore: value('sum_driftsinntekter_ore'),
    driftsresultat_ore: value('driftsresultat_ore'),
    sum_driftskostnad_ore: value('sum_driftskostnad_ore'),
    sum_eiendeler_ore: value('sum_eiendeler_ore'),
    sum_egenkapital_gjeld_ore: value('sum_egenkapital_gjeld_ore'),
    sum_egenkapital_ore: value('sum_egenkapital_ore'),
    sum_gjeld_ore: value('sum_gjeld_ore'),
  };
}
export function expectedBenchmark(orgnr: string, band: SizeBand, ekskl: readonly string[] = []): ApiBenchmark {
  const filing = newestFiling(orgnr);
  const peers = expectedGroup(orgnr, band).filter((peer) => !ekskl.includes(peer.orgnr));
  return benchmarkApiFigures(
    apiInputsFromRow(keyFigureRow(filing.brreg_id ?? '')),
    peers.map((peer) => apiInputsFromRow(keyFigureRow(String(peer.brregId)))),
    orNull(filing.valuta),
  );
}

// Covered AS subjects from the seed, by what their newest filing holds.
export const coveredAs = companies.filter(
  (c) => covered.has(c.naeringskode1 ?? '') && c.organisasjonsform === 'AS' && withFiling.has(c.orgnr ?? ''),
);
export const revenueOf = (c: Record<string, string>) =>
  keyFigures.get(newestFiling(c.orgnr ?? '').brreg_id ?? '')?.sum_driftsinntekter_ore ?? '';
export const isCalendar = (c: Record<string, string>) => {
  const f = newestFiling(c.orgnr ?? '');
  return /-01-01$/.test(f.periode_fra ?? '') && /-12-31$/.test(f.periode_til ?? '') && f.periode_fra?.slice(0, 4) === f.periode_til?.slice(0, 4);
};
export const pick = (label: string, test: (c: Record<string, string>) => boolean) => {
  const found = coveredAs.find(test);
  if (found === undefined) throw new Error(`no covered AS with ${label} in the seed`);
  return found;
};
// Positive revenue and a non-calendar financial year: an empty group, with its reason.
export const nonCalendar = pick('a non-calendar year and positive revenue', (c) => /^\d+$/.test(revenueOf(c)) && revenueOf(c) !== '0' && !isCalendar(c));

// Story 2.7: the Peers tab's rows as the engine computes them from the seed,
// the same peerRows the page renders.
export function expectedRows(orgnr: string, band: SizeBand): PeerDisplayRow[] {
  const own = company(orgnr);
  const group = expectedPeerGroup(orgnr, band);
  const peers = group.group.map((peer) => ({ ...peer, keyFigures: keyFigureRow(String(peer.brregId)) }));
  return peerRows(
    expectedSubject(orgnr),
    own.navn === undefined || own.navn === '' ? formatOrgnr(orgnr) : own.navn,
    peers,
    group.flagged,
    orNull(newestFiling(orgnr).valuta),
  );
}

// Story 2.7: the labelled set's orgnrs (Story 5.1's draw). A test whose
// subject or peers may be among them compares totals only and names no
// company.
export const labelled = new Set(
  (
    JSON.parse(readFileSync(path.join(root, 'analysis/labelled-set/document-run.json'), 'utf8')) as {
      orgnr: string;
    }[]
  ).map((entry) => entry.orgnr),
);

let floor: string | null = null;
/**
 * Story 2.8: a covered AS outside the labelled set whose group at band 0
 * has 11–30 peers, so a few exclusions take it to 10 and then below the
 * floor: excluding all but the last 10 (in group order) leaves driftsmargin
 * compared on 10, and excluding one more takes it below the floor on 9.
 * Picked from the seed when first asked for, then kept. Its orgnr is never
 * named in a test title, and its peers only by count.
 */
export function floorSubject(): string {
  if (floor !== null) return floor;
  for (const c of coveredAs) {
    const orgnr = c.orgnr ?? '';
    if (labelled.has(orgnr) || !isCalendar(c) || !/^\d+$/.test(revenueOf(c)) || revenueOf(c) === '0') continue;
    if (orgnr === A.orgnr) continue;
    const group = expectedGroup(orgnr, 0);
    if (group.length < 11 || group.length > 30) continue;
    const excluded = (n: number) => group.slice(0, n).map((peer) => peer.orgnr);
    const atTen = expectedBenchmark(orgnr, 0, excluded(group.length - 10)).driftsmargin.comparison;
    const atNine = expectedBenchmark(orgnr, 0, excluded(group.length - 9)).driftsmargin.comparison;
    if (atTen.kind === 'compared' && atTen.count === 10 && atNine.kind === 'below_floor' && atNine.count === 9) {
      floor = orgnr;
      return orgnr;
    }
  }
  throw new Error('no covered AS outside the labelled set with 11–30 peers at band 0 in the seed');
}
