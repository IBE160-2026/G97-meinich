// The four parts of intangible assets (Story 2.5b, supabase/migrations/
// 20261105120000_document_intangible_parts.sql). The local database holds
// the Story 2.1b rows the migration ran over; CI's was empty. This test runs
// the migration again on rows written before it: in a transaction that is
// always rolled back, as the CLI's local `postgres` role, it drops the four
// columns, inserts a document and its two columns, runs the migration file,
// and reads back what the old rows hold and what the new CHECK admits.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { DOCUMENT_FIGURE_COLUMNS } from '../../src/engine/document-inputs.ts';
import { root, supabaseDbUrl } from './db-env.ts';

const MIGRATION = path.join(root, 'supabase/migrations/20261105120000_document_intangible_parts.sql');
const PARTS = ['forskning_og_utvikling_ore', 'konsesjoner_patenter_ore', 'goodwill_ore', 'utsatt_skattefordel_ore'];
const ORGNR = '979607008';
const YEAR = 2019;
const READER_COMMIT = 'a'.repeat(40);
const CHECK_VIOLATION = '23514';

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

async function attempt(tx: postgres.TransactionSql, statement: string): Promise<string | undefined> {
  try {
    await tx.savepoint((sp) => sp.unsafe(statement));
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unknown';
  }
  return undefined;
}

const insertColumn = (role: string, stated: number, digits: string) =>
  `insert into register.document_column (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, digits_pass_fields, sum_eiendeler_ore, dataset)
   values ('${ORGNR}', ${YEAR}, '${role}', ${stated}, 'pass', 'pass', 'pass', 'pass', '${digits}', 100, 'full')`;

describe('the parts of intangible assets', () => {
  it('are NULL in rows written before the migration, and the CHECK admits their names and no other', async () => {
    let rows: Record<string, string | null>[] = [];
    const codes: Record<string, string | undefined> = {};
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(`alter table register.document_column ${PARTS.map((c) => `drop column ${c}`).join(', ')}`);
        await tx`insert into register.company (orgnr, navn, read_at) values (${ORGNR}, 'TEST AS', now()) on conflict (orgnr) do nothing`;
        await tx`
          insert into register.document (orgnr, filing_year, layout, status, valuta, unit_text, read_at, reader_commit, dataset)
          values (${ORGNR}, ${YEAR}, 'generated', 'extracted', 'NOK', 'NOK', now(), ${READER_COMMIT}, 'full')`;
        await tx.unsafe(insertColumn('current', YEAR, '{sum_eiendeler}'));
        await tx.unsafe(readFileSync(MIGRATION, 'utf8'));
        rows = await tx.unsafe<Record<string, string | null>[]>(
          `select ${PARTS.join(', ')}, sum_eiendeler_ore from register.document_column where orgnr = '${ORGNR}' and filing_year = ${YEAR}`,
        );
        codes['parts'] = await attempt(tx, insertColumn('prior', YEAR - 1, '{forskning_og_utvikling,konsesjoner_patenter,goodwill,utsatt_skattefordel}'));
        codes['unknown'] = await attempt(tx, `update register.document_column set digits_pass_fields = '{sum_alt}' where orgnr = '${ORGNR}' and filing_year = ${YEAR}`);
        codes['old'] = await attempt(tx, `update register.document_column set digits_pass_fields = '{varekostnad,sum_egenkapital_gjeld}' where orgnr = '${ORGNR}' and filing_year = ${YEAR}`);
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
    expect(rows).toEqual([
      { forskning_og_utvikling_ore: null, konsesjoner_patenter_ore: null, goodwill_ore: null, utsatt_skattefordel_ore: null, sum_eiendeler_ore: '100' },
    ]);
    expect(codes).toEqual({ parts: undefined, unknown: CHECK_VIOLATION, old: undefined });
  });

  it('are bigint øre columns with a unit comment, and the engine maps each of them', async () => {
    const rows = await sql<{ name: string; kind: string; comment: string | null }[]>`
      select a.attname as name, format_type(a.atttypid, a.atttypmod) as kind, col_description(a.attrelid, a.attnum) as comment
        from pg_attribute a
       where a.attrelid = 'register.document_column'::regclass and a.attname = any(${PARTS}::text[])
       order by a.attnum`;
    expect(rows.map((r) => r.name)).toEqual(PARTS);
    for (const row of rows) {
      expect(row.kind, row.name).toBe('bigint');
      expect(row.comment, row.name).toMatch(/^øre \(hundredths of document\.valuta/);
    }
    expect(Object.values(DOCUMENT_FIGURE_COLUMNS)).toEqual(expect.arrayContaining(PARTS));
  });
});
