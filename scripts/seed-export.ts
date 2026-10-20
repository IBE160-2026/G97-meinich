// `pnpm seed:export`: write the step-1 tables to the committed demo seed
// (Story 1.3b; technical note AD-16, AD-18).
//
// - Connects as `reader` (READER_DATABASE_URL, from the environment, then
//   .env) and runs no DDL. One read-only, repeatable-read transaction, so
//   every file comes from the same snapshot.
// - Each table in SEED_TABLES is copied by COPY … TO STDOUT (FORMAT csv,
//   HEADER) with its catalog column list (by attnum), ordered by its
//   primary key with COLLATE "C" on text columns. TimeZone UTC and DateStyle
//   ISO, YMD make read_at and the dates round-trip byte for byte. No value
//   is parsed in JS.
// - Writes seed/demo/{company,filing,key_figures,document,document_column}.csv,
//   seed/demo/manifest.json and seed/allow-list.json, LF and UTF-8. Never
//   seed/coverage.json.
// - Refuses, before writing any file, a document figure (a row of
//   register.document_column) for an orgnr not on seed/allow-list.json, and
//   writes the allow-list back with the entries it read.
// - Running it twice on the same database gives byte-identical files.
//
// A later migration invalidates the seed: the PR that adds a migration runs
// `pnpm exec supabase migration up` on a loaded database and then this
// script, in the same PR (README, "Seed").
//
// Run: node scripts/seed-export.ts   (from the repository root)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { setting } from './run-ingest.ts';
import {
  ALLOW_LIST_FILE,
  COVERAGE_FILE,
  DATASET,
  type Manifest,
  MANIFEST_FILE,
  SEED_DIR,
  SEED_TABLES,
  SEED_VERSION,
  type SeedTable,
  SeedRefusal,
  checkDeclaredFetched,
  compareBytes,
  exportPaths,
  latestMigrationId,
  orderByClause,
  parseAllowList,
  readCoverage,
  refuseUnlistedDocumentFigures,
  seedFileName,
  sha256,
  stableJson,
} from './seed-format.ts';

type Sql = postgres.Sql | postgres.TransactionSql;

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

