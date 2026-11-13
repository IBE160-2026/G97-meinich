'use client';
// "Vis alle {n}" under the phone peer cards (Story 2.7; EXPERIENCE.md
// "Responsive"): the cards past the first ones arrive server-rendered as
// children inside a list that starts `hidden`; the button reveals it and
// moves focus to the first card it revealed, then goes, since there is
// nothing more to show. Everything it shows arrives as props, like
// phone-row-toggle.tsx: this module imports no engine module and formats
// nothing. The open state lives only here, never in the URL or storage.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ShowAllToggle({
  listId,
  label,
  children,
}: {
  /** The hidden list's id, unique on the page. */
  readonly listId: string;
  /** The button's text, "Vis alle {n}". */
  readonly label: ReactNode;
  /** The hidden cards, each an `<li>` whose first focusable target is `[tabindex="-1"]`. */
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
  }, [open]);

  return (
    <>
      <ul id={listId} ref={list} hidden={!open} className="m-0 list-none p-0">
        {children}
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
