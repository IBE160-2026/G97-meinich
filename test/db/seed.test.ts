// The seed path against the local database (Story 1.3b; technical note
// AD-16, AD-18). Loads run as `loader` through LOADER_DATABASE_URL, always
// inside a transaction that is rolled back, so the database is left as it
// was whatever it held.
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportSeed } from '../../scripts/seed-export.ts';
import {
  ALLOW_LIST_FILE,
  COVERAGE_FILE,
  LOADER_TABLES,
  MANIFEST_FILE,
  REFERENCE_DRAW_FILE,
  SEED_DIR,
  SEED_TABLES,
  type SeedPaths,
  type SeedPlan,
  SeedRefusal,
  compareBytes,
  defaultSeedPaths,
  parseCsv,
  parseDrawn,
  prepareSeed,
  readCoverage,
  stableJson,
  withReferenceOrgnrs,
} from '../../scripts/seed-format.ts';
import { assertTableSet, loadSeed, main as seedMain, registerTables } from '../../scripts/seed-load.ts';
import { root, setting, supabaseDbUrl } from './db-env.ts';

type Tx = postgres.TransactionSql;
const fixtures = path.join(root, 'test/fixtures/seed');
const drawn = parseDrawn(JSON.parse(readFileSync(path.join(root, REFERENCE_DRAW_FILE), 'utf8')));
const ALL_TABLES = [...SEED_TABLES.map((t) => t.name), ...LOADER_TABLES];

const loaderUrl = setting('LOADER_DATABASE_URL');
if (loaderUrl === undefined) throw new Error('LOADER_DATABASE_URL is not set; run `pnpm db:roles`');
const loader = postgres(loaderUrl, { max: 1, onnotice: () => {} });
const admin = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

let scratch: string;
let committed: SeedPlan;

beforeAll(() => {
  scratch = mkdtempSync(path.join(tmpdir(), 'peerless-seed-db-'));
  committed = prepareSeed(defaultSeedPaths(root));
});

afterAll(async () => {
  rmSync(scratch, { recursive: true, force: true });
  await loader.end();
  await admin.end();
});

class Rollback extends Error {}

async function rolledBack(sql: postgres.Sql, fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (error instanceof Rollback) return;
    throw error;
  }
  throw new Error('transaction was not rolled back');
}

// One md5 per table over every row's text form in byte order.
async function digests(tx: Tx): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const table of ALL_TABLES) {
    const [row] = await tx.unsafe<{ digest: string }[]>(
      `select md5(coalesce(string_agg(t::text, E'\\n' order by t::text collate "C"), '')) as digest from register."${table}" t`,
    );
    result[table] = row?.digest ?? '';
  }
  return result;
}

// A scratch copy of the committed seed directory.
function seedCopy(name: string): SeedPaths {
  const dir = path.join(scratch, name);
  cpSync(path.join(root, SEED_DIR), dir, { recursive: true });
  return { ...defaultSeedPaths(root), seedDir: dir };
}

function rewriteManifest(paths: SeedPaths, change: (m: Record<string, unknown>) => void): void {
  const file = path.join(paths.seedDir, MANIFEST_FILE);
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  change(manifest);
  writeFileSync(file, stableJson(manifest));
}

describe('loader login', () => {
  it('connects through LOADER_DATABASE_URL as loader', async () => {
    const [row] = await loader<{ current_user: string }[]>`select current_user`;
    expect(row?.current_user).toBe('loader');
  });
});

