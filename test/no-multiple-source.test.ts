// No source of a multiple (Story 3.6, decision 2; FR-32): Peerless never
// suggests, infers or defaults an EV/EBIT multiple. A `Multiple` is a
// branded Decimal (src/engine/closable.ts) that only `parseMultippel` in
// src/url/analysis-state.ts makes, with the one type assertion to it in
// `src/`, and `parseMultippel` is called only by `parse` (on the URL) and by
// the multiple field's `commit` (on what the user typed), never on a
// literal.
//
// The scan uses the type checker over every TypeScript file under src/
// (test/src-program.ts), so it follows an aliased import, sees a literal
// bound to a `const`, and counts an assertion to any type that holds a
// `Multiple` (`{ ...state, multippel } as AnalysisState`). It also refuses
// `parse` or `parseSegments` on a literal URL that names `multippel=`.
// Probes show each bypass is caught.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { enclosingFunction, relative, resolved, srcFiles, srcProgram } from './src-program.ts';

const URL_MODULE = 'src/url/analysis-state.ts';
const FIELD = 'src/components/analysis/multiple-field.tsx';

/** Whether `symbol` is the URL module's export `name`. */
function isUrlExport(symbol: ts.Symbol | undefined, name: string): boolean {
  if (symbol === undefined || symbol.name !== name) return false;
  return (symbol.declarations ?? []).some((declaration) => relative(declaration.getSourceFile().fileName) === URL_MODULE);
}

/** Whether `type` is the branded Multiple. */
function isMultiple(type: ts.Type): boolean {
  if (type.aliasSymbol?.name === 'Multiple') return true;
  return type.getProperties().some((property) => String(property.escapedName).startsWith('__@MULTIPLE'));
}

/** Whether `type` is, or holds as a property (two levels deep), a Multiple. */
function holdsMultiple(checker: ts.TypeChecker, type: ts.Type, depth = 0): boolean {
  if (type.isUnion() || type.isIntersection()) {
    if (type.isIntersection() && isMultiple(type)) return true;
    return type.types.some((member) => holdsMultiple(checker, member, depth));
  }
  if (isMultiple(type)) return true;
  if (depth >= 2 || !(type.flags & ts.TypeFlags.Object) || type.getSymbol()?.name === 'Decimal') return false;
  return type.getProperties().some((property) => holdsMultiple(checker, checker.getTypeOfSymbol(property), depth + 1));
}

/** A literal, or an expression whose type is a literal (a `const` bound to one). */
function isLiteral(checker: ts.TypeChecker, node: ts.Expression): boolean {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) return true;
  const type = checker.getTypeAtLocation(node);
  return type.isStringLiteral() || type.isNumberLiteral();
}

type Findings = {
  /** Every type assertion to a type that holds a Multiple, as "file: function". */
  readonly casts: string[];
  /** Every use of parseMultippel, parse or parseSegments that could make a multiple Peerless chose. */
  readonly misuse: string[];
};

