// The blocking rule for document figures (Story 2.2): only a reconciled
// column passes values to the engine.
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentColumnRow,
  type DocumentField,
  documentFigures,
} from '../../src/engine/document-inputs.ts';

// 979607008/2025, this year's column, as stored (øre strings), with the
// three figures the read leaves NULL.
const FIGURES: Record<DocumentField, string | null> = {
  salgsinntekt: '7198715700',
  sumDriftsinntekter: '7263231000',
  varekostnad: '132742500',
  lonnskostnad: '5558266000',
  avskrivninger: '542935700',
  nedskrivninger: '0',
  annenDriftskostnad: null,
  sumDriftskostnad: '7251030700',
  driftsresultat: '12200300',
  nettoFinans: '-82651100',
  ordinaertResultatFoerSkattekostnad: '-70450800',
  aarsresultat: '-154100900',
  sumImmaterielleEiendeler: '1621324500',
  sumVarigeDriftsmidler: '119776800',
  varer: null,
  kundefordringer: '842189300',
  bankinnskudd: '211535600',
  sumEiendeler: '3107354400',
  sumEgenkapital: '776418900',
  leverandorgjeld: null,
  sumKortsiktigGjeld: '1867602300',
  sumGjeld: '2330935500',
  sumEgenkapitalGjeld: '3107354400',
};

function row(status: string | null, figures: Record<DocumentField, string | null> = FIGURES): DocumentColumnRow {
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => [DOCUMENT_FIGURE_COLUMNS[field], figures[field]]),
  );
  return { status, ...columns } as DocumentColumnRow;
}

describe('documentFigures', () => {
  it('maps all 23 figure columns of register.document_column', () => {
    expect(Object.keys(DOCUMENT_FIGURE_COLUMNS)).toHaveLength(23);
    expect(new Set(Object.values(DOCUMENT_FIGURE_COLUMNS)).size).toBe(23);
    for (const column of Object.values(DOCUMENT_FIGURE_COLUMNS)) expect(column).toMatch(/^[a-z_]+_ore$/);
  });

  it('a reconciled column passes its values exactly, and a NULL figure stays null', () => {
    const figures = documentFigures(row('reconciled'));
    expect(figures.sumDriftsinntekter).toEqual({ kind: 'value', ore: 7263231000n });
    expect(figures.nettoFinans).toEqual({ kind: 'value', ore: -82651100n });
    expect(figures.nedskrivninger).toEqual({ kind: 'value', ore: 0n }); // a printed 0 is 0
    expect(figures.varer).toEqual({ kind: 'value', ore: null }); // absent is never 0
    expect(figures.leverandorgjeld).toEqual({ kind: 'value', ore: null });
    const big = documentFigures(row('reconciled', { ...FIGURES, sumEiendeler: '9007199254740993' }));
    expect(big.sumEiendeler).toEqual({ kind: 'value', ore: 9007199254740993n });
  });

  it('a failed column passes no value', () => {
    const figures = documentFigures(row('failed_reconciliation'));
    expect(Object.keys(figures)).toHaveLength(23);
    for (const figure of Object.values(figures)) {
      expect(figure).toEqual({ kind: 'absent', absence: { reason: 'failed_reconciliation' } });
    }
  });

  it('an unreconciled column is absent as not_reconciled', () => {
    // A row restored from a dump made before Story 2.2: no status. Visible
    // as an absence, and no throw, so one such row cannot fail a page.
    const figures = documentFigures(row(null));
    expect(Object.keys(figures)).toHaveLength(23);
    for (const figure of Object.values(figures)) {
      expect(figure).toEqual({ kind: 'absent', absence: { reason: 'not_reconciled' } });
    }
  });

  it('refuses a status it does not know, and a malformed figure in a reconciled column', () => {
    expect(() => documentFigures(row('extracted'))).toThrow(TypeError);
    expect(() => documentFigures(row('Reconciled'))).toThrow(TypeError);
    expect(() => documentFigures(row('reconciled', { ...FIGURES, sumGjeld: '1.5' }))).toThrow(TypeError);
  });
});
