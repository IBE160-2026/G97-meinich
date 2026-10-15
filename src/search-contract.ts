// The contract of GET /api/sok, shared by the route, the server query and
// the search field. Plain data: no server import, so client code may use it.

/** The only JSON endpoint on the request surface. */
export const SEARCH_ENDPOINT = '/api/sok';

/** The longest `q` accepted: the field's maxLength; /api/sok answers 400 above it. */
export const MAX_SEARCH_LENGTH = 100;

/** At most this many companies per search. */
export const MAX_SEARCH_RESULTS = 8;

/** One search result: exactly these four fields, nothing financial. */
export interface SearchResult {
  /** Name as the register stores it; null if the register gave none. */
  readonly navn: string | null;
  readonly orgnr: string;
  /** Primary industry: SN2025 code and the register's description of it. */
  readonly naeringskode1: { readonly kode: string | null; readonly beskrivelse: string | null };
  /** Business-address municipality as stored (upper case); null when the register has none. */
  readonly kommune: string | null;
}

/** Copies exactly the four contract fields, so nothing else can reach the response. */
export function toSearchResult(row: SearchResult): SearchResult {
  return {
    navn: row.navn,
    orgnr: row.orgnr,
    naeringskode1: { kode: row.naeringskode1.kode, beskrivelse: row.naeringskode1.beskrivelse },
    kommune: row.kommune,
  };
}
