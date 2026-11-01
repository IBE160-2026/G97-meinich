// The within-band spread test (Story 2.5, D3; FR-13), committed with its
// threshold before the spread script (scripts/fingerprint-spread.ts) first
// ran on data. Cost of goods share and personnel cost share select peers
// only as bands (D1) and are benchmarked within their band, so each band
// must still spread: in every band holding at least MIN_N read shares, the
// interquartile range of the share is at least MIN_IQR_PP percentage
// points. A band below MIN_N is reported only.
//
// The output is aggregates only. A missing file fails; it never skips
// (Meinich). If a band fails, the band is not dropped or explained away
// here: the figures go to Meinich (D3).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Decimal } from '../src/engine/decimal.ts';

const MIN_N = 10;
const MIN_IQR_PP = new Decimal('2');

const root = path.resolve(import.meta.dirname, '..');
const OUTPUT = 'analysis/output/fingerprint-spread-62100.json';
const CATEGORIES = ['costOfGoods', 'personnelCost'] as const;
const BANDS = ['low', 'mid', 'high'] as const;

type BandEntry = { readonly n: number; readonly iqr_pp: string | null };

function readOutput(): Record<string, unknown> {
  const file = path.join(root, OUTPUT);
  if (!existsSync(file)) throw new Error(`${OUTPUT} is missing; run \`pnpm analysis:spread\` (Story 2.5, D4 step 5)`);
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function entry(output: Record<string, unknown>, category: string, band: string): BandEntry {
  const categories = output.categories as Record<string, Record<string, BandEntry>> | undefined;
  const value = categories?.[category]?.[band];
  if (value === undefined || typeof value.n !== 'number' || !(value.iqr_pp === null || typeof value.iqr_pp === 'string')) {
    throw new Error(`${OUTPUT}: no entry for ${category}/${band}`);
  }
  return value;
}

describe('within-band spread, 62.100', () => {
  it('is measured for industry 62.100', () => {
    expect(readOutput().industry).toBe('62.100');
  });

  for (const category of CATEGORIES) {
    for (const band of BANDS) {
      it(`${category} ${band}: with n ≥ ${MIN_N}, the interquartile range is ≥ ${MIN_IQR_PP.toString()} percentage points`, () => {
        const { n, iqr_pp } = entry(readOutput(), category, band);
        if (n < MIN_N) return; // reported only (D3)
        expect(iqr_pp).not.toBeNull();
        expect(new Decimal(iqr_pp ?? '0').gte(MIN_IQR_PP), `${category} ${band}: n ${n}, IQR ${iqr_pp ?? '–'} pp`).toBe(true);
      });
    }
  }
});
