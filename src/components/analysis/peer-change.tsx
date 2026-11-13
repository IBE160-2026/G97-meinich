'use client';
// Peer-group changes (Story 2.8; FR-17, FR-18, FR-19; AD-5, AD-6): exclude,
// restore, a size-band step and reset. Each is a soft navigation,
// `router.push` to the URL `serialize` writes, rendered on the server; nothing
// is stored (no cookie, no browser storage, no table). This provider sits in
// the analysis layout (src/app/analyse/[orgnr]/layout.tsx), which survives a
// query-only navigation, so it holds what must outlive the page it changes:
//
//   - the last good URL, which each committed page reports through
//     PeerChangeCommit (`serialize` of the state the server parsed), and the
//     change in flight. A new change builds on the change in flight, else on
//     the last good URL: a second click while one is pending builds on the
//     first, and an `ekskl` item the server dropped never comes back;
//   - `isPending` from useTransition: the panel and the header count are
//     marked busy and dimmed while the change is in flight;
//   - the polite live region, empty from load, which announces the committed
//     change with the new count;
//   - the failure: [orgnr]/error.tsx asks whether a change is in flight, and
//     if so calls `fail()` and goes back; the alert then shows over the last
//     good figures until the next change;
//   - which band "Vis alle" is open at (Story 2.7 triage row 14): open
//     across exclude and restore, closed by a band change.
//
// Next.js keys the page segment by its query, so a change remounts the page:
// the button that was pressed is a new element. After the commit the
// provider focuses its counterpart (the same peer's action, the chosen band
// step) or, after a reset, the panel's h2.
//
// A change refused by the rate limit (429) is not an RSC payload: Next.js
// loads the new URL as a full page, which shows the refusal there (the
// decided exception, EXPERIENCE.md "Recompute").
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { PANEL_HEADING_ID, PATH_CONTEXT } from '@/analysis/view';
import { t } from '@/messages';
import { StateBlock } from './state-block';
import { parse, serialize, type AnalysisState, type Band } from '@/url/analysis-state';

export type PeerChange =
  | { readonly kind: 'exclude'; readonly orgnr: string; readonly navn: string }
  | { readonly kind: 'restore'; readonly orgnr: string; readonly navn: string }
  | { readonly kind: 'band'; readonly band: Band }
  | { readonly kind: 'reset' };

/** What a committed page reports: its canonical URL, the peers in its analysis, and its band's label ("0,33–3×"). */
export type PeerCommit = { readonly href: string; readonly count: number; readonly bandLabel: string };

export type PeerChangeValue = {
  readonly isPending: boolean;
  /** The last change failed: the alert shows until the next change. */
  readonly failed: boolean;
  readonly change: (change: PeerChange) => void;
  readonly commit: (commit: PeerCommit) => void;
  /** Whether a change has been pushed and no page has committed since. Read by [orgnr]/error.tsx. */
  readonly hasChangeInFlight: () => boolean;
  /** The change in flight failed: forget it and show the alert. */
  readonly fail: () => void;
  /** The band "Vis alle" is open at, or null when it is closed. */
  readonly showAllBand: Band | null;
  readonly openShowAll: (band: Band) => void;
};

export const PeerChangeContext = createContext<PeerChangeValue | null>(null);

/** The provider's value; null outside the analysis layout (a component test, another page). */
export function usePeerChange(): PeerChangeValue | null {
  return useContext(PeerChangeContext);
}

/**
 * The state `change` asks for, on `base`. Pure: the URL comes from
 * `serialize` of this state, never from a string composed here.
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
      return { ...base, ekskl: [], band: 0 };
  }
}

/** The announcement for a committed change, with the analysis's new count. */
export function announcement(change: PeerChange, commit: PeerCommit): string {
  const one = commit.count === 1;
  const m = String(commit.count);
  switch (change.kind) {
    case 'exclude':
      return one
        ? t('peers.announce.excludedOne', { navn: change.navn })
        : t('peers.announce.excluded', { navn: change.navn, m });
    case 'restore':
      return one
        ? t('peers.announce.restoredOne', { navn: change.navn })
        : t('peers.announce.restored', { navn: change.navn, m });
    case 'band':
      return one
        ? t('peers.announce.bandOne', { b: commit.bandLabel })
        : t('peers.announce.band', { b: commit.bandLabel, n: m });
    case 'reset':
      return one ? t('peers.announce.resetOne') : t('peers.announce.reset', { n: m });
  }
}

