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
import { type Fraction, equals, fraction } from '../../src/engine/fraction.ts';
import { marginWaterfall, pooledOnRevenue } from '../../src/engine/waterfall.ts';
import {
  API_DERIVATIONS,
  type ApiInputField,
  apiInput,
  bestQuartile,
  CHECKS,
  type CheckId,
  type CheckResult,
  type CurrentReconciliation,
  dataQuality,
  documentInput,
  lineIsApproximate,
  operandSum,
  quartileLine,
  type ProvenanceInput,
  type StoredDocumentFacts,
} from '../../src/engine/provenance.ts';
import { percentileInc } from '../../src/engine/statistics.ts';
import type { ApiInputs } from '../../src/engine/types.ts';
import { column, readBasis, type Lines } from '../analysis/document-fixture.ts';
import { WF_PEERS, WF_SUBJECT } from '../analysis/waterfall-fixture.ts';

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
    // Every operand is stated: a derived value never feeds another derivation. Each field derives from its own
    // number of operands, but never from none.
    const operands = derived?.derivation?.operands ?? [];
    expect(operands, field).not.toHaveLength(0);
    for (const operand of operands) expect(STATED[operand.field as keyof ApiInputs]).toBe(operand.ore);
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

// Story 3.8, decision 4: the waterfall's start, end and sum are document amounts whose every
// input (sumDriftsinntekter, driftsresultat) both sources hold. They read `checked`, never
// "Avstemt", and only under 3.7's conditions for "Avstemt": api_check passed, the document
// compared with the chosen filing, and every input read in the column.
describe('checked: the waterfall’s start, end and sum (Story 3.8, decision 4)', () => {
  const FILING = 4242n;
  const API: ApiInputs = {
    sumDriftsinntekter: 1_000_000_000n,
    driftsresultat: 343_500_000n,
    sumDriftskostnad: 656_500_000n,
    sumEiendeler: 300_000_000n,
    sumEgenkapitalGjeld: 300_000_000n,
    sumEgenkapital: null,
    sumGjeld: null,
  };
  const PASS = Object.fromEntries(CHECKS.map((check) => [check, 'pass'])) as Record<CheckId, CheckResult>;

  function quality(lines: Lines, facts: Partial<StoredDocumentFacts> = {}, current: Partial<CurrentReconciliation> = {}) {
    const basis = readBasis(lines);
    if (basis.kind !== 'read') throw new Error('the fixture is read');
    const inputs = (['sumDriftsinntekter', 'driftsresultat'] as const).map((field) => {
      const input = documentInput(basis.current, field);
      if (input === null) throw new Error(`the fixture has ${field}`);
      return input;
    });
    const stored: StoredDocumentFacts = {
      readAt: new Date('2026-10-21T08:00:00Z'),
      brregId: FILING,
      current: { checks: PASS, apiCheck: 'pass', apiFailFields: [], figures: column(lines), ...current },
      ...facts,
    };
    return { basis, stored, inputs, check: () => dataQuality({ basis, facts: stored, api: API, inputs, amount: 'document', filingBrregId: FILING, checkable: true }) };
  }

  it('checked: every input compared, the fields named; never without `checkable`', () => {
    const { basis, stored, inputs, check } = quality({});
    expect(stored.current?.apiCheck).toBe('pass');
    expect(check()).toEqual({ kind: 'checked', fields: ['sumDriftsinntekter', 'driftsresultat'] });
    // A document amount that may not be checked keeps 3.7's throw.
    expect(() => dataQuality({ basis, facts: stored, api: API, inputs, amount: 'document', filingBrregId: FILING })).toThrow();
  });

  it('checked: the ids differ', () => {
    const { stored, check } = quality({}, { brregId: 4243n });
    expect(stored.brregId).not.toBe(FILING);
    expect(check()).toEqual({ kind: 'not_compared', fields: ['sumDriftsinntekter', 'driftsresultat'] });
  });

  it('checked: revenue derived', () => {
    const { inputs, check } = quality({ sumDriftsinntekter: null });
    // The fixture's state: revenue derived as driftsresultat + sumDriftskostnad, stated in the API.
    expect(inputs[0]?.derivation?.kind).toBe('sum');
    expect(API.sumDriftsinntekter).not.toBeNull();
    expect(check()).toEqual({ kind: 'not_compared', fields: ['sumDriftsinntekter'] });
  });

  it('checked: api_check not passed', () => {
    for (const apiCheck of ['not_evaluable', 'fail', null] as const) {
      const { check } = quality({}, {}, { apiCheck });
      expect(check(), String(apiCheck)).toEqual({ kind: 'not_compared', fields: ['sumDriftsinntekter', 'driftsresultat'] });
    }
  });
});

