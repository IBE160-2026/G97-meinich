// `pnpm analysis:seed-documents` (scripts/compare-seed-documents.ts, Story
// 2.5d): the reference set's rows in the database against the committed
// seed, ignoring what a re-read changes by design; the reader commit of
// every compared document; and the OCR word cache's counts per run, with
// `--cache-proof` for the second re-read. Totals only. The database side is
// in test/db/compare-seed-documents.test.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  IGNORED_COLUMNS,
  TABLES,
  type Row,
  type RunCacheCounts,
  type TableComparison,
  type VerdictInput,
  compareRows,
  comparisonLines,
  parseArgs,
  runCacheCounts,
  runLines,
  sameAsSeed,
  seedRows,
  verdict,
} from '../scripts/compare-seed-documents.ts';
import { REFERENCE_RUN_FILE } from '../scripts/document-set.ts';
import { SEED_DIR } from '../scripts/seed-format.ts';

const root = path.resolve(import.meta.dirname, '..');
const KEY = ['orgnr', 'filing_year', 'role'];
const COLUMNS = ['orgnr', 'filing_year', 'role', 'status', 'c1', 'salgsinntekt_ore', 'reader_commit', 'read_at'];
const COMMIT = 'f'.repeat(40);

const row = (overrides: Partial<Record<string, string | null>> = {}): Row => ({
  orgnr: '979607008',
  filing_year: '2025',
  role: 'current',
  status: 'reconciled',
  c1: 'pass',
  salgsinntekt_ore: '7263231000',
  reader_commit: 'b57aabafa35ffe1b7f8536e278816613cbd768b9',
  read_at: '2026-11-06 14:27:16.384483+00',
  ...overrides,
});

describe('compareRows', () => {
  it('ignores reader_commit and read_at, which a re-read changes by design', () => {
    expect(IGNORED_COLUMNS).toEqual(['reader_commit', 'read_at']);
    const reread = row({ reader_commit: COMMIT, read_at: '2026-11-08 09:00:00+00' });
    const c = compareRows([row()], [reread], KEY, COLUMNS);
    expect(c).toEqual({ equal: 1, differing: 0, onlyInSeed: 0, onlyInDatabase: 0, fields: {} });
    expect(sameAsSeed(c)).toBe(true);
  });

  it('counts a differing figure, status or check per column', () => {
    const seed = [row(), row({ role: 'prior' }), row({ filing_year: '2024' })];
    const database = [
      row({ salgsinntekt_ore: '72632310000' }),
      row({ role: 'prior', status: 'failed_reconciliation', c1: 'fail' }),
      row({ filing_year: '2024' }),
    ];
    const c = compareRows(seed, database, KEY, COLUMNS);
    expect(c).toEqual({
      equal: 1,
      differing: 2,
      onlyInSeed: 0,
      onlyInDatabase: 0,
      fields: { salgsinntekt_ore: 1, status: 1, c1: 1 },
    });
    expect(sameAsSeed(c)).toBe(false);
    expect(comparisonLines('document_column', c)).toEqual([
      'register.document_column: 1 equal, 2 differing, 0 only in the seed, 0 only in the database',
      '  differing per column: c1 1, salgsinntekt_ore 1, status 1',
    ]);
  });

  it('counts a figure gone to NULL as differing, and an empty CSV field as NULL', () => {
    expect(compareRows([row()], [row({ salgsinntekt_ore: null })], KEY, COLUMNS).fields).toEqual({ salgsinntekt_ore: 1 });
    expect(compareRows([row({ c1: '' })], [row({ c1: null })], KEY, COLUMNS).equal).toBe(1);
  });

  it('counts rows on one side only', () => {
    const c = compareRows([row(), row({ role: 'prior' })], [row(), row({ filing_year: '2023' })], KEY, COLUMNS);
    expect(c).toMatchObject({ equal: 1, onlyInSeed: 1, onlyInDatabase: 1 });
    expect(sameAsSeed(c)).toBe(false);
  });

  it('refuses a key that appears twice', () => {
    expect(() => compareRows([row(), row()], [row()], KEY, COLUMNS)).toThrow(/twice/);
    expect(() => compareRows([row()], [row(), row()], KEY, COLUMNS)).toThrow(/twice/);
  });
});

