'use client';
// The info button (Story 3.1b, decision 3; EXPERIENCE.md "Info button"): a
// real `button` named "Mer om dette" with a visible ⓘ, `aria-expanded` and
// `aria-controls`, that opens the long text of a caveat whose key text is
// already in the cell. Native button activation gives tap, click, Enter and
// Space; Esc closes it (focus back on the button when it was inside), and so does a tap or
// click anywhere outside it. Moving the pointer away never closes it, so it
// stays open while hovered. Written by hand: no new dependency.
//
// The text opens in the flow of its cell, not floating over the page, so a
// table's scroll container cannot clip it and the body never scrolls
// sideways. Everything it shows arrives as strings from the server; the open
// state lives only here, never in the URL or browser storage.
import { useEffect, useRef, useState } from 'react';

/** What can happen to an open or closed popover. */
export type PopoverEvent = 'toggle' | 'escape' | 'outside';

/** Whether the popover is open after `event`: the button toggles it; Esc and a tap outside close it. */
export function nextOpen(open: boolean, event: PopoverEvent): boolean {
  switch (event) {
    case 'toggle':
      return !open;
    case 'escape':
    case 'outside':
      return false;
  }
}

export function InfoPopover({
  id,
  label,
  text,
}: {
  /** The text's id, unique on the page. */
  readonly id: string;
  /** The button's accessible name, "Mer om dette". */
  readonly label: string;
  /** The long text. */
  readonly text: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen((value) => nextOpen(value, 'escape'));
      // Focus goes back to the button only from inside this popover; focus elsewhere stays where it is.
      if (root.current?.contains(document.activeElement) === true) button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target) === true) return;
      setOpen((value) => nextOpen(value, 'outside'));
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <span ref={root} className="not-italic" data-testid="info-popover">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => nextOpen(value, 'toggle'))}
        className="ml-1 inline-flex min-h-6 min-w-6 items-center justify-center align-middle text-link"
      >
        <span aria-hidden="true">ⓘ</span>
        <span className="sr-only">{label}</span>
      </button>
      <span
        id={id}
        hidden={!open}
        className="mt-1 block rounded-md border border-divider bg-surface p-3 text-[13px] font-normal whitespace-normal text-navy-900"
      >
        {text}
      </span>
    </span>
  );
}
