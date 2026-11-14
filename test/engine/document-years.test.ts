// The years the engine reads documents for are the years batch step 1
// fetches (Story 2.9, decision 4): a filing year outside them is "not read
// in v1", never "document missing".
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { DOCUMENT_YEARS, isDocumentYear } from '../../src/engine/document-inputs.ts';

const RUN_PY = path.resolve(import.meta.dirname, '../../ingest/src/peerless_ingest/run.py');

it('the engine reads the years step 1 fetches', () => {
  const match = /^DOCUMENT_YEARS = range\((\d{4}), (\d{4})\)$/m.exec(readFileSync(RUN_PY, 'utf8'));
  expect(match, 'DOCUMENT_YEARS = range(from, to + 1) in run.py').not.toBeNull();
  const [, from, stop] = match as RegExpExecArray;
  // Python's range excludes its stop.
  expect({ from: Number(from), to: Number(stop) - 1 }).toEqual(DOCUMENT_YEARS);
});

it('includes both ends and nothing outside them', () => {
  expect([2020, 2021, 2025, 2026].map(isDocumentYear)).toEqual([false, true, true, false]);
});
