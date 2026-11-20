// Type test (Story 3.5; AD-6), checked by `pnpm typecheck`, never run: a
// client prop that holds money or a ratio is a `WireDecimal`, so a `number`
// or a plain `string` in its place is a type error. Each `@ts-expect-error`
// fails the typecheck if the line below it ever compiles.
import { valueAtShare, type Multiple } from '../../src/engine/closable.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { toWire, type WireDecimal } from '../../src/engine/wire.ts';
import { defaultState, parseMultippel, type AnalysisState } from '../../src/url/analysis-state.ts';
import type { CapitalWire, ProfitWire, StepWire, VerdiWire } from '../../src/analysis/verdi-view.ts';
import type { VerdiPanel } from '../../src/components/analysis/verdi-panel.tsx';

type PanelProps = Parameters<typeof VerdiPanel>[0];

const exact: WireDecimal = toWire(new Decimal('1752531.46'));

// @ts-expect-error a number is not a wire decimal
export const fromNumber: WireDecimal = 1752531.46;
// @ts-expect-error a plain string is not a wire decimal
export const fromString: WireDecimal = '1752531.46';

export const profit: ProfitWire = { kind: 'amount', full: exact, atMedian: null, median: null };
export const profitNumber: ProfitWire = {
  kind: 'amount',
  // @ts-expect-error the full amount as a number
  full: 1752531.46,
  atMedian: null,
  median: null,
};
export const profitString: ProfitWire = {
  kind: 'amount',
  full: exact,
  // @ts-expect-error the profit at the median as a plain string
  atMedian: '212807.376',
  median: null,
};
// @ts-expect-error s_med as a number
export const stepNumber: StepWire = { kind: 'exists', sMed: 0.1214 };
// @ts-expect-error a capital amount as a plain string
export const capitalString: CapitalWire = { kind: 'amount', full: '100000', median: null };

export const wire: VerdiWire = {
  step: { kind: 'exists', sMed: toWire(new Decimal('0.1214')) },
  profit,
  workingCapital: { kind: 'text', text: '', detail: null },
  oml: { kind: 'text', text: '', detail: null, median: null },
};
export const props: PanelProps = { wire, provenance: { profit: null, workingCapital: null, oml: null, ev: null } };
export const propsNumber: PanelProps = {
  // @ts-expect-error the panel's wire holds no number
  wire: { ...wire, step: { kind: 'exists', sMed: 0.1214 } },
};

// Story 3.6, decision 2: a multiple is a `Multiple`, which only
// `parseMultippel` makes; a plain Decimal or a number in its place is a type error.
// @ts-expect-error a plain Decimal is not a multiple
export const plainMultiple: Multiple = new Decimal('6.5');
export const parsedMultiple: Multiple | null = parseMultippel('6,5');
// @ts-expect-error the URL state's multiple is never a plain Decimal
export const stateWithDecimal: AnalysisState = { ...defaultState('813235552'), multippel: new Decimal('6.5') };
export const stateWithParsed: AnalysisState = { ...defaultState('813235552'), multippel: parsedMultiple };
// @ts-expect-error valueAtShare takes only a Multiple
export const valueOfDecimal = valueAtShare(new Decimal(1000), null, 50, new Decimal('6.5'));
// @ts-expect-error nor a number
export const valueOfNumber = valueAtShare(new Decimal(1000), null, 50, 6.5);
