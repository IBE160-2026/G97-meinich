// A failed subject read (Story 1.6b): the database client throws, and the
// lookup throws a new error with a fixed message — no driver message, query,
// address or orgnr — so the analysis layout and page throw too. They never
// call notFound() or redirect(): Next.js answers 500 and the global error
// page shows only the alert. The log line names only the error's class and
// SQLSTATE. A failed candidate read (Story 1.7) fails the same way, also
// when the subject read before it succeeds. So does a failed coverage read
// (Epic 1 follow-ups, retro R1 and R4): on the front page, and for an
// uncovered company, where the page reads it before its Suspense boundary.
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

class PostgresError extends Error {
  readonly code = '57014';
}

const DRIVER_MESSAGE = 'canceling statement due to statement timeout: select … 813235552';

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('SENTINEL notFound');
  }),
  redirect: vi.fn(() => {
    throw new Error('SENTINEL redirect');
  }),
}));

// By default the client itself throws. With `subjectRow` set, the subject
// query (sql.unsafe, the one that names register.covered_industry) returns
// it, and every other query throws: the candidate read (sql.unsafe) and the
// coverage read (src/server/search.ts, a tagged template, so a call of the
// client itself).
const database = vi.hoisted(() => ({ subjectRow: null as Record<string, unknown> | null }));

vi.mock('server-only', () => ({}));
vi.mock('../../src/server/db.ts', () => ({
  readerSql: () => {
    const row = database.subjectRow;
    if (row === null) throw new PostgresError(DRIVER_MESSAGE);
    const sql = async () => {
      throw new PostgresError(DRIVER_MESSAGE);
    };
    return Object.assign(sql, {
      unsafe: async (query: string) => {
        if (query.includes('register.covered_industry')) return [row];
        throw new PostgresError(DRIVER_MESSAGE);
      },
    });
  },
}));
vi.mock('next/navigation', () => navigation);
// The front page awaits connection() first; outside a request it would throw.
vi.mock('next/server', () => ({ connection: async () => {} }));

const { lookupCandidates, lookupSubject } = await import('../../src/server/analysis.ts');
const { failureKind } = await import('../../src/logger.ts');
const { default: AnalysisLayout } = await import('../../src/app/analyse/[orgnr]/layout.tsx');
const { AnalysisPage, analysisMetadata } = await import('../../src/components/analysis/analysis-page.tsx');
const { default: HomePage } = await import('../../src/app/page.tsx');

const ORGNR = '813235552';
const FIXED = 'analysis: subject lookup failed';

afterEach(() => {
  database.subjectRow = null;
  vi.restoreAllMocks();
  navigation.notFound.mockClear();
  navigation.redirect.mockClear();
});

/** Awaits `run`, expects it to throw the fixed error, and returns what was logged. */
async function expectFixedThrow(run: () => Promise<unknown>, fixed: string = FIXED): Promise<string> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = await run().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(fixed);
  expect((error as Error).message).not.toContain(ORGNR);
  expect(error).not.toHaveProperty('cause');
  expect(navigation.notFound).not.toHaveBeenCalled();
  expect(navigation.redirect).not.toHaveBeenCalled();
  return log.mock.calls.flat().join(' ');
}

describe('a failed subject read', () => {
  it('throws a fixed error, and the log names only the class and the SQLSTATE', async () => {
    const logged = await expectFixedThrow(() => lookupSubject(ORGNR));
    expect(logged).toBe('{"level":"error","event":"analysis.subjectFailed","failure":"PostgresError 57014"}');
    expect(logged).not.toContain('statement timeout');
  });

  it('makes the layout throw, not answer 404', async () => {
    await expectFixedThrow(() =>
      AnalysisLayout({ children: createElement('p', null, 'children'), params: Promise.resolve({ orgnr: ORGNR }) }),
    );
  });

  it.each([{ orgnr: ORGNR }, { orgnr: ORGNR, fane: 'peers' }])(
    'makes the page and its metadata throw, not answer 404 or redirect: %o',
    async (segments) => {
      await expectFixedThrow(() => AnalysisPage({ segments, searchParams: {} }));
      await expectFixedThrow(() => analysisMetadata(segments, {}));
    },
  );
});

describe('a failed candidate read (Story 1.7)', () => {
  it('throws its own fixed error, and the log names only the class and the SQLSTATE', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = await lookupCandidates(ORGNR, '62.100', 2025).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect((error as Error).message).toBe('analysis: candidate lookup failed');
    expect(error).not.toHaveProperty('cause');
    expect(log.mock.calls.flat().join(' ')).toBe(
      '{"level":"error","event":"analysis.candidatesFailed","failure":"PostgresError 57014"}',
    );
  });
});

