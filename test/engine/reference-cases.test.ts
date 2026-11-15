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
import { DOCUMENT_KEY_FIGURE_KEYS, type DocumentKeyFigure } from '../../src/engine/document-absence.ts';
import { computeDocumentKeyFigures } from '../../src/engine/document-key-figures.ts';
import { computeApiKeyFigures } from '../../src/engine/key-figures.ts';
import type { ApiKeyFigures, FigureAbsence, FigureResult, UndefinedCause } from '../../src/engine/types.ts';
import { seedApiInputs, seedDocumentBasis, seedDocumentBrregId, seedFigure, transcribed } from './reference-seed.ts';

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

// ---------------------------------------------------------------------------
// Story 3.1a: the document key figures (2–11, 14 and kontantandel), and the
// API figures of the same filings where the matrix names them, from the OCR
// reference set's allow-listed companies outside the labelled set. Each
// company's document basis is built from the committed demo seed exactly as
// the request path builds it (`reference-seed.ts`); the expected values are
// the printed figures of the filed PDF as fractions in whole kroner, written
// out by hand from the page named in each comment (PDF page numbers, 1 =
// the register's cover page; the PDFs are in .local/ocr-reference/,
// gitignored). Every figure the engine reads as stated must equal Meinich's
// transcription of that page (analysis/ocr-reference/transcriptions.csv);
// the test asserts it. A line printed on the page but not read (NULL in the
// seed) is said so in the comment, and the figure that needs it is
// undefined, never computed from the printed value.
//
// Cost lines (decision 1): with sum kostnader stated, every empty cost line
// is 0 when the stated lines are within ±5 kr of it; one empty line above
// +5 kr is the remainder; otherwise each empty line is undefined.
// ---------------------------------------------------------------------------

type DocExpected =
  | { readonly fraction: readonly [bigint, bigint] }
  | { readonly undefined: UndefinedCause }
  | { readonly absent: FigureAbsence };

type DocCase = {
  readonly orgnr: string;
  readonly name: string;
  readonly filingYear: number;
  readonly expected: Readonly<Record<DocumentKeyFigure, DocExpected>>;
  /** The API figures of the document's own filing (register.document.brreg_id), where the case is about them. */
  readonly api?: Readonly<Partial<Record<keyof ApiKeyFigures, DocExpected>>>;
};

const LABELS: Readonly<Record<DocumentKeyFigure | keyof ApiKeyFigures, string>> = {
  ebitda: 'EBITDA margin',
  vare: 'cost of goods share',
  lonn: 'personnel cost share',
  andre: 'other operating cost share',
  total: 'total cost share',
  omsArsverk: 'revenue per FTE',
  lonnArsverk: 'personnel cost per FTE',
  kfd: 'receivable days',
  lgd: 'payable days',
  oml: 'operating asset turnover',
  vekst: 'revenue growth',
  kontant: 'cash share',
  driftsmargin: 'operating margin',
  totalkapitalrentabilitet: 'return on assets',
  egenkapitalandel: 'equity ratio',
};

const NOTES: DocExpected = { absent: { reason: 'not_read_in_v1', scope: 'notes' } };
const FAILED: DocExpected = { absent: { reason: 'failed_reconciliation' } };
const MISSING: DocExpected = { undefined: 'component_missing' };
const NOT_POSITIVE: DocExpected = { undefined: 'denominator_not_positive' };
const f = (numerator: bigint, denominator: bigint): DocExpected => ({ fraction: [numerator, denominator] });

