// `pnpm ingest:document-set`: write seed/document-run.json, the orgnrs whose
// filed documents Story 2.1b's acceptance run reads with
// `pnpm ingest --documents seed/document-run.json`.
//
// The set is demo companies A and B plus each one's candidate pool at the
// standard size band (scripts/document-set-compute.ts). Peer selection lives
// in src/engine only, so the set is computed here, never in Python (AD-1).
//
// Demo company C is not in the set: its industry is not covered, and step 1
// fetches no filed document for an uncovered company (ingest/config.toml;
// documents mode refuses it).
//
// The file is input to the run, not seed data: `pnpm seed:export` never
// writes it and `pnpm seed` never reads it. It is a JSON list of orgnrs in
// byte order, one per line, LF.
//
// Reads the loaded database as `reader` (READER_DATABASE_URL, from the
// environment, then .env). The computation is loaded through Vite's module
// runner, with `server-only` resolved to its server entry as in
// vitest.db.config.ts, because src/ is written for the bundler.
//
// `--reference` (Story 2.3) writes analysis/ocr-reference/document-run.json
// instead: the orgnrs of the committed OCR reference draw
// (analysis/ocr-reference/drawn.json), for
// `pnpm ingest --documents analysis/ocr-reference/document-run.json`. It
// reads only the draw, never the database.
//
// Run: node scripts/document-set.ts [--reference]   (from the repository root)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setting } from './run-ingest.ts';
import type { SubjectPool } from './document-set-compute.ts';
import { type DrawnFiling, REFERENCE_DRAW_FILE, compareBytes, parseDrawn } from './seed-format.ts';

export const DOCUMENT_RUN_FILE = 'seed/document-run.json';
export const REFERENCE_RUN_FILE = 'analysis/ocr-reference/document-run.json';
const REFERENCE = '--reference';

// Every drawn orgnr once, in byte order. Step 1 reads every year in the
// register's list for each of them; Story 2.3 compares only the drawn years.
export function referenceRunSet(drawn: readonly DrawnFiling[]): string[] {
  return [...new Set(drawn.map((filing) => filing.orgnr))].sort(compareBytes);
}

// Every subject and every company in its pool, once, in byte order.
export function documentRunSet(groups: readonly SubjectPool[]): string[] {
  const orgnrs = new Set<string>();
  for (const group of groups) {
    orgnrs.add(group.subject);
    for (const peer of group.pool) orgnrs.add(peer.orgnr);
  }
  return [...orgnrs].sort(compareBytes);
}

// One orgnr per line, so a diff of the committed file reads line by line.
export function documentRunJson(orgnrs: readonly string[]): string {
  if (orgnrs.length === 0) return '[]\n';
  return `[\n${orgnrs.map((orgnr) => `  ${JSON.stringify(orgnr)}`).join(',\n')}\n]\n`;
}

function writeReferenceRun(root: string): number {
  try {
    const drawn = parseDrawn(JSON.parse(readFileSync(path.join(root, ...REFERENCE_DRAW_FILE.split('/')), 'utf8')));
    const orgnrs = referenceRunSet(drawn);
    writeFileSync(path.join(root, ...REFERENCE_RUN_FILE.split('/')), documentRunJson(orgnrs));
    process.stdout.write(`ingest:document-set: wrote ${REFERENCE_RUN_FILE} (${orgnrs.length} orgnrs)\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`ingest:document-set: ${(error as Error).message}\n`);
    return 1;
  }
}

export async function main(root: string, argv: readonly string[] = []): Promise<number> {
  if (argv.length === 1 && argv[0] === REFERENCE) return writeReferenceRun(root);
  if (argv.length > 0) {
    process.stderr.write(`ingest:document-set: unknown argument ${argv.join(' ')}; allowed: nothing or ${REFERENCE}\n`);
    return 1;
  }
  const url = setting(root, 'READER_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('ingest:document-set: READER_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  process.env.READER_DATABASE_URL = url;
  const { runnerImport } = await import('vite');
  const { module } = await runnerImport<typeof import('./document-set-compute.ts')>(
    path.join(root, 'scripts', 'document-set-compute.ts'),
    {
      root,
      configFile: false,
      logLevel: 'error',
      resolve: { alias: { 'server-only': path.join(root, 'node_modules', 'server-only', 'empty.js') } },
    },
  );
  try {
    const orgnrs = documentRunSet(await module.demoPools());
    writeFileSync(path.join(root, ...DOCUMENT_RUN_FILE.split('/')), documentRunJson(orgnrs));
    process.stdout.write(`ingest:document-set: wrote ${DOCUMENT_RUN_FILE} (${orgnrs.length} orgnrs)\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`ingest:document-set: ${(error as Error).message}\n`);
    return 1;
  } finally {
    await module.closeReader();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd(), process.argv.slice(2));
}
