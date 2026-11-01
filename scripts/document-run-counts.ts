// `pnpm analysis:document-run <label>`: counts over the Story 2.1b
// acceptance run's stored documents (Story 2.3b), for the report's before
// and after.
//
// The run's 407 orgnrs (seed/document-run.json) and their 1 947 documents
// live only in the local database and a gitignored dump until Story 5.4's
// allow-list, so these counts cannot be reproduced from a fresh clone: the
// JSON this writes is the committed record of them, and the SM-2 report
// marks them as local data.
//
// Reads the local database as `reader` (READER_DATABASE_URL, from the
// environment, then .env), only the documents of the orgnrs listed in
// seed/document-run.json. Writes analysis/output/document-run-counts-<label>.json:
// per document, the count by status and by reader version; per column role
// (current, prior), the number of columns, of non-NULL figures per field and
// of each column status; and (Story 2.5b) the stored fingerprints of those
// orgnrs by business type, undetermined included, per fingerprint and per
// company at its newest fingerprinted year. Totals only, never a company.
// Nothing is computed from a figure; only NULLs and stored categories are
// counted. The JSON holds no date, so the same database gives the same bytes.
//
// Run: node scripts/document-run-counts.ts <label>   (from the repository root)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { DOCUMENT_FIGURE_COLUMNS } from '../src/engine/document-inputs.ts';
import {
  BUSINESS_TYPES,
  type BusinessType,
  type FingerprintColumns,
  businessType,
  fingerprintFromColumns,
} from '../src/engine/fingerprint.ts';
import { DOCUMENT_RUN_FILE } from './document-set.ts';
import { setting } from './run-ingest.ts';
import { REPORT_DIR, compareBytes, stableJson } from './seed-format.ts';

const LABEL = /^[a-z0-9][a-z0-9.-]*$/;
const ROLES = ['current', 'prior'] as const;
type Role = (typeof ROLES)[number];

/** The figure fields, by their register.document_column name without `_ore`. */
export const COUNT_FIELDS: readonly string[] = Object.values(DOCUMENT_FIGURE_COLUMNS).map((column) =>
  column.replace(/_ore$/, ''),
);

export const countsFile = (label: string): string => `${REPORT_DIR}/document-run-counts-${label}.json`;

export type DocumentRow = { readonly status: string; readonly reader_commit: string };
/** A column: its role, its status (null before reconciliation), and which fields hold a figure. */
export type ColumnRow = { readonly role: string; readonly status: string | null; readonly present: readonly string[] };

/** A stored fingerprint: its company and year (never written out) and its categories. */
export type FingerprintRow = FingerprintColumns & { readonly orgnr: string; readonly filing_year: number };

/** Business type counts, with `undetermined` for a fingerprint whose categories allow more than one type. */
export type TypeCounts = Record<BusinessType | 'undetermined', number>;

export type FingerprintCounts = {
  /** Fingerprints stored. */
  total: number;
  /** Per fingerprint (company and filing year). */
  types: TypeCounts;
  /** Per company, at its newest fingerprinted year. */
  companies: TypeCounts;
};

export type RoleCounts = {
  columns: number;
  non_null: Record<string, number>;
  status: Record<string, number>;
};

export type DocumentRunCounts = {
  label: string;
  source: string;
  orgnrs: number;
  documents: { total: number; status: Record<string, number>; reader_commit: Record<string, number> };
  columns: Record<Role, RoleCounts>;
  /** Absent in the counts written before Story 2.5b. */
  fingerprints?: FingerprintCounts;
};

function tally(values: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of [...values].sort(compareBytes)) out[value] = (out[value] ?? 0) + 1;
  return out;
}

function emptyTypes(): TypeCounts {
  const out = { undetermined: 0 } as TypeCounts;
  for (const type of BUSINESS_TYPES) out[type] = 0;
  return out;
}

/**
 * The stored fingerprints by business type, each typed by the engine
 * (fingerprintFromColumns, businessType). Throws on a row it cannot read.
 */
