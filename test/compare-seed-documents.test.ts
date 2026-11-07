// `pnpm analysis:seed-documents` (scripts/compare-seed-documents.ts, Story
// 2.5d): the reference set's rows in the database against the committed
// seed, ignoring what a re-read changes by design, and the OCR word cache's
// counts per run. Totals only.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  IGNORED_COLUMNS,
  TABLES,
  type Row,
  compareRows,
  comparisonLines,
  parseRuns,
  runCacheCounts,
  runLines,
  sameAsSeed,
  seedRows,
} from '../scripts/compare-seed-documents.ts';
import { REFERENCE_RUN_FILE } from '../scripts/document-set.ts';
import { SEED_DIR } from '../scripts/seed-format.ts';

const root = path.resolve(import.meta.dirname, '..');
const KEY = ['orgnr', 'filing_year', 'role'];
const COLUMNS = ['orgnr', 'filing_year', 'role', 'status', 'c1', 'salgsinntekt_ore', 'reader_commit', 'read_at'];

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
    const reread = row({ reader_commit: 'f'.repeat(40), read_at: '2026-11-08 09:00:00+00' });
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
    const columns = read('document_column');
    expect(documents.length).toBeGreaterThan(0);
    expect(documents.every((d) => orgnrs.has(d.orgnr ?? ''))).toBe(true);
    // A seed compared with itself is the same.
    for (const table of TABLES) {
      const rows = read(table.name);
      const header = Object.keys(rows[0] ?? {});
      expect(sameAsSeed(compareRows(rows, rows, table.key, header)), table.name).toBe(true);
    }
    expect(columns.length).toBeGreaterThanOrEqual(documents.length);
  });

  it('keeps only the listed orgnrs', () => {
    const csv = 'orgnr,filing_year\n979607008,2025\n919951834,2025\n';
    expect(seedRows(csv, new Set(['919951834']))).toEqual([{ orgnr: '919951834', filing_year: '2025' }]);
  });
});

describe('the OCR word cache per run', () => {
  it('reads the counts a run recorded', () => {
    const r = runCacheCounts(801, 'reread', {
      read: 97,
      reread_all: true,
      ocr_cache: 'on',
      ocr_cache_hit: 97,
      ocr_cache_miss_absent: 0,
      ocr_cache_miss_key: 0,
      ocr_cache_miss_key_parts: {},
      ocr_cache_miss_unreadable: 0,
      ocr_cache_write_failed: 0,
    });
    expect(runLines(r)).toBe(
      'run 801 (reread, reread_all): 97 read; OCR word cache: 97 hits; misses 0 absent, 0 key differs (none), 0 unreadable; 0 not written',
    );
    const missed = runCacheCounts(800, 'reread', {
      read: 97,
      ocr_cache: 'on',
      ocr_cache_hit: 0,
      ocr_cache_miss_absent: 95,
      ocr_cache_miss_key: 2,
      ocr_cache_miss_key_parts: { tesseract: 2 },
    });
    expect(missed).toMatchObject({ hit: 0, missAbsent: 95, missKey: 2, missKeyParts: { tesseract: 2 }, rereadAll: false });
  });

  it('says when the cache was off or not yet recorded', () => {
    expect(runLines(runCacheCounts(783, 'reread', { read: 1947 }))).toBe('run 783 (reread): 1947 read, OCR word cache not recorded');
    expect(runLines(runCacheCounts(790, 'documents', { read: 3, ocr_cache: 'off' }))).toBe(
      'run 790 (documents): 3 read, OCR word cache off',
    );
  });
});

describe('parseRuns', () => {
  it('takes nothing or --runs N', () => {
    expect(parseRuns([])).toBe(2);
    expect(parseRuns(['--runs', '3'])).toBe(3);
    for (const argv of [['--runs'], ['--runs', '0'], ['--runs', 'x'], ['--x']]) expect(parseRuns(argv)).toHaveProperty('error');
  });
});
