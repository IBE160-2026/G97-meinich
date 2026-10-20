// The document tables (Story 2.1b; technical note AD-14, AD-15), tested
// against the migrated local database by attempting writes in a transaction
// that is always rolled back. Connects as the CLI's local `postgres` role.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { supabaseDbUrl } from './db-env.ts';

const CHECK_VIOLATION = '23514';
const ORGNR = '979607008';

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
type Tx = postgres.TransactionSql;

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

async function rolledBack(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (error instanceof Rollback) return;
    throw error;
  }
  throw new Error('transaction was not rolled back');
}

// Runs a statement in a savepoint. Returns the Postgres error code, or
// undefined when it succeeded.
async function attempt(tx: Tx, statement: string): Promise<string | undefined> {
  try {
    await tx.savepoint((sp) => sp.unsafe(statement));
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unknown';
  }
  return undefined;
}

const quote = (value: string | null): string => (value === null ? 'null' : `'${value}'`);

function insertDocument(year: number, status: string, layout: string | null, refusal: string | null, valuta: string | null): string {
  return `insert into register.document (orgnr, filing_year, layout, status, refusal, valuta, unit_text, read_at, dataset)
          values ('${ORGNR}', ${year}, ${quote(layout)}, '${status}', ${quote(refusal)}, ${quote(valuta)}, ${quote(valuta)}, now(), 'full')`;
}

async function withCompany(fn: (tx: Tx) => Promise<void>): Promise<void> {
  await rolledBack(async (tx) => {
    await tx`insert into register.company (orgnr, navn, read_at) values (${ORGNR}, 'TEST AS', now()) on conflict (orgnr) do nothing`;
    await fn(tx);
  });
}

describe('register.document', () => {
  it('status accepts exactly the five values', async () => {
    await withCompany(async (tx) => {
      const accepted: [string, string | null, string | null, string | null][] = [
        ['extracted', 'generated', null, 'NOK'],
        ['reconciled', 'generated', null, 'NOK'],
        ['failed_reconciliation', 'generated', null, 'NOK'],
        ['not_extracted', 'generated', 'reporting_unit', null],
        ['paper', 'paper', null, null],
      ];
      let year = 2001;
      for (const [status, layout, refusal, valuta] of accepted) {
        expect(await attempt(tx, insertDocument(year, status, layout, refusal, valuta)), status).toBeUndefined();
        year += 1;
      }
      for (const status of ['usable', 'Extracted', '', 'failed']) {
        expect(await attempt(tx, insertDocument(year, status, 'generated', null, 'NOK')), status).toBe(CHECK_VIOLATION);
        year += 1;
      }
    });
  });

  it('keeps status, layout and refusal consistent, even where a column is NULL', async () => {
    await withCompany(async (tx) => {
      const cases: [string, string | null, string | null, string | null, boolean][] = [
        ['not_extracted', 'unknown', null, null, true],
        ['not_extracted', null, 'ocr_error', null, true],
        ['not_extracted', 'generated', 'year_mismatch', 'NOK', true],
        ['not_extracted', 'generated', 'year_header', null, true],
        // A generated document with no refusal was read: not not_extracted.
        ['not_extracted', 'generated', null, null, false],
        ['not_extracted', 'unknown', 'ocr_error', null, false],
        ['not_extracted', null, null, null, false],
        ['paper', null, null, null, false],
        ['paper', 'generated', null, null, false],
        ['extracted', null, null, 'NOK', false],
        ['extracted', 'generated', 'reporting_unit', 'NOK', false],
        ['extracted', 'generated', null, null, false],
        ['not_extracted', 'generated', 'guessed', null, false],
      ];
      let year = 2001;
      for (const [status, layout, refusal, valuta, ok] of cases) {
        const label = `${status} ${String(layout)} ${String(refusal)} ${String(valuta)}`;
        expect(await attempt(tx, insertDocument(year, status, layout, refusal, valuta)), label).toBe(
          ok ? undefined : CHECK_VIOLATION,
        );
        year += 1;
      }
    });
  });

  it('refuses a dataset tag other than demo or full', async () => {
    await withCompany(async (tx) => {
      const statement = insertDocument(2025, 'paper', 'paper', null, null).replace("'full')", "'test')");
      expect(await attempt(tx, statement)).toBe(CHECK_VIOLATION);
    });
  });
});

