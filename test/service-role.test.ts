// The service-role key never reaches the request path (AD-4, AD-19; Story
// 1.6b). v1 sets no service-role variable: .env.example names
// SUPABASE_SERVICE_ROLE_KEY only on a commented-out stage-2 line. Request-path
// code — src/app, src/server and the proxy, if there is one — never names
// the variable or the service role.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const VARIABLE = 'SUPABASE_SERVICE_ROLE_KEY';
/** The variable, the Postgres role and the spelled-out key, in any case. */
const FORBIDDEN = /SUPABASE_SERVICE_ROLE_KEY|service[_ -]?role/i;
const REQUEST_PATH = ['src/app/', 'src/server/'];
const PROXY = ['src/proxy.ts', 'src/middleware.ts'];

const files = listRepositoryFiles(root).filter(
  (file) => REQUEST_PATH.some((dir) => file.startsWith(dir)) || PROXY.includes(file),
);

describe('the service-role key', () => {
  it('is in .env.example only on commented-out lines', () => {
    const lines = readFileSync(path.join(root, '.env.example'), 'utf8').split(/\r?\n/);
    const naming = lines.filter((line) => line.includes(VARIABLE));
    expect(naming.length).toBeGreaterThan(0);
    for (const line of naming) expect(line.trimStart().startsWith('#'), line).toBe(true);
  });

  it('finds the request-path files it checks', () => {
    expect(files).toContain('src/server/db.ts');
    expect(files.some((file) => file.startsWith('src/app/'))).toBe(true);
    for (const proxy of PROXY) {
      if (existsSync(path.join(root, proxy))) expect(files).toContain(proxy);
    }
  });

  it('is named nowhere on the request path', () => {
    const offenders = files.filter((file) => FORBIDDEN.test(readFileSync(path.join(root, file), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the pattern catches each spelling', () => {
    for (const text of [`process.env.${VARIABLE}`, "sql`set role service_role`", 'serviceRole', 'Service Role']) {
      expect(FORBIDDEN.test(text), text).toBe(true);
    }
  });
});
