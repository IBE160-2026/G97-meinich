// Why each document key figure is absent for one company (Story 2.9): the
// basis decided from the manifest, the filing year and the stored statuses,
// then each figure's absence from it. Every company here is synthetic.
import { describe, expect, it } from 'vitest';
import { benchmarkApiFigures } from '../../src/engine/benchmark.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import {
  DOCUMENT_KEY_FIGURE_KEYS,
  type DocumentKeyFigure,
  documentFigureAbsence,
} from '../../src/engine/document-absence.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentBasisInput,
  type DocumentColumnRow,
  type DocumentField,
  documentBasis,
} from '../../src/engine/document-inputs.ts';
import { compareFigure } from '../../src/engine/statistics.ts';
import type { ApiInputs, FigureAbsence, FigureResult } from '../../src/engine/types.ts';

// A synthetic company's reconciled current column, in øre strings: revenue
// 10 000 000 kr, every line the twelve figures read stated.
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

function column(status: string | null, overrides: Partial<Record<DocumentField, string | null>> = {}): DocumentColumnRow {
  const figures = { ...FIGURES, ...overrides };
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => [DOCUMENT_FIGURE_COLUMNS[field], figures[field]]),
  );
  return { status, ...columns } as DocumentColumnRow;
}

const READ: DocumentBasisInput = {
  inManifest: true,
  filingYear: 2025,
  document: { status: 'reconciled', current: column('reconciled'), prior: column('reconciled') },
  sumOmloepsmidler: 360_000_000n,
};

const NOTES: readonly DocumentKeyFigure[] = ['omsArsverk', 'lonnArsverk'];
const TEN = DOCUMENT_KEY_FIGURE_KEYS.filter((figure) => !NOTES.includes(figure));

function absences(basis: DocumentBasis): Record<DocumentKeyFigure, FigureAbsence | null> {
  return Object.fromEntries(DOCUMENT_KEY_FIGURE_KEYS.map((figure) => [figure, documentFigureAbsence(basis, figure)])) as Record<
    DocumentKeyFigure,
    FigureAbsence | null
  >;
}

/** The ten figures other than 7 and 8 all absent with `absence`. */
function expectTen(basis: DocumentBasis, absence: FigureAbsence): void {
  const all = absences(basis);
  for (const figure of TEN) expect(all[figure], figure).toEqual(absence);
}

const BASES: Record<string, DocumentBasisInput> = {
  read: READ,
  'not in the manifest': { ...READ, inManifest: false },
  'filing year 2026': { ...READ, filingYear: 2026 },
  'no document row': { ...READ, document: null },
  paper: { ...READ, document: { status: 'paper', current: null, prior: null } },
  refused: { ...READ, document: { status: 'not_extracted', current: null, prior: null } },
  failed: {
    ...READ,
    document: { status: 'failed_reconciliation', current: column('failed_reconciliation'), prior: column('reconciled') },
  },
  'not reconciled': { ...READ, document: { status: 'extracted', current: column(null), prior: column(null) } },
};

