// The register's names in the provenance drill-down (Story 3.7, decision 3):
// an API input shows the register's leaf name, the last key of its path in
// step 1's KEY_FIGURES (ingest/src/peerless_ingest/parse.py), and the
// figures both sources hold are reconcile.py's SHARED_FIELDS. Both are read
// from the Python source, so a renamed field on either side fails here.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_FIGURE_COLUMNS } from '../src/engine/document-inputs.ts';
import { API_KEY_FIGURE_COLUMNS } from '../src/engine/inputs.ts';
import { REGISTER_FIELD_NAMES, SHARED_FIELDS, sharedFieldName } from '../src/engine/provenance.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

/** parse.py KEY_FIGURES: each `(("a", …, "leaf"), "column")` as [column, leaf]. */
function keyFigures(): [string, string][] {
  const source = read('ingest/src/peerless_ingest/parse.py');
  const block = /KEY_FIGURES:[^=]*=\s*\(([\s\S]*?)\n\)\n/.exec(source)?.[1];
  if (block === undefined) throw new Error('no KEY_FIGURES in parse.py');
  return [...block.matchAll(/\(\s*\(([^()]*)\),\s*"(\w+)",?\s*\)/g)].map((match) => {
    const keys = [...(match[1] ?? '').matchAll(/"(\w+)"/g)].map((key) => key[1] ?? '');
    return [match[2] ?? '', keys[keys.length - 1] ?? ''];
  });
}

describe('register field names', () => {
  it('REGISTER_FIELD_NAMES is parse.py KEY_FIGURES: every column with its leaf name', () => {
    const python = keyFigures();
    expect(python.length).toBe(19);
    expect(Object.entries(REGISTER_FIELD_NAMES)).toEqual(python);
  });

  it('SHARED_FIELDS is reconcile.py SHARED_FIELDS, in its order', () => {
    const block = /SHARED_FIELDS: tuple\[str, \.\.\.\] = \(([\s\S]*?)\n\)/.exec(read('ingest/src/peerless_ingest/reconcile.py'))?.[1];
    if (block === undefined) throw new Error('no SHARED_FIELDS in reconcile.py');
    expect([...SHARED_FIELDS]).toEqual([...block.matchAll(/"(\w+)"/g)].map((match) => match[1]));
  });

  it('a shared field has the same name as a key figure and as a document line', () => {
    for (const field of SHARED_FIELDS) {
      const name = sharedFieldName(field);
      expect(DOCUMENT_FIGURE_COLUMNS[name as keyof typeof DOCUMENT_FIGURE_COLUMNS], field).toBe(`${field}_ore`);
    }
  });

  it('the API inputs the engine reads all have a register name', () => {
    for (const column of API_KEY_FIGURE_COLUMNS) expect(REGISTER_FIELD_NAMES[column]).toMatch(/^[a-z][A-Za-z]+$/);
  });
});
