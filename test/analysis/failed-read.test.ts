// A failed subject read (Story 1.6b): the database client throws, and the
// lookup throws a new error with a fixed message — no driver message, query,
// address or orgnr — so the analysis layout and page throw too. They never
// call notFound() or redirect(): Next.js answers 500 and the global error
// page shows only the alert. The log line names only the error's class and
// SQLSTATE.
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

vi.mock('server-only', () => ({}));
vi.mock('../../src/server/db.ts', () => ({
  readerSql: () => {
    throw new PostgresError(DRIVER_MESSAGE);
  },
}));
vi.mock('next/navigation', () => navigation);

const { lookupSubject, failureKind } = await import('../../src/server/analysis.ts');
const { default: AnalysisLayout } = await import('../../src/app/analyse/[orgnr]/layout.tsx');
const { AnalysisPage, analysisMetadata } = await import('../../src/components/analysis/analysis-page.tsx');

const ORGNR = '813235552';
const FIXED = 'analysis: subject lookup failed';

afterEach(() => {
  vi.restoreAllMocks();
  navigation.notFound.mockClear();
  navigation.redirect.mockClear();
});

/** Awaits `run`, expects it to throw the fixed error, and returns what was logged. */
async function expectFixedThrow(run: () => Promise<unknown>): Promise<string> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = await run().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(FIXED);
  expect((error as Error).message).not.toContain(ORGNR);
  expect(error).not.toHaveProperty('cause');
  expect(navigation.notFound).not.toHaveBeenCalled();
  expect(navigation.redirect).not.toHaveBeenCalled();
  return log.mock.calls.flat().join(' ');
}

describe('a failed subject read', () => {
  it('throws a fixed error, and the log names only the class and the SQLSTATE', async () => {
    const logged = await expectFixedThrow(() => lookupSubject(ORGNR));
    expect(logged).toBe('analysis: subject lookup failed (PostgresError 57014)');
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

describe('failureKind', () => {
  it('names the class, and a SQLSTATE only when it is one', () => {
    expect(failureKind(new PostgresError('x'))).toBe('PostgresError 57014');
    expect(failureKind(new TypeError('x'))).toBe('TypeError');
    expect(failureKind(Object.assign(new Error('x'), { code: 'ECONNREFUSED 127.0.0.1' }))).toBe('Error');
    expect(failureKind('text')).toBe('string');
  });
});
