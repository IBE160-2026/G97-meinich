// The wire values of the identity test (Story 3.5; AD-6): Verdi wires as the
// server sends them, with 40-digit amounts and s_med, a negative amount, a
// zero, and each kind of card, so every text `verdiCards` writes is compared
// between Node and Chromium. Story 3.6 adds the multiples, as typed, and a
// wire whose profit at 50 % and at the median step is 999,5 kr, so the EV
// product line reads "≈" at 7. Story 3.7 adds a wire whose share lines read "=".
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
    // Rounding at the half, both signs: (11) 600 øre at 25 % is 1,5 kr, written "2 kr" ("2 kr av 6 kr");
    // the profit at the median, −50 øre, is −0,5 kr, written "−1 kr" ("−1 kr av −10 kr per år"). The
    // negative profit is a synthetic value, for the formatting only (the engine gives no negative
    // uplift). A zero; s_med rounding to under 1 %.
    step: { kind: 'exists', sMed: w('0.004999999999999999999999999999999999999') },
    profit: { kind: 'amount', full: w('-1000'), atMedian: w('-50'), median: null },
    workingCapital: {
      kind: 'parts',
      kfd: { label: 'Kundefordringsdager', value: { kind: 'amount', full: w('0') }, median: null },
      lgd: { label: 'Leverandørgjeldsdager', value: { kind: 'text', text: '▲ Styrke' }, median: null },
      total: { kind: 'amount', full: w('0') },
    },
    oml: { kind: 'amount', full: w('600'), median: 'Median nås ved over 99 %' },
  },
  {
    // No median step: the reason, and cards in words.
    step: { kind: 'none', reason: 'SYNTETISK AS ligger allerede over medianen. Medianen gjelder driftsmargin.' },
    profit: { kind: 'text', text: 'Beløpet er ikke i kroner', detail: null, median: 'Median: allerede over' },
    workingCapital: { kind: 'text', text: 'Ikke i demodataene', detail: null },
    oml: { kind: 'text', text: 'Ikke i demodataene', detail: null, median: null },
  },
  {
    // Story 3.6, the "≈" case: 999,5 kr at 50 % and at the median step, shown as 1 000 kr; × 7 is
    // 6 996,5 kr, written 6 997 kr, while 1 000 × 7 = 7 000.
    step: { kind: 'exists', sMed: w('0.5') },
    profit: { kind: 'amount', full: w('199900'), atMedian: w('99950'), median: 'Median nås ved 50 %' },
    workingCapital: { kind: 'text', text: 'Ikke i demodataene', detail: null },
    oml: { kind: 'text', text: 'Ikke i demodataene', detail: null, median: null },
  },
  {
    // Story 3.7, the "=" share lines: 1 170 000 kr × 50 % = 585 000 kr exactly, and at the median
    // step (s_med exactly 25 %) the capital amounts 3 500 kr × 25 % = 875 kr and 4 000 kr × 25 % =
    // 1 000 kr. (WIRES[0] gives the median step's "≈" with capital amounts.)
    step: { kind: 'exists', sMed: w('0.25') },
    profit: { kind: 'amount', full: w('117000000'), atMedian: w('29250000'), median: 'Median nås ved 25 %' },
    workingCapital: {
      kind: 'parts',
      kfd: { label: 'Kundefordringsdager', value: { kind: 'amount', full: w('300000') }, median: null },
      lgd: { label: 'Leverandørgjeldsdager', value: { kind: 'amount', full: w('100000') }, median: null },
      total: { kind: 'amount', full: w('400000') },
    },
    oml: { kind: 'amount', full: w('350000'), median: null },
  },
];

/** The multiples as a user types them (Story 3.6): the bounds, a comma, a whole number. */
export const MULTIPLES: readonly string[] = ['0,1', '6,5', '7', '50'];
