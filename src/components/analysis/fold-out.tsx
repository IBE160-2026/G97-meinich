'use client';
// A fold-out (Story 3.2; EXPERIENCE.md "Fold-out"; DESIGN.md "Fold-out"):
// an `h3` whose one child is a `button` with `aria-expanded` and
// `aria-controls`, and a ▸/▾ caret marked `aria-hidden`; the body below it
// is `hidden` until opened, on `surface-foldout`, indented 30 px from `md`
// and 16 px below it. Closed by default. The native button gives Enter and
// Space. Inline, never a dialog. Written by hand: no new dependency.
//
// Story 3.3: a fold-out can be opened from elsewhere on the page, with no
// URL state: a link (`FoldOutLink`) dispatches `OPEN_FOLD_OUT` with the
// body's id, and the fold-out opens and moves focus to its heading's button.
// The heading's `id` is the link's `href` target, so without script the link
// still jumps to it.
//
// Everything it shows arrives server-rendered: the heading as a string, the
// body as children the server rendered from strings and strip marks (AD-4).
// The open state lives only here, never in the URL or browser storage.
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** The window event that opens a fold-out; its `detail` is the fold-out's body id. */
export const OPEN_FOLD_OUT = 'peerless:open-fold-out';

export function FoldOut({
  bodyId,
  heading,
  headingId,
  children,
}: {
  /** The body's id, unique on the page. */
  readonly bodyId: string;
  readonly heading: string;
  /** The heading's id, for a link to it; unique on the page. */
  readonly headingId?: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onOpen = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail !== bodyId) return;
      setOpen(true);
      button.current?.focus();
    };
    window.addEventListener(OPEN_FOLD_OUT, onOpen);
    return () => window.removeEventListener(OPEN_FOLD_OUT, onOpen);
  }, [bodyId]);
  return (
    <>
      <h3 id={headingId} className="m-0 scroll-mt-4 text-[13.5px] leading-snug font-semibold">
        <button
          ref={button}
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

/**
 * A link that opens the fold-out whose body is `bodyId` and moves focus to
 * its heading (Story 3.3: "Se forklaring av marginen"). Same page, no route
 * and no URL state: the click is handled here; without script the `href`
 * jumps to the heading.
 */
export function FoldOutLink({
  bodyId,
  headingId,
  children,
}: {
  readonly bodyId: string;
  readonly headingId: string;
  readonly children: ReactNode;
}) {
  return (
    <a
      href={`#${headingId}`}
      data-opens={bodyId}
      className="text-link underline underline-offset-2"
      onClick={(event) => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_FOLD_OUT, { detail: bodyId }));
      }}
    >
      {children}
    </a>
  );
}
