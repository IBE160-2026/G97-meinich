// register.explanation and run.step2's `explain` mode against the local
// Postgres (Story 4.1). Every write rolls back; invented companies only.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { supabaseDbUrl } from './db-env.ts';

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
type Tx = postgres.TransactionSql;
class Rollback extends Error {}

afterAll(async () => {
  await sql.end();
});

async function rolledBack(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

const AS = '000000108';
const DIGEST = '0'.repeat(64);

async function company(tx: Tx, orgnr: string) {
  await tx`insert into register.company (orgnr, organisasjonsform, naeringskode1, read_at) values (${orgnr}, 'AS', '62.100', now())`;
}

function row(status: 'explained' | 'failed' | 'pending', overrides: Record<string, unknown> = {}) {
  return {
    orgnr: AS,
    status,
    template: status === 'explained' ? 'Driftsmarginen er {{driftsmargin.egen}}.' : null,
    slot_ids: status === 'explained' ? ['driftsmargin.egen'] : null,
    filing_year: 2025,
    analysis_digest: DIGEST,
    prompt_hash: DIGEST,
    model_id: 'claude-haiku-5-5',
    dataset: 'demo',
    sample: false,
    batch_id: status === 'pending' ? 'b' : null,
    generated_at: new Date('2026-11-27T12:00:00Z'),
    ...overrides,
  };
}

describe('the table', () => {
  it('a deleted company takes its explanation with it', async () => {
    await rolledBack(async (tx) => {
      await company(tx, AS);
      await tx`insert into register.explanation ${tx(row('explained'))}`;
      expect(await tx`select 1 from register.explanation where orgnr = ${AS}`).toHaveLength(1);
      await tx`delete from register.company where orgnr = ${AS}`;
      expect(await tx`select 1 from register.explanation where orgnr = ${AS}`).toHaveLength(0);
    });
  });

  it.each([
    ['an explained row without a text', row('explained', { template: null, slot_ids: null })],
    ['a failed row with a text', row('failed', { template: 'Tekst.', slot_ids: [] })],
    ['a pending row without its batch', row('pending', { batch_id: null })],
    ['a dataset that is not one', row('failed', { dataset: 'test' })],
    ['a digest that is not one', row('failed', { analysis_digest: 'x' })],
  ])('refuses %s', async (_label, values) => {
    await rolledBack(async (tx) => {
      await company(tx, AS);
      await expect(tx.savepoint((sp) => sp`insert into register.explanation ${sp(values)}`)).rejects.toThrow(/check/);
    });
  });
});

describe('the run record', () => {
  it('run.step2 accepts mode explain', async () => {
    await rolledBack(async (tx) => {
      const [record] = await tx<{ mode: string }[]>`
        insert into run.step2 (mode, started_at, model_id, prompt_hash) values ('explain', now(), 'claude-haiku-5-5', ${DIGEST})
        returning mode`;
      expect(record?.mode).toBe('explain');
      await expect(tx.savepoint((sp) => sp`insert into run.step2 (mode, started_at) values ('explanation', now())`)).rejects.toThrow(/check/);
    });
  });
});
