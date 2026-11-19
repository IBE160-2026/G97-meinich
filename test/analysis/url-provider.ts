// The URL hook's provider around a component under test (Story 3.5): every
// analysis link is built by `useAnalysisUrl`, so a component with a link
// renders inside AnalysisUrlProvider, as on the page. Outside the Next.js
// router the live URL is the provider's own.
import { createElement, type ReactElement } from 'react';
import { AnalysisUrlProvider } from '../../src/components/analysis/analysis-url.tsx';
import { defaultState, serialize, type AnalysisState } from '../../src/url/analysis-state.ts';

export function withUrl(element: ReactElement, state: AnalysisState = { ...defaultState('813235552'), fane: 'oversikt' }, medianStep = false): ReactElement {
  const Provider = AnalysisUrlProvider as (props: { readonly href: string; readonly medianStep: boolean }) => ReactElement;
  return createElement(Provider, { href: serialize(state), medianStep }, element);
}
