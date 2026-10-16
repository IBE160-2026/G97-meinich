// The driftsmargin kroner amount as text, for both places it is shown: the
// Nøkkeltall og gap table's gap cell (Story 1.8) and the Oversikt hero
// (Story 1.9). One function, so the two strings cannot differ for the same
// benchmark: the exact øre are rounded once, here, through formatKronerExact
// (AD-8), never rounded first and formatted again.
import type { KronerGap } from '@/engine/benchmark';
import { formatKronerExact } from '@/engine/format';

export function kronerAmountText(gap: Extract<KronerGap, { readonly kind: 'amount' }>): string {
  return formatKronerExact(gap.ore.toString());
}
