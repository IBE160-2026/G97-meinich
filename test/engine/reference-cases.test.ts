// Reference cases for the three API key figures (NFR28, SM-6), from real
// filings in the committed demo seed. Inputs are copied byte for byte from
// `seed/demo/key_figures.csv` (øre); the filing is the row in
// `seed/demo/filing.csv` with that brreg_id. The expected values come from
// the calculation in each comment, not from the engine: every step is
// written out in kroner so it can be redone by hand, and each quotient was
// computed independently of the engine (Python's `decimal` module, 40
// digits), then rounded to 20 significant digits and to one decimal in
// percent, half away from zero.
//
// Figures: margin = driftsresultat / sumDriftsinntekter,
//          ROA = driftsresultat / sumEiendeler,
//          equity ratio = sumEgenkapital / sumEiendeler.
// Derivation (one level, stated values only): sumDriftsinntekter =
// driftsresultat + sumDriftskostnad; driftsresultat = sumDriftsinntekter −
// sumDriftskostnad; sumEiendeler = sumEgenkapitalGjeld; sumEgenkapital =
// sumEgenkapitalGjeld − sumGjeld. A derived denominator within ±5 kr of zero
// is not positive.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/engine/decimal.ts';
import { formatPercent } from '../../src/engine/format.ts';
import { apiInputsFromRow, type KeyFiguresRow } from '../../src/engine/inputs.ts';
import { computeApiKeyFigures } from '../../src/engine/key-figures.ts';
import type { ApiKeyFigures, FigureResult, UndefinedCause } from '../../src/engine/types.ts';

type Row = Parameters<typeof apiInputsFromRow>[0] & Pick<KeyFiguresRow, 'brreg_id'>;

/** A defined figure: the fraction to 20 significant digits and the displayed percent. */
type Expected = { readonly fraction20: string; readonly percent: string } | { readonly undefined: UndefinedCause };

type Case = {
  readonly orgnr: string;
  readonly name: string;
  readonly filingYear: number;
  readonly row: Row;
  readonly expected: Record<keyof ApiKeyFigures, Expected>;
};

const NBSP = ' ';
const MINUS = '−';

