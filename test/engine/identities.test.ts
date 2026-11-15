// The two decompositions of `docs/key-figures.md` hold exactly (Story 3.1a;
// FR-21, NFR28): return on assets = operating margin × total asset turnover,
// and personnel cost share = personnel cost per årsverk ÷ revenue per
// årsverk. Asserted with Decimal equality and no tolerance, on every
// reference case and on 5 000 generated øre vectors from a seeded PRNG
// (1 øre to 10¹⁸, both signs, 500 and 501 øre, 2⁵³ ± 1).
//
// They hold because the engine computes each figure as a reduced fraction
// and divides once: the product of the two factor fractions reduces to the
// very fraction of the figure, so one division gives the same Decimal.
// (d/r) × (r/a) in Decimal would round twice and miss.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/engine/decimal.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentColumnRow,
  documentBasis,
  documentCostLines,
  documentRevenue,
} from '../../src/engine/document-inputs.ts';
import { computeDocumentKeyFigures, documentKeyFigureFractions, perAarsverk } from '../../src/engine/document-key-figures.ts';
import { divide, equals, multiply, toDecimal } from '../../src/engine/fraction.ts';
import { apiKeyFigureFractions, computeApiKeyFigures } from '../../src/engine/key-figures.ts';
import type { ApiInputs } from '../../src/engine/types.ts';
import { seedApiInputs, seedDocumentBasis } from './reference-seed.ts';

// Story 1.4's API cases and the key-figures filings of the document cases.
const API_CASES = [
  ...['6322367', '2586403', '3384677', '4853771', '6741746', '4682315'],
  ...['5665391', '4872433', '6583869', '6972914', '5067689', '6097623', '7015592', '4555511'],
];

const DOCUMENT_CASES: readonly (readonly [string, number])[] = [
  ['911561972', 2024],
  ['915338534', 2023],
  ['915648479', 2021],
  ['917397198', 2021],
  ['917526729', 2025],
  ['918618716', 2025],
  ['927533235', 2023],
  ['936252710', 2024],
  ['989081799', 2025],
  ['992036079', 2023],
];

/** ROA = margin × turnover, exactly, where all three are defined; returns whether it was checked. */
function returnOnAssetsIdentity(inputs: ApiInputs): boolean {
  const exact = apiKeyFigureFractions(inputs);
  const { driftsmargin, totalAssetTurnover, totalkapitalrentabilitet } = exact;
  if (driftsmargin.kind !== 'value' || totalAssetTurnover.kind !== 'value' || totalkapitalrentabilitet.kind !== 'value') {
    return false;
  }
  const product = multiply(driftsmargin.fraction, totalAssetTurnover.fraction);
  expect(equals(product, totalkapitalrentabilitet.fraction)).toBe(true);
  const roa = computeApiKeyFigures(inputs).totalkapitalrentabilitet;
  if (roa.kind !== 'value') throw new Error('ROA has a fraction but no value');
  expect(toDecimal(product).eq(roa.value), `${toDecimal(product).toString()} ≠ ${roa.value.toString()}`).toBe(true);
  return true;
}

/** Personnel share = cost per årsverk ÷ revenue per årsverk, exactly, where defined; returns whether it was checked. */
function personnelIdentity(basis: DocumentBasis, aarsverkTenths: bigint): boolean {
  if (basis.kind !== 'read') return false;
  const share = computeDocumentKeyFigures(basis).lonn;
  const shareExact = documentKeyFigureFractions(basis).lonn;
  const cost = perAarsverk({ field: 'lonnskostnad', amount: documentCostLines(basis.current).lonnskostnad }, aarsverkTenths);
  const revenue = perAarsverk({ field: 'sumDriftsinntekter', amount: documentRevenue(basis.current) }, aarsverkTenths);
  if (share.kind !== 'value' || shareExact.kind !== 'value' || cost.kind !== 'value' || revenue.kind !== 'value') return false;
  if (revenue.fraction.numerator === 0n) return false;
  const ratio = divide(cost.fraction, revenue.fraction);
  expect(equals(ratio, shareExact.fraction)).toBe(true);
  expect(toDecimal(ratio).eq(share.value), `${toDecimal(ratio).toString()} ≠ ${share.value.toString()}`).toBe(true);
  return true;
}

// SplitMix64: a fixed seed, so every run draws the same 5 000 vectors.
function prng(seed: bigint): () => bigint {
  let state = seed;
  const mask = (1n << 64n) - 1n;
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & mask;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & mask;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & mask;
    return z ^ (z >> 31n);
  };
}

