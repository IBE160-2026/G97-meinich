// No application code names an industry (Story 1.3a; AD-16). Which
// industries are covered is data: seed/coverage.json. The literal 62.100
// may appear in tests, fixtures, documents and that file, never in code.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const LITERAL = '62.100';
const CODE_DIRS = ['src/', 'scripts/', 'ingest/src/'];
const CODE_FILES = ['ingest/config.toml'];

const files = listRepositoryFiles(root).filter(
  (file) => CODE_DIRS.some((dir) => file.startsWith(dir)) || CODE_FILES.includes(file),
);

describe('industry literal', () => {
  it('finds the code it checks', () => {
    expect(files).toContain('ingest/config.toml');
    expect(files.some((file) => file.startsWith('ingest/src/'))).toBe(true);
    expect(files.some((file) => file.startsWith('src/'))).toBe(true);
    expect(files.some((file) => file.startsWith('scripts/'))).toBe(true);
  });

  it(`does not contain ${LITERAL} in application code`, () => {
    const offenders = files.filter((file) => readFileSync(path.join(root, file), 'utf8').includes(LITERAL));
    expect(offenders).toEqual([]);
  });

  it('is declared in seed/coverage.json', () => {
    expect(readFileSync(path.join(root, 'seed/coverage.json'), 'utf8')).toContain(LITERAL);
  });
});
