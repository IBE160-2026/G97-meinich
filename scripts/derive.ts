// `pnpm derive`: batch step 2 (Story 2.5; technical note AD-1, AD-2, AD-9,
// AD-13). The first step-2 script: it derives the business-model
// fingerprint of every filed document's current column and stores it in
// register.fingerprint, which funnel stage 4 reads in the request path.
//
// - `pnpm ingest` (scripts/run-ingest.ts) runs it after every step-1 run
//   that can change stored figures; run it by hand after a restore.
// - Connects as `derive` (DERIVE_DATABASE_URL, from the environment, then
//   .env) and runs no DDL. Never runs in a request.
// - Reads every current register.document_column row, the document's
//   key-figures filing (through register.document.brreg_id) for the two API
//   subtotals, and computes each fingerprint with the engine
//   (src/engine/fingerprint.ts) from what documentFigures passes: only a
//   reconciled column's figures.
// - Rebuilds the table in one transaction: TRUNCATE, then INSERT. It deletes
//   nothing anywhere else.
// - Each row stores the digest of its raw inputs (src/engine/digest.ts) and
//   the dataset tag copied from the column.
// - Prints counts: written, skipped by reason, and by business type,
//   undetermined included, per fingerprint and per company (its newest
//   fingerprinted year). Totals only, never a company. An input it cannot
//   read (a figure that is not a whole number, an unknown status or dataset)
//   makes it exit 1 with nothing written.
//
// Run: node scripts/derive.ts   (from the repository root)
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { digest } from '../src/engine/digest.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentColumnRow,
  documentFigures,
} from '../src/engine/document-inputs.ts';
import {
  BUSINESS_TYPES,
  type BusinessType,
  type FingerprintColumns,
  type SkipReason,
  apiSubtotalsFromRow,
  businessType,
  fingerprintColumns,
  fingerprintOf,
} from '../src/engine/fingerprint.ts';
import { setting } from './run-ingest.ts';

/** A current document column with its filing's API subtotals, as the read returns it. */
export type DeriveInputRow = DocumentColumnRow & {
  readonly orgnr: string;
  readonly filing_year: number;
  readonly dataset: string;
  readonly sum_anleggsmidler_ore: string | null;
  readonly sum_omloepsmidler_ore: string | null;
};

/** One register.fingerprint row as step 2 inserts it. */
export type FingerprintRow = FingerprintColumns & {
  readonly orgnr: string;
  readonly filing_year: number;
  readonly input_digest: string;
  readonly dataset: 'demo' | 'full';
};

const SKIP_REASONS: readonly SkipReason[] = [
  'not_reconciled',
  'no_revenue',
  'negative_unexplained',
  'negative_balance_remainder',
];

/** Business type counts, with `undetermined` for a fingerprint whose categories allow more than one type. */
export type TypeCounts = Record<BusinessType | 'undetermined', number>;

export type DeriveCounts = {
  /** Current columns read. */
  readonly columns: number;
  readonly written: number;
  readonly skipped: Record<SkipReason, number>;
  /** Per fingerprint (company and filing year). */
  readonly types: TypeCounts;
  /** Per company, at its newest fingerprinted year. */
  readonly companies: TypeCounts;
};

const FIGURE_SELECT = Object.values(DOCUMENT_FIGURE_COLUMNS)
  .map((column) => `dc.${column}`)
  .join(',\n       ');

// Every current column, with the subtotals of the key-figures filing its
// document belongs to (NULL when the document has none: the API holds only
// the latest years). Ordered so the rows are inserted in key order.
export const DERIVE_SQL = `
select dc.orgnr,
       dc.filing_year,
       dc.status,
       dc.dataset,
       ${FIGURE_SELECT},
       k.sum_anleggsmidler_ore,
       k.sum_omloepsmidler_ore
  from register.document_column dc
  join register.document d on d.orgnr = dc.orgnr and d.filing_year = dc.filing_year
  left join register.key_figures k on k.brreg_id = d.brreg_id
 where dc.role = 'current'
 order by dc.orgnr collate "C", dc.filing_year`;

