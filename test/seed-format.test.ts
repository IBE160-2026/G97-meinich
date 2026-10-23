// The seed format and the loader's checks before it connects (Story 1.3b;
// technical note AD-16). No database: test/db/seed.test.ts covers the load.
// The coverage.json fixtures live in test/fixtures/seed/declarations/,
// because coverage/ is gitignored repository-wide.
import { execFileSync } from 'node:child_process';
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
  REFERENCE_REASON,
  parseAllowList,
  parseAllowListEntries,
  parseCsv,
  parseDrawn,
  prepareSeed,
  readCoverage,
  refuseUnlistedDocumentFigures,
  sha256,
  stableJson,
  unlistedDocumentFigures,
  validateCoverage,
  withReferenceOrgnrs,
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
    expect(SEED_TABLES.map((t) => t.name)).toEqual(['company', 'filing', 'key_figures', 'document', 'document_column']);
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

  it('keys the document tables on orgnr and filing year, and the columns also on role', () => {
    const key = (name: string) => SEED_TABLES.find((t) => t.name === name)?.primaryKey;
    expect(key('document')).toEqual([
      { name: 'orgnr', text: true },
      { name: 'filing_year', text: false },
    ]);
    expect(key('document_column')).toEqual([
      { name: 'orgnr', text: true },
      { name: 'filing_year', text: false },
      { name: 'role', text: true },
    ]);
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
      'seed/demo/document.csv',
      'seed/demo/document_column.csv',
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
    expect([...plan.files.keys()]).toEqual([
      'company.csv',
      'filing.csv',
      'key_figures.csv',
      'document.csv',
      'document_column.csv',
    ]);
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
    cpSync(path.join(fixtures, 'declarations/declared-not-fetched.json'), paths.coverageFile);
    expect(refusal(() => prepareSeed(paths))).toBe(
      "seed/coverage.json entry 62.010: declared but not among the manifest's fetched_codes",
    );
  });
});

describe('measured: true', () => {
  const withFixtureReports = (fixture: string): SeedPaths => ({
    ...paths,
    coverageFile: path.join(fixtures, 'declarations', fixture),
    reportRoot: fixtures,
  });

  const check = (fixture: string) => () =>
    checkMeasured(fixtures, readCoverage(path.join(fixtures, 'declarations', fixture)));

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
    const backslash = { ...entry, report: 'analysis/output/..\\..\\x.md' };
    expect(refusal(() => checkMeasured(fixtures, [backslash]))).toMatch(/report must be a plain path under analysis\/output/);
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

  // A document figure is a row of register.document_column (Story 2.1b).
  const withFigure = (): Map<string, string> =>
    new Map([['document_column.csv', readFileSync(path.join(fixtures, 'document-column-with-figure.csv'), 'utf8')]]);

  it('fails a document column for an orgnr not on the list', () => {
    expect(unlistedDocumentFigures(withFigure(), [])).toEqual(['979607008']);
    expect(unlistedDocumentFigures(withFigure(), ['979607008'])).toEqual([]);
    expect(unlistedDocumentFigures(new Map([['document_column.csv', 'orgnr,role\n']]), [])).toEqual([]);
  });

  it('refuses document figures not on the allow-list', () => {
    expect(refusal(() => refuseUnlistedDocumentFigures(withFigure(), ['919951834']))).toBe(
      'document_column.csv: document figures for orgnrs not on seed/allow-list.json: 979607008',
    );
    expect(() => refuseUnlistedDocumentFigures(withFigure(), ['979607008'])).not.toThrow();
    expect(refusal(() => refuseUnlistedDocumentFigures(new Map(), []))).toBe('document_column.csv: missing');
  });

  it('reads the allow-list as {orgnr, reason} entries', () => {
    expect(parseAllowList([{ orgnr: '919951834', reason: 'OCR-referansesett' }])).toEqual(['919951834']);
    expect(refusal(() => parseAllowList([{ orgnr: '919951834' }]))).toMatch(/must be \{orgnr, reason\}/);
    expect(refusal(() => parseAllowList({}))).toMatch(/must be an array/);
    expect(parseAllowListEntries([{ orgnr: '919951834', reason: 'x' }])).toEqual([{ orgnr: '919951834', reason: 'x' }]);
  });
});

