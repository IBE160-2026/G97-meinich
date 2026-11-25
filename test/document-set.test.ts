// `pnpm ingest:document-set` (scripts/document-set.ts): the acceptance set
// of Story 2.1b's document run, and the committed seed/document-run.json.
// test/db/document-set.test.ts recomputes the set against the loaded seed.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import {
  ALLOW_LIST_BANDS,
  DOCUMENT_RUN_FILE,
  LABELLED_DRAW_FILE,
  LABELLED_RUN_FILE,
  REFERENCE_RUN_FILE,
  allowListEntries,
  demoCompanyC,
  documentRunJson,
  documentRunSet,
  labelledRunJson,
  labelledRunSet,
  main,
  referenceRunSet,
} from '../scripts/document-set.ts';
import {
  REFERENCE_DRAW_FILE,
  REFERENCE_REASON,
  compareBytes,
  parseAllowListEntries,
  parseDrawn,
  withReferenceOrgnrs,
} from '../scripts/seed-format.ts';

const root = path.resolve(import.meta.dirname, '..');

describe('documentRunSet', () => {
  it('holds each subject and its pool once, in byte order', () => {
    const set = documentRunSet([
      { subject: '813235552', band: 0, pool: [{ orgnr: '999999999' }, { orgnr: '100000008' }] },
      { subject: '814739082', band: 0, pool: [{ orgnr: '100000008' }, { orgnr: '813235552' }] },
    ]);
    expect(set).toEqual(['100000008', '813235552', '814739082', '999999999']);
  });

  it('keeps a subject whose pool is empty', () => {
    expect(documentRunSet([{ subject: '813235552', band: 0, pool: [] }])).toEqual(['813235552']);
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

// Story 5.4: `--allow-list` writes demo A, B and C, every company in A's and
// B's pools at bands 0, 1 and 2, and the reference draw. Synthetic orgnrs
// throughout.
describe('the allow-list entries (--allow-list, Story 5.4)', () => {
  const A = '100000001';
  const B = '100000002';
  const C = '100000003';
  const drawn = [
    { orgnr: '300000002', year: 2022 },
    { orgnr: '300000001', year: 2021 },
    { orgnr: '300000002', year: 2021 },
  ];

  it('writes the allow-list entries for A, B, C and their peers at bands 0–2', () => {
    expect(ALLOW_LIST_BANDS).toEqual([0, 1, 2]);
    const entries = allowListEntries([{ orgnr: A }, { orgnr: B }], C, [
      { subject: A, band: 0, pool: [{ orgnr: '200000003' }] },
      { subject: A, band: 1, pool: [{ orgnr: '200000003' }, { orgnr: '200000002' }, { orgnr: B }] },
      // Band 2 alone holds 200000001, and a reference orgnr.
      { subject: A, band: 2, pool: [{ orgnr: '200000003' }, { orgnr: '200000002' }, { orgnr: '200000001' }, { orgnr: '300000001' }] },
      { subject: B, band: 0, pool: [] },
      { subject: B, band: 1, pool: [{ orgnr: '200000002' }] },
      { subject: B, band: 2, pool: [{ orgnr: '200000002' }, { orgnr: A }, { orgnr: '200000004' }] },
    ], drawn);
    expect(entries).toEqual([
      { orgnr: A, reason: 'Demoselskap A' },
      { orgnr: B, reason: 'Demoselskap B' },
      { orgnr: C, reason: 'Demoselskap C' },
      { orgnr: '200000001', reason: 'Peer for demoselskap A (bånd 2)' },
      { orgnr: '200000002', reason: 'Peer for demoselskap A (bånd 1) og B (bånd 1)' },
      { orgnr: '200000003', reason: 'Peer for demoselskap A (bånd 0)' },
      { orgnr: '200000004', reason: 'Peer for demoselskap B (bånd 2)' },
      { orgnr: '300000001', reason: REFERENCE_REASON },
      { orgnr: '300000002', reason: REFERENCE_REASON },
    ]);
    // The export writes the list back unchanged (withReferenceOrgnrs adds
    // nothing and accepts every reference entry), and it parses as an
    // allow-list.
    expect(withReferenceOrgnrs(entries, drawn)).toEqual(entries);
    expect(parseAllowListEntries(JSON.parse(JSON.stringify(entries)))).toEqual(entries);
  });

  it('refuses a demo company in the reference draw, a pool of another subject, and a missing demo', () => {
    expect(() => allowListEntries([{ orgnr: A }, { orgnr: B }], '300000001', [], drawn)).toThrow(/is in analysis\/ocr-reference/);
    expect(() =>
      allowListEntries([{ orgnr: A }, { orgnr: B }], C, [{ subject: '999999999', band: 0, pool: [] }], drawn),
    ).toThrow(/not demo company A or B/);
    expect(() => allowListEntries([{ orgnr: A }], C, [], drawn)).toThrow(/expected 2 demo companies/);
    expect(() => allowListEntries([{ orgnr: A }, { orgnr: A }], C, [], drawn)).toThrow(/named twice/);
  });

  it("reads demo company C from step 1's configuration", () => {
    expect(demoCompanyC(root)).toBe('967534579');
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

// Story 2.5d: the labelled set's document run, from Story 5.1's draw. The
// list ties no fingerprint result to an orgnr: it holds the orgnrs only.
describe('the labelled run (--labelled, Story 2.5d)', () => {
  const draw = (subjects: unknown[]): unknown => ({ seed: 1, subjects });

  it('lists every subject and candidate once, in byte order', () => {
    expect(
      labelledRunSet(
        draw([
          { orgnr: '925152153', filingYear: 2025, candidates: ['933233650', '826160632'] },
          { orgnr: '826160632', filingYear: 2025, candidates: ['925152153', '911967294'] },
        ]),
      ),
    ).toEqual(['826160632', '911967294', '925152153', '933233650']);
  });

  it('refuses a subject of another year, a malformed orgnr or no subjects', () => {
    expect(() => labelledRunSet(draw([{ orgnr: '925152153', filingYear: 2024, candidates: [] }]))).toThrow(/filingYear 2024/);
    expect(() => labelledRunSet(draw([{ orgnr: '92515215', filingYear: 2025, candidates: [] }]))).toThrow(/nine digits/);
    expect(() => labelledRunSet(draw([{ orgnr: '925152153', filingYear: 2025, candidates: [925152153] }]))).toThrow(/candidates/);
    expect(() => labelledRunSet({ seed: 1 })).toThrow(/no subjects/);
  });

  it('writes each entry as {"orgnr", "years": [2025]}, one per line, LF', () => {
    const text = labelledRunJson(['826160632', '911967294']);
    expect(text).toBe('[\n  {"orgnr": "826160632", "years": [2025]},\n  {"orgnr": "911967294", "years": [2025]}\n]\n');
    expect(JSON.parse(text)).toEqual([
      { orgnr: '826160632', years: [2025] },
      { orgnr: '911967294', years: [2025] },
    ]);
  });

  it(`commits ${LABELLED_RUN_FILE} as the script writes it from the committed draw`, () => {
    const committed = readFileSync(path.join(root, LABELLED_RUN_FILE), 'utf8');
    const orgnrs = labelledRunSet(JSON.parse(readFileSync(path.join(root, LABELLED_DRAW_FILE), 'utf8')));
    expect(committed).toBe(labelledRunJson(orgnrs));
    // 30 subjects and their 30 candidates each, overlapping (Story 5.1).
    expect(orgnrs).toHaveLength(845);
    expect([...orgnrs].sort(compareBytes)).toEqual(orgnrs);
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

  it('writes the labelled run from the draw with --labelled, and nothing else', async () => {
    const dir = scratchRoot();
    try {
      mkdirSync(path.join(dir, 'analysis/labelled-set'), { recursive: true });
      cpSync(path.join(root, LABELLED_DRAW_FILE), path.join(dir, LABELLED_DRAW_FILE));
      expect(await main(dir, ['--labelled'])).toBe(0);
      expect(readFileSync(path.join(dir, LABELLED_RUN_FILE), 'utf8')).toBe(readFileSync(path.join(root, LABELLED_RUN_FILE), 'utf8'));
      expect(existsSync(path.join(dir, DOCUMENT_RUN_FILE))).toBe(false);
      expect(existsSync(path.join(dir, REFERENCE_RUN_FILE))).toBe(false);
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
