// `pnpm analysis:document-run` (scripts/document-run-counts.ts): the counts
// over the Story 2.1b run's stored documents that the report's before and
// after compare (Story 2.3b). The database read is not tested here; the
// counting is, from rows as the query returns them.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DeriveInputRow } from '../scripts/derive.ts';
import {
  COUNT_FIELDS,
  type FingerprintRow,
  VARER_DUMP_FILE,
  type VarerRow,
  countsFile,
  documentRunCounts,
  engineCounts,
  fingerprintCounts,
  main,
  parseVarerDump,
  varerAgainstDump,
} from '../scripts/document-run-counts.ts';
import { DOCUMENT_FIGURE_COLUMNS } from '../src/engine/document-inputs.ts';

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

  it('the committed before counts of Story 2.5c are the 2.1b rows after 2.5b, with what the 2.5c engine makes of them', () => {
    const before = JSON.parse(readFileSync(path.join(root, countsFile('before-2.5c')), 'utf8')) as ReturnType<
      typeof documentRunCounts
    >;
    expect(before.documents.total).toBe(1947);
    expect(before.documents.reader_commit).toEqual({ '19b541ba52ed2128461974cd2d4d472470c73f69': 1947 });
    // R2: every column under the total has nedskrivninger empty; R3: kundefordringer only (the probe's 27 and 8).
    expect(before.engine?.skipped.cost_lines_short_of_total).toBe(27);
    expect(before.engine?.cost_lines_short_of_total_nedskrivninger_empty).toBe(27);
    expect(before.engine?.emptied_above_api_subtotal).toEqual({ kundefordringer: 8, bankinnskudd: 0 });
    // Before the re-read the database is the dump: nothing differs, and 18 current columns hold a negative varer.
    expect(before.varer_against_dump?.columns.current).toMatchObject({ compared: 1946, unchanged: 1946, negative_before: 18 });
  });
});

