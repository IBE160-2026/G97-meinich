// The selection of the blind check (Story 2.3; README "Blind check after the
// first measurement"), committed so it can be audited and rerun.
//
// The 20 cells of blind-check.csv are the six "suspected" cells, the misread
// figures in reconciled columns of the first measurement, mixed with 14
// "control" cells drawn from the cells where OCR and the transcription
// agreed. Both come from the comparison of the transcriptions as they
// stood *before* the corrections (which undoes the README's corrections
// log) with Story 2.3's stored columns, kept byte for byte in
// analysis/output/ocr-sm2-before-2.3b/ (`readInputs(root).before23b
// .beforeCorrections`), because that is what the selection was made from;
// Story 2.3b's re-read changed the seed. A seeded mulberry32 shuffle (seed 20261023) draws the controls and
// then orders all 20.
//
// Writes blind-check-key.csv (which cells were suspected). It never writes
// blind-check.csv: that file holds the transcriber's values from the PDFs.
//
// Run: node analysis/ocr-reference/blind-check-draw.ts   (from the repository root)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Comparison, type FieldResult, misreadsReachingEngine } from '../../scripts/ocr-sm2-compare.ts';
import { BLIND_CHECK_KEY_FILE, readInputs } from '../../scripts/ocr-sm2.ts';

export const BLIND_CHECK_SEED = 20261023;
export const BLIND_CHECK_FILE = 'analysis/ocr-reference/blind-check.csv';
export { BLIND_CHECK_KEY_FILE };
const CONTROLS = 14;
const SUSPECTED = 6;

/** One cell of the blind check, numbered as in blind-check.csv. */
export interface BlindCell {
  n: number;
  orgnr: string;
  filingYear: number;
  role: 'current' | 'prior';
  field: string;
  suspected: boolean;
}

// mulberry32: a small seeded generator, so the draw is the same on every
// machine. A float in [0, 1) used only to pick indices, never for money.
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = items[i] as T;
    items[i] = items[j] as T;
    items[j] = a;
  }
  return items;
}

const cellKey = (r: FieldResult): string => `${r.orgnr}/${r.filingYear}/${r.role}/${r.field}`;

/** The 20 cells, from the comparison before the corrections. */
export function blindCheckCells(before: Comparison, seed: number = BLIND_CHECK_SEED): BlindCell[] {
  const random = generator(seed);
  const suspects = misreadsReachingEngine(before.results);
  if (suspects.length !== SUSPECTED) throw new Error(`expected ${SUSPECTED} suspected cells, got ${suspects.length}`);
  const suspectKeys = new Set(suspects.map(cellKey));
  const agree = before.results.filter((r) => r.class === 'correct' && !suspectKeys.has(cellKey(r)));
  const controls = shuffle([...agree], random).slice(0, CONTROLS);
  return shuffle([...suspects, ...controls], random).map((r, i) => ({
    n: i + 1,
    orgnr: r.orgnr,
    filingYear: r.filingYear,
    role: r.role,
    field: r.field,
    suspected: suspectKeys.has(cellKey(r)),
  }));
}

/** blind-check-key.csv: semicolon-separated, LF, one row per cell. */
export function blindCheckKeyCsv(cells: readonly BlindCell[]): string {
  const rows = cells.map((c) => `${c.n};${c.orgnr};${c.filingYear};${c.role};${c.field};${c.suspected ? 'yes' : 'no'}`);
  return `${['n;orgnr;filing_year;column;field;suspected', ...rows].join('\n')}\n`;
}

export function main(root: string): number {
  try {
    const cells = blindCheckCells(readInputs(root).before23b.beforeCorrections);
    writeFileSync(path.join(root, ...BLIND_CHECK_KEY_FILE.split('/')), blindCheckKeyCsv(cells));
    process.stdout.write(`blind-check-draw: wrote ${BLIND_CHECK_KEY_FILE} (${cells.length} cells, seed ${BLIND_CHECK_SEED})\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`blind-check-draw: ${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.cwd());
}
