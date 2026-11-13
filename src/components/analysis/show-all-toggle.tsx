'use client';
// "Vis alle {n}" under the phone peer cards (Story 2.7; EXPERIENCE.md
// "Responsive"). The cards past the first ones arrive as display strings
// (PeerDisplayRow and the card labels, all from the server) and are
// rendered here only when the button is pressed, with the same PeerCard
// markup as the server's cards; focus then moves to the first card it
// revealed, and the button goes, since there is nothing more to show.
// Rendering them up front in the HTML doubled a large group's page.
// This module imports no engine module and formats nothing.
//
// Story 2.8 (Story 2.7 triage row 14): a peer-group change remounts the page
// (Next.js keys the page by its query), so the open state lives in the
// peer-change provider in the layout, as the band it was opened at. It
// stays open across exclude and restore, so focus can stay on the pressed
// button in a revealed card, and closes when the band changes. Without the
// provider (a component test) it is local. Never in the URL or storage.
import { useEffect, useRef, useState } from 'react';
import type { PeerDisplayRow } from '@/analysis/peer-rows';
import type { Band } from '@/url/analysis-state';
import { CARD_LIST_CLASS, PeerCard, type PeerCardLabels } from './peer-card';
import { usePeerChange } from './peer-change';

export function ShowAllToggle({
  listId,
  label,
  rows,
  labels,
  band,
}: {
  /** The revealed list's id, unique on the page. */
  readonly listId: string;
  /** The button's text, "Vis alle {n}". */
  readonly label: string;
  /** The cards to reveal, in order. */
  readonly rows: readonly PeerDisplayRow[];
  readonly labels: PeerCardLabels;
  /** The band the list was rendered at: the toggle is open only at the band it was opened at. */
  readonly band: Band;
}) {
  const peerChange = usePeerChange();
  const [localOpen, setLocalOpen] = useState(false);
  const open = peerChange === null ? localOpen : peerChange.showAllBand === band;
  // Focus moves to the first revealed card only when the button was pressed,
  // not when the list is drawn open again after a change.
  const pressed = useRef(false);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || !pressed.current) return;
    pressed.current = false;
    list.current?.querySelector<HTMLElement>('p[tabindex="-1"]')?.focus();
  }, [open]);

  const show = () => {
    pressed.current = true;
    if (peerChange === null) setLocalOpen(true);
    else peerChange.openShowAll(band);
  };

  return (
    <>
      <ul id={listId} ref={list} hidden={!open} className={CARD_LIST_CLASS}>
        {open ? rows.map((row, index) => <PeerCard key={index} row={row} labels={labels} first={index === 0} />) : null}
      </ul>
      {open ? null : (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={listId}
          onClick={show}
          className="mt-2 inline-flex min-h-11 items-center rounded-md px-1 text-link underline"
        >
          {label}
        </button>
      )}
    </>
  );
}
