// No double counting (Story 3.3; FR-30; `docs/key-figures.md`, "From gap to
// kroner", "Two amounts that must never be added"). Owned by Story 3.3 and
// inherited by Stories 3.4 and 3.5, which register every amount function they
// add in src/engine/amounts.ts.
//
// The registry test finds the engine's amount functions itself (decision 7):
// it builds a TypeScript program over src/engine, takes every exported
// function, and calls it an amount function when its return type holds, at
// any depth, a property named `ore`/`…Ore` that is a Decimal or a Fraction,
// or one named `kroner`/`…Kroner`. Each must be classified in
// AMOUNT_FUNCTIONS. A function classified as a total must not reference,
// directly or through any engine function it calls, a declaration of
// src/engine/waterfall.ts, a function classified as an explanation, a cost
// share's key (`vare`, `lonn`, `andre`) or operating asset turnover's
// (`oml`). The same checks run on a probe module added to the program, to
// show that they fail on an unregistered amount function and on a total that
// takes a waterfall bar.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { AMOUNT_FUNCTIONS, type AmountEntry } from '../../src/engine/amounts.ts';
import {
  benchmarkDocumentFigures,
  type CapitalGap,
  workingCapitalReleased,
} from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { readBasis, TEN_PEERS } from '../analysis/document-fixture.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ENGINE = path.join(ROOT, 'src', 'engine');
const WATERFALL = path.join(ENGINE, 'waterfall.ts');

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  resolveJsonModule: true,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
};

function engineFiles(): string[] {
  return readdirSync(ENGINE)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))
    .map((name) => path.join(ENGINE, name));
}

/** A program over src/engine, with `extra` in-memory modules added under src/engine. */
function program(extra: Readonly<Record<string, string>> = {}): ts.Program {
  const host = ts.createCompilerHost(OPTIONS, true);
  const virtual = new Map(Object.entries(extra).map(([name, text]) => [path.normalize(path.join(ENGINE, name)), text]));
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, version, onError, shouldCreate) => {
    const text = virtual.get(path.normalize(fileName));
    return text !== undefined ? ts.createSourceFile(fileName, text, version) : getSourceFile(fileName, version, onError, shouldCreate);
  };
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) => virtual.has(path.normalize(fileName)) || fileExists(fileName);
  return ts.createProgram([...engineFiles(), ...virtual.keys()], OPTIONS, host);
}

const AMOUNT_VALUE_TYPES: ReadonlySet<string> = new Set(['Decimal', 'Fraction']);

function typeName(type: ts.Type): string | undefined {
  return type.aliasSymbol?.name ?? type.getSymbol()?.name;
}

/** Whether `type` holds, at any depth, an amount property. */
function holdsAmount(checker: ts.TypeChecker, root: ts.Type): boolean {
  const seen = new Set<ts.Type>();
  const isAmountValue = (type: ts.Type, kroner: boolean): boolean => {
    if (type.isUnion()) return type.types.some((member) => isAmountValue(member, kroner));
    if (checker.isArrayType(type)) return checker.getTypeArguments(type as ts.TypeReference).some((t) => isAmountValue(t, kroner));
    const name = typeName(type);
    if (name !== undefined && AMOUNT_VALUE_TYPES.has(name)) return true;
    return kroner && (type.flags & ts.TypeFlags.BigIntLike) !== 0;
  };
  const visit = (type: ts.Type): boolean => {
    if (seen.has(type)) return false;
    seen.add(type);
    if (type.isUnion() || type.isIntersection()) return type.types.some(visit);
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
      return checker.getTypeArguments(type as ts.TypeReference).some(visit);
    }
    const name = typeName(type);
    // A Decimal or a Fraction is a value, not a record of amounts.
    if (name !== undefined && AMOUNT_VALUE_TYPES.has(name)) return false;
    if (!(type.flags & ts.TypeFlags.Object) || type.getCallSignatures().length > 0) return false;
    for (const property of checker.getPropertiesOfType(type)) {
      // A mapped type's properties (Readonly<Record<…>>) have no declaration.
      const propertyType = checker.getTypeOfSymbol(property);
      const key = property.name;
      if ((key === 'ore' || key.endsWith('Ore')) && isAmountValue(propertyType, false)) return true;
      if ((key === 'kroner' || key.endsWith('Kroner')) && isAmountValue(propertyType, true)) return true;
      if (visit(propertyType)) return true;
    }
    return false;
  };
  return visit(root);
}

