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
// company at its newest fingerprinted year; and, per column role, how many
// figures each sum gate of the digits-only pass admitted and how many of those
// rested on an operand counted as 0 (scripts/sum-gates.ts). Totals only, never
// a company.
//
// Story 2.5c adds two counts:
// - `engine`: what `pnpm derive` (scripts/derive.ts, `deriveFingerprints`)
//   makes of the current columns as stored now, with the engine of this
//   commit: the columns skipped by reason, R2's cost_lines_short_of_total
//   with how many have nedskrivninger empty, and the figures R3 empties.
//   Computed from the stored figures and API subtotals, nothing written.
// - `varer_against_dump` (R4): per column role, the stored `varer` against
//   the same column in the dump taken after Story 2.5b's re-read
//   (.local/document-run-2.5b/document_column.csv, gitignored): the columns
//   whose `varer` the re-read emptied or changed, positive values included,
//   are those read from the income statement's inventory-change row, and
//   of the current ones emptied, those whose stock the next filing year's
//   prior column holds (an empty field, not a wrong figure). Null,
//   said on stderr, when the dump is not there.
// Apart from the engine counts, nothing is computed from a figure; only
// NULLs, stored categories and equal or unequal figures are counted. The
// JSON holds no date, so the same database gives the same bytes.
//
// Run: node scripts/document-run-counts.ts <label>   (from the repository root)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { DOCUMENT_FIGURE_COLUMNS } from '../src/engine/document-inputs.ts';
import {
  BUSINESS_TYPES,
  type BusinessType,
  type FingerprintColumns,
  type SkipReason,
  businessType,
  fingerprintFromColumns,
} from '../src/engine/fingerprint.ts';
import { DERIVE_SQL, type DeriveInputRow, type GuardedLine, SKIP_REASONS, deriveFingerprints } from './derive.ts';
import { DOCUMENT_RUN_FILE } from './document-set.ts';
import { setting } from './run-ingest.ts';
import { type GateCounts, gateCounts } from './sum-gates.ts';
import { REPORT_DIR, compareBytes, parseCsv, stableJson } from './seed-format.ts';

const LABEL = /^[a-z0-9][a-z0-9.-]*$/;
const ROLES = ['current', 'prior'] as const;
type Role = (typeof ROLES)[number];

/** The figure fields, by their register.document_column name without `_ore`. */
export const COUNT_FIELDS: readonly string[] = Object.values(DOCUMENT_FIGURE_COLUMNS).map((column) =>
  column.replace(/_ore$/, ''),
);

export const countsFile = (label: string): string => `${REPORT_DIR}/document-run-counts-${label}.json`;

export type DocumentRow = { readonly status: string; readonly reader_commit: string };
/** A column: its role, its status (null before reconciliation), which fields hold a figure, and which came from the digits-only pass. */
export type ColumnRow = {
  readonly role: string;
  readonly status: string | null;
  readonly present: readonly string[];
  readonly digits_pass_fields: readonly string[];
};

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
  /** Absent in the counts written before Story 2.5b. */
  gates?: Record<keyof GateCounts, { admitted: number; operand_counted_as_zero: number }>;
};

/** What derive's engine makes of the stored current columns (Story 2.5c). */
export type EngineCounts = {
  /** Current columns read. */
  columns: number;
  /** Fingerprints the engine gives them. */
  fingerprints: number;
  skipped: Record<SkipReason, number>;
  /** Of the columns skipped as cost_lines_short_of_total, those with nedskrivninger empty. */
  cost_lines_short_of_total_nedskrivninger_empty: number;
  /** Figures R3 empties: above the API sum_omloepsmidler + max(5 kr, 0.001 % of it). */
  emptied_above_api_subtotal: Record<GuardedLine, number>;
};

/** One role's stored `varer` against the dump (Story 2.5c, R4). */
export type VarerRoleCounts = {
  /** Columns in both the dump and the database. */
  compared: number;
  unchanged: number;
  /** A figure in the dump, NULL now. */
  emptied: number;
  /** A figure in both, a different one. */
  changed: number;
  /** NULL in the dump, a figure now. */
  newly_read: number;
  /** Of the emptied and changed, the dump's figure negative. */
  emptied_or_changed_negative_before: number;
  /** Columns in the dump with a negative varer. */
  negative_before: number;
  /** Columns now with a negative varer. */
  negative_after: number;
  /** Columns in only one of the two. */
  only_in_dump: number;
  only_now: number;
};

