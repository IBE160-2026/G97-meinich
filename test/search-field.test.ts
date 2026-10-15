// The search field's server-rendered markup, both variants (Story 1.5b).
// The compact variant is mounted in the header by Story 1.6b; no route may
// be added to render it in a browser now, so its markup is checked here and
// its behaviour, shared with the hero variant, in e2e/search.spec.ts.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import nb from '../src/messages/nb.json' with { type: 'json' };

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));

const { SearchField } = await import('../src/components/search-field.tsx');
const { SEARCH_ENDPOINT } = await import('../src/search-contract.ts');

function render(variant: 'hero' | 'compact'): string {
  return renderToStaticMarkup(createElement(SearchField, { variant, coverage: 'x (00.000)' }));
}

describe.each(['hero', 'compact'] as const)('SearchField, %s variant', (variant) => {
  const html = render(variant);

  it('labels the field "Navn eller organisasjonsnummer"', () => {
    const label = /<label id="([^"]+)" for="([^"]+)"[^>]*>([^<]*)<\/label>/.exec(html);
    expect(label?.[3]).toBe(nb['search.label']);
    expect(html).toMatch(new RegExp(`<input id="${label?.[2]}"`));
    // The listbox is named by the label, not by the typed value.
    expect(html).toMatch(new RegExp(`role="listbox" aria-labelledby="${label?.[1]}"`));
  });

  it('renders an ARIA 1.2 combobox, collapsed, controlling an empty listbox', () => {
    expect(html).toMatch(/<input[^>]*role="combobox"/);
    expect(html).toMatch(/<input[^>]*aria-expanded="false"/);
    const controls = /<input[^>]*aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(controls).toBeDefined();
    expect(html).toContain(`<ul id="${controls}" role="listbox"`);
    expect(html).toMatch(/<ul [^>]*hidden=""[^>]*><\/ul>/);
    expect(html).toMatch(/<input[^>]*maxLength="100"/);
    expect(html).not.toMatch(/placeholder=/);
  });

  it('has the polite live region and the alert, present and empty', () => {
    expect(html).toMatch(/<div role="status"[^>]*><\/div>/);
    expect(html).toMatch(/<div role="alert"[^>]*><\/div>/);
  });

  it('has the submit button "Sammenlign"', () => {
    expect(html).toMatch(new RegExp(`<button type="submit"[^>]*>.*${nb['search.submit']}</button>`));
  });

  it(`is marked as the ${variant} variant`, () => {
    expect(html).toContain(`data-variant="${variant}"`);
  });
});

describe('SearchField variants', () => {
  it('share the same form fields and the same endpoint', () => {
    const fields = (html: string) => [...html.matchAll(/ (name|role|type)="([^"]+)"/g)].map((m) => m[0]);
    expect(fields(render('compact'))).toEqual(fields(render('hero')));
    expect(SEARCH_ENDPOINT).toBe('/api/sok');
  });
});
