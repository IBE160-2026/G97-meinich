// The blocking rule for document figures (Story 2.2): only a reconciled
// column passes values to the engine.
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentColumnRow,
  type DocumentField,
  GUARDED_CURRENT_ASSETS,
  documentFigures,
  exceedsApiSubtotal,
  guardCurrentAssets,
} from '../../src/engine/document-inputs.ts';

// 979607008/2025, this year's column, as stored (øre strings), with the
// three figures the read leaves NULL, and the four parts of intangible
// assets (Story 2.5b).
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
  forskningOgUtvikling: '698626200',
  konsesjonerPatenter: '3625000',
  goodwill: '900047200',
  utsattSkattefordel: '19026100',
};

function row(status: string | null, figures: Record<DocumentField, string | null> = FIGURES): DocumentColumnRow {
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => [DOCUMENT_FIGURE_COLUMNS[field], figures[field]]),
  );
  return { status, ...columns } as DocumentColumnRow;
}

describe('documentFigures', () => {
  it('maps all 27 figure columns of register.document_column', () => {
    expect(Object.keys(DOCUMENT_FIGURE_COLUMNS)).toHaveLength(27);
    expect(new Set(Object.values(DOCUMENT_FIGURE_COLUMNS)).size).toBe(27);
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
    expect(Object.keys(figures)).toHaveLength(27);
    for (const figure of Object.values(figures)) {
      expect(figure).toEqual({ kind: 'absent', absence: { reason: 'failed_reconciliation' } });
    }
  });

  it('an unreconciled column is absent as not_reconciled', () => {
    // A row restored from a dump made before Story 2.2: no status. Visible
    // as an absence, and no throw, so one such row cannot fail a page.
    const figures = documentFigures(row(null));
    expect(Object.keys(figures)).toHaveLength(27);
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

// R3 (Story 2.5c; Meinich 2026-11-06). 979607008/2025's kundefordringer and
// bankinnskudd are 8 421 893 and 2 115 356 kr.
describe('guardCurrentAssets', () => {
  const reconciled = documentFigures(row('reconciled'));
  const absent = { kind: 'absent', absence: { reason: 'exceeds_api_subtotal' } };

  it('a current asset line above the API subtotal is empty, with its reason', () => {
    // sum_omloepsmidler 8 000 000 kr: kundefordringer is above it by more than 5 kr.
    const guarded = guardCurrentAssets(reconciled, 'current', 800000000n);
    expect(guarded.kundefordringer).toEqual(absent);
    expect(guarded.bankinnskudd).toEqual({ kind: 'value', ore: 211535600n });
    // Every other figure is unchanged, and so is the input.
    for (const field of Object.keys(reconciled) as DocumentField[]) {
      if (field !== 'kundefordringer') expect(guarded[field], field).toEqual(reconciled[field]);
    }
    expect(reconciled.kundefordringer).toEqual({ kind: 'value', ore: 842189300n });
    // Both lines, each checked on its own.
    const both = guardCurrentAssets(reconciled, 'current', 200000000n);
    expect([both.kundefordringer, both.bankinnskudd]).toEqual([absent, absent]);
    expect([...GUARDED_CURRENT_ASSETS]).toEqual(['kundefordringer', 'bankinnskudd']);
    expect([exceedsApiSubtotal(both.kundefordringer), exceedsApiSubtotal(reconciled.kundefordringer)]).toEqual([true, false]);
    expect(exceedsApiSubtotal(documentFigures(row('failed_reconciliation')).kundefordringer)).toBe(false);
  });

  it('a current asset line above the API subtotal is empty only beyond 5 kr', () => {
    expect(guardCurrentAssets(reconciled, 'current', 842189300n - 500n).kundefordringer).toEqual({ kind: 'value', ore: 842189300n });
    expect(guardCurrentAssets(reconciled, 'current', 842189300n - 501n).kundefordringer).toEqual(absent);
  });

  it('leaves the figures unchanged with no API figure, in the prior column, or for a line not read', () => {
    expect(guardCurrentAssets(reconciled, 'current', null)).toEqual(reconciled);
    expect(guardCurrentAssets(reconciled, 'prior', 1n)).toEqual(reconciled);
    const unread = documentFigures(row('reconciled', { ...FIGURES, kundefordringer: null }));
    expect(guardCurrentAssets(unread, 'current', 1n).kundefordringer).toEqual({ kind: 'value', ore: null });
    const failed = documentFigures(row('failed_reconciliation'));
    expect(guardCurrentAssets(failed, 'current', 1n)).toEqual(failed);
  });
});