const TWO_53 = 2n ** 53n;
const SPECIAL = [1n, 500n, 501n, TWO_53 - 1n, TWO_53, TWO_53 + 1n, 10n ** 18n];

/** A positive amount in øre, 1 to 10¹⁸: a special value one time in four, else a random number of 1 to 18 digits. */
function magnitude(next: () => bigint): bigint {
  if (next() % 4n === 0n) return SPECIAL[Number(next() % BigInt(SPECIAL.length))] as bigint;
  const digits = 1n + (next() % 18n);
  const bound = 10n ** digits;
  return 1n + (next() % bound);
}

const signed = (next: () => bigint): bigint => (next() % 2n === 0n ? 1n : -1n) * magnitude(next);

function column(lonnskostnad: bigint, revenue: bigint): DocumentColumnRow {
  const figures = Object.fromEntries(Object.values(DOCUMENT_FIGURE_COLUMNS).map((name) => [name, null]));
  return {
    status: 'reconciled',
    ...figures,
    lonnskostnad_ore: lonnskostnad.toString(),
    sum_driftsinntekter_ore: revenue.toString(),
  } as DocumentColumnRow;
}

describe('ROA = margin × turnover', () => {
  it('holds exactly on every reference case', () => {
    let checked = 0;
    for (const brregId of API_CASES) if (returnOnAssetsIdentity(seedApiInputs(brregId))) checked += 1;
    // 3384677, 4853771, 6741746 and 7015592 have no margin, 4682315 no ROA; the other nine are checked.
    expect(checked).toBe(API_CASES.length - 5);
  });

  it('holds exactly on 5 000 generated øre vectors', () => {
    const next = prng(20261115n);
    let checked = 0;
    for (let i = 0; i < 5_000; i += 1) {
      const sumDriftsinntekter = magnitude(next);
      const sumEiendeler = magnitude(next);
      const driftsresultat = signed(next);
      const inputs: ApiInputs = {
        sumDriftsinntekter,
        driftsresultat,
        sumDriftskostnad: sumDriftsinntekter - driftsresultat,
        sumEiendeler,
        sumEgenkapitalGjeld: sumEiendeler,
        sumEgenkapital: signed(next),
        sumGjeld: null,
      };
      if (returnOnAssetsIdentity(inputs)) checked += 1;
    }
    expect(checked).toBe(5_000);
  });

  it('would not hold multiplying the two Decimals', () => {
    // The reason for fractions: 1/2 × 2/3 in 40 digits is 0.5 × 0.666…667, not 1/3.
    const margin = new Decimal(1).div(2);
    const turnover = new Decimal(2).div(3);
    expect(margin.mul(turnover).eq(new Decimal(1).div(3))).toBe(false);
    expect(
      returnOnAssetsIdentity({
        sumDriftsinntekter: 2n,
        driftsresultat: 1n,
        sumDriftskostnad: 1n,
        sumEiendeler: 3n,
        sumEgenkapitalGjeld: 3n,
        sumEgenkapital: 1n,
        sumGjeld: 2n,
      }),
    ).toBe(true);
  });
});

describe('personnel share = per-FTE ratio', () => {
  it('holds exactly on every reference case with a personnel share', () => {
    let checked = 0;
    for (const [orgnr, year] of DOCUMENT_CASES) {
      for (const tenths of [1n, 37n, 125n, 10_000_001n]) {
        if (personnelIdentity(seedDocumentBasis(orgnr, year), tenths)) checked += 1;
      }
    }
    // 915338534, 927533235 and 936252710 have no lønnskostnad; 989081799 has zero revenue.
    expect(checked).toBe((DOCUMENT_CASES.length - 4) * 4);
  });

  it('holds exactly on 5 000 generated øre vectors', () => {
    const next = prng(31n);
    let checked = 0;
    for (let i = 0; i < 5_000; i += 1) {
      const basis = documentBasis({
        inManifest: true,
        filingYear: 2025,
        document: { status: 'reconciled', current: column(signed(next), magnitude(next)), prior: null, priorApiFailFields: null },
        sumOmloepsmidler: null,
      });
      const tenths = 1n + (next() % 10_000_000n);
      if (personnelIdentity(basis, tenths)) checked += 1;
    }
    expect(checked).toBe(5_000);
  });
});
