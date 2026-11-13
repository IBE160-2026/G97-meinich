// The match basis and the "Usikker klassifisering" flag are computed per
// request from the subject and the peer (Story 2.7; src/engine/peers.ts
// matchBasis), never stored: both depend on the subject, so no row could
// hold them. No migration names such a column, and no seed file has one.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv, SEED_TABLES, seedFileName } from '../scripts/seed-format.ts';
import { MATCH_BASES } from '../src/engine/peers.ts';

const root = path.resolve(import.meta.dirname, '..');

// Any identifier naming a basis, a flag or the match: match_basis,
// grunnlag, flagged, usikker_klassifisering, uncertain …
const STORED = /\b\w*(basis|grunnlag|flag|usikker|uncertain)\w*\b/gi;

/** SQL with its comments removed, so a comment may explain without failing the test. */
function withoutComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

const migrationsDir = path.join(root, 'supabase/migrations');
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));

const seedDirs = ['seed/demo', 'test/fixtures/seed'];
const seedHeaders = seedDirs.flatMap((dir) => {
  const full = path.join(root, dir);
  return readdirSync(full, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.csv'))
    .map((name) => {
      const [header] = parseCsv(readFileSync(path.join(full, name), 'utf8'));
      return { file: `${dir}/${name.replaceAll('\\', '/')}`, header: header ?? [] };
    });
});

describe('the match basis and the flag are never stored', () => {
  it('reads every migration and every seed table', () => {
    expect(migrations.length).toBeGreaterThan(0);
    const demo = seedHeaders.filter((entry) => entry.file.startsWith('seed/demo/')).map((entry) => entry.file);
    expect(demo.sort()).toEqual(SEED_TABLES.map((table) => `seed/demo/${seedFileName(table)}`).sort());
    for (const entry of seedHeaders) expect(entry.header.length, entry.file).toBeGreaterThan(0);
  });

  it.each(migrations)('no column for them in %s', (name) => {
    const sql = withoutComments(readFileSync(path.join(migrationsDir, name), 'utf8'));
    expect(sql.match(STORED) ?? []).toEqual([]);
    // Nor a column of another name holding the basis ids as values.
    expect(MATCH_BASES.filter((id) => sql.includes(id))).toEqual([]);
  });

  it('no column for them in any seed file header', () => {
    const found = seedHeaders.flatMap((entry) =>
      entry.header.filter((column) => column.match(STORED) !== null).map((column) => `${entry.file}: ${column}`),
    );
    expect(found).toEqual([]);
  });

  it('the pattern finds such a column', () => {
    expect(withoutComments('alter table register.fingerprint add column match_basis text; -- basis').match(STORED)).toEqual([
      'match_basis',
    ]);
    expect('uncertain_flag'.match(STORED)).toEqual(['uncertain_flag']);
    const valueCheck = "check (signals in ('accounts_only', 'description_only'))";
    expect(MATCH_BASES.filter((id) => valueCheck.includes(id))).toEqual(['accounts_only', 'description_only']);
  });
});
