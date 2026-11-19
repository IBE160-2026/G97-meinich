// One URL writer (Story 3.6, decision 4; AD-5, AD-6): the share and the
// multiple are written by `replaceSettings` of the one URL hook
// (src/components/analysis/analysis-url.tsx), the only
// `history.replaceState` in `src/`, and nothing calls `router.replace`. The
// scan reads every TypeScript file under src/ with the compiler's parser,
// so the comments that name `replaceState` are not counted; a probe shows
// it fails on a second call.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const HOOK = 'src/components/analysis/analysis-url.tsx';

type Source = { readonly file: string; readonly text: string };

function sources(): Source[] {
  return listRepositoryFiles(root)
    .filter((file) => file.startsWith('src/') && /\.tsx?$/.test(file))
    .map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));
}

/** The name of the variable or function a node sits in, or null at module level. */
function enclosing(node: ts.Node): string | null {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name !== undefined) return current.name.text;
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
  }
  return null;
}

/** Every `replaceState` (as a property or a string) and every `router.replace`, as "file: where". */
function writers(files: readonly Source[]): { readonly replaceState: string[]; readonly routerReplace: string[] } {
  const replaceState: string[] = [];
  const routerReplace: string[] = [];
  for (const { file, text } of files) {
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, kind);
    const visit = (node: ts.Node): void => {
      const where = `${file}: ${enclosing(node) ?? '(module)'}`;
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'replaceState') replaceState.push(where);
      if (ts.isStringLiteralLike(node) && node.text === 'replaceState') replaceState.push(where);
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'replace' && /router/i.test(node.expression.getText(source))) {
        routerReplace.push(where);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { replaceState, routerReplace };
}

describe('one URL writer', () => {
  const files = sources();

  it('exactly one history.replaceState in src/, in replaceSettings, and no router.replace', () => {
    // The fixture's state: the hook is scanned.
    expect(files.map((source) => source.file)).toContain(HOOK);
    const found = writers(files);
    expect(found.replaceState).toEqual([`${HOOK}: replaceSettings`]);
    expect(found.routerReplace).toEqual([]);
  });

  it('fails on a second replaceState and on router.replace', () => {
    const probe: Source = {
      file: 'src/components/analysis/probe-writer.tsx',
      text: [
        "'use client';",
        "import { useRouter } from 'next/navigation';",
        'export function useSecondWriter() {',
        '  const router = useRouter();',
        "  const write = (href: string) => window.history['replaceState'](null, '', href);",
        "  const alsoWrite = (href: string) => window.history.replaceState(null, '', href);",
        '  return { write, alsoWrite, replace: (href: string) => router.replace(href) };',
        '}',
      ].join('\n'),
    };
    const found = writers([...files, probe]);
    expect(found.replaceState).toEqual([
      `${HOOK}: replaceSettings`,
      'src/components/analysis/probe-writer.tsx: write',
      'src/components/analysis/probe-writer.tsx: alsoWrite',
    ]);
    expect(found.routerReplace).toEqual(['src/components/analysis/probe-writer.tsx: useSecondWriter']);
  });
});
