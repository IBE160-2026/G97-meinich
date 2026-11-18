'use client';
// One row of the phone key-figure table (Story 1.8; EXPERIENCE.md
// "Responsive"): the row name is a button with aria-expanded/aria-controls
// that shows or hides the full-width expansion row beneath it by toggling
// its `hidden` attribute. Everything it shows arrives server-rendered as
// props: this module imports no engine module and formats nothing. The open
// state lives only here, never in the URL or browser storage.
import { useState, type ReactNode } from 'react';

export function PhoneRowToggle({
  expansionId,
  label,
  cells,
  expansion,
  indent = false,
}: {
  /** The expansion row's id, unique on the page. */
  readonly expansionId: string;
  readonly label: ReactNode;
  /** The row's other cells (own value, gap in kroner). */
  readonly cells: ReactNode;
  /** The expansion row's content: one cell spanning the table. */
  readonly expansion: ReactNode;
  /** A cost-share row, indented 16 px under its group's heading (Story 3.1b, decision 7). */
  readonly indent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={open ? '' : 'border-b border-divider'}>
        <th scope="row" className={`py-2 pr-3 text-left align-top font-normal ${indent ? 'pl-4' : ''}`}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={expansionId}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-11 w-full items-start gap-1.5 text-left"
          >
            <span aria-hidden="true" className="w-3 shrink-0 text-slate">
              {open ? '▾' : '▸'}
            </span>
            <span className="min-w-0 break-words">{label}</span>
          </button>
        </th>
        {cells}
      </tr>
      <tr id={expansionId} hidden={!open} className="border-b border-divider bg-surface-foldout">
        {expansion}
      </tr>
    </>
  );
}
