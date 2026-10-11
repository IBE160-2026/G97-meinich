// `pnpm ingest`: build batch step 1's image (ingest/Dockerfile) and run it
// once against the database in INGEST_DATABASE_URL (Story 1.3a).
//
// Step 1 fetches the register's bulk download and the key figures of every
// company in the industries declared in seed/coverage.json, plus demo
// company C, and writes them as `ingest`. It is a manual batch run, never in
// a user's request path, and never run in CI.
//
// - INGEST_DATABASE_URL comes from the environment, then .env (written by
//   `pnpm db:roles`). It is handed to the container through the child's
//   environment (`-e NAME` with no value), so the password never appears on
//   a command line.
// - A local host (127.0.0.1, localhost) is rewritten to host.docker.internal,
//   which Docker Desktop provides and `--add-host …:host-gateway` provides
//   on Linux.
// - seed/coverage.json is mounted read-only at /seed.
//
// Run: node scripts/run-ingest.ts   (from the repository root)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const IMAGE = 'peerless-ingest:local';
const LOCAL_HOSTS: readonly string[] = ['127.0.0.1', 'localhost'];
const CONTAINER_HOST = 'host.docker.internal';

export function setting(root: string, name: string): string | undefined {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  const file = path.join(root, '.env');
  if (!existsSync(file)) return undefined;
  const fromFile = parseEnv(readFileSync(file, 'utf8'))[name];
  return fromFile === '' ? undefined : fromFile;
}

// The URL as seen from inside the container.
export function containerDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  if (LOCAL_HOSTS.includes(parsed.hostname)) parsed.hostname = CONTAINER_HOST;
  return parsed.toString();
}

function docker(args: string[], env: NodeJS.ProcessEnv = process.env): number {
  const result = spawnSync('docker', args, { stdio: 'inherit', env });
  if (result.error !== undefined) {
    process.stderr.write(`ingest: could not run docker: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

export function main(root: string): number {
  const url = setting(root, 'INGEST_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('ingest: INGEST_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  if (new URL(url).password === '') {
    process.stderr.write('ingest: INGEST_DATABASE_URL has no password; run `pnpm db:roles`.\n');
    return 1;
  }

  const built = docker(['build', '--tag', IMAGE, path.join(root, 'ingest')]);
  if (built !== 0) return built;

  const env: NodeJS.ProcessEnv = { ...process.env, INGEST_DATABASE_URL: containerDatabaseUrl(url) };
  const args = [
    'run',
    '--rm',
    '--add-host',
    `${CONTAINER_HOST}:host-gateway`,
    '--env',
    'INGEST_DATABASE_URL',
    '--mount',
    `type=bind,source=${path.join(root, 'seed')},target=/seed,readonly`,
  ];
  const baseUrl = setting(root, 'BRREG_API_BASE_URL');
  if (baseUrl !== undefined) {
    env.BRREG_API_BASE_URL = baseUrl;
    args.push('--env', 'BRREG_API_BASE_URL');
  }
  return docker([...args, IMAGE], env);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.cwd());
}