export function fingerprintCounts(rows: readonly FingerprintRow[]): FingerprintCounts {
  const types = emptyTypes();
  const newest = new Map<string, { readonly year: number; readonly type: BusinessType | null }>();
  for (const row of rows) {
    const fingerprint = fingerprintFromColumns(row);
    if (fingerprint === null) throw new Error('a stored fingerprint without categories');
    const type = businessType(fingerprint);
    types[type ?? 'undetermined'] += 1;
    const seen = newest.get(row.orgnr);
    if (seen === undefined || row.filing_year > seen.year) newest.set(row.orgnr, { year: row.filing_year, type });
  }
  const companies = emptyTypes();
  for (const { type } of newest.values()) companies[type ?? 'undetermined'] += 1;
  return { total: rows.length, types, companies };
}

/** The counts, from rows already read. Throws on a role or field it does not know. */
export function documentRunCounts(
  label: string,
  orgnrs: number,
  documents: readonly DocumentRow[],
  columns: readonly ColumnRow[],
  fingerprints?: readonly FingerprintRow[],
): DocumentRunCounts {
  const byRole = {} as Record<Role, RoleCounts>;
  for (const role of ROLES) {
    const rows = columns.filter((c) => c.role === role);
    const nonNull = Object.fromEntries(COUNT_FIELDS.map((field) => [field, 0]));
    for (const row of rows) {
      for (const field of row.present) {
        if (!(field in nonNull)) throw new Error(`unknown field ${field}`);
        nonNull[field] = (nonNull[field] ?? 0) + 1;
      }
    }
    byRole[role] = { columns: rows.length, non_null: nonNull, status: tally(rows.map((r) => r.status ?? 'null')) };
  }
  const unknown = columns.find((c) => !(ROLES as readonly string[]).includes(c.role));
  if (unknown !== undefined) throw new Error(`unknown column role ${unknown.role}`);
  return {
    label,
    source: `the local database: documents of the orgnrs in ${DOCUMENT_RUN_FILE} (Story 2.1b acceptance run; not reproducible from a fresh clone until Story 5.4)`,
    orgnrs,
    documents: {
      total: documents.length,
      status: tally(documents.map((d) => d.status)),
      reader_commit: tally(documents.map((d) => d.reader_commit)),
    },
    columns: byRole,
    ...(fingerprints === undefined ? {} : { fingerprints: fingerprintCounts(fingerprints) }),
  };
}

export async function main(root: string, argv: readonly string[]): Promise<number> {
  const label = argv[0];
  if (argv.length !== 1 || label === undefined || !LABEL.test(label)) {
    process.stderr.write('analysis:document-run: give exactly one label, such as before-2.3b or after-2.3b\n');
    return 2;
  }
  const url = setting(root, 'READER_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('analysis:document-run: READER_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const orgnrs = JSON.parse(readFileSync(path.join(root, ...DOCUMENT_RUN_FILE.split('/')), 'utf8')) as string[];
  const sql = postgres(url, { max: 1, onnotice: () => {}, connection: { default_transaction_read_only: true } });
  try {
    const documents = await sql<DocumentRow[]>`
      select status, reader_commit from register.document where orgnr = any(${orgnrs}::text[])`;
    const present = COUNT_FIELDS.map((field) => `case when ${field}_ore is not null then '${field}' end`).join(', ');
    const columns = await sql<ColumnRow[]>`
      select role, status, array_remove(array[${sql.unsafe(present)}], null) as present
        from register.document_column where orgnr = any(${orgnrs}::text[])`;
    const fingerprints = await sql<FingerprintRow[]>`
      select orgnr, filing_year, cost_of_goods_lo, cost_of_goods_hi, personnel_cost_lo, personnel_cost_hi,
             asset_intensity_lo, asset_intensity_hi, inventory, capitalised_intangibles
        from register.fingerprint where orgnr = any(${orgnrs}::text[])`;
    const counts = documentRunCounts(label, orgnrs.length, documents, columns, fingerprints);
    const file = countsFile(label);
    writeFileSync(path.join(root, ...file.split('/')), stableJson(counts));
    process.stdout.write(`analysis:document-run: wrote ${file} (${counts.documents.total} documents)\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`analysis:document-run: ${(error as Error).message}\n`);
    return 1;
  } finally {
    await sql.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd(), process.argv.slice(2));
}
