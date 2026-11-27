// A company's default analysis input from the committed demo seed (Story
// 4.1), read from the CSVs as the request path reads the loaded database
// (src/server/analysis.ts): the subject's benchmark filing (newest year,
// then the later period and register id), the candidates' filings of that
// year in the subject's primary industry, each company's key figures, and
// its document basis (manifest, document and its two columns, and the
// key-figures filing the document belongs to for R3). An independent path
// from the SQL, so test/explain/payload.test.ts needs no database. Nothing
// here selects a peer or computes a figure: the engine does
// (`defaultAnalysis`).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../../scripts/seed-format.ts';
import type { DefaultCandidate, DefaultFiling } from '../../src/analysis/explanation-payload.ts';
import { DOCUMENT_FIGURE_COLUMNS, type DocumentBasis, type DocumentColumnRow, documentBasis } from '../../src/engine/document-inputs.ts';
import { API_KEY_FIGURE_COLUMNS, type ApiKeyFiguresRow } from '../../src/engine/inputs.ts';
import type { FunnelSubject } from '../../src/engine/peers.ts';

const root = path.resolve(import.meta.dirname, '../..');
type Row = Record<string, string>;

function table(name: string): Row[] {
  const [header, ...rows] = parseCsv(readFileSync(path.join(root, 'seed/demo', name), 'utf8'));
  if (header === undefined) throw new Error(`${name} is empty`);
  return rows.map((row) => {
    if (row.length !== header.length) throw new Error(`${name}: a row has ${row.length} fields, the header ${header.length}`);
    return Object.fromEntries(header.map((column, i) => [column, row[i] ?? '']));
  });
}

// COPY csv writes NULL as an empty unquoted field.
const orNull = (text: string | undefined): string | null => (text === undefined || text === '' ? null : text);
const bool = (text: string | undefined): boolean | null => (text === 't' ? true : text === 'f' ? false : null);
const ore = (text: string | undefined): bigint | null => (orNull(text) === null ? null : BigInt(text ?? ''));
/** A timestamptz as COPY writes it ("2026-10-11 10:09:57.319216+00") → Date. */
const timestamp = (text: string): Date => new Date(text.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));

/** A Postgres text[] as COPY csv writes it: `{}` or `{a,b}`. */
function textArray(text: string | undefined): string[] | null {
  if (text === undefined || text === '') return null;
  if (!text.startsWith('{') || !text.endsWith('}')) throw new Error(`not a text[]: ${text}`);
  const inner = text.slice(1, -1);
  return inner === '' ? [] : inner.split(',');
}

let cache: {
  readonly companies: Map<string, Row>;
  readonly filings: Row[];
  readonly keyFigures: Map<string, Row>;
  readonly documents: Map<string, Row>;
  readonly columns: Map<string, Row>;
  readonly manifest: ReadonlySet<string>;
  readonly covered: ReadonlySet<string>;
} | null = null;

function data() {
  cache ??= {
    companies: new Map(table('company.csv').map((row) => [row.orgnr ?? '', row])),
    filings: table('filing.csv'),
    keyFigures: new Map(table('key_figures.csv').map((row) => [row.brreg_id ?? '', row])),
    documents: new Map(table('document.csv').map((row) => [`${row.orgnr}/${row.filing_year}`, row])),
    columns: new Map(table('document_column.csv').map((row) => [`${row.orgnr}/${row.filing_year}/${row.role}`, row])),
    manifest: new Set(
      (JSON.parse(readFileSync(path.join(root, 'seed/demo/manifest.json'), 'utf8')) as { document_figure_orgnrs: string[] })
        .document_figure_orgnrs,
    ),
    covered: new Set(
      (JSON.parse(readFileSync(path.join(root, 'seed/coverage.json'), 'utf8')) as { code: string }[]).map((entry) => entry.code),
    ),
  };
  return cache;
}

function keyFiguresOf(brregId: string): ApiKeyFiguresRow {
  const row = data().keyFigures.get(brregId);
  return Object.fromEntries(API_KEY_FIGURE_COLUMNS.map((column) => [column, orNull(row?.[column])])) as ApiKeyFiguresRow;
}

function columnRow(row: Row): DocumentColumnRow {
  const figures = Object.fromEntries(Object.values(DOCUMENT_FIGURE_COLUMNS).map((column) => [column, orNull(row[column])]));
  return { status: orNull(row.status), ...figures } as DocumentColumnRow;
}

/** The company's document basis for `filingYear`, as `documentBasisOf` builds it from the database. */
function basisOf(orgnr: string, filingYear: number): { readonly basis: DocumentBasis; readonly readAt: Date | null } {
  const { documents, columns, keyFigures, manifest } = data();
  const document = documents.get(`${orgnr}/${filingYear}`);
  const current = columns.get(`${orgnr}/${filingYear}/current`);
  const prior = columns.get(`${orgnr}/${filingYear}/prior`);
  const status = orNull(document?.status);
  const brregId = orNull(document?.brreg_id);
  const basis = documentBasis({
    inManifest: manifest.has(orgnr),
    filingYear,
    document:
      document === undefined || status === null
        ? null
        : {
            status,
            current: current === undefined ? null : columnRow(current),
            prior: prior === undefined ? null : columnRow(prior),
            priorApiFailFields: prior === undefined ? null : textArray(prior.api_fail_fields),
          },
    sumOmloepsmidler: brregId === null ? null : ore(keyFigures.get(brregId)?.sum_omloepsmidler_ore),
  });
  return { basis, readAt: document === undefined ? null : timestamp(document.read_at ?? '') };
}

