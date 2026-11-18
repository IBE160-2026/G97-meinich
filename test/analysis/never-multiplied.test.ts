// The decomposition factors are never multiplied (Story 3.2, decision 7;
// docs/key-figures.md, "Decompositions"): the median driftsmargin × the
// median total asset turnover is not the median return on assets, and the
// subject's own product is totalkapitalrentabilitet, which its row shows.
// So nothing in `src/` may compute a product that involves a factor.
//
// The scan reads every TypeScript module under `src/` with the compiler's
// parser and finds each multiplication: `*`, `*=`, and calls of `.mul(`,
// `.times(` or `multiply(`. A multiplication involves a factor when
// - it sits in a module that is only about the factors
//   (`FACTOR_MODULES`: every multiplication there is one), or
// - the smallest function around it (or, outside any function, its
//   top-level statement) names a factor (`FACTOR_NAMES`).
// Only the decomposition factors are covered: the capital kroner of 9–11
// and every other legitimate product name no factor and are not caught.
// The one legitimate product of the factors, the identity ROA = margin ×
// turnover, is asserted in test/engine/identities.test.ts, outside `src/`.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'src');

/** The identifiers that name a decomposition factor, its benchmark or its view. */
const FACTOR_NAMES: ReadonlySet<string> = new Set([
  // The engine's exact factor and its benchmark (src/engine).
  'totalAssetTurnover',
  'benchmarkTotalAssetTurnover',
  'TurnoverBenchmark',
  'TOTAL_ASSET_TURNOVER_DIRECTION',
  'turnoverBenchmark',
  // The factor views (src/analysis/decomposition-view.ts) and their component.
  'decompositionView',
  'DecompositionView',
  'decompositions',
  'FactorView',
  'ComparedFactorView',
  'BelowFloorFactorView',
  'AbsentFactorView',
  'FactorPairView',
  'factorView',
  'payFactorView',
  'FactorPair',
]);

/** Modules about nothing but the factors: any multiplication in them involves one. */
const FACTOR_MODULES: readonly string[] = ['src/analysis/decomposition-view.ts', 'src/components/analysis/factor-pair.tsx'];

/**
 * Products of the factors that are allowed, each with its reason, as
 * `file:line`. Empty: no such product exists in `src/` (decision 7).
 */
const ALLOWED: Readonly<Record<string, string>> = {};

const MULTIPLY_METHODS: ReadonlySet<string> = new Set(['mul', 'times']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

function isMultiplication(node: ts.Node): boolean {
  if (ts.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind;
    return kind === ts.SyntaxKind.AsteriskToken || kind === ts.SyntaxKind.AsteriskEqualsToken;
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    if (ts.isPropertyAccessExpression(callee)) {
      return MULTIPLY_METHODS.has(callee.name.text) || callee.name.text === 'multiply';
    }
    return ts.isIdentifier(callee) && callee.text === 'multiply';
  }
  return false;
}

/** The smallest function around `node`, or its top-level statement. */
function scopeOf(node: ts.Node): ts.Node {
  let current: ts.Node = node;
  while (current.parent !== undefined && !ts.isSourceFile(current.parent)) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return current;
}

function namesAFactor(scope: ts.Node): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if ((ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) && FACTOR_NAMES.has(node.text)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  // A function's own name is part of its node, so `function factorView()` names a factor.
  return found;
}

/** Every multiplication in `src/` that involves a factor, as `file:line: text`. */
function factorProducts(files: readonly string[] = sourceFiles(SRC)): string[] {
  const found: string[] = [];
  for (const file of files) {
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const wholeModule = FACTOR_MODULES.includes(relative);
    const visit = (node: ts.Node): void => {
      if (isMultiplication(node) && (wholeModule || namesAFactor(scopeOf(node)))) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const at = `${relative}:${line}`;
        if (ALLOWED[at] === undefined) found.push(`${at}: ${node.getText(source)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

describe('the decomposition factors', () => {
  it('no product of factors is computed', () => {
    // The scan reads the modules it is meant to: each factor module exists and names a factor.
    for (const factorModule of FACTOR_MODULES) {
      expect(readFileSync(path.join(ROOT, factorModule), 'utf8'), factorModule).toMatch(/FactorView|decomposition/);
    }
    expect(readFileSync(path.join(SRC, 'engine/key-figures.ts'), 'utf8')).toContain('totalAssetTurnover');
    expect(factorProducts()).toEqual([]);
  });

  it('catches a product the way it is written, and leaves the capital kroner alone', () => {
    const probe = (code: string, name = 'src/analysis/probe.ts'): string[] => {
      const source = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true);
      const out: string[] = [];
      const visit = (node: ts.Node): void => {
        if (isMultiplication(node) && namesAFactor(scopeOf(node))) out.push(node.getText(source));
        ts.forEachChild(node, visit);
      };
      visit(source);
      return out;
    };
    expect(probe('function f(b: TurnoverBenchmark, m: Decimal) { return m.mul(b.comparison.median); }')).toHaveLength(1);
    expect(probe('const x = (a: number) => a * benchmarkTotalAssetTurnover(s, p).comparison.count;')).toHaveLength(1);
    expect(probe('function g(v: DecompositionView) { return multiply(v, 2); }')).toHaveLength(1);
    expect(probe('function h(x: Decimal, y: Decimal) { const d = x.times(y); return d; } function k(t: TurnoverBenchmark) { return t; }')).toEqual([]);
    // capitalGap's arithmetic names no factor.
    expect(probe('function capitalGap(target: Decimal, denominator: Decimal) { return target.mul(denominator); }')).toEqual([]);
  });
});
