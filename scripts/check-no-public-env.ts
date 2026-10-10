// CI guard (AD-19): no NEXT_PUBLIC_ variable in source or configuration.
// Next.js inlines every NEXT_PUBLIC_ value into the browser bundle, so v1
// has none. The only allowed occurrences are the two commented-out stage-2
// lines in .env.example.
// It also fails on an `env` key in next.config.*: Next.js inlines every value
// under that key into the client bundle, whatever the variable is called.
// Run: node scripts/check-no-public-env.ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

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

const NEXT_CONFIG = /^next\.config\.(?:ts|js|mjs|cjs)$/;

export function isNextConfig(file: string): boolean {
  return NEXT_CONFIG.test(path.posix.basename(file));
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) {
    return name.expression.text;
  }
  return undefined;
}

// Every property named `env` in any object literal of a Next.js config file:
// `env: {…}`, `'env': …`, `['env']: …`, shorthand `env` and a method `env()`.
// Also an assignment to `x.env` or `x['env']` (`nextConfig.env = {…}`).
// Parsed with the TypeScript compiler, so comments and strings do not match.
export function findNextConfigEnvKey(file: string, content: string): EnvViolation[] {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const violations: EnvViolation[] = [];
  const report = (node: ts.Node): void => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    const text = content.split(/\r?\n/)[line] ?? '';
    violations.push({ file, line: line + 1, text: text.trim() });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        const isEnv =
          (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property) ||
            ts.isGetAccessorDeclaration(property)) &&
          propertyNameText(property.name) === 'env';
        const isShorthandEnv =
          ts.isShorthandPropertyAssignment(property) && property.name.text === 'env';
        if (isEnv || isShorthandEnv) report(property);
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left;
      const isEnvTarget =
        (ts.isPropertyAccessExpression(left) && left.name.text === 'env') ||
        (ts.isElementAccessExpression(left) &&
          ts.isStringLiteralLike(left.argumentExpression) &&
          left.argumentExpression.text === 'env');
      if (isEnvTarget) report(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
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
    if (isNextConfig(file)) violations.push(...findNextConfigEnvKey(file, content));
  }
  if (violations.length === 0) {
    console.log(
      `check:env: no ${PATTERN} variable outside the allowed .env.example lines, and no env key in next.config.`,
    );
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
