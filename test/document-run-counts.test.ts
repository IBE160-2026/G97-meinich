// `pnpm analysis:document-run` (scripts/document-run-counts.ts): the counts
// over the Story 2.1b run's stored documents that the report's before and
// after compare (Story 2.3b). The database read is not tested here; the
// counting is, from rows as the query returns them.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNT_FIELDS, countsFile, documentRunCounts, main } from '../scripts/document-run-counts.ts';

const root = path.resolve(import.meta.dirname, '..');
const OLD = 'e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d';
const NEW = 'a'.repeat(40);

describe('documentRunCounts', () => {
  it('counts non-NULL figures per field and role, column statuses, and documents by status and reader version', () => {
    const counts = documentRunCounts(
      'test',
      2,
      [
        { status: 'reconciled', reader_commit: NEW },
        { status: 'failed_reconciliation', reader_commit: OLD },
        { status: 'paper', reader_commit: OLD },
      ],
      [
        { role: 'current', status: 'reconciled', present: ['sum_eiendeler', 'sum_egenkapital_gjeld'] },
        { role: 'current', status: 'failed_reconciliation', present: ['sum_eiendeler'] },
        { role: 'prior', status: null, present: [] },
      ],
    );
    expect(counts.documents).toEqual({
      total: 3,
      status: { failed_reconciliation: 1, paper: 1, reconciled: 1 },
      reader_commit: { [NEW]: 1, [OLD]: 2 },
    });
    expect(counts.columns.current.columns).toBe(2);
    expect(counts.columns.current.non_null.sum_eiendeler).toBe(2);
    expect(counts.columns.current.non_null.sum_egenkapital_gjeld).toBe(1);
    // Every field is listed, a field with no figure as 0, never left out.
    expect(Object.keys(counts.columns.prior.non_null).sort()).toEqual([...COUNT_FIELDS].sort());
    expect(counts.columns.prior.non_null.sum_eiendeler).toBe(0);
    expect(counts.columns.current.status).toEqual({ failed_reconciliation: 1, reconciled: 1 });
    expect(counts.columns.prior.status).toEqual({ null: 1 });
  });

  it('refuses a field or role it does not know', () => {
    expect(() => documentRunCounts('t', 0, [], [{ role: 'current', status: null, present: ['sum_alt'] }])).toThrow(/sum_alt/);
    expect(() => documentRunCounts('t', 0, [], [{ role: 'middle', status: null, present: [] }])).toThrow(/middle/);
  });

  it('refuses a missing or odd label before connecting', async () => {
    for (const argv of [[], ['a', 'b'], ['../x'], ['Before']]) {
      expect(await main(root, argv), argv.join(' ')).toBe(2);
    }
  });

  it('the committed before counts are the 2.1b run: 1 947 documents, the total NULL in 836 of 1 946 current columns', () => {
    const before = JSON.parse(readFileSync(path.join(root, countsFile('before-2.3b')), 'utf8')) as ReturnType<
      typeof documentRunCounts
    >;
    expect(before.documents.total).toBe(1947);
    expect(before.documents.reader_commit).toEqual({ [OLD]: 1947 });
    expect(before.columns.current.columns - (before.columns.current.non_null.sum_egenkapital_gjeld ?? 0)).toBe(836);
    expect(before.columns.current.columns).toBe(1946);
  });
});