/** The element focus belongs on after `change` has committed. */
function focusTarget(change: PeerChange): HTMLElement | null {
  const visible = (selector: string) =>
    [...document.querySelectorAll<HTMLElement>(selector)].find((element) => element.offsetParent !== null) ?? null;
  switch (change.kind) {
    case 'exclude':
    case 'restore':
      return visible(`[data-peer-action="${change.orgnr}"]`);
    case 'band':
      return visible(`[data-band-step="${change.band}"]`);
    case 'reset':
      return document.getElementById(PANEL_HEADING_ID);
  }
}

type InFlight = { readonly change: PeerChange; readonly href: string };

export function PeerChangeProvider({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lastGood = useRef<string | null>(null);
  const inFlight = useRef<InFlight | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [showAllBand, setShowAllBand] = useState<Band | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const change = useCallback(
    (requested: PeerChange) => {
      const baseHref = inFlight.current?.href ?? lastGood.current ?? `${window.location.pathname}${window.location.search}`;
      const base = parse(baseHref, PATH_CONTEXT);
      if (base.kind !== 'analysis') return;
      const href = serialize(nextState(base.state, requested));
      if (href === baseHref) return;
      inFlight.current = { change: requested, href };
      setFailed(false);
      if (requested.kind === 'band' || requested.kind === 'reset') setShowAllBand(null);
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );

  const commit = useCallback((committed: PeerCommit) => {
    lastGood.current = committed.href;
    const done = inFlight.current;
    if (done === null) return;
    inFlight.current = null;
    // Cleared first, so the same sentence twice in a row is announced again.
    setMessage('');
    if (messageTimer.current !== null) clearTimeout(messageTimer.current);
    const text = announcement(done.change, committed);
    messageTimer.current = setTimeout(() => setMessage(text), 50);
    const target = focusTarget(done.change);
    if (target !== null && document.activeElement !== target) target.focus();
  }, []);

  const hasChangeInFlight = useCallback(() => inFlight.current !== null, []);
  const fail = useCallback(() => {
    inFlight.current = null;
    setFailed(true);
  }, []);

  useEffect(
    () => () => {
      if (messageTimer.current !== null) clearTimeout(messageTimer.current);
    },
    [],
  );

  const value = useMemo<PeerChangeValue>(
    () => ({ isPending, failed, change, commit, hasChangeInFlight, fail, showAllBand, openShowAll: setShowAllBand }),
    [isPending, failed, change, commit, hasChangeInFlight, fail, showAllBand],
  );

  return (
    <PeerChangeContext.Provider value={value}>
      {children}
      <div role="status" className="sr-only" data-testid="peer-change-status">
        {message}
      </div>
    </PeerChangeContext.Provider>
  );
}

/**
 * Rendered by every covered analysis page: reports the URL the server
 * parsed (`serialize` of its state), so the next change builds on it, and
 * the count the announcement names. Renders nothing.
 */
export function PeerChangeCommit({ href, count, bandLabel }: PeerCommit) {
  const context = usePeerChange();
  const commit = context?.commit;
  useEffect(() => {
    commit?.({ href, count, bandLabel });
  }, [commit, href, count, bandLabel]);
  return null;
}

/** "Kunne ikke oppdatere analysen. Prøv igjen." after a failed change, until the next one. */
export function PeerChangeAlert() {
  const context = usePeerChange();
  return (
    <div role="alert" data-testid="peer-change-alert">
      {context?.failed === true ? (
        <div className="mt-3">
          <StateBlock>
            <p className="m-0">{t('peers.failed')}</p>
          </StateBlock>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The analysis panel's content while a change is in flight: `aria-busy`, a
 * slate "Oppdaterer …", and the previous figures dimmed. No transition or
 * animation, in any motion mode.
 */
export function PendingBody({ children }: { readonly children: ReactNode }) {
  const pending = usePeerChange()?.isPending === true;
  return (
    <div aria-busy={pending ? 'true' : undefined} data-testid="analysis-panel">
      {pending ? (
        <p className="m-0 mt-1 text-[13px] text-slate" data-testid="peer-change-pending">
          {t('peers.pending')}
        </p>
      ) : null}
      <div className={pending ? 'opacity-50' : undefined}>{children}</div>
    </div>
  );
}

/** The header's peer count, busy and dimmed while a change is in flight. */
export function PendingCount({ children }: { readonly children: ReactNode }) {
  const pending = usePeerChange()?.isPending === true;
  return (
    <span aria-busy={pending ? 'true' : undefined} className={pending ? 'opacity-50' : undefined} data-testid="header-peer-count">
      {children}
    </span>
  );
}
