'use client';
// What Verdi's drill-downs compute in the browser (Story 3.7, decision 7):
// the share line of each card, "{full} × {andel} = {a}", and EV's product
// line, from `verdiCards` at the live share and multiple. The rest of each
// drill-down is the server's (src/components/analysis/verdi-provenance.tsx),
// which places this slot in its formula step; the panel provides the view
// it reads through context, so no further value crosses the wire.
//
// At the median step the profit has no share line: its amount is (M − r) ×
// sumDriftsinntekter, never full × s_med, and the slot shows those lines,
// which the server wrote (`median`).
import { createContext, useContext, type ReactNode } from 'react';
import type { VerdiCardsView } from '@/analysis/verdi-view';
import type { ClosableShare } from '@/engine/closable';
import { Chip } from './provenance-chip';

export const VerdiViewContext = createContext<{ readonly view: VerdiCardsView; readonly share: ClosableShare } | null>(null);

export type VerdiCard = 'profit' | 'workingCapital' | 'oml' | 'ev';

export function VerdiFormulaSlot({ card, median = null }: { readonly card: VerdiCard; readonly median?: ReactNode }) {
  const context = useContext(VerdiViewContext);
  if (context === null) throw new Error('a Verdi drill-down outside the Verdi panel');
  const { view, share } = context;
  const lines = (texts: readonly (string | null)[]) =>
    texts.flatMap((text, i) => (text === null ? [] : [<Chip key={i}>{text}</Chip>]));
  switch (card) {
    case 'profit':
      return share === 'median' ? median : lines([view.profit.shareLine]);
    case 'ev':
      return (
        <>
          {share === 'median' ? median : lines([view.profit.shareLine])}
          {lines([view.ev.kind === 'value' ? view.ev.product : null])}
        </>
      );
    case 'workingCapital':
      return lines(view.workingCapital.shareLines);
    case 'oml':
      return lines([view.oml.shareLine]);
  }
}