describe('the Story 2.5c counts', () => {
  // A consultancy of 10 000 000 kr, every line read, as test/derive.test.ts.
  const FIGURES: Record<string, string | null> = {
    sum_driftsinntekter_ore: '1000000000',
    varekostnad_ore: '0',
    lonnskostnad_ore: '700000000',
    avskrivninger_ore: '20000000',
    nedskrivninger_ore: '0',
    annen_driftskostnad_ore: '180000000',
    sum_driftskostnad_ore: '900000000',
    sum_immaterielle_eiendeler_ore: '0',
    sum_varige_driftsmidler_ore: '20000000',
    varer_ore: '0',
    kundefordringer_ore: '150000000',
    bankinnskudd_ore: '200000000',
    sum_eiendeler_ore: '400000000',
  };
  function input(orgnr: string, figures: Record<string, string | null> = {}): DeriveInputRow {
    const all = { ...FIGURES, ...figures };
    const columns = Object.fromEntries(Object.values(DOCUMENT_FIGURE_COLUMNS).map((column) => [column, all[column] ?? null]));
    return {
      orgnr,
      filing_year: 2025,
      status: 'reconciled',
      dataset: 'full',
      sum_anleggsmidler_ore: '20000000',
      sum_omloepsmidler_ore: '350000000',
      ...columns,
    } as DeriveInputRow;
  }

  it('counts what the engine makes of the stored columns: R2 with nedskrivninger empty, and R3', () => {
    const counts = engineCounts([
      input('900000001'),
      input('900000002', { sum_driftskostnad_ore: '900050001' }), // 500.01 kr short
      input('900000003', { nedskrivninger_ore: null, sum_driftskostnad_ore: '900050001' }),
      input('900000004', { kundefordringer_ore: '360000000' }), // above sum_omloepsmidler 3 500 000 kr
    ]);
    expect(counts).toMatchObject({
      columns: 4,
      fingerprints: 2,
      cost_lines_short_of_total_nedskrivninger_empty: 1,
      emptied_above_api_subtotal: { kundefordringer: 1, bankinnskudd: 0 },
    });
    expect(counts.skipped.cost_lines_short_of_total).toBe(2);
    expect(documentRunCounts('t', 0, [], [], [], { engine: counts, varer: null })).toMatchObject({ engine: counts, varer_against_dump: null });
    // Counts written before Story 2.5c have neither key.
    expect('engine' in documentRunCounts('t', 0, [], [])).toBe(false);
  });

  it('counts, per role, the varer the re-read emptied or changed against the dump, positive values included (R4)', () => {
    const row = (orgnr: string, role: string, varer: string | null): VarerRow => ({ orgnr, filing_year: 2025, role, varer_ore: varer });
    const dump = [
      row('900000001', 'current', '-1265078300'), // the inventory-change row, negative: emptied
      row('900000002', 'current', '310422000'), // a positive inventory change: replaced by the balance's stock
      row('900000003', 'current', '512040000'), // the balance's stock: unchanged
      row('900000004', 'current', null), // newly read
      row('900000005', 'prior', '-851838000'),
      row('900000006', 'current', '1'), // not stored now
    ];
    const now = [
      row('900000001', 'current', null),
      row('900000002', 'current', '486011800'),
      row('900000003', 'current', '512040000'),
      row('900000004', 'current', '100'),
      row('900000005', 'prior', '-851838000'),
    ];
    const counts = varerAgainstDump(VARER_DUMP_FILE, dump, now);
    expect(counts.dump).toBe(VARER_DUMP_FILE);
    expect(counts.columns.current).toEqual({
      compared: 4,
      unchanged: 1,
      emptied: 1,
      changed: 1,
      newly_read: 1,
      emptied_or_changed_negative_before: 1,
      negative_before: 1,
      negative_after: 0,
      only_in_dump: 1,
      only_now: 0,
    });
    expect(counts.columns.prior).toMatchObject({ compared: 1, unchanged: 1, negative_before: 1, negative_after: 1 });
    expect(() => varerAgainstDump(VARER_DUMP_FILE, [row('9', 'middle', null)], [])).toThrow(/middle/);
  });

  it('counts an emptied current varer whose stock the next filing year holds as its prior figure', () => {
    const at = (orgnr: string, year: number, role: string, varer: string | null): VarerRow => ({ orgnr, filing_year: year, role, varer_ore: varer });
    const dump = [
      at('900000001', 2023, 'current', '-50000000'), // emptied, the 2024 document holds the 2023 stock: counted
      at('900000002', 2023, 'current', '-50000000'), // emptied, the 2024 document has no stock either
      at('900000003', 2023, 'current', '360000000'), // not emptied: not counted
      at('900000004', 2023, 'current', null), // empty before and after: not counted
    ];
    const now = [
      at('900000001', 2023, 'current', null),
      at('900000001', 2024, 'prior', '360000000'),
      at('900000002', 2023, 'current', null),
      at('900000002', 2024, 'prior', null),
      at('900000003', 2023, 'current', '360000000'),
      at('900000003', 2024, 'prior', '360000000'),
      at('900000004', 2023, 'current', null),
      at('900000004', 2024, 'prior', '360000000'),
      at('900000001', 2023, 'prior', '1'), // the same document's own prior column is not the next year's
    ];
    expect(varerAgainstDump(VARER_DUMP_FILE, dump, now).emptied_current_held_by_next_prior).toBe(1);
  });

  it('reads varer from a dump by its header, NULL as an empty field, and refuses an unreadable one', () => {
    const csv = 'orgnr,filing_year,role,digits_pass_fields,varer_ore\n900000001,2024,prior,"{a,b}",-12\n900000002,2025,current,{},\n';
    expect(parseVarerDump(csv, 'd.csv')).toEqual([
      { orgnr: '900000001', filing_year: 2024, role: 'prior', varer_ore: '-12' },
      { orgnr: '900000002', filing_year: 2025, role: 'current', varer_ore: null },
    ]);
    expect(() => parseVarerDump('orgnr,filing_year,role\n', 'd.csv')).toThrow(/varer_ore/);
    expect(() => parseVarerDump('orgnr,filing_year,role,varer_ore\n9,2025,current,1.5\n', 'd.csv')).toThrow(/unreadable/);
  });
});
