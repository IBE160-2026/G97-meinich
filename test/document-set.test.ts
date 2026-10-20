// `pnpm ingest:document-set` (scripts/document-set.ts): the acceptance set
// of Story 2.1b's document run, and the committed seed/document-run.json.
// test/db/document-set.test.ts recomputes the set against the loaded seed.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { DOCUMENT_RUN_FILE, documentRunJson, documentRunSet } from '../scripts/document-set.ts';
import { compareBytes } from '../scripts/seed-format.ts';

const root = path.resolve(import.meta.dirname, '..');

describe('documentRunSet', () => {
  it('holds each subject and its pool once, in byte order', () => {
    const set = documentRunSet([
      { subject: '813235552', pool: [{ orgnr: '999999999' }, { orgnr: '100000008' }] },
      { subject: '814739082', pool: [{ orgnr: '100000008' }, { orgnr: '813235552' }] },
    ]);
    expect(set).toEqual(['100000008', '813235552', '814739082', '999999999']);
  });

  it('keeps a subject whose pool is empty', () => {
    expect(documentRunSet([{ subject: '813235552', pool: [] }])).toEqual(['813235552']);
  });
});

describe('documentRunJson', () => {
  it('writes one orgnr per line with a final LF, readable as a JSON list', () => {
    const text = documentRunJson(['100000008', '813235552']);
    expect(text).toBe('[\n  "100000008",\n  "813235552"\n]\n');
    expect(JSON.parse(text)).toEqual(['100000008', '813235552']);
    expect(documentRunJson([])).toBe('[]\n');
  });
});

describe(DOCUMENT_RUN_FILE, () => {
  const text = readFileSync(path.join(root, DOCUMENT_RUN_FILE), 'utf8');
  const orgnrs = JSON.parse(text) as unknown;

  it('is a JSON list of distinct nine-digit orgnrs in byte order, as the script writes it', () => {
    expect(Array.isArray(orgnrs)).toBe(true);
    const list = orgnrs as string[];
    expect(list.every((orgnr) => typeof orgnr === 'string' && /^\d{9}$/.test(orgnr))).toBe(true);
    expect([...list].sort(compareBytes)).toEqual(list);
    expect(new Set(list).size).toBe(list.length);
    expect(text).toBe(documentRunJson(list));
  });

  it('holds demo companies A and B, and not demo company C, whose industry is not covered', () => {
    const list = orgnrs as string[];
    for (const demo of DEMO_COMPANIES) expect(list).toContain(demo.orgnr);
    const config = readFileSync(path.join(root, 'ingest/config.toml'), 'utf8');
    const demoC = /\[demo_company_c\][^[]*?orgnr\s*=\s*"(\d{9})"/.exec(config)?.[1];
    expect(demoC).toBe('967534579');
    expect(list).not.toContain(demoC);
  });
});
