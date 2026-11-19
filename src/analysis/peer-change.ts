// The peer-group changes of Story 2.8 as pure functions, shared by the
// client provider (src/components/analysis/peer-change.tsx) and the server
// components that write the same change as a link's href: the state each
// change asks for, and the sentence that announces it once it has
// committed. The URL is always `serialize` of the state `nextState` returns,
// never a string composed by hand.
//
// Story 3.5 (decision 6; AD-6): the share and the multiple change in the
// browser with `history.replaceState`, so a later link or change takes
// `andel` and `multippel` from the live URL, and everything else from the
// URL the server parsed. `peerChangeHref` is the provider's base rule: the
// exclusions and the band from the change in flight or the last good URL
// (so an `ekskl` item the server dropped never comes back, Story 2.8), the
// share and the multiple from the live URL, each parsed with the server's
// median step, so `andel=median` survives a peer change (Epic 2 retro B6).
import { t } from '../messages/index.ts';
import {
  DEFAULT_BAND,
  MAX_EKSKL,
  parse,
  serialize,
  type AnalysisState,
  type Band,
  type Fane,
  type ParseContext,
} from '../url/analysis-state.ts';

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

/**
 * Whether `state` already holds MAX_EKSKL exclusions (Story 2.10): every
 * "Ekskluder" is then `aria-disabled` and described by the cap text, and the
 * provider refuses an exclude, so a 21st is never pushed and never blamed
 * on the link (the invalid-settings notice is for a link that holds more).
 */
export function exclusionCapReached(state: Pick<AnalysisState, 'ekskl'>): boolean {
  return state.ekskl.length >= MAX_EKSKL;
}

/**
 * How the client parses a URL the server has already parsed (Story 3.5):
 * every `ekskl` item kept, as the server kept it, and `andel=median` kept
 * where the server found the median step (`medianStep`), never with a
 * predicate that is always false.
 */
export function committedContext(medianStep: boolean): ParseContext {
  return { isCandidate: () => true, medianStepExists: () => medianStep };
}

/**
 * `base` with the share and the multiple of `live`, the URL as the browser
 * shows it now; null `live` (no live URL, or another company's) keeps
 * `base` as it is.
 */
export function withLiveSettings(base: AnalysisState, live: AnalysisState | null): AnalysisState {
  if (live === null || live.orgnr !== base.orgnr) return base;
  return { ...base, andel: live.andel, multippel: live.multippel };
}

/** Where a link goes: another tab, a peer-group change, or both; everything else kept. */
export type AnalysisTarget = { readonly fane?: Fane; readonly change?: PeerChange };

/** The state a link to `target` opens, on `state`. */
export function targetState(state: AnalysisState, target: AnalysisTarget): AnalysisState {
  const changed = target.change === undefined ? state : nextState(state, target.change);
  return target.fane === undefined ? changed : { ...changed, fane: target.fane };
}

/**
 * The URL the peer-change provider pushes for `change`, or null when it
 * pushes nothing (a refused exclude at the cap, a change that changes
 * nothing, a base that is not an analysis URL). `base` is the change in
 * flight's URL or the last good one; `live` the browser's URL now;
 * `medianStep` whether the server found the median step for the last good
 * URL.
 */
export function peerChangeHref({
  base,
  live,
  medianStep,
  change,
}: {
  readonly base: string;
  readonly live: string;
  readonly medianStep: boolean;
  readonly change: PeerChange;
}): string | null {
  const context = committedContext(medianStep);
  const parsedBase = parse(base, context);
  if (parsedBase.kind !== 'analysis') return null;
  const parsedLive = parse(live, context);
  const state = withLiveSettings(parsedBase.state, parsedLive.kind === 'analysis' ? parsedLive.state : null);
  // At the cap the aria-disabled button does not call this; if anything
  // does, it ends here: no push, so no 21st exclusion and no
  // invalid-settings notice. Built on the change in flight, this also
  // refuses a second press while the 20th is pending.
  if (change.kind === 'exclude' && exclusionCapReached(state)) return null;
  const href = serialize(nextState(state, change));
  return href === serialize(state) ? null : href;
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
