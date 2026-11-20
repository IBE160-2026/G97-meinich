// What a kroner amount is computed from (Story 3.7): the derivation rules
// reproduce the values `resolveApiInputs`, `documentRevenue` and
// `documentCostLines` give, a cost line within ±5 kr is set to 0 at both
// bounds, and the quartile line reads "=", "≈" or the one value by the
// engine's rule for either quartile.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/engine/decimal.ts';
import {
  COST_LINES,
  type DocumentField,
  documentCostLines,
  documentFigures,
  documentRevenue,
} from '../../src/engine/document-inputs.ts';
import { shownPercent } from '../../src/engine/format.ts';
import { resolveApiInputs } from '../../src/engine/key-figures.ts';
import {
  API_DERIVATIONS,
  type ApiInputField,
  apiInput,
  bestQuartile,
  documentInput,
  lineIsApproximate,
  operandSum,
  quartileLine,
  type ProvenanceInput,
} from '../../src/engine/provenance.ts';
import { percentileInc } from '../../src/engine/statistics.ts';
import type { ApiInputs } from '../../src/engine/types.ts';
import { column, type Lines } from '../analysis/document-fixture.ts';

const d = (value: string | number) => new Decimal(value);

/** What a derivation gives: the operands' signed sum, or 0 for a cost line within the bound. */
function derivedValue(input: ProvenanceInput): bigint {
  if (input.derivation === null) throw new Error(`${input.field} is stated`);
  return input.derivation.kind === 'sum' ? operandSum(input.derivation.operands) : 0n;
}

describe('each rule reproduces its value', () => {
  const STATED: ApiInputs = {
    sumDriftsinntekter: 1_671_428_600n,
    driftsresultat: 35_100_000n,
    sumDriftskostnad: 1_636_328_600n,
    sumEiendeler: 730_000_000n,
    sumEgenkapitalGjeld: 730_000_000n,
    sumEgenkapital: 200_000_000n,
    sumGjeld: 530_000_000n,
  };
  const FIELDS = Object.keys(API_DERIVATIONS) as ApiInputField[];

  it.each(FIELDS)('the API input %s: stated as filed, and derived as resolveApiInputs derives it', (field) => {
    const stated = apiInput(STATED, field);
    expect(stated).toEqual({ field, source: 'api', ore: STATED[field], derivation: null });
    const empty: ApiInputs = { ...STATED, [field]: null };
    const derived = apiInput(empty, field);
    const resolved = resolveApiInputs(empty)[field];
    expect(resolved?.derived).toBe(true);
    expect(derived?.ore).toBe(resolved?.ore);
    expect(derived === null ? null : derivedValue(derived)).toBe(resolved?.ore);
    // Every operand is stated: a derived value never feeds another derivation.
    for (const operand of derived?.derivation?.operands ?? []) expect(STATED[operand.field as keyof ApiInputs]).toBe(operand.ore);
  });

  it.each(FIELDS)('the API input %s with an operand missing too is underivable, as in resolveApiInputs', (field) => {
    const [first] = API_DERIVATIONS[field];
    if (first === undefined) throw new Error('a derivation has an operand');
    const empty: ApiInputs = { ...STATED, [field]: null, [first[0]]: null };
    expect(resolveApiInputs(empty)[field]).toBeNull();
    expect(apiInput(empty, field)).toBeNull();
  });

  it('a document revenue derived from driftsresultat + sumDriftskostnad', () => {
    const figures = documentFigures(column({ sumDriftsinntekter: null }));
    const revenue = documentRevenue(figures);
    if (revenue.kind !== 'value') throw new Error('the fixture has a revenue');
    expect(revenue.derived).toBe(true);
    const input = documentInput(figures, 'sumDriftsinntekter');
    expect(input?.ore).toBe(revenue.ore);
    expect(input === null ? null : derivedValue(input)).toBe(revenue.ore);
    expect(input?.derivation?.operands.map((operand) => operand.field)).toEqual(['driftsresultat', 'sumDriftskostnad']);
  });

  // Each cost line empty in turn, the remainder above the bound: the line is the remainder.
  it.each(COST_LINES)('a document cost line %s derived as the remainder of sumDriftskostnad', (line) => {
    const lines: Lines = { [line]: null, sumDriftskostnad: '700000000' };
    const figures = documentFigures(column(lines));
    const expected = documentCostLines(figures)[line];
    if (expected.kind !== 'value') throw new Error('the fixture derives the line');
    expect(expected.derived).toBe(true);
    const input = documentInput(figures, line);
    expect(input?.derivation?.kind).toBe('sum');
    expect(input?.ore).toBe(expected.ore);
    expect(input === null ? null : derivedValue(input)).toBe(expected.ore);
  });

  it('a stated line is as filed, with no rule', () => {
    const figures = documentFigures(column({}));
    for (const field of ['kundefordringer', 'salgsinntekt', 'varekostnad', 'sumDriftsinntekter'] as DocumentField[]) {
      const input = documentInput(figures, field);
      expect(input?.derivation, field).toBeNull();
    }
    expect(documentInput(figures, 'kundefordringer')?.ore).toBe(5_000_000n);
  });
});

