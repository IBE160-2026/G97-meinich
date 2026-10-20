// `pnpm ingest`: build batch step 1's image (ingest/Dockerfile) and run it
// once against the database in INGEST_DATABASE_URL (Story 1.3a).
//
// Step 1 fetches the register's bulk download and the key figures of every
// company in the industries declared in seed/coverage.json, plus demo
// company C, and writes them as `ingest`. Filed documents are read only with
// `--documents <file>` (Story 2.1b). It is a manual batch run, never in a
// user's request path, and never run in CI.
//
// - INGEST_DATABASE_URL comes from the environment, then .env (written by
//   `pnpm db:roles`). It is handed to the container through the child's
//   environment (`-e NAME` with no value), so the password never appears on
//   a command line.
// - A local host (127.0.0.1, localhost) is rewritten to host.docker.internal,
//   which Docker Desktop provides and `--add-host …:host-gateway` provides
//   on Linux.
// - seed/coverage.json is mounted read-only at /seed.
// - `--companies-only` (Story 1.5a) is passed on to the container: step 1
//   then reads only the bulk download and fills the search fields of the
//   companies already stored.
// - `--documents <file>` (Story 2.1b): the file, a JSON list of orgnrs, is
//   mounted read-only at /run/peerless/documents.json and step 1 runs only
//   the document pass for those orgnrs. Step 1 checks the file's contents.
// - No other argument is accepted.
//
// Run: node scripts/run-ingest.ts [--companies-only | --documents <file>]   (from the repository root)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const IMAGE = 'peerless-ingest:local';
const LOCAL_HOSTS: readonly string[] = ['127.0.0.1', 'localhost'];
const CONTAINER_HOST = 'host.docker.internal';
const COMPANIES_ONLY = '--companies-only';
const DOCUMENTS = '--documents';
// Where `--documents <file>` is mounted inside the container.
export const CONTAINER_DOCUMENTS_FILE = '/run/peerless/documents.json';
const USAGE = `allowed: nothing, ${COMPANIES_ONLY}, or ${DOCUMENTS} <file>`;

export type StepArgs = {
  // What the container is given, after the image.
  args: string[];
  // The host file for `--documents`, as given.
  documentsFile?: string;
};

// The step-1 arguments, or an error naming what is not allowed: nothing,
// exactly `--companies-only`, or exactly `--documents <file>`.
export function stepArgs(argv: readonly string[]): StepArgs | { error: string } {
  if (argv.length === 0) return { args: [] };
  if (argv.length === 1 && argv[0] === COMPANIES_ONLY) return { args: [COMPANIES_ONLY] };
  if (argv[0] === DOCUMENTS) {
    const file = argv[1];
    if (argv.length !== 2 || file === undefined || file === '' || file.startsWith('-')) {
      return { error: `${DOCUMENTS} takes exactly one file; ${USAGE}` };
    }
    // --mount is a comma-separated list: a comma or quote in the path would
    // change its meaning.
    if (/[,"]/.test(file)) return { error: `${DOCUMENTS}: the file path may not contain a comma or a quote` };
    return { args: [DOCUMENTS, CONTAINER_DOCUMENTS_FILE], documentsFile: file };
  }
  return { error: `unknown argument ${argv.join(' ')}; ${USAGE}` };
}

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

// The `docker run` argv. It holds no value of any variable: each is passed
// as `--env NAME`, and docker reads the value from the child's environment.
// `argv` is the command line given to `pnpm ingest`.
export function dockerRunArgs(root: string, withBaseUrl: boolean, argv: readonly string[] = []): string[] {
  const checked = stepArgsOnly(argv);
  const runArgs = [
    'run',
    '--rm',
    '--add-host',
    `${CONTAINER_HOST}:host-gateway`,
    '--env',
    'INGEST_DATABASE_URL',
    '--mount',
    `type=bind,source=${path.join(root, 'seed')},target=/seed,readonly`,
  ];
  if (checked.documentsFile !== undefined) {
    runArgs.push(
      '--mount',
      `type=bind,source=${path.resolve(root, checked.documentsFile)},target=${CONTAINER_DOCUMENTS_FILE},readonly`,
    );
  }
  if (withBaseUrl) runArgs.push('--env', 'BRREG_API_BASE_URL');
  return [...runArgs, IMAGE, ...checked.args];
}

// Defence in depth: dockerRunArgs never forwards an argument stepArgs would
// refuse, whoever calls it.
function stepArgsOnly(argv: readonly string[]): StepArgs {
  const checked = stepArgs(argv);
  if ('error' in checked) throw new Error(`ingest: ${checked.error}`);
  return checked;
}

function docker(args: string[], env: NodeJS.ProcessEnv = process.env): number {
  const result = spawnSync('docker', args, { stdio: 'inherit', env });
  if (result.error !== undefined) {
    process.stderr.write(`ingest: could not run docker: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

export function main(root: string, argv: readonly string[] = []): number {
  const checked = stepArgs(argv);
  if ('error' in checked) {
    process.stderr.write(`ingest: ${checked.error}\n`);
    return 2;
  }
  if (checked.documentsFile !== undefined) {
    const file = path.resolve(root, checked.documentsFile);
    if (!existsSync(file) || !statSync(file).isFile()) {
      process.stderr.write(`ingest: --documents: ${checked.documentsFile} is not a file\n`);
      return 2;
    }
  }
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

  const baseUrl = setting(root, 'BRREG_API_BASE_URL');
  const env: NodeJS.ProcessEnv = { ...process.env, INGEST_DATABASE_URL: containerDatabaseUrl(url) };
  if (baseUrl !== undefined) env.BRREG_API_BASE_URL = baseUrl;
  return docker(dockerRunArgs(root, baseUrl !== undefined, argv), env);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.cwd(), process.argv.slice(2));
}
