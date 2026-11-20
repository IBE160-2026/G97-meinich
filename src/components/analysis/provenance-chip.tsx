// A calculation in a `surface` chip (Story 3.7; DESIGN.md "Provenance
// drill-down": each calculation in a `surface` chip, tabular). Neither a
// server nor a client module of its own: the server's steps
// (provenance-steps.tsx) and Verdi's share lines in the browser
// (verdi-formula-slot.tsx) render the same markup.
import type { ReactNode } from 'react';

export function Chip({ children }: { readonly children: ReactNode }) {
  return (
    <p className="figure m-0 mt-1 w-fit max-w-full rounded-md bg-surface px-2 py-1 break-words" data-provenance-chip="">
      {children}
    </p>
  );
}