export type VarerCounts = {
  dump: string;
  columns: Record<Role, VarerRoleCounts>;
  /**
   * Of the current columns the re-read emptied, those whose stock the next
   * filing year's prior column holds now: a stock R4 found on neither balance
   * of that year's document, so an empty field, not a wrong figure. Absent in
   * the counts written before this field was added.
   */
  emptied_current_held_by_next_prior?: number;
};

export type DocumentRunCounts = {
  label: string;
  source: string;
  orgnrs: number;
  documents: { total: number; status: Record<string, number>; reader_commit: Record<string, number> };
  columns: Record<Role, RoleCounts>;
  /** Absent in the counts written before Story 2.5b. */
  fingerprints?: FingerprintCounts;
  /** Absent in the counts written before Story 2.5c. */
  engine?: EngineCounts;
  /** Absent in the counts written before Story 2.5c; null when the dump was not there. */
  varer_against_dump?: VarerCounts | null;
};

/** The dump R4's count compares with: the 2.1b rows right after Story 2.5b's re-read (README, "Seed"). */
export const VARER_DUMP_FILE = '.local/document-run-2.5b/document_column.csv';

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

/** What `pnpm derive` would make of these current columns now (Story 2.5c). Throws on an input it cannot read. */
export function engineCounts(rows: readonly DeriveInputRow[]): EngineCounts {
  const { counts } = deriveFingerprints(rows);
  const skipped = {} as Record<SkipReason, number>;
  for (const reason of SKIP_REASONS) skipped[reason] = counts.skipped[reason];
  return {
    columns: counts.columns,
    fingerprints: counts.written,
    skipped,
    cost_lines_short_of_total_nedskrivninger_empty: counts.shortOfTotalNedskrivningerEmpty,
    emptied_above_api_subtotal: { ...counts.emptiedAboveApiSubtotal },
  };
}

/** A column's `varer` as stored: its key and the øre string, or null. */
export type VarerRow = { readonly orgnr: string; readonly filing_year: number; readonly role: string; readonly varer_ore: string | null };

/** The rows of a register.document_column CSV dump (COPY ... CSV HEADER), `varer` only. */
export function parseVarerDump(text: string, file: string): VarerRow[] {
  const [header, ...rows] = parseCsv(text);
  if (header === undefined) throw new Error(`${file} is empty`);
  const at = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`${file}: no column ${name}`);
    return i;
  };
  const [orgnr, year, role, varer] = [at('orgnr'), at('filing_year'), at('role'), at('varer_ore')];
  return rows.map((row, n) => {
    const value = row[varer] ?? '';
    const filingYear = Number.parseInt(row[year] ?? '', 10);
    if (!Number.isInteger(filingYear) || (value !== '' && !/^-?\d+$/.test(value))) throw new Error(`${file}: row ${n + 2} unreadable`);
    return { orgnr: row[orgnr] ?? '', filing_year: filingYear, role: row[role] ?? '', varer_ore: value === '' ? null : value };
  });
}

const negative = (ore: string | null): boolean => ore !== null && ore.startsWith('-');

