// The wire values of the identity test (Story 3.5; AD-6): Verdi wires as the
// server sends them, with 40-digit amounts and s_med, a negative amount, a
// zero, and each kind of card, so every text `verdiCards` writes is compared
// between Node and Chromium.
import type { VerdiWire } from '../../src/analysis/verdi-view.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { toWire } from '../../src/engine/wire.ts';

const w = (value: string) => toWire(new Decimal(value));

export const WIRES: readonly VerdiWire[] = [
  {
    // 40-digit values, as Decimal writes them; a median step between 0 and 25 %.
    step: { kind: 'exists', sMed: w('0.1476813311746338125625176207027973933165') },
    profit: {
      kind: 'amount',
      full: w('312845299.5081456755854992815196311169081'),
      atMedian: w('46201410.28308996610773093610055003447834'),
      median: 'Median nås ved 15 %',
    },
    workingCapital: {
      kind: 'parts',
      kfd: { label: 'Kundefordringsdager', value: { kind: 'amount', full: w('123456789.0123456789012345678901234567891') }, median: null },
      lgd: { label: 'Leverandørgjeldsdager', value: { kind: 'amount', full: w('50.5') }, median: 'Median nås ved 50 %' },
      total: { kind: 'amount', full: w('123456839.5123456789012345678901234567891') },
    },
    oml: { kind: 'amount', full: w('999999999999.99999999999999999999999999') , median: null },
  },
  {
    // Rounding at the half: 0,5 kr and −0,5 kr; a zero; s_med rounding to under 1 %.
    step: { kind: 'exists', sMed: w('0.004999999999999999999999999999999999999') },
    profit: { kind: 'amount', full: w('-150'), atMedian: w('-0.75'), median: null },
    workingCapital: {
      kind: 'parts',
      kfd: { label: 'Kundefordringsdager', value: { kind: 'amount', full: w('0') }, median: null },
      lgd: { label: 'Leverandørgjeldsdager', value: { kind: 'text', text: '▲ Styrke' }, median: null },
      total: { kind: 'amount', full: w('0') },
    },
    oml: { kind: 'amount', full: w('200'), median: 'Median nås ved over 99 %' },
  },
  {
    // No median step: the reason, and cards in words.
    step: { kind: 'none', reason: 'SYNTETISK AS ligger allerede over medianen. Medianen gjelder driftsmargin.' },
    profit: { kind: 'text', text: 'Beløpet er ikke i kroner', detail: null, median: 'Median: allerede over' },
    workingCapital: { kind: 'text', text: 'Ikke i demodataene', detail: null },
    oml: { kind: 'text', text: 'Ikke i demodataene', detail: null, median: null },
  },
];
