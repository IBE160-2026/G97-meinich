// The peer-group changes of Story 2.8 as pure functions, shared by the
// client provider (src/components/analysis/peer-change.tsx) and the server
// components that write the same change as a link's href: the state each
// change asks for, and the sentence that announces it once it has
// committed. The URL is always `serialize` of the state `nextState` returns,
// never a string composed by hand.
import { t } from '../messages/index.ts';
import { DEFAULT_BAND, type AnalysisState, type Band } from '../url/analysis-state.ts';

export type PeerChange =
  | { readonly kind: 'exclude'; readonly orgnr: string; readonly navn: string }
  | { readonly kind: 'restore'; readonly orgnr: string; readonly navn: string }
  | { readonly kind: 'band'; readonly band: Band }
  | { readonly kind: 'reset' };

/** What a committed page reports: its canonical URL, the peers in its analysis, and its band's label ("0,33–3×"). */
export type PeerCommit = { readonly href: string; readonly count: number; readonly bandLabel: string };

/**
 * The state `change` asks for, on `base`: every other setting (tab, share,
 * multiple) kept. Reset clears the exclusions and returns the band to
 * Standard.
 */
export function nextState(base: AnalysisState, change: PeerChange): AnalysisState {
  switch (change.kind) {
    case 'exclude':
      return { ...base, ekskl: [...base.ekskl.filter((orgnr) => orgnr !== change.orgnr), change.orgnr] };
    case 'restore':
      return { ...base, ekskl: base.ekskl.filter((orgnr) => orgnr !== change.orgnr) };
    case 'band':
      return { ...base, band: change.band };
    case 'reset':
      return { ...base, ekskl: [], band: DEFAULT_BAND };
  }
}

/** Whether `state` is the standard peer group: no exclusion, the Standard band. A predicate on parsed state, not on the URL. */
export function isStandardGroup(state: Pick<AnalysisState, 'ekskl' | 'band'>): boolean {
  return state.ekskl.length === 0 && state.band === DEFAULT_BAND;
}

/** The announcement for a committed change, with the analysis's new count; the singular form for one. */
export function announcement(change: PeerChange, commit: PeerCommit): string {
  const one = commit.count === 1;
  const m = String(commit.count);
  switch (change.kind) {
    case 'exclude':
      return one ? t('peers.announce.excludedOne', { navn: change.navn }) : t('peers.announce.excluded', { navn: change.navn, m });
    case 'restore':
      return one ? t('peers.announce.restoredOne', { navn: change.navn }) : t('peers.announce.restored', { navn: change.navn, m });
    case 'band':
      return one ? t('peers.announce.bandOne', { b: commit.bandLabel }) : t('peers.announce.band', { b: commit.bandLabel, n: m });
    case 'reset':
      return one ? t('peers.announce.resetOne') : t('peers.announce.reset', { n: m });
  }
}
