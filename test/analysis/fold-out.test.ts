// The fold-out (Story 3.2, decision 1; EXPERIENCE.md "Fold-out"): an `h3`
// whose button carries aria-expanded and aria-controls, an aria-hidden
// caret, and a body that is hidden until opened, on surface-foldout,
// indented 30 px on the desktop and 16 px on the phone. Rendered on the
// server; e2e/key-figures.spec.ts drives Enter and Space in a browser.
import { createElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FoldOut } from '../../src/components/analysis/fold-out.tsx';

describe('the fold-out', () => {
  it('closed by default, wired by id', () => {
    const html = renderToString(
      createElement(
        FoldOut as (props: { readonly bodyId: string; readonly heading: string; readonly children?: ReactNode }) => ReactNode,
        { bodyId: 'fold-1', heading: 'Margin eller kapitalbruk?' },
        createElement('p', null, 'Innhold'),
      ),
    );
    // h3 > button, closed, controlling the body by its id; the caret is aria-hidden.
    expect(html).toMatch(
      /^<h3[^>]*><button type="button" aria-expanded="false" aria-controls="fold-1"[^>]*><span aria-hidden="true"[^>]*>▸<\/span><span[^>]*>Margin eller kapitalbruk\?<\/span><\/button><\/h3>/,
    );
    // The body: hidden, on surface-foldout, indented 16 px (pl-4) below md and 30 px from md.
    const body = /<div id="fold-1"([^>]*)>([\s\S]*)<\/div>$/.exec(html);
    expect(body).not.toBeNull();
    const attributes = body?.[1] ?? '';
    expect(attributes).toContain('hidden=""');
    expect(attributes).toMatch(/class="[^"]*\bbg-surface-foldout\b/);
    expect(attributes).toMatch(/class="[^"]*\bpl-4\b/);
    expect(attributes).toMatch(/class="[^"]*\bmd:pl-\[30px\]/);
    expect(body?.[2]).toBe('<p>Innhold</p>');
    // Inline, never a dialog.
    expect(html).not.toMatch(/role="dialog"|<dialog/);
  });
});
