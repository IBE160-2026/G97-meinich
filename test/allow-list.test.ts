// The committed seed holds document figures only for allow-listed orgnrs
// (Story 1.3b; technical note "Seed data", allow-list test). Reads every
// committed seed file, whatever its dataset tag; a document figure is a row
// of document_column.csv (Story 2.1b). Reads the committed OCR reference
// draw too: every reference orgnr is on the list (Story 2.3, NFR15).
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOW_LIST_FILE,
  REFERENCE_DRAW_FILE,
  REFERENCE_REASON,
  SEED_DIR,
  parseAllowList,
  parseAllowListEntries,
  parseDrawn,
  unlistedDocumentFigures,
} from '../scripts/seed-format.ts';

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
    expect([...files.keys()].sort()).toEqual([
      'company.csv',
      'document.csv',
      'document_column.csv',
      'filing.csv',
      'key_figures.csv',
    ]);
  });

  it('covers every orgnr with document figures in the committed seed', () => {
    expect(unlistedDocumentFigures(files, allowList)).toEqual([]);
  });

  it('lists every reference orgnr with the reason OCR-referansesett', () => {
    const entries = parseAllowListEntries(JSON.parse(readFileSync(path.join(root, ALLOW_LIST_FILE), 'utf8')));
    const drawn = parseDrawn(JSON.parse(readFileSync(path.join(root, REFERENCE_DRAW_FILE), 'utf8')));
    expect(drawn).toHaveLength(20);
    for (const { orgnr } of drawn) {
      expect(entries.filter((entry) => entry.orgnr === orgnr), orgnr).toEqual([{ orgnr, reason: REFERENCE_REASON }]);
    }
  });

  it('agrees with the manifest on which orgnrs have document figures', () => {
    const manifest = JSON.parse(readFileSync(path.join(seedDir, 'manifest.json'), 'utf8')) as {
      document_figure_orgnrs: string[];
    };
    expect(unlistedDocumentFigures(files, [])).toEqual(manifest.document_figure_orgnrs);
  });
});
