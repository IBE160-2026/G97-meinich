// The analysis loading and error states (Story 1.6b), server-rendered:
// loading sets aria-busy on main with Skeleton placeholders; an error is
// role="alert" "Noe gikk galt. Prøv igjen om litt." and nothing else.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import nb from '../src/messages/nb.json' with { type: 'json' };

const { AnalysisLoading } = await import('../src/components/analysis/analysis-loading.tsx');
const { default: AnalysisError } = await import('../src/app/analyse/error.tsx');
const { LookupError } = await import('../src/components/analysis/lookup-error.tsx');

describe('loading', () => {
  const html = renderToString(createElement(AnalysisLoading));

  it('marks main as busy', () => {
    expect(html).toMatch(/^<main[^>]*aria-busy="true"/);
  });

  it('shows Skeleton placeholders hidden from assistive technology, and no text', () => {
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('animate-pulse');
    expect(html.replace(/<[^>]+>/g, '')).toBe('');
  });
});

describe.each([
  ['error boundary', () => renderToString(createElement(AnalysisError))],
  ['failed lookup', () => renderToString(createElement(LookupError))],
])('%s', (_name, render) => {
  const html = render();

  it('renders role="alert" with the error copy', () => {
    expect(html).toMatch(new RegExp(`role="alert".*${nb['search.failed']}`));
  });

  it('renders nothing but the copy: no figures', () => {
    expect(html.replace(/<[^>]+>/g, '')).toBe(nb['search.failed']);
  });
});