async function columnsOf(sql: Sql, table: string): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select a.attname as name
    from pg_catalog.pg_attribute a
    where a.attrelid = ${`register.${table}`}::regclass and a.attnum > 0 and not a.attisdropped
    order by a.attnum
  `;
  return rows.map((r) => r.name);
}

// The declared sort columns must be the table's primary key, and a column
// sorts with COLLATE "C" exactly when it is a string type.
async function checkPrimaryKey(sql: Sql, table: SeedTable): Promise<void> {
  const rows = await sql<{ name: string; is_string: boolean }[]>`
    select a.attname as name, t.typcategory = 'S' as is_string
    from pg_catalog.pg_index i
    cross join lateral unnest(i.indkey) with ordinality as k(attnum, ord)
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
    join pg_catalog.pg_type t on t.oid = a.atttypid
    where i.indrelid = ${`register.${table.name}`}::regclass and i.indisprimary
    order by k.ord
  `;
  const actual = rows.map((r) => `${r.name}:${r.is_string}`).join(',');
  const declared = table.primaryKey.map((c) => `${c.name}:${c.text}`).join(',');
  if (actual !== declared) {
    throw new SeedRefusal(`register.${table.name}: primary key is (${actual}), SEED_TABLES declares (${declared})`);
  }
}

async function copyOut(sql: Sql, table: SeedTable): Promise<Buffer> {
  await checkPrimaryKey(sql, table);
  const columns = (await columnsOf(sql, table.name)).map(quoteIdent).join(', ');
  const query = `COPY (SELECT ${columns} FROM register.${quoteIdent(table.name)} ${orderByClause(table)}) TO STDOUT (FORMAT csv, HEADER)`;
  const stream = await sql.unsafe(query).readable();
  // Flowing mode ('data' events), not for-await. postgres.js 3.4.9 pauses
  // the socket when a push into the readable reports backpressure and
  // resumes it only from read(); if that happens on the last chunk, the
  // stream ends with the socket still paused and the next query on the
  // connection never completes. In flowing mode with nothing buffered every
  // push is delivered at once and never reports backpressure.
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return Buffer.concat(chunks);
}

// Writes the seed into outRoot (the repository root unless a test passes a
// scratch directory). Reads coverage.json and the migrations from root.
// sql must be a transaction: the settings are SET LOCAL.
export async function exportSeed(sql: postgres.TransactionSql, root: string, outRoot: string = root): Promise<Manifest> {
  await sql.unsafe(`SET LOCAL TimeZone = 'UTC'`);
  await sql.unsafe(`SET LOCAL DateStyle = 'ISO, YMD'`);
  await sql.unsafe(`SET LOCAL client_encoding = 'UTF8'`);

  const coverage = readCoverage(path.join(root, ...COVERAGE_FILE.split('/')));
  const migrationId = latestMigrationId(root);

  const outputs = new Map<string, Buffer>();
  for (const table of SEED_TABLES) outputs.set(seedFileName(table), await copyOut(sql, table));

  // The declared codes with at least one company whose primary industry is
  // that code. Demo company C's industry is not declared, so never included.
  const declared = coverage.map((entry) => entry.code);
  const fetched = await sql<{ code: string }[]>`
    select distinct naeringskode1 as code from register.company where naeringskode1 = any(${declared}::text[])
  `;
  // The loader refuses a declared code that was not fetched; refuse it here
  // too, before any file is written.
  checkDeclaredFetched(
    coverage,
    fetched.map((r) => r.code),
  );
  // A document figure is a row of register.document_column (Story 2.1b).
  // None may be exported for an orgnr the allow-list does not name.
  const allowListFile = path.join(root, ...ALLOW_LIST_FILE.split('/'));
  const allowListJson: unknown = existsSync(allowListFile) ? JSON.parse(readFileSync(allowListFile, 'utf8')) : [];
  const allowList = parseAllowList(allowListJson);
  refuseUnlistedDocumentFigures(
    new Map([...outputs].map(([file, bytes]) => [file, bytes.toString('utf8')])),
    allowList,
  );
  const documentFigures = await sql<{ orgnr: string }[]>`
    select distinct orgnr from register.document_column
  `;
  const [range] = await sql<{ min: string | null; max: string | null }[]>`
    select min(read_at)::text as min, max(read_at)::text as max from (
      select read_at from register.company union all select read_at from register.filing
      union all select read_at from register.document
    ) r
  `;
  if (range?.min === null || range?.min === undefined || range.max === null) {
    throw new SeedRefusal('register.company and register.filing are empty; nothing to export');
  }

  const manifest: Manifest = {
    dataset: DATASET,
    document_figure_orgnrs: documentFigures.map((r) => r.orgnr).sort(compareBytes),
    fetched_codes: fetched.map((r) => r.code).sort(compareBytes),
    files: Object.fromEntries([...outputs].map(([file, bytes]) => [file, sha256(bytes)])),
    format_version: SEED_VERSION,
    migration_id: migrationId,
    read_at: { max: range.max, min: range.min },
  };

  const written = new Map<string, Buffer | string>();
  for (const [file, bytes] of outputs) written.set(`${SEED_DIR}/${file}`, bytes);
  written.set(`${SEED_DIR}/${MANIFEST_FILE}`, stableJson(manifest));
  written.set(ALLOW_LIST_FILE, stableJson(allowListJson));

  const allowed = exportPaths();
  for (const relative of written.keys()) {
    if (relative === COVERAGE_FILE || !allowed.includes(relative)) {
      throw new Error(`seed:export: refusing to write ${relative}`);
    }
  }

  // seed/demo belongs to the export: a stale file there would be refused by
  // the loader as unlisted.
  const seedDir = path.join(outRoot, ...SEED_DIR.split('/'));
  mkdirSync(seedDir, { recursive: true });
  for (const file of readdirSync(seedDir)) {
    if (!written.has(`${SEED_DIR}/${file}`)) rmSync(path.join(seedDir, file), { recursive: true });
  }
  for (const [relative, content] of written) {
    writeFileSync(path.join(outRoot, ...relative.split('/')), content);
  }
  return manifest;
}

export async function main(root: string): Promise<number> {
  const url = setting(root, 'READER_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('seed:export: READER_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const manifest = await sql.begin('isolation level repeatable read read only', (tx) => exportSeed(tx, root));
    process.stdout.write(
      `seed:export: wrote ${SEED_DIR} (migration ${manifest.migration_id}, fetched ${manifest.fetched_codes.length} code(s)) and ${ALLOW_LIST_FILE}\n`,
    );
    return 0;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    process.stderr.write(
      `seed:export: ${(error as Error).message}${typeof code === 'string' ? ` (${code})` : ''}\n`,
    );
    return 1;
  } finally {
    await sql.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd());
}
