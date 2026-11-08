// One pnpm classify run (Story 2.6), against an injected store and model, so
// the tests run without a key. Totals only: nothing it prints names a company.
import { Decimal } from '../../src/engine/decimal.ts';
import { BUSINESS_TYPES, type BusinessType } from '../../src/engine/fingerprint.ts';
import type { BatchResult, ModelClient } from './model-client.ts';
import { type CostPlan, PRICE_DATE, PRICE_PER_MTOK, type StoredRow, type WorkItem, costPlan, decideWork, drawSample } from './plan.ts';
import { MODEL_ID, type Target, parseAnswer, promptHash } from './request.ts';

export type ClassificationRow = {
  readonly orgnr: string;
  readonly status: 'classified' | 'no_text' | 'failed' | 'pending';
  readonly business_type: BusinessType | null;
  readonly text_digest: string;
  readonly model_id: string | null;
  readonly prompt_hash: string | null;
  readonly sample: boolean;
  readonly batch_id: string | null;
  readonly classified_at: Date;
};

export type PendingRow = StoredRow & { readonly batch_id: string };
export type Failure = { readonly orgnr: string | null; readonly reason: string };

export interface Store {
  targets(): Promise<Target[]>;
  stored(): Promise<(StoredRow & { readonly batch_id: string | null })[]>;
  write(rows: readonly ClassificationRow[]): Promise<void>;
  startRun(modelId: string, promptHash: string, startedAt: Date): Promise<bigint | string>;
  endRun(
    id: bigint | string,
    endedAt: Date,
    result: { readonly counts: Counts; readonly failures: readonly Failure[]; readonly error: string | null },
  ): Promise<void>;
}

export type Selection = { readonly kind: 'sample'; readonly size: number } | { readonly kind: 'all' };

export type Options = {
  readonly selection: Selection;
  readonly reclassifyStale: boolean;
  readonly labelled: () => ReadonlySet<string>;
};

export type Counts = {
  sent: number;
  classified: Record<BusinessType, number>;
  uklart: number;
  no_text: number;
  failed: number;
  unchanged: number;
  stale: number;
  input_tokens: number;
  output_tokens: number;
};

export class Refusal extends Error {}

const emptyCounts = (): Counts => ({
  sent: 0,
  classified: { produkt: 0, konsulent: 0, forhandler: 0, annet: 0 },
  uklart: 0,
  no_text: 0,
  failed: 0,
  unchanged: 0,
  stale: 0,
  input_tokens: 0,
  output_tokens: 0,
});

const options0 = { modelId: MODEL_ID, promptHash: promptHash() };

async function selectTargets(store: Store, options: Options): Promise<Target[]> {
  const targets = await store.targets();
  // A database that has not had --companies-only must not be stored as all no_text.
  if (!targets.some((target) => target.aktivitet !== null || target.vedtektsfestet_formaal !== null)) {
    throw new Refusal('no covered AS has register text; run `pnpm ingest --companies-only` first');
  }
  return options.selection.kind === 'sample' ? drawSample(targets, options.labelled(), options.selection.size) : targets;
}

function workOf(targets: readonly Target[], stored: readonly StoredRow[], options: Options) {
  return decideWork(targets, stored, { ...options0, sample: options.selection.kind === 'sample', reclassifyStale: options.reclassifyStale });
}

const tokens = (n: number) => new Decimal(n).div(1_000_000).toFixed(2);
const planLine = (name: string, estimate: CostPlan['central']) =>
  `  ${name}: ${tokens(estimate.inputTokens)} M in, ${tokens(estimate.outputTokens)} M out, $${estimate.usd.toFixed(2)}`;

/** `--plan`: what the run would send and cost. Needs no key and writes nothing. */
export async function planLines(store: Store, options: Options): Promise<string[]> {
  const targets = await selectTargets(store, options);
  const work = workOf(targets, await store.stored(), options);
  const plan = costPlan(work.send.map((item) => item.input));
  const name = options.selection.kind === 'sample' ? `sample of ${options.selection.size}` : 'every AS in a covered industry';
  return [
    `classify plan (${name}), nothing sent or written. Model ${MODEL_ID}, Batch API, $${PRICE_PER_MTOK.input.toString()} in / $${PRICE_PER_MTOK.output.toString()} out per MTok (read ${PRICE_DATE}).`,
    `  would send ${work.send.length}; no_text ${work.noText.length}; unchanged ${work.unchanged}; stale, not sent ${work.stale}; pending ${work.pending}`,
    planLine('central', plan.central),
    planLine('high', plan.high),
    planLine('ceiling (max_tokens on every request)', plan.ceiling),
  ];
}

export type Deps = {
  readonly store: Store;
  readonly model: ModelClient;
  readonly now: () => Date;
  readonly sleep: (ms: number) => Promise<void>;
  readonly log: (line: string) => void;
};

const POLL_MS = 60_000;

