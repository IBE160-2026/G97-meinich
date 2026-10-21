// `pnpm ingest` (scripts/run-ingest.ts): the URL the container sees, where
// settings come from, and the docker argv, which must never hold a password.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  CONTAINER_DOCUMENTS_FILE,
  containerDatabaseUrl,
  dockerRunArgs,
  main,
  setting,
  stepArgs,
} from '../scripts/run-ingest.ts';

// main() runs docker through spawnSync; here it is recorded, never run.
vi.mock('node:child_process', () => ({ spawnSync: vi.fn(() => ({ status: 0 })) }));

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

describe('argument passthrough', () => {
  it('passes nothing after the image for a normal run', () => {
    expect(dockerRunArgs('/repo', false).at(-1)).toBe('peerless-ingest:local');
  });

  it('passes --companies-only after the image, to the container', () => {
    const args = dockerRunArgs('/repo', true, ['--companies-only']);
    expect(args.slice(-2)).toEqual(['peerless-ingest:local', '--companies-only']);
    expect(args.filter((arg) => arg === '--companies-only')).toHaveLength(1);
  });

  it('allows only nothing, --companies-only once, or --documents with one file', () => {
    expect(stepArgs([])).toEqual({ args: [] });
    expect(stepArgs(['--companies-only'])).toEqual({ args: ['--companies-only'] });
    expect(stepArgs(['--documents', 'seed/document-run.json'])).toEqual({
      args: ['--documents', CONTAINER_DOCUMENTS_FILE],
      documentsFile: 'seed/document-run.json',
    });
    for (const argv of [
      ['--entrypoint=sh'],
      ['--companies-only', '--rm'],
      ['-e', 'X'],
      ['--companies-only', '--companies-only'],
      ['--documents'],
      ['--documents', ''],
      ['--documents', '--rm'],
      ['--documents', 'a.json', 'b.json'],
      ['--documents', 'a.json', '--companies-only'],
      ['--companies-only', '--documents', 'a.json'],
      ['--documents', 'a,readonly=false.json'],
    ]) {
      expect(stepArgs(argv), argv.join(' ')).toHaveProperty('error');
    }
  });

  it('mounts the --documents file read-only and passes its container path after the image', () => {
    const args = dockerRunArgs('/repo', false, ['--documents', 'seed/document-run.json']);
    expect(args.slice(-3)).toEqual(['peerless-ingest:local', '--documents', CONTAINER_DOCUMENTS_FILE]);
    const mounts = args.flatMap((arg, i) => (args[i - 1] === '--mount' ? [arg] : []));
    expect(mounts).toEqual([
      `type=bind,source=${path.join('/repo', 'seed')},target=/seed,readonly`,
      `type=bind,source=${path.resolve('/repo', 'seed/document-run.json')},target=${CONTAINER_DOCUMENTS_FILE},readonly`,
    ]);
    // The host path never reaches the container's command line.
    expect(args.slice(args.indexOf('peerless-ingest:local'))).not.toContain('seed/document-run.json');
  });

  it('never forwards a refused argument, even when called directly', () => {
    expect(() => dockerRunArgs('/repo', false, ['--entrypoint=sh'])).toThrow(/unknown argument/);
  });
});

describe('main', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'run-ingest-main-'));
    vi.stubEnv('INGEST_DATABASE_URL', `postgresql://ingest:${PASSWORD}@127.0.0.1:54322/postgres`);
    vi.stubEnv('BRREG_API_BASE_URL', '');
    vi.mocked(spawnSync).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it('runs the container with --companies-only after the image', () => {
    expect(main(dir, ['--companies-only'])).toBe(0);
    const calls = vi.mocked(spawnSync).mock.calls;
    expect(calls.map((call) => (call[1] as string[])[0])).toEqual(['build', 'run']);
    expect((calls[1]?.[1] as string[]).slice(-2)).toEqual(['peerless-ingest:local', '--companies-only']);
  });

  it('refuses another argument with 2 and runs nothing', () => {
    expect(main(dir, ['--company-only'])).toBe(2);
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('runs the container with --documents when the file exists, and refuses a missing one with 2', () => {
    expect(main(dir, ['--documents', 'absent.json'])).toBe(2);
    expect(main(dir, ['--documents'])).toBe(2);
    expect(spawnSync).not.toHaveBeenCalled();

    writeFileSync(path.join(dir, 'run.json'), '["979607008"]\n');
    expect(main(dir, ['--documents', 'run.json'])).toBe(0);
    const calls = vi.mocked(spawnSync).mock.calls;
    expect(calls.map((call) => (call[1] as string[])[0])).toEqual(['build', 'run']);
    const run = calls[1]?.[1] as string[];
    expect(run.slice(-3)).toEqual(['peerless-ingest:local', '--documents', CONTAINER_DOCUMENTS_FILE]);
    expect(run).toContain(
      `type=bind,source=${path.join(dir, 'run.json')},target=${CONTAINER_DOCUMENTS_FILE},readonly`,
    );
  });
});
