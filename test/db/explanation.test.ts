// register.explanation, run.step2's `explain` mode and pnpm explain's
// reads against the local Postgres (Story 4.1). Every write rolls back,
// with invented companies; the reads are the loaded demo seed's, as
// `reader`, through the request path's own functions.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { postgresStore } from '../../scripts/explain.ts';
import type { ExplanationRow } from '../../scripts/explain/run.ts';
import { keyFigureRows } from '../../src/analysis/key-figure-rows.ts';
import { strengthCard } from '../../src/analysis/oversikt-cards.ts';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import { largestCapitalGap, type CapitalChoice } from '../../src/engine/benchmark.ts';
import { t } from '../../src/messages/index.ts';
import { apiOnlySubject, seedInput } from '../explain/seed-analysis.ts';
import { defaultAnalysis } from '../../src/analysis/explanation-payload.ts';
import { narrow } from '../narrow.ts';
import { setting, supabaseDbUrl } from './db-env.ts';

const readerUrl = setting('READER_DATABASE_URL');
if (readerUrl === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
process.env.READER_DATABASE_URL = readerUrl;
const compute = await import('../../scripts/explain-compute.ts');

const sql = postgres(supabaseDbUrl(), { max: 1, onnotice: () => {} });
type Tx = postgres.TransactionSql;
class Rollback extends Error {}

afterAll(async () => {
  await sql.end();
  await compute.closeReader();
  delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
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

describe('the store', () => {
  it('the store starts and ends a run record', async () => {
    await rolledBack(async (tx) => {
      // As derive would: the grant is rolled back with the transaction (test/db/grants.test.ts does the same).
      await tx`grant derive to current_user with inherit false, set true`;
      await tx`set local role derive`;
      const store = postgresStore(tx, compute);
      const id = await store.startRun('claude-haiku-5-5', DIGEST, new Date('2026-11-27T12:00:00Z'));
      const counts = { plan: true, empty: { subject_no_revenue: 2 }, wording: { direction: { 'over medianen': 1 } } };
      const failures = [{ orgnr: AS, reason: 'digit_outside_slot' }];
      await store.endRun(id, new Date('2026-11-27T12:01:00Z'), { counts: counts as never, failures, error: null });
      const [record] = await tx<{ mode: string; model_id: string; ended_at: Date | null; counts: unknown; failures: unknown; error: string | null }[]>`
        select mode, model_id, ended_at, counts, failures, error from run.step2 where id = ${id}`;
      expect(record?.mode).toBe('explain');
      expect(record?.model_id).toBe('claude-haiku-5-5');
      expect(record?.ended_at).toEqual(new Date('2026-11-27T12:01:00Z'));
      expect(record?.counts).toEqual(counts);
      expect(record?.failures).toEqual(failures);
      expect(record?.error).toBeNull();
    });
  });

  it('writes a pending row, then overwrites it with the explained one', async () => {
    await rolledBack(async (tx) => {
      await company(tx, AS);
      const store = postgresStore(tx, compute);
      await store.write([row('pending') as ExplanationRow]);
      await store.write([row('explained') as ExplanationRow]);
      expect(await store.stored()).toEqual(
        expect.arrayContaining([expect.objectContaining({ orgnr: AS, status: 'explained', batch_id: null, filing_year: 2025 })]),
      );
      const [stored] = await tx`select slot_ids, template from register.explanation where orgnr = ${AS}`;
      expect(stored).toEqual({ slot_ids: ['driftsmargin.egen'], template: 'Driftsmarginen er {{driftsmargin.egen}}.' });
    });
  });

  it('reads the covered AS companies and the dataset tag', async () => {
    const subjects = await compute.coveredAsOrgnrs();
    expect(subjects).toContain(DEMO_COMPANIES[0].orgnr);
    expect(subjects).toEqual([...subjects].sort());
    expect(await compute.datasetTag()).toBe('demo');
  });
});

// The payload's choice is the page's: its first strength is Største styrke
// (strengthCard), and its capital gaps keep largestCapitalGap's order. The
// expected values come from those two functions over the same shown group,
// never from the payload module. Each subject's card states are written by
// hand (the built app, 2026-11-27): demo B has no strength, the API-only
// subject no capital gap.
describe('the same choice as the page', () => {
  const CAPITAL_LABEL = (figure: CapitalChoice): string =>
    t(figure === 'working_capital' ? 'oversikt.capital.workingCapital' : `fig.${figure}`);
  const API_ONLY = apiOnlySubject((orgnr) => {
    const input = seedInput(orgnr);
    return defaultAnalysis(input.funnel, input.filing, input.candidates).kind === 'analysis';
  });

  it.each([
    { label: 'demo A', orgnr: DEMO_COMPANIES[0].orgnr, strength: 'shown', capital: 'amount' },
    { label: 'demo B', orgnr: DEMO_COMPANIES[1].orgnr, strength: 'empty', capital: 'amount' },
    { label: 'the API-only subject', orgnr: API_ONLY, strength: 'shown', capital: 'none' },
  ] as const)("the payload names the page's strength and capital-gap order: $label", async ({ orgnr, strength, capital }) => {
    const { analysis, shown } = narrow(await compute.subjectAnalysis(orgnr), 'analysis');
    const api = shown.benchmark;
    const document = shown.documentBenchmark;
    const card = strengthCard(api, document, keyFigureRows(api, document, shown.filingYear));
    expect(card.kind).toBe(strength);
    const strengthHead = strength === 'shown' ? [narrow(card, 'shown').name] : [];
    expect(analysis.payload.strengths.slice(0, 1).map((item) => item.name)).toEqual(strengthHead);

    const choice = largestCapitalGap(document.kfd.gap, document.lgd.gap, document.oml.gap);
    expect(choice.kind).toBe(capital);
    const order =
      capital === 'amount'
        ? [...narrow(choice, 'amount').candidates].sort((a, b) => b.ore.comparedTo(a.ore)).map((candidate) => CAPITAL_LABEL(candidate.figure))
        : [];
    const head = capital === 'amount' ? [CAPITAL_LABEL(narrow(choice, 'amount').figure)] : [];
    const named = analysis.payload.capital_gaps_one_off.map((item) => item.name);
    expect(named.slice(0, 1)).toEqual(head);
    expect(named.filter((name) => order.includes(name))).toEqual(order);
  });
});
