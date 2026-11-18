// The key-figure table's view (Story 3.1b): the payload boundary. The rows
// the server renders, and so everything the table can pass to its client
// modules, are strings, booleans and strip geometry only: never a Decimal,
// a bigint, an amount in øre or a document basis (AD-4).
import { describe, expect, it } from 'vitest';
import { keyFigureTableView } from '../../src/analysis/key-figure-rows.ts';
import { benchmarkApiFigures, benchmarkDocumentFigures } from '../../src/engine/benchmark.ts';
import type { ApiInputs } from '../../src/engine/types.ts';
import { daysBasis, FAILED, NOT_IN_DATASET, readBasis, TEN_PEERS } from './document-fixture.ts';

const API: ApiInputs = {
  sumDriftsinntekter: 1_000_000_000n,
  driftsresultat: 21_000_000n,
  sumDriftskostnad: null,
  sumEiendeler: 300_000_000n,
  sumEgenkapitalGjeld: null,
  sumEgenkapital: 120_000_000n,
  sumGjeld: null,
};
const API_PEERS: ApiInputs[] = Array.from({ length: 10 }, (_, i) => ({ ...API, driftsresultat: BigInt((i + 1) * 10_000_000) }));

/** Every leaf of `value` with its path, outside the strip marks. */
function leaves(value: unknown, path: string, out: { path: string; value: unknown }[]): void {
  if (path.endsWith('.strip')) {
    // Geometry: positions in [0, 1] and two flags, nothing else.
    const strip = value as Record<string, unknown>;
    expect(Object.keys(strip).sort(), path).toEqual(['bandFrom', 'bandTo', 'best', 'median', 'mirrored', 'own'].sort());
    for (const key of ['bandFrom', 'bandTo', 'median']) expect(typeof strip[key], `${path}.${key}`).toBe('number');
    expect(strip.best === null || typeof strip.best === 'number', `${path}.best`).toBe(true);
    expect(typeof strip.mirrored, `${path}.mirrored`).toBe('boolean');
    expect(Object.keys(strip.own as object).sort(), `${path}.own`).toEqual(['at', 'clipped']);
    return;
  }
  if (value !== null && typeof value === 'object') {
    // Plain arrays and objects only: a Decimal (or any class instance) is not.
    const proto = Object.getPrototypeOf(value);
    expect(proto === Object.prototype || proto === Array.prototype, `${path} is a plain object`).toBe(true);
    for (const [key, child] of Object.entries(value)) leaves(child, `${path}.${key}`, out);
    return;
  }
  out.push({ path, value });
}

describe('the key-figure view', () => {
  it('row view holds only strings and strip marks', () => {
    const cases = [
      [daysBasis(50n, 5n), TEN_PEERS],
      [daysBasis(50n, 5n), TEN_PEERS.slice(0, 9)],
      [readBasis({ salgsinntekt: '0' }), TEN_PEERS],
      [NOT_IN_DATASET, TEN_PEERS],
      [FAILED, TEN_PEERS],
    ] as const;
    for (const [subject, peers] of cases) {
      const view = keyFigureTableView({
        api: benchmarkApiFigures(API, API_PEERS, 'NOK'),
        document: benchmarkDocumentFigures(subject, peers, 'NOK'),
        filingYear: 2025,
        smaaForetak: false,
      });
      const found: { path: string; value: unknown }[] = [];
      leaves(view, 'view', found);
      expect(found.length).toBeGreaterThan(100);
      for (const { path, value } of found) {
        expect(['string', 'boolean'].includes(typeof value) || value === null, `${path}: ${typeof value}`).toBe(true);
      }
      // No amount in øre or line of the fixture reaches a string: every
      // amount is written in kroner through format.ts.
      const strings = found.map((leaf) => String(leaf.value)).join('\n');
      for (const ore of ['36500000', '600000000', '656500000', '343500000', '100000000', '1000000000', '5000000']) {
        expect(strings).not.toMatch(new RegExp(`(?<!\\d)${ore}(?!\\d)`));
      }
    }
  });
});
