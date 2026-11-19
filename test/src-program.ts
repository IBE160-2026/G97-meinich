// A TypeScript program over every TypeScript file under src/, with the
// project's compiler options (tsconfig.json, so `@/` resolves), for tests
// that need the type checker: which symbol a call resolves to through an
// aliased import, what type an expression has (Stories 3.6: no source of a
// multiple, one URL writer). `extra` adds or replaces files in memory, by
// repository-relative path, for the tests' probes.
import path from 'node:path';
import ts from 'typescript';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

export const ROOT = path.resolve(import.meta.dirname, '..');

/** A repository-relative path with forward slashes, as the tests name files. */
export function relative(fileName: string): string {
  return path.relative(ROOT, fileName).split(path.sep).join('/');
}

export function srcProgram(extra: Readonly<Record<string, string>> = {}): ts.Program {
  const config = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), (file) => ts.sys.readFile(file));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true, incremental: false, plugins: [] };
  const virtual = new Map(Object.entries(extra).map(([file, text]) => [path.normalize(path.join(ROOT, file)), text]));
  const host = ts.createCompilerHost(options, true);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, version, onError, shouldCreate) => {
    const text = virtual.get(path.normalize(fileName));
    return text !== undefined ? ts.createSourceFile(fileName, text, version, true) : getSourceFile(fileName, version, onError, shouldCreate);
  };
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) => virtual.has(path.normalize(fileName)) || fileExists(fileName);
  const files = listRepositoryFiles(ROOT)
    .filter((file) => file.startsWith('src/') && /\.tsx?$/.test(file))
    .map((file) => path.normalize(path.join(ROOT, file)));
  const roots = [...new Set([...files, ...virtual.keys()])];
  return ts.createProgram(roots, options, host);
}

/** The source files of `program` under src/. */
export function srcFiles(program: ts.Program): ts.SourceFile[] {
  return program.getSourceFiles().filter((source) => relative(source.fileName).startsWith('src/'));
}

/** The symbol `node` names, followed through import aliases. */
export function resolved(checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined {
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol;
}

/** The name of the function, method or variable a node sits in, or null at module level. */
export function enclosing(node: ts.Node): string | null {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if ((ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) && current.name !== undefined && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
  }
  return null;
}

/**
 * The name of the function a node sits in: a function declaration or method, or a function
 * expression or arrow function held by a variable; null at module level.
 */
export function enclosingFunction(node: ts.Node): string | null {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if ((ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) && current.name !== undefined && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
      return current.parent.name.text;
    }
  }
  return null;
}