function datasetOf(value: string): 'demo' | 'full' {
  if (value === 'demo' || value === 'full') return value;
  throw new TypeError(`not a dataset tag: ${JSON.stringify(value)}`);
}

function emptyTypes(): TypeCounts {
  return { produkt: 0, konsulent: 0, forhandler: 0, annet: 0, undetermined: 0 };
}

/**
 * The fingerprint rows and the counts, from the rows read. Pure apart from
 * the engine; throws on an input it cannot read.
 */
export function deriveFingerprints(input: readonly DeriveInputRow[]): { rows: FingerprintRow[]; counts: DeriveCounts } {
  const rows: FingerprintRow[] = [];
  const skipped = Object.fromEntries(SKIP_REASONS.map((reason) => [reason, 0])) as Record<SkipReason, number>;
  const types = emptyTypes();
  const newest = new Map<string, { readonly year: number; readonly type: BusinessType | null }>();

  for (const column of input) {
    const dataset = datasetOf(column.dataset);
    const result = fingerprintOf(documentFigures(column), apiSubtotalsFromRow(column));
    if (result.kind === 'skip') {
      skipped[result.reason] += 1;
      continue;
    }
    const type = businessType(result.fingerprint);
    types[type ?? 'undetermined'] += 1;
    const seen = newest.get(column.orgnr);
    if (seen === undefined || column.filing_year > seen.year) newest.set(column.orgnr, { year: column.filing_year, type });
    rows.push({
      orgnr: column.orgnr,
      filing_year: column.filing_year,
      ...fingerprintColumns(result.fingerprint),
      input_digest: digest(result.inputs),
      dataset,
    });
  }

  const companies = emptyTypes();
  for (const { type } of newest.values()) companies[type ?? 'undetermined'] += 1;
  return { rows, counts: { columns: input.length, written: rows.length, skipped, types, companies } };
}

/** The summary `pnpm derive` prints: totals only. */
export function summaryLines(counts: DeriveCounts): string[] {
  const typeLine = (label: string, of: TypeCounts) =>
    `  ${label}: ${[...BUSINESS_TYPES, 'undetermined' as const].map((type) => `${type} ${of[type]}`).join(', ')}`;
  const companies = Object.values(counts.companies).reduce((sum, n) => sum + n, 0);
  return [
    `derive: ${counts.columns} current document columns read, ${counts.written} fingerprints written`,
    `  skipped: ${SKIP_REASONS.map((reason) => `${reason} ${counts.skipped[reason]}`).join(', ')}`,
    typeLine('fingerprints by type', counts.types),
    typeLine(`companies by type (newest fingerprinted year, ${companies} companies)`, counts.companies),
  ];
}

const INSERT_CHUNK = 1000;

/** Reads, derives and rebuilds register.fingerprint in the caller's transaction. */
export async function rebuildFingerprints(tx: postgres.TransactionSql): Promise<DeriveCounts> {
  const input = await tx.unsafe<DeriveInputRow[]>(DERIVE_SQL);
  const { rows, counts } = deriveFingerprints(input);
  await tx.unsafe('TRUNCATE register.fingerprint');
  for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
    const chunk = rows.slice(start, start + INSERT_CHUNK);
    await tx`insert into register.fingerprint ${tx(chunk)}`;
  }
  return counts;
}

export async function main(root: string): Promise<number> {
  const url = setting(root, 'DERIVE_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('derive: DERIVE_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const counts = await sql.begin((tx) => rebuildFingerprints(tx));
    process.stdout.write(`${summaryLines(counts).join('\n')}\n`);
    return 0;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    process.stderr.write(
      `derive: ${(error as Error).message}${typeof code === 'string' ? ` (${code})` : ''}; nothing written\n`,
    );
    return 1;
  } finally {
    await sql.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd());
}