type ExportedFunction = { readonly name: string; readonly file: string; readonly node: ts.Node; readonly returns: ts.Type };

/** Every function exported from a module under src/engine, with its return type. */
function exportedFunctions(prog: ts.Program): ExportedFunction[] {
  const checker = prog.getTypeChecker();
  const out: ExportedFunction[] = [];
  for (const source of prog.getSourceFiles()) {
    if (path.dirname(path.normalize(source.fileName)) !== path.normalize(ENGINE)) continue;
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (moduleSymbol === undefined) continue;
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const declaration = symbol.valueDeclaration;
      if (declaration === undefined || declaration.getSourceFile() !== source) continue;
      let node: ts.Node | undefined;
      if (ts.isFunctionDeclaration(declaration)) node = declaration;
      else if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
      ) {
        node = declaration.initializer;
      }
      if (node === undefined) continue;
      const signatures = checker.getTypeOfSymbolAtLocation(symbol, declaration).getCallSignatures();
      for (const signature of signatures) {
        out.push({ name: symbol.name, file: path.basename(source.fileName), node, returns: signature.getReturnType() });
      }
    }
  }
  return out;
}

/** The engine's amount functions, by name, with the module that exports each. */
function amountFunctions(prog: ts.Program): Map<string, string> {
  const checker = prog.getTypeChecker();
  const found = new Map<string, string>();
  for (const fn of exportedFunctions(prog)) {
    if (holdsAmount(checker, fn.returns)) found.set(fn.name, fn.file);
  }
  return found;
}

/** Each amount function not in `registry`, or in it under another module. */
function unregistered(prog: ts.Program, registry: Readonly<Record<string, AmountEntry>>): string[] {
  return [...amountFunctions(prog)]
    .filter(([name, file]) => registry[name]?.module !== file)
    .map(([name, file]) => `${file}: ${name}`);
}

/** The function a declaration declares, exported or not: a function declaration, or a variable holding a function. */
function functionBody(declaration: ts.Declaration): ts.Node | undefined {
  if (ts.isFunctionDeclaration(declaration) && declaration.body !== undefined) return declaration;
  if (
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer !== undefined &&
    (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
  ) {
    return declaration.initializer;
  }
  return undefined;
}

/** The keys a total may never name: the three cost shares (no kroner of their own) and 11 (never added to 9 or 10). */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['vare', 'lonn', 'andre', 'oml']);

/**
 * What a total references that it must not, through every engine function
 * it calls: a declaration of waterfall.ts, an `explanation` function, or a
 * forbidden key as a string or a property name.
 */
