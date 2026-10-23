// `pnpm ingest:document-set` (scripts/document-set.ts): the acceptance set
// of Story 2.1b's document run, and the committed seed/document-run.json.
// test/db/document-set.test.ts recomputes the set against the loaded seed.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import {
  DOCUMENT_RUN_FILE,
  REFERENCE_RUN_FILE,
  documentRunJson,
  documentRunSet,
  main,
  referenceRunSet,
} from '../scripts/document-set.ts';
import { REFERENCE_DRAW_FILE, compareBytes, parseDrawn } from '../scripts/seed-format.ts';

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

describe('the OCR reference run (--reference, Story 2.3)', () => {
  it('lists each drawn orgnr once, in byte order', () => {
    expect(
      referenceRunSet([
        { orgnr: '929821092', year: 2022 },
        { orgnr: '885583822', year: 2022 },
        { orgnr: '929821092', year: 2021 },
      ]),
    ).toEqual(['885583822', '929821092']);
  });

  it(`commits ${REFERENCE_RUN_FILE} as the script writes it from the committed draw`, () => {
    const drawn = parseDrawn(JSON.parse(readFileSync(path.join(root, REFERENCE_DRAW_FILE), 'utf8')));
    const text = readFileSync(path.join(root, REFERENCE_RUN_FILE), 'utf8');
    expect(text).toBe(documentRunJson(referenceRunSet(drawn)));
    expect(JSON.parse(text)).toHaveLength(20);
  });
});

describe('main: the argument routing', () => {
  // A scratch root holding only a copy of the committed draw: --reference
  // must not need the database or anything else.
  const scratchRoot = (): string => {
    const dir = mkdtempSync(path.join(tmpdir(), 'peerless-document-set-'));
    mkdirSync(path.join(dir, 'analysis/ocr-reference'), { recursive: true });
    mkdirSync(path.join(dir, 'seed'), { recursive: true });
    cpSync(path.join(root, REFERENCE_DRAW_FILE), path.join(dir, REFERENCE_DRAW_FILE));
    return dir;
  };

  it('writes the reference run from the draw with --reference, and nothing else', async () => {
    const dir = scratchRoot();
    try {
      expect(await main(dir, ['--reference'])).toBe(0);
      const drawn = parseDrawn(JSON.parse(readFileSync(path.join(dir, REFERENCE_DRAW_FILE), 'utf8')));
      expect(readFileSync(path.join(dir, REFERENCE_RUN_FILE), 'utf8')).toBe(documentRunJson(referenceRunSet(drawn)));
      expect(existsSync(path.join(dir, DOCUMENT_RUN_FILE))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses an unknown argument and writes nothing', async () => {
    const dir = scratchRoot();
    try {
      expect(await main(dir, ['--x'])).toBe(1);
      expect(readdirSync(path.join(dir, 'analysis/ocr-reference'))).toEqual(['drawn.json']);
      expect(readdirSync(path.join(dir, 'seed'))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
