// `pnpm seed`: load the committed demo seed (Story 1.3b; technical note
// AD-2, AD-16, AD-18).
//
// 1. Before any connection, every check in prepareSeed (seed-format.ts):
//    manifest version, migration id, file list and checksums, the shape of
//    seed/coverage.json, declared codes against fetched codes, and measured
//    reports. Any failure exits non-zero with a message naming the entry and
//    the check, and the database is not touched.
// 2. Then, as `loader` (LOADER_DATABASE_URL) in one transaction:
//    - the register tables in the catalog must be exactly SEED_TABLES and
//      LOADER_TABLES, so a table added later without a seed decision fails
//      here instead of keeping stale rows;
//    - one TRUNCATE over all of them;
//    - COPY … FROM STDIN of the checked bytes, with each file's header as the
//      column list, in foreign-key order. No amount is parsed in JS;
//    - the covered_industry rows from seed/coverage.json and the one dataset
//      row holding the manifest.
//    Any failure rolls the whole transaction back.
//
// Running it twice leaves the same state. It runs no DDL.
//
// Run: node scripts/seed-load.ts   (from the repository root)
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { setting } from './run-ingest.ts';
import {
  COVERAGE_FILE as COVERAGE_LABEL,
  LOADER_TABLES,
  SEED_TABLES,
  type SeedPlan,
  SeedRefusal,
  compareBytes,
  defaultSeedPaths,
  prepareSeed,
  seedFileName,
} from './seed-format.ts';

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

