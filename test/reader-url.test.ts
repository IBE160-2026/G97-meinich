// The request path's database access (AD-19; Story 1.5b): READER_DATABASE_URL
// is read only in src/server/db.ts, and that file begins with
// `import 'server-only'`, so a client bundle that reaches it fails to build.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isNextConfig, listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const VARIABLE = 'READER_DATABASE_URL';
const CLIENT_FILE = 'src/server/db.ts';

const files = listRepositoryFiles(root).filter((file) => file.startsWith('src/') || isNextConfig(file));

describe(VARIABLE, () => {
  it('finds the files it checks', () => {
    expect(files).toContain(CLIENT_FILE);
    expect(files.some((file) => isNextConfig(file))).toBe(true);
  });

  it(`appears in ${CLIENT_FILE} and in no other source or Next.js config file`, () => {
    const readers = files.filter((file) => readFileSync(path.join(root, file), 'utf8').includes(VARIABLE));
    expect(readers).toEqual([CLIENT_FILE]);
  });

  it(`${CLIENT_FILE} begins with import 'server-only'`, () => {
    const firstLine = readFileSync(path.join(root, CLIENT_FILE), 'utf8').split(/\r?\n/)[0];
    expect(firstLine).toBe("import 'server-only';");
  });

  it('every module under src/server begins with import \'server-only\'', () => {
    const serverFiles = files.filter((file) => file.startsWith('src/server/'));
    expect(serverFiles.length).toBeGreaterThan(0);
    for (const file of serverFiles) {
      expect(readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)[0], file).toBe("import 'server-only';");
    }
  });
});
