// B2 (Story 3.1a, Meinich 2026-11-15): `pnpm derive` and the request path
// read R3's sum_omloepsmidler from the same filing, the one in
// register.document.brreg_id, through one shared SQL fragment
// (src/analysis/document-filing.ts). For every current column in the loaded
// database, the request path's document select (DOCUMENT_SELECT over
// DOCUMENT_JOINS, as SUBJECT_SQL and CANDIDATES_SQL use them) and
// DERIVE_SQL must give the same subtotal. Read-only, as `reader`; counts
// only, no company is printed.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { DERIVE_SQL } from '../../scripts/derive.ts';
import { DOCUMENT_JOINS, DOCUMENT_SELECT } from '../../src/analysis/document-basis.ts';
import { DOCUMENT_FILING_JOIN } from '../../src/analysis/document-filing.ts';
import { setting } from './db-env.ts';

const url = setting('READER_DATABASE_URL');
if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
const reader = postgres(url, { max: 1, onnotice: () => {} });

afterAll(async () => {
  await reader.end();
});

// Every stored document as the request path reads it for its filing year:
// `f` stands for the benchmark filing, whose year selects the document.
const REQUEST_SQL = `
select c.orgnr, f.filing_year, ${DOCUMENT_SELECT}
  from register.company c
  join (select orgnr, filing_year from register.document) f on f.orgnr = c.orgnr${DOCUMENT_JOINS}
 where cur.orgnr is not null`;

type Subtotal = { readonly orgnr: string; readonly filing_year: number; readonly sum_omloepsmidler_ore: string | null };

describe('the filing a document belongs to', () => {
  it('derive and the request read the same sum_omloepsmidler for every current column', async () => {
    const derived = await reader.unsafe<Subtotal[]>(DERIVE_SQL);
    const requested = await reader.unsafe<Subtotal[]>(REQUEST_SQL);
    expect(derived.length).toBeGreaterThan(0);
    expect(requested.length).toBe(derived.length);
    const byKey = new Map(requested.map((row) => [`${row.orgnr}/${row.filing_year}`, row.sum_omloepsmidler_ore]));
    const differ = derived.filter((row) => byKey.get(`${row.orgnr}/${row.filing_year}`) !== row.sum_omloepsmidler_ore);
    expect(differ.length).toBe(0);
    // Some subtotals are found, so the comparison is not of NULLs only.
    expect(derived.filter((row) => row.sum_omloepsmidler_ore !== null).length).toBeGreaterThan(0);
  });

  it('is one fragment in both queries', () => {
    expect(DERIVE_SQL).toContain(DOCUMENT_FILING_JOIN);
    expect(DOCUMENT_JOINS).toContain(DOCUMENT_FILING_JOIN);
    expect(DOCUMENT_SELECT).toContain('dk.sum_omloepsmidler_ore');
    // Not the benchmark filing's key figures (`k`), which the request path read before B2.
    expect(DOCUMENT_SELECT).not.toMatch(/(^|[^d])k\.sum_omloepsmidler_ore/);
  });
});
