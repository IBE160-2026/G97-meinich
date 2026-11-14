// `pnpm restore:documents [dir]` (Story 2.10): every row of the spec's
// restore matrix, against fakes for the files, the database and derive, so
// nothing here connects to a database or restores a dump. The copy itself,
// in a transaction rolled back, is test/db/restore-documents.test.ts.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DUMP,
  type DumpTable,
  type RestoreCounts,
  type RestoreDb,
  type RestoreDeps,
  restoreDocuments,
} from '../scripts/restore-documents.ts';

const ROOT = path.resolve('/repo');
const LOCAL_URL = 'postgresql://loader:secret@127.0.0.1:54322/postgres';
const COUNTS: RestoreCounts = { documents: 2785, columns: 5556, fingerprints: 2537, classifications: 10371 };

// An older dump's header: no parts of intangible assets, CRLF line ends.
const DOCUMENT_CSV = 'orgnr,filing_year,brreg_id,status\r\n999999999,2025,1,reconciled\r\n';
const COLUMN_CSV = 'orgnr,filing_year,role,status\n999999999,2025,current,reconciled\n';

type Fake = {
  readonly deps: RestoreDeps;
  readonly calls: string[];
  readonly restored: (readonly DumpTable[])[];
  readonly out: string[];
  readonly err: string[];
};

