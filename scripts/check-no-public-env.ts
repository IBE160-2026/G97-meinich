// CI guard (AD-19): no NEXT_PUBLIC_ variable in source or configuration.
// Next.js inlines every NEXT_PUBLIC_ value into the browser bundle, so v1
// has none. The only allowed occurrences are the two commented-out stage-2
// lines in .env.example.
// Run: node scripts/check-no-public-env.ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PATTERN = 'NEXT_PUBLIC_';

export const ALLOWED_LINES: ReadonlyMap<string, readonly string[]> = new Map([
  ['.env.example', ['# NEXT_PUBLIC_SUPABASE_URL=', '# NEXT_PUBLIC_SUPABASE_ANON_KEY=']],
]);

// Documentation and planning prose may name the variable; it is not config.
// This script holds the pattern itself, and its fixtures hold violations
// on purpose.
export function isExcluded(file: string): boolean {
  return (
    file.endsWith('.md') ||
    file.startsWith('_bmad/') ||
    file.startsWith('_bmad-output/') ||
    file.startsWith('docs/') ||
    file.startsWith('analysis/') ||
    file.startsWith('test/fixtures/public-env/') ||
    file === 'scripts/check-no-public-env.ts'
  );
}

export interface EnvViolation {
  file: string;
  line: number;
  text: string;
}

export function findPublicEnv(file: string, content: string): EnvViolation[] {
  const allowed = ALLOWED_LINES.get(file) ?? [];
  const violations: EnvViolation[] = [];
  content.split(/\r?\n/).forEach((text, index) => {
    if (text.includes(PATTERN) && !allowed.includes(text.trim())) {
      violations.push({ file, line: index + 1, text: text.trim() });
    }
  });
  return violations;
}

// Tracked files plus untracked files that are not gitignored, so a new file
// is caught before it is added.
export function listRepositoryFiles(cwd: string = process.cwd()): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd, encoding: 'utf8' },
  );
  return [...new Set(output.split('\0').filter((f) => f.length > 0))];
}

function main(): void {
  const violations: EnvViolation[] = [];
  for (const file of listRepositoryFiles()) {
    if (isExcluded(file)) continue;
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue; // deleted in the working tree but still in the index
    }
    violations.push(...findPublicEnv(file, content));
  }
  if (violations.length === 0) {
    console.log(`check:env: no ${PATTERN} variable outside the allowed .env.example lines.`);
    return;
  }
  for (const v of violations) {
    console.error(`check:env: ${v.file}:${v.line}: ${v.text}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
