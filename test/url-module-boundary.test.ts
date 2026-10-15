// The URL module's boundary (Story 1.6a; AD-5): src/url/analysis-state.ts is
// the one module that parses or builds an analysis URL, and it depends only
// on the engine, so client components can use it and nothing server-side
// rides along.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const MODULE = 'src/url/analysis-state.ts';
// Without the trailing slash, so `'/analyse' + '/' + orgnr` is caught too.
const PATH_LITERAL = '/analyse';

/** Every module specifier in static imports, re-exports and dynamic imports. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1] as string);
  }
  return found;
}

/** Where a specifier points, relative to the repository root. */
function resolveSpecifier(specifier: string): string {
  if (specifier.startsWith('@/')) return path.posix.join('src', specifier.slice(2));
  if (specifier.startsWith('.')) return path.posix.join(path.posix.dirname(MODULE), specifier);
  return specifier; // a package
}

describe('URL module boundary', () => {
  const source = readFileSync(path.join(root, MODULE), 'utf8');

  it('imports something, so the check below is not empty', () => {
    expect(specifiers(source).length).toBeGreaterThan(0);
  });

  it('imports only from src/engine', () => {
    const outside = specifiers(source)
      .map(resolveSpecifier)
      .filter((target) => !target.startsWith('src/engine/'));
    expect(outside).toEqual([]);
  });

  it(`is the only file under src/ that contains ${PATH_LITERAL}`, () => {
    const files = listRepositoryFiles(root).filter((file) => file.startsWith('src/'));
    expect(files).toContain(MODULE);
    const offenders = files.filter(
      (file) => file !== MODULE && readFileSync(path.join(root, file), 'utf8').includes(PATH_LITERAL),
    );
    expect(offenders).toEqual([]);
  });
});