// The tables (plain and partitioned) in schema register, in byte order:
// the relations TRUNCATE applies to.
export async function registerTables(sql: postgres.Sql | postgres.TransactionSql): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select c.relname as name
    from pg_catalog.pg_class c
    where c.relnamespace = 'register'::regnamespace and c.relkind in ('r', 'p')
  `;
  return rows.map((r) => r.name).sort(compareBytes);
}

export async function assertTableSet(sql: postgres.Sql | postgres.TransactionSql): Promise<void> {
  const actual = await registerTables(sql);
  const expected = [...SEED_TABLES.map((t) => t.name), ...LOADER_TABLES].sort(compareBytes);
  if (actual.join(',') !== expected.join(',')) {
    throw new SeedRefusal(
      `register holds (${actual.join(', ')}); the loader knows (${expected.join(', ')}). Add the new table to SEED_TABLES or LOADER_TABLES and grant it to loader.`,
    );
  }
}

// The header line of a COPY csv file: plain column names only.
function headerColumns(file: string, bytes: Buffer): string[] {
  const end = bytes.indexOf(0x0a);
  const header = bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
  const columns = header.split(',');
  for (const column of columns) {
    if (!/^[a-z_][a-z0-9_]*$/.test(column)) throw new SeedRefusal(`${file}: header column "${column}" is not a plain name`);
  }
  return columns;
}

// The header must name exactly the table's columns in catalog order, so a
// seed exported under another schema is refused rather than loaded with
// NULLs in columns it lacks.
async function checkHeader(tx: postgres.TransactionSql, file: string, table: string, header: string[]): Promise<void> {
  const rows = await tx<{ name: string }[]>`
    select a.attname as name
    from pg_catalog.pg_attribute a
    where a.attrelid = ${`register.${table}`}::regclass and a.attnum > 0 and not a.attisdropped
    order by a.attnum
  `;
  const catalog = rows.map((r) => r.name);
  if (header.join(',') !== catalog.join(',')) {
    throw new SeedRefusal(
      `${file}: header (${header.join(', ')}) does not match register.${table} columns (${catalog.join(', ')})`,
    );
  }
}

async function copyIn(tx: postgres.TransactionSql, table: string, columns: string[], bytes: Buffer): Promise<void> {
  const text = `COPY register.${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) FROM STDIN (FORMAT csv, HEADER MATCH)`;
  const query = tx.unsafe(text);
  // postgres.js 3.4.9 resolves the COPY query with the writable and, when
  // the server rejects the rows after the last byte (a foreign-key check
  // runs at the end of the statement), passes the error only to the
  // already-resolved query: the writable never finishes and the load would
  // hang. The query's own reject is wrapped so that error fails the load.
  const internals = query as unknown as { reject?: unknown };
  const reject = internals.reject;
  if (typeof reject !== 'function') {
    throw new Error('postgres.js COPY internals changed (query.reject missing); the loader is written against postgres 3.4.9');
  }
  let fail: (error: unknown) => void = () => {};
  const failed = new Promise<never>((_, r) => {
    fail = r;
  });
  failed.catch(() => {}); // handled by the race below, or by the await on writable()
  internals.reject = (error: unknown) => {
    fail(error);
    (reject as (error: unknown) => void)(error);
  };
  const writable = await query.writable();
  await Promise.race([pipeline(Readable.from([bytes]), writable), failed]);
}

// Writes a checked plan in the caller's transaction. The CLI wraps it in
// sql.begin; the tests in a transaction they roll back.
export async function loadSeed(tx: postgres.TransactionSql, plan: SeedPlan): Promise<void> {
  await tx.unsafe(`SET LOCAL TimeZone = 'UTC'`);
  await tx.unsafe(`SET LOCAL DateStyle = 'ISO, YMD'`);
  await tx.unsafe(`SET LOCAL client_encoding = 'UTF8'`);

  await assertTableSet(tx);
  const all = await registerTables(tx);
  await tx.unsafe(`TRUNCATE ${all.map((t) => `register.${quoteIdent(t)}`).join(', ')}`);

  for (const table of SEED_TABLES) {
    const file = seedFileName(table);
    const bytes = plan.files.get(file);
    if (bytes === undefined) throw new SeedRefusal(`${file}: not in the checked plan`);
    const header = headerColumns(file, bytes);
    await checkHeader(tx, file, table.name, header);
    await copyIn(tx, table.name, header, bytes);
  }

  // FR-59 against the loaded rows, not only the manifest (which no checksum
  // covers): every declared code must have a company with that primary code.
  for (const entry of plan.coverage) {
    const [row] = await tx<{ ok: boolean }[]>`
      select exists (select 1 from register.company where naeringskode1 = ${entry.code}) as ok
    `;
    if (row?.ok !== true) {
      throw new SeedRefusal(`${COVERAGE_LABEL} entry ${entry.code}: declared but no loaded company has it as naeringskode1`);
    }
  }

  for (const entry of plan.coverage) {
    await tx`
      insert into register.covered_industry (code, measured, report, sha256)
      values (${entry.code}, ${entry.measured}, ${entry.report ?? null}, ${entry.sha256 ?? null})
    `;
  }
  const { manifest } = plan;
  await tx`
    insert into register.dataset (id, dataset, format_version, migration_id, manifest)
    values (1, ${manifest.dataset}, ${manifest.format_version}, ${manifest.migration_id}, ${JSON.stringify(manifest)}::text::jsonb)
  `;
}

export async function main(root: string): Promise<number> {
  let plan: SeedPlan;
  try {
    plan = prepareSeed(defaultSeedPaths(root));
  } catch (error) {
    process.stderr.write(`seed: refused, nothing loaded: ${(error as Error).message}\n`);
    return 1;
  }

  const url = setting(root, 'LOADER_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('seed: LOADER_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.begin((tx) => loadSeed(tx, plan));
    const counts = await sql<{ name: string; n: string }[]>`
      select 'company' as name, count(*)::text as n from register.company
      union all select 'filing', count(*)::text from register.filing
      union all select 'key_figures', count(*)::text from register.key_figures
      union all select 'covered_industry', count(*)::text from register.covered_industry
      union all select 'dataset', count(*)::text from register.dataset
    `;
    process.stdout.write(
      `seed: loaded ${plan.manifest.dataset} (migration ${plan.manifest.migration_id}): ${counts.map((c) => `${c.name} ${c.n}`).join(', ')}\n`,
    );
    return 0;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    process.stderr.write(
      `seed: failed, rolled back, nothing loaded: ${(error as Error).message}${typeof code === 'string' ? ` (${code})` : ''}\n`,
    );
    return 1;
  } finally {
    await sql.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd());
}
