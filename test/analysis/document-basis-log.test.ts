// The document basis of a company as the analysis reads it (Story 2.9): the
// row's document columns into the engine's basis, and the one log line for a
// listed company with no stored document. The rows are synthetic.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DocumentBasisColumns, documentBasisOf } from '../../src/analysis/document-basis.ts';
import { DOCUMENT_FIGURE_COLUMNS } from '../../src/engine/document-inputs.ts';

const ORGNR = '999999999';

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
    has_prior: true,
    prior_status: 'reconciled',
    sum_omloepsmidler_ore: null,
    ...figures,
    ...overrides,
  } as DocumentBasisColumns;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('documentBasisOf', () => {
  it('a missing document logs once without the orgnr', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const basis = documentBasisOf(row({ document_status: null, has_current: false, has_prior: false }), 2025);
    expect(basis).toEqual({ kind: 'document_missing', filingYear: 2025 });
    expect(out.mock.calls).toEqual([['{"level":"warn","event":"analysis.documentMissing"}']]);
    expect(JSON.stringify(out.mock.calls)).not.toContain(ORGNR);
    expect(err).not.toHaveBeenCalled();
  });

  it('logs nothing for any other basis', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const bases = [
      documentBasisOf(row({}), 2025),
      documentBasisOf(row({ in_manifest: false, document_status: null }), 2025),
      documentBasisOf(row({ document_status: null }), 2026),
      documentBasisOf(row({ document_status: 'paper', has_current: false, has_prior: false }), 2025),
      documentBasisOf(row({ document_status: 'not_extracted', has_current: false, has_prior: false }), 2025),
      documentBasisOf(row({ document_status: 'failed_reconciliation', current_status: 'failed_reconciliation' }), 2025),
    ];
    expect(bases.map((basis) => basis.kind)).toEqual([
      'read',
      'not_in_dataset',
      'not_read_in_v1',
      'not_read_in_v1',
      'refused',
      'failed_reconciliation',
    ]);
    expect(out).not.toHaveBeenCalled();
  });

  it('reads the current and the prior column from their prefixed columns', () => {
    const basis = documentBasisOf(
      row({ cur_sum_driftsinntekter_ore: '1000000000', pri_sum_driftsinntekter_ore: '900000000', has_prior: true }),
      2025,
    );
    if (basis.kind !== 'read') throw new Error(`expected read, got ${basis.kind}`);
    expect(basis.current.sumDriftsinntekter).toEqual({ kind: 'value', ore: 1_000_000_000n });
    expect(basis.prior?.sumDriftsinntekter).toEqual({ kind: 'value', ore: 900_000_000n });
    expect(documentBasisOf(row({ has_prior: false }), 2025)).toMatchObject({ kind: 'read', prior: null });
  });

  it('applies R3 with the filing’s sum_omloepsmidler', () => {
    const basis = documentBasisOf(row({ cur_kundefordringer_ore: '100000000', sum_omloepsmidler_ore: '50000000' }), 2025);
    if (basis.kind !== 'read') throw new Error(`expected read, got ${basis.kind}`);
    expect(basis.current.kundefordringer).toEqual({ kind: 'absent', absence: { reason: 'exceeds_api_subtotal' } });
  });
});