function forbiddenInTotals(prog: ts.Program, registry: Readonly<Record<string, AmountEntry>>): string[] {
  const checker = prog.getTypeChecker();
  const functions = new Map(exportedFunctions(prog).map((fn) => [fn.name, fn]));
  const explanations = new Set(Object.entries(registry).filter(([, e]) => e.role === 'explanation').map(([name]) => name));
  const found: string[] = [];
  for (const [name, entry] of Object.entries(registry)) {
    if (entry.role !== 'total') continue;
    const total = functions.get(name);
    if (total === undefined) {
      found.push(`${name}: registered as a total but not exported from src/engine`);
      continue;
    }
    const visited = new Set<ts.Node>();
    const walk = (node: ts.Node, via: string): void => {
      if (visited.has(node)) return;
      visited.add(node);
      const visit = (child: ts.Node): void => {
        if (ts.isStringLiteralLike(child) && FORBIDDEN_KEYS.has(child.text)) found.push(`${name}${via}: '${child.text}'`);
        if (ts.isIdentifier(child)) {
          if (FORBIDDEN_KEYS.has(child.text)) found.push(`${name}${via}: ${child.text}`);
          let symbol = checker.getSymbolAtLocation(child);
          if (symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
          for (const declaration of symbol?.declarations ?? []) {
            const file = path.normalize(declaration.getSourceFile().fileName);
            if (file === path.normalize(WATERFALL)) found.push(`${name}${via}: ${child.text} (waterfall.ts)`);
            if (explanations.has(child.text)) found.push(`${name}${via}: ${child.text} (an explanation)`);
            // Follow a reference into any function under src/engine, exported or module-private.
            const callee = functionBody(declaration);
            if (callee !== undefined && callee !== node && path.dirname(file) === path.normalize(ENGINE)) {
              walk(callee, `${via} → ${symbol?.name}`);
            }
          }
        }
        ts.forEachChild(child, visit);
      };
      ts.forEachChild(node, visit);
    };
    walk(total.node, '');
  }
  return [...new Set(found)];
}

/** The one sum a choice may make, through the total that makes it (Story 3.4, decision 1). */
const CHOICE_MAY_CALL: ReadonlySet<string> = new Set(['workingCapitalReleased']);

/**
 * Every `.plus` or `.add` a choice makes, directly or through any engine
 * function it calls (exported or module-private), except through
 * `workingCapitalReleased` (Story 3.4, decision 1: a choice compares amounts
 * and sums nothing; its only sum is working capital's own).
 */
function sumsInChoices(prog: ts.Program, registry: Readonly<Record<string, AmountEntry>>): string[] {
  const checker = prog.getTypeChecker();
  const functions = new Map(exportedFunctions(prog).map((fn) => [fn.name, fn]));
  const found: string[] = [];
  for (const [name, entry] of Object.entries(registry)) {
    if (entry.role !== 'choice') continue;
    const choice = functions.get(name);
    if (choice === undefined) {
      found.push(`${name}: registered as a choice but not exported from src/engine`);
      continue;
    }
    const visited = new Set<ts.Node>();
    const walk = (node: ts.Node, via: string): void => {
      if (visited.has(node)) return;
      visited.add(node);
      const visit = (child: ts.Node): void => {
        if (ts.isPropertyAccessExpression(child) && (child.name.text === 'plus' || child.name.text === 'add')) {
          found.push(`${name}${via}: .${child.name.text}`);
        }
        if (ts.isIdentifier(child) && !CHOICE_MAY_CALL.has(child.text)) {
          let symbol = checker.getSymbolAtLocation(child);
          if (symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
          for (const declaration of symbol?.declarations ?? []) {
            const file = path.normalize(declaration.getSourceFile().fileName);
            const callee = functionBody(declaration);
            if (callee !== undefined && callee !== node && path.dirname(file) === path.normalize(ENGINE)) {
              walk(callee, `${via} → ${symbol?.name}`);
            }
          }
        }
        ts.forEachChild(child, visit);
      };
      ts.forEachChild(node, visit);
    };
    walk(choice.node, '');
  }
  return [...new Set(found)];
}

const ENGINE_PROGRAM = program();

// A probe module: an amount function nobody registered, and a total that adds a waterfall bar.
const PROBE = {
  'probe-amounts.ts': [
    "import type { KronerGap } from './benchmark.ts';",
    "import { Decimal } from './decimal.ts';",
    "import { marginWaterfall } from './waterfall.ts';",
    "import type { DocumentBasis } from './document-inputs.ts';",
    "export function unregisteredGap(): KronerGap { return { kind: 'amount', ore: new Decimal(1) }; }",
    'export function upliftWithBars(subject: DocumentBasis, peers: readonly DocumentBasis[]): { readonly ore: Decimal } {',
    "  const w = marginWaterfall(subject, peers, 2025, 'NOK');",
    "  return { ore: w.kind === 'decomposition' ? new Decimal(w.display.totalKroner.toString()) : new Decimal(0) };",
    '}',
  ].join('\n'),
};
const PROBE_REGISTRY: Readonly<Record<string, AmountEntry>> = {
  ...AMOUNT_FUNCTIONS,
  upliftWithBars: { module: 'probe-amounts.ts', role: 'total' },
};

describe('the FR-30 registry', () => {
  it('every amount function is registered', () => {
    expect(unregistered(ENGINE_PROGRAM, AMOUNT_FUNCTIONS)).toEqual([]);
    // The compiler finds the registered ones: none is stale.
    expect([...amountFunctions(ENGINE_PROGRAM).keys()].sort()).toEqual(Object.keys(AMOUNT_FUNCTIONS).sort());
  });

  it('a total reaching a bar through a module-private helper is caught', () => {
    const probe = program({
      'probe-private.ts': [
        "import { Decimal } from './decimal.ts';",
        "import type { DocumentBasis } from './document-inputs.ts';",
        "import { marginWaterfall } from './waterfall.ts';",
        'function hidden(subject: DocumentBasis, peers: readonly DocumentBasis[]): bigint {',
        "  const w = marginWaterfall(subject, peers, 2025, 'NOK');",
        "  return w.kind === 'decomposition' ? w.display.totalKroner : 0n;",
        '}',
        'const alsoHidden = (subject: DocumentBasis, peers: readonly DocumentBasis[]): bigint => hidden(subject, peers);',
        'export function upliftThroughHelper(subject: DocumentBasis, peers: readonly DocumentBasis[]): { readonly ore: Decimal } {',
        '  return { ore: new Decimal(alsoHidden(subject, peers).toString()) };',
        '}',
      ].join('\n'),
    });
    const registry = { ...AMOUNT_FUNCTIONS, upliftThroughHelper: { module: 'probe-private.ts', role: 'total' } } as const;
    expect(forbiddenInTotals(probe, registry)).toEqual(
      expect.arrayContaining(['upliftThroughHelper → alsoHidden → hidden: marginWaterfall (waterfall.ts)']),
    );
  });

  it('every amount function is registered: fails on an unregistered new function and on a total referencing a bar', () => {
    const probe = program(PROBE);
    expect(unregistered(probe, PROBE_REGISTRY)).toEqual(['probe-amounts.ts: unregisteredGap']);
    expect(forbiddenInTotals(probe, PROBE_REGISTRY)).toEqual(
      expect.arrayContaining(['upliftWithBars: marginWaterfall (waterfall.ts)', 'upliftWithBars: marginWaterfall (an explanation)']),
    );
  });
});

describe('cluster 1: cost shares and the waterfall', () => {
  it('cluster 1: no total references a waterfall bar, an explanation or a cost share', () => {
    expect(forbiddenInTotals(ENGINE_PROGRAM, AMOUNT_FUNCTIONS)).toEqual([]);
    // The waterfall's functions are explanations, never gaps or totals.
    expect(AMOUNT_FUNCTIONS.marginWaterfall.role).toBe('explanation');
    expect(AMOUNT_FUNCTIONS.displayWaterfall.role).toBe('explanation');
  });

  it('cluster 1: no cost share yields kroner, even worse than beste fjerdedel', () => {
    // The subject's cost shares are all above the peers' (worse: lower is better).
    const subject = readBasis({
      varekostnad: '300000000',
      lonnskostnad: '650000000',
      annenDriftskostnad: '100000000',
      avskrivninger: '0',
      sumDriftskostnad: '1050000000',
      driftsresultat: '-50000000',
    });
    const benchmark = benchmarkDocumentFigures(subject, TEN_PEERS, 'NOK');
    for (const key of ['vare', 'lonn', 'andre', 'total'] as const) {
      const figure = benchmark[key];
      expect(figure.comparison.kind, key).toBe('compared');
      expect(figure.gap, key).toEqual({ kind: 'none', reason: 'no_translation' });
    }
  });
});

describe('a choice', () => {
  it('a choice sums nothing', () => {
    // Fixture: the engine as built; largestCapitalGap is registered as the one choice.
    expect(AMOUNT_FUNCTIONS.largestCapitalGap.role).toBe('choice');
    expect(sumsInChoices(ENGINE_PROGRAM, AMOUNT_FUNCTIONS)).toEqual([]);
    // A choice is not a total: no total references it, and the totals' checks still hold.
    expect(forbiddenInTotals(ENGINE_PROGRAM, AMOUNT_FUNCTIONS)).toEqual([]);
    // The check sees a sum: a probe choice adding (11) to (9), directly and through a private helper, is caught.
    const probe = program({
      'probe-choice.ts': [
        "import type { CapitalGap } from './benchmark.ts';",
        "import { Decimal } from './decimal.ts';",
        'function both(a: CapitalGap, b: CapitalGap): Decimal | null {',
        "  return a.kind === 'amount' && b.kind === 'amount' ? a.ore.plus(b.ore) : null;",
        '}',
        'export function largestWithSum(kfd: CapitalGap, oml: CapitalGap): { readonly ore: Decimal | null } {',
        "  return { ore: kfd.kind === 'amount' && oml.kind === 'amount' ? kfd.ore.add(oml.ore) : null };",
        '}',
        'export function largestThroughHelper(kfd: CapitalGap, oml: CapitalGap): { readonly ore: Decimal | null } {',
        '  return { ore: both(kfd, oml) };',
        '}',
      ].join('\n'),
    });
    const registry = {
      ...AMOUNT_FUNCTIONS,
      largestWithSum: { module: 'probe-choice.ts', role: 'choice' },
      largestThroughHelper: { module: 'probe-choice.ts', role: 'choice' },
    } as const;
    expect(sumsInChoices(probe, registry)).toEqual(
      expect.arrayContaining(['largestWithSum: .add', 'largestThroughHelper → both: .plus']),
    );
  });
});

describe('cluster 2: working capital', () => {
  const amount = (ore: string): CapitalGap => ({ kind: 'amount', ore: new Decimal(ore), oneOff: true });

  it('cluster 2: working capital released is (9) + (10) only; a strength counts as 0; none without both clearing the floor in NOK', () => {
    const STRENGTH: CapitalGap = { kind: 'strength' };
    // Both amounts: their sum.
    expect(workingCapitalReleased(amount('1000.5'), amount('250.25'))).toEqual({ kind: 'amount', ore: new Decimal('1250.75'), oneOff: true });
    // Story 3.5, decision 1: one part a strength counts as 0, so the total is the other part's amount.
    expect(workingCapitalReleased(amount('1000.5'), STRENGTH)).toEqual({ kind: 'amount', ore: new Decimal('1000.5'), oneOff: true });
    expect(workingCapitalReleased(STRENGTH, amount('250.25'))).toEqual({ kind: 'amount', ore: new Decimal('250.25'), oneOff: true });
    // Both strengths: a strength, no kroner.
    expect(workingCapitalReleased(STRENGTH, STRENGTH)).toEqual({ kind: 'strength' });
    // A part below the floor, undefined or not in NOK: no total, whatever the other part is.
    for (const other of [
      { kind: 'not_nok' },
      { kind: 'none', reason: 'no_comparison' },
    ] as const satisfies readonly CapitalGap[]) {
      for (const partner of [amount('1'), STRENGTH]) {
        expect(workingCapitalReleased(partner, other)).toEqual({ kind: 'none' });
        expect(workingCapitalReleased(other, partner)).toEqual({ kind: 'none' });
      }
    }
  });

  it('cluster 2: (11) is never summed with (9), (10) or their total', () => {
    // No total names oml, the key of 11 (forbiddenInTotals checks it with the cost shares).
    const findings = forbiddenInTotals(ENGINE_PROGRAM, AMOUNT_FUNCTIONS);
    expect(findings.filter((finding) => finding.includes('oml'))).toEqual([]);
    // And the check sees it: a probe total adding 11 to working capital is caught.
    const probe = program({
      'probe-capital.ts': [
        "import { workingCapitalReleased, type CapitalGap } from './benchmark.ts';",
        "export function capitalTotal(gaps: Readonly<Record<'kfd' | 'lgd' | 'oml', CapitalGap>>) {",
        '  const wc = workingCapitalReleased(gaps.kfd, gaps.lgd);',
        "  const oml = gaps.oml;",
        "  return { ore: wc.kind === 'amount' && oml.kind === 'amount' ? wc.ore.plus(oml.ore) : null };",
        '}',
      ].join('\n'),
    });
    const registry = { ...AMOUNT_FUNCTIONS, capitalTotal: { module: 'probe-capital.ts', role: 'total' } } as const;
    expect(forbiddenInTotals(probe, registry)).toEqual(expect.arrayContaining(['capitalTotal: oml']));
  });
});
