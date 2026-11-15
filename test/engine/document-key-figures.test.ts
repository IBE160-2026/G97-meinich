// The twelve document key figures computed from a company's document basis
// (Story 3.1a): each formula on a synthetic company, decision 1 (empty cost
// lines derived from sum kostnader), decision 2 (growth's prior column), a
// derived revenue of 5 kr or less, R3, and that an empty line is never 0.
// Every company here is synthetic; the reference cases from filed accounts
// are in reference-cases.test.ts.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/engine/decimal.ts';
import { DOCUMENT_KEY_FIGURE_KEYS } from '../../src/engine/document-absence.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentBasisInput,
  type DocumentColumnRow,
  type DocumentField,
  documentBasis,
  documentCostLines,
  documentFigures,
} from '../../src/engine/document-inputs.ts';
import {
  DOCUMENT_FIGURE_DIRECTIONS,
  DOCUMENT_FIGURE_RANKABLE,
  computeDocumentKeyFigures,
  documentKeyFigureFractions,
} from '../../src/engine/document-key-figures.ts';
import type { FigureResult } from '../../src/engine/types.ts';

// Revenue 10 000 000 kr; every line stated, nedskrivninger as 0.
const FIGURES: Record<DocumentField, string | null> = {
  salgsinntekt: '1000000000',
  sumDriftsinntekter: '1000000000',
  varekostnad: '100000000',
  lonnskostnad: '600000000',
  avskrivninger: '20000000',
  nedskrivninger: '0',
  annenDriftskostnad: '200000000',
  sumDriftskostnad: '920000000',
  driftsresultat: '80000000',
  nettoFinans: '1000000',
  ordinaertResultatFoerSkattekostnad: '81000000',
  aarsresultat: '63000000',
  sumImmaterielleEiendeler: null,
  sumVarigeDriftsmidler: '30000000',
  varer: null,
  kundefordringer: '150000000',
  bankinnskudd: '200000000',
  sumEiendeler: '400000000',
  sumEgenkapital: '150000000',
  leverandorgjeld: '40000000',
  sumKortsiktigGjeld: '250000000',
  sumGjeld: '250000000',
  sumEgenkapitalGjeld: '400000000',
  forskningOgUtvikling: null,
  konsesjonerPatenter: null,
  goodwill: null,
  utsattSkattefordel: null,
};

type Overrides = Partial<Record<DocumentField, string | null>>;

function column(status: string | null, overrides: Overrides = {}): DocumentColumnRow {
  const figures = { ...FIGURES, ...overrides };
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => [DOCUMENT_FIGURE_COLUMNS[field], figures[field]]),
  );
  return { status, ...columns } as DocumentColumnRow;
}

function basis(
  current: Overrides = {},
  prior: Overrides | null = { sumDriftsinntekter: '800000000' },
  extra: Partial<DocumentBasisInput> & { priorStatus?: string | null; priorApiFailFields?: readonly string[] | null } = {},
): DocumentBasis {
  const { priorStatus = 'reconciled', priorApiFailFields = [], ...input } = extra;
  return documentBasis({
    inManifest: true,
    filingYear: 2025,
    document: {
      status: 'reconciled',
      current: column('reconciled', current),
      prior: prior === null ? null : column(priorStatus, prior),
      priorApiFailFields,
    },
    sumOmloepsmidler: 360_000_000n,
    ...input,
  });
}

function value(result: FigureResult): Decimal {
  if (result.kind !== 'value') throw new Error(`expected a value, got ${JSON.stringify(result.absence)}`);
  return result.value;
}

const MISSING = { kind: 'absent', absence: { reason: 'undefined', cause: 'component_missing' } };
const NOT_POSITIVE = { kind: 'absent', absence: { reason: 'undefined', cause: 'denominator_not_positive' } };
const NOT_SAFE = { kind: 'absent', absence: { reason: 'undefined', cause: 'line_not_read_safely' } };

