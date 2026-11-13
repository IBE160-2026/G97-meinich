// The cost plan and the sample (Story 2.6). Invented companies only.
import { describe, expect, it } from 'vitest';
import { costPlan, drawSample } from '../../scripts/classify/plan.ts';
import { SYSTEM_PROMPT, type Target } from '../../scripts/classify/request.ts';

const target = (orgnr: string, text: string | null = 'Tekst'): Target => ({
  orgnr,
  navn: 'OPPDIKTET AS',
  naeringskode2: null,
  naeringskode3: null,
  aktivitet: text,
  vedtektsfestet_formaal: text,
});
const many = Array.from({ length: 50 }, (_, i) => target(String(100000000 + i)));

describe('the sample', () => {
  it('a sample never holds a labelled orgnr', () => {
    const labelled = new Set(many.slice(0, 40).map((company) => company.orgnr));
    const drawn = drawSample(many, labelled, 30);
    expect(drawn).toHaveLength(10);
    for (const company of drawn) expect(labelled.has(company.orgnr)).toBe(false);
  });

  it('draws the same companies whatever order they come in', () => {
    const forward = drawSample(many, new Set(), 10).map((company) => company.orgnr);
    const backward = drawSample([...many].reverse(), new Set(), 10).map((company) => company.orgnr);
    expect(backward).toEqual(forward);
  });

  it('draws only companies with something to classify on', () => {
    expect(drawSample([target('100000000', null)], new Set(), 5)).toEqual([]);
  });
});

describe('the cost plan', () => {
  it('computes tokens and dollars from the characters of the request', () => {
    const input = { navn: 'X' };
    const chars = SYSTEM_PROMPT.length + JSON.stringify(input).length;
    const plan = costPlan([input]);
    expect(plan.central.inputTokens).toBe(Math.ceil(chars / 3) + 300);
    expect(plan.central.outputTokens).toBe(115);
    expect(plan.ceiling.outputTokens).toBe(2000);
    expect(plan.ceiling.usd.toNumber()).toBeCloseTo((plan.ceiling.inputTokens * 0.05 + 2000 * 0.25) / 1e6, 10);
  });

  it('is zero with nothing to send', () => {
    expect(costPlan([]).ceiling.usd.isZero()).toBe(true);
  });
});