describe('a cost line within ±5 kr, both bounds', () => {
  // BASE_LINES' cost lines sum to 656 500 000 øre with nedskrivninger stated as 0.
  it.each([
    ['+5 kr', 500n],
    ['−5 kr', -500n],
  ] as const)('a remainder of exactly %s: derived as 0, with the rest named', (_label, rest) => {
    const lines: Lines = { nedskrivninger: null, sumDriftskostnad: (656_500_000n + rest).toString() };
    const figures = documentFigures(column(lines));
    const expected = documentCostLines(figures).nedskrivninger;
    expect(expected).toEqual({ kind: 'value', ore: 0n, derived: true });
    const input = documentInput(figures, 'nedskrivninger');
    expect(input?.ore).toBe(0n);
    expect(input?.derivation).toMatchObject({ kind: 'rounding_zero', rest });
    if (input?.derivation?.kind !== 'rounding_zero') throw new Error('within the bound');
    expect(operandSum(input.derivation.operands)).toBe(rest);
  });

  it('one øre outside the bound: the line is the remainder, not 0', () => {
    const lines: Lines = { nedskrivninger: null, sumDriftskostnad: (656_500_000n + 501n).toString() };
    const input = documentInput(documentFigures(column(lines)), 'nedskrivninger');
    expect(input?.derivation?.kind).toBe('sum');
    expect(input?.ore).toBe(501n);
  });
});

describe('the T line: =, ≈ and f = 0, both quartiles', () => {
  // Ten values: the upper quartile is h = 6.75 (k = 7, f = 0.75), the lower h = 2.25 (k = 3, f = 0.25).
  const ten = (a: string, b: string, k: number): Decimal[] =>
    Array.from({ length: 10 }, (_, i) => (i < k - 1 ? d('0.001').mul(i) : i === k - 1 ? d(a) : i === k ? d(b) : d(b).plus(d('0.001').mul(i))));
  const shown = (value: Decimal) => shownPercent(value.toString());

  it.each([
    // upper: 1,0 % + 0,75 × (1,4 % − 1,0 %) = 1,3 % exactly as shown.
    ['upper', '=', ten('0.010', '0.014', 7), 'higher_is_better', false],
    // upper: 1,0 % + 0,75 × (1,1 % − 1,0 %) = 1,075 %, shown 1,1 %.
    ['upper', '≈', ten('0.010', '0.011', 7), 'higher_is_better', true],
    // lower: 1,0 % + 0,25 × (1,4 % − 1,0 %) = 1,1 % exactly as shown.
    ['lower', '=', ten('0.010', '0.014', 3), 'lower_is_better', false],
    // lower: 1,0 % + 0,25 × (1,1 % − 1,0 %) = 1,025 %, shown 1,0 %.
    ['lower', '≈', ten('0.010', '0.011', 3), 'lower_is_better', true],
  ] as const)('%s quartile, %s', (which, _sign, values, direction, approximate) => {
    const { which: quartile, p } = bestQuartile(direction);
    expect(quartile).toBe(which);
    const line = quartileLine(values, p, shown);
    if (line.kind !== 'between') throw new Error('ten values interpolate');
    expect(line.k).toBe(which === 'upper' ? 7 : 3);
    expect(line.f.toString()).toBe(which === 'upper' ? '0.75' : '0.25');
    expect(line.a.eq(values[line.k - 1] as Decimal)).toBe(true);
    expect(line.b.eq(values[line.k] as Decimal)).toBe(true);
    expect(line.quartile.eq(percentileInc(values, p))).toBe(true);
    // The fixture's state first: what the shown numbers give against the shown T.
    const expression = shown(line.a).plus(line.f.mul(shown(line.b).minus(shown(line.a))));
    expect(expression.eq(shown(line.quartile))).toBe(!approximate);
    expect(line.approximate).toBe(approximate);
  });

  it.each([
    ['upper', 'higher_is_better', 4],
    ['lower', 'lower_is_better', 2],
  ] as const)('%s quartile with f = 0: the quartile is one value', (_which, direction, k) => {
    // Five values: h = 3 for the upper quartile, 1 for the lower.
    const values = [d('0.01'), d('0.02'), d('0.03'), d('0.04'), d('0.05')];
    const line = quartileLine(values, bestQuartile(direction).p, shown);
    expect(line).toMatchObject({ kind: 'at', k });
    expect(line.quartile.eq(values[k - 1] as Decimal)).toBe(true);
  });

  it('lineIsApproximate is "not equal", never the reverse', () => {
    expect(lineIsApproximate(d('1.3'), d('1.3'))).toBe(false);
    expect(lineIsApproximate(d('1.075'), d('1.1'))).toBe(true);
  });
});
