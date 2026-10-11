// The committed seed holds document figures only for allow-listed orgnrs
// (Story 1.3b; technical note "Seed data", allow-list test). Reads every
// committed seed file; until Story 2.3 adds document-figure tables, a
// document figure is a filing whose status is not `not_extracted`.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOW_LIST_FILE, SEED_DIR, parseAllowList, unlistedDocumentFigures } from '../scripts/seed-format.ts';

const root = path.resolve(import.meta.dirname, '..');
const seedDir = path.join(root, SEED_DIR);

describe('seed/allow-list.json', () => {
  const allowList = parseAllowList(JSON.parse(readFileSync(path.join(root, ALLOW_LIST_FILE), 'utf8')));
  const files = new Map(
    readdirSync(seedDir)
      .filter((file) => file.endsWith('.csv'))
      .map((file) => [file, readFileSync(path.join(seedDir, file), 'utf8')] as const),
  );

  it('reads the committed seed files', () => {
    expect([...files.keys()].sort()).toEqual(['company.csv', 'filing.csv', 'key_figures.csv']);
  });

  it('covers every orgnr with document figures in the committed seed', () => {
    expect(unlistedDocumentFigures(files, allowList)).toEqual([]);
  });

  it('agrees with the manifest on which orgnrs have document figures', () => {
    const manifest = JSON.parse(readFileSync(path.join(seedDir, 'manifest.json'), 'utf8')) as {
      document_figure_orgnrs: string[];
    };
    expect(unlistedDocumentFigures(files, [])).toEqual(manifest.document_figure_orgnrs);
  });
});
