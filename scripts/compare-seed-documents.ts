// `pnpm analysis:seed-documents`: does the local database hold exactly the
// committed seed's document rows for the OCR reference set, read by the
// current reader, and what did the OCR word cache do in the last runs?
// (Story 2.5d)
//
// The cache is proven on real data before the labelled set is read: the
// reference set is re-read twice, first by OCR (filling the cache), then
// from the cache (`--reread-all`). Both must give exactly the figures,
// statuses and checks the committed seed holds, and the second must have
// only hits. This script is that check: run it after the first re-read
// without a flag, and after the second with `--cache-proof`.
//
// - Rows: every register.document and register.document_column row of the
//   orgnrs in analysis/ocr-reference/document-run.json, in the database and
//   in seed/demo/, matched on their keys ((orgnr, filing_year) and
//   (orgnr, filing_year, role)). Every column is compared as text except
//   `reader_commit` and `read_at`, which a re-read changes by design. The
//   columns come from the catalog, so a column a migration adds is
//   compared without editing this file. An empty CSV field and NULL are the
//   same here (COPY … (FORMAT csv) writes NULL as an empty field).
// - Reader: every compared document in the database must carry the current
//   reader commit (`git log -1 --format=%H -- ingest/`, as `pnpm ingest`
//   computes it), so a re-read that replaced nothing does not pass.
// - Runs: the counts the OCR word cache recorded in the last `--runs N`
//   (default 2) ended document and re-read runs in run.step1. A count that
//   is absent or not an integer is shown as unreadable, never 0, and fails
//   the check. With `--cache-proof`, the newest of them must be a
//   `--reread-all` run with the cache on, every read a hit (and at least
//   one), and no miss or failed write.
//
// The decision is `verdict`, one pure function. Totals only: no orgnr, no
// figure. Exits 1 when any condition fails, so a difference stops the story
// before the labelled set.
//
// Reads the local database as `ingest` (INGEST_DATABASE_URL, from the
// environment, then .env), with `default_transaction_read_only` on:
// run.step1 is readable by `ingest` alone (`reader` has no access to schema
// run, Story 2.4), and `ingest` also reads the register's document tables.
// Nothing is written.
//
// Run: node scripts/compare-seed-documents.ts [--runs N] [--cache-proof]   (from the repository root)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres, { type Sql } from 'postgres';
import { REFERENCE_RUN_FILE } from './document-set.ts';
import { readerCommit, setting } from './run-ingest.ts';
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

/** A count as a run record holds it: an integer, or null when absent or not an integer (unreadable). */
export type Count = number | null;

export interface RunCacheCounts {
  readonly id: number;
  readonly mode: string;
  readonly rereadAll: boolean;
  /** "on", "off", or "not recorded" for a run from before Story 2.5d. */
  readonly cache: string;
  readonly read: Count;
  readonly hit: Count;
  readonly missAbsent: Count;
  readonly missKey: Count;
  readonly missKeyParts: Readonly<Record<string, Count>> | null;
  readonly missUnreadable: Count;
  readonly missPages: Count;
  readonly writeFailed: Count;
}

const count = (value: unknown): Count => (typeof value === 'number' && Number.isInteger(value) ? value : null);

// The cache's counts as one run record holds them (run.step1.counts).
export function runCacheCounts(id: number, mode: string, counts: Readonly<Record<string, unknown>>): RunCacheCounts {
  const parts = counts.ocr_cache_miss_key_parts;
  return {
    id,
    mode,
    rereadAll: counts.reread_all === true,
    cache: typeof counts.ocr_cache === 'string' ? counts.ocr_cache : 'not recorded',
    read: count(counts.read),
    hit: count(counts.ocr_cache_hit),
    missAbsent: count(counts.ocr_cache_miss_absent),
    missKey: count(counts.ocr_cache_miss_key),
    missKeyParts:
      parts !== null && typeof parts === 'object' && !Array.isArray(parts)
        ? Object.fromEntries(Object.entries(parts as Record<string, unknown>).map(([k, v]) => [k, count(v)]))
        : null,
    missUnreadable: count(counts.ocr_cache_miss_unreadable),
    missPages: count(counts.ocr_cache_miss_pages),
    writeFailed: count(counts.ocr_cache_write_failed),
  };
}