function scan(program: ts.Program): Findings {
  const checker = program.getTypeChecker();
  const casts: string[] = [];
  const misuse: string[] = [];
  for (const source of srcFiles(program)) {
    const file = relative(source.fileName);
    const visit = (node: ts.Node): void => {
      const where = `${file}: ${enclosingFunction(node) ?? '(module)'}`;
      if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && !ts.isConstTypeReference(node.type)) {
        if (holdsMultiple(checker, checker.getTypeFromTypeNode(node.type))) casts.push(where);
      }
      if (ts.isIdentifier(node) && isUrlExport(resolved(checker, node), 'parseMultippel')) {
        const parent = node.parent;
        const declaration = ts.isFunctionDeclaration(parent) && parent.name === node;
        const specifier = ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent);
        if (!declaration && !specifier) {
          const callee = ts.isPropertyAccessExpression(parent) && parent.name === node ? parent : node;
          const call = callee.parent;
          if (!ts.isCallExpression(call) || call.expression !== callee) {
            misuse.push(`${where}: not a call`);
          } else {
            const fn = enclosingFunction(node);
            const allowed = (file === URL_MODULE && fn === 'parse') || (file === FIELD && fn === 'commit');
            if (!allowed) misuse.push(`${where}: not parse or the field's commit`);
            const argument = call.arguments[0];
            if (argument === undefined || isLiteral(checker, argument)) misuse.push(`${where}: on a literal`);
          }
        }
      }
      if (ts.isCallExpression(node)) {
        const symbol = resolved(checker, ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression);
        if (isUrlExport(symbol, 'parse') || isUrlExport(symbol, 'parseSegments')) {
          for (const argument of node.arguments) {
            const type = checker.getTypeAtLocation(argument);
            const text = type.isStringLiteral() ? type.value : argument.getText(source);
            if (text.includes('multippel=')) misuse.push(`${where}: ${symbol?.name} on a literal multippel`);
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
  it('src/ asserts a Multiple once, in parseMultippel, and calls parseMultippel only from parse and the field', () => {
    const program = srcProgram();
    // The fixture's state: the URL module and the field are scanned.
    const files = srcFiles(program).map((source) => relative(source.fileName));
    expect(files).toContain(URL_MODULE);
    expect(files).toContain(FIELD);
    const { casts, misuse } = scan(program);
    expect(casts).toEqual([`${URL_MODULE}: parseMultippel`]);
    expect(misuse).toEqual([]);
  });

  it('fails on every bypass: a cast, an aliased import, a literal through a const, a helper, parse on a literal, a state cast', () => {
    const program = srcProgram({
      'src/analysis/probe-cast.ts': [
        "import type { Multiple } from '../engine/closable.ts';",
        "import { Decimal } from '../engine/decimal.ts';",
        "export const suggested = new Decimal('6') as Multiple;",
      ].join('\n'),
      'src/analysis/probe-alias.ts': [
        "import { parseMultippel as pm } from '../url/analysis-state.ts';",
        'export function guess(text: string) {',
        '  return pm(text);',
        '}',
      ].join('\n'),
      'src/analysis/probe-parse.ts': [
        "import { parse, parseSegments } from '../url/analysis-state.ts';",
        'const context = { isCandidate: () => true, medianStepExists: () => false };',
        "const URL_WITH = '/analyse/813235552?multippel=6';",
        'export function viaParse() {',
        "  return parse('/analyse/813235552?multippel=6', context);",
        '}',
        'export function viaConst() {',
        '  return parse(URL_WITH, context);',
        '}',
        'export function viaSegments() {',
        "  return parseSegments({ orgnr: '813235552' }, 'multippel=6', context);",
        '}',
      ].join('\n'),
      'src/analysis/probe-state.ts': [
        "import { Decimal } from '../engine/decimal.ts';",
        "import { defaultState, type AnalysisState } from '../url/analysis-state.ts';",
        'export function withSix(): AnalysisState {',
        "  return { ...defaultState('813235552'), multippel: new Decimal(6) } as AnalysisState;",
        '}',
      ].join('\n'),
      [FIELD]: [
        "import { parseMultippel } from '@/url/analysis-state';",
        "const SIX = '6';",
        'export function commit() {',
        "  return [parseMultippel('6'), parseMultippel(SIX)];",
        '}',
        'export function helper(text: string) {',
        '  return parseMultippel(text);',
        '}',
      ].join('\n'),
    });
    const { casts, misuse } = scan(program);
    expect(casts.sort()).toEqual(
      [`${URL_MODULE}: parseMultippel`, 'src/analysis/probe-cast.ts: (module)', 'src/analysis/probe-state.ts: withSix'].sort(),
    );
    expect(misuse.sort()).toEqual(
      [
        "src/analysis/probe-alias.ts: guess: not parse or the field's commit",
        'src/analysis/probe-parse.ts: viaParse: parse on a literal multippel',
        'src/analysis/probe-parse.ts: viaConst: parse on a literal multippel',
        'src/analysis/probe-parse.ts: viaSegments: parseSegments on a literal multippel',
        `${FIELD}: commit: on a literal`,
        `${FIELD}: commit: on a literal`,
        `${FIELD}: helper: not parse or the field's commit`,
      ].sort(),
    );
  });
});