describe('documentFigureAbsence', () => {
  it('lists the twelve document key figures: 2–11, 14 and kontantandel', () => {
    expect(DOCUMENT_KEY_FIGURE_KEYS).toEqual([
      'ebitda', 'vare', 'lonn', 'andre', 'total', 'omsArsverk', 'lonnArsverk', 'kfd', 'lgd', 'oml', 'vekst', 'kontant',
    ]);
  });

  it('7 and 8 are not read in v1 on every basis', () => {
    for (const [name, input] of Object.entries(BASES)) {
      const basis = documentBasis(input);
      for (const figure of NOTES) {
        expect(documentFigureAbsence(basis, figure), `${name}: ${figure}`).toEqual({ reason: 'not_read_in_v1', scope: 'notes' });
      }
    }
  });

  it('a read column leaves the ten for the formula (null)', () => {
    const basis = documentBasis(READ);
    expect(basis.kind).toBe('read');
    for (const figure of TEN) expect(documentFigureAbsence(basis, figure), figure).toBeNull();
  });

  it('rows outside the manifest are not in the dataset', () => {
    // A reconciled document is stored, but the orgnr is not on the list.
    const basis = documentBasis(BASES['not in the manifest'] as DocumentBasisInput);
    expect(basis).toEqual({ kind: 'not_in_dataset' });
    expectTen(basis, { reason: 'not_in_dataset' });
  });

  it('a filing year outside the read years is not read in v1', () => {
    // Period 2025-04-01 – 2026-03-31: filing year 2026, outside 2021–2025,
    // decided before the stored row is looked at.
    const basis = documentBasis(BASES['filing year 2026'] as DocumentBasisInput);
    expect(basis).toEqual({ kind: 'not_read_in_v1', scope: 'filing_year', filingYear: 2026 });
    expectTen(basis, { reason: 'not_read_in_v1', scope: 'filing_year' });
    expect(documentBasis({ ...READ, filingYear: 2020, document: null }).kind).toBe('not_read_in_v1');
  });

  it('a paper filing is not read in v1', () => {
    const basis = documentBasis(BASES.paper as DocumentBasisInput);
    expect(basis).toEqual({ kind: 'not_read_in_v1', scope: 'paper', filingYear: 2025 });
    expectTen(basis, { reason: 'not_read_in_v1', scope: 'paper' });
  });

  it('a refused document is refused', () => {
    const basis = documentBasis(BASES.refused as DocumentBasisInput);
    expect(basis).toEqual({ kind: 'refused', filingYear: 2025 });
    expectTen(basis, { reason: 'refused' });
  });

  it('a listed company with no row is document_missing', () => {
    const input = BASES['no document row'] as DocumentBasisInput;
    expect(() => documentBasis(input)).not.toThrow();
    const basis = documentBasis(input);
    expect(basis).toEqual({ kind: 'document_missing', filingYear: 2025 });
    expectTen(basis, { reason: 'document_missing' });
  });

  it('a failed column gives no document figure', () => {
    const basis = documentBasis(BASES.failed as DocumentBasisInput);
    expect(basis).toEqual({ kind: 'failed_reconciliation', filingYear: 2025 });
    expectTen(basis, { reason: 'failed_reconciliation' });
    // A document with no current column takes the document's own status.
    expect(documentBasis({ ...READ, document: { status: 'failed_reconciliation', current: null, prior: null } }).kind).toBe(
      'failed_reconciliation',
    );
    // Any other status with no current column: nothing checked can be read.
    for (const status of ['reconciled', 'extracted']) {
      expect(documentBasis({ ...READ, document: { status, current: null, prior: null } }), status).toEqual({
        kind: 'not_reconciled',
        filingYear: 2025,
      });
    }
  });

  it('a column not yet reconciled gives no document figure', () => {
    const basis = documentBasis(BASES['not reconciled'] as DocumentBasisInput);
    expect(basis).toEqual({ kind: 'not_reconciled', filingYear: 2025 });
    expectTen(basis, { reason: 'not_reconciled' });
  });

  it('a line above its API subtotal makes receivable days undefined', () => {
    // kundefordringer 4 000 001 kr against sum_omloepsmidler 3 600 000 kr.
    const input: DocumentBasisInput = {
      ...READ,
      document: { status: 'reconciled', current: column('reconciled', { kundefordringer: '400000100' }), prior: null },
    };
    const basis = documentBasis(input);
    expect(documentFigureAbsence(basis, 'kfd')).toEqual({ reason: 'undefined', cause: 'line_not_read_safely' });
    // Figures that do not read the line are untouched.
    expect(documentFigureAbsence(basis, 'vare')).toBeNull();
    expect(documentFigureAbsence(basis, 'oml')).toBeNull();
  });

  it('an underivable revenue makes the figures over revenue undefined, never 0', () => {
    const input: DocumentBasisInput = {
      ...READ,
      document: {
        status: 'reconciled',
        current: column('reconciled', { sumDriftsinntekter: null, driftsresultat: null }),
        prior: column('reconciled'),
      },
    };
    const basis = documentBasis(input);
    for (const figure of ['ebitda', 'vare', 'lonn', 'andre', 'total', 'oml', 'vekst'] as const) {
      expect(documentFigureAbsence(basis, figure), figure).toEqual({ reason: 'undefined', cause: 'component_missing' });
    }
    expect(documentFigureAbsence(basis, 'kfd')).toBeNull();
  });

  it('revenue growth lacks a component when the prior column is absent or passes no value', () => {
    // Never the prior column's own reason: its words would name the filing
    // year ("Regnskapet for 2025 …"), not the prior year it is about.
    const missing = { reason: 'undefined', cause: 'component_missing' };
    const noPrior = documentBasis({ ...READ, document: { status: 'reconciled', current: column('reconciled'), prior: null } });
    expect(documentFigureAbsence(noPrior, 'vekst')).toEqual(missing);
    const failedPrior = documentBasis({
      ...READ,
      document: { status: 'reconciled', current: column('reconciled'), prior: column('failed_reconciliation') },
    });
    expect(documentFigureAbsence(failedPrior, 'vekst')).toEqual(missing);
    const unreconciledPrior = documentBasis({
      ...READ,
      document: { status: 'reconciled', current: column('reconciled'), prior: column(null) },
    });
    expect(documentFigureAbsence(unreconciledPrior, 'vekst')).toEqual(missing);
    const underivablePrior = documentBasis({
      ...READ,
      document: {
        status: 'reconciled',
        current: column('reconciled'),
        prior: column('reconciled', { sumDriftsinntekter: null, sumDriftskostnad: null }),
      },
    });
    expect(documentFigureAbsence(underivablePrior, 'vekst')).toEqual(missing);
    expect(documentFigureAbsence(documentBasis(READ), 'vekst')).toBeNull();
    // A failed prior column fails nothing else.
    expect(documentFigureAbsence(failedPrior, 'vare')).toBeNull();
  });
});

