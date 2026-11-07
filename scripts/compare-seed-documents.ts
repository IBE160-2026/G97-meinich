// `pnpm analysis:seed-documents`: does the local database hold exactly the
// committed seed's document rows for the OCR reference set, and what did
// the OCR word cache do in the last runs? (Story 2.5d)
//
// The cache is proven on real data before the labelled set is read: the
// reference set is re-read twice, first by OCR (filling the cache), then
// from the cache (`--reread-all`). Both must give exactly the figures,
// statuses and checks the committed seed holds, and the second must have
// only hits. This script is that comparison.
//
// - Rows: every register.document and register.document_column row of the
//   orgnrs in analysis/ocr-reference/document-run.json, in the database and
//   in seed/demo/, matched on their keys ((orgnr, filing_year) and
//   (orgnr, filing_year, role)). Every column is compared as text except
//   `reader_commit` and `read_at`, which a re-read changes by design. The
//   columns come from the catalog, so a column a migration adds is
//   compared without editing this file. An empty CSV field and NULL are the
//   same here (COPY … (FORMAT csv) writes NULL as an empty field).
// - Runs: the counts the OCR word cache recorded in the last `--runs N`
//   (default 2) document and re-read runs in run.step1.
//
// Totals only: no orgnr, no figure. Exits 1 when any row differs or is on
// one side only, so a difference stops the story before the labelled set.
//
// Reads the local database as `ingest` (INGEST_DATABASE_URL, from the
// environment, then .env), in read-only transactions: run.step1 is readable
// by `ingest` alone (`reader` has no access to schema run, Story 2.4), and
// `ingest` also reads the register's document tables. Nothing is written.
//
// Run: node scripts/compare-seed-documents.ts [--runs N]   (from the repository root)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { REFERENCE_RUN_FILE } from './document-set.ts';
import { setting } from './run-ingest.ts';
import { SEED_DIR, parseCsv } from './seed-format.ts';

// What a re-read changes by design; never compared.
export const IGNORED_COLUMNS: readonly string[] = ['reader_commit', 'read_at'];

export const TABLES = [
  { name: 'document', key: ['orgnr', 'filing_year'] },
  { name: 'document_column', key: ['orgnr', 'filing_year', 'role'] },
] as const;

export type Row = Readonly<Record<string, string | null>>;

export interface TableComparison {
  /** Rows on both sides whose compared columns are all equal. */
  readonly equal: number;
  /** Rows on both sides with at least one compared column unequal. */
  readonly differing: number;
  readonly onlyInSeed: number;
  readonly onlyInDatabase: number;
  /** Per compared column, the rows on both sides in which it differs. */
  readonly fields: Readonly<Record<string, number>>;
}

const blankIsNull = (value: string | null | undefined): string | null => (value === undefined || value === '' ? null : value);

// The rows of a seed CSV whose orgnr is in `orgnrs`, as column → text.
export function seedRows(csv: string, orgnrs: ReadonlySet<string>): Row[] {
  const [header, ...rows] = parseCsv(csv);
  if (header === undefined || !header.includes('orgnr')) throw new Error('seed CSV: no header with orgnr');
  return rows
    .map((cells) => Object.fromEntries(header.map((name, i) => [name, blankIsNull(cells[i])])))
    .filter((row) => orgnrs.has(row.orgnr ?? ''));
}

// Compares the two sides on `key`, every column of `columns` except the
// ignored ones.
export function compareRows(
  seed: readonly Row[],
  database: readonly Row[],
  key: readonly string[],
  columns: readonly string[],
): TableComparison {
  const keyOf = (row: Row): string => key.map((k) => row[k] ?? '').join('\u0000');
  const compared = columns.filter((c) => !IGNORED_COLUMNS.includes(c) && !key.includes(c));
  const fromDatabase = new Map(database.map((row) => [keyOf(row), row]));
  if (fromDatabase.size !== database.length) throw new Error('database rows: a key appears twice');
  const fields: Record<string, number> = {};
  let equal = 0;
  let differing = 0;
  let onlyInSeed = 0;
  const seen = new Set<string>();
  for (const row of seed) {
    const k = keyOf(row);
    if (seen.has(k)) throw new Error('seed rows: a key appears twice');
    seen.add(k);
    const other = fromDatabase.get(k);
    if (other === undefined) {
      onlyInSeed += 1;
      continue;
    }
    const unequal = compared.filter((c) => blankIsNull(row[c]) !== blankIsNull(other[c]));
    for (const c of unequal) fields[c] = (fields[c] ?? 0) + 1;
    if (unequal.length === 0) equal += 1;
    else differing += 1;
  }
  const onlyInDatabase = [...fromDatabase.keys()].filter((k) => !seen.has(k)).length;
  return { equal, differing, onlyInSeed, onlyInDatabase, fields };
}

export const sameAsSeed = (c: TableComparison): boolean => c.differing === 0 && c.onlyInSeed === 0 && c.onlyInDatabase === 0;

export interface RunCacheCounts {
  readonly id: number;
  readonly mode: string;
  readonly rereadAll: boolean;
  /** "on", "off", or "not recorded" for a run from before Story 2.5d. */
  readonly cache: string;
  readonly hit: number;
  readonly missAbsent: number;
  readonly missKey: number;
  readonly missKeyParts: Readonly<Record<string, number>>;
  readonly missUnreadable: number;
  readonly writeFailed: number;
  readonly read: number;
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isInteger(value) ? value : 0);

