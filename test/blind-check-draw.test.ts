// The blind check's selection (Story 2.3): analysis/ocr-reference/blind-check-draw.ts
// reproduces, from the transcriptions before the logged corrections, the 20
// cells of the committed blind-check.csv and the committed key.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLIND_CHECK_FILE,
  BLIND_CHECK_KEY_FILE,
  blindCheckCells,
  blindCheckKeyCsv,
} from '../analysis/ocr-reference/blind-check-draw.ts';
import { parseSemicolonCsv } from '../scripts/ocr-sm2-compare.ts';
import { readInputs } from '../scripts/ocr-sm2.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative: string) => readFileSync(path.join(root, ...relative.split('/')), 'utf8').replaceAll('\r\n', '\n');

describe('the blind check draw', () => {
  const cells = blindCheckCells(readInputs(root).before);

  it('selects the cells of blind-check.csv, in its order', () => {
    const [header, ...rows] = parseSemicolonCsv(read(BLIND_CHECK_FILE));
    expect(header?.slice(0, 5)).toEqual(['n', 'orgnr', 'filing_year', 'column', 'field']);
    const label = { current: 'this year', prior: 'last year' } as const;
    expect(cells.map((c) => [String(c.n), c.orgnr, String(c.filingYear), label[c.role], c.field])).toEqual(
      rows.map((row) => row.slice(0, 5)),
    );
  });

  it('writes the committed key: six suspected cells and fourteen controls', () => {
    expect(read(BLIND_CHECK_KEY_FILE)).toBe(blindCheckKeyCsv(cells));
    expect(cells.filter((c) => c.suspected)).toHaveLength(6);
    expect(cells).toHaveLength(20);
  });

  it('depends on the seed', () => {
    expect(blindCheckKeyCsv(blindCheckCells(readInputs(root).before, 1))).not.toBe(blindCheckKeyCsv(cells));
  });
});