describe('a failed peer', () => {
  // A synthetic peer group: ten read peers and one whose current column failed.
  const api = (revenueKr: bigint): ApiInputs => ({
    sumDriftsinntekter: revenueKr * 100n,
    driftsresultat: revenueKr * 5n,
    sumDriftskostnad: revenueKr * 95n,
    sumEiendeler: revenueKr * 40n,
    sumEgenkapitalGjeld: revenueKr * 40n,
    sumEgenkapital: revenueKr * 15n,
    sumGjeld: revenueKr * 25n,
  });
  const peers = Array.from({ length: 11 }, (_, i) => ({
    api: api(10_000_000n + BigInt(i) * 100_000n),
    basis: documentBasis(i === 10 ? (BASES.failed as DocumentBasisInput) : READ),
  }));

  // Story 3.1a fills a read figure from the formula; here any value stands in.
  const asResult = (basis: DocumentBasis, figure: DocumentKeyFigure, i: number): FigureResult => {
    const absence = documentFigureAbsence(basis, figure);
    return absence === null
      ? { kind: 'value', value: new Decimal(i).div(100), source: 'document', denominatorDerived: false }
      : { kind: 'absent', absence };
  };

  it('a failed peer is left out of document figures only', () => {
    const subject: FigureResult = { kind: 'value', value: new Decimal('0.05'), source: 'document', denominatorDerived: false };
    for (const figure of TEN) {
      const comparison = compareFigure(
        subject,
        peers.map((peer, i) => asResult(peer.basis, figure, i)),
        'none',
      );
      expect(comparison.count, figure).toBe(10);
      expect(comparison.leftOut, figure).toBe(1);
    }
    // The three API figures count it.
    const benchmark = benchmarkApiFigures(api(10_500_000n), peers.map((peer) => peer.api), 'NOK');
    for (const figure of Object.values(benchmark)) {
      expect(figure.comparison.count).toBe(11);
      expect(figure.comparison.leftOut).toBe(0);
    }
  });
});