describe('the committed seed', () => {
  it('loads 17 557 companies, 22 354 filings, the reference documents, the coverage rows and one dataset row', async () => {
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, committed);
      const [counts] = await tx<
        { company: number; filing: number; key_figures: number; document: number; document_column: number }[]
      >`
        select (select count(*)::int from register.company) as company,
               (select count(*)::int from register.filing) as filing,
               (select count(*)::int from register.key_figures) as key_figures,
               (select count(*)::int from register.document) as document,
               (select count(*)::int from register.document_column) as document_column
      `;
      // The committed seed holds the OCR reference set's documents only
      // (Story 2.3): 97 documents of the 20 reference orgnrs, two columns
      // each. The acceptance run's rows wait for Story 5.4's allow-list.
      expect(counts).toEqual({ company: 17557, filing: 22354, key_figures: 22354, document: 97, document_column: 194 });

      const coverage = await tx`select code, measured, report, sha256 from register.covered_industry order by code collate "C"`;
      const declared = readCoverage(path.join(root, COVERAGE_FILE));
      expect([...coverage]).toEqual(
        declared.map((e) => ({ code: e.code, measured: e.measured, report: e.report ?? null, sha256: e.sha256 ?? null })),
      );
      expect([...coverage]).toEqual([{ code: '62.100', measured: false, report: null, sha256: null }]);

      const dataset = await tx<{ id: number; dataset: string; format_version: number; migration_id: string; manifest: unknown }[]>`
        select id, dataset, format_version, migration_id, manifest from register.dataset
      `;
      expect(dataset).toHaveLength(1);
      expect(dataset[0]).toMatchObject({
        id: 1,
        dataset: 'demo',
        format_version: committed.manifest.format_version,
        migration_id: committed.manifest.migration_id,
      });
      expect(dataset[0]?.manifest).toEqual(committed.manifest);
    });
  });

  it('round-trips: an export inside the same transaction is byte-identical, read_at included', async () => {
    const out = path.join(scratch, 'roundtrip');
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, committed);
      await exportSeed(tx, root, out);
    });
    const exported = readdirSync(path.join(out, SEED_DIR)).sort();
    expect(exported).toEqual(readdirSync(path.join(root, SEED_DIR)).sort());
    for (const file of exported) {
      const a = readFileSync(path.join(out, SEED_DIR, file));
      const b = readFileSync(path.join(root, SEED_DIR, file));
      expect(a.equals(b), file).toBe(true);
    }
    expect(readFileSync(path.join(out, ALLOW_LIST_FILE)).equals(readFileSync(path.join(root, ALLOW_LIST_FILE)))).toBe(true);
    expect(readdirSync(path.join(out, 'seed')).sort()).toEqual(['allow-list.json', 'demo']);

    // Collation-free order: the exported primary keys are in byte order.
    for (const table of SEED_TABLES) {
      const [header, ...rows] = parseCsv(readFileSync(path.join(out, SEED_DIR, `${table.name}.csv`), 'utf8'));
      const at = table.primaryKey.map((c) => header?.indexOf(c.name) ?? -1);
      expect(at.every((i) => i >= 0), table.name).toBe(true);
      const keys = rows.map((row) => at.map((i) => row[i] ?? ''));
      const compareKeys = (x: string[], y: string[]): number => {
        for (let i = 0; i < x.length; i += 1) {
          const c = table.primaryKey[i]?.name === 'brreg_id'
            ? Number(x[i]) - Number(y[i])
            : compareBytes(x[i] ?? '', y[i] ?? '');
          if (c !== 0) return c;
        }
        return 0;
      };
      const sorted = [...keys].sort(compareKeys);
      expect(keys, table.name).toEqual(sorted);
    }
  });

  it('is idempotent: two loads give the same table digests and dataset row', async () => {
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, committed);
      const first = await digests(tx);
      const [firstDataset] = await tx`select * from register.dataset`;
      await loadSeed(tx, committed);
      expect(await digests(tx)).toEqual(first);
      const [secondDataset] = await tx`select * from register.dataset`;
      expect(secondDataset).toEqual(firstDataset);
    });
  });

  it('loads a measured: true entry whose report exists with a matching sha256', async () => {
    const plan = prepareSeed({
      ...defaultSeedPaths(root),
      coverageFile: path.join(fixtures, 'declarations/measured-ok.json'),
      reportRoot: fixtures,
    });
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, plan);
      const rows = await tx`select code, measured, report, sha256 from register.covered_industry`;
      expect([...rows]).toEqual([
        {
          code: '62.100',
          measured: true,
          report: 'analysis/output/x.md',
          sha256: plan.coverage[0]?.sha256,
        },
      ]);
    });
  });
});