describe('seedRows', () => {
  it('reads the committed seed for the reference set: its documents and two columns each', () => {
    const orgnrs = new Set<string>(JSON.parse(readFileSync(path.join(root, REFERENCE_RUN_FILE), 'utf8')) as string[]);
    const read = (table: string): Row[] => seedRows(readFileSync(path.join(root, SEED_DIR, `${table}.csv`), 'utf8'), orgnrs);
    const documents = read('document');
    expect(documents.length).toBeGreaterThan(0);
    expect(documents.every((d) => orgnrs.has(d.orgnr ?? ''))).toBe(true);
    for (const table of TABLES) {
      const rows = read(table.name);
      expect(sameAsSeed(compareRows(rows, rows, table.key, Object.keys(rows[0] ?? {}))), table.name).toBe(true);
    }
    expect(read('document_column').length).toBeGreaterThanOrEqual(documents.length);
  });

  it('keeps only the listed orgnrs', () => {
    const csv = 'orgnr,filing_year\n979607008,2025\n919951834,2025\n';
    expect(seedRows(csv, new Set(['919951834']))).toEqual([{ orgnr: '919951834', filing_year: '2025' }]);
  });
});

const ALL_HITS = {
  read: 97,
  reread_all: true,
  ocr_cache: 'on',
  ocr_cache_hit: 97,
  ocr_cache_miss_absent: 0,
  ocr_cache_miss_key: 0,
  ocr_cache_miss_key_parts: {},
  ocr_cache_miss_unreadable: 0,
  ocr_cache_miss_pages: 0,
  ocr_cache_write_failed: 0,
};

describe('the OCR word cache per run', () => {
  it('reads the counts a run recorded', () => {
    expect(runLines(runCacheCounts(801, 'reread', ALL_HITS))).toBe(
      'run 801 (reread, reread_all): 97 read; OCR word cache: 97 hits; misses 0 absent, 0 key differs (none), 0 unreadable, 0 no pages; 0 not written',
    );
    const missed = runCacheCounts(800, 'reread', { ...ALL_HITS, reread_all: false, ocr_cache_hit: 0, ocr_cache_miss_absent: 95, ocr_cache_miss_key: 2, ocr_cache_miss_key_parts: { tesseract: 2 } });
    expect(missed).toMatchObject({ hit: 0, missAbsent: 95, missKey: 2, missKeyParts: { tesseract: 2 }, rereadAll: false });
  });

  it('shows an absent or non-integer count as unreadable, never 0', () => {
    const r = runCacheCounts(802, 'reread', { ...ALL_HITS, ocr_cache_hit: 'x', ocr_cache_miss_pages: undefined, ocr_cache_miss_key: 1.5 });
    expect([r.hit, r.missPages, r.missKey]).toEqual([null, null, null]);
    expect(runLines(r)).toContain('unreadable hits');
    expect(runLines(r)).toContain('unreadable no pages');
  });

  it('says when the cache was off or not yet recorded', () => {
    expect(runLines(runCacheCounts(783, 'reread', { read: 1947 }))).toBe('run 783 (reread): 1947 read, OCR word cache not recorded');
    expect(runLines(runCacheCounts(790, 'documents', { read: 3, ocr_cache: 'off' }))).toBe(
      'run 790 (documents): 3 read, OCR word cache off',
    );
  });
});

// --- verdict: one case per condition ------------------------------------------

const EQUAL: TableComparison = { equal: 97, differing: 0, onlyInSeed: 0, onlyInDatabase: 0, fields: {} };
const proofRun = (counts: Record<string, unknown> = {}, id = 801, mode = 'reread'): RunCacheCounts =>
  runCacheCounts(id, mode, { ...ALL_HITS, ...counts });
const firstRun = runCacheCounts(800, 'reread', { ...ALL_HITS, reread_all: false, ocr_cache_hit: 0, ocr_cache_miss_absent: 97 });

const input = (overrides: Partial<VerdictInput> = {}): VerdictInput => ({
  comparisons: [
    { name: 'document', comparison: EQUAL },
    { name: 'document_column', comparison: { ...EQUAL, equal: 194 } },
  ],
  readerCommits: Array.from({ length: 97 }, () => COMMIT),
  currentCommit: COMMIT,
  runs: [firstRun],
  cacheProof: false,
  ...overrides,
});

