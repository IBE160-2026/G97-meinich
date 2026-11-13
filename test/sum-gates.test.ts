// The sum gates' operands as the report and the 2.1b counts see them
// (scripts/sum-gates.ts, Story 2.5b) must be the gates step 1 runs
// (`SUM_GATES` in ingest/src/peerless_ingest/documents.py, the parts from
// `layout.PARTS`): a gate added or changed on one side fails here.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUM_GATES, SUM_GATE_OPERANDS, gateCounts, parseTextArray } from '../scripts/sum-gates.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(root, 'ingest/src/peerless_ingest', file), 'utf8');
const names = (text: string) => [...text.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

describe('the sum gates mirror', () => {
  it('names the operands step 1 sums', () => {
    const documents = read('documents.py');
    const gates = /SUM_GATES: [^\n]* = \{([\s\S]*?)\n\}/.exec(documents)?.[1] ?? '';
    const cost = /"cost_lines": \(([\s\S]*?)\),\n    "intangible_parts"/.exec(gates)?.[1] ?? '';
    expect(names(cost)).toEqual(['sum_driftskostnad', ...SUM_GATE_OPERANDS.cost_lines]);
    expect(gates).toMatch(/"intangible_parts": \("sum_immaterielle_eiendeler", layout\.PARTS\)/);
    const parts = /PARTS: tuple\[str, \.\.\.\] = \(([^)]*)\)/.exec(read('layout.py'))?.[1] ?? '';
    expect(names(parts)).toEqual([...SUM_GATE_OPERANDS.intangible_parts]);
    expect(SUM_GATES).toEqual(['cost_lines', 'intangible_parts']);
  });

  it('reads a stored field list and refuses anything else', () => {
    expect(parseTextArray('{}', 'x')).toEqual([]);
    expect(parseTextArray('{driftsresultat,goodwill}', 'x')).toEqual(['driftsresultat', 'goodwill']);
    expect(() => parseTextArray('driftsresultat', 'x')).toThrow(/x: not a field list/);
    expect(() => parseTextArray('{"a b"}', 'x')).toThrow(/not a field list/);
  });

  it('counts an admitted operand once, and on an operand counted as 0 only when another operand of its gate is NULL', () => {
    const held = (fields: string[]) => (field: string) => fields.includes(field);
    const counts = gateCounts([
      { digitsPassFields: ['goodwill', 'sum_egenkapital_gjeld'], hasFigure: held(['forskning_og_utvikling', 'konsesjoner_patenter', 'goodwill', 'utsatt_skattefordel']) },
      { digitsPassFields: ['utsatt_skattefordel'], hasFigure: held(['utsatt_skattefordel']) },
    ]);
    expect(counts).toEqual({
      cost_lines: { admitted: 0, withOperandCountedAsZero: 0 },
      intangible_parts: { admitted: 2, withOperandCountedAsZero: 1 },
    });
  });
});
