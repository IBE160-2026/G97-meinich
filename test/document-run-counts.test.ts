// `pnpm analysis:document-run` (scripts/document-run-counts.ts): the counts
// over the Story 2.1b run's stored documents that the report's before and
// after compare (Story 2.3b). The database read is not tested here; the
// counting is, from rows as the query returns them.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COUNT_FIELDS,
  type FingerprintRow,
  countsFile,
  documentRunCounts,
  fingerprintCounts,
  main,
} from '../scripts/document-run-counts.ts';

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
        { role: 'current', status: 'reconciled', present: ['sum_eiendeler', 'sum_egenkapital_gjeld'], digits_pass_fields: [] },
        { role: 'current', status: 'failed_reconciliation', present: ['sum_eiendeler'], digits_pass_fields: [] },
        { role: 'prior', status: null, present: [], digits_pass_fields: [] },
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

  it('counts stored fingerprints by type, per fingerprint and per company at its newest year (Story 2.5b)', () => {
    const known = { cost_of_goods_lo: 'low', cost_of_goods_hi: 'low', asset_intensity_lo: 'low', asset_intensity_hi: 'low' };
    // konsulent: low cost of goods, high personnel cost, no inventory, no capitalised intangibles.
    const konsulent = { ...known, personnel_cost_lo: 'high', personnel_cost_hi: 'high', inventory: false, capitalised_intangibles: false };
    // personnel cost unknown across all three bands: more than one type is possible.
    const open = { ...known, personnel_cost_lo: 'low', personnel_cost_hi: 'high', inventory: false, capitalised_intangibles: null };
    const rows: FingerprintRow[] = [
      { orgnr: '111111111', filing_year: 2024, ...konsulent },
      { orgnr: '111111111', filing_year: 2025, ...open },
      { orgnr: '222222222', filing_year: 2023, ...konsulent },
    ];
    const counts = fingerprintCounts(rows);
    expect(counts.total).toBe(3);
    expect(counts.types).toEqual({ produkt: 0, konsulent: 2, forhandler: 0, annet: 0, undetermined: 1 });
    // The first company counts at 2025, where it is undetermined.
    expect(counts.companies).toEqual({ produkt: 0, konsulent: 1, forhandler: 0, annet: 0, undetermined: 1 });
    expect(documentRunCounts('t', 0, [], [], rows).fingerprints).toEqual(counts);
    // Without fingerprint rows, as before Story 2.5b, the key is absent.
    expect('fingerprints' in documentRunCounts('t', 0, [], [])).toBe(false);
  });

  it('counts, per role, the figures each sum gate admitted and those resting on an operand counted as 0 (Story 2.5b)', () => {
    const cost = ['varekostnad', 'lonnskostnad', 'avskrivninger', 'annen_driftskostnad', 'sum_driftskostnad'];
    const counts = documentRunCounts('t', 1, [], [
      // Every cost line held but nedskrivninger: lonnskostnad admitted on nedskrivninger counted as 0.
      { role: 'current', status: 'reconciled', present: cost, digits_pass_fields: ['lonnskostnad'] },
      // Every cost line held: admitted on no 0. A c1-c4 figure from the digits pass is no gate's.
      { role: 'current', status: 'reconciled', present: [...cost, 'nedskrivninger'], digits_pass_fields: ['varekostnad', 'driftsresultat'] },
      // A part admitted while another part is NULL.
      { role: 'prior', status: 'reconciled', present: ['goodwill'], digits_pass_fields: ['goodwill'] },
    ]);
    expect(counts.columns.current.gates).toEqual({
      cost_lines: { admitted: 2, operand_counted_as_zero: 1 },
      intangible_parts: { admitted: 0, operand_counted_as_zero: 0 },
    });
    expect(counts.columns.prior.gates).toEqual({
      cost_lines: { admitted: 0, operand_counted_as_zero: 0 },
      intangible_parts: { admitted: 1, operand_counted_as_zero: 1 },
    });
  });

  it('refuses a stored fingerprint it cannot read', () => {
    const empty = {
      orgnr: '111111111', filing_year: 2025, cost_of_goods_lo: null, cost_of_goods_hi: null, personnel_cost_lo: null,
      personnel_cost_hi: null, asset_intensity_lo: null, asset_intensity_hi: null, inventory: null, capitalised_intangibles: null,
    };
    expect(() => fingerprintCounts([empty])).toThrow(/without categories/);
    expect(() => fingerprintCounts([{ ...empty, cost_of_goods_lo: 'huge', cost_of_goods_hi: 'low', personnel_cost_lo: 'low',
      personnel_cost_hi: 'low', asset_intensity_lo: 'low', asset_intensity_hi: 'low' }])).toThrow(/band range/);
  });

  it('refuses a field or role it does not know', () => {
    expect(() => documentRunCounts('t', 0, [], [{ role: 'current', status: null, present: ['sum_alt'], digits_pass_fields: [] }])).toThrow(/sum_alt/);
    expect(() => documentRunCounts('t', 0, [], [{ role: 'middle', status: null, present: [], digits_pass_fields: [] }])).toThrow(/middle/);
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

  it('the committed before counts of Story 2.5b are the 2.1b rows after 2.3b, with their fingerprint totals', () => {
    const before = JSON.parse(readFileSync(path.join(root, countsFile('before-2.5b')), 'utf8')) as ReturnType<
      typeof documentRunCounts
    >;
    expect(before.documents.total).toBe(1947);
    expect(before.documents.reader_commit).toEqual({ '2ce5a503d44bf6ab379cc3383fcefe1cc2734389': 1947 });
    expect(before.columns.current.non_null.lonnskostnad).toBe(1398);
    expect(before.fingerprints?.total).toBe(1791);
    expect(before.fingerprints?.types.undetermined).toBe(893);
    expect(before.fingerprints?.companies.undetermined).toBe(184);
  });
});
