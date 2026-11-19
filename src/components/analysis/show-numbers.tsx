'use client';
// "Vis tallene" / "Skjul tallene" (Story 3.3; EXPERIENCE.md "Charts",
// "Chart text alternative"): a button with `aria-expanded` and
// `aria-controls` that shows a chart's table, closed by default. The labels
// and the table arrive server-rendered (strings only, AD-4); the open state
// lives only here.
import { useState, type ReactNode } from 'react';

export function ShowNumbers({
  show,
  hide,
  tableId,
  children,
}: {
  readonly show: string;
  readonly hide: string;
  /** The id of the region holding the table, unique on the page. */
  readonly tableId: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={tableId}
        onClick={() => setOpen((value) => !value)}
        className="min-h-6 text-[13px] text-link underline underline-offset-2"
      >
        {open ? hide : show}
      </button>
      <div id={tableId} hidden={!open} className="mt-2">
        {children}
      </div>
    </div>
  );
}
