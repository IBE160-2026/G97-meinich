// Batch step 2's derivation (Story 2.5): rows in, fingerprint rows and
// counts out, with the engine. Synthetic rows only; the database side is
// test/db/derive.test.ts.
import { describe, expect, it } from 'vitest';
import { type DeriveInputRow, deriveFingerprints, summaryLines } from '../scripts/derive.ts';
import { digest } from '../src/engine/digest.ts';
import { DOCUMENT_FIGURE_COLUMNS, type DocumentField, documentFigures } from '../src/engine/document-inputs.ts';
import { apiSubtotalsFromRow, fingerprintOf } from '../src/engine/fingerprint.ts';

// 10 000 000 kr: a consultancy (personnel 70 %), every line read.
const FIGURES: Partial<Record<DocumentField, string | null>> = {
  sumDriftsinntekter: '1000000000',
  varekostnad: '0',
  lonnskostnad: '700000000',
  avskrivninger: '20000000',
  nedskrivninger: '0',
  annenDriftskostnad: '180000000',
  sumDriftskostnad: '900000000',
  sumImmaterielleEiendeler: '0',
  sumVarigeDriftsmidler: '20000000',
  varer: '0',
  kundefordringer: '150000000',
  bankinnskudd: '200000000',
  sumEiendeler: '400000000',
};

function input(
  orgnr: string,
  filingYear: number,
  figures: Partial<Record<DocumentField, string | null>> = {},
  extra: Partial<Pick<DeriveInputRow, 'status' | 'dataset' | 'sum_anleggsmidler_ore' | 'sum_omloepsmidler_ore'>> = {},
): DeriveInputRow {
  const all = { ...FIGURES, ...figures };
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => [DOCUMENT_FIGURE_COLUMNS[field], all[field] ?? null]),
  );
  return {
    orgnr,
    filing_year: filingYear,
    status: 'reconciled',
    dataset: 'full',
    sum_anleggsmidler_ore: '20000000',
    sum_omloepsmidler_ore: '350000000',
    ...columns,
    ...extra,
  } as DeriveInputRow;
}

describe('deriveFingerprints', () => {
  it('writes one row per fingerprinted column, with its categories, digest and dataset tag', () => {
    const row = input('900000001', 2025, {}, { dataset: 'demo' });
    const { rows, counts } = deriveFingerprints([row]);
    const result = fingerprintOf(documentFigures(row), apiSubtotalsFromRow(row));
    if (result.kind !== 'fingerprint') throw new Error('expected a fingerprint');
    expect(rows).toEqual([
      {
        orgnr: '900000001',
        filing_year: 2025,
        cost_of_goods_lo: 'low',
        cost_of_goods_hi: 'low',
        personnel_cost_lo: 'high',
        personnel_cost_hi: 'high',
        asset_intensity_lo: 'low',
        asset_intensity_hi: 'low',
        inventory: false,
        capitalised_intangibles: false,
        input_digest: digest(result.inputs),
        dataset: 'demo',
      },
    ]);
    expect(counts.written).toBe(1);
    expect(counts.types.konsulent).toBe(1);
  });

  it('counts every skip by reason and writes nothing for it', () => {
    const { rows, counts } = deriveFingerprints([
      input('900000001', 2025, {}, { status: 'failed_reconciliation' }),
      input('900000002', 2025, {}, { status: null }),
      input('900000003', 2025, { sumDriftsinntekter: '0' }),
      input('900000004', 2025, { sumDriftskostnad: '899999499' }), // 5.01 kr over the read lines
      input('900000005', 2025, { varer: null }, { sum_omloepsmidler_ore: '1' }),
    ]);
    expect(rows).toEqual([]);
    expect(counts).toMatchObject({
      columns: 5,
      written: 0,
      skipped: { not_reconciled: 2, no_revenue: 1, negative_unexplained: 1, negative_balance_remainder: 1 },
    });
  });

  it('counts undetermined types per fingerprint and per company at its newest year', () => {
    const { counts } = deriveFingerprints([
      // Personnel cost empty with U = 70 %: annet or konsulent.
      input('900000001', 2024, { lonnskostnad: null }),
      input('900000001', 2025),
      input('900000002', 2025, { lonnskostnad: null }),
    ]);
    expect(counts.types).toEqual({ produkt: 0, konsulent: 1, forhandler: 0, annet: 0, undetermined: 2 });
    expect(counts.companies).toEqual({ produkt: 0, konsulent: 1, forhandler: 0, annet: 0, undetermined: 1 });
    expect(summaryLines(counts)).toEqual([
      'derive: 3 current document columns read, 3 fingerprints written',
      '  skipped: not_reconciled 0, no_revenue 0, cost_lines_short_of_total 0, negative_unexplained 0, negative_balance_remainder 0',
      '  fingerprints by type: produkt 0, konsulent 1, forhandler 0, annet 0, undetermined 2',
      '  companies by type (newest fingerprinted year, 2 companies): produkt 0, konsulent 1, forhandler 0, annet 0, undetermined 1',
    ]);
  });

  it.each([
    ['an unknown dataset tag', input('900000001', 2025, {}, { dataset: 'sample' })],
    ['a figure that is not a whole number', input('900000001', 2025, { varer: '1.5' })],
    ['an unknown status', input('900000001', 2025, {}, { status: 'extracted' })],
    ['a subtotal that is not a whole number', input('900000001', 2025, {}, { sum_anleggsmidler_ore: 'x' })],
  ])('throws on %s', (_label, row) => {
    expect(() => deriveFingerprints([row])).toThrow(TypeError);
  });
});