describe('the OCR reference orgnrs on the allow-list (Story 2.3)', () => {
  // 20 distinct orgnrs, one filing each, as the committed draw holds.
  const drawn = Array.from({ length: 20 }, (_, i) => ({ orgnr: String(900000000 + (19 - i) * 1001), year: 2021 + (i % 5) }));

  it('adds the reference orgnrs', () => {
    const existing = [
      { orgnr: '979607008', reason: 'Demoselskap A' },
      { orgnr: String(900000000 + 3 * 1001), reason: REFERENCE_REASON },
    ];
    const merged = withReferenceOrgnrs(existing, drawn);
    // Existing entries kept first, unchanged, even one that is also drawn.
    expect(merged.slice(0, 2)).toEqual(existing);
    const added = merged.slice(2);
    expect(added).toHaveLength(19);
    expect(added.every((entry) => entry.reason === REFERENCE_REASON)).toBe(true);
    expect(added.map((entry) => entry.orgnr)).toEqual(
      drawn.map((d) => d.orgnr).filter((orgnr) => orgnr !== existing[1]?.orgnr).sort(),
    );
    // Each drawn orgnr once, however often it is drawn, and a second merge
    // adds nothing: the export is stable.
    expect(new Set(merged.map((entry) => entry.orgnr)).size).toBe(merged.length);
    expect(withReferenceOrgnrs(merged, [...drawn, { orgnr: drawn[0]?.orgnr ?? '', year: 2020 }])).toEqual(merged);
    expect(REFERENCE_REASON).toBe('OCR-referansesett');
    expect(withReferenceOrgnrs([], [])).toEqual([]);
  });

  it('refuses a drawn orgnr listed with another reason', () => {
    const orgnr = String(900000000 + 3 * 1001);
    expect(refusal(() => withReferenceOrgnrs([{ orgnr, reason: 'Demoselskap B' }], drawn))).toBe(
      `seed/allow-list.json: ${orgnr} is in analysis/ocr-reference/drawn.json but listed with reason "Demoselskap B", not "OCR-referansesett"`,
    );
  });

  it('reads the draw and refuses a malformed cell', () => {
    expect(parseDrawn({ seed: 1, cells: [{ year: 2021, band: 'A', orgnr: '921716257', skipped_no_document: [] }] })).toEqual([
      { orgnr: '921716257', year: 2021 },
    ]);
    expect(refusal(() => parseDrawn({ cells: [{ year: 2021, orgnr: '92171625' }] }))).toMatch(/cell 0: must have/);
    expect(refusal(() => parseDrawn({ cells: [{ year: '2021', orgnr: '921716257' }] }))).toMatch(/cell 0: must have/);
    expect(refusal(() => parseDrawn([]))).toMatch(/must be an object with a cells array/);
    expect(
      refusal(() =>
        parseDrawn({
          cells: [
            { year: 2021, orgnr: '921716257' },
            { year: 2021, orgnr: '921716257' },
          ],
        }),
      ),
    ).toMatch(/921716257\/2021 is drawn twice/);
  });
});

describe('the committed seed', () => {
  it('is byte-exact in git: seed, reports and fixtures have the text attribute unset', () => {
    const files = [
      'seed/demo/company.csv',
      'seed/demo/manifest.json',
      'analysis/output/industry-screening.md',
      'test/fixtures/seed/analysis/output/x.md',
    ];
    const out = execFileSync('git', ['check-attr', 'text', '--', ...files], { cwd: root, encoding: 'utf8' });
    const lines = out.trim().split(/\r?\n/);
    expect(lines).toEqual(files.map((file) => `${file}: text: unset`));
  });

  it('holds demo company C with its 3 filings, and otherwise only companies in declared industries', () => {
    const config = readFileSync(path.join(root, 'ingest/config.toml'), 'utf8');
    const demo = /\[demo_company_c\][^[]*?orgnr\s*=\s*"(\d{9})"/.exec(config)?.[1];
    expect(demo).toBe('967534579');
    const declared = readCoverage(path.join(root, COVERAGE_FILE)).map((e) => e.code);

    const [companyHeader, ...companies] = parseCsv(readFileSync(path.join(root, 'seed/demo/company.csv'), 'utf8'));
    const orgnrAt = companyHeader?.indexOf('orgnr') ?? -1;
    const codeAt = companyHeader?.indexOf('naeringskode1') ?? -1;
    expect(companies.filter((row) => row[orgnrAt] === demo)).toHaveLength(1);
    const outside = companies.filter((row) => row[orgnrAt] !== demo && !declared.includes(row[codeAt] ?? ''));
    expect(outside).toEqual([]);

    const [filingHeader, ...filings] = parseCsv(readFileSync(path.join(root, 'seed/demo/filing.csv'), 'utf8'));
    const filingOrgnrAt = filingHeader?.indexOf('orgnr') ?? -1;
    expect(filings.filter((row) => row[filingOrgnrAt] === demo)).toHaveLength(3);
  });

  it('passes every check against the repository', () => {
    const plan = prepareSeed(defaultSeedPaths(root));
    expect(plan.manifest.dataset).toBe('demo');
    expect(plan.manifest.migration_id).toBe(latestMigrationId(root));
  });
});
