import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnpinnedDependencies } from '../scripts/check-pinned-deps.ts';
import {
  findPublicEnv,
  isExcluded,
  listRepositoryFiles,
} from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const envFixture = (name: string) =>
  readFileSync(path.join(root, 'test/fixtures/public-env', name), 'utf8');

describe('check:pins', () => {
  const base = { packageManager: 'pnpm@12.11.2' };

  it('accepts exact versions', () => {
    expect(
      findUnpinnedDependencies({
        ...base,
        dependencies: { next: '16.4.0' },
        devDependencies: { typescript: '6.0.3' },
      }),
    ).toEqual([]);
  });

  it('names a caret range', () => {
    expect(findUnpinnedDependencies({ ...base, dependencies: { x: '^1.0.0' } })).toEqual([
      { section: 'dependencies', name: 'x', spec: '^1.0.0' },
    ]);
  });

  it('names a tilde range in devDependencies', () => {
    expect(findUnpinnedDependencies({ ...base, devDependencies: { y: '~2.1.0' } })).toEqual([
      { section: 'devDependencies', name: 'y', spec: '~2.1.0' },
    ]);
  });

  it('rejects other ranges and tags', () => {
    const names = findUnpinnedDependencies({
      ...base,
      dependencies: { a: '*', b: 'latest', c: '>=1.0.0', d: '1.x' },
    }).map((v) => v.name);
    expect(names).toEqual(['a', 'b', 'c', 'd']);
  });

  it('requires an exact packageManager', () => {
    expect(findUnpinnedDependencies({ packageManager: 'pnpm@12' })).toEqual([
      { section: 'packageManager', name: 'pnpm', spec: 'pnpm@12' },
    ]);
  });

  it('accepts the hash suffix that corepack use writes', () => {
    expect(
      findUnpinnedDependencies({ packageManager: 'pnpm@12.11.2+sha512.0123456789abcdef' }),
    ).toEqual([]);
    expect(findUnpinnedDependencies({ packageManager: 'pnpm@12+sha512.0123abcd' })).toHaveLength(1);
  });

  it("passes on the repository's own package.json", () => {
    const pkg: unknown = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(findUnpinnedDependencies(pkg)).toEqual([]);
  });
});

describe('check:env', () => {
  it('reports a public env variable in a config file with file and line', () => {
    expect(findPublicEnv('next.config.ts', envFixture('next-config-public.txt'))).toEqual([
      { file: 'next.config.ts', line: 2, text: expect.stringContaining('_FOO') },
    ]);
  });

  it('allows the two commented stage-2 lines in .env.example', () => {
    expect(findPublicEnv('.env.example', envFixture('env-example-allowed.txt'))).toEqual([]);
  });

  it('allows those lines in .env.example only', () => {
    expect(findPublicEnv('src/env.ts', envFixture('env-example-allowed.txt'))).toHaveLength(2);
  });

  it('rejects an uncommented variable in .env.example', () => {
    expect(findPublicEnv('.env.example', envFixture('env-example-uncommented.txt'))).toEqual([
      { file: '.env.example', line: 2, text: expect.stringContaining('ANON_KEY=abc') },
    ]);
  });

  it('excludes documentation and planning but not source or config', () => {
    expect(isExcluded('docs/key-figures.md')).toBe(true);
    expect(isExcluded('_bmad-output/planning-artifacts/x.yaml')).toBe(true);
    expect(isExcluded('README.md')).toBe(true);
    expect(isExcluded('src/app/page.tsx')).toBe(false);
    expect(isExcluded('next.config.ts')).toBe(false);
    expect(isExcluded('.github/workflows/ci.yml')).toBe(false);
    expect(isExcluded('.env.example')).toBe(false);
  });

  it('finds no violation in the repository', () => {
    const violations = listRepositoryFiles(root)
      .filter((file) => !isExcluded(file))
      .flatMap((file) => {
        let content: string;
        try {
          content = readFileSync(path.join(root, file), 'utf8');
        } catch {
          return [];
        }
        return findPublicEnv(file, content);
      });
    expect(violations).toEqual([]);
  });
});