// The counts a run must hold readably: `read` always, and with the cache on
// every cache count.
function unreadableCounts(r: RunCacheCounts): string[] {
  const named: [string, Count][] = [['read', r.read]];
  if (r.cache === 'on') {
    named.push(
      ['ocr_cache_hit', r.hit],
      ['ocr_cache_miss_absent', r.missAbsent],
      ['ocr_cache_miss_key', r.missKey],
      ['ocr_cache_miss_unreadable', r.missUnreadable],
      ['ocr_cache_miss_pages', r.missPages],
      ['ocr_cache_write_failed', r.writeFailed],
    );
    if (r.missKeyParts === null) named.push(['ocr_cache_miss_key_parts', null]);
    else for (const [part, n] of Object.entries(r.missKeyParts)) named.push([`ocr_cache_miss_key_parts.${part}`, n]);
  }
  return named.filter(([, n]) => n === null).map(([name]) => name);
}

const shown = (n: Count): string => (n === null ? 'unreadable' : String(n));

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
  if (r.cache !== 'on') return `run ${r.id} (${mode}): ${shown(r.read)} read, OCR word cache ${r.cache}`;
  const parts =
    r.missKeyParts === null
      ? 'unreadable'
      : Object.entries(r.missKeyParts).map(([k, n]) => `${k} ${shown(n)}`).join(', ') || 'none';
  return (
    `run ${r.id} (${mode}): ${shown(r.read)} read; OCR word cache: ${shown(r.hit)} hits; misses ${shown(r.missAbsent)} absent,` +
    ` ${shown(r.missKey)} key differs (${parts}), ${shown(r.missUnreadable)} unreadable, ${shown(r.missPages)} no pages;` +
    ` ${shown(r.writeFailed)} not written`
  );
}

// Why `r` is not the proof that the cache gives the same read: empty when it is.
export function cacheProofFailures(r: RunCacheCounts | undefined): string[] {
  if (r === undefined) return ['no ended document or re-read run in run.step1'];
  const out: string[] = [];
  if (r.mode !== 'reread' || !r.rereadAll) out.push(`run ${r.id} is not a --reread-all run`);
  if (r.cache !== 'on') out.push(`run ${r.id}: the OCR word cache was ${r.cache}`);
  if (r.hit === null || r.read === null || r.hit !== r.read || r.hit <= 0) {
    out.push(`run ${r.id}: ${shown(r.hit)} hits of ${shown(r.read)} read; every read must be a hit, and at least one`);
  }
  const misses: [string, Count][] = [
    ['absent', r.missAbsent],
    ['key differs', r.missKey],
    ['unreadable', r.missUnreadable],
    ['no pages', r.missPages],
    ['not written', r.writeFailed],
  ];
  for (const [name, n] of misses) if (n !== 0) out.push(`run ${r.id}: ${shown(n)} ${name}, must be 0`);
  return out;
}

export interface VerdictInput {
  readonly comparisons: readonly { readonly name: string; readonly comparison: TableComparison }[];
  /** The reader_commit of every compared document in the database. */
  readonly readerCommits: readonly (string | null)[];
  readonly currentCommit: string;
  /** Newest first. */
  readonly runs: readonly RunCacheCounts[];
  readonly cacheProof: boolean;
}

// The decision: the lines to print and the exit code. 0 only when every row
// equals the seed's, every compared document carries the current reader
// commit, every count is readable, and with `cacheProof` the newest run is
// the proof.
export function verdict(input: VerdictInput): { exit: 0 | 1; lines: string[] } {
  const lines: string[] = [];
  const failures: string[] = [];
  for (const { name, comparison } of input.comparisons) {
    lines.push(...comparisonLines(name, comparison));
    if (!sameAsSeed(comparison)) failures.push(`register.${name} differs from the seed`);
  }
  const notCurrent = input.readerCommits.filter((c) => c !== input.currentCommit).length;
  lines.push(
    `reader commit ${input.currentCommit}: ${input.readerCommits.length - notCurrent} of ${input.readerCommits.length} documents read by it`,
  );
  if (input.readerCommits.length === 0) failures.push('no reference document in the database');
  if (notCurrent > 0) failures.push(`${notCurrent} documents not read by the current reader commit`);
  lines.push(`the last ${input.runs.length} ended documents and re-read runs, newest first:`);
  for (const r of input.runs) {
    lines.push(`  ${runLines(r)}`);
    const unreadable = unreadableCounts(r);
    if (unreadable.length > 0) failures.push(`run ${r.id}: unreadable counts: ${unreadable.join(', ')}`);
  }
  if (input.cacheProof) failures.push(...cacheProofFailures(input.runs[0]));
  if (failures.length === 0) {
    lines.push(
      input.cacheProof
        ? 'PASS: the rows equal the seed, read by the current reader, and the newest run read every document from the cache'
        : 'PASS: the rows equal the seed (ignored columns aside), read by the current reader',
    );
    return { exit: 0, lines };
  }
  lines.push(...failures.map((f) => `FAIL: ${f}`));
  return { exit: 1, lines };
}