describe('refusals', () => {
  const coverageFixture = (file: string): SeedPaths => ({
    ...defaultSeedPaths(root),
    coverageFile: path.join(fixtures, 'declarations', file),
    reportRoot: fixtures,
  });

  const cases: [string, () => SeedPaths, RegExp][] = [
    [
      'a manifest format_version other than 1',
      () => {
        const p = seedCopy('version');
        rewriteManifest(p, (m) => {
          m.format_version = 2;
        });
        return p;
      },
      /field format_version/,
    ],
    [
      'a migration id that is not the latest',
      () => {
        const p = seedCopy('migration');
        rewriteManifest(p, (m) => {
          m.migration_id = '20261011120000_register_step1_tables';
        });
        return p;
      },
      /field migration_id/,
    ],
    [
      'an unlisted file',
      () => {
        const p = seedCopy('unlisted');
        writeFileSync(path.join(p.seedDir, 'extra.csv'), 'x\n');
        return p;
      },
      /^extra\.csv: not listed/,
    ],
    [
      'a file with one byte changed',
      () => {
        const p = seedCopy('checksum');
        const file = path.join(p.seedDir, 'company.csv');
        const bytes = readFileSync(file);
        bytes[bytes.length - 2] = bytes[bytes.length - 2]! ^ 1;
        writeFileSync(file, bytes);
        return p;
      },
      /^company\.csv: checksum/,
    ],
    ['a declared code that was not fetched', () => coverageFixture('declared-not-fetched.json'), /entry 62\.010: declared but not/],
    ['measured: true with no report', () => coverageFixture('measured-no-report.json'), /entry 62\.100: .*missing/],
    ['measured: true with a missing report file', () => coverageFixture('measured-missing-file.json'), /does not exist/],
    ['measured: true with a checksum mismatch', () => coverageFixture('measured-bad-checksum.json'), /does not match its sha256/],
  ];

  for (const [name, make, message] of cases) {
    it(`refuses ${name} and leaves the table digests unchanged`, async () => {
      const paths = make();
      await rolledBack(loader, async (tx) => {
        await loadSeed(tx, committed);
        const before = await digests(tx);
        await expect(async () => loadSeed(tx, prepareSeed(paths))).rejects.toThrow(SeedRefusal);
        await expect(async () => loadSeed(tx, prepareSeed(paths))).rejects.toThrow(message);
        expect(await digests(tx)).toEqual(before);
      });
    });
  }

  it('rolls back a load that fails after TRUNCATE, leaving the digests unchanged', async () => {
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, committed);
      const before = await digests(tx);
      // Bytes changed after the checks: key_figures references a filing that
      // does not exist, so COPY fails after company and filing are replaced.
      const files = new Map(committed.files);
      const header = (committed.files.get('key_figures.csv') ?? Buffer.alloc(0)).toString('utf8').split('\n')[0];
      files.set('key_figures.csv', Buffer.from(`${header}\n-1${','.repeat((header ?? '').split(',').length - 1)}\n`));
      await expect(tx.savepoint((sp) => loadSeed(sp, { ...committed, files }))).rejects.toMatchObject({ code: '23503' });
      expect(await digests(tx)).toEqual(before);
    });
  });
});

