// `pnpm explain`: batch step 2's explanation of each covered AS's default
// analysis (Story 4.1; FR-52; AD-7, AD-13). Reads the analysis as `reader`
// through the request path's own functions (scripts/explain-compute.ts,
// through Vite's module runner) and writes register.explanation and its
// run.step2 record as `derive`. Never runs in a request, and is never run by
// `pnpm derive` or `pnpm ingest`.
//
//   pnpm explain --plan --sample 20               what it would send and cost; no key, writes only its run record
//   pnpm explain --plan --all
//   pnpm explain --sample 20 --max-usd 0.05       a real run; needs the key and Meinich's yes to the ceiling
//
// A real run refuses when its ceiling is above --max-usd. Prints totals
// only, never a company; a sample run also prints three of its texts with
// the slots filled in, for its report. The full run is Story 4.3's, after
// the figure and phrase tests guard it.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { Decimal } from '../src/engine/decimal.ts';
import { readLabelled } from './classify.ts';
import { createModelClient, NoModelKey } from './classify/model-client.ts';
import { Refusal as ClassifyRefusal } from './classify/run.ts';
import { type Computed, type ExplanationRow, type Failure, type Options, Refusal, type Selection, type Store, planLines, runExplain } from './explain/run.ts';
import { requestParams } from './explain/request.ts';
import { setting } from './run-ingest.ts';

const WRITE_CHUNK = 1000;

export type Args = { readonly plan: boolean; readonly selection: Selection; readonly maxUsd: Decimal | null };

/** The arguments, or a Refusal naming what is wrong. */
export function parseArgs(argv: readonly string[]): Args {
  let plan = false;
  let all = false;
  let size: number | null = null;
  let maxUsd: Decimal | null = null;
  for (let at = 0; at < argv.length; at += 1) {
    const arg = argv[at];
    if (arg === '--plan') plan = true;
    else if (arg === '--all') all = true;
    else if (arg === '--sample') {
      at += 1;
      if (!/^[1-9]\d*$/.test(argv[at] ?? '')) throw new Refusal('--sample needs a positive whole number');
      size = Number(argv[at]);
    } else if (arg === '--max-usd') {
      at += 1;
      if (!/^\d+(\.\d+)?$/.test(argv[at] ?? '')) throw new Refusal('--max-usd needs an amount in dollars');
      maxUsd = new Decimal(argv[at] ?? '0');
    } else throw new Refusal(`unknown argument: ${String(arg)}`);
  }
  if (all === (size !== null)) throw new Refusal('give exactly one of --sample <n> and --all');
  if (!plan && maxUsd === null) throw new Refusal('a real run needs --max-usd; see the cost with --plan');
  return { plan, selection: size !== null ? { kind: 'sample', size } : { kind: 'all' }, maxUsd };
}

type Compute = typeof import('./explain-compute.ts');

/** The store: analyses through the compute module as `reader`, rows and the run record as `derive`. */
export function postgresStore(sql: postgres.Sql | postgres.TransactionSql, compute: Pick<Compute, 'coveredAsOrgnrs' | 'datasetTag' | 'subjectAnalysis'>): Store {
  return {
    subjects: () => compute.coveredAsOrgnrs(),
    async analysis(orgnr): Promise<Computed> {
      const computed = await compute.subjectAnalysis(orgnr);
      switch (computed.kind) {
        case 'no_peer_group':
          return computed;
        case 'empty':
          return { kind: 'empty', reason: computed.reason };
        case 'analysis':
          return { kind: 'analysis', analysis: computed.analysis };
      }
    },
    dataset: () => compute.datasetTag(),
    stored: () =>
      sql<Awaited<ReturnType<Store['stored']>>>`
        select orgnr, status, analysis_digest, model_id, prompt_hash, sample, batch_id, filing_year
          from register.explanation`.then((rows) => [...rows]),
    async write(rows: readonly ExplanationRow[]) {
      for (let start = 0; start < rows.length; start += WRITE_CHUNK) {
        const chunk = rows.slice(start, start + WRITE_CHUNK).map((row) => ({ ...row, slot_ids: row.slot_ids === null ? null : [...row.slot_ids] }));
        await sql`
          insert into register.explanation ${sql(chunk as never)}
          on conflict (orgnr) do update set
            status = excluded.status, template = excluded.template, slot_ids = excluded.slot_ids,
            filing_year = excluded.filing_year, analysis_digest = excluded.analysis_digest,
            prompt_hash = excluded.prompt_hash, model_id = excluded.model_id, dataset = excluded.dataset,
            sample = excluded.sample, batch_id = excluded.batch_id, generated_at = excluded.generated_at`;
      }
    },
    async startRun(modelId, promptHash, startedAt) {
      const [row] = await sql<{ id: string }[]>`
        insert into run.step2 (mode, started_at, model_id, prompt_hash)
        values ('explain', ${startedAt}, ${modelId}, ${promptHash}) returning id::text as id`;
      if (row === undefined) throw new Error('run.step2 returned no id');
      return row.id;
    },
    async endRun(id, endedAt, result: { counts: object; failures: readonly Failure[]; error: string | null }) {
      await sql`
        update run.step2 set ended_at = ${endedAt}, counts = ${sql.json(result.counts as never)},
               failures = ${sql.json(result.failures as never)}, error = ${result.error}
         where id = ${id}`;
    },
  };
}

async function loadCompute(root: string): Promise<Compute> {
  const url = setting(root, 'READER_DATABASE_URL');
  if (url === undefined) throw new Refusal('READER_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.');
  process.env.READER_DATABASE_URL = url;
  const { runnerImport } = await import('vite');
  const { module } = await runnerImport<Compute>(path.join(root, 'scripts', 'explain-compute.ts'), {
    root,
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { 'server-only': path.join(root, 'node_modules', 'server-only', 'empty.js') } },
  });
  return module;
}

export async function main(root: string, argv: readonly string[]): Promise<number> {
  const url = setting(root, 'DERIVE_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('explain: DERIVE_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  let compute: Compute | null = null;
  try {
    const args = parseArgs(argv);
    compute = await loadCompute(root);
    const store = postgresStore(sql, compute);
    const options: Options = { selection: args.selection, labelled: () => readLabelled(root) };
    if (args.plan) {
      process.stdout.write(`${(await planLines(store, options)).join('\n')}\n`);
      return 0;
    }
    return await runExplain(
      {
        store,
        model: () => createModelClient(root, requestParams),
        now: () => new Date(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        log: (line) => process.stdout.write(`${line}\n`),
      },
      options,
      args.maxUsd ?? new Decimal(0),
    );
  } catch (error) {
    // readLabelled (shared with classify) refuses with classify's Refusal.
    const known = error instanceof Refusal || error instanceof ClassifyRefusal || error instanceof NoModelKey;
    process.stderr.write(`explain: ${known ? '' : `${(error as Error).name}: `}${(error as Error).message}\n`);
    return 1;
  } finally {
    await sql.end();
    await compute?.closeReader();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd(), process.argv.slice(2));
}
