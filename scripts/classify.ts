// `pnpm classify`: batch step 2's classification of each AS in a covered
// industry (Story 2.6; FR-11, FR-12). Connects as `derive`, never runs in a
// request, and is never run by `pnpm derive` or `pnpm ingest`.
//
//   pnpm classify --plan --sample 300    what it would send and cost; no key, no write
//   pnpm classify --plan --all
//   pnpm classify --sample 300 --max-usd 0.20   a real run; needs the key
//
// A real run refuses when its ceiling is above --max-usd. --reclassify-stale
// also sends rows stored under another prompt or model, which are otherwise
// only counted. Prints totals only, never a company.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { Decimal } from '../src/engine/decimal.ts';
import { createModelClient, NoModelKey } from './classify/model-client.ts';
import { type ClassificationRow, type Failure, type Options, Refusal, type Selection, type Store, planLines, runClassify } from './classify/run.ts';
import type { Target } from './classify/request.ts';
import { setting } from './run-ingest.ts';

const LABELLED_FILE = 'analysis/labelled-set/document-run.json';
const WRITE_CHUNK = 1000;

export type Args = { readonly plan: boolean; readonly selection: Selection; readonly reclassifyStale: boolean; readonly maxUsd: Decimal | null };

/** The arguments, or a Refusal naming what is wrong. */
export function parseArgs(argv: readonly string[]): Args {
  let plan = false;
  let all = false;
  let reclassifyStale = false;
  let size: number | null = null;
  let maxUsd: Decimal | null = null;
  for (let at = 0; at < argv.length; at += 1) {
    const arg = argv[at];
    if (arg === '--plan') plan = true;
    else if (arg === '--all') all = true;
    else if (arg === '--reclassify-stale') reclassifyStale = true;
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
  return { plan, selection: size !== null ? { kind: 'sample', size } : { kind: 'all' }, reclassifyStale, maxUsd };
}

/** The labelled set's orgnrs. An unreadable file refuses: a sample must not draw blind. */
export function readLabelled(root: string): ReadonlySet<string> {
  const list: unknown = JSON.parse(readFileSync(path.join(root, LABELLED_FILE), 'utf8'));
  if (!Array.isArray(list) || list.length === 0) throw new Refusal(`${LABELLED_FILE} holds no list`);
  return new Set(
    list.map((entry: unknown) => {
      const orgnr = (entry as { orgnr?: unknown } | null)?.orgnr;
      if (typeof orgnr !== 'string') throw new Refusal(`${LABELLED_FILE}: an entry has no orgnr`);
      return orgnr;
    }),
  );
}

function coveredCodes(root: string): string[] {
  const coverage = JSON.parse(readFileSync(path.join(root, 'seed/coverage.json'), 'utf8')) as { code: string }[];
  return coverage.map((entry) => entry.code);
}

export function postgresStore(sql: postgres.Sql, codes: readonly string[]): Store {
  return {
    targets: () => sql<Target[]>`
      select orgnr, navn, naeringskode2, naeringskode3, aktivitet, vedtektsfestet_formaal
        from register.company
       where organisasjonsform = 'AS' and naeringskode1 = any(${codes as string[]})
       order by orgnr collate "C"`.then((rows) => [...rows]),
    stored: () =>
      sql<Awaited<ReturnType<Store['stored']>>>`
        select orgnr, status, text_digest, model_id, prompt_hash, sample, batch_id from register.classification`.then((rows) => [...rows]),
    async write(rows: readonly ClassificationRow[]) {
      for (let start = 0; start < rows.length; start += WRITE_CHUNK) {
        const chunk = rows.slice(start, start + WRITE_CHUNK);
        await sql`
          insert into register.classification ${sql(chunk as ClassificationRow[])}
          on conflict (orgnr) do update set
            status = excluded.status, business_type = excluded.business_type, text_digest = excluded.text_digest,
            model_id = excluded.model_id, prompt_hash = excluded.prompt_hash, sample = excluded.sample,
            batch_id = excluded.batch_id, classified_at = excluded.classified_at`;
      }
    },
    async startRun(modelId: string, promptHash: string, startedAt: Date) {
      const [row] = await sql<{ id: string }[]>`
        insert into run.step2 (mode, started_at, model_id, prompt_hash)
        values ('classify', ${startedAt}, ${modelId}, ${promptHash}) returning id`;
      if (row === undefined) throw new Error('run.step2 returned no id');
      return row.id;
    },
    async endRun(id, endedAt, result: { counts: object; failures: readonly Failure[]; error: string | null }) {
      await sql`
        update run.step2 set ended_at = ${endedAt}, counts = ${sql.json(result.counts as never)},
               failures = ${sql.json(result.failures as never)}, error = ${result.error}
         where id = ${String(id)}`;
    },
  };
}

export async function main(root: string, argv: readonly string[]): Promise<number> {
  const url = setting(root, 'DERIVE_DATABASE_URL');
  if (url === undefined) {
    process.stderr.write('classify: DERIVE_DATABASE_URL is not set; run `pnpm db:start` and `pnpm db:roles`.\n');
    return 1;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const args = parseArgs(argv);
    const store = postgresStore(sql, coveredCodes(root));
    const options: Options = { selection: args.selection, reclassifyStale: args.reclassifyStale, labelled: () => readLabelled(root) };
    if (args.plan) {
      process.stdout.write(`${(await planLines(store, options)).join('\n')}\n`);
      return 0;
    }
    const model = createModelClient(root);
    return await runClassify(
      {
        store,
        model,
        now: () => new Date(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        log: (line) => process.stdout.write(`${line}\n`),
      },
      options,
      args.maxUsd ?? new Decimal(0),
    );
  } catch (error) {
    const known = error instanceof Refusal || error instanceof NoModelKey;
    process.stderr.write(`classify: ${known ? '' : `${(error as Error).name}: `}${(error as Error).message}\n`);
    return 1;
  } finally {
    await sql.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.cwd(), process.argv.slice(2));
}
