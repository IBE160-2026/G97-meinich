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
// `--labelled` (Story 2.5d) writes analysis/labelled-set/document-run.json:
// every subject and candidate of Story 5.1's draw
// (analysis/labelled-set/drawn.json), each once in byte order, as
// `{"orgnr": …, "years": [2025]}`, so
// `pnpm ingest --documents analysis/labelled-set/document-run.json` fetches
// only the reference year's document. It reads only the draw, never the
// database, and refuses a draw whose subjects are not all of that year.
//
// Run: node scripts/document-set.ts [--reference | --labelled]   (from the repository root)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setting } from './run-ingest.ts';
import type { SubjectPool } from './document-set-compute.ts';
import { type DrawnFiling, REFERENCE_DRAW_FILE, compareBytes, parseDrawn } from './seed-format.ts';

export const DOCUMENT_RUN_FILE = 'seed/document-run.json';
export const REFERENCE_RUN_FILE = 'analysis/ocr-reference/document-run.json';
export const LABELLED_DRAW_FILE = 'analysis/labelled-set/drawn.json';
export const LABELLED_RUN_FILE = 'analysis/labelled-set/document-run.json';
// The labelled set's reference year (Story 5.1: every subject's benchmark
// filing is of it); the run reads only its document (Story 2.5d).
export const LABELLED_YEAR = 2025;
const REFERENCE = '--reference';
const LABELLED = '--labelled';
const ORGNR = /^[0-9]{9}$/;

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

// The orgnrs of Story 5.1's draw: each subject and each of its candidates.
// Throws on a draw that is not {seed, subjects: [{orgnr, filingYear,
// candidates, …}]} with nine-digit orgnrs and every filingYear the
// reference year.
export function labelledRunSet(draw: unknown): string[] {
  if (typeof draw !== 'object' || draw === null || !Array.isArray((draw as { subjects?: unknown }).subjects)) {
    throw new Error(`${LABELLED_DRAW_FILE}: no subjects list`);
  }
  const orgnrs = new Set<string>();
  for (const subject of (draw as { subjects: unknown[] }).subjects) {
    if (typeof subject !== 'object' || subject === null) throw new Error(`${LABELLED_DRAW_FILE}: a subject is not an object`);
    const { orgnr, filingYear, candidates } = subject as { orgnr?: unknown; filingYear?: unknown; candidates?: unknown };
    if (typeof orgnr !== 'string' || !ORGNR.test(orgnr)) throw new Error(`${LABELLED_DRAW_FILE}: a subject orgnr is not nine digits`);
    if (filingYear !== LABELLED_YEAR) {
      throw new Error(`${LABELLED_DRAW_FILE}: subject ${orgnr} has filingYear ${String(filingYear)}, not ${LABELLED_YEAR}`);
    }
    if (!Array.isArray(candidates) || !candidates.every((c): c is string => typeof c === 'string' && ORGNR.test(c))) {
      throw new Error(`${LABELLED_DRAW_FILE}: subject ${orgnr}'s candidates are not nine-digit orgnrs`);
    }
    orgnrs.add(orgnr);
    for (const candidate of candidates) orgnrs.add(candidate);
  }
  return [...orgnrs].sort(compareBytes);
}

// One `{"orgnr", "years": [2025]}` entry per line, LF, readable by step 1's
// read_document_list.
export function labelledRunJson(orgnrs: readonly string[]): string {
  if (orgnrs.length === 0) return '[]\n';
  const entry = (orgnr: string): string => `  {"orgnr": ${JSON.stringify(orgnr)}, "years": [${LABELLED_YEAR}]}`;
  return `[\n${orgnrs.map(entry).join(',\n')}\n]\n`;
}

function writeLabelledRun(root: string): number {
  try {
    const orgnrs = labelledRunSet(JSON.parse(readFileSync(path.join(root, ...LABELLED_DRAW_FILE.split('/')), 'utf8')));
    writeFileSync(path.join(root, ...LABELLED_RUN_FILE.split('/')), labelledRunJson(orgnrs));
    process.stdout.write(`ingest:document-set: wrote ${LABELLED_RUN_FILE} (${orgnrs.length} orgnrs, ${LABELLED_YEAR} only)\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`ingest:document-set: ${(error as Error).message}\n`);
    return 1;
  }
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
  if (argv.length === 1 && argv[0] === LABELLED) return writeLabelledRun(root);
  if (argv.length > 0) {
    process.stderr.write(`ingest:document-set: unknown argument ${argv.join(' ')}; allowed: nothing, ${REFERENCE} or ${LABELLED}\n`);
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
