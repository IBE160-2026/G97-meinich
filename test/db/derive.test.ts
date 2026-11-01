// Batch step 2 against the local database (Story 2.5): `pnpm derive`'s
// rebuild, run as `derive` through DERIVE_DATABASE_URL inside a transaction
// that is always rolled back, so the table is left as it was. Counts only:
// no company's fingerprint is printed or asserted.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { type DeriveCounts, rebuildFingerprints } from '../../scripts/derive.ts';
import { setting } from './db-env.ts';

const url = setting('DERIVE_DATABASE_URL');
if (url === undefined) throw new Error('DERIVE_DATABASE_URL is not set; run `pnpm db:roles`');
const derive = postgres(url, { max: 1, onnotice: () => {} });

afterAll(async () => {
  await derive.end();
});

class Rollback extends Error {}

async function rolledBack(fn: (tx: postgres.TransactionSql) => Promise<void>): Promise<void> {
  try {
    await derive.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (error instanceof Rollback) return;
    throw error;
  }
}

describe('pnpm derive', () => {
  it('connects as derive', async () => {
    const [row] = await derive<{ current_user: string }[]>`select current_user`;
    expect(row?.current_user).toBe('derive');
  });

  it('rebuilds one fingerprint per fingerprinted current column, only from reconciled ones, and counts the rest', async () => {
    await rolledBack(async (tx) => {
      let counts: DeriveCounts = await rebuildFingerprints(tx);
      const [stored] = await tx<{ rows: number; columns: number; reconciled: number; unreconciled_rows: number }[]>`
        select (select count(*)::int from register.fingerprint) as rows,
               (select count(*)::int from register.document_column where role = 'current') as columns,
               (select count(*)::int from register.document_column where role = 'current' and status = 'reconciled') as reconciled,
               (select count(*)::int
                  from register.fingerprint f
                  join register.document_column dc using (orgnr, filing_year, role)
                 where dc.status is distinct from 'reconciled') as unreconciled_rows
      `;
      expect(counts.written).toBe(stored?.rows);
      expect(counts.columns).toBe(stored?.columns);
      expect(stored?.unreconciled_rows).toBe(0);
      expect(counts.columns - counts.skipped.not_reconciled).toBe(stored?.reconciled);
      const skipped = Object.values(counts.skipped).reduce((sum, n) => sum + n, 0);
      expect(counts.written + skipped).toBe(counts.columns);
      const typed = Object.values(counts.types).reduce((sum, n) => sum + n, 0);
      expect(typed).toBe(counts.written);

      // A second run in the same transaction replaces, never adds.
      counts = await rebuildFingerprints(tx);
      const [again] = await tx<{ rows: number }[]>`select count(*)::int as rows from register.fingerprint`;
      expect(again?.rows).toBe(counts.written);
    });
  });
});
