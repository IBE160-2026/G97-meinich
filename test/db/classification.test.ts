// register.classification and run.step2 against the local Postgres (Story
// 2.6). Every test rolls back; invented companies only.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { postgresStore } from '../../scripts/classify.ts';
import { rebuildFingerprints } from '../../scripts/derive.ts';
import { copyTable, refuseUnfinishedClassifications } from '../../scripts/seed-export.ts';
import { SEED_TABLES, SeedRefusal, parseCsv } from '../../scripts/seed-format.ts';
import { withFingerprintRecord } from '../../scripts/step2-record.ts';
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
const ENK = '000000116';
const DIGEST = '0'.repeat(64);

async function company(tx: Tx, orgnr: string, form: string, code = '62.100') {
  await tx`insert into register.company (orgnr, organisasjonsform, naeringskode1, read_at) values (${orgnr}, ${form}, ${code}, now())`;
}

function row(orgnr: string, status: string, overrides: Record<string, unknown> = {}) {
  return {
    orgnr,
    status,
    business_type: status === 'classified' ? 'konsulent' : null,
    text_digest: DIGEST,
    model_id: status === 'no_text' ? null : 'm',
    prompt_hash: status === 'no_text' ? null : DIGEST,
    sample: false,
    batch_id: status === 'pending' ? 'b' : null,
    classified_at: new Date('2026-11-08T12:00:00Z'),
    ...overrides,
  };
}

const classificationTable = SEED_TABLES.find((table) => table.name === 'classification');

describe('the table', () => {
  it('refuses a type outside the set, and a type on a row that is not classified', async () => {
    await rolledBack(async (tx) => {
      await company(tx, AS, 'AS');
      await expect(tx.savepoint((sp) => sp`insert into register.classification ${sp(row(AS, 'classified', { business_type: 'saas' }))}`)).rejects.toThrow(/check/);
      await expect(tx.savepoint((sp) => sp`insert into register.classification ${sp(row(AS, 'failed', { business_type: 'annet' }))}`)).rejects.toThrow(/check/);
    });
  });

  it('holds uklart as classified with no type', async () => {
    await rolledBack(async (tx) => {
      await company(tx, AS, 'AS');
      await tx`insert into register.classification ${tx(row(AS, 'classified', { business_type: null }))}`;
      const [stored] = await tx`select status, business_type from register.classification where orgnr = ${AS}`;
      expect(stored).toEqual({ status: 'classified', business_type: null });
    });
  });

  it('a deleted company takes its classification with it', async () => {
    await rolledBack(async (tx) => {
      await company(tx, AS, 'AS');
      await tx`insert into register.classification ${tx(row(AS, 'classified'))}`;
      await tx`delete from register.company where orgnr = ${AS}`;
      expect(await tx`select 1 from register.classification where orgnr = ${AS}`).toHaveLength(0);
    });
  });
});

describe('the store', () => {
  it('reads an AS in a covered code only, and overwrites a stored row', async () => {
    await rolledBack(async (tx) => {
      await company(tx, AS, 'AS', '99.999');
      await company(tx, ENK, 'ENK', '99.999');
      const store = postgresStore(tx as never, ['99.999']);
      expect((await store.targets()).map((target) => target.orgnr)).toEqual([AS]);
      await store.write([row(AS, 'pending') as never]);
      await store.write([row(AS, 'classified') as never]);
      expect(await store.stored()).toEqual(expect.arrayContaining([expect.objectContaining({ orgnr: AS, status: 'classified', batch_id: null })]));
    });
  });
});

describe('the seed export', () => {
  if (classificationTable === undefined) throw new Error('classification is not a seed table');

  it('sample rows are not exported', async () => {
    await rolledBack(async (tx) => {
      await company(tx, AS, 'AS');
      await company(tx, ENK, 'AS');
      await tx`insert into register.classification ${tx(row(AS, 'classified'))}`;
      await tx`insert into register.classification ${tx(row(ENK, 'classified', { sample: true }))}`;
      const [header, ...rows] = parseCsv((await copyTable(tx, classificationTable, { open: false }, [])).toString('utf8'));
      const at = header?.indexOf('orgnr') ?? -1;
      const orgnrs = rows.map((r) => r[at]);
      expect(orgnrs).toContain(AS);
      expect(orgnrs).not.toContain(ENK);
    });
  });

  it.each(['failed', 'pending'])('refuses while a row is %s', async (status) => {
    await rolledBack(async (tx) => {
      await company(tx, AS, 'AS');
      await tx`insert into register.classification ${tx(row(AS, status))}`;
      await expect(refuseUnfinishedClassifications(tx)).rejects.toThrow(SeedRefusal);
    });
  });

  it('a failed sample row does not block the export', async () => {
    await rolledBack(async (tx) => {
      await company(tx, AS, 'AS');
      await tx`insert into register.classification ${tx(row(AS, 'failed', { sample: true }))}`;
      await expect(refuseUnfinishedClassifications(tx)).resolves.toBeUndefined();
    });
  });

  it('non-AS never blocks the export', async () => {
    await rolledBack(async (tx) => {
      await company(tx, ENK, 'ENK');
      await tx`insert into register.classification ${tx(row(ENK, 'failed'))}`;
      await expect(refuseUnfinishedClassifications(tx)).resolves.toBeUndefined();
    });
  });
});

describe('the run record', () => {
  it('records a derive run with its counts', async () => {
    await rolledBack(async (tx) => {
      const counts = await withFingerprintRecord(tx, () => rebuildFingerprints(tx));
      const [record] = await tx`select mode, ended_at, counts, error from run.step2 order by id desc limit 1`;
      expect(record?.mode).toBe('fingerprints');
      expect(record?.ended_at).not.toBeNull();
      expect(record?.counts.written).toBe(counts.written);
      expect(record?.error).toBeNull();
    });
  });

  it('records a failed run with its error', async () => {
    await rolledBack(async (tx) => {
      await expect(withFingerprintRecord(tx, () => Promise.reject(new TypeError('bad input')))).rejects.toThrow('bad input');
      const [record] = await tx`select error from run.step2 order by id desc limit 1`;
      expect(record?.error).toBe('TypeError: bad input');
    });
  });
});
