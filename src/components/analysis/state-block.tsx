import type { ReactNode } from 'react';

// The State block (DESIGN.md, EXPERIENCE.md "State block"): a `surface` box
// with a 4px navy-700 left accent, an optional kicker, one or two sentences
// and at most one link or action. Used for every state that is not an
// analysis; there is no separate banner component.
export function StateBlock({ kicker, children }: { readonly kicker?: string; readonly children: ReactNode }) {
  return (
    <div data-testid="state-block" className="rounded-md border-l-4 border-navy-700 bg-surface px-4 py-3.5 md:px-5 md:py-4">
      {kicker !== undefined ? (
        <p className="m-0 mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-slate uppercase">{kicker}</p>
      ) : null}
      {children}
    </div>
  );
}
