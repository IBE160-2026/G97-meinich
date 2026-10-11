// `pnpm ingest` (scripts/run-ingest.ts): the URL the container sees, where
// settings come from, and the docker argv, which must never hold a password.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { containerDatabaseUrl, dockerRunArgs, setting } from '../scripts/run-ingest.ts';

const PASSWORD = 'a'.repeat(64);

describe('containerDatabaseUrl', () => {
  it('rewrites 127.0.0.1 and localhost, keeping user, password, port and path', () => {
    for (const host of ['127.0.0.1', 'localhost']) {
      expect(containerDatabaseUrl(`postgresql://ingest:${PASSWORD}@${host}:54322/postgres`)).toBe(
        `postgresql://ingest:${PASSWORD}@host.docker.internal:54322/postgres`,
      );
    }
  });

  it('leaves a non-local host alone', () => {
    const url = `postgresql://ingest:${PASSWORD}@db.example.test:5432/postgres`;
    expect(containerDatabaseUrl(url)).toBe(url);
  });
});

describe('setting', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'run-ingest-'));
    writeFileSync(path.join(dir, '.env'), 'PEERLESS_TEST_A=from-file\nPEERLESS_TEST_B=\nPEERLESS_TEST_C=file-c\n');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads the environment before .env', () => {
    vi.stubEnv('PEERLESS_TEST_A', 'from-env');
    expect(setting(dir, 'PEERLESS_TEST_A')).toBe('from-env');
  });

  it('falls back to .env when the environment has it empty or not at all', () => {
    vi.stubEnv('PEERLESS_TEST_C', '');
    expect(setting(dir, 'PEERLESS_TEST_C')).toBe('file-c');
    expect(setting(dir, 'PEERLESS_TEST_A')).toBe('from-file');
  });

  it('treats an empty value as unset', () => {
    expect(setting(dir, 'PEERLESS_TEST_B')).toBeUndefined();
    expect(setting(dir, 'PEERLESS_TEST_MISSING')).toBeUndefined();
  });
});

describe('dockerRunArgs', () => {
  it('passes INGEST_DATABASE_URL as --env NAME only, and holds no password', () => {
    for (const withBaseUrl of [false, true]) {
      const args = dockerRunArgs('/repo', withBaseUrl);
      for (const arg of args) {
        expect(arg).not.toContain(PASSWORD);
        expect(arg).not.toContain('postgresql://');
        expect(arg).not.toContain('=postgres');
      }
      const at = args.indexOf('INGEST_DATABASE_URL');
      expect(at).toBeGreaterThan(0);
      expect(args[at - 1]).toBe('--env');
      expect(args.filter((arg) => arg.includes('INGEST_DATABASE_URL'))).toEqual(['INGEST_DATABASE_URL']);
      expect(args.includes('BRREG_API_BASE_URL')).toBe(withBaseUrl);
      expect(args.at(-1)).toBe('peerless-ingest:local');
    }
  });
});