describe('register.document_column', () => {
  const insertColumn = (role: string, statedYear: number, digits = '{}'): string =>
    `insert into register.document_column (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, digits_pass_fields, dataset)
     values ('${ORGNR}', 2025, '${role}', ${statedYear}, 'pass', 'pass', 'pass', 'pass', '${digits}', 'full')`;

  it('ties each column to the year it states: the filing year, or the year before for prior', async () => {
    await withCompany(async (tx) => {
      await tx.unsafe(insertDocument(2025, 'extracted', 'generated', null, 'NOK'));
      expect(await attempt(tx, insertColumn('current', 2024))).toBe(CHECK_VIOLATION);
      expect(await attempt(tx, insertColumn('prior', 2025))).toBe(CHECK_VIOLATION);
      expect(await attempt(tx, insertColumn('other', 2025))).toBe(CHECK_VIOLATION);
      expect(await attempt(tx, insertColumn('current', 2025))).toBeUndefined();
      expect(await attempt(tx, insertColumn('prior', 2024))).toBeUndefined();
    });
  });

  it('accepts only field names in digits_pass_fields, and needs its document', async () => {
    await withCompany(async (tx) => {
      expect(await attempt(tx, insertColumn('current', 2025))).toBe('23503');
      await tx.unsafe(insertDocument(2025, 'extracted', 'generated', null, 'NOK'));
      expect(await attempt(tx, insertColumn('current', 2025, '{sum_driftsinntekter,guess}'))).toBe(CHECK_VIOLATION);
      expect(await attempt(tx, insertColumn('current', 2025, '{sum_driftsinntekter}'))).toBeUndefined();
    });
  });

  it('goes with its document, and the document with its company (ON DELETE CASCADE, for Story 2.4)', async () => {
    const rules = await sql<{ table: string; references: string; on_delete: string }[]>`
      select conrelid::regclass::text as table, confrelid::regclass::text as references, confdeltype as on_delete
        from pg_catalog.pg_constraint
       where contype = 'f' and conrelid in ('register.document'::regclass, 'register.document_column'::regclass)
       order by 1, 2
    `;
    expect([...rules]).toEqual([
      { table: 'register.document', references: 'register.company', on_delete: 'c' },
      { table: 'register.document', references: 'register.filing', on_delete: 'a' },
      { table: 'register.document_column', references: 'register.document', on_delete: 'c' },
    ]);
    await withCompany(async (tx) => {
      await tx.unsafe(insertDocument(2025, 'extracted', 'generated', null, 'NOK'));
      await tx.unsafe(insertColumn('current', 2025));
      await tx`delete from register.document where orgnr = ${ORGNR} and filing_year = 2025`;
      const [row] = await tx<{ n: number }[]>`select count(*)::int as n from register.document_column where orgnr = ${ORGNR}`;
      expect(row?.n).toBe(0);
    });
  });

  it('stores every figure as bigint øre with a unit comment', async () => {
    const rows = await sql<{ name: string; kind: string; comment: string | null }[]>`
      select a.attname as name, format_type(a.atttypid, a.atttypmod) as kind,
             col_description(a.attrelid, a.attnum) as comment
        from pg_catalog.pg_attribute a
       where a.attrelid = 'register.document_column'::regclass and a.attnum > 0 and not a.attisdropped
         and a.attname like '%\\_ore'
    `;
    expect(rows).toHaveLength(23);
    for (const row of rows) {
      expect(row.kind, row.name).toBe('bigint');
      expect(row.comment?.startsWith('øre (hundredths of document.valuta'), row.name).toBe(true);
    }
  });
});