const CASES: readonly Case[] = [
  // 979803125 BMC SOFTWARE AS, filing year 2025 (brreg_id 6322367, period
  // 2024-04-01 – 2025-03-31). Normal case, all inputs stated.
  //   driftsresultat      3 238 147 kr
  //   sumDriftsinntekter 15 600 610 kr
  //   sumEiendeler       32 244 328 kr
  //   sumEgenkapital     19 226 142 kr
  //   margin = 3 238 147 / 15 600 610  = 0.20756540930130296187… → 20,8 %
  //   ROA    = 3 238 147 / 32 244 328  = 0.10042532131542639065… → 10,0 %
  //   equity = 19 226 142 / 32 244 328 = 0.59626431042383640310… → 59,6 %
  {
    orgnr: '979803125',
    name: 'BMC SOFTWARE AS',
    filingYear: 2025,
    row: {
      brreg_id: '6322367',
      driftsresultat_ore: '323814700',
      sum_driftsinntekter_ore: '1560061000',
      sum_driftskostnad_ore: '1236246300',
      sum_eiendeler_ore: '3224432800',
      sum_egenkapital_gjeld_ore: '3224432800',
      sum_egenkapital_ore: '1922614200',
      sum_gjeld_ore: '1301818600',
    },
    expected: {
      driftsmargin: { fraction20: '0.20756540930130296187', percent: `20,8${NBSP}%` },
      totalkapitalrentabilitet: { fraction20: '0.10042532131542639065', percent: `10,0${NBSP}%` },
      egenkapitalandel: { fraction20: '0.59626431042383640310', percent: `59,6${NBSP}%` },
    },
  },
  // 921708750 TRACSENSE AS, filing year 2020 (brreg_id 2586403). Negative
  // equity: the equity ratio is defined and negative, not undefined.
  //   driftsresultat     −1 150 973 kr
  //   sumDriftsinntekter  3 174 472 kr
  //   sumEiendeler        1 578 532 kr
  //   sumEgenkapital     −4 360 800 kr
  //   margin = −1 150 973 / 3 174 472 = −0.36257147645340705478… → −36,3 %
  //   ROA    = −1 150 973 / 1 578 532 = −0.72914137945888965190… → −72,9 %
  //   equity = −4 360 800 / 1 578 532 = −2.7625667392235317371…  → −276,3 %
  {
    orgnr: '921708750',
    name: 'TRACSENSE AS',
    filingYear: 2020,
    row: {
      brreg_id: '2586403',
      driftsresultat_ore: '-115097300',
      sum_driftsinntekter_ore: '317447200',
      sum_driftskostnad_ore: '432544500',
      sum_eiendeler_ore: '157853200',
      sum_egenkapital_gjeld_ore: '157853200',
      sum_egenkapital_ore: '-436080000',
      sum_gjeld_ore: '593933200',
    },
    expected: {
      driftsmargin: { fraction20: '-0.36257147645340705478', percent: `${MINUS}36,3${NBSP}%` },
      totalkapitalrentabilitet: { fraction20: '-0.72914137945888965190', percent: `${MINUS}72,9${NBSP}%` },
      egenkapitalandel: { fraction20: '-2.7625667392235317371', percent: `${MINUS}276,3${NBSP}%` },
    },
  },
  // 924971487 PAF SOFTWARE AS, filing year 2021 (brreg_id 3384677). Stated
  // zero revenue: margin undefined, the other two computed.
  //   driftsresultat         −9 728 kr
  //   sumDriftsinntekter          0 kr (stated)
  //   sumEiendeler            6 361 kr
  //   sumEgenkapital          6 361 kr
  //   margin = −9 728 / 0 → undefined, denominator not positive
  //   ROA    = −9 728 / 6 361 = −1.5293192894199025310… → −152,9 %
  //   equity = 6 361 / 6 361  = 1                       → 100,0 %
  {
    orgnr: '924971487',
    name: 'PAF SOFTWARE AS',
    filingYear: 2021,
    row: {
      brreg_id: '3384677',
      driftsresultat_ore: '-972800',
      sum_driftsinntekter_ore: '0',
      sum_driftskostnad_ore: '972800',
      sum_eiendeler_ore: '636100',
      sum_egenkapital_gjeld_ore: '636100',
      sum_egenkapital_ore: '636100',
      sum_gjeld_ore: '0',
    },
    expected: {
      driftsmargin: { undefined: 'denominator_not_positive' },
      totalkapitalrentabilitet: { fraction20: '-1.5293192894199025310', percent: `${MINUS}152,9${NBSP}%` },
      egenkapitalandel: { fraction20: '1', percent: `100,0${NBSP}%` },
    },
  },
  // 926662600 APP1 AS, filing year 2023 (brreg_id 4853771). driftsresultat
  // and sumDriftskostnad are both empty, so driftsresultat cannot be derived
  // (sumDriftsinntekter − sumDriftskostnad needs both).
  //   driftsresultat         NULL, underivable
  //   sumDriftsinntekter        0 kr (stated)
  //   sumEiendeler          4 494 kr
  //   sumEgenkapital       20 494 kr (sumGjeld is −16 000 kr as filed)
  //   margin → undefined, component missing (checked before the zero denominator)
  //   ROA    → undefined, component missing
  //   equity = 20 494 / 4 494 = 4.5603026257231864709… → 456,0 %
  {
    orgnr: '926662600',
    name: 'APP1 AS',
    filingYear: 2023,
    row: {
      brreg_id: '4853771',
      driftsresultat_ore: null,
      sum_driftsinntekter_ore: '0',
      sum_driftskostnad_ore: null,
      sum_eiendeler_ore: '449400',
      sum_egenkapital_gjeld_ore: '449400',
      sum_egenkapital_ore: '2049400',
      sum_gjeld_ore: '-1600000',
    },
    expected: {
      driftsmargin: { undefined: 'component_missing' },
      totalkapitalrentabilitet: { undefined: 'component_missing' },
      egenkapitalandel: { fraction20: '4.5603026257231864709', percent: `456,0${NBSP}%` },
    },
  },
  // 919728574 JOAKIM BORDING AS, filing year 2025 (brreg_id 6741746).
  // sumEgenkapital and sumDriftsinntekter are empty and both derived.
  //   driftsresultat       −17 003 kr
  //   sumDriftskostnad      17 004 kr
  //   sumDriftsinntekter   NULL → derived −17 003 + 17 004 = 1 kr
  //   sumEiendeler         196 779 kr
  //   sumEgenkapitalGjeld  196 779 kr, sumGjeld 30 327 kr
  //   sumEgenkapital       NULL → derived 196 779 − 30 327 = 166 452 kr
  //   margin: derived denominator 1 kr is within ±5 kr of zero → undefined,
  //           denominator not positive
  //   ROA    = −17 003 / 196 779  = −0.086406577937686440118… → −8,6 %
  //   equity = 166 452 / 196 779  = 0.84588294482642964951…  → 84,6 %
  {
    orgnr: '919728574',
    name: 'JOAKIM BORDING AS',
    filingYear: 2025,
    row: {
      brreg_id: '6741746',
      driftsresultat_ore: '-1700300',
      sum_driftsinntekter_ore: null,
      sum_driftskostnad_ore: '1700400',
      sum_eiendeler_ore: '19677900',
      sum_egenkapital_gjeld_ore: '19677900',
      sum_egenkapital_ore: null,
      sum_gjeld_ore: '3032700',
    },
    expected: {
      driftsmargin: { undefined: 'denominator_not_positive' },
      totalkapitalrentabilitet: { fraction20: '-0.086406577937686440118', percent: `${MINUS}8,6${NBSP}%` },
      egenkapitalandel: { fraction20: '0.84588294482642964951', percent: `84,6${NBSP}%` },
    },
  },
  // 931165992 SIGMA DATA SOLUTIONS AS, filing year 2023 (brreg_id 4682315).
  // Negative total assets as filed: ROA and equity ratio undefined, not a
  // sign-flipped ratio.
  //   driftsresultat       −15 108 kr
  //   sumDriftsinntekter     4 870 kr
  //   sumEiendeler         −17 767 kr (stated)
  //   sumEgenkapital        15 109 kr
  //   margin = −15 108 / 4 870 = −3.1022587268993839836… → −310,2 %
  //   ROA    → undefined, denominator not positive
  //   equity → undefined, denominator not positive
  {
    orgnr: '931165992',
    name: 'SIGMA DATA SOLUTIONS AS',
    filingYear: 2023,
    row: {
      brreg_id: '4682315',
      driftsresultat_ore: '-1510800',
      sum_driftsinntekter_ore: '487000',
      sum_driftskostnad_ore: '1997800',
      sum_eiendeler_ore: '-1776700',
      sum_egenkapital_gjeld_ore: '1401900',
      sum_egenkapital_ore: '1510900',
      sum_gjeld_ore: '-109000',
    },
    expected: {
      driftsmargin: { fraction20: '-3.1022587268993839836', percent: `${MINUS}310,2${NBSP}%` },
      totalkapitalrentabilitet: { undefined: 'denominator_not_positive' },
      egenkapitalandel: { undefined: 'denominator_not_positive' },
    },
  },
];

function check(actual: FigureResult, expected: Expected): void {
  if ('undefined' in expected) {
    expect(actual).toEqual({ kind: 'absent', absence: { reason: 'undefined', cause: expected.undefined } });
    return;
  }
  if (actual.kind !== 'value') throw new Error(`expected a value, got ${JSON.stringify(actual.absence)}`);
  expect(actual.source).toBe('api');
  // Compared as numbers: a 20-digit value may end in a zero the string drops.
  expect(actual.value.toSignificantDigits(20).toString()).toBe(new Decimal(expected.fraction20).toString());
  expect(formatPercent(actual.value.toString())).toBe(expected.percent);
}

describe('reference cases from filed accounts', () => {
  describe.each(CASES)('$orgnr $name, filing year $filingYear', ({ row, expected }) => {
    const figures = computeApiKeyFigures(apiInputsFromRow(row));
    it.each(['driftsmargin', 'totalkapitalrentabilitet', 'egenkapitalandel'] as const)('%s', (key) => {
      check(figures[key], expected[key]);
    });
  });
});
