// The stored document facts as the drill-down reads them (Story 3.7), and
// the document's register id (Story 5.4, deferred from the review of PR
// #82): `document_brreg_id` is read by the id parser, which refuses what is
// not a positive whole number, where `parseOre` would accept a signed amount.
// Synthetic rows.
import { describe, expect, it } from 'vitest';
import { type DocumentBasisColumns, documentFactsOf } from '../../src/analysis/document-basis.ts';
import { DOCUMENT_FIGURE_COLUMNS } from '../../src/engine/document-inputs.ts';
import { parseId, parseOre } from '../../src/engine/inputs.ts';

function row(overrides: Partial<DocumentBasisColumns>): DocumentBasisColumns {
  const figures: Record<string, string | null> = {};
  for (const column of Object.values(DOCUMENT_FIGURE_COLUMNS)) {
    figures[`cur_${column}`] = '100000';
    figures[`pri_${column}`] = '100000';
  }
  return {
    in_manifest: true,
    document_status: 'reconciled',
    has_current: true,
    current_status: 'reconciled',
    has_prior: false,
    prior_status: null,
    prior_api_fail_fields: null,
    sum_omloepsmidler_ore: null,
    document_read_at: new Date('2026-10-21T08:00:00Z'),
    document_brreg_id: '4242',
    current_c1: 'pass',
    current_c2: 'pass',
    current_c3: 'pass',
    current_c4: 'pass',
    current_c5: 'pass',
    current_api_check: 'pass',
    current_api_fail_fields: [],
    ...figures,
    ...overrides,
  } as DocumentBasisColumns;
}

describe('documentFactsOf: the document’s register id', () => {
  it('reads document_brreg_id exactly, above 2^53 too, and null as null', () => {
    expect(documentFactsOf(row({})).brregId).toBe(4242n);
    expect(documentFactsOf(row({ document_brreg_id: '9007199254740993' })).brregId).toBe(9_007_199_254_740_993n);
    expect(documentFactsOf(row({ document_brreg_id: null })).brregId).toBeNull();
  });

  it('reads document_brreg_id with an id parser, not parseOre', () => {
    // The fixture's state: parseOre takes a signed whole number as an amount.
    expect(parseOre('-4242')).toBe(-4242n);
    expect(() => documentFactsOf(row({ document_brreg_id: '-4242' }))).toThrow(/not a register id/);
    expect(() => documentFactsOf(row({ document_brreg_id: '0' }))).toThrow(/not a register id/);
  });
});

describe('parseId', () => {
  it('reads a positive whole number and refuses anything else', () => {
    expect(parseId('1')).toBe(1n);
    expect(parseId(null)).toBeNull();
    for (const value of ['', '0', '-1', '01', '1.0', '1e3', ' 1']) {
      expect(() => parseId(value), value).toThrow(/not a register id/);
    }
  });
});