describe('checks inside the load', () => {
  it('refuses a declared code that no loaded company has, even when the manifest lists it as fetched', async () => {
    const paths = seedCopy('fetched-lie');
    rewriteManifest(paths, (m) => {
      m.fetched_codes = ['62.010', ...(m.fetched_codes as string[])];
    });
    const coverageFile = path.join(scratch, 'fetched-lie-coverage.json');
    const declared = readCoverage(path.join(root, COVERAGE_FILE));
    writeFileSync(coverageFile, JSON.stringify([...declared, { code: '62.010', measured: false }]));
    const plan = prepareSeed({ ...paths, coverageFile });
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, committed);
      const before = await digests(tx);
      await expect(tx.savepoint((sp) => loadSeed(sp, plan))).rejects.toThrow(
        /entry 62\.010: declared but no loaded company has it as naeringskode1/,
      );
      expect(await digests(tx)).toEqual(before);
    });
  });

  it('refuses a file whose header does not match the table columns, naming file, table and both lists', async () => {
    const files = new Map(committed.files);
    const company = (committed.files.get('company.csv') ?? Buffer.alloc(0)).toString('utf8');
    const [header = '', ...rest] = company.split('\n');
    files.set('company.csv', Buffer.from([header.replace(',read_at', ''), ...rest].join('\n')));
    await rolledBack(loader, async (tx) => {
      await expect(tx.savepoint((sp) => loadSeed(sp, { ...committed, files }))).rejects.toThrow(
        /^company\.csv: header \(.*\) does not match register\.company columns \(.*read_at\)$/,
      );
    });
  });
});

describe('pnpm seed (main) refusing', () => {
  it('exits 1, names the broken file on stderr, and leaves the database unchanged', async () => {
    const scratchRoot = path.join(scratch, 'main-root');
    cpSync(path.join(root, 'supabase/migrations'), path.join(scratchRoot, 'supabase/migrations'), { recursive: true });
    cpSync(path.join(root, 'seed'), path.join(scratchRoot, 'seed'), { recursive: true });
    const file = path.join(scratchRoot, SEED_DIR, 'filing.csv');
    const bytes = readFileSync(file);
    bytes[bytes.length - 2] = bytes[bytes.length - 2]! ^ 1;
    writeFileSync(file, bytes);

    const observer = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
    const snapshot = () => observer.begin((tx) => digests(tx));
    try {
      const before = await snapshot();
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = ((chunk: string | Uint8Array) => {
        written.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;
      let code: number;
      try {
        code = await seedMain(scratchRoot);
      } finally {
        process.stderr.write = original;
      }
      expect(code).toBe(1);
      expect(written.join('')).toMatch(/filing\.csv: checksum does not match manifest\.json/);
      expect(await snapshot()).toEqual(before);
    } finally {
      await observer.end();
    }
  });
});

describe('the export and document figures', () => {
  it('refuses to export a document column for an orgnr not on the allow-list, writing nothing', async () => {
    const out = path.join(scratch, 'unlisted-document');
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, committed);
      const [company] = await tx<{ orgnr: string }[]>`select orgnr from register.company order by orgnr limit 1`;
      const orgnr = company?.orgnr ?? '';
      await tx`
        insert into register.document (orgnr, filing_year, layout, status, valuta, unit_text, read_at, dataset)
        values (${orgnr}, 2025, 'generated', 'extracted', 'NOK', 'NOK', now(), 'full')`;
      await tx`
        insert into register.document_column (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, digits_pass_fields, dataset)
        values (${orgnr}, 2025, 'current', 2025, 'pass', 'pass', 'pass', 'pass', '{}', 'full')`;
      await expect(exportSeed(tx, root, out)).rejects.toThrow(
        `document_column.csv: document figures for orgnrs not on seed/allow-list.json: ${orgnr}`,
      );
    });
    expect(existsSync(out)).toBe(false);
  });

  it('exports a listed orgnr, keeps its entry, adds the reference draw, and names it in the manifest', async () => {
    // A scratch root holding the migrations, coverage.json, the committed
    // OCR reference draw and an allow-list that names one orgnr with a
    // reason.
    const scratchRoot = path.join(scratch, 'listed-root');
    cpSync(path.join(root, 'supabase/migrations'), path.join(scratchRoot, 'supabase/migrations'), { recursive: true });
    cpSync(path.join(root, COVERAGE_FILE), path.join(scratchRoot, COVERAGE_FILE));
    cpSync(path.join(root, REFERENCE_DRAW_FILE), path.join(scratchRoot, REFERENCE_DRAW_FILE));
    const out = path.join(scratch, 'listed-out');
    let manifest: { document_figure_orgnrs: string[] } | undefined;
    let allowList = '';
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, committed);
      const [company] = await tx<{ orgnr: string }[]>`select orgnr from register.company order by orgnr limit 1`;
      const orgnr = company?.orgnr ?? '';
      writeFileSync(path.join(scratchRoot, ALLOW_LIST_FILE), stableJson([{ orgnr, reason: 'Testoppføring' }]));
      allowList = stableJson(withReferenceOrgnrs([{ orgnr, reason: 'Testoppføring' }], drawn));
      await tx`
        insert into register.document (orgnr, filing_year, layout, status, valuta, unit_text, read_at, dataset)
        values (${orgnr}, 2025, 'generated', 'extracted', 'NOK', 'NOK', now(), 'full')`;
      await tx`
        insert into register.document_column (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, digits_pass_fields, dataset)
        values (${orgnr}, 2025, 'current', 2025, 'pass', 'pass', 'pass', 'pass', '{}', 'full')`;
      manifest = await exportSeed(tx, scratchRoot, out);
      // The committed seed already holds the 20 reference orgnrs' documents.
      expect(manifest.document_figure_orgnrs).toContain(orgnr);
    });
    expect(manifest?.document_figure_orgnrs).toHaveLength(21);
    expect(readFileSync(path.join(out, ALLOW_LIST_FILE), 'utf8')).toBe(allowList);
    expect(JSON.parse(allowList)).toHaveLength(21);
  });

  it('refuses to export without the committed reference draw, writing nothing', async () => {
    const scratchRoot = path.join(scratch, 'no-draw-root');
    cpSync(path.join(root, 'supabase/migrations'), path.join(scratchRoot, 'supabase/migrations'), { recursive: true });
    cpSync(path.join(root, COVERAGE_FILE), path.join(scratchRoot, COVERAGE_FILE));
    const out = path.join(scratch, 'no-draw-out');
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, committed);
      await expect(exportSeed(tx, scratchRoot, out)).rejects.toThrow(`${REFERENCE_DRAW_FILE}: missing`);
    });
    expect(existsSync(out)).toBe(false);
  });
});

