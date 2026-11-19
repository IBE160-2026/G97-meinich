'use client';
// The one URL hook of an analysis page (Story 3.5, decision 6; AD-5, AD-6):
// `useAnalysisUrl()` gives the state the page shows, every link's href, and
// the one write of the share and the multiple, `replaceSettings` (Story 3.6,
// decision 4), the only `history.replaceState` in `src/`
// (test/one-replace-state.test.ts; never `router.replace`: a share or
// multiple change renders nothing on the server and adds no history entry).
//
// The provider sits in the covered analysis page, around the tabs and the
// panel. It holds the URL the server parsed (`href`, `serialize` of its
// state) and whether the server found the median step for it
// (`medianStep`). The state it gives is that URL's, with the share and the
// multiple of the live URL (`useSearchParams`, which Next.js keeps in step
// with `history.replaceState`): so every link built here keeps `andel` and
// `multippel` after a share change, and the exclusions and the band stay
// the server's, so an `ekskl` item the server dropped never returns.
//
// Nothing is stored: no cookie, no browser storage.
import { useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { committedContext, targetState, withLiveSettings, type AnalysisTarget } from '@/analysis/peer-change';
import type { ClosableShare, Multiple } from '@/engine/closable';
import { parse, serialize, type AnalysisState } from '@/url/analysis-state';

export type AnalysisUrlValue = {
  /** The server's state, with the live URL's share and multiple. */
  readonly state: AnalysisState;
  /** Whether the server found the median step for the URL it parsed. */
  readonly medianStep: boolean;
  /** The href of a link to `target`, every other setting kept. */
  readonly hrefFor: (target: AnalysisTarget) => string;
  /**
   * Writes the share, the multiple or both into the URL with
   * `history.replaceState`: one entry replaced, none added. A setting left
   * out keeps its live value; `multippel: null` removes the multiple. A
   * change that leaves the URL as it is writes nothing.
   */
  readonly replaceSettings: (settings: Settings) => void;
};

/** What `replaceSettings` writes: the closable share and the multiple (null: none). */
export type Settings = { readonly andel?: ClosableShare; readonly multippel?: Multiple | null };

const AnalysisUrlContext = createContext<AnalysisUrlValue | null>(null);

/** The page's URL hook. Throws outside an analysis page: a link with no state would lose the settings. */
export function useAnalysisUrl(): AnalysisUrlValue {
  const value = useContext(AnalysisUrlContext);
  if (value === null) throw new Error('useAnalysisUrl outside AnalysisUrlProvider');
  return value;
}

export function AnalysisUrlProvider({
  href,
  medianStep,
  children,
}: {
  /** `serialize` of the state the server parsed. */
  readonly href: string;
  readonly medianStep: boolean;
  readonly children: ReactNode;
}) {
  // Null outside the Next.js router (a component test): the server's URL is then the live one.
  const search = useSearchParams()?.toString() ?? null;
  const state = useMemo(() => {
    const context = committedContext(medianStep);
    const base = parse(href, context);
    if (base.kind !== 'analysis') throw new Error('AnalysisUrlProvider needs an analysis URL');
    if (search === null) return base.state;
    // The live query on the server's path: the path is the page's own.
    const live = parse(`${href.split('?')[0]}?${search}`, context);
    return withLiveSettings(base.state, live.kind === 'analysis' ? live.state : null);
  }, [href, medianStep, search]);

  const hrefFor = useCallback((target: AnalysisTarget) => serialize(targetState(state, target)), [state]);
  const replaceSettings = useCallback(
    (settings: Settings) => {
      const next: AnalysisState = {
        ...state,
        andel: settings.andel ?? state.andel,
        multippel: settings.multippel === undefined ? state.multippel : settings.multippel,
      };
      const href = serialize(next);
      if (href === serialize(state)) return;
      window.history.replaceState(null, '', href);
    },
    [state],
  );

  const value = useMemo<AnalysisUrlValue>(
    () => ({ state, medianStep, hrefFor, replaceSettings }),
    [state, medianStep, hrefFor, replaceSettings],
  );
  return <AnalysisUrlContext.Provider value={value}>{children}</AnalysisUrlContext.Provider>;
}
