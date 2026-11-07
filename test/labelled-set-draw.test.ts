// The labelled set's draw (Story 5.1): analysis/labelled-set/draw.ts. The
// database half is not tested here; these are the rules the README states
// for the random draw, the strata and the sheets.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANDIDATES_PER_SUBJECT,
  type DrawnSubject,
  SUBJECTS_FILE,
  type SubjectsFile,
  chooseSubjects,
  descriptionOf,
  drawCandidates,
  semicolonCsv,
} from '../analysis/labelled-set/draw.ts';
import { parseSemicolonCsv } from '../scripts/ocr-sm2-compare.ts';

const root = path.resolve(import.meta.dirname, '..');
const pool = Array.from({ length: 80 }, (_, i) => String(900000000 + i * 7));

function subject(i: number): DrawnSubject {
  return { orgnr: String(910000000 + i), filingYear: 2025, poolSize: 40, candidates: [] };
}

describe('drawCandidates', () => {
  it('draws 30 distinct companies from the pool, whatever order the pool comes in', () => {
    const drawn = drawCandidates('923609016', pool);
    expect(drawn).toHaveLength(CANDIDATES_PER_SUBJECT);
    expect(new Set(drawn).size).toBe(CANDIDATES_PER_SUBJECT);
    expect(drawn.every((orgnr) => pool.includes(orgnr))).toBe(true);
    expect(drawCandidates('923609016', [...pool].reverse())).toEqual(drawn);
  });

  it('gives each subject its own stream', () => {
    expect(drawCandidates('923609016', pool)).not.toEqual(drawCandidates('923609024', pool));
  });

  it('refuses a pool below 30', () => {
    expect(() => drawCandidates('923609016', pool.slice(0, 29))).toThrow('pool of 29');
  });
});

describe('chooseSubjects', () => {
  const drawn = Array.from({ length: 40 }, (_, i) => subject(i));
  // Alternating scores, except that the first four are all ja.
  const scores = new Map(drawn.map((s, i) => [s.orgnr, i < 4 || i % 2 === 0 ? 'ja' : 'Nei ']));

  it('takes the first 15 of each stratum in shuffled order, and the first 3 of each are blind', () => {
    const chosen = chooseSubjects(drawn, scores);
    expect(chosen.filter((s) => s.informative)).toHaveLength(15);
    expect(chosen.filter((s) => !s.informative)).toHaveLength(15);
    expect(chosen.filter((s) => s.blind).map((s) => s.orgnr)).toEqual([
      '910000000', '910000001', '910000002', '910000005', '910000007', '910000009',
    ]);
  });

  it('stops reading scores once both strata are full', () => {
    const partial = new Map([...scores].slice(0, 34)); // the 15th nei is the 34th subject
    expect(chooseSubjects(drawn, partial)).toHaveLength(30);
  });

  it('refuses an unscored subject before the strata are full, and a score that is neither ja nor nei', () => {
    expect(() => chooseSubjects(drawn, new Map([...scores].slice(0, 10)))).toThrow('is not scored');
    expect(() => chooseSubjects(drawn, new Map([[drawn[0]?.orgnr ?? '', 'kanskje']]))).toThrow('neither ja nor nei');
  });
});

describe('the sheets and the register fields', () => {
  it('quote a cell with a separator, a quote or a line break, and read back unchanged', () => {
    const rows = [['a;b', 'sa "hei"', 'linje\nto', 'æøå']];
    expect(parseSemicolonCsv(semicolonCsv(rows)).slice(0, 1)).toEqual(rows);
  });

  it('read aktivitet first and fall back to vedtektsfestetFormaal', () => {
    expect(descriptionOf({ aktivitet: ['Utvikling', 'av apper.'], vedtektsfestetFormaal: ['x'] })).toBe('Utvikling av apper.');
    expect(descriptionOf({ vedtektsfestetFormaal: ['Programvare.'] })).toBe('Programvare.');
    expect(descriptionOf({})).toBe('');
  });
});

describe('the committed first step', () => {
  const subjects = JSON.parse(readFileSync(path.join(root, ...SUBJECTS_FILE.split('/')), 'utf8')) as SubjectsFile;

  it('has 150 subjects, each with 30 distinct candidates that never include itself', () => {
    const drawn = subjects.walked.filter((w): w is { n: number } & DrawnSubject => !('skipped' in w));
    expect(drawn).toHaveLength(150);
    for (const s of drawn) {
      expect(new Set(s.candidates).size).toBe(CANDIDATES_PER_SUBJECT);
      expect(s.candidates).not.toContain(s.orgnr);
      expect(s.poolSize).toBeGreaterThanOrEqual(CANDIDATES_PER_SUBJECT);
    }
  });
});