// The cache's counts as one run record holds them (run.step1.counts).
export function runCacheCounts(id: number, mode: string, counts: Readonly<Record<string, unknown>>): RunCacheCounts {
  const parts = counts.ocr_cache_miss_key_parts;
  return {
    id,
    mode,
    rereadAll: counts.reread_all === true,
    cache: typeof counts.ocr_cache === 'string' ? counts.ocr_cache : 'not recorded',
    hit: count(counts.ocr_cache_hit),
    missAbsent: count(counts.ocr_cache_miss_absent),
    missKey: count(counts.ocr_cache_miss_key),
    missKeyParts:
      parts !== null && typeof parts === 'object'
        ? Object.fromEntries(Object.entries(parts as Record<string, unknown>).map(([k, v]) => [k, count(v)]))
        : {},
    missUnreadable: count(counts.ocr_cache_miss_unreadable),
    writeFailed: count(counts.ocr_cache_write_failed),
    read: count(counts.read),
  };
}

export function comparisonLines(name: string, c: TableComparison): string[] {
  const fields = Object.entries(c.fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([field, n]) => `${field} ${n}`);
  return [
    `register.${name}: ${c.equal} equal, ${c.differing} differing, ${c.onlyInSeed} only in the seed, ${c.onlyInDatabase} only in the database`,
    ...(fields.length > 0 ? [`  differing per column: ${fields.join(', ')}`] : []),
  ];
}

export function runLines(r: RunCacheCounts): string {
  const mode = r.rereadAll ? `${r.mode}, reread_all` : r.mode;
  if (r.cache !== 'on') return `run ${r.id} (${mode}): ${r.read} read, OCR word cache ${r.cache}`;
  const parts = Object.entries(r.missKeyParts).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
  return (
    `run ${r.id} (${mode}): ${r.read} read; OCR word cache: ${r.hit} hits; misses ${r.missAbsent} absent,` +
    ` ${r.missKey} key differs (${parts}), ${r.missUnreadable} unreadable; ${r.writeFailed} not written`
  );
}

function referenceOrgnrs(root: string): Set<string> {
  const list: unknown = JSON.parse(readFileSync(path.join(root, ...REFERENCE_RUN_FILE.split('/')), 'utf8'));
  if (!Array.isArray(list) || !list.every((o): o is string => typeof o === 'string' && /^[0-9]{9}$/.test(o))) {
    throw new Error(`${REFERENCE_RUN_FILE}: not a list of orgnrs`);
  }
  return new Set(list);
}

export function parseRuns(argv: readonly string[]): number | { error: string } {
  if (argv.length === 0) return 2;
  if (argv.length === 2 && argv[0] === '--runs' && /^[1-9][0-9]?$/.test(argv[1] ?? '')) return Number(argv[1]);
  return { error: `unknown argument ${argv.join(' ')}; allowed: nothing or --runs N (1-99)` };
}

export async function main(root: string, argv: readonly string[] = []): Promise<number> {
  const runs = parseRuns(argv);
  if (typeof runs !== 'number') {
    process.stderr.write(`analysis:seed-documents: ${runs.error}\n`);
    return 2;
  }
  const url = setting(root, 'INGEST_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('analysis:seed-documents: INGEST_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {}, connection: { default_transaction_read_only: true } });
  try {
    const orgnrs = referenceOrgnrs(root);
    let same = true;
    const out: string[] = [`OCR reference set: ${orgnrs.size} orgnrs (${REFERENCE_RUN_FILE}); ignoring ${IGNORED_COLUMNS.join(', ')}`];
    for (const table of TABLES) {
      const columns = (
        await sql<{ name: string }[]>`
          select column_name as name from information_schema.columns
          where table_schema = 'register' and table_name = ${table.name} order by ordinal_position`
      ).map((r) => r.name);
      const quoted = (c: string): string => `"${c.replaceAll('"', '""')}"`;
      const select = columns.map((c) => `${quoted(c)}::text as ${quoted(c)}`).join(', ');
      const database = (await sql.unsafe(
        `select ${select} from register.${table.name} where orgnr = any($1::text[])`,
        [[...orgnrs]],
      )) as unknown as Row[];
      const seed = seedRows(readFileSync(path.join(root, SEED_DIR, `${table.name}.csv`), 'utf8'), orgnrs);
      const comparison = compareRows(seed, database, table.key, columns);
      same = same && sameAsSeed(comparison);
      out.push(...comparisonLines(table.name, comparison));
    }
    const records = await sql<{ id: number; mode: string; counts: Record<string, unknown> | null }[]>`
      select id, mode, counts from run.step1
      where mode in ('documents', 'reread') and ended_at is not null
      order by id desc limit ${runs}`;
    out.push(`the last ${runs} ended documents and re-read runs, newest first:`);
    for (const r of records) out.push(`  ${runLines(runCacheCounts(r.id, r.mode, r.counts ?? {}))}`);
    out.push(same ? 'the database holds exactly the seed\'s rows (ignored columns aside)' : 'DIFFERENT from the seed: see the counts above');
    process.stdout.write(`${out.join('\n')}\n`);
    return same ? 0 : 1;
  } catch (error) {
    process.stderr.write(`analysis:seed-documents: ${(error as Error).message}\n`);
    return 1;
  } finally {
    await sql.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd(), process.argv.slice(2));
}
