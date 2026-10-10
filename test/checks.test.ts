import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnpinnedDependencies } from '../scripts/check-pinned-deps.ts';
import {
  findNextConfigEnvKey,
  findPublicEnv,
  isExcluded,
  isNextConfig,
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

describe('check:env, env key in next.config', () => {
  it('reports an env property with file and line', () => {
    expect(findNextConfigEnvKey('next.config.ts', envFixture('next-config-env-key.txt'))).toEqual([
      { file: 'next.config.ts', line: 5, text: expect.stringContaining('env: {') },
    ]);
  });

  it('reports a shorthand env property', () => {
    expect(
      findNextConfigEnvKey('next.config.js', envFixture('next-config-env-shorthand.txt')),
    ).toEqual([{ file: 'next.config.js', line: 5, text: 'env,' }]);
  });

  it('reports an assignment to x.env or x[\'env\']', () => {
    expect(
      findNextConfigEnvKey('next.config.ts', envFixture('next-config-env-assignment.txt')),
    ).toEqual([
      { file: 'next.config.ts', line: 5, text: expect.stringContaining('nextConfig.env =') },
      { file: 'next.config.ts', line: 6, text: "nextConfig['env'] = {};" },
    ]);
  });

  it('does not report reading x.env or assigning to process.env.X', () => {
    const content = 'const a = config.env;\nprocess.env.X = "1";\n';
    expect(findNextConfigEnvKey('next.config.mjs', content)).toEqual([]);
  });

  it('reports quoted, computed and method forms', () => {
    const content = [
      'export default {',
      "  'env': {},",
      "  ['env']: {},",
      '  env() { return {}; },',
      '};',
    ].join('\n');
    expect(findNextConfigEnvKey('next.config.mjs', content).map((v) => v.line)).toEqual([2, 3, 4]);
  });

  it('passes a clean config, including env in a comment or a string', () => {
    expect(findNextConfigEnvKey('next.config.ts', envFixture('next-config-clean.txt'))).toEqual([]);
  });

  it('passes the repository next.config.ts', () => {
    const file = 'next.config.ts';
    expect(findNextConfigEnvKey(file, readFileSync(path.join(root, file), 'utf8'))).toEqual([]);
  });

  it('applies to next.config.{ts,js,mjs,cjs} only', () => {
    for (const ext of ['ts', 'js', 'mjs', 'cjs']) {
      expect(isNextConfig(`next.config.${ext}`)).toBe(true);
    }
    expect(isNextConfig('apps/web/next.config.mjs')).toBe(true);
    expect(isNextConfig('next.config.json')).toBe(false);
    expect(isNextConfig('src/config.ts')).toBe(false);
  });
});

// The CLI entry points, run the way CI runs them: plain node, native type
// stripping, exit status and stderr.
describe('CLI entry points', () => {
  it('check:pins exits 1 and names the package with a caret range', () => {
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, 'scripts/check-pinned-deps.ts'),
        path.join(root, 'test/fixtures/pins/caret.package.json'),
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"left-pad"');
  });

  it('check:env exits 1 and reports file:line in a git repository', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'check-env-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: repo });
      // Built at runtime so this test file holds no public-prefixed name itself.
      const variable = ['NEXT', 'PUBLIC', 'FOO'].join('_');
      writeFileSync(
        path.join(repo, 'config.ts'),
        `export const a = 1;\nexport const b = process.env.${variable};\n`,
      );
      execFileSync('git', ['add', 'config.ts'], { cwd: repo });

      const result = spawnSync(
        process.execPath,
        [path.join(root, 'scripts/check-no-public-env.ts')],
        { cwd: repo, encoding: 'utf8' },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('config.ts:2');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('check:env exits 1 on an env key in next.config.ts, with file:line', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'check-env-key-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: repo });
      writeFileSync(
        path.join(repo, 'next.config.ts'),
        envFixture('next-config-env-key.txt'),
      );
      execFileSync('git', ['add', 'next.config.ts'], { cwd: repo });

      const failing = spawnSync(
        process.execPath,
        [path.join(root, 'scripts/check-no-public-env.ts')],
        { cwd: repo, encoding: 'utf8' },
      );
      expect(failing.status).toBe(1);
      expect(failing.stderr).toContain('next.config.ts:5');

      writeFileSync(path.join(repo, 'next.config.ts'), envFixture('next-config-clean.txt'));
      const passing = spawnSync(
        process.execPath,
        [path.join(root, 'scripts/check-no-public-env.ts')],
        { cwd: repo, encoding: 'utf8' },
      );
      expect(passing.status).toBe(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
