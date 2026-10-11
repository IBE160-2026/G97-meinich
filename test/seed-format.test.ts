// The seed format and the loader's checks before it connects (Story 1.3b;
// technical note AD-16). No database: test/db/seed.test.ts covers the load.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COVERAGE_FILE,
  LOADER_TABLES,
  MANIFEST_FILE,
  SEED_TABLES,
  SEED_VERSION,
  type SeedPaths,
  SeedRefusal,
  checkMeasured,
  defaultSeedPaths,
  exportPaths,
  latestMigrationId,
  orderByClause,
  parseAllowList,
  parseCsv,
  prepareSeed,
  readCoverage,
  sha256,
  stableJson,
  unlistedDocumentFigures,
  validateCoverage,
} from '../scripts/seed-format.ts';

const root = path.resolve(import.meta.dirname, '..');
const fixtures = path.join(root, 'test/fixtures/seed');

// A small, valid seed in a scratch directory: three tiny CSV files, a
// manifest naming the repository's latest migration, and a coverage file.
let scratch: string;
let paths: SeedPaths;

function writeManifest(change: (manifest: Record<string, unknown>) => void = () => {}): void {
  const files: Record<string, string> = {};
  for (const table of SEED_TABLES) {
    files[`${table.name}.csv`] = sha256(readFileSync(path.join(paths.seedDir, `${table.name}.csv`)));
  }
  const manifest: Record<string, unknown> = {
    dataset: 'demo',
    document_figure_orgnrs: [],
    fetched_codes: ['62.100'],
    files,
    format_version: SEED_VERSION,
    migration_id: latestMigrationId(root),
    read_at: { max: '2026-10-11 13:36:34.74071+00', min: '2026-10-11 10:09:07.22884+00' },
  };
  change(manifest);
  writeFileSync(path.join(paths.seedDir, MANIFEST_FILE), stableJson(manifest));
}

function writeCoverage(json: unknown): void {
  writeFileSync(paths.coverageFile, JSON.stringify(json));
}

beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), 'peerless-seed-'));
  paths = { root, seedDir: path.join(scratch, 'demo'), coverageFile: path.join(scratch, 'coverage.json') };
  cpSync(path.join(fixtures, 'coverage'), path.join(scratch, 'coverage-fixtures'), { recursive: true });
  for (const table of SEED_TABLES) {
    mkdirSync(paths.seedDir, { recursive: true });
    writeFileSync(path.join(paths.seedDir, `${table.name}.csv`), `${table.name}\nrow\n`);
  }
  writeManifest();
  writeCoverage([{ code: '62.100', measured: false }]);
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SeedRefusal);
    return (error as Error).message;
  }
  throw new Error('expected a SeedRefusal');
}

describe('the seed tables', () => {
  it('lists the step-1 tables in foreign-key order and the loader tables apart', () => {
    expect(SEED_TABLES.map((t) => t.name)).toEqual(['company', 'filing', 'key_figures']);
    expect(LOADER_TABLES).toEqual(['dataset', 'covered_industry']);
  });

  it('orders every text/char sort column with COLLATE "C" and no other column', () => {
    for (const table of SEED_TABLES) {
      const clause = orderByClause(table);
      for (const column of table.primaryKey) {
        const collated = clause.includes(`"${column.name}" COLLATE "C"`);
        expect(collated, `${table.name}.${column.name}`).toBe(column.text);
      }
    }
    expect(orderByClause(SEED_TABLES[1]!)).toBe(
      'ORDER BY "orgnr" COLLATE "C", "regnskapstype" COLLATE "C", "periode_fra", "periode_til"',
    );
  });

  it('marks orgnr (char) and regnskapstype (text) as text columns', () => {
    const filing = SEED_TABLES.find((t) => t.name === 'filing');
    expect(filing?.primaryKey.filter((c) => c.text).map((c) => c.name)).toEqual(['orgnr', 'regnskapstype']);
  });
});