describe('verdict', () => {
  it('passes the first re-read: rows equal, every document by the current reader, counts readable', () => {
    const result = verdict(input());
    expect(result.exit).toBe(0);
    expect(result.lines.at(-1)).toMatch(/^PASS/);
    expect(result.lines).toContain(`reader commit ${COMMIT}: 97 of 97 documents read by it`);
  });

  it('passes the second with --cache-proof when the newest run is a --reread-all of all hits', () => {
    expect(verdict(input({ runs: [proofRun(), firstRun], cacheProof: true })).exit).toBe(0);
  });

  it('fails on a row that differs or is on one side only', () => {
    for (const comparison of [{ ...EQUAL, differing: 1 }, { ...EQUAL, onlyInSeed: 1 }, { ...EQUAL, onlyInDatabase: 1 }]) {
      const result = verdict(input({ comparisons: [{ name: 'document', comparison }] }));
      expect(result.exit).toBe(1);
      expect(result.lines).toContain('FAIL: register.document differs from the seed');
    }
  });

  it('fails when a document is not read by the current reader commit (a re-read that replaced nothing)', () => {
    const result = verdict(input({ readerCommits: [...Array.from({ length: 96 }, () => COMMIT), 'b'.repeat(40)] }));
    expect(result.exit).toBe(1);
    expect(result.lines).toContain('FAIL: 1 documents not read by the current reader commit');
    expect(verdict(input({ readerCommits: [] })).exit).toBe(1);
  });

  it('fails on an unreadable count, with or without the flag', () => {
    const result = verdict(input({ runs: [runCacheCounts(800, 'reread', { ...ALL_HITS, ocr_cache_miss_absent: 'n/a' })] }));
    expect(result.exit).toBe(1);
    expect(result.lines).toContain('FAIL: run 800: unreadable counts: ocr_cache_miss_absent');
    expect(verdict(input({ runs: [runCacheCounts(800, 'reread', { ...ALL_HITS, read: undefined })] })).exit).toBe(1);
    expect(verdict(input({ runs: [runCacheCounts(800, 'reread', { ...ALL_HITS, ocr_cache_miss_key_parts: { tesseract: 'x' } })] })).exit).toBe(1);
  });

  it('with --cache-proof, fails each way the newest run is not the proof', () => {
    const cases: [string, RunCacheCounts | undefined][] = [
      ['no run', undefined],
      ['not --reread-all', proofRun({ reread_all: false })],
      ['a documents run', proofRun({}, 801, 'documents')],
      ['cache off', runCacheCounts(801, 'reread', { read: 97, reread_all: true, ocr_cache: 'off' })],
      ['a hit short', proofRun({ ocr_cache_hit: 96, ocr_cache_miss_absent: 1 })],
      ['nothing read', proofRun({ read: 0, ocr_cache_hit: 0 })],
      ['a key miss', proofRun({ ocr_cache_miss_key: 1 })],
      ['an unreadable entry', proofRun({ ocr_cache_miss_unreadable: 1 })],
      ['no pages', proofRun({ ocr_cache_miss_pages: 1 })],
      ['a failed write', proofRun({ ocr_cache_write_failed: 1 })],
      ['an absent miss count', proofRun({ ocr_cache_miss_absent: 1 })],
    ];
    for (const [label, newest] of cases) {
      const result = verdict(input({ runs: newest === undefined ? [] : [newest], cacheProof: true }));
      expect(result.exit, label).toBe(1);
    }
    // The proof is the newest run only: an older proof run does not count.
    expect(verdict(input({ runs: [firstRun, proofRun({}, 799)], cacheProof: true })).exit).toBe(1);
  });
});

describe('parseArgs', () => {
  it('takes --runs N and --cache-proof, each at most once', () => {
    expect(parseArgs([])).toEqual({ runs: 2, cacheProof: false });
    expect(parseArgs(['--runs', '3'])).toEqual({ runs: 3, cacheProof: false });
    expect(parseArgs(['--cache-proof'])).toEqual({ runs: 2, cacheProof: true });
    expect(parseArgs(['--cache-proof', '--runs', '5'])).toEqual({ runs: 5, cacheProof: true });
    for (const argv of [['--runs'], ['--runs', '0'], ['--runs', 'x'], ['--x'], ['--cache-proof', '--cache-proof'], ['--runs', '2', '--runs', '3']]) {
      expect(parseArgs(argv), argv.join(' ')).toHaveProperty('error');
    }
  });
});
