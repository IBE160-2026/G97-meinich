// `pnpm restore:documents [dir]` (Story 2.10): restore a local dump of the
// document rows the seed does not hold, then derive their fingerprints.
//
// The acceptance and labelled-set runs' rows of register.document and
// register.document_column are local data until Story 5.4 (README, "Seed"):
// `pnpm seed` truncates them, and this puts them back from the CSV dump the
// README describes, `.local/document-run-2.5d/` unless a directory is named.
//
//   1. A missing default directory (a fresh clone has none) is said first,
//      whatever the environment: nothing is restored, derive does not run,
//      and the exit code is 0.
//   2. LOADER_DATABASE_URL, which the restore writes through, and
//      DERIVE_DATABASE_URL, which the derive after it writes through, must
//      both point at localhost or 127.0.0.1; any other host is refused
//      before a file is read or a connection is made. A named directory
//      that is missing, or a dump without both files, then exits 1.
//   3. Each file is copied with the column names from its own first line, so
//      a dump taken before a nullable column was added still restores. Both
//      go in one transaction as `loader`, documents before their columns.
//   4. A row whose key is already stored rolls the whole restore back: it
//      says to run `pnpm seed` first and exits 1. Any other failure rolls
//      back too and exits 1.
//   5. After a restore it runs `pnpm derive` (scripts/derive.ts), then prints
//      the counts of documents, columns, fingerprints and classification
//      rows. A failing derive exits 1, with the counts.
//
// It never deletes a file and runs no DDL.
//
// Run: node scripts/restore-documents.ts [dir]   (from the repository root)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { setting } from './run-ingest.ts';
import { copyIn } from './seed-load.ts';

/** The dump restored when no directory is named: Story 2.5d's labelled-set run (README, "Seed"). */
export const DEFAULT_DUMP = '.local/document-run-2.5d';

/** The tables a dump holds, in the order they are restored: a column references its document. */
export const DUMP_TABLES = ['document', 'document_column'] as const;
export type DumpTableName = (typeof DUMP_TABLES)[number];

/** One file of a dump: its table, the column names from its first line, and its bytes. */
export type DumpTable = { readonly table: DumpTableName; readonly columns: readonly string[]; readonly bytes: Buffer };

export type RestoreCounts = {
  readonly documents: number;
  readonly columns: number;
  readonly fingerprints: number;
  readonly classifications: number;
};

/** The database as the restore uses it. */
export type RestoreDb = {
  /** Copies every table in one transaction; throws, having rolled back, on any failure. */
  readonly restore: (tables: readonly DumpTable[]) => Promise<void>;
  readonly counts: () => Promise<RestoreCounts>;
  readonly end: () => Promise<void>;
};

export type RestoreDeps = {
  readonly root: string;
  readonly setting: (name: string) => string | undefined;
  readonly exists: (file: string) => boolean;
  readonly readFile: (file: string) => Buffer;
  readonly openDb: (url: string) => RestoreDb;
  /** Runs `pnpm derive`; its exit code. */
  readonly derive: () => number;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
};

/** A refusal: said on stderr, nothing written. */
class Refusal extends Error {}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Refuses `name`'s connection string when it is unset or its host is not the local database. */
export function assertLocal(name: string, url: string | undefined): asserts url is string {
  if (url === undefined) throw new Refusal(`${name} is not set; run \`pnpm db:start\` and \`pnpm db:roles\``);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Refusal(`${name} is not a URL`);
  }
  // postgres.js also reads a host from the query; one there is refused too.
  if (!LOCAL_HOSTS.has(parsed.hostname) || parsed.searchParams.has('host')) {
    throw new Refusal(
      `restores only into a local database (localhost or 127.0.0.1), not ${parsed.hostname || 'an empty host'} (${name})`,
    );
  }
}

/** The column names on a dump file's first line: plain names only, a trailing carriage return dropped. */
export function headerColumns(file: string, bytes: Buffer): string[] {
  const end = bytes.indexOf(0x0a);
  const header = bytes
    .subarray(0, end === -1 ? bytes.length : end)
    .toString('utf8')
    .replace(/\r$/, '');
  const columns = header.split(',');
  for (const column of columns) {
    if (!/^[a-z_][a-z0-9_]*$/.test(column)) throw new Refusal(`${file}: header column "${column}" is not a plain name`);
  }
  return columns;
}

const isUniqueViolation = (error: unknown): boolean => (error as { code?: unknown }).code === '23505';

