// One URL writer (Story 3.6, decision 4; AD-5, AD-6): the share and the
// multiple are written by `replaceSettings` of the one URL hook
// (src/components/analysis/analysis-url.tsx), the only
// `history.replaceState` in `src/`, and nothing calls `replace` on the
// Next.js app router. The scan uses the type checker over every TypeScript
// file under src/ (test/src-program.ts): every reference to
// `History.replaceState` (a property access, an element access, a
// destructured binding), whatever the receiver is called, and every
// `replace` on a value whose type is the app router, whatever it is called.
// Comments are not counted. Probes show each form is caught.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { enclosing, relative, srcFiles, srcProgram } from './src-program.ts';

const HOOK = 'src/components/analysis/analysis-url.tsx';

function typeNamed(type: ts.Type, name: string): boolean {
  if (type.isUnion()) return type.types.some((member) => typeNamed(member, name));
  return type.getSymbol()?.name === name || type.aliasSymbol?.name === name;
}

/** The receiver and the property name of a property access, an element access or a destructured binding. */
function access(checker: ts.TypeChecker, node: ts.Node): { readonly receiver: ts.Type; readonly name: string } | null {
  if (ts.isPropertyAccessExpression(node)) return { receiver: checker.getTypeAtLocation(node.expression), name: node.name.text };
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    return { receiver: checker.getTypeAtLocation(node.expression), name: node.argumentExpression.text };
  }
  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
    const key = node.propertyName ?? node.name;
    if (!ts.isIdentifier(key) && !ts.isStringLiteral(key)) return null;
    return { receiver: checker.getTypeAtLocation(node.parent), name: key.text };
  }
  return null;
}

function writers(program: ts.Program): { readonly replaceState: string[]; readonly routerReplace: string[] } {
  const checker = program.getTypeChecker();
  const replaceState: string[] = [];
  const routerReplace: string[] = [];
  for (const source of srcFiles(program)) {
    const file = relative(source.fileName);
    const visit = (node: ts.Node): void => {
      const found = access(checker, node);
      if (found !== null) {
        const where = `${file}: ${enclosing(node) ?? '(module)'}`;
        if (found.name === 'replaceState' && typeNamed(found.receiver, 'History')) replaceState.push(where);
        if (found.name === 'replace' && typeNamed(found.receiver, 'AppRouterInstance')) routerReplace.push(where);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { replaceState, routerReplace };
}

describe('one URL writer', () => {
  it('exactly one history.replaceState in src/, in replaceSettings, and no replace on the app router', () => {
    const program = srcProgram();
    // The fixture's state: the hook is scanned.
    expect(srcFiles(program).map((source) => relative(source.fileName))).toContain(HOOK);
    const found = writers(program);
    expect(found.replaceState).toEqual([`${HOOK}: replaceSettings`]);
    expect(found.routerReplace).toEqual([]);
  });

  it('fails on a second replaceState in any form and on replace on a router of any name', () => {
    const probe = 'src/components/analysis/probe-writer.tsx';
    const program = srcProgram({
      [probe]: [
        "'use client';",
        "import { useRouter } from 'next/navigation';",
        'export function useSecondWriter() {',
        '  const nav = useRouter();',
        '  const h = window.history;',
        "  const byElement = (href: string) => window.history['replaceState'](null, '', href);",
        "  const byAlias = (href: string) => h.replaceState(null, '', href);",
        '  const { replaceState } = window.history;',
        '  const { replace } = useRouter();',
        '  const byNav = (href: string) => nav.replace(href);',
        '  return { byElement, byAlias, replaceState, replace, byNav };',
        '}',
      ].join('\n'),
    });
    const found = writers(program);
    expect(found.replaceState).toEqual([
      `${HOOK}: replaceSettings`,
      `${probe}: byElement`,
      `${probe}: byAlias`,
      `${probe}: useSecondWriter`,
    ]);
    expect(found.routerReplace).toEqual([`${probe}: useSecondWriter`, `${probe}: byNav`]);
  });
});