describe('the export', () => {
  it('never writes seed/coverage.json', () => {
    expect(exportPaths()).not.toContain(COVERAGE_FILE);
    expect(exportPaths().some((p) => p.endsWith('coverage.json'))).toBe(false);
    expect(exportPaths()).toEqual([
      'seed/demo/company.csv',
      'seed/demo/filing.csv',
      'seed/demo/key_figures.csv',
      'seed/demo/manifest.json',
      'seed/allow-list.json',
    ]);
  });

  it('writes JSON with sorted keys, 2-space indent and a final LF', () => {
    expect(stableJson({ b: 1, a: { d: [2], c: 'x' } })).toBe('{\n  "a": {\n    "c": "x",\n    "d": [\n      2\n    ]\n  },\n  "b": 1\n}\n');
  });

  it('takes the migration id from the latest file in supabase/migrations', () => {
    expect(latestMigrationId(root)).toMatch(/^\d{14}_[a-z0-9_]+$/);
  });
});

describe('the manifest and files', () => {
  it('accepts the valid seed', () => {
    const plan = prepareSeed(paths);
    expect(plan.coverage).toEqual([{ code: '62.100', measured: false }]);
    expect([...plan.files.keys()]).toEqual(['company.csv', 'filing.csv', 'key_figures.csv']);
  });

  it('refuses a format_version other than 1, naming the field', () => {
    writeManifest((m) => {
      m.format_version = 2;
    });
    expect(refusal(() => prepareSeed(paths))).toMatch(/manifest\.json: field format_version is 2/);
  });

  it('refuses a migration_id other than the latest migration, naming the field', () => {
    writeManifest((m) => {
      m.migration_id = '20261011120000_register_step1_tables';
    });
    expect(refusal(() => prepareSeed(paths))).toMatch(/manifest\.json: field migration_id/);
  });

  it('refuses an unknown or missing manifest field', () => {
    writeManifest((m) => {
      m.extra = true;
    });
    expect(refusal(() => prepareSeed(paths))).toMatch(/unknown field "extra"/);
    writeManifest((m) => {
      delete m.read_at;
    });
    expect(refusal(() => prepareSeed(paths))).toMatch(/field read_at is missing/);
  });

  it('refuses an extra file in the seed directory, naming the file', () => {
    writeFileSync(path.join(paths.seedDir, 'extra.csv'), 'x\n');
    expect(refusal(() => prepareSeed(paths))).toBe('extra.csv: not listed in manifest.json');
  });

  it('refuses a file with one byte changed, naming the file', () => {
    const file = path.join(paths.seedDir, 'filing.csv');
    const bytes = readFileSync(file);
    bytes[0] = bytes[0]! ^ 1;
    writeFileSync(file, bytes);
    expect(refusal(() => prepareSeed(paths))).toBe('filing.csv: checksum does not match manifest.json');
  });

  it('refuses a missing listed file', () => {
    rmSync(path.join(paths.seedDir, 'key_figures.csv'));
    expect(refusal(() => prepareSeed(paths))).toBe('key_figures.csv: listed in manifest.json but missing');
  });
});

describe('seed/coverage.json shape', () => {
  const cases: [string, unknown, RegExp][] = [
    ['not an array', { code: '62.100', measured: false }, /must be an array/],
    ['an unknown key', [{ code: '62.100', measured: false, note: 'x' }], /entry 0: unknown key "note"/],
    ['a non-boolean measured', [{ code: '62.100', measured: 'false' }], /entry 62\.100: measured must be true or false/],
    [
      'report present while measured is false',
      [{ code: '62.100', measured: false, report: 'analysis/output/x.md' }],
      /entry 62\.100: report and sha256 are allowed only when measured is true/,
    ],
    ['a code not NN.NNN', [{ code: '62100', measured: false }], /entry 0: code must be a string NN\.NNN/],
    ['an SN2007-style short code', [{ code: '62.01', measured: false }], /entry 0: code must be/],
    [
      'a duplicate code',
      [
        { code: '62.100', measured: false },
        { code: '62.100', measured: false },
      ],
      /entry 62\.100: code is declared twice/,
    ],
  ];

  for (const [name, json, message] of cases) {
    it(`refuses ${name}, naming the entry`, () => {
      expect(refusal(() => validateCoverage(json))).toMatch(message);
      writeCoverage(json);
      expect(refusal(() => prepareSeed(paths))).toMatch(message);
    });
  }

  it('accepts the committed seed/coverage.json', () => {
    const entries = readCoverage(path.join(root, COVERAGE_FILE));
    expect(entries.length).toBeGreaterThan(0);
    expect(() => checkMeasured(root, entries)).not.toThrow();
  });
});