// Story 5.4 (deferred from Story 3.7, review of PR #82): a failed column is
// tied to the shown filing as a read one is. Compared with another filing,
// it names no deviation; compared with the shown one, it names what failed.
describe('a failed column and the shown filing (Story 5.4)', () => {
  const FILING = 4242n;
  const API: ApiInputs = {
    sumDriftsinntekter: 1_000_000_000n,
    driftsresultat: 343_500_000n,
    sumDriftskostnad: 656_500_000n,
    sumEiendeler: 300_000_000n,
    sumEgenkapitalGjeld: 300_000_000n,
    sumEgenkapital: null,
    sumGjeld: null,
  };
  const PASS = Object.fromEntries(CHECKS.map((check) => [check, 'pass'])) as Record<CheckId, CheckResult>;
  const basis = { kind: 'failed_reconciliation', filingYear: 2025 } as const;
  const inputs = (['driftsresultat', 'sumDriftsinntekter'] as const).map((field) => {
    const input = apiInput(API, field);
    if (input === null) throw new Error(`the fixture states ${field}`);
    return input;
  });
  const facts = (brregId: bigint | null): StoredDocumentFacts => ({
    readAt: new Date('2026-10-21T08:00:00Z'),
    brregId,
    current: { checks: PASS, apiCheck: 'fail', apiFailFields: ['driftsresultat'], figures: column({}) },
  });
  const quality = (brregId: bigint | null) =>
    dataQuality({ basis, facts: facts(brregId), api: API, inputs, amount: 'api', filingBrregId: FILING });

  it('failed against another filing is not compared', () => {
    expect(quality(4243n)).toEqual({ kind: 'not_compared', fields: ['driftsresultat', 'sumDriftsinntekter'] });
    expect(quality(null)).toEqual({ kind: 'not_compared', fields: ['driftsresultat', 'sumDriftsinntekter'] });
  });

  it('failed against the shown filing names what differed', () => {
    expect(quality(FILING)).toEqual({ kind: 'failed', apiFields: ['driftsresultat'], checks: [] });
  });
});

describe('Σ bars is (m − M) × R exactly (Story 3.8)', () => {
  it('Σ bars is (m − M) × R exactly', () => {
    const result = marginWaterfall(WF_SUBJECT, WF_PEERS, 2025, 'NOK');
    if (result.kind !== 'decomposition') throw new Error('the fixture has a waterfall');
    const R = result.subject.revenue;
    // The fixture's state (Design Notes): R = 1 500 000 000 kr, P = 10.
    expect(R).toBe(150_000_000_000n);
    expect(result.n).toBe(10);
    const m = fraction(result.subject.driftsresultat, R);
    const gap = fraction(m.numerator * result.pooledMargin.denominator - result.pooledMargin.numerator * m.denominator, m.denominator * result.pooledMargin.denominator);
    const expected = pooledOnRevenue(gap, R).ore;
    const bars = result.steps.reduce<Fraction>(
      (a, step) => fraction(a.numerator * step.ore.denominator + step.ore.numerator * a.denominator, a.denominator * step.ore.denominator),
      fraction(0n, 1n),
    );
    expect(equals(bars, expected)).toBe(true);
    expect(equals(result.totalOre, expected)).toBe(true);
    // And the shown bars sum to the shown total, −14 274 194 kr.
    expect(result.display.barKroner.reduce((a, b) => a + b, 0n)).toBe(result.display.totalKroner);
    expect(result.display.totalKroner).toBe(-14_274_194n);
  });
});
