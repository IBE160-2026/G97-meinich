import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Every user-facing string comes from src/messages/nb.json through t().
// This scan fails on JSX text and on literal values of the attributes a
// screen reader or the browser shows to the user.
const root = path.resolve(import.meta.dirname, '..');
const SCANNED_DIRS = ['src/app', 'src/components'];
const COPY_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'alt',
  'placeholder',
  'label',
]);

interface CopyFinding {
  file: string;
  line: number;
  text: string;
}

function hasLetters(text: string): boolean {
  return /\p{L}/u.test(text);
}

function findHardcodedCopy(file: string, source: string): CopyFinding[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: CopyFinding[] = [];
  const report = (node: ts.Node, text: string) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({ file, line: line + 1, text: text.trim() });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && hasLetters(node.text)) {
      report(node, node.text);
    }
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      const expr = node.expression;
      if (
        (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) &&
        hasLetters(expr.text)
      ) {
        report(node, expr.text);
      }
    }
    if (ts.isJsxAttribute(node) && COPY_ATTRIBUTES.has(node.name.getText(sourceFile))) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init) && hasLetters(init.text)) {
        report(node, init.text);
      }
      if (init && ts.isJsxExpression(init) && init.expression) {
        const expr = init.expression;
        if (
          (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) &&
          hasLetters(expr.text)
        ) {
          report(node, expr.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

function listTsx(dir: string): string[] {
  const absolute = path.join(root, dir);
  return readdirSync(absolute, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.tsx'))
    .map((entry) => path.posix.join(dir, entry.split(path.sep).join('/')));
}

describe('no hard-coded copy', () => {
  it('detects every kind of hard-coded string in the fixture', () => {
    const file = 'test/fixtures/copy/hardcoded.tsx';
    const findings = findHardcodedCopy(file, readFileSync(path.join(root, file), 'utf8'));
    expect(findings.map((f) => `${f.file}:${f.line} ${f.text}`)).toEqual([
      `${file}:6 Tekst rett i JSX`,
      `${file}:7 Lukk`,
      `${file}:8 Logo`,
      `${file}:9 Søk`,
      `${file}:10 Mer informasjon`,
      `${file}:11 Uttrykk i JSX`,
      `${file}:12 Tekst i fragment`,
      `${file}:13 Velg bransje`,
    ]);
  });

  it('finds none in src/app and src/components', () => {
    const files = SCANNED_DIRS.flatMap(listTsx);
    expect(files.length).toBeGreaterThan(0);
    const findings = files.flatMap((file) =>
      findHardcodedCopy(file, readFileSync(path.join(root, file), 'utf8')),
    );
    expect(findings.map((f) => `${f.file}:${f.line} ${f.text}`)).toEqual([]);
  });
});
