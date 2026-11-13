// Step 2's run record (Story 2.6; AD-2): one row in run.step2 for each
// fingerprint run, inserted when it starts and ended with its counts, also
// when it fails. pnpm classify writes its own through its store. Only `derive`
// writes the table; step 1 has run.step1.
import type postgres from 'postgres';

type Sql = postgres.Sql | postgres.TransactionSql;

/** Runs `work` and records it; the error, if any, is written before it is rethrown. */
export async function withFingerprintRecord<T extends object>(sql: Sql, work: () => Promise<T>): Promise<T> {
  const [row] = await sql<{ id: string }[]>`
    insert into run.step2 (mode, started_at) values ('fingerprints', now()) returning id`;
  if (row === undefined) throw new Error('run.step2 returned no id');
  try {
    const counts = await work();
    await sql`update run.step2 set ended_at = now(), counts = ${sql.json(counts as never)} where id = ${row.id}`;
    return counts;
  } catch (error) {
    await sql`update run.step2 set ended_at = now(), error = ${`${(error as Error).name}: ${(error as Error).message}`} where id = ${row.id}`;
    throw error;
  }
}

export type RunRecord = {
  readonly id: string;
  readonly mode: string;
  readonly started_at: Date;
  readonly ended_at: Date | null;
  readonly failures: number;
  readonly error: string | null;
};

/** One step's latest run record as `pnpm seed` prints it. Null: there is none. */
export function runRecordLine(step: 'step 1' | 'step 2', record: RunRecord | null): string {
  if (record === null) return `seed: ${step}: no run record`;
  const ended = record.ended_at === null ? 'not ended' : `ended ${record.ended_at.toISOString()}`;
  const error = record.error === null ? '' : ', ended in an error';
  return `seed: ${step}: last run ${record.id} (${record.mode}), started ${record.started_at.toISOString()}, ${ended}, ${record.failures} failures${error}`;
}

/** The latest record of `table`, read as that step's own role; only `pnpm seed`'s print reads it. */
export async function latestRunRecord(sql: postgres.Sql | postgres.TransactionSql, table: 'step1' | 'step2'): Promise<RunRecord | null> {
  // Ordered by the table's bigint id: a bare `id` names the text alias, and "9" sorts after "10".
  const [row] = await sql.unsafe<RunRecord[]>(
    `select r.id::text as id, r.mode, r.started_at, r.ended_at, jsonb_array_length(r.failures) as failures, r.error
       from run.${table} r order by r.id desc limit 1`,
  );
  return row ?? null;
}
