// The committed seed's fingerprints follow from its committed figures
// (Story 2.5; technical note AD-9, AD-13). For every row of
// seed/demo/fingerprint.csv of an allow-listed company, the engine
// recomputes, from the seed's own document column and the key-figures
// filing its document belongs to, the input digest and the five
// categories, and both must equal what step 2 stored. And every current
// column in the seed that gives a fingerprint has its row. A digest
// mismatch means a stored fingerprint no longer follows from its inputs:
// rerun `pnpm derive` and re-export the seed.
//
// With the licence gate open, the seed also holds fingerprints of companies
// outside the allow-list, without the figures behind them (spec change
// log, review pass 1). Those cannot be recomputed here; they are counted,
// and the count is in a test's title, never skipped silently.
//
// Counts and mismatches only are reported; no company's categories are
// printed.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOW_LIST_FILE, REFERENCE_DRAW_FILE, parseAllowList, parseCsv, parseDrawn } from '../scripts/seed-format.ts';
import { digest } from '../src/engine/digest.ts';
import { DOCUMENT_FIGURE_COLUMNS, type DocumentColumnRow, documentFigures } from '../src/engine/document-inputs.ts';
import { type FingerprintColumns, apiSubtotalsFromRow, fingerprintFromColumns, fingerprintOf } from '../src/engine/fingerprint.ts';

const root = path.resolve(import.meta.dirname, '..');
const SEED = 'seed/demo';

function csv(name: string): Record<string, string>[] {
  const file = path.join(root, SEED, name);
  if (!existsSync(file)) throw new Error(`${SEED}/${name} is missing; re-export the seed (Story 2.5, D4)`);
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'));
  if (header === undefined) throw new Error(`${name} is empty`);
  return rows.map((row) => {
    if (row.length !== header.length) throw new Error(`${name}: a row has ${row.length} fields, the header ${header.length}`);
    return Object.fromEntries(header.map((column, i) => [column, row[i] ?? '']));
  });
}

// COPY csv writes NULL as an empty unquoted field; no column read here holds
// an empty string.
const orNull = (text: string | undefined): string | null => (text === undefined || text === '' ? null : text);
function bool(text: string | undefined): boolean | null {
  if (text === 't') return true;
  if (text === 'f') return false;
  if (text === undefined || text === '') return null;
  throw new Error(`not a boolean: ${JSON.stringify(text)}`);
}

function columnRow(row: Record<string, string>): DocumentColumnRow {
  const figures = Object.fromEntries(Object.values(DOCUMENT_FIGURE_COLUMNS).map((column) => [column, orNull(row[column])]));
  return { status: orNull(row.status), ...figures } as DocumentColumnRow;
}

function categories(row: Record<string, string>): FingerprintColumns {
  return {
    cost_of_goods_lo: orNull(row.cost_of_goods_lo),
    cost_of_goods_hi: orNull(row.cost_of_goods_hi),
    personnel_cost_lo: orNull(row.personnel_cost_lo),
    personnel_cost_hi: orNull(row.personnel_cost_hi),
    asset_intensity_lo: orNull(row.asset_intensity_lo),
    asset_intensity_hi: orNull(row.asset_intensity_hi),
    inventory: bool(row.inventory),
    capitalised_intangibles: bool(row.capitalised_intangibles),
  };
}

const key = (row: Record<string, string>) => `${row.orgnr ?? ''}/${row.filing_year ?? ''}`;

describe('the committed seed’s fingerprints', () => {
  const allowListed = new Set([
    ...parseAllowList(JSON.parse(readFileSync(path.join(root, ALLOW_LIST_FILE), 'utf8'))),
    ...parseDrawn(JSON.parse(readFileSync(path.join(root, REFERENCE_DRAW_FILE), 'utf8'))).map((d) => d.orgnr),
  ]);
  const all = csv('fingerprint.csv');
  const fingerprints = all.filter((f) => allowListed.has(f.orgnr ?? ''));
  const unlisted = all.length - fingerprints.length;
  const columns = new Map(csv('document_column.csv').filter((c) => c.role === 'current').map((c) => [key(c), c]));
  const documents = new Map(csv('document.csv').map((d) => [key(d), d]));
  const keyFigures = new Map(csv('key_figures.csv').map((k) => [k.brreg_id ?? '', k]));

  /** What the engine derives for one current column of the seed. */
  function recompute(column: Record<string, string>) {
    const brregId = orNull(documents.get(key(column))?.brreg_id);
    const filing = brregId === null ? undefined : keyFigures.get(brregId);
    const subtotals = apiSubtotalsFromRow({
      sum_anleggsmidler_ore: orNull(filing?.sum_anleggsmidler_ore),
      sum_omloepsmidler_ore: orNull(filing?.sum_omloepsmidler_ore),
    });
    return fingerprintOf(documentFigures(columnRow(column)), subtotals);
  }

  it('holds allow-listed fingerprints, each of a current document column in the seed', () => {
    expect(fingerprints.length).toBeGreaterThan(0);
    const orphans = fingerprints.filter((f) => !columns.has(key(f)));
    expect(orphans.length).toBe(0);
  });

  it(`counts ${unlisted} fingerprint row(s) of companies outside the allow-list, which have no figures to recompute from`, () => {
    // Only an open licence gate exports them; their document columns are never in the seed.
    const withColumns = all.filter((f) => !allowListed.has(f.orgnr ?? '') && columns.has(key(f)));
    expect(withColumns.length).toBe(0);
  });

  it('recomputes every stored digest and every stored category from the committed figures', () => {
    const mismatches: string[] = [];
    for (const stored of fingerprints) {
      const column = columns.get(key(stored));
      if (column === undefined) continue; // reported by the test above
      const result = recompute(column);
      if (result.kind !== 'fingerprint') {
        mismatches.push(`${key(stored)}: stored, but the engine skips it (${result.reason})`);
        continue;
      }
      if (digest(result.inputs) !== stored.input_digest) mismatches.push(`${key(stored)}: input digest differs`);
      // Compared without printing either side.
      if (JSON.stringify(fingerprintFromColumns(categories(stored))) !== JSON.stringify(result.fingerprint)) {
        mismatches.push(`${key(stored)}: categories differ`);
      }
      if (stored.dataset !== column.dataset) mismatches.push(`${key(stored)}: dataset tag differs from the column's`);
    }
    expect(mismatches).toEqual([]);
  });

  it('has a row for every current column the engine fingerprints', () => {
    const stored = new Set(fingerprints.map(key));
    const missing = [...columns.values()]
      .filter((column) => recompute(column).kind === 'fingerprint' && !stored.has(key(column)))
      .map(key);
    expect(missing).toEqual([]);
  });
});
