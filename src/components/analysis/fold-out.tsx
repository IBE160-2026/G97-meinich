'use client';
// A fold-out (Story 3.2; EXPERIENCE.md "Fold-out"; DESIGN.md "Fold-out"):
// an `h3` whose one child is a `button` with `aria-expanded` and
// `aria-controls`, and a ▸/▾ caret marked `aria-hidden`; the body below it
// is `hidden` until opened, on `surface-foldout`, indented 30 px from `md`
// and 16 px below it. Closed by default. The native button gives Enter and
// Space. Inline, never a dialog. Written by hand: no new dependency.
//
// Everything it shows arrives server-rendered: the heading as a string, the
// body as children the server rendered from strings and strip marks (AD-4).
// The open state lives only here, never in the URL or browser storage.
import { useState, type ReactNode } from 'react';

export function FoldOut({
  bodyId,
  heading,
  children,
}: {
  /** The body's id, unique on the page. */
  readonly bodyId: string;
  readonly heading: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <h3 className="m-0 text-[13.5px] leading-snug font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center gap-1.5 text-left md:min-h-6"
        >
          <span aria-hidden="true" className="w-3 shrink-0 text-slate">
            {open ? '▾' : '▸'}
          </span>
          <span className="min-w-0 break-words">{heading}</span>
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="bg-surface-foldout py-3 pr-3 pl-4 md:pl-[30px]">
        {children}
      </div>
    </>
  );
}
