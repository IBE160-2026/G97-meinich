// CI guard: every dependency in package.json is an exact version.
// Fails on `^`, `~` or any other range, naming each offending package.
// Run: node scripts/check-pinned-deps.ts [path/to/package.json]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

// x.y.z with an optional prerelease/build suffix, nothing else.
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export interface PinViolation {
  section: string;
  name: string;
  spec: string;
}

export function findUnpinnedDependencies(packageJson: unknown): PinViolation[] {
  if (typeof packageJson !== 'object' || packageJson === null) {
    throw new Error('package.json is not an object');
  }
  const record = packageJson as Record<string, unknown>;
  const violations: PinViolation[] = [];

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = record[section];
    if (deps === undefined) continue;
    if (typeof deps !== 'object' || deps === null) {
      violations.push({ section, name: '(section)', spec: String(deps) });
      continue;
    }
    for (const [name, spec] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof spec !== 'string' || !EXACT_VERSION.test(spec)) {
        violations.push({ section, name, spec: String(spec) });
      }
    }
  }

  const packageManager = record['packageManager'];
  // `corepack use` appends `+sha512.<hex>`; the version itself must be exact.
  if (
    typeof packageManager !== 'string' ||
    !/^pnpm@\d+\.\d+\.\d+(?:\+sha\d+\.[0-9a-f]+)?$/.test(packageManager)
  ) {
    violations.push({ section: 'packageManager', name: 'pnpm', spec: String(packageManager) });
  }

  return violations;
}

function main(): void {
  const file = path.resolve(process.argv[2] ?? 'package.json');
  const violations = findUnpinnedDependencies(JSON.parse(readFileSync(file, 'utf8')));
  if (violations.length === 0) {
    console.log(`check:pins: every dependency in ${path.basename(file)} is pinned exactly.`);
    return;
  }
  for (const v of violations) {
    console.error(`check:pins: ${v.section} "${v.name}" is "${v.spec}", not an exact version`);
  }
  process.exitCode = 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
