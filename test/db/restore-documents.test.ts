// `pnpm restore:documents` against the database (Story 2.10): restoreInto,
// the copy the CLI runs in one transaction as loader, here in a transaction
// that is always rolled back, as the CLI's local `postgres` role. A dump
// restores with each file's own header as the column list, and a second
// restore of the same rows fails on their keys with 23505, which the CLI
// turns into "run pnpm seed first" (test/restore-documents.test.ts).
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { type DumpTable, headerColumns, restoreInto } from '../../scripts/restore-documents.ts';
import { supabaseDbUrl } from './db-env.ts';

// Valid modulus 11, and not a seeded company.
const ORGNR = '999999999';

const DOCUMENT_CSV = [
  'orgnr,filing_year,brreg_id,layout,status,refusal,valuta,unit_text,read_at,dataset,reader_commit',
  `${ORGNR},2019,,generated,reconciled,,NOK,NOK,2026-11-07 21:54:41.505832+00,full,${'a'.repeat(40)}`,
].join('\r\n');
const COLUMN_CSV = [
  'orgnr,filing_year,role,stated_year,c1,c2,c3,c4,c5,digits_pass_fields,status,api_check,api_fail_fields,dataset',
  `${ORGNR},2019,current,2019,pass,pass,pass,pass,pass,{},reconciled,not_evaluable,{},full`,
].join('\n');

const tables = (): DumpTable[] => [
  { table: 'document', columns: headerColumns('document.csv', Buffer.from(DOCUMENT_CSV)), bytes: Buffer.from(DOCUMENT_CSV) },
  { table: 'document_column', columns: headerColumns('document_column.csv', Buffer.from(COLUMN_CSV)), bytes: Buffer.from(COLUMN_CSV) },
];

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

/** Runs `body` in a transaction that is always rolled back; what it returns. */
async function rolledBack<T>(body: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await sql.begin(async (tx) => {
      result = await body(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  if (result === undefined) throw new Error('rolledBack: the body returned nothing');
  return result;
}

const prepare = (tx: postgres.TransactionSql) =>
  tx`insert into register.company (orgnr, navn, read_at) values (${ORGNR}, 'TEST AS', now()) on conflict (orgnr) do nothing`;

describe('restoreInto', () => {
  it('restores both files with their own headers as the column lists, a CRLF dump included', async () => {
    const rows = await rolledBack(async (tx) => {
      await prepare(tx);
      await restoreInto(tx, tables());
      return tx<{ role: string; status: string; reader_commit: string }[]>`
        select c.role, c.status, d.reader_commit
          from register.document_column c join register.document d using (orgnr, filing_year)
         where c.orgnr = ${ORGNR}`;
    });
    expect(rows).toEqual([{ role: 'current', status: 'reconciled', reader_commit: 'a'.repeat(40) }]);
  });

  it('a second restore of the same rows fails on their keys with 23505', async () => {
    const code = await rolledBack(async (tx) => {
      await prepare(tx);
      await restoreInto(tx, tables());
      await tx.unsafe('SAVEPOINT again');
      try {
        await restoreInto(tx, tables());
        return 'restored twice';
      } catch (error) {
        await tx.unsafe('ROLLBACK TO SAVEPOINT again');
        return String((error as { code?: unknown }).code);
      }
    });
    expect(code).toBe('23505');
  });
});
