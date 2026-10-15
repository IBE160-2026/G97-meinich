import 'server-only';
// Company search (FR-1, Story 1.5b) and the covered-industry list, read as
// `reader` from Peerless's own database. Never the register, never a
// financial column, never a filter on a financial criterion.
//
// Both queries are parameterised ($1); the SQL text is exported so the
// database tests can EXPLAIN exactly what runs.
import type { CoveredIndustry } from '../messages/industry.ts';
import { MAX_SEARCH_RESULTS, type SearchResult } from '../search-contract.ts';
import { readerSql } from './db.ts';

export type SearchQuery =
  | { readonly kind: 'orgnr'; readonly orgnr: string }
  | { readonly kind: 'name'; readonly name: string };

interface CompanyRow {
  orgnr: string;
  navn: string | null;
  naeringskode1: string | null;
  naeringskode1_beskrivelse: string | null;
  forretningsadresse_kommune: string | null;
}

const COLUMNS = `orgnr, navn, naeringskode1, naeringskode1_beskrivelse, forretningsadresse_kommune`;

/** Exact match on the primary key; $1 is nine digits. */
export const ORGNR_SQL = `
select ${COLUMNS}
  from register.company
 where orgnr = $1::char(9)`;

// Names: the input is folded by the same IMMUTABLE wrapper as the index
// expression (register.company_navn_trgm), so the GIN trigram index serves
// both arms. The substring arm catches the short prefixes a typeahead sends;
// word similarity (<%) catches near misses. LIKE's wildcards and its escape
// character in the folded input are escaped, so "%" or "_" is matched
// literally. pg_trgm lives in schema `extensions`, which is not on reader's
// search_path, so its operator and function are qualified.
const FOLDED_INPUT = `register.immutable_unaccent(lower($1::text))`;
const FOLDED_NAME = `register.immutable_unaccent(lower(navn))`;

// String.raw: the backslashes below reach Postgres as written. With
// standard_conforming_strings on, '\' is one backslash, LIKE's default escape.
export const NAME_SQL = String.raw`
select ${COLUMNS}
  from register.company
 where ${FOLDED_NAME} like '%' || replace(replace(replace(${FOLDED_INPUT}, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    or ${FOLDED_INPUT} operator(extensions.<%) ${FOLDED_NAME}
 order by extensions.word_similarity(${FOLDED_INPUT}, ${FOLDED_NAME}) desc, navn, orgnr
 limit ${MAX_SEARCH_RESULTS}`;

function toResult(row: CompanyRow): SearchResult {
  return {
    navn: row.navn,
    orgnr: row.orgnr,
    naeringskode1: { kode: row.naeringskode1, beskrivelse: row.naeringskode1_beskrivelse },
    kommune: row.forretningsadresse_kommune,
  };
}

/** At most MAX_SEARCH_RESULTS companies for an exact orgnr or a name. */
export async function searchCompanies(query: SearchQuery): Promise<SearchResult[]> {
  const sql = readerSql();
  const rows =
    query.kind === 'orgnr'
      ? await sql.unsafe<CompanyRow[]>(ORGNR_SQL, [query.orgnr])
      : await sql.unsafe<CompanyRow[]>(NAME_SQL, [query.name]);
  return rows.slice(0, MAX_SEARCH_RESULTS).map(toResult);
}

/**
 * The covered industries (register.covered_industry, written by the loader
 * from seed/coverage.json) with the register's name for each code: the
 * naeringskode1_beskrivelse most stored companies under that code carry.
 */
export async function coveredIndustries(): Promise<CoveredIndustry[]> {
  const sql = readerSql();
  const rows = await sql<{ code: string; beskrivelse: string | null }[]>`
    select ci.code,
           (select c.naeringskode1_beskrivelse
              from register.company c
             where c.naeringskode1 = ci.code and c.naeringskode1_beskrivelse is not null
             group by c.naeringskode1_beskrivelse
             order by count(*) desc, c.naeringskode1_beskrivelse
             limit 1) as beskrivelse
      from register.covered_industry ci
     order by ci.code`;
  return rows.map((row) => ({ code: row.code, beskrivelse: row.beskrivelse }));
}