const DOC_CASES: readonly DocCase[] = [
  // 911561972 DASSAULT SYSTEMES NORWAY AS, 2024. Income statement p. 2,
  // assets p. 3, leverandørgjeld p. 4. No varekostnad or nedskrivning line is
  // printed: the stated lines 3 695 406 + 1 390 183 + 68 664 140 = 73 749 729
  // equal sum kostnader, so both are 0, derived. Prior column (2023, p. 2)
  // reconciled and agrees with the API.
  {
    orgnr: '911561972',
    name: 'DASSAULT SYSTEMES NORWAY AS',
    filingYear: 2024,
    expected: {
      ebitda: f(2_462_935n + 1_390_183n + 0n, 76_212_664n),
      vare: f(0n, 76_212_664n),
      lonn: f(3_695_406n, 76_212_664n),
      andre: f(68_664_140n, 76_212_664n),
      total: f(0n + 3_695_406n + 68_664_140n, 76_212_664n),
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: f(10_980_793n * 365n, 76_212_664n),
      lgd: f(6_253_713n * 365n, 0n + 68_664_140n),
      oml: f(76_212_664n, 51_096_403n - 2_355_152n),
      vekst: f(76_212_664n - 48_329_051n, 48_329_051n),
      kontant: f(2_355_152n, 51_096_403n),
    },
  },
  // 915338534 HALLO VERDEN AS, 2023. Income statement p. 2, assets p. 3,
  // leverandørgjeld p. 4. Lønnskostnad (printed 8 605 849) and salgsinntekt
  // (printed 12 808 765) were not read. With nedskrivninger also empty, two
  // cost lines are empty and the remainder 9 505 586 − (36 584 + 42 117 +
  // 821 036) = 8 605 849 kr is outside ±5 kr: both undefined. Prior (2022)
  // reconciled with no API filing to check against: used.
  {
    orgnr: '915338534',
    name: 'HALLO VERDEN AS',
    filingYear: 2023,
    expected: {
      ebitda: MISSING,
      vare: f(36_584n, 12_808_765n),
      lonn: MISSING,
      andre: f(821_036n, 12_808_765n),
      total: MISSING,
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: MISSING,
      lgd: f(23_801n * 365n, 36_584n + 821_036n),
      oml: f(12_808_765n, 9_277_449n - 7_052_584n),
      vekst: f(12_808_765n - 9_012_712n, 9_012_712n),
      kontant: f(7_052_584n, 9_277_449n),
    },
  },
  // 915648479 WELD IT AS, 2021. Income statement p. 2, assets p. 3,
  // leverandørgjeld p. 4. No nedskrivning line: 1 203 977 + 1 924 850 +
  // 200 052 + 1 621 328 = 4 950 207 = sum kostnader, so 0, derived. No
  // key-figures filing for 2021 (R3 not applied); prior (2020) reconciled.
  {
    orgnr: '915648479',
    name: 'WELD IT AS',
    filingYear: 2021,
    expected: {
      ebitda: f(1_926_418n + 200_052n + 0n, 6_876_625n),
      vare: f(1_203_977n, 6_876_625n),
      lonn: f(1_924_850n, 6_876_625n),
      andre: f(1_621_328n, 6_876_625n),
      total: f(1_203_977n + 1_924_850n + 1_621_328n, 6_876_625n),
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: f(774_589n * 365n, 6_876_625n),
      lgd: f(204_155n * 365n, 1_203_977n + 1_621_328n),
      oml: f(6_876_625n, 4_101_424n - 2_666_243n),
      vekst: f(6_876_625n - 3_659_013n, 3_659_013n),
      kontant: f(2_666_243n, 4_101_424n),
    },
  },
  // 917397198 KULT BYRÅ AS, 2021. Income statement p. 2, assets p. 4,
  // leverandørgjeld p. 5. No avskrivning or nedskrivning line: the stated
  // lines 150 373 + 4 292 309 + 1 161 029 = 5 603 711 are 1 kr over sum
  // kostnader 5 603 710, within ±5 kr, so both 0. Salgsinntekt (printed
  // 5 661 887) was not read: receivable days undefined.
  {
    orgnr: '917397198',
    name: 'KULT BYRÅ AS',
    filingYear: 2021,
    expected: {
      ebitda: f(807_435n + 0n + 0n, 6_411_146n),
      vare: f(150_373n, 6_411_146n),
      lonn: f(4_292_309n, 6_411_146n),
      andre: f(1_161_029n, 6_411_146n),
      total: f(150_373n + 4_292_309n + 1_161_029n, 6_411_146n),
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: MISSING,
      lgd: f(50_364n * 365n, 150_373n + 1_161_029n),
      oml: f(6_411_146n, 3_290_158n - 2_745_620n),
      vekst: f(6_411_146n - 4_602_804n, 4_602_804n),
      kontant: f(2_745_620n, 3_290_158n),
    },
  },
  // 917526729 TABELLAE AS, 2025. Income statement p. 2, assets p. 3,
  // leverandørgjeld p. 4. No avskrivning or nedskrivning line: 3 453 196 +
  // 2 729 960 + 1 844 904 = 8 028 060, 1 kr over 8 028 059, so both 0.
  // Kundefordringer (printed 864 869) and salgsinntekt (printed 11 245 099)
  // were not read.
  {
    orgnr: '917526729',
    name: 'TABELLAE AS',
    filingYear: 2025,
    expected: {
      ebitda: f(3_217_040n + 0n + 0n, 11_245_099n),
      vare: f(3_453_196n, 11_245_099n),
      lonn: f(2_729_960n, 11_245_099n),
      andre: f(1_844_904n, 11_245_099n),
      total: f(3_453_196n + 2_729_960n + 1_844_904n, 11_245_099n),
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: MISSING,
      lgd: f(770_634n * 365n, 3_453_196n + 1_844_904n),
      oml: f(11_245_099n, 14_021_777n - 11_625_207n),
      vekst: f(11_245_099n - 11_015_493n, 11_015_493n),
      kontant: f(11_625_207n, 14_021_777n),
    },
  },
  // 918618716 EPSIRO AS, 2025. Income statement p. 2; kundefordringer and
  // bankinnskudd p. 4; sum eiendeler and leverandørgjeld p. 5. No
  // nedskrivning line: 67 562 + 998 004 + 64 200 + 369 094 = 1 498 860, 1 kr
  // under 1 498 861, so 0. Salgsinntekt (printed 1 733 466) was not read.
  // Revenue fell: growth is negative.
  {
    orgnr: '918618716',
    name: 'EPSIRO AS',
    filingYear: 2025,
    expected: {
      ebitda: f(236_562n + 64_200n + 0n, 1_735_423n),
      vare: f(67_562n, 1_735_423n),
      lonn: f(998_004n, 1_735_423n),
      andre: f(369_094n, 1_735_423n),
      total: f(67_562n + 998_004n + 369_094n, 1_735_423n),
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: MISSING,
      lgd: f(52_361n * 365n, 67_562n + 369_094n),
      oml: f(1_735_423n, 11_259_726n - 410_284n),
      vekst: f(1_735_423n - 2_635_230n, 2_635_230n),
      kontant: f(410_284n, 11_259_726n),
    },
  },
  // 927533235 MEDICUE AS, 2023. Negative equity. Income statement p. 2,
  // assets p. 3, leverandørgjeld p. 4. Lønnskostnad (printed 1 448 646) was
  // not read; with nedskrivninger also empty, the remainder 2 280 576 −
  // (9 102 + 67 977 + 754 851) = 1 448 646 kr leaves both undefined. No
  // kundefordringer is printed for 2023. The API filing (brreg_id 5067689):
  // driftsresultat −1 898 125, sumDriftsinntekter 382 451, sumEiendeler
  // 1 427 357, sumEgenkapital −2 140 770 — equity ratio negative and defined.
  {
    orgnr: '927533235',
    name: 'MEDICUE AS',
    filingYear: 2023,
    expected: {
      ebitda: MISSING,
      vare: f(9_102n, 382_451n),
      lonn: MISSING,
      andre: f(754_851n, 382_451n),
      total: MISSING,
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: MISSING,
      lgd: f(100_889n * 365n, 9_102n + 754_851n),
      oml: f(382_451n, 1_427_357n - 690_813n),
      vekst: f(382_451n - 529_000n, 529_000n),
      kontant: f(690_813n, 1_427_357n),
    },
    api: {
      driftsmargin: f(-1_898_125n, 382_451n),
      totalkapitalrentabilitet: f(-1_898_125n, 1_427_357n),
      egenkapitalandel: f(-2_140_770n, 1_427_357n),
    },
  },
  // 936252710 LINK NORDIC AS, 2024. Income statement p. 2, assets p. 3,
  // leverandørgjeld p. 4. Lønnskostnad (printed 11 978 000) and annen
  // driftskostnad (printed 3 804 886) were not read; with nedskrivninger
  // empty too, the remainder 52 751 211 − (36 700 241 + 268 084) =
  // 15 782 886 kr leaves all three undefined. The prior column (2023) failed
  // reconciliation: growth lacks a component.
  {
    orgnr: '936252710',
    name: 'LINK NORDIC AS',
    filingYear: 2024,
    expected: {
      ebitda: MISSING,
      vare: f(36_700_241n, 55_782_498n),
      lonn: MISSING,
      andre: MISSING,
      total: MISSING,
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: f(12_452_560n * 365n, 55_461_947n),
      lgd: MISSING,
      oml: f(55_782_498n, 32_693_207n - 3_027_167n),
      vekst: MISSING,
      kontant: f(3_027_167n, 32_693_207n),
    },
  },
  // 989081799 CONTACT HOLDING AS, 2025. Zero revenue: sum inntekter 0
  // (p. 2) is stated, so every figure over it is not positive, and so is the
  // API margin. Varekostnad, avskrivninger and nedskrivninger are not
  // printed; lønnskostnad 0 + annen driftskostnad 68 570 = sum kostnader
  // 68 570, so all three are 0, derived, and payable days are defined over
  // 0 + 68 570 (leverandørgjeld p. 4). No kundefordringer is printed;
  // bankinnskudd is printed as 0 (p. 3) but was not read. Prior (2024)
  // revenue 14 923 kr: growth −100 %.
  {
    orgnr: '989081799',
    name: 'CONTACT HOLDING AS',
    filingYear: 2025,
    expected: {
      ebitda: NOT_POSITIVE,
      vare: NOT_POSITIVE,
      lonn: NOT_POSITIVE,
      andre: NOT_POSITIVE,
      total: NOT_POSITIVE,
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: MISSING,
      lgd: f(22_112n * 365n, 0n + 68_570n),
      oml: MISSING,
      vekst: f(0n - 14_923n, 14_923n),
      kontant: MISSING,
    },
    api: {
      driftsmargin: NOT_POSITIVE,
      totalkapitalrentabilitet: f(-68_570n, 1_398_134n),
      egenkapitalandel: f(-1_423_977n, 1_398_134n),
    },
  },
  // 992036079 NTT DATA BUSINESS SOLUTIONS AS, 2023: a non-calendar year
  // (2022-04-01 – 2023-03-31), so funnel stage 2 excludes it (peers.test.ts);
  // its own figures are still computed. Income statement p. 2, assets p. 3,
  // leverandørgjeld p. 4. No nedskrivning line: 85 742 422 + 102 131 091 +
  // 373 073 + 13 686 281 = 201 932 867 = sum kostnader, so 0.
  {
    orgnr: '992036079',
    name: 'NTT DATA BUSINESS SOLUTIONS AS',
    filingYear: 2023,
    expected: {
      ebitda: f(27_990_089n + 373_073n + 0n, 229_922_956n),
      vare: f(85_742_422n, 229_922_956n),
      lonn: f(102_131_091n, 229_922_956n),
      andre: f(13_686_281n, 229_922_956n),
      total: f(85_742_422n + 102_131_091n + 13_686_281n, 229_922_956n),
      omsArsverk: NOTES,
      lonnArsverk: NOTES,
      kfd: f(57_853_371n * 365n, 229_922_956n),
      lgd: f(8_650_231n * 365n, 85_742_422n + 13_686_281n),
      oml: f(229_922_956n, 175_826_882n - 110_738_029n),
      vekst: f(229_922_956n - 250_660_606n, 250_660_606n),
      kontant: f(110_738_029n, 175_826_882n),
    },
  },
  // 885583822 VISIONTECH AS, 2022 (income statement p. 2) and 929821092
  // SOURCEMAGNET AS, 2022 (p. 2): the current column failed reconciliation,
  // so no document figure is read, and none is estimated (FR-71).
  ...(['885583822', '929821092'] as const).map(
    (orgnr): DocCase => ({
      orgnr,
      name: orgnr === '885583822' ? 'VISIONTECH AS' : 'SOURCEMAGNET AS',
      filingYear: 2022,
      expected: {
        ebitda: FAILED,
        vare: FAILED,
        lonn: FAILED,
        andre: FAILED,
        total: FAILED,
        omsArsverk: NOTES,
        lonnArsverk: NOTES,
        kfd: FAILED,
        lgd: FAILED,
        oml: FAILED,
        vekst: FAILED,
        kontant: FAILED,
      },
    }),
  ),
];