function fake(options: {
  readonly url?: string | undefined;
  readonly files?: Readonly<Record<string, string>>;
  readonly restoreError?: unknown;
  readonly deriveExit?: number;
} = {}): Fake {
  const calls: string[] = [];
  const restored: (readonly DumpTable[])[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const dir = path.join(ROOT, DEFAULT_DUMP);
  const files = options.files ?? {
    [path.join(dir, 'document.csv')]: DOCUMENT_CSV,
    [path.join(dir, 'document_column.csv')]: COLUMN_CSV,
  };
  const dirs = new Set(Object.keys(files).map((file) => path.dirname(file)));
  const db: RestoreDb = {
    restore: async (tables) => {
      calls.push('restore');
      restored.push(tables);
      if (options.restoreError !== undefined) throw options.restoreError;
    },
    counts: async () => {
      calls.push('counts');
      return COUNTS;
    },
    end: async () => {
      calls.push('end');
    },
  };
  const deps: RestoreDeps = {
    root: ROOT,
    setting: (name) => (name === 'LOADER_DATABASE_URL' ? ('url' in options ? options.url : LOCAL_URL) : undefined),
    exists: (file) => dirs.has(file) || file in files,
    readFile: (file) => {
      const text = files[file];
      if (text === undefined) throw new Error(`no file ${file}`);
      return Buffer.from(text);
    },
    openDb: (url) => {
      calls.push(`open ${url}`);
      return db;
    },
    derive: () => {
      calls.push('derive');
      return options.deriveExit ?? 0;
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };
  return { deps, calls, restored, out, err };
}

describe('restore, dump present', () => {
  it('copies both files in one restore as loader, with each header as the column list, then derives and prints the four counts', async () => {
    const f = fake();
    expect(await restoreDocuments([], f.deps)).toBe(0);
    expect(f.calls).toEqual([`open ${LOCAL_URL}`, 'restore', 'derive', 'counts', 'end']);
    expect(f.restored).toHaveLength(1);
    const [tables] = f.restored;
    expect(tables?.map((t) => t.table)).toEqual(['document', 'document_column']);
    expect(tables?.map((t) => t.columns)).toEqual([
      ['orgnr', 'filing_year', 'brreg_id', 'status'],
      ['orgnr', 'filing_year', 'role', 'status'],
    ]);
    expect(tables?.[0]?.bytes.toString()).toBe(DOCUMENT_CSV);
    expect(f.out.at(-1)).toBe('restore: documents 2785, columns 5556, fingerprints 2537, classification rows 10371');
    expect(f.err).toEqual([]);
  });

  it('restores a named directory', async () => {
    const dir = path.join(ROOT, '.local', 'document-run-2.5c');
    const f = fake({ files: { [path.join(dir, 'document.csv')]: DOCUMENT_CSV, [path.join(dir, 'document_column.csv')]: COLUMN_CSV } });
    expect(await restoreDocuments(['.local/document-run-2.5c'], f.deps)).toBe(0);
    expect(f.calls).toContain('derive');
  });

  it('a failing derive exits 1 after the restore, with the counts', async () => {
    const f = fake({ deriveExit: 2 });
    expect(await restoreDocuments([], f.deps)).toBe(1);
    expect(f.calls).toEqual([`open ${LOCAL_URL}`, 'restore', 'derive', 'counts', 'end']);
    expect(f.err.join('\n')).toMatch(/pnpm derive failed \(exit 2\)/);
  });

  it('refuses a header column that is not a plain name, connecting to nothing', async () => {
    const dir = path.join(ROOT, DEFAULT_DUMP);
    const f = fake({ files: { [path.join(dir, 'document.csv')]: 'orgnr,"x; drop"\n', [path.join(dir, 'document_column.csv')]: COLUMN_CSV } });
    expect(await restoreDocuments([], f.deps)).toBe(1);
    expect(f.calls).toEqual([]);
  });

  it('refuses a dump without both files', async () => {
    const dir = path.join(ROOT, DEFAULT_DUMP);
    const f = fake({ files: { [path.join(dir, 'document.csv')]: DOCUMENT_CSV } });
    expect(await restoreDocuments([], f.deps)).toBe(1);
    expect(f.err.join('\n')).toContain('has no document_column.csv');
    expect(f.calls).toEqual([]);
  });
});

describe('restore, no dump', () => {
  it('the default directory missing (a fresh clone): says so, restores nothing, no derive, exit 0', async () => {
    const f = fake({ files: {} });
    expect(await restoreDocuments([], f.deps)).toBe(0);
    expect(f.out).toEqual([`restore: no dump at ${DEFAULT_DUMP} (a fresh clone has none); nothing restored, derive not run.`]);
    expect(f.calls).toEqual([]);
  });

  it('a named directory missing: exit 1, nothing restored, no derive', async () => {
    const f = fake({ files: {} });
    expect(await restoreDocuments(['.local/no-such-dump'], f.deps)).toBe(1);
    expect(f.err).toEqual(['restore: refused, nothing restored: no dump directory at .local/no-such-dump']);
    expect(f.calls).toEqual([]);
  });

  it('more than one directory is refused', async () => {
    const f = fake();
    expect(await restoreDocuments(['a', 'b'], f.deps)).toBe(1);
    expect(f.calls).toEqual([]);
  });
});

describe('restore, remote host', () => {
  it.each([
    'postgresql://loader:secret@db.example.com:5432/postgres',
    'postgresql://loader:secret@10.0.0.5:5432/postgres',
    'postgresql://loader:secret@localhost:5432/postgres?host=db.example.com',
  ])('refuses %s before reading a file or connecting, exit 1', async (url) => {
    const f = fake({ url });
    expect(await restoreDocuments([], f.deps)).toBe(1);
    expect(f.err.join('\n')).toMatch(/restores only into a local database/);
    expect(f.calls).toEqual([]);
  });

  it('refuses when LOADER_DATABASE_URL is not set', async () => {
    const f = fake({ url: undefined });
    expect(await restoreDocuments([], f.deps)).toBe(1);
    expect(f.calls).toEqual([]);
  });

  // The CLI itself: a remote host is refused before any file is read, so
  // this run reaches no database and no dump.
  it('the CLI refuses a remote host and exits 1', () => {
    const result = spawnSync(process.execPath, [path.resolve('scripts/restore-documents.ts')], {
      cwd: path.resolve('.'),
      encoding: 'utf8',
      env: { ...process.env, LOADER_DATABASE_URL: 'postgresql://loader:x@db.example.com:5432/postgres' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('restore: refused, nothing restored: restores only into a local database');
  });
});

describe('restore, already restored', () => {
  it('a dump key already stored: rolled back, says to run pnpm seed first, exit 1, no derive', async () => {
    const f = fake({ restoreError: Object.assign(new Error('duplicate key value violates unique constraint "document_pkey"'), { code: '23505' }) });
    expect(await restoreDocuments([], f.deps)).toBe(1);
    expect(f.err).toEqual([
      `restore: rolled back, nothing restored: a row of ${DEFAULT_DUMP} is already stored. Run \`pnpm seed\` first, then restore.`,
    ]);
    expect(f.calls).toEqual([`open ${LOCAL_URL}`, 'restore', 'end']);
  });

  it('any other failure rolls back and exits 1 without derive', async () => {
    const f = fake({ restoreError: Object.assign(new Error('insert or update violates foreign key constraint'), { code: '23503' }) });
    expect(await restoreDocuments([], f.deps)).toBe(1);
    expect(f.err.join('\n')).toContain('(23503)');
    expect(f.calls).not.toContain('derive');
  });
});
