// A failed subject read (Story 1.6b): the database client throws, the lookup
// returns `failed`, and the analysis layout and page render the lookup-error
// state themselves — role="alert" with the error copy — without calling
// notFound() or redirect(). The log line names only the error's class and
// SQLSTATE.
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nb from '../../src/messages/nb.json' with { type: 'json' };

class PostgresError extends Error {
  readonly code = '57014';
}

vi.mock('server-only', () => ({}));
vi.mock('../../src/server/db.ts', () => ({
  readerSql: () => {
    throw new PostgresError('canceling statement due to statement timeout: select … 813235552');
  },
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('SENTINEL notFound');
  },
  redirect: () => {
    throw new Error('SENTINEL redirect');
  },
}));

const { lookupSubject, failureKind } = await import('../../src/server/analysis.ts');
const { default: AnalysisLayout } = await import('../../src/app/analyse/[orgnr]/layout.tsx');
const { AnalysisPage } = await import('../../src/components/analysis/analysis-page.tsx');

const ORGNR = '813235552';

afterEach(() => {
  vi.restoreAllMocks();
});

function alertText(element: ReactElement): string {
  const html = renderToString(element);
  expect(html).toContain('role="alert"');
  return html.replace(/<[^>]+>/g, '');
}

describe('a failed subject read', () => {
  it('is a value, and the log names only the class and the SQLSTATE', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await lookupSubject(ORGNR)).toEqual({ kind: 'failed' });
    expect(log).toHaveBeenCalledWith('analysis: subject lookup failed (PostgresError 57014)');
    const logged = log.mock.calls.flat().join(' ');
    expect(logged).not.toContain(ORGNR);
    expect(logged).not.toContain('statement timeout');
  });

  it('makes the layout render the lookup-error state, not a 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const element = await AnalysisLayout({
      children: createElement('p', null, 'children'),
      params: Promise.resolve({ orgnr: ORGNR }),
    });
    expect(alertText(element as ReactElement)).toBe(nb['search.failed']);
  });

  it.each([{ orgnr: ORGNR }, { orgnr: ORGNR, fane: 'peers' }])(
    'makes the page render the lookup-error state, not a 404 or a redirect: %o',
    async (segments) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const element = await AnalysisPage({ segments, searchParams: {} });
      expect(alertText(element)).toBe(nb['search.failed']);
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