describe('each formula on a synthetic company', () => {
  const f = computeDocumentKeyFigures(basis());

  it('computes 2–6, 9–11, 14 and kontantandel as in docs/key-figures.md, exactly', () => {
    // (800 000 + 200 000 + 0) / 10 000 000
    expect(value(f.ebitda).eq(new Decimal(1_000_000).div(10_000_000))).toBe(true);
    expect(value(f.vare).eq(new Decimal(1_000_000).div(10_000_000))).toBe(true);
    expect(value(f.lonn).eq(new Decimal(6_000_000).div(10_000_000))).toBe(true);
    expect(value(f.andre).eq(new Decimal(2_000_000).div(10_000_000))).toBe(true);
    expect(value(f.total).eq(new Decimal(9_000_000).div(10_000_000))).toBe(true);
    // 1 500 000 × 365 / 10 000 000 = 54.75 days
    expect(value(f.kfd).toString()).toBe('54.75');
    // 400 000 × 365 / (1 000 000 + 2 000 000)
    expect(value(f.lgd).eq(new Decimal(400_000 * 365).div(3_000_000))).toBe(true);
    // 10 000 000 / (4 000 000 − 2 000 000)
    expect(value(f.oml).toString()).toBe('5');
    // 10 000 000 / 8 000 000 − 1
    expect(value(f.vekst).toString()).toBe('0.25');
    expect(value(f.kontant).toString()).toBe('0.5');
  });

  it('gives every value source document and names its inputs', () => {
    for (const key of DOCUMENT_KEY_FIGURE_KEYS) {
      const result = f[key];
      if (result.kind === 'value') expect(result.source, key).toBe('document');
    }
    expect(f.vekst).toMatchObject({
      inputs: [
        { field: 'sumDriftsinntekter', column: 'current', derived: false },
        { field: 'sumDriftsinntekter', column: 'prior', derived: false },
      ],
    });
    expect(f.oml).toMatchObject({
      inputs: [
        { field: 'sumDriftsinntekter', column: 'current', derived: false },
        { field: 'sumEiendeler', column: 'current', derived: false },
        { field: 'bankinnskudd', column: 'current', derived: false },
      ],
    });
  });

  it('leaves 7 and 8 not read in v1: aarsverk is in the notes', () => {
    expect(f.omsArsverk).toEqual({ kind: 'absent', absence: { reason: 'not_read_in_v1', scope: 'notes' } });
    expect(f.lonnArsverk).toEqual({ kind: 'absent', absence: { reason: 'not_read_in_v1', scope: 'notes' } });
  });

  it('has the directions of docs/key-figures.md, and ranks only a figure with a direction', () => {
    expect(DOCUMENT_FIGURE_DIRECTIONS).toEqual({
      ebitda: 'higher_is_better',
      vare: 'lower_is_better',
      lonn: 'lower_is_better',
      andre: 'lower_is_better',
      total: 'none',
      omsArsverk: 'higher_is_better',
      lonnArsverk: 'none',
      kfd: 'lower_is_better',
      lgd: 'higher_is_better',
      oml: 'higher_is_better',
      vekst: 'none',
      kontant: 'none',
    });
    for (const key of ['total', 'lonnArsverk', 'vekst', 'kontant'] as const) expect(DOCUMENT_FIGURE_RANKABLE[key], key).toBe(false);
  });
});