describe('a failed candidate read after a successful subject read (Story 1.7)', () => {
  // A covered AS with a calendar-year NOK filing: the page goes on to read
  // its candidates, and that read fails.
  const coveredAs = {
    orgnr: ORGNR,
    navn: 'ADMMIT AS',
    organisasjonsform: 'AS',
    naeringskode1: '62.100',
    naeringskode1_beskrivelse: 'Dataprogrammeringstjenester',
    forretningsadresse_kommune: 'VINDAFJORD',
    covered: true,
    filing_year: 2025,
    regnskapstype: 'SELSKAP',
    periode_fra: '2025-01-01',
    periode_til: '2025-12-31',
    valuta: 'NOK',
    regnskapsregler: 'regnskapslovenAlminneligRegler',
    smaa_foretak: true,
    avviklingsregnskap: false,
    filing_read_at: new Date('2026-10-11T10:09:57Z'),
    sum_driftsinntekter_ore: '1670000000',
    driftsresultat_ore: '35070000',
    sum_driftskostnad_ore: null,
    sum_eiendeler_ore: '800000000',
    sum_egenkapital_gjeld_ore: null,
    sum_egenkapital_ore: '300000000',
    sum_gjeld_ore: null,
  };

  it.each([{ orgnr: ORGNR, fane: 'peers' }, { orgnr: ORGNR }])(
    'makes the page and its metadata throw the candidate error, not answer 404 or redirect: %o',
    async (segments) => {
      database.subjectRow = coveredAs;
      for (const run of [() => AnalysisPage({ segments, searchParams: {} }), () => analysisMetadata(segments, {})]) {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = await run().then(
          () => null,
          (thrown: unknown) => thrown,
        );
        expect((error as Error).message).toBe('analysis: candidate lookup failed');
        expect(error).not.toHaveProperty('cause');
        expect(log.mock.calls.flat().join(' ')).toBe(
          '{"level":"error","event":"analysis.candidatesFailed","failure":"PostgresError 57014"}',
        );
        expect(navigation.notFound).not.toHaveBeenCalled();
        expect(navigation.redirect).not.toHaveBeenCalled();
        log.mockRestore();
      }
    },
  );
});

describe('a failed coverage read on the front page (retro R1)', () => {
  it('throws a fixed error, and the log names only the class and the SQLSTATE', async () => {
    const logged = await expectFixedThrow(() => HomePage(), 'home: coverage lookup failed');
    expect(logged).toBe('{"level":"error","event":"home.coverageFailed","failure":"PostgresError 57014"}');
    expect(logged).not.toContain('statement timeout');
  });
});

describe('a failed coverage read for an uncovered company (retro R4)', () => {
  // The subject read succeeds: an AS with a filing in an industry Peerless
  // does not cover, so the page has no candidates to read and goes on to
  // the coverage read. AnalysisPage itself must reject: had the read stayed
  // below the Suspense boundary, the page would resolve to the boundary and
  // the failure would come after the response had started as a 200.
  const uncoveredAs = {
    orgnr: ORGNR,
    navn: 'DEMO C AS',
    organisasjonsform: 'AS',
    naeringskode1: '69.202',
    naeringskode1_beskrivelse: 'Bokføring',
    forretningsadresse_kommune: 'VINDAFJORD',
    covered: false,
    filing_year: 2025,
    regnskapstype: 'SELSKAP',
    periode_fra: '2025-01-01',
    periode_til: '2025-12-31',
    valuta: 'NOK',
    regnskapsregler: 'regnskapslovenAlminneligRegler',
    smaa_foretak: true,
    avviklingsregnskap: false,
    filing_read_at: new Date('2026-10-11T10:09:57Z'),
    sum_driftsinntekter_ore: '1670000000',
    driftsresultat_ore: '35070000',
    sum_driftskostnad_ore: null,
    sum_eiendeler_ore: '800000000',
    sum_egenkapital_gjeld_ore: null,
    sum_egenkapital_ore: '300000000',
    sum_gjeld_ore: null,
  };

  it('makes the page throw a fixed error before its Suspense boundary', async () => {
    database.subjectRow = uncoveredAs;
    const logged = await expectFixedThrow(
      () => AnalysisPage({ segments: { orgnr: ORGNR }, searchParams: {} }),
      'analysis: coverage lookup failed',
    );
    expect(logged).toBe('{"level":"error","event":"analysis.coverageFailed","failure":"PostgresError 57014"}');
    expect(logged).not.toContain('statement timeout');
  });
});

describe('failureKind', () => {
  it('names the class, and a SQLSTATE only when it is one', () => {
    expect(failureKind(new PostgresError('x'))).toBe('PostgresError 57014');
    expect(failureKind(new TypeError('x'))).toBe('TypeError');
    expect(failureKind(Object.assign(new Error('x'), { code: 'ECONNREFUSED 127.0.0.1' }))).toBe('Error');
    expect(failureKind('text')).toBe('string');
  });
});