export function referenceOrgnrs(root: string): Set<string> {
  const list: unknown = JSON.parse(readFileSync(path.join(root, ...REFERENCE_RUN_FILE.split('/')), 'utf8'));
  if (!Array.isArray(list) || !list.every((o): o is string => typeof o === 'string' && /^[0-9]{9}$/.test(o))) {
    throw new Error(`${REFERENCE_RUN_FILE}: not a list of orgnrs`);
  }
  return new Set(list);
}

export interface Options {
  readonly runs: number;
  readonly cacheProof: boolean;
}

export function parseArgs(argv: readonly string[]): Options | { error: string } {
  let runs = 2;
  let cacheProof = false;
  let runsSeen = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cache-proof' && !cacheProof) {
      cacheProof = true;
    } else if (arg === '--runs' && !runsSeen && /^[1-9][0-9]?$/.test(argv[i + 1] ?? '')) {
      runs = Number(argv[i + 1]);
      runsSeen = true;
      i += 1;
    } else {
      return { error: `unknown argument ${argv.join(' ')}; allowed: --runs N (1-99) and --cache-proof, each at most once` };
    }
  }
  return { runs, cacheProof };
}

// The script's one connection: read-only, so nothing it runs can write.
export function connect(url: string): Sql {
  return postgres(url, { max: 1, onnotice: () => {}, connection: { default_transaction_read_only: true } });
}

// The database's side of the comparison: each table's comparison with the
// seed, and the reader_commit of each compared document.
export async function readComparisons(
  sql: Sql,
  root: string,
  orgnrs: ReadonlySet<string>,
): Promise<{ comparisons: VerdictInput['comparisons']; readerCommits: (string | null)[] }> {
  const comparisons: { name: string; comparison: TableComparison }[] = [];
  let readerCommits: (string | null)[] = [];
  for (const table of TABLES) {
    const columns = (
      await sql<{ name: string }[]>`
        select column_name as name from information_schema.columns
        where table_schema = 'register' and table_name = ${table.name} order by ordinal_position`
    ).map((r) => r.name);
    const quoted = (c: string): string => `"${c.replaceAll('"', '""')}"`;
    const select = columns.map((c) => `${quoted(c)}::text as ${quoted(c)}`).join(', ');
    const database = (await sql.unsafe(`select ${select} from register.${table.name} where orgnr = any($1::text[])`, [
      [...orgnrs],
    ])) as unknown as Row[];
    const seed = seedRows(readFileSync(path.join(root, SEED_DIR, `${table.name}.csv`), 'utf8'), orgnrs);
    comparisons.push({ name: table.name, comparison: compareRows(seed, database, table.key, columns) });
    if (table.name === 'document') readerCommits = database.map((row) => row.reader_commit ?? null);
  }
  return { comparisons, readerCommits };
}

export async function main(root: string, argv: readonly string[] = []): Promise<number> {
  const options = parseArgs(argv);
  if ('error' in options) {
    process.stderr.write(`analysis:seed-documents: ${options.error}\n`);
    return 2;
  }
  const current = readerCommit(root);
  if ('error' in current) {
    process.stderr.write(`analysis:seed-documents: no current reader commit: ${current.error}\n`);
    return 1;
  }
  const url = setting(root, 'INGEST_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('analysis:seed-documents: INGEST_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const sql = connect(url);
  try {
    const orgnrs = referenceOrgnrs(root);
    const { comparisons, readerCommits } = await readComparisons(sql, root, orgnrs);
    const records = await sql<{ id: number; mode: string; counts: Record<string, unknown> | null }[]>`
      select id, mode, counts from run.step1
      where mode in ('documents', 'reread') and ended_at is not null
      order by id desc limit ${options.runs}`;
    const result = verdict({
      comparisons,
      readerCommits,
      currentCommit: current.commit,
      runs: records.map((r) => runCacheCounts(r.id, r.mode, r.counts ?? {})),
      cacheProof: options.cacheProof,
    });
    const header = `OCR reference set: ${orgnrs.size} orgnrs (${REFERENCE_RUN_FILE}); ignoring ${IGNORED_COLUMNS.join(', ')}`;
    process.stdout.write(`${[header, ...result.lines].join('\n')}\n`);
    return result.exit;
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