function checkDocument(orgnr: string, filingYear: number, actual: FigureResult, expected: DocExpected): void {
  if ('absent' in expected) {
    expect(actual).toEqual({ kind: 'absent', absence: expected.absent });
    return;
  }
  if ('undefined' in expected) {
    expect(actual).toEqual({ kind: 'absent', absence: { reason: 'undefined', cause: expected.undefined } });
    return;
  }
  if (actual.kind !== 'value') throw new Error(`expected a value, got ${JSON.stringify(actual.absence)}`);
  const [numerator, denominator] = expected.fraction;
  const hand = new Decimal(numerator.toString()).div(new Decimal(denominator.toString()));
  expect(actual.value.eq(hand), `${actual.value.toString()} ≠ ${hand.toString()}`).toBe(true);
  // Every input read as stated is the figure printed on the page.
  for (const input of actual.inputs) {
    if (input.column === 'api' || input.field === 'aarsverk' || input.derived) continue;
    expect(seedFigure(orgnr, filingYear, input.column, input.field), `${input.column} ${input.field}`).toBe(
      transcribed(orgnr, filingYear, input.column, input.field),
    );
  }
}

describe('reference cases for the document key figures', () => {
  for (const c of DOC_CASES) {
    const figures = computeDocumentKeyFigures(seedDocumentBasis(c.orgnr, c.filingYear));
    for (const figure of DOCUMENT_KEY_FIGURE_KEYS) {
      it(`${c.orgnr} ${c.filingYear}: ${LABELS[figure]}`, () => {
        checkDocument(c.orgnr, c.filingYear, figures[figure], c.expected[figure]);
      });
    }
    const api = c.api;
    if (api === undefined) continue;
    const brregId = seedDocumentBrregId(c.orgnr, c.filingYear);
    if (brregId === null) throw new Error(`${c.orgnr} ${c.filingYear} has no key-figures filing`);
    const own = computeApiKeyFigures(seedApiInputs(brregId));
    for (const key of Object.keys(api) as (keyof ApiKeyFigures)[]) {
      const expected = api[key];
      if (expected === undefined) continue;
      it(`${c.orgnr} ${c.filingYear}: ${LABELS[key]}`, () => {
        checkDocument(c.orgnr, c.filingYear, own[key], expected);
      });
    }
  }

  it('records a case for every allow-listed reference company outside the labelled set', () => {
    expect(new Set(DOC_CASES.map((c) => c.orgnr))).toEqual(
      new Set([
        '885583822',
        '911561972',
        '915338534',
        '915648479',
        '917397198',
        '917526729',
        '918618716',
        '927533235',
        '929821092',
        '936252710',
        '989081799',
        '992036079',
      ]),
    );
  });
});