describe('declared against fetched codes', () => {
  it('refuses a declared code that is not among the fetched codes, naming the code', () => {
    cpSync(path.join(scratch, 'coverage-fixtures/declared-not-fetched.json'), paths.coverageFile);
    expect(refusal(() => prepareSeed(paths))).toBe(
      "seed/coverage.json entry 62.010: declared but not among the manifest's fetched_codes",
    );
  });
});

describe('measured: true', () => {
  const withFixtureReports = (fixture: string): SeedPaths => ({
    ...paths,
    coverageFile: path.join(fixtures, 'coverage', fixture),
    reportRoot: fixtures,
  });

  const check = (fixture: string) => () =>
    checkMeasured(fixtures, readCoverage(path.join(fixtures, 'coverage', fixture)));

  it('refuses an entry with no report or sha256', () => {
    expect(refusal(check('measured-no-report.json'))).toBe(
      'seed/coverage.json entry 62.100: measured is true but report or sha256 is missing',
    );
  });

  it('refuses a report that does not exist', () => {
    expect(refusal(check('measured-missing-file.json'))).toBe(
      'seed/coverage.json entry 62.100: report analysis/output/missing.md does not exist',
    );
  });

  it('refuses a checksum mismatch', () => {
    expect(refusal(check('measured-bad-checksum.json'))).toBe(
      'seed/coverage.json entry 62.100: report analysis/output/x.md does not match its sha256',
    );
  });

  it('accepts a report that exists with a matching sha256', () => {
    expect(check('measured-ok.json')).not.toThrow();
  });

  it('refuses a report path outside analysis/output', () => {
    const entry = { code: '62.100', measured: true, report: 'analysis/output/../x.md', sha256: '0'.repeat(64) };
    expect(refusal(() => checkMeasured(fixtures, [entry]))).toMatch(/report must be a plain path under analysis\/output/);
    const outside = { ...entry, report: 'seed/coverage.json' };
    expect(refusal(() => checkMeasured(fixtures, [outside]))).toMatch(/report must be a plain path/);
  });

  it('runs inside prepareSeed, after the manifest checks', () => {
    for (const [fixture, ok] of [
      ['measured-no-report.json', false],
      ['measured-missing-file.json', false],
      ['measured-bad-checksum.json', false],
      ['measured-ok.json', true],
    ] as const) {
      const run = () => prepareSeed(withFixtureReports(fixture));
      if (ok) expect(run().coverage[0]?.report).toBe('analysis/output/x.md');
      else expect(refusal(run)).toMatch(/^seed\/coverage\.json entry 62\.100: /);
    }
  });
});

describe('the allow-list check', () => {
  it('parses CSV the way COPY writes it, quotes and all', () => {
    expect(parseCsv('a,b\n1,"x,""y"""\n,\n')).toEqual([['a', 'b'], ['1', 'x,"y"'], ['', '']]);
  });

  it('fails a filing with a document figure for an orgnr not on the list', () => {
    const files = new Map([['filing.csv', readFileSync(path.join(fixtures, 'filing-with-document-figure.csv'), 'utf8')]]);
    expect(unlistedDocumentFigures(files, [])).toEqual(['919951834']);
    expect(unlistedDocumentFigures(files, ['919951834'])).toEqual([]);
  });

  it('reads the allow-list as {orgnr, reason} entries', () => {
    expect(parseAllowList([{ orgnr: '919951834', reason: 'OCR-referansesett' }])).toEqual(['919951834']);
    expect(refusal(() => parseAllowList([{ orgnr: '919951834' }]))).toMatch(/must be \{orgnr, reason\}/);
    expect(refusal(() => parseAllowList({}))).toMatch(/must be an array/);
  });
});

describe('the committed seed', () => {
  it('passes every check against the repository', () => {
    const plan = prepareSeed(defaultSeedPaths(root));
    expect(plan.manifest.dataset).toBe('demo');
    expect(plan.manifest.migration_id).toBe(latestMigrationId(root));
  });
});
