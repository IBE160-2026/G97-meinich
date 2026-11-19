'use client';
// Peer-group changes (Story 2.8; FR-17, FR-18, FR-19; AD-5, AD-6): exclude,
// restore, a size-band step and reset. Each is a soft navigation,
// `router.push` to the URL `serialize` writes, rendered on the server; nothing
// is stored (no cookie, no browser storage, no table). This provider sits in
// the analysis layout (the [orgnr] segment's layout.tsx), which survives a
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
// Story 3.5 (decision 6; Epic 2 retro B6): the base of a change keeps its
// exclusions and band from the change in flight or the last good URL, as
// before, and takes the share and the multiple from the live URL, which
// Verdi writes with `history.replaceState`. Each is parsed with the
// server's median step, which every commit reports, so `andel=median`
// survives exclude, restore, a band step and reset
// (`peerChangeHref` in src/analysis/peer-change.ts).
//
// Story 2.10: an exclude is refused at MAX_EKSKL exclusions
// (exclusionCapReached): the second guard after the aria-disabled button,
// and the only one for a press made while the 20th is in flight.
//
// A query-only change keeps the page's elements (checked in a browser: the
// pressed button is the same element after the commit), so focus normally
// stays where it was. After the commit the provider still puts focus on
// the change's target when it is elsewhere: the same peer's action, the
// chosen band step (also after "Utvid størrelsesintervallet" or "Tilbake
// til standard", whose link is gone), or after a reset the panel's h2.
//
// A change refused by the rate limit (429) is not an RSC payload: Next.js
// loads the new URL as a full page, which shows the refusal there (the
// decided exception, EXPERIENCE.md "Recompute").
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { PANEL_HEADING_ID } from '@/analysis/view';
import { t } from '@/messages';
import { StateBlock } from './state-block';
import { announcement, peerChangeHref, type PeerChange, type PeerCommit } from '@/analysis/peer-change';
import type { Band } from '@/url/analysis-state';

export type { PeerChange, PeerCommit };

export type PeerChangeValue = {
  readonly isPending: boolean;
  /** The last change failed: the alert shows until the next change. */
  readonly failed: boolean;
  readonly change: (change: PeerChange) => void;
  readonly commit: (commit: PeerCommit & { readonly medianStep: boolean }) => void;
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
  // Whether the server found the median step for the last good URL (Story 3.5).
  const lastMedianStep = useRef(false);
  const inFlight = useRef<InFlight | null>(null);
  const [failed, setFailed] = useState(false);
  // Where the failure alert stands: shown after `fail()`, kept through the
  // commit its own Back produces, cleared by the next commit or change.
  const failure = useRef<'none' | 'awaitingBack' | 'shown'>('none');
  const [message, setMessage] = useState('');
  const [showAllBand, setShowAllBand] = useState<Band | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const change = useCallback(
    (requested: PeerChange) => {
      const live = `${window.location.pathname}${window.location.search}`;
      // Null: refused at the cap (also while the 20th is in flight, before
      // any page has rendered the cap), or a change that changes nothing.
      const href = peerChangeHref({
        base: inFlight.current?.href ?? lastGood.current ?? live,
        live,
        medianStep: lastMedianStep.current,
        change: requested,
      });
      if (href === null) return;
      inFlight.current = { change: requested, href };
      failure.current = 'none';
      setFailed(false);
      if (requested.kind === 'band' || requested.kind === 'reset') setShowAllBand(null);
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );

  const commit = useCallback((committed: PeerCommit & { readonly medianStep: boolean }) => {
    lastGood.current = committed.href;
    lastMedianStep.current = committed.medianStep;
    if (failure.current === 'awaitingBack') {
      failure.current = 'shown';
    } else if (failure.current === 'shown') {
      failure.current = 'none';
      setFailed(false);
    }
    const done = inFlight.current;
    if (done === null) return;
    inFlight.current = null;
    // Cleared first, so the same sentence twice in a row is announced again.
    setMessage('');
    if (messageTimer.current !== null) clearTimeout(messageTimer.current);
    const text = announcement(done.change, committed);
    messageTimer.current = setTimeout(() => setMessage(text), 50);
    // Only when focus was lost (the pressed link went with the change): a
    // user who moved focus elsewhere while it was pending keeps it there.
    const active = document.activeElement;
    const lost = active === null || active === document.body || !active.isConnected;
    const target = focusTarget(done.change);
    if (lost && target !== null) target.focus();
  }, []);

  const hasChangeInFlight = useCallback(() => inFlight.current !== null, []);
  const fail = useCallback(() => {
    inFlight.current = null;
    failure.current = 'awaitingBack';
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
 * parsed (`serialize` of its state), so the next change builds on it, the
 * count the announcement names, and whether the server found the median
 * step for that URL (Story 3.5). Renders nothing. `renderId` is new for
 * every server render, so each render commits exactly once, also one whose
 * URL and count equal the last (an exclude restored before it committed).
 */
export function PeerChangeCommit({
  href,
  count,
  bandLabel,
  medianStep,
  renderId,
}: PeerCommit & { readonly medianStep: boolean; readonly renderId: string }) {
  const context = usePeerChange();
  const commit = context?.commit;
  useEffect(() => {
    commit?.({ href, count, bandLabel, medianStep });
  }, [commit, href, count, bandLabel, medianStep, renderId]);
  return null;
}

/** "Kunne ikke oppdatere analysen. Prøv igjen." after a failed change, until the next change or page. */
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
