// GET /api/sok (Story 1.5b): validation, the response contract and the
// absence of any network call. The database is mocked here; the query itself
// is tested against the seed in test/db/search.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '../src/search-contract.ts';

const searchCompanies = vi.hoisted(() => vi.fn<(query: unknown) => Promise<SearchResult[]>>());
vi.mock('@/server/search', () => ({ searchCompanies }));

const route = await import('../src/app/api/sok/route.ts');

function row(orgnr: string, extra: Record<string, unknown> = {}): SearchResult {
  return {
    navn: `SELSKAP ${orgnr} AS`,
    orgnr,
    naeringskode1: { kode: '62.100', beskrivelse: 'Dataprogrammeringstjenester' },
    kommune: 'OSLO',
    ...extra,
  } as SearchResult;
}

async function get(q: string | null): Promise<{ status: number; body: unknown }> {
  const url = new URL('http://localhost/api/sok');
  if (q !== null) url.searchParams.set('q', q);
  const response = await route.GET(new Request(url));
  return { status: response.status, body: await response.json() };
}

const fetchSpy = vi.fn(() => {
  throw new Error('no network call is allowed in /api/sok');
});

beforeEach(() => {
  searchCompanies.mockReset();
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(fetchSpy).not.toHaveBeenCalled();
});

describe('GET /api/sok', () => {
  it('exports GET and nothing else: no other method, no server action', () => {
    expect(Object.keys(route)).toEqual(['GET']);
  });

  it('returns at most 8 rows of exactly navn, orgnr, naeringskode1 and kommune', async () => {
    searchCompanies.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => row(`81323555${i % 10}`, { sum_eiendeler_ore: '1', navn_lower: 'x' })),
    );
    const { status, body } = await get('admmit');
    expect(status).toBe(200);
    expect(searchCompanies).toHaveBeenCalledWith({ kind: 'name', name: 'admmit' });
    const rows = body as Record<string, unknown>[];
    expect(rows).toHaveLength(8);
    for (const result of rows) {
      expect(Object.keys(result).sort()).toEqual(['kommune', 'naeringskode1', 'navn', 'orgnr']);
      expect(Object.keys(result.naeringskode1 as object).sort()).toEqual(['beskrivelse', 'kode']);
    }
  });

  it('looks up a valid orgnr exactly, spaces stripped', async () => {
    searchCompanies.mockResolvedValue([row('813235552')]);
    const { status, body } = await get('813 235 552');
    expect(status).toBe(200);
    expect(searchCompanies).toHaveBeenCalledWith({ kind: 'orgnr', orgnr: '813235552' });
    expect(body).toEqual([row('813235552')]);
  });

  it('treats a name containing digits as a name', async () => {
    searchCompanies.mockResolvedValue([]);
    expect(await get('1881 Media')).toEqual({ status: 200, body: [] });
    expect(searchCompanies).toHaveBeenCalledWith({ kind: 'name', name: '1881 Media' });
  });

  it('returns [] without a query for a missing, empty or one-character q', async () => {
    for (const q of [null, '', '   ', 'a', ' ø ']) {
      expect(await get(q), String(q)).toEqual({ status: 200, body: [] });
    }
    expect(searchCompanies).not.toHaveBeenCalled();
  });

  it('answers 400 without a query when q is longer than 100 characters', async () => {
    searchCompanies.mockResolvedValue([]);
    expect(await get('a'.repeat(101))).toEqual({ status: 400, body: {} });
    expect(searchCompanies).not.toHaveBeenCalled();
    expect((await get('a'.repeat(100))).status).toBe(200);
  });

  it('answers 400 without a query for nine digits failing modulus 11', async () => {
    expect(await get('813235553')).toEqual({ status: 400, body: {} });
    expect(await get('912 345 678')).toEqual({ status: 400, body: {} });
    expect(searchCompanies).not.toHaveBeenCalled();
  });

  it('answers 400 without a query for digits only that are not nine', async () => {
    expect(await get('81323555')).toEqual({ status: 400, body: {} });
    expect(await get('8132355520')).toEqual({ status: 400, body: {} });
    expect(searchCompanies).not.toHaveBeenCalled();
  });

  it('answers 500 with no detail when the database fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    searchCompanies.mockRejectedValue(new Error('password authentication failed for user "reader"'));
    const response = await route.GET(new Request('http://localhost/api/sok?q=admmit'));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{}');
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/password|reader|admmit/);
    error.mockRestore();
  });

  it('is never cached', async () => {
    searchCompanies.mockResolvedValue([]);
    const response = await route.GET(new Request('http://localhost/api/sok?q=admmit'));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
