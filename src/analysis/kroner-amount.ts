// The kroner amounts as text, for every place they are shown: the
// driftsmargin amount in the Nøkkeltall og gap table's gap cell (Story 1.8)
// and the Oversikt hero (Story 1.9), and the one-off capital amounts of key
// figures 9, 10 and 11 in the table (Story 3.1b). One function per kind, so
// two places cannot word the same benchmark differently: the exact øre are
// rounded once, here, through formatKronerExact (AD-8), never rounded first
// and formatted again.
import type { CapitalGap, KronerGap } from '../engine/benchmark.ts';
import { formatKronerExact } from '../engine/format.ts';

export function kronerAmountText(gap: Extract<KronerGap, { readonly kind: 'amount' }>): string {
  return formatKronerExact(gap.ore.toString());
}

/** A capital amount at full convergence (an engangsbeløp, which the caller says beside it). */
export function capitalAmountText(gap: Extract<CapitalGap, { readonly kind: 'amount' }>): string {
  return formatKronerExact(gap.ore.toString());
}