/** Per role, the stored `varer` now against the dump's (Story 2.5c, R4). Figures compared as written, never parsed to a number. */
export function varerAgainstDump(dump: string, before: readonly VarerRow[], after: readonly VarerRow[]): VarerCounts {
  const key = (r: VarerRow) => `${r.orgnr}/${r.filing_year}/${r.role}`;
  const columns = {} as Record<Role, VarerRoleCounts>;
  for (const role of ROLES) {
    const was = new Map(before.filter((r) => r.role === role).map((r) => [key(r), r.varer_ore]));
    const now = new Map(after.filter((r) => r.role === role).map((r) => [key(r), r.varer_ore]));
    const out: VarerRoleCounts = {
      compared: 0,
      unchanged: 0,
      emptied: 0,
      changed: 0,
      newly_read: 0,
      emptied_or_changed_negative_before: 0,
      negative_before: [...was.values()].filter(negative).length,
      negative_after: [...now.values()].filter(negative).length,
      only_in_dump: [...was.keys()].filter((k) => !now.has(k)).length,
      only_now: [...now.keys()].filter((k) => !was.has(k)).length,
    };
    for (const [k, old] of was) {
      if (!now.has(k)) continue;
      const value = now.get(k) ?? null;
      out.compared += 1;
      if (old === value) out.unchanged += 1;
      else if (old === null) out.newly_read += 1;
      else {
        if (value === null) out.emptied += 1;
        else out.changed += 1;
        if (negative(old)) out.emptied_or_changed_negative_before += 1;
      }
    }
    columns[role] = out;
  }
  const unknown = [...before, ...after].find((r) => !(ROLES as readonly string[]).includes(r.role));
  if (unknown !== undefined) throw new Error(`unknown column role ${unknown.role}`);
  const was = new Map(before.filter((r) => r.role === 'current').map((r) => [key(r), r.varer_ore]));
  const nextPrior = new Map(after.filter((r) => r.role === 'prior').map((r) => [`${r.orgnr}/${r.filing_year - 1}/current`, r.varer_ore]));
  const emptied_current_held_by_next_prior = after.filter(
    (r) => r.role === 'current' && r.varer_ore === null && (was.get(key(r)) ?? null) !== null && (nextPrior.get(key(r)) ?? null) !== null,
  ).length;
  return { dump, columns, emptied_current_held_by_next_prior };
}

/** The counts, from rows already read. Throws on a role or field it does not know. */
export function documentRunCounts(
  label: string,
  orgnrs: number,
  documents: readonly DocumentRow[],
  columns: readonly ColumnRow[],
  fingerprints?: readonly FingerprintRow[],
  since25c?: { readonly engine: EngineCounts; readonly varer: VarerCounts | null },
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
    const gates = gateCounts(
      rows.map((r) => ({ digitsPassFields: r.digits_pass_fields, hasFigure: (field: string) => r.present.includes(field) })),
    );
    byRole[role] = {
      columns: rows.length,
      non_null: nonNull,
      status: tally(rows.map((r) => r.status ?? 'null')),
      gates: {
        cost_lines: { admitted: gates.cost_lines.admitted, operand_counted_as_zero: gates.cost_lines.withOperandCountedAsZero },
        intangible_parts: {
          admitted: gates.intangible_parts.admitted,
          operand_counted_as_zero: gates.intangible_parts.withOperandCountedAsZero,
        },
      },
    };
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
    ...(since25c === undefined ? {} : { engine: since25c.engine, varer_against_dump: since25c.varer }),
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
      select role, status, array_remove(array[${sql.unsafe(present)}], null) as present, digits_pass_fields
        from register.document_column where orgnr = any(${orgnrs}::text[])`;
    const fingerprints = await sql<FingerprintRow[]>`
      select orgnr, filing_year, cost_of_goods_lo, cost_of_goods_hi, personnel_cost_lo, personnel_cost_hi,
             asset_intensity_lo, asset_intensity_hi, inventory, capitalised_intangibles
        from register.fingerprint where orgnr = any(${orgnrs}::text[])`;
    const listed = new Set(orgnrs);
    const engine = engineCounts((await sql.unsafe<DeriveInputRow[]>(DERIVE_SQL)).filter((row) => listed.has(row.orgnr)));
    const dumpPath = path.join(root, ...VARER_DUMP_FILE.split('/'));
    let varer: VarerCounts | null = null;
    if (existsSync(dumpPath)) {
      const now = await sql<VarerRow[]>`
        select orgnr, filing_year, role, varer_ore::text as varer_ore
          from register.document_column where orgnr = any(${orgnrs}::text[])`;
      const dumped = parseVarerDump(readFileSync(dumpPath, 'utf8'), VARER_DUMP_FILE).filter((row) => listed.has(row.orgnr));
      varer = varerAgainstDump(VARER_DUMP_FILE, dumped, now);
    } else {
      process.stderr.write(`analysis:document-run: ${VARER_DUMP_FILE} is not there; varer_against_dump is null\n`);
    }
    const counts = documentRunCounts(label, orgnrs.length, documents, columns, fingerprints, { engine, varer });
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
