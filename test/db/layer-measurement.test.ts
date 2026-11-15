// The measurement's database read (Story 5.2, triage 16): FACTS_SQL against
// synthetic companies inserted in a transaction that is always rolled back,
// read as `reader` inside it. One company per state the measurement counts
// a missing signal under: a paper document, a failed and a reconciled
// current column, with and without a fingerprint for the year, and the
// classifications `uklart` and `no_text`. loadMeasurementData itself reads
// through the app's reader client, which cannot see these uncommitted rows,
// so its counts are covered by test/layer-measurement.test.ts on injected
// data; here the query it runs is.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { setting, supabaseDbUrl } from './db-env.ts';

const url = setting('READER_DATABASE_URL');
if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
process.env.READER_DATABASE_URL = url;
const { FACTS_SQL } = await import('../../scripts/layer-measurement-compute.ts');
const { readerSql } = await import('../../src/server/db.ts');

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
type Tx = postgres.TransactionSql;

afterAll(async () => {
  await sql.end();
  await readerSql().end();
  delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
});

class Rollback extends Error {}

const YEAR = 2025;
const DIGEST = '0'.repeat(64);
const PAPER = '000000201';
const FAILED = '000000202';
const RECONCILED_WITH = '000000203';
const RECONCILED_WITHOUT = '000000204';
const NO_DOCUMENT = '000000205';
const NOT_STORED = '000000299';

async function company(tx: Tx, orgnr: string) {
  await tx`insert into register.company (orgnr, navn, organisasjonsform, naeringskode1, read_at) values (${orgnr}, 'SYNTETISK AS', 'AS', '62.100', now())`;
}

async function document(tx: Tx, orgnr: string, status: 'paper' | 'reconciled' | 'failed_reconciliation') {
  if (status === 'paper') {
    await tx`
      insert into register.document (orgnr, filing_year, layout, status, read_at, reader_commit, dataset)
      values (${orgnr}, ${YEAR}, 'paper', 'paper', now(), ${'a'.repeat(40)}, 'full')`;
    return;
  }
  await tx`
    insert into register.document (orgnr, filing_year, layout, status, valuta, unit_text, read_at, reader_commit, dataset)
    values (${orgnr}, ${YEAR}, 'generated', ${status}, 'NOK', 'NOK', now(), ${'a'.repeat(40)}, 'full')`;
  // A failed column fails c2; a reconciled one passes every check.
  const c2 = status === 'reconciled' ? 'pass' : 'fail';
  await tx`
    insert into register.document_column
      (orgnr, filing_year, role, stated_year, c1, c2, c3, c4, c5, digits_pass_fields, dataset, status, api_check, api_fail_fields)
    values (${orgnr}, ${YEAR}, 'current', ${YEAR}, 'pass', ${c2}, 'pass', 'pass', 'pass', '{}', 'full', ${status}, 'pass', '{}')`;
}

async function fingerprint(tx: Tx, orgnr: string) {
  await tx`
    insert into register.fingerprint ${tx({
      orgnr,
      filing_year: YEAR,
      cost_of_goods_lo: 'low',
      cost_of_goods_hi: 'low',
      personnel_cost_lo: 'high',
      personnel_cost_hi: 'high',
      asset_intensity_lo: 'low',
      asset_intensity_hi: 'low',
      inventory: false,
      capitalised_intangibles: false,
      input_digest: DIGEST,
      dataset: 'full',
    })}`;
}

async function classification(tx: Tx, orgnr: string, status: 'classified' | 'no_text') {
  if (status === 'no_text') {
    await tx`insert into register.classification (orgnr, status, business_type, text_digest, classified_at) values (${orgnr}, 'no_text', null, ${DIGEST}, now())`;
    return;
  }
  // classified with no type: uklart.
  await tx`
    insert into register.classification (orgnr, status, business_type, text_digest, model_id, prompt_hash, classified_at)
    values (${orgnr}, 'classified', null, ${DIGEST}, 'synthetic-model', ${'b'.repeat(64)}, now())`;
}

type FactsRow = {
  orgnr: string;
  company_exists: boolean;
  document_status: string | null;
  current_status: string | null;
  has_fingerprint: boolean;
  classification_status: string | null;
  classification_type: string | null;
  classification_model: string | null;
  classification_prompt_hash: string | null;
};

describe('FACTS_SQL', () => {
  it('reads, as reader, each labelled company’s document, column, fingerprint and classification for the year', async () => {
    let rows: FactsRow[] = [];
    try {
      await sql.begin(async (tx) => {
        for (const orgnr of [PAPER, FAILED, RECONCILED_WITH, RECONCILED_WITHOUT, NO_DOCUMENT]) await company(tx, orgnr);
        await document(tx, PAPER, 'paper');
        await document(tx, FAILED, 'failed_reconciliation');
        await document(tx, RECONCILED_WITH, 'reconciled');
        await document(tx, RECONCILED_WITHOUT, 'reconciled');
        await fingerprint(tx, RECONCILED_WITH);
        await classification(tx, RECONCILED_WITH, 'classified');
        await classification(tx, PAPER, 'no_text');
        await tx`set local role reader`;
        rows = await tx.unsafe<FactsRow[]>(FACTS_SQL, [
          [PAPER, FAILED, RECONCILED_WITH, RECONCILED_WITHOUT, NO_DOCUMENT, NOT_STORED],
          YEAR,
        ]);
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
    const byOrgnr = new Map(rows.map((row) => [row.orgnr, row]));
    expect(rows).toHaveLength(6);
    expect(byOrgnr.get(PAPER)).toMatchObject({
      company_exists: true,
      document_status: 'paper',
      current_status: null,
      has_fingerprint: false,
      classification_status: 'no_text',
      classification_type: null,
      classification_model: null,
    });
    expect(byOrgnr.get(FAILED)).toMatchObject({
      document_status: 'failed_reconciliation',
      current_status: 'failed_reconciliation',
      has_fingerprint: false,
      classification_status: null,
    });
    expect(byOrgnr.get(RECONCILED_WITH)).toMatchObject({
      document_status: 'reconciled',
      current_status: 'reconciled',
      has_fingerprint: true,
      classification_status: 'classified',
      classification_type: null,
      classification_model: 'synthetic-model',
      classification_prompt_hash: 'b'.repeat(64),
    });
    expect(byOrgnr.get(RECONCILED_WITHOUT)).toMatchObject({ current_status: 'reconciled', has_fingerprint: false });
    expect(byOrgnr.get(NO_DOCUMENT)).toMatchObject({ company_exists: true, document_status: null, has_fingerprint: false });
    expect(byOrgnr.get(NOT_STORED)).toMatchObject({ company_exists: false, document_status: null, has_fingerprint: false });
  });

  it('reads no fingerprint of another year', async () => {
    let rows: FactsRow[] = [];
    try {
      await sql.begin(async (tx) => {
        await company(tx, RECONCILED_WITH);
        await fingerprint(tx, RECONCILED_WITH);
        await tx`set local role reader`;
        rows = await tx.unsafe<FactsRow[]>(FACTS_SQL, [[RECONCILED_WITH], YEAR - 1]);
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
    expect(rows).toEqual([expect.objectContaining({ orgnr: RECONCILED_WITH, has_fingerprint: false, document_status: null })]);
  });
});
