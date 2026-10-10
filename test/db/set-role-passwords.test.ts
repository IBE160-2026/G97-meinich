// `pnpm db:roles` (scripts/set-role-passwords.ts), run as a CLI in a
// temporary git repository holding a copy of .env.example, against the local
// Supabase Postgres. The roles' passwords are changed by these tests and
// restored from the repository's own .env afterwards.
import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import postgres from 'postgres';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { root, supabaseDbUrl } from './db-env.ts';

const SCRIPT = path.join(root, 'scripts/set-role-passwords.ts');
const VARIABLES = {
  reader: 'READER_DATABASE_URL',
  ingest: 'INGEST_DATABASE_URL',
  derive: 'DERIVE_DATABASE_URL',
  loader: 'LOADER_DATABASE_URL',
} as const;

let repo: string;

function makeRepo({ ignoreEnv }: { ignoreEnv: boolean }): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'db-roles-'));
  execFileSync('git', ['init', '--quiet'], { cwd: dir });
  if (ignoreEnv) writeFileSync(path.join(dir, '.gitignore'), '.env\n');
  copyFileSync(path.join(root, '.env.example'), path.join(dir, '.env.example'));
  return dir;
}

function runScript(cwd: string, supabaseUrl: string | null = supabaseDbUrl()): SpawnSyncReturns<string> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.SUPABASE_DB_URL;
  if (supabaseUrl !== null) env.SUPABASE_DB_URL = supabaseUrl;
  return spawnSync(process.execPath, [SCRIPT], { cwd, env, encoding: 'utf8' });
}

function readEnv(dir: string): Record<string, string | undefined> {
  return parseEnv(readFileSync(path.join(dir, '.env'), 'utf8'));
}

function passwordsIn(dir: string): string[] {
  const env = readEnv(dir);
  return Object.values(VARIABLES).map((variable) => {
    const url = env[variable];
    if (url === undefined) throw new Error(`${variable} missing from .env`);
    return decodeURIComponent(new URL(url).password);
  });
}

async function loginAs(url: string): Promise<string | undefined> {
  const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 10 });
  try {
    const [row] = await sql<{ current_user: string }[]>`select current_user`;
    return row?.current_user;
  } finally {
    await sql.end();
  }
}

async function expectAllLogins(dir: string): Promise<void> {
  const env = readEnv(dir);
  for (const [role, variable] of Object.entries(VARIABLES)) {
    const url = env[variable];
    expect(url, variable).toBeDefined();
    expect(await loginAs(url ?? ''), role).toBe(role);
  }
}

function expectNoPasswordPrinted(result: SpawnSyncReturns<string>, passwords: readonly string[]): void {
  for (const password of passwords) {
    expect(result.stdout).not.toContain(password);
    expect(result.stderr).not.toContain(password);
  }
}

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

// Put back the passwords the repository's own .env holds, so the grants
// test's reader login and the developer's setup keep working.
afterAll(() => {
  if (existsSync(path.join(root, '.env'))) {
    const result = runScript(root);
    if (result.status !== 0) throw new Error(`restoring role passwords failed: ${result.stderr}`);
  }
});

describe('db:roles in a repository where .env is gitignored', () => {
  beforeEach(() => {
    repo = makeRepo({ ignoreEnv: true });
  });

  it('creates .env, fills every role password with hex and applies it, printing none', async () => {
    expect(existsSync(path.join(repo, '.env'))).toBe(false);

    const result = runScript(repo);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);

    const passwords = passwordsIn(repo);
    for (const password of passwords) expect(password).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(passwords).size).toBe(4);
    expectNoPasswordPrinted(result, passwords);
    for (const role of Object.keys(VARIABLES)) expect(result.stdout).toContain(role);
    await expectAllLogins(repo);
  });

  it('changes nothing on a second run, and the logins still work', async () => {
    expect(runScript(repo).status).toBe(0);
    const before = readFileSync(path.join(repo, '.env'));

    const second = runScript(repo);
    expect(second.status).toBe(0);
    expect(readFileSync(path.join(repo, '.env')).equals(before)).toBe(true);
    expectNoPasswordPrinted(second, passwordsIn(repo));
    await expectAllLogins(repo);
  });

  it('re-applies, never regenerates, the passwords after the roles lose them (db:reset)', async () => {
    expect(runScript(repo).status).toBe(0);
    const before = readFileSync(path.join(repo, '.env'));

    const admin = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
    try {
      for (const role of Object.keys(VARIABLES)) {
        await admin.unsafe(`alter role ${role} password null`);
      }
    } finally {
      await admin.end();
    }
    await expect(loginAs(readEnv(repo).READER_DATABASE_URL ?? '')).rejects.toThrow();

    const result = runScript(repo);
    expect(result.status).toBe(0);
    expect(readFileSync(path.join(repo, '.env')).equals(before)).toBe(true);
    await expectAllLogins(repo);
  });

  it('keeps a password already in .env and fills only the empty ones', async () => {
    const example = readFileSync(path.join(repo, '.env.example'), 'utf8');
    const kept = 'a'.repeat(64);
    writeFileSync(
      path.join(repo, '.env'),
      example.replace(
        'READER_DATABASE_URL=postgresql://reader:@',
        `READER_DATABASE_URL=postgresql://reader:${kept}@`,
      ),
    );

    const result = runScript(repo);
    expect(result.status).toBe(0);
    const [reader, ...others] = passwordsIn(repo);
    expect(reader).toBe(kept);
    for (const password of others) expect(password).toMatch(/^[0-9a-f]{64}$/);
    expectNoPasswordPrinted(result, [kept, ...others]);
    await expectAllLogins(repo);
  });

  it('refuses a non-local SUPABASE_DB_URL before touching .env or the database', () => {
    const original = 'KEEP=me\n';
    writeFileSync(path.join(repo, '.env'), original);

    const result = runScript(repo, 'postgresql://postgres:postgres@db.example.supabase.co:5432/postgres');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('SUPABASE_DB_URL');
    expect(readFileSync(path.join(repo, '.env'), 'utf8')).toBe(original);
  });

  it('refuses a non-local SUPABASE_DB_URL read from .env', () => {
    const original = 'SUPABASE_DB_URL=postgresql://postgres:x@db.example.supabase.co:5432/postgres\n';
    writeFileSync(path.join(repo, '.env'), original);

    const result = runScript(repo, null);
    expect(result.status).toBe(1);
    expect(readFileSync(path.join(repo, '.env'), 'utf8')).toBe(original);
  });

  it('refuses a role URL that names a role outside the four, and writes nothing', () => {
    const original = 'READER_DATABASE_URL=postgresql://postgres:@127.0.0.1:54322/postgres\n';
    writeFileSync(path.join(repo, '.env'), original);

    const result = runScript(repo);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('READER_DATABASE_URL');
    expect(readFileSync(path.join(repo, '.env'), 'utf8')).toBe(original);
  });

  it('refuses a role URL on a non-local host, and writes nothing', () => {
    const original = 'LOADER_DATABASE_URL=postgresql://loader:@db.example.supabase.co:5432/postgres\n';
    writeFileSync(path.join(repo, '.env'), original);

    const result = runScript(repo);
    expect(result.status).toBe(1);
    expect(readFileSync(path.join(repo, '.env'), 'utf8')).toBe(original);
  });
});

describe('db:roles in a repository where .env is not gitignored', () => {
  beforeEach(() => {
    repo = makeRepo({ ignoreEnv: false });
  });

  it('refuses and creates no .env', () => {
    const result = runScript(repo);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('gitignored');
    expect(existsSync(path.join(repo, '.env'))).toBe(false);
  });
});
