// No visitor's address is stored anywhere (Story 1.10; FR-6; AD-10, AD-19).
// This spec starts its own production server (`next start`, the command
// behind `pnpm start`) on a spare port with its output captured, sends a
// sentinel address within and over both budgets, stops the server, and then
// looks for the sentinel in:
// - everything the server wrote to stdout and stderr (the logger's lines);
// - every row of every table in the local database, each row cast to text,
//   so every text column (and every other column) is searched;
// - every file under the repository and under the OS temp directory
//   modified since the spec started.
// The sentinel is assembled at run time, so it is not in this file's source
// or in Playwright's compiled copy of it, and tracing is off, so Playwright
// does not write the request headers to a trace.
//
// The same server shows what the client address is without the header:
// Next.js sets X-Forwarded-For from the socket when the client sent none,
// and once that address is exhausted, requests carrying another address are
// served while it stays refused.
import { spawn, type ChildProcess } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { BUDGETS } from '../src/rate-limit/budgets.ts';
import { supabaseDbUrl } from '../test/db/db-env.ts';
import { expect, test } from './fixtures.ts';

const root = path.resolve(import.meta.dirname, '..');
const PORT = 3102;
const BASE = `http://localhost:${PORT}`;
const ORGNR = '813235552'; // demo company A, covered in the seed
const SENTINEL = ['203', '0', '113', '77'].join('.'); // TEST-NET-3, RFC 5737
const MAX_SCANNED_FILE = 64 * 1024 * 1024;

test.use({ trace: 'off' });
// One server for both tests, in order; the scans take tens of seconds.
test.describe.configure({ mode: 'serial', timeout: 240_000 });

let server: ChildProcess | null = null;
let output = '';
let started = 0;

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      // No header: counted under the socket's address, never the sentinel.
      if ((await fetch(`${BASE}/slik-fungerer-peerless`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`the server on port ${PORT} did not start:\n${output}`);
}

function stopServer(): Promise<void> {
  const child = server;
  server = null;
  if (child === null || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill();
  });
}

/** Starts a fresh server (an empty limiter) with its output captured. */
async function startServer(): Promise<void> {
  output = '';
  const next = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  server = spawn(process.execPath, [next, 'start', '--port', String(PORT)], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
  server.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
  await waitForServer();
}

test.beforeAll(async () => {
  // A margin for file systems that store modification times coarsely.
  started = Date.now() - 2_000;
  await startServer();
});

test.afterAll(stopServer);

async function get(pathname: string, headers: Record<string, string> = {}): Promise<number> {
  const response = await fetch(`${BASE}${pathname}`, { headers, redirect: 'manual' });
  await response.arrayBuffer();
  return response.status;
}

/** Requests `pathname` until it is refused, then twice more; returns the statuses. */
async function overBudget(pathname: string, limit: number, headers: Record<string, string>): Promise<number[]> {
  const statuses: number[] = [];
  while (statuses.filter((status) => status === 429).length < 3 && statuses.length < 2 * limit + 3) {
    statuses.push(await get(pathname, headers));
  }
  return statuses;
}

function filesModifiedSince(dir: string, since: number, found: string[] = []): string[] {
  const pending = [dir];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue; // gone or unreadable: nothing of ours is in it
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      // Symbolic links and junctions are not followed: their targets are
      // either under a scanned directory or outside what the app writes.
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile()) {
        try {
          const stat = statSync(full);
          if (stat.mtimeMs >= since && stat.size <= MAX_SCANNED_FILE) found.push(full);
        } catch {
          // Removed while scanning.
        }
      }
    }
  }
  return found;
}

test('the sentinel address is in no log line, no table and no file after requests within and over budget', async () => {
  const sentinel = { 'X-Forwarded-For': SENTINEL };

  // Within budget, on every kind of surface.
  expect(await get('/', sentinel)).toBe(200);
  expect(await get(`/analyse/${ORGNR}/oversikt`, sentinel)).toBe(200);
  // An RSC request without the router's cache-busting parameter is
  // redirected to it: served all the same, and counted.
  expect(await get(`/analyse/${ORGNR}/nokkeltall`, { ...sentinel, RSC: '1' })).toBeLessThan(400);
  expect(await get(`/analyse/${ORGNR}/peers`, { ...sentinel, RSC: '1', 'Next-Router-Prefetch': '1' })).toBeLessThan(400);
  expect(await get('/finnes-ikke', sentinel)).toBe(404);
  expect(await get('/api/sok?q=admmit', sentinel)).toBe(200);

  // Over both budgets.
  const analysis = await overBudget(`/analyse/${ORGNR}/peers`, BUDGETS.analysis.limit, sentinel);
  expect(analysis.filter((status) => status !== 429)).toHaveLength(BUDGETS.analysis.limit - 5);
  expect(analysis.slice(-3)).toEqual([429, 429, 429]);
  const search = await overBudget(`/api/sok?q=${ORGNR}`, BUDGETS.search.limit, sentinel);
  expect(search.filter((status) => status !== 429)).toHaveLength(BUDGETS.search.limit - 1);
  expect(search.slice(-3)).toEqual([429, 429, 429]);

  await stopServer();

  // The log: it was written (served and refused lines), and it holds no address.
  expect(output).toContain('"outcome":"served"');
  expect(output).toContain('"outcome":"refused"');
  expect(output).not.toContain(SENTINEL);

  // Every table in the database.
  const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
  try {
    const tables = await sql<{ schema: string; name: string }[]>`
      select table_schema as schema, table_name as name
      from information_schema.tables
      where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')
      order by 1, 2`;
    expect(tables.length).toBeGreaterThan(0);
    expect(tables.map((t) => `${t.schema}.${t.name}`)).toContain('register.company');
    const holding: string[] = [];
    for (const table of tables) {
      const [row] = await sql<{ n: number }[]>`
        select count(*)::int as n from ${sql(table.schema)}.${sql(table.name)} as t
        where strpos(t::text, ${SENTINEL}) > 0`;
      if ((row?.n ?? 0) > 0) holding.push(`${table.schema}.${table.name}`);
    }
    expect(holding).toEqual([]);
  } finally {
    await sql.end();
  }

  // Every file written since the spec started.
  const files = [...filesModifiedSince(root, started), ...filesModifiedSince(os.tmpdir(), started)];
  const holding = files.filter((file) => {
    try {
      return readFileSync(file).includes(SENTINEL);
    } catch {
      return false; // locked by another process (Windows) or removed
    }
  });
  expect(holding).toEqual([]);
});

test('without the header, the socket address is the key; another address only gets its own budget', async () => {
  // The first test stopped the server; this one needs a fresh one.
  await startServer();

  const statuses = await overBudget('/slik-fungerer-peerless', BUDGETS.analysis.limit, {});
  expect(statuses.slice(-3)).toEqual([429, 429, 429]);
  expect(await get('/slik-fungerer-peerless', { 'X-Forwarded-For': '198.51.100.23' })).toBe(200);
  expect(await get('/slik-fungerer-peerless')).toBe(429);
});
