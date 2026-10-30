// The reader_commit backfill (Story 2.3b, supabase/migrations/
// 20261023120000_document_reader_commit.sql). On CI's freshly migrated
// database the table was empty when the migration ran, so its backfill did
// nothing there. This test runs the migration again on rows on both sides of
// its read_at boundary: in a transaction that is always rolled back, as the
// CLI's local `postgres` role, it drops the column, inserts the rows, runs
// the migration file and reads back the version each row got.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { root, supabaseDbUrl } from './db-env.ts';

const MIGRATION = path.join(root, 'supabase/migrations/20261023120000_document_reader_commit.sql');
const STORY_2_1B = 'e09a41345826d3b7dcbae3a6d8e586e63e6f7d8d';
const REFERENCE_RUN = '901a78dbee3081c1708f8d140b4e769e6e764abd';
const ORGNR = '979607008';

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

describe('the reader_commit backfill', () => {
  it('gives every row a version: before 2026-10-22 UTC the 2.1b run, from then the reference run', async () => {
    let rows: { filing_year: number; reader_commit: string | null }[] = [];
    let nulls = -1;
    try {
      await sql.begin(async (tx) => {
        await tx`alter table register.document drop column reader_commit`;
        await tx`insert into register.company (orgnr, navn, read_at) values (${ORGNR}, 'TEST AS', now()) on conflict (orgnr) do nothing`;
        // One row per side of the boundary, and one on each edge of it.
        const readAt: [number, string][] = [
          [2001, '2026-10-20 18:22:39+00'],
          [2002, '2026-10-21 23:59:59.999999+00'],
          [2003, '2026-10-22 00:00:00+00'],
          [2004, '2026-10-23 10:35:21+00'],
        ];
        for (const [year, at] of readAt) {
          await tx`
            insert into register.document (orgnr, filing_year, layout, status, read_at, dataset)
            values (${ORGNR}, ${year}, 'paper', 'paper', ${at}::timestamptz, 'full')`;
        }
        await tx.unsafe(readFileSync(MIGRATION, 'utf8'));
        rows = await tx<{ filing_year: number; reader_commit: string | null }[]>`
          select filing_year, reader_commit from register.document
           where orgnr = ${ORGNR} and filing_year between 2001 and 2004 order by filing_year`;
        const [count] = await tx<{ n: number }[]>`select count(*)::int as n from register.document where reader_commit is null`;
        nulls = count?.n ?? -1;
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
    expect(rows).toEqual([
      { filing_year: 2001, reader_commit: STORY_2_1B },
      { filing_year: 2002, reader_commit: STORY_2_1B },
      { filing_year: 2003, reader_commit: REFERENCE_RUN },
      { filing_year: 2004, reader_commit: REFERENCE_RUN },
    ]);
    // Every row of the table, the seed's included, got one.
    expect(nulls).toBe(0);
  });

  it('keeps the column NOT NULL and a full 40-hex commit', async () => {
    const [column] = await sql<{ not_null: boolean }[]>`
      select a.attnotnull as not_null from pg_attribute a
       where a.attrelid = 'register.document'::regclass and a.attname = 'reader_commit'`;
    expect(column?.not_null).toBe(true);
    const [check] = await sql<{ definition: string }[]>`
      select pg_get_constraintdef(oid) as definition from pg_constraint
       where conrelid = 'register.document'::regclass and conname = 'document_reader_commit_is_a_commit'`;
    expect(check?.definition).toContain('^[0-9a-f]{40}$');
  });
});