describe('decision 1: an empty cost line derived from sum kostnader', () => {
  // The stated lines without varekostnad: 6 000 000 + 200 000 + 0 + 2 000 000 kr.
  const OTHERS = 820_000_000n;

  it('one empty cost line above 5 kr is the remainder', () => {
    const b = basis({ varekostnad: null, sumDriftskostnad: (OTHERS + 501n).toString() });
    if (b.kind !== 'read') throw new Error('expected a read basis');
    expect(documentCostLines(b.current).varekostnad).toEqual({ kind: 'value', ore: 501n, derived: true });
    const vare = computeDocumentKeyFigures(b).vare;
    expect(vare).toMatchObject({ kind: 'value', inputs: [{ field: 'varekostnad', derived: true }, { field: 'sumDriftsinntekter', derived: false }] });
    expect(value(vare).eq(new Decimal(501).div(1_000_000_000))).toBe(true);
  });

  it.each([-500n, 0n, 500n])('a remainder within ±5 kr derives every empty line as 0 (%s øre)', (rest) => {
    // One empty line.
    const one = basis({ varekostnad: null, sumDriftskostnad: (OTHERS + rest).toString() });
    if (one.kind !== 'read') throw new Error('expected a read basis');
    expect(documentCostLines(one.current).varekostnad).toEqual({ kind: 'value', ore: 0n, derived: true });
    expect(value(computeDocumentKeyFigures(one).vare).isZero()).toBe(true);
    // Two empty lines: varekostnad and nedskrivninger (the latter stated as 0 above).
    const several = basis({ varekostnad: null, nedskrivninger: null, sumDriftskostnad: (OTHERS + rest).toString() });
    if (several.kind !== 'read') throw new Error('expected a read basis');
    const lines = documentCostLines(several.current);
    expect(lines.varekostnad).toEqual({ kind: 'value', ore: 0n, derived: true });
    expect(lines.nedskrivninger).toEqual({ kind: 'value', ore: 0n, derived: true });
    expect(lines.lonnskostnad).toEqual({ kind: 'value', ore: 600_000_000n, derived: false });
  });

  it('one empty cost line below −5 kr is undefined', () => {
    const b = basis({ varekostnad: null, sumDriftskostnad: (OTHERS - 501n).toString() });
    if (b.kind !== 'read') throw new Error('expected a read basis');
    expect(documentCostLines(b.current).varekostnad).toEqual(MISSING);
    const f = computeDocumentKeyFigures(b);
    for (const key of ['vare', 'total', 'lgd'] as const) expect(f[key], key).toEqual(MISSING);
    // A figure that does not read the line is unaffected.
    expect(f.lonn.kind).toBe('value');
  });

  it.each([-501n, 501n])('several empty cost lines outside ±5 kr are undefined (%s øre)', (rest) => {
    const b = basis({ varekostnad: null, nedskrivninger: null, sumDriftskostnad: (OTHERS + rest).toString() });
    if (b.kind !== 'read') throw new Error('expected a read basis');
    const lines = documentCostLines(b.current);
    expect(lines.varekostnad).toEqual(MISSING);
    expect(lines.nedskrivninger).toEqual(MISSING);
    const f = computeDocumentKeyFigures(b);
    expect(f.vare).toEqual(MISSING);
    expect(f.ebitda).toEqual(MISSING);
  });

  it('derives no cost line without a stated sum kostnader', () => {
    const lines = documentCostLines(documentFigures(column('reconciled', { varekostnad: null, sumDriftskostnad: null })));
    expect(lines.varekostnad).toEqual(MISSING);
    expect(lines.lonnskostnad).toEqual({ kind: 'value', ore: 600_000_000n, derived: false });
  });

  it('marks a payable-days denominator with a derived line as derived, and 5 kr or less of it as not positive', () => {
    // varekostnad derived as 0, annenDriftskostnad stated 5 kr: (0 + 500) øre, derived.
    const b = basis({
      varekostnad: null,
      annenDriftskostnad: '500',
      sumDriftskostnad: (600_000_000n + 20_000_000n + 500n).toString(),
    });
    expect(computeDocumentKeyFigures(b).lgd).toEqual(NOT_POSITIVE);
  });
});

