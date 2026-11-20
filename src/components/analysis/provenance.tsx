'use client';
// "Hvordan er dette regnet?" (Story 3.7; EXPERIENCE.md "Provenance
// drill-down"; DESIGN.md "Provenance drill-down"): the trigger under a
// kroner amount, and the drill-down it opens inline. Written by hand: no new
// dependency, no dialog.
//
// - The trigger is a `button` in `link` colour with `aria-expanded` and
//   `aria-controls`. Opening moves focus to the drill-down's heading
//   (`tabIndex=-1`); "Lukk", or Esc with focus inside, closes it and returns
//   focus to the trigger. Nothing is announced. Several may be open at once.
// - In the key-figure table the trigger sits in the gap cell and the body in
//   a full-width row of its own (`ProvenanceRow`), as the fold-outs do; the
//   two find each other by id through one small store here, with no URL
//   state and no browser storage. Elsewhere `Provenance` holds both.
// - "Vis fordelingen" is a fold-out inside the drill-down (`Disclosure`).
//
// Everything the body shows arrives server-rendered as children
// (src/components/analysis/provenance-steps.tsx), so a field name reaches the
// page only inside `<code data-provenance-field>` (e2e/payload.ts). This
// module formats nothing.
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { t } from '@/messages';

/** What can happen to a drill-down: the trigger toggles it; "Lukk" and Esc close it. */
export type ProvenanceEvent = 'toggle' | 'close' | 'escape';

/** Whether the drill-down is open after `event`. */
export function nextProvenanceOpen(open: boolean, event: ProvenanceEvent): boolean {
  switch (event) {
    case 'toggle':
      return !open;
    case 'close':
    case 'escape':
      return false;
  }
}

// The open drill-downs, by id, and those whose heading takes focus on their next render.
const opened = new Set<string>();
const focusPending = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dispatch(id: string, event: ProvenanceEvent): void {
  const open = nextProvenanceOpen(opened.has(id), event);
  if (open) {
    opened.add(id);
    focusPending.add(id);
  } else {
    opened.delete(id);
    focusPending.delete(id);
  }
  for (const listener of listeners) listener();
}

function useOpen(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => opened.has(id),
    // Closed on the server and in the first render: the page is the same either way.
    () => false,
  );
}

export const triggerId = (id: string) => `${id}-trigger`;
export const bodyId = (id: string) => `${id}-body`;
export const headingId = (id: string) => `${id}-heading`;

export function ProvenanceTrigger({ id }: { readonly id: string }) {
  const open = useOpen(id);
  return (
    <button
      id={triggerId(id)}
      type="button"
      aria-expanded={open}
      aria-controls={bodyId(id)}
      onClick={() => dispatch(id, 'toggle')}
      className="mt-1 inline-flex min-h-6 min-w-6 items-center text-left text-[13px] font-normal whitespace-normal text-link underline underline-offset-2"
      data-provenance-trigger={id}
    >
      {t('provenance.trigger')}
    </button>
  );
}

/** The drill-down: its heading, the steps (children), and "Lukk". `level` is the heading's rank where it sits. */
export function ProvenanceBody({
  id,
  level,
  children,
}: {
  readonly id: string;
  readonly level: 3 | 4;
  readonly children: ReactNode;
}) {
  const open = useOpen(id);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open && focusPending.has(id)) {
      focusPending.delete(id);
      heading.current?.focus();
    }
  }, [open, id]);
  const close = (event: ProvenanceEvent) => {
    dispatch(id, event);
    document.getElementById(triggerId(id))?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close('escape');
  };
  const Heading = level === 3 ? 'h3' : 'h4';
  return (
    <div
      id={bodyId(id)}
      hidden={!open}
      onKeyDown={onKeyDown}
      className="mt-2 min-w-0 rounded-md bg-surface-foldout py-3 pr-3 pl-4 text-left font-normal break-words whitespace-normal text-navy-900 md:pl-[30px]"
      data-provenance-body={id}
    >
      <Heading id={headingId(id)} ref={heading} tabIndex={-1} className="m-0 text-[13.5px] leading-snug font-semibold">
        {t('provenance.trigger')}
      </Heading>
      {children}
      <button
        type="button"
        onClick={() => close('close')}
        className="mt-3 inline-flex min-h-6 min-w-6 items-center text-[13px] text-link underline underline-offset-2"
        data-provenance-close={id}
      >
        {t('provenance.close')}
      </button>
    </div>
  );
}

/** The trigger and its drill-down together, under an amount on a card. */
export function Provenance({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return (
    <>
      <ProvenanceTrigger id={id} />
      <ProvenanceBody id={id} level={4}>
        {children}
      </ProvenanceBody>
    </>
  );
}

/** The drill-down as a full-width row of a table, right after the row whose gap cell holds the trigger. */
export function ProvenanceRow({ id, colSpan, children }: { readonly id: string; readonly colSpan: number; readonly children: ReactNode }) {
  const open = useOpen(id);
  return (
    <tr hidden={!open} className="border-b border-divider" data-provenance-row={id}>
      <td colSpan={colSpan} className="py-2 pr-4">
        <ProvenanceBody id={id} level={3}>
          {children}
        </ProvenanceBody>
      </td>
    </tr>
  );
}

/** "Vis fordelingen": a fold-out inside the drill-down, closed by default. */
export function Disclosure({ id, label, children }: { readonly id: string; readonly label: string; readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="mt-1 inline-flex min-h-6 items-center gap-1.5 text-left text-[13px] text-link"
        data-provenance-distribution-toggle={id}
      >
        <span aria-hidden="true" className="w-3 shrink-0 text-slate">
          {open ? '▾' : '▸'}
        </span>
        <span>{label}</span>
      </button>
      <div id={id} hidden={!open} className="mt-1" data-provenance-distribution={id}>
        {children}
      </div>
    </>
  );
}
