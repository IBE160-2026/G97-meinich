// The key-figure table's view (Story 3.1b): the payload boundary. The rows
// the server renders, and so everything the table can pass to its client
// modules, are strings, booleans and strip geometry only: never a Decimal,
// a bigint, an amount in øre or a document basis (AD-4).
import { describe, expect, it } from 'vitest';
import { keyFigureTableView } from '../../src/analysis/key-figure-rows.ts';
import { benchmarkApiFigures, benchmarkDocumentFigures, benchmarkTotalAssetTurnover } from '../../src/engine/benchmark.ts';
import { marginWaterfall } from '../../src/engine/waterfall.ts';
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

type Walk = {
  /** Every leaf with its path, outside the strip marks and the waterfall's geometry. */
  readonly leaves: { path: string; value: unknown }[];
  readonly strips: { path: string; strip: Record<string, unknown> }[];
  readonly geometries: { path: string; geometry: Record<string, unknown> }[];
  readonly zeros: { path: string; value: unknown }[];
  /** Every object and array on the way, for the plain-object check. */
  readonly objects: { path: string; value: object }[];
};

/** Collects the parts of `value`; `expectMarks` asserts over each list, so no expect sits in a branch. */
function walk(value: unknown, path: string, out: Walk = { leaves: [], strips: [], geometries: [], zeros: [], objects: [] }): Walk {
  if (path.endsWith('.strip')) {
    out.strips.push({ path, strip: value as Record<string, unknown> });
  } else if (path.endsWith('.geometry')) {
    out.geometries.push({ path, geometry: value as Record<string, unknown> });
  } else if (path.endsWith('.waterfall.zero')) {
    out.zeros.push({ path, value });
  } else if (value !== null && typeof value === 'object') {
    out.objects.push({ path, value });
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, out);
  } else {
    out.leaves.push({ path, value });
  }
  return out;
}

function expectMarks(parts: Walk): void {
  // Geometry: positions in [0, 1] and two flags, nothing else.
  for (const { path, strip } of parts.strips) {
    expect(Object.keys(strip).sort(), path).toEqual(['bandFrom', 'bandTo', 'best', 'median', 'mirrored', 'own'].sort());
    for (const key of ['bandFrom', 'bandTo', 'median']) expect(typeof strip[key], `${path}.${key}`).toBe('number');
    expect(strip.best === null || typeof strip.best === 'number', `${path}.best`).toBe(true);
    expect(typeof strip.mirrored, `${path}.mirrored`).toBe('boolean');
    expect(Object.keys(strip.own as object).sort(), `${path}.own`).toEqual(['at', 'clipped']);
  }
  // The margin waterfall's geometry (Story 3.3): positions on its kroner scale, nothing else.
  for (const { path, geometry } of parts.geometries) {
    expect(Object.keys(geometry).sort(), path).toEqual(['end', 'from', 'to']);
    for (const key of ['end', 'from', 'to']) expect(typeof geometry[key], `${path}.${key}`).toBe('number');
  }
  for (const { path, value } of parts.zeros) expect(typeof value, path).toBe('number');
  // Plain arrays and objects only: a Decimal (or any class instance) is not.
  for (const { path, value } of parts.objects) {
    const proto = Object.getPrototypeOf(value);
    expect(proto === Object.prototype || proto === Array.prototype, `${path} is a plain object`).toBe(true);
  }
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
    const marks = { strips: 0, geometries: 0, zeros: 0 };
    for (const [subject, peers] of cases) {
      const view = keyFigureTableView({
        api: benchmarkApiFigures(API, API_PEERS, 'NOK'),
        turnover: benchmarkTotalAssetTurnover(API, API_PEERS),
        document: benchmarkDocumentFigures(subject, peers, 'NOK'),
        waterfall: marginWaterfall(subject, peers, 2025, 'NOK'),
        filingYear: 2025,
        smaaForetak: false,
      });
      const parts = walk(view, 'view');
      expectMarks(parts);
      marks.strips += parts.strips.length;
      marks.geometries += parts.geometries.length;
      marks.zeros += parts.zeros.length;
      const found = parts.leaves;
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
    // Each mark's checks ran: the compared cases draw strips, and a waterfall its geometry and zero.
    expect(marks.strips).toBeGreaterThan(0);
    expect(marks.geometries).toBeGreaterThan(0);
    expect(marks.zeros).toBeGreaterThan(0);
  });
});
