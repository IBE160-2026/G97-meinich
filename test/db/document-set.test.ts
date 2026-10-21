// The committed seed/document-run.json is what `pnpm ingest:document-set`
// computes from the loaded demo seed (Story 2.1b): demo A and B and each
// one's stages-1–3 pool at the standard band, through the app's own reads
// and src/engine/peers.ts. Read-only.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DOCUMENT_RUN_FILE, documentRunJson, documentRunSet } from '../../scripts/document-set.ts';
import { root, setting } from './db-env.ts';

const url = setting('READER_DATABASE_URL');
if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
process.env.READER_DATABASE_URL = url;

const { closeReader, demoPools } = await import('../../scripts/document-set-compute.ts');

afterAll(async () => {
  await closeReader();
  delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
});

describe(DOCUMENT_RUN_FILE, () => {
  it('equals the set computed from the loaded seed', async () => {
    const pools = await demoPools();
    expect(pools).toHaveLength(2);
    for (const pool of pools) expect(pool.pool.length, pool.subject).toBeGreaterThan(0);
    const committed = readFileSync(path.join(root, DOCUMENT_RUN_FILE), 'utf8');
    expect(committed).toBe(documentRunJson(documentRunSet(pools)));
  });
});
