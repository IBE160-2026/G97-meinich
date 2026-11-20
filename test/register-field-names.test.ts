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

// Story 3.7, decision 3: in the drill-down an API input shows its register
// name, a document line its engine name under "Fra årsregnskapet", each as
// `<code data-provenance-field>`, the one form the payload scan admits.
describe('the names in the drill-down', () => {
  it('API names in step 3, the document lines under "Fra årsregnskapet"', async () => {
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { ProvenanceSteps } = await import('../src/components/analysis/provenance-steps.tsx');
    const { capitalProvenance, profitProvenance, provenanceSubject } = await import('../src/analysis/provenance.ts');
    const { benchmarkApiFigures, benchmarkDocumentFigures } = await import('../src/engine/benchmark.ts');
    const { readBasis, TEN_PEERS } = await import('./analysis/document-fixture.ts');
    const nb = (await import('../src/messages/nb.json', { with: { type: 'json' } })).default;
    const api = {
      sumDriftsinntekter: 1_000_000_000n,
      driftsresultat: 20_000_000n,
      sumDriftskostnad: 980_000_000n,
      sumEiendeler: 300_000_000n,
      sumEgenkapitalGjeld: 300_000_000n,
      sumEgenkapital: 100_000_000n,
      sumGjeld: 200_000_000n,
    };
    const peers = Array.from({ length: 10 }, (_, i) => ({ ...api, driftsresultat: BigInt(i + 1) * 10_000_000n }));
    const basis = readBasis();
    const subject = provenanceSubject(api, {
      filingYear: 2025,
      readAt: new Date('2026-10-03T08:00:00Z'),
      documentBasis: basis,
      documentFacts: { readAt: new Date('2026-10-21T08:00:00Z'), current: null },
    });
    const profit = profitProvenance(subject, benchmarkApiFigures(api, peers, 'NOK').driftsmargin);
    const kfd = capitalProvenance(subject, 'kfd', benchmarkDocumentFigures(basis, TEN_PEERS, 'NOK').kfd);
    if (profit === null || kfd === null) throw new Error('the fixture has both amounts');
    const html = (view: typeof profit) => renderToString(createElement(ProvenanceSteps, { id: 'x', view }));
    const profitHtml = html(profit);
    expect(profitHtml).toContain('<code data-provenance-field="">sumDriftsinntekter</code>');
    expect(profitHtml).not.toContain(nb['provenance.fromDocument']);
    const kfdHtml = html(kfd);
    const heading = kfdHtml.indexOf(nb['provenance.fromDocument']);
    expect(heading).toBeGreaterThan(-1);
    // Step 3's names follow the heading; no name is written outside a <code data-provenance-field>.
    expect(kfdHtml.indexOf('<code data-provenance-field="">kundefordringer</code>', heading)).toBeGreaterThan(heading);
    const bare = kfdHtml.replace(/<code data-provenance-field="">\w+<\/code>/g, '');
    for (const name of ['kundefordringer', 'salgsinntekt']) expect(bare).not.toContain(name);
  });
});