/** Waits for one batch and stores what came back; a request with no result is failed. */
async function collect(
  deps: Deps,
  batchId: string,
  items: ReadonlyMap<string, { readonly textDigest: string; readonly sample: boolean }>,
  counts: Counts,
  failures: Failure[],
): Promise<void> {
  while (!(await deps.model.ended(batchId))) await deps.sleep(POLL_MS);
  const rows: ClassificationRow[] = [];
  const seen = new Set<string>();
  const row = (orgnr: string, status: 'classified' | 'failed', type: BusinessType | null): ClassificationRow => {
    const item = items.get(orgnr);
    if (item === undefined) throw new Error('the batch returned a company it was not asked about');
    return {
      orgnr,
      status,
      business_type: type,
      text_digest: item.textDigest,
      model_id: MODEL_ID,
      prompt_hash: options0.promptHash,
      sample: item.sample,
      batch_id: null,
      classified_at: deps.now(),
    };
  };
  const fail = (orgnr: string, reason: string) => {
    counts.failed += 1;
    failures.push({ orgnr, reason });
    rows.push(row(orgnr, 'failed', null));
  };
  const apply = (result: BatchResult) => {
    seen.add(result.orgnr);
    if (result.outcome.kind === 'failed') {
      fail(result.orgnr, result.outcome.reason);
      return;
    }
    counts.input_tokens += result.outcome.inputTokens;
    counts.output_tokens += result.outcome.outputTokens;
    const answer = parseAnswer(result.outcome.text);
    if ('failed' in answer) {
      fail(result.orgnr, answer.failed);
    } else {
      if (answer.type === null) counts.uklart += 1;
      else counts.classified[answer.type] += 1;
      rows.push(row(result.orgnr, 'classified', answer.type));
    }
  };
  for await (const result of deps.model.results(batchId)) apply(result);
  for (const orgnr of items.keys()) if (!seen.has(orgnr)) fail(orgnr, 'no_result_in_batch');
  await deps.store.write(rows);
}

/** Resumes the batches an interrupted run left pending, at no new cost. */
async function collectPending(deps: Deps, counts: Counts, failures: Failure[]): Promise<void> {
  const byBatch = new Map<string, Map<string, { textDigest: string; sample: boolean }>>();
  for (const row of await deps.store.stored()) {
    if (row.status !== 'pending' || row.batch_id === null) continue;
    const items = byBatch.get(row.batch_id) ?? new Map<string, { textDigest: string; sample: boolean }>();
    items.set(row.orgnr, { textDigest: row.text_digest, sample: row.sample });
    byBatch.set(row.batch_id, items);
  }
  for (const [batchId, items] of byBatch) await collect(deps, batchId, items, counts, failures);
}

function noTextRow(item: WorkItem, sample: boolean, at: Date): ClassificationRow {
  return { orgnr: item.orgnr, status: 'no_text', business_type: null, text_digest: item.textDigest, model_id: null, prompt_hash: null, sample, batch_id: null, classified_at: at };
}

/** A real run: refuses above `maxUsd` with nothing sent. Returns the exit code. */
export async function runClassify(deps: Deps, options: Options, maxUsd: Decimal): Promise<number> {
  const { store, model, log } = deps;
  const counts = emptyCounts();
  const failures: Failure[] = [];
  const id = await store.startRun(options0.modelId, options0.promptHash, deps.now());
  const finish = (error: string | null) => store.endRun(id, deps.now(), { counts, failures, error });
  try {
    await collectPending(deps, counts, failures);
    const targets = await selectTargets(store, options);
    const work = workOf(targets, await store.stored(), options);
    const plan = costPlan(work.send.map((item) => item.input));
    if (plan.ceiling.usd.gt(maxUsd)) {
      throw new Refusal(`the ceiling $${plan.ceiling.usd.toFixed(2)} is above --max-usd ${maxUsd.toString()}; nothing sent`);
    }
    const sample = options.selection.kind === 'sample';
    counts.unchanged = work.unchanged;
    counts.stale = work.stale;
    counts.no_text = work.noText.length;
    await store.write(work.noText.map((item) => noTextRow(item, sample, deps.now())));
    if (work.send.length > 0) {
      const batchId = await model.submit(work.send.map(({ orgnr, input }) => ({ orgnr, input })));
      counts.sent = work.send.length;
      await store.write(
        work.send.map((item) => ({
          orgnr: item.orgnr,
          status: 'pending',
          business_type: null,
          text_digest: item.textDigest,
          model_id: MODEL_ID,
          prompt_hash: options0.promptHash,
          sample,
          batch_id: batchId,
          classified_at: deps.now(),
        })),
      );
      log(`classify: batch submitted, ${work.send.length} requests; waiting`);
      const items = new Map(work.send.map((item) => [item.orgnr, { textDigest: item.textDigest, sample }]));
      await collect(deps, batchId, items, counts, failures);
    }
    await finish(null);
    const types = BUSINESS_TYPES.map((type) => `${type} ${counts.classified[type]}`).join(', ');
    log(`classify: sent ${counts.sent}; ${types}; uklart ${counts.uklart}; no_text ${counts.no_text}; failed ${counts.failed}; unchanged ${counts.unchanged}; stale, not sent ${counts.stale}`);
    log(`classify: ${counts.input_tokens} tokens in, ${counts.output_tokens} tokens out, thinking included`);
    return counts.failed > 0 ? 1 : 0;
  } catch (error) {
    await finish(`${(error as Error).name}: ${(error as Error).message}`);
    throw error;
  }
}