export async function restoreDocuments(args: readonly string[], deps: RestoreDeps): Promise<number> {
  const { err, out } = deps;
  if (args.length > 1) {
    err('restore: give at most one dump directory');
    return 1;
  }
  const named = args[0];
  const relative = named ?? DEFAULT_DUMP;
  const dir = path.resolve(deps.root, relative);

  try {
    if (named === undefined && !deps.exists(dir)) {
      out(`restore: no dump at ${relative} (a fresh clone has none); nothing restored, derive not run.`);
      return 0;
    }

    const url = deps.setting('LOADER_DATABASE_URL');
    assertLocal('LOADER_DATABASE_URL', url);
    // pnpm derive TRUNCATEs register.fingerprint through its own URL.
    assertLocal('DERIVE_DATABASE_URL', deps.setting('DERIVE_DATABASE_URL'));

    if (!deps.exists(dir)) throw new Refusal(`no dump directory at ${relative}`);
    const tables: DumpTable[] = DUMP_TABLES.map((table) => {
      const file = path.join(dir, `${table}.csv`);
      if (!deps.exists(file)) throw new Refusal(`${relative} has no ${table}.csv`);
      const bytes = deps.readFile(file);
      return { table, columns: headerColumns(`${table}.csv`, bytes), bytes };
    });

    const db = deps.openDb(url);
    let counts: RestoreCounts;
    try {
      try {
        await db.restore(tables);
      } catch (error) {
        if (isUniqueViolation(error)) {
          err(`restore: rolled back, nothing restored: a row of ${relative} is already stored. Run \`pnpm seed\` first, then restore.`);
          return 1;
        }
        const code = (error as { code?: unknown }).code;
        err(`restore: failed, rolled back, nothing restored: ${(error as Error).message}${typeof code === 'string' ? ` (${code})` : ''}`);
        return 1;
      }
      out(`restore: restored ${relative} (${tables.map((t) => `${t.table}.csv`).join(', ')}) as loader; running pnpm derive.`);
      const derived = deps.derive();
      counts = await db.counts();
      out(
        `restore: documents ${counts.documents}, columns ${counts.columns}, fingerprints ${counts.fingerprints}, classification rows ${counts.classifications}`,
      );
      if (derived !== 0) {
        err(`restore: pnpm derive failed (exit ${derived}); the restored documents have no fingerprints until it runs. Run \`pnpm derive\` again.`);
        return 1;
      }
      return 0;
    } finally {
      await db.end();
    }
  } catch (error) {
    if (error instanceof Refusal) {
      err(`restore: refused, nothing restored: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

/**
 * Copies `tables` in the caller's transaction, in order, each with its own
 * header as the column list. The CLI wraps it in one sql.begin; the database
 * test in a transaction it rolls back (test/db/restore-documents.test.ts).
 */
export async function restoreInto(tx: postgres.TransactionSql, tables: readonly DumpTable[]): Promise<void> {
  await tx.unsafe(`SET LOCAL TimeZone = 'UTC'`);
  await tx.unsafe(`SET LOCAL client_encoding = 'UTF8'`);
  for (const table of tables) await copyIn(tx, table.table, [...table.columns], table.bytes);
}

/** The local database as `loader`. */
function loaderDb(url: string): RestoreDb {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  return {
    restore: async (tables) => {
      await sql.begin((tx) => restoreInto(tx, tables));
    },
    counts: async () => {
      const [row] = await sql<RestoreCounts[]>`
        select (select count(*) from register.document)::int as documents,
               (select count(*) from register.document_column)::int as columns,
               (select count(*) from register.fingerprint)::int as fingerprints,
               (select count(*) from register.classification)::int as classifications
      `;
      if (row === undefined) throw new Error('restore: the count query returned no row');
      return row;
    },
    end: () => sql.end(),
  };
}

// The same derive as `pnpm derive`, with the same Node as this script.
function runDerive(root: string): number {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'derive.ts')], { cwd: root, stdio: 'inherit' });
  if (result.error !== undefined) {
    process.stderr.write(`restore: could not run pnpm derive: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = process.cwd();
  process.exitCode = await restoreDocuments(process.argv.slice(2), {
    root,
    setting: (name) => setting(root, name),
    exists: existsSync,
    readFile: (file) => readFileSync(file),
    openDb: loaderDb,
    derive: () => runDerive(root),
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  });
}