describe('a derived revenue, and an empty line', () => {
  it('a derived document revenue of 5 kr or less is not positive', () => {
    // driftsresultat + sumDriftskostnad = −919 999 500 + 920 000 000 = 500 øre.
    const at5 = computeDocumentKeyFigures(basis({ sumDriftsinntekter: null, driftsresultat: '-919999500' }));
    for (const key of ['ebitda', 'vare', 'lonn', 'andre', 'total'] as const) expect(at5[key], key).toEqual(NOT_POSITIVE);
    // 501 øre is positive, derived, and marked so.
    const above = computeDocumentKeyFigures(basis({ sumDriftsinntekter: null, driftsresultat: '-919999499' }));
    expect(above.vare).toMatchObject({ kind: 'value', denominatorDerived: true });
    expect(value(above.vare).eq(new Decimal(100_000_000).div(501))).toBe(true);
    // A stated revenue of 1 øre is used as it is.
    expect(computeDocumentKeyFigures(basis({ sumDriftsinntekter: '1' })).vare.kind).toBe('value');
  });

  it('an empty line is never 0', () => {
    const f = computeDocumentKeyFigures(
      basis({ kundefordringer: null, salgsinntekt: null, leverandorgjeld: null, bankinnskudd: null, driftsresultat: null }),
    );
    for (const key of ['kfd', 'lgd', 'oml', 'kontant', 'ebitda'] as const) expect(f[key], key).toEqual(MISSING);
    // A missing component is checked before the denominator's sign.
    expect(computeDocumentKeyFigures(basis({ kundefordringer: null, salgsinntekt: '0' })).kfd).toEqual(MISSING);
    expect(computeDocumentKeyFigures(basis({ salgsinntekt: '0' })).kfd).toEqual(NOT_POSITIVE);
  });

  it('a line above its API subtotal leaves 9 and 11 undefined', () => {
    // sumOmloepsmidler 3 600 000 kr; kundefordringer and bankinnskudd above it by more than max(5 kr, 0.001 %).
    const f = computeDocumentKeyFigures(basis({ kundefordringer: '360003700', bankinnskudd: '360003700', sumEiendeler: '900000000' }));
    expect(f.kfd).toEqual(NOT_SAFE);
    expect(f.oml).toEqual(NOT_SAFE);
    expect(f.kontant).toEqual(NOT_SAFE);
    expect(f.lgd.kind).toBe('value');
    // Only kundefordringer above it: 9 undefined, 11 reads bankinnskudd and stays defined.
    const one = computeDocumentKeyFigures(basis({ kundefordringer: '360003700' }));
    expect(one.kfd).toEqual(NOT_SAFE);
    expect(one.oml.kind).toBe('value');
  });

  it('a non-positive operating capital base leaves 11 not positive', () => {
    expect(computeDocumentKeyFigures(basis({ sumEiendeler: '200000000' })).oml).toEqual(NOT_POSITIVE);
  });
});

describe('decision 2: revenue growth and the prior column', () => {
  it('growth over a prior column the register disagrees with is not read safely', () => {
    const disagrees = basis({}, { sumDriftsinntekter: '800000000' }, { priorApiFailFields: ['sum_driftsinntekter'] });
    expect(computeDocumentKeyFigures(disagrees).vekst).toEqual(NOT_SAFE);
    // A disagreement on another figure, or none to check against, leaves the prior revenue in use.
    const other = basis({}, { sumDriftsinntekter: '800000000' }, { priorApiFailFields: ['sum_eiendeler'] });
    expect(value(computeDocumentKeyFigures(other).vekst).toString()).toBe('0.25');
  });

  it('a failed or missing prior column gives component_missing', () => {
    expect(computeDocumentKeyFigures(basis({}, null)).vekst).toEqual(MISSING);
    const failed = basis({}, {}, { priorStatus: 'failed_reconciliation', priorApiFailFields: ['sum_driftsinntekter'] });
    expect(computeDocumentKeyFigures(failed).vekst).toEqual(MISSING);
  });

  it('a prior revenue of zero gives no growth', () => {
    expect(computeDocumentKeyFigures(basis({}, { sumDriftsinntekter: '0' })).vekst).toEqual(NOT_POSITIVE);
  });

  it('a negative growth is defined', () => {
    const f = documentKeyFigureFractions(basis({}, { sumDriftsinntekter: '2000000000' }));
    expect(f.vekst).toMatchObject({ kind: 'value', fraction: { numerator: -1n, denominator: 2n } });
  });
});
