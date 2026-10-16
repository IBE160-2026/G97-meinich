// The search field's server-rendered markup, both variants (Story 1.5b).
// The compact variant is mounted in the header by Story 1.6b; its behaviour
// there is tested in e2e/analysis.spec.ts, the hero's in e2e/search.spec.ts.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import nb from '../src/messages/nb.json' with { type: 'json' };

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/' }));

const { SearchField, SearchAlert, searchOutcome } = await import('../src/components/search-field.tsx');
const { SEARCH_ENDPOINT } = await import('../src/search-contract.ts');

function render(variant: 'hero' | 'compact', extra: object = {}): string {
  return renderToStaticMarkup(createElement(SearchField, { variant, coverage: 'x (00.000)', ...extra }));
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
  });

  it(variant === 'compact' ? 'has the label as placeholder, besides the label' : 'has no placeholder', () => {
    if (variant === 'compact') expect(html).toMatch(new RegExp(`<input[^>]*placeholder="${nb['search.label']}"`));
    else expect(html).not.toMatch(/placeholder=/);
  });

  it('can start with a value and a validation message in the error state', () => {
    const invalid = render(variant, { initialValue: '12345678', initialError: 'search.orgnrLength' });
    expect(invalid).toMatch(/<input[^>]*aria-invalid="true"/);
    const describedBy = /<input[^>]*aria-describedby="([^"]+)"/.exec(invalid)?.[1];
    expect(invalid).toContain(`<p id="${describedBy}"`);
    expect(invalid).toContain(nb['search.orgnrLength']);
    expect(invalid).toMatch(/<input[^>]*value="12345678"/);
    expect(html).not.toMatch(/aria-invalid/);
  });

  it('has the polite live region and the alert, present and empty', () => {
    expect(html).toMatch(/<div role="status"[^>]*><\/div>/);
    expect(html).toMatch(/<div role="alert"[^>]*><\/div>/);
  });

  it('has the submit button "Sammenlign"', () => {
    const button = /<button type="submit"[^>]*>(.*)<\/button>/.exec(html)?.[1] ?? '';
    // The button's name is its text; the compact variant's magnifier is aria-hidden.
    expect(button.replace(/<svg.*<\/svg>/, '').replace(/<[^>]+>/g, '')).toBe(nb['search.submit']);
    if (variant === 'compact') expect(button).toMatch(/<svg aria-hidden="true"/);
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

describe('a refused search (Story 1.10)', () => {
  const alert = (failure: 'failed' | 'refused' | null) => renderToStaticMarkup(createElement(SearchAlert, { failure }));

  it('reads a 429 as refused, any other failure as failed', async () => {
    expect(await searchOutcome(new Response('{}', { status: 429 }))).toBe('refused');
    expect(await searchOutcome(new Response('{}', { status: 500 }))).toBe('failed');
    expect(await searchOutcome(new Response('{}', { status: 200 }))).toBe('failed');
    expect(await searchOutcome(Response.json([]))).toEqual([]);
  });

  it('shows the rate-limit refusal in the alert instead of the generic failure, and no results', () => {
    expect(alert('refused')).toBe(`<div role="alert" class="text-[14px]"><p class="m-0 mt-2.5">${nb['rateLimit.refused']}</p></div>`);
    expect(alert('failed')).toContain(nb['search.failed']);
    expect(alert(null)).toBe('<div role="alert" class="text-[14px]"></div>');
  });
});
