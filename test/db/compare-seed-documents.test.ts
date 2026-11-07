// `pnpm analysis:seed-documents` against the loaded database (Story 2.5d):
// the catalog-driven select lines up with the committed seed, so the OCR
// reference set's rows compare equal, none differing or on one side only;
// and the script's one connection is read-only. Totals only.
import { afterAll, describe, expect, it } from 'vitest';
import { connect, readComparisons, referenceOrgnrs, sameAsSeed } from '../../scripts/compare-seed-documents.ts';
import { root, setting } from './db-env.ts';

const url = setting('INGEST_DATABASE_URL');
if (url === undefined) throw new Error('INGEST_DATABASE_URL is not set; run `pnpm db:roles`');
const sql = connect(url);

afterAll(async () => {
  await sql.end();
});

describe('analysis:seed-documents on the loaded database', () => {
  it('finds the reference set\'s rows equal to the seed, in both tables', async () => {
    const { comparisons, readerCommits } = await readComparisons(sql, root, referenceOrgnrs(root));
    expect(comparisons.map((c) => c.name)).toEqual(['document', 'document_column']);
    for (const { name, comparison } of comparisons) {
      expect(comparison.equal, name).toBeGreaterThan(0);
      expect(sameAsSeed(comparison), `${name}: ${JSON.stringify(comparison)}`).toBe(true);
    }
    expect(readerCommits.length).toBe(comparisons[0]?.comparison.equal);
  });

  it('connects read-only: default_transaction_read_only is on, and a write is refused', async () => {
    const [row] = await sql<{ value: string }[]>`select current_setting('default_transaction_read_only') as value`;
    expect(row?.value).toBe('on');
    await expect(sql`update register.document set read_at = read_at where false`).rejects.toMatchObject({ code: '25006' });
  });
});
