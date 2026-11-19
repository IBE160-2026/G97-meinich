// No source of a multiple (Story 3.6, decision 2; FR-32): Peerless never
// suggests, infers or defaults an EV/EBIT multiple. A `Multiple` is a
// branded Decimal (src/engine/closable.ts) that only `parseMultippel` in
// src/url/analysis-state.ts makes, with the one `as Multiple` in `src/`,
// and `parseMultippel` is called only by `parse` (on the URL) and by the
// multiple field (on what the user typed), never on a literal. The scan
// reads every TypeScript file under src/ with the compiler's parser, so a
// comment naming either is not counted; two probes show it fails on a
// second `as Multiple` and on `parseMultippel('6')`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const URL_MODULE = 'src/url/analysis-state.ts';
const FIELD = 'src/components/analysis/multiple-field.tsx';

type Source = { readonly file: string; readonly text: string };

function sources(): Source[] {
  return listRepositoryFiles(root)
    .filter((file) => file.startsWith('src/') && /\.tsx?$/.test(file))
    .map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));
}

/** The name of the function a node sits in, or null at module level. */
function enclosingFunction(node: ts.Node): string | null {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name !== undefined) return current.name.text;
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
      return current.parent.name.text;
    }
  }
  return null;
}

function isLiteral(node: ts.Expression): boolean {
  return ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node);
}

type Findings = {
  /** Every `as Multiple` (or `<Multiple>`), as "file: function". */
  readonly casts: string[];
  /** Every use of parseMultippel that is not a call by `parse` or the field on a non-literal. */
  readonly misuse: string[];
};

function scan(files: readonly Source[]): Findings {
  const casts: string[] = [];
  const misuse: string[] = [];
  for (const { file, text } of files) {
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, kind);
    const visit = (node: ts.Node): void => {
      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
        if (ts.isTypeReferenceNode(node.type) && ts.isIdentifier(node.type.typeName) && node.type.typeName.text === 'Multiple') {
          casts.push(`${file}: ${enclosingFunction(node) ?? '(module)'}`);
        }
      }
      if (ts.isIdentifier(node) && node.text === 'parseMultippel') {
        const parent = node.parent;
        const declaration = ts.isFunctionDeclaration(parent) && parent.name === node;
        const specifier = ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent);
        if (!declaration && !specifier) {
          const where = `${file}: ${enclosingFunction(node) ?? '(module)'}`;
          if (!ts.isCallExpression(parent) || parent.expression !== node) {
            misuse.push(`${where}: not a call`);
          } else {
            const allowed = (file === URL_MODULE && enclosingFunction(node) === 'parse') || file === FIELD;
            if (!allowed) misuse.push(`${where}: not parse or the field`);
            const argument = parent.arguments[0];
            if (argument === undefined || isLiteral(argument)) misuse.push(`${where}: on a literal`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { casts, misuse };
}

describe('no source of a multiple', () => {
  const files = sources();

  it('src/ holds one `as Multiple`, in parseMultippel, and calls parseMultippel only from parse and the field', () => {
    // The fixture's state: the URL module is scanned.
    expect(files.map((source) => source.file)).toContain(URL_MODULE);
    const { casts, misuse } = scan(files);
    expect(casts).toEqual([`${URL_MODULE}: parseMultippel`]);
    expect(misuse).toEqual([]);
  });

  it('fails on a second `as Multiple` and on parseMultippel on a literal', () => {
    const probeCast: Source = {
      file: 'src/analysis/probe-multiple.ts',
      text: [
        "import type { Multiple } from '../engine/closable.ts';",
        "import { Decimal } from '../engine/decimal.ts';",
        "export const suggested = new Decimal('6') as Multiple;",
      ].join('\n'),
    };
    expect(scan([...files, probeCast]).casts).toEqual([`${URL_MODULE}: parseMultippel`, 'src/analysis/probe-multiple.ts: (module)']);
    const probeLiteral: Source = {
      file: FIELD,
      text: ["import { parseMultippel } from '@/url/analysis-state';", "export const fallback = parseMultippel('6');"].join('\n'),
    };
    expect(scan([...files.filter((source) => source.file !== FIELD), probeLiteral]).misuse).toEqual([`${FIELD}: (module): on a literal`]);
    // And a call from anywhere else, on a value the user did not write.
    const probeCaller: Source = {
      file: 'src/analysis/probe-caller.ts',
      text: ["import { parseMultippel } from '../url/analysis-state.ts';", 'export function guess(text: string) { return parseMultippel(text); }'].join('\n'),
    };
    expect(scan([...files, probeCaller]).misuse).toEqual(['src/analysis/probe-caller.ts: guess: not parse or the field']);
  });
});
