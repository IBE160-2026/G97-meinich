'use client';
// The Peers tab's change controls (Story 2.8; FR-17, FR-18): the row action
// "Ekskluder {Navn}" / "Ta med igjen {Navn}", and the one-off actions
// "Tilbakestill til standard", "Utvid størrelsesintervallet" and "Tilbake
// til standard (0,5–2×)". Each asks the peer-change provider for a change,
// which pushes the URL `serialize` writes for the latest requested state.
//
// The row action is a button whose visible label is the verb and whose
// accessible name names the peer. It carries the peer's orgnr as
// `data-peer-action`, so after the change commits the provider can put
// focus back on the same peer's button (AD-4 as amended on 2026-11-13: a
// group member's orgnr may reach the page). It is never disabled while a
// change is pending: a second press builds on the first.
//
// The one-off actions are links to the URL the server serialised for the
// same change, so they work without JavaScript; with it, a click is the
// same soft navigation as every other change.
import type { MouseEvent, ReactNode } from 'react';
import { t } from '@/messages';
import { usePeerChange, type PeerChange } from './peer-change';

export function PeerAction({
  orgnr,
  navn,
  excluded,
}: {
  readonly orgnr: string;
  /** The peer's name as the row shows it. */
  readonly navn: string;
  readonly excluded: boolean;
}) {
  const peerChange = usePeerChange();
  return (
    <button
      type="button"
      data-peer-action={orgnr}
      aria-label={excluded ? t('peers.action.restoreName', { navn }) : t('peers.action.excludeName', { navn })}
      onClick={() => peerChange?.change(excluded ? { kind: 'restore', orgnr, navn } : { kind: 'exclude', orgnr, navn })}
      className="inline-flex min-h-11 min-w-6 items-center px-1 whitespace-nowrap text-link underline md:min-h-6"
    >
      {excluded ? t('peers.action.restore') : t('peers.action.exclude')}
    </button>
  );
}

export function PeerChangeLink({
  href,
  change,
  children,
}: {
  /** The URL the server serialised for this change, for a click without JavaScript. */
  readonly href: string;
  readonly change: PeerChange;
  readonly children: ReactNode;
}) {
  const peerChange = usePeerChange();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (peerChange === null || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    peerChange.change(change);
  };
  return (
    <a href={href} onClick={onClick} className="inline-flex min-h-11 items-center md:min-h-6">
      {children}
    </a>
  );
}