function comparability(filing: Row) {
  return {
    regnskapstype: filing.regnskapstype ?? '',
    periodeFra: filing.periode_fra ?? '',
    periodeTil: filing.periode_til ?? '',
    valuta: orNull(filing.valuta),
    regnskapsregler: orNull(filing.regnskapsregler),
    smaaForetak: bool(filing.smaa_foretak),
    avviklingsregnskap: bool(filing.avviklingsregnskap),
  };
}

/** Newest filing_year, then periode_til, periode_fra and brreg_id, each descending: `subjectBenchmarkFiling`'s order. */
function benchmarkFiling(orgnr: string): Row {
  const own = data()
    .filings.filter((filing) => filing.orgnr === orgnr && filing.regnskapstype === 'SELSKAP')
    .sort(
      (a, b) =>
        Number(b.filing_year) - Number(a.filing_year) ||
        (b.periode_til ?? '').localeCompare(a.periode_til ?? '') ||
        (b.periode_fra ?? '').localeCompare(a.periode_fra ?? '') ||
        Number(BigInt(b.brreg_id ?? '0') - BigInt(a.brreg_id ?? '0')),
    );
  const first = own[0];
  if (first === undefined) throw new Error(`no SELSKAP filing in the seed for the subject`);
  return first;
}

export type SeedInput = {
  readonly funnel: FunnelSubject;
  readonly filing: DefaultFiling;
  readonly candidates: readonly DefaultCandidate[];
};

/**
 * A covered AS's default-analysis input from the seed. The fingerprint and
 * classification are left null: `V1_FUNNEL` reads neither, and the payload
 * must not depend on them.
 */
export function seedInput(orgnr: string): SeedInput {
  const { companies, filings, covered } = data();
  const company = companies.get(orgnr);
  if (company === undefined || !covered.has(company.naeringskode1 ?? '') || company.organisasjonsform !== 'AS') {
    throw new Error('the subject is not a covered AS in the seed');
  }
  const filing = benchmarkFiling(orgnr);
  const filingYear = Number(filing.filing_year);
  const keyFigures = keyFiguresOf(filing.brreg_id ?? '');
  const funnel: FunnelSubject = {
    orgnr,
    naeringskode1: orNull(company.naeringskode1),
    filingYear,
    sumDriftsinntekter: ore(keyFigures.sum_driftsinntekter_ore ?? undefined),
    fingerprint: null,
    classification: null,
    ...comparability(filing),
  };
  const candidates: DefaultCandidate[] = filings
    .filter((row) => Number(row.filing_year) === filingYear && row.orgnr !== orgnr)
    .filter((row) => companies.get(row.orgnr ?? '')?.naeringskode1 === company.naeringskode1)
    .map((row) => {
      const peer = companies.get(row.orgnr ?? '');
      const { basis, readAt } = basisOf(row.orgnr ?? '', filingYear);
      const figures = keyFiguresOf(row.brreg_id ?? '');
      return {
        orgnr: row.orgnr ?? '',
        organisasjonsform: orNull(peer?.organisasjonsform),
        naeringskode1: orNull(peer?.naeringskode1),
        brregId: BigInt(row.brreg_id ?? '0'),
        filingYear,
        sumDriftsinntekter: ore(figures.sum_driftsinntekter_ore ?? undefined),
        fingerprint: null,
        classification: null,
        keyFigures: figures,
        documentBasis: basis,
        documentReadAt: readAt,
        ...comparability(row),
      };
    });
  const { valuta, regnskapsregler, smaaForetak, avviklingsregnskap } = comparability(filing);
  return {
    funnel,
    filing: {
      keyFigures,
      valuta,
      regnskapsregler,
      smaaForetak,
      avviklingsregnskap,
      filingYear,
      documentBasis: basisOf(orgnr, filingYear).basis,
    },
    candidates,
  };
}

/**
 * The first covered AS in byte order of orgnr that is outside the
 * manifest's document list, with a SELSKAP filing, for which `hasPeers`
 * holds. Chosen by a fixed rule, never by its figures,
 * and its orgnr is printed nowhere.
 */
export function apiOnlySubject(hasPeers: (orgnr: string) => boolean): string {
  const { companies, filings, manifest, covered } = data();
  const withFiling = new Set(filings.filter((filing) => filing.regnskapstype === 'SELSKAP').map((filing) => filing.orgnr));
  const found = [...companies.values()]
    .filter((c) => c.organisasjonsform === 'AS' && covered.has(c.naeringskode1 ?? '') && !manifest.has(c.orgnr ?? ''))
    .filter((c) => withFiling.has(c.orgnr))
    .map((c) => c.orgnr ?? '')
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .find(hasPeers);
  if (found === undefined) throw new Error('no covered AS outside the document list has a peer group in the seed');
  return found;
}

/** A company's name as the seed stores it, or null. */
export function companyName(orgnr: string): string | null {
  return orNull(data().companies.get(orgnr)?.navn);
}
