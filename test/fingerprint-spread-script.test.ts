// `pnpm analysis:spread` (Story 2.5, D3): synthetic columns in, the
// aggregates the spread test reads out. No stored company is read here.
import { describe, expect, it } from 'vitest';
import { spreadMarkdown, spreadOutput, spreads } from '../scripts/fingerprint-spread.ts';
import { DOCUMENT_FIGURE_COLUMNS, type DocumentColumnRow, type DocumentField } from '../src/engine/document-inputs.ts';

function column(varekostnad: string | null, lonnskostnad: string | null, status: string | null = 'reconciled'): DocumentColumnRow {
  const figures: Partial<Record<DocumentField, string | null>> = {
    sumDriftsinntekter: '1000',
    varekostnad,
    lonnskostnad,
  };
  const columns = Object.fromEntries(
    (Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[]).map((field) => [DOCUMENT_FIGURE_COLUMNS[field], figures[field] ?? null]),
  );
  return { status, ...columns } as DocumentColumnRow;
}

describe('the spread aggregates', () => {
  // Cost of goods 1 %, 2 %, 3 %, 4 %, 5 % (low) and 50 % (high); personnel
  // 70 % (high) four times, one empty, one unreconciled.
  const columns = [
    column('10', '700'),
    column('20', '700'),
    column('30', '700'),
    column('40', '700'),
    column('50', null),
    column('500', '700'),
    column('20', '20', 'failed_reconciliation'),
  ];
  const spread = spreads(columns);

  it('counts only read shares of reconciled columns, per band, with the IQR in percentage points', () => {
    const output = spreadOutput(columns.length, spread);
    expect(output.industry).toBe('62.100');
    expect(output.companies).toBe(7);
    expect(output.categories.costOfGoods).toEqual({
      low: { n: 5, iqr_pp: '2' },
      mid: { n: 0, iqr_pp: null },
      high: { n: 1, iqr_pp: '0' },
    });
    expect(output.categories.personnelCost).toEqual({
      low: { n: 0, iqr_pp: null },
      mid: { n: 0, iqr_pp: null },
      high: { n: 5, iqr_pp: '0' },
    });
  });

  it('writes one table per category, percentage points to one decimal', () => {
    const md = spreadMarkdown(columns.length, spread);
    expect(md).toContain('| low | 5 | 2,0 pp |');
    expect(md).toContain('| mid | 0 | – |');
    expect(md.endsWith('\n')).toBe(true);
    expect(md).not.toMatch(/\d{9}/);
  });
});