describe('the export order', () => {
  it('writes rows in byte order of the key even when the table was filled in another order', async () => {
    const company = (committed.files.get('company.csv') ?? Buffer.alloc(0)).toString('utf8');
    const [header = '', ...rows] = company.split('\n').filter((line) => line !== '');
    const reversed = Buffer.from(`${[header, ...rows.reverse()].join('\n')}\n`);
    const headerOnly = (file: string): Buffer =>
      Buffer.from(`${(committed.files.get(file) ?? Buffer.alloc(0)).toString('utf8').split('\n')[0]}\n`);
    const files = new Map([
      ['company.csv', reversed],
      ['filing.csv', headerOnly('filing.csv')],
      ['key_figures.csv', headerOnly('key_figures.csv')],
      ['document.csv', headerOnly('document.csv')],
      ['document_column.csv', headerOnly('document_column.csv')],
    ]);
    const out = path.join(scratch, 'order');
    await rolledBack(loader, async (tx) => {
      await loadSeed(tx, { ...committed, files });
      await exportSeed(tx, root, out);
    });
    const [exportedHeader, ...exported] = parseCsv(readFileSync(path.join(out, SEED_DIR, 'company.csv'), 'utf8'));
    const at = exportedHeader?.indexOf('orgnr') ?? -1;
    const orgnrs = exported.map((row) => row[at] ?? '');
    expect(orgnrs.length).toBe(rows.length);
    expect(orgnrs).toEqual([...orgnrs].sort(compareBytes));
  });
});

describe('the register table set', () => {
  it('is exactly the seed tables and the loader tables', async () => {
    expect(await registerTables(admin)).toEqual([...ALL_TABLES].sort(compareBytes));
    await expect(assertTableSet(admin)).resolves.toBeUndefined();
  });

  it('refuses to load when a table is added to register without a seed decision', async () => {
    await rolledBack(admin, async (tx) => {
      await tx.unsafe('create table register.seed_test_unknown_table (id int primary key)');
      await expect(assertTableSet(tx)).rejects.toThrow(/seed_test_unknown_table/);
    });
  });
});
