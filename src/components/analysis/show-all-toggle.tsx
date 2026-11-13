'use client';
// "Vis alle {n}" under the phone peer cards (Story 2.7; EXPERIENCE.md
// "Responsive"). The cards past the first ones arrive as display strings
// (PeerDisplayRow and the card labels, all from the server) and are
// rendered here only when the button is pressed, with the same PeerCard
// markup as the server's cards; focus then moves to the first card it
// revealed, and the button goes, since there is nothing more to show.
// Rendering them up front in the HTML doubled a large group's page.
// This module imports no engine or messages module and formats nothing.
// The open state lives only here, never in the URL or storage.
import { useEffect, useRef, useState } from 'react';
import type { PeerDisplayRow } from '@/analysis/peer-rows';
import { CARD_LIST_CLASS, PeerCard, type PeerCardLabels } from './peer-card';

export function ShowAllToggle({
  listId,
  label,
  rows,
  labels,
}: {
  /** The revealed list's id, unique on the page. */
  readonly listId: string;
  /** The button's text, "Vis alle {n}". */
  readonly label: string;
  /** The cards to reveal, in order. */
  readonly rows: readonly PeerDisplayRow[];
  readonly labels: PeerCardLabels;
}) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
  }, [open]);

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
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex min-h-11 items-center rounded-md px-1 text-link underline"
        >
          {label}
        </button>
      )}
    </>
  );
}
