// One pnpm explain run (Story 4.1; FR-52; AD-7, AD-13), against an
// injected store and model, so the tests run without a key. Totals only:
// nothing it prints names a company. Every run, --plan included, writes one
// run.step2 record with mode `explain`, also when it ends in an error.
//
// - The subjects are the AS companies in a covered industry. Each one's
//   default analysis is computed in memory by the store (the request path's
//   own reads and `defaultAnalysis`); a subject with no filing has no peer
//   group, and an empty group makes no call and is counted under its
//   EmptyReason (decision "Empty peer group").
// - A sample is drawn outside the labelled set, by a digest, until it holds
//   `size` subjects with a peer group; its rows are marked `sample`.
// - The ceiling (high input, MAX_TOKENS of output on every request) above
//   --max-usd refuses with nothing sent. The model is reached only after
//   that check, through the injected factory, which throws without a key.
// - A response is stored only as a template that `parseTemplate` accepts;
//   anything else is a failed row with its reason in the run record, and a
//   billed response's tokens are counted either way.
import type { ExplanationAnalysis, ExplanationPayload } from '../../src/analysis/explanation-payload.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import type { EmptyReason } from '../../src/engine/peers.ts';
import { type BatchRequest, type BatchResult, type ModelClient, toBatchResult } from '../classify/model-client.ts';
import {
  type CostPlan,
  PRICE_DATE,
  PRICE_PER_MTOK,
  type StoredRow,
  type WordingCounts,
  type WorkItem,
  WORDINGS,
  costPlan,
  decideWork,
  emptyKey,
  sampleOrder,
  wordingCounts,
} from './plan.ts';
import { MODEL_ID, fillTemplate, parseTemplate, promptHash } from './request.ts';
import { t } from '../../src/messages/index.ts';

/** A subject's default analysis, as the store computes it. */
export type Computed =
  | { readonly kind: 'no_peer_group' }
  | { readonly kind: 'empty'; readonly reason: EmptyReason }
  | { readonly kind: 'analysis'; readonly analysis: ExplanationAnalysis };

export type ExplanationRow = {
  readonly orgnr: string;
  readonly status: 'explained' | 'failed' | 'pending';
  readonly template: string | null;
  readonly slot_ids: readonly string[] | null;
  readonly filing_year: number;
  readonly analysis_digest: string;
  readonly prompt_hash: string;
  readonly model_id: string;
  readonly dataset: 'demo' | 'full';
  readonly sample: boolean;
  readonly batch_id: string | null;
  readonly generated_at: Date;
};

export type StoredExplanation = StoredRow & { readonly filing_year: number };
export type Failure = { readonly orgnr: string | null; readonly reason: string };

export interface Store {
  /** The AS companies in a covered industry, in byte order of orgnr. */
  subjects(): Promise<string[]>;
  analysis(orgnr: string): Promise<Computed>;
  /** `register.dataset`'s tag, or null when no seed is loaded. */
  dataset(): Promise<'demo' | 'full' | null>;
  stored(): Promise<StoredExplanation[]>;
  write(rows: readonly ExplanationRow[]): Promise<void>;
  startRun(modelId: string, promptHash: string, startedAt: Date): Promise<string>;
  endRun(
    id: string,
    endedAt: Date,
    result: { readonly counts: Counts; readonly failures: readonly Failure[]; readonly error: string | null },
  ): Promise<void>;
}

export type Selection = { readonly kind: 'sample'; readonly size: number } | { readonly kind: 'all' };

export type Options = {
  readonly selection: Selection;
  /** The labelled set's orgnrs; read only for a sample, which must not draw blind. */
  readonly labelled: () => ReadonlySet<string>;
};

export type Counts = {
  /** A --plan run: nothing sent, no explanation written. */
  plan: boolean;
  /** Subjects whose analysis was computed. */
  subjects: number;
  with_peer_group: number;
  /** Empty groups by EmptyReason (`no_reason` when no stage gave one): no call. */
  empty: Record<string, number>;
  /** Subjects with no SELSKAP filing: no peer group, no call. */
  no_peer_group: number;
  sent: number;
  explained: number;
  failed: number;
  /** Failed rows by reason: a refused template's or the response's. */
  failure_reasons: Record<string, number>;
  unchanged: number;
  pending: number;
  input_tokens: number;
  output_tokens: number;
  /** The direction and rank words of the analyses that would be or were sent. */
  wording: WordingCounts;
};

export class Refusal extends Error {}

const emptyCounts = (plan: boolean): Counts => ({
  plan,
  subjects: 0,
  with_peer_group: 0,
  empty: {},
  no_peer_group: 0,
  sent: 0,
  explained: 0,
  failed: 0,
  failure_reasons: {},
  unchanged: 0,
  pending: 0,
  input_tokens: 0,
  output_tokens: 0,
  wording: wordingCounts([]),
});

const PROMPT = { modelId: MODEL_ID, promptHash: promptHash() };

/** Computes the selected subjects' analyses and counts them; returns those with a peer group. */
async function select(store: Store, options: Options, counts: Counts): Promise<WorkItem[]> {
  const subjects = await store.subjects();
  const sample = options.selection.kind === 'sample' ? options.selection.size : null;
  const order = sample === null ? subjects : sampleOrder(subjects, options.labelled());
  const items: WorkItem[] = [];
  for (const orgnr of order) {
    if (sample !== null && items.length === sample) break;
    const computed = await store.analysis(orgnr);
    counts.subjects += 1;
    switch (computed.kind) {
      case 'no_peer_group':
        counts.no_peer_group += 1;
        break;
      case 'empty': {
        const key = emptyKey(computed.reason);
        counts.empty[key] = (counts.empty[key] ?? 0) + 1;
        break;
      }
      case 'analysis':
        counts.with_peer_group += 1;
        items.push({ orgnr, analysis: computed.analysis });
        break;
    }
  }
  return items;
}

async function workOf(store: Store, options: Options, counts: Counts) {
  const items = await select(store, options, counts);
  const work = decideWork(items, await store.stored(), { ...PROMPT, sample: options.selection.kind === 'sample' });
  counts.unchanged = work.unchanged;
  counts.pending = work.pending;
  counts.wording = wordingCounts(work.send.map((item) => item.analysis));
  return { work, plan: costPlan(work.send.map((item) => item.analysis)) };
}

const millions = (n: number) => new Decimal(n).div(1_000_000).toFixed(4);
const dollars = (amount: Decimal) => `$${amount.toFixed(4)}`;
const planLine = (name: string, estimate: CostPlan['central']) =>
  `  ${name}: ${millions(estimate.inputTokens)} M in, ${millions(estimate.outputTokens)} M out, ${dollars(estimate.usd)}`;
const tally = (counts: Record<string, number>) =>
  Object.keys(counts).length === 0 ? 'none' : Object.entries(counts).map(([key, n]) => `${key} ${n}`).join(', ');
const words = (counts: Record<string, number>) => Object.entries(counts).map(([word, n]) => `«${word}» ${n}`).join(', ');

/** Runs `work` under one run record, ended with the counts, also on an error, which is rethrown. */
async function recorded<T>(store: Store, now: () => Date, counts: Counts, failures: Failure[], work: () => Promise<T>): Promise<T> {
  const id = await store.startRun(PROMPT.modelId, PROMPT.promptHash, now());
  try {
    const result = await work();
    await store.endRun(id, now(), { counts, failures, error: null });
    return result;
  } catch (error) {
    await store.endRun(id, now(), { counts, failures, error: `${(error as Error).name}: ${(error as Error).message}` });
    throw error;
  }
}

/** `--plan`: what the run would send and cost. Needs no key; writes its run record and nothing else. */
export async function planLines(store: Store, options: Options, now: () => Date = () => new Date()): Promise<string[]> {
  const counts = emptyCounts(true);
  return recorded(store, now, counts, [], async () => {
    const { work, plan } = await workOf(store, options, counts);
    const name = options.selection.kind === 'sample' ? `sample of ${options.selection.size}, drawn outside the labelled set` : 'every AS in a covered industry';
    return [
      `explain plan (${name}), nothing sent, no explanation written. Model ${MODEL_ID}, Batch API, $${PRICE_PER_MTOK.input.toString()} in / $${PRICE_PER_MTOK.output.toString()} out per MTok (read ${PRICE_DATE}).`,
      `  subjects ${counts.subjects}: with a peer group ${counts.with_peer_group}; empty group, no call: ${tally(counts.empty)}; no filing, no peer group ${counts.no_peer_group}`,
      `  would send ${work.send.length}; unchanged ${work.unchanged}; pending ${work.pending}`,
      planLine('central', plan.central),
      planLine('high', plan.high),
      planLine('ceiling (max_tokens on every request)', plan.ceiling),
      `  direction words: ${words(counts.wording.direction)}`,
      `  rank words: ${words(counts.wording.rank)}`,
    ];
  });
}

export type Deps = {
  readonly store: Store;
  /** The model, reached only after the ceiling check. Throws NoModelKey without a key. */
  readonly model: () => ModelClient<ExplanationPayload>;
  readonly now: () => Date;
  readonly sleep: (ms: number) => Promise<void>;
  readonly log: (line: string) => void;
};

const POLL_MS = 60_000;

/** What a batch's result is checked and stored against. `analysis` is null when it changed since the request was sent. */
type Pending = {
  readonly analysis: ExplanationAnalysis | null;
  readonly digest: string;
  readonly filingYear: number;
  readonly modelId: string;
  readonly promptHash: string;
  readonly sample: boolean;
};

type Collected = { readonly orgnr: string; readonly filled: string };
/** A refused template's text and reason: printed by a sample run, never stored, never with its orgnr. */
type Refused = { readonly reason: string; readonly text: string };

async function collect(
  deps: Deps,
  model: ModelClient<ExplanationPayload>,
  batchId: string,
  items: ReadonlyMap<string, Pending>,
  dataset: 'demo' | 'full',
  run: { readonly counts: Counts; readonly failures: Failure[]; readonly examples: Collected[]; readonly refused: Refused[] },
): Promise<void> {
  const { counts, failures } = run;
  while (!(await model.ended(batchId))) await deps.sleep(POLL_MS);
  const rows: ExplanationRow[] = [];
  const seen = new Set<string>();
  const row = (orgnr: string, item: Pending, template: { readonly text: string; readonly slotIds: readonly string[] } | null): ExplanationRow => ({
    orgnr,
    status: template === null ? 'failed' : 'explained',
    template: template?.text ?? null,
    slot_ids: template?.slotIds ?? null,
    filing_year: item.filingYear,
    analysis_digest: item.digest,
    prompt_hash: item.promptHash,
    model_id: item.modelId,
    dataset,
    sample: item.sample,
    batch_id: null,
    generated_at: deps.now(),
  });
  const fail = (orgnr: string, item: Pending, reason: string) => {
    counts.failed += 1;
    counts.failure_reasons[reason] = (counts.failure_reasons[reason] ?? 0) + 1;
    failures.push({ orgnr, reason });
    rows.push(row(orgnr, item, null));
  };
  const apply = (result: BatchResult) => {
    const item = items.get(result.orgnr);
    if (item === undefined) throw new Error('the batch returned a company it was not asked about');
    seen.add(result.orgnr);
    if (result.outcome.kind === 'failed') {
      // A response that stopped early was billed: its tokens count (deferred entry of PR #54).
      counts.input_tokens += result.outcome.usage?.inputTokens ?? 0;
      counts.output_tokens += result.outcome.usage?.outputTokens ?? 0;
      fail(result.orgnr, item, result.outcome.reason);
      return;
    }
    counts.input_tokens += result.outcome.inputTokens;
    counts.output_tokens += result.outcome.outputTokens;
    if (item.analysis === null) {
      fail(result.orgnr, item, 'analysis_changed');
      return;
    }
    const template = parseTemplate(result.outcome.text, item.analysis.slots);
    if (template.kind === 'refused') {
      fail(result.orgnr, item, template.reason);
      run.refused.push({ reason: template.reason, text: result.outcome.text });
      return;
    }
    counts.explained += 1;
    rows.push(row(result.orgnr, item, { text: template.template, slotIds: template.slotIds }));
    run.examples.push({ orgnr: result.orgnr, filled: fillTemplate(template.template, item.analysis.slots) });
  };
  for await (const result of model.results(batchId)) apply(result);
  for (const [orgnr, item] of items) if (!seen.has(orgnr)) fail(orgnr, item, 'no_result_in_batch');
  await deps.store.write(rows);
}

/** The batches an interrupted run left pending, each checked against the analysis as it is now. */
async function pendingBatches(store: Store): Promise<Map<string, Map<string, Pending>>> {
  const byBatch = new Map<string, Map<string, Pending>>();
  for (const row of await store.stored()) {
    if (row.status !== 'pending' || row.batch_id === null) continue;
    const computed = await store.analysis(row.orgnr);
    const analysis = computed.kind === 'analysis' && computed.analysis.digest === row.analysis_digest ? computed.analysis : null;
    const items = byBatch.get(row.batch_id) ?? new Map<string, Pending>();
    items.set(row.orgnr, {
      analysis,
      digest: row.analysis_digest,
      filingYear: row.filing_year,
      modelId: row.model_id,
      promptHash: row.prompt_hash,
      sample: row.sample,
    });
    byBatch.set(row.batch_id, items);
  }
  return byBatch;
}

/** How many filled-in templates a sample run prints, for its report (decision on the run order). */
export const SAMPLE_EXAMPLES = 3;

/** A real run: refuses above `maxUsd` with nothing sent. Returns the exit code. */
export async function runExplain(deps: Deps, options: Options, maxUsd: Decimal): Promise<number> {
  const { store, log } = deps;
  const counts = emptyCounts(false);
  const failures: Failure[] = [];
  const examples: Collected[] = [];
  const refused: Refused[] = [];
  return recorded(store, deps.now, counts, failures, async () => {
    const dataset = await store.dataset();
    if (dataset === null) throw new Refusal('no dataset is loaded; run `pnpm seed` first');
    const { work, plan } = await workOf(store, options, counts);
    if (plan.ceiling.usd.gt(maxUsd)) {
      throw new Refusal(`the ceiling ${dollars(plan.ceiling.usd)} is above --max-usd ${maxUsd.toString()}; nothing sent`);
    }
    const pending = await pendingBatches(store);
    if (work.send.length === 0 && pending.size === 0) {
      log(`explain: nothing to send; unchanged ${counts.unchanged}`);
      return 0;
    }
    const model = deps.model();
    for (const [batchId, items] of pending) await collect(deps, model, batchId, items, dataset, { counts, failures, examples, refused });
    const sample = options.selection.kind === 'sample';
    if (work.send.length > 0) {
      const batchId = await model.submit(work.send.map(({ orgnr, analysis }) => ({ orgnr, input: analysis.payload })));
      // Before any row is written: a stop here must not lose a paid batch. The id names no company.
      log(`explain: batch submitted, id ${batchId}, ${work.send.length} requests`);
      counts.sent = work.send.length;
      const at = deps.now();
      await store.write(
        work.send.map(({ orgnr, analysis }) => ({
          orgnr,
          status: 'pending',
          template: null,
          slot_ids: null,
          filing_year: analysis.filingYear,
          analysis_digest: analysis.digest,
          prompt_hash: PROMPT.promptHash,
          model_id: PROMPT.modelId,
          dataset,
          sample,
          batch_id: batchId,
          generated_at: at,
        })),
      );
      const items = new Map(
        work.send.map(({ orgnr, analysis }) => [
          orgnr,
          { analysis, digest: analysis.digest, filingYear: analysis.filingYear, ...PROMPT, sample } satisfies Pending,
        ]),
      );
      await collect(deps, model, batchId, items, dataset, { counts, failures, examples, refused });
    }
    log(`explain: sent ${counts.sent}; explained ${counts.explained}; failed ${counts.failed} (${tally(counts.failure_reasons)}); unchanged ${counts.unchanged}`);
    log(`explain: ${counts.input_tokens} tokens in, ${counts.output_tokens} tokens out, thinking included`);
    // A sample's report shows a few texts as a reader would see them; never its orgnrs.
    if (sample) for (const example of examples.slice(0, SAMPLE_EXAMPLES)) log(`explain: example: ${example.filled}`);
    // And every refused text with its reason, so a sample explains itself; on one line, as the model wrote it.
    if (sample) for (const entry of refused) log(`explain: refused (${entry.reason}): ${JSON.stringify(entry.text)}`);
    return counts.failed > 0 ? 1 : 0;
  });
}

/**
 * Test mode (AGENTS.md "Peerless runs without our keys"): a model client
 * that answers from stored batch responses, keyed by custom_id, through the
 * real client's reduction (`toBatchResult`). A request with no stored
 * response gets no result.
 */
export function storedResponses(
  entries: readonly unknown[],
): ModelClient<ExplanationPayload> & { readonly submitted: readonly (readonly BatchRequest<ExplanationPayload>[])[] } {
  const byOrgnr = new Map(
    entries.map((entry) => {
      const id = (entry as { custom_id?: unknown }).custom_id;
      if (typeof id !== 'string') throw new TypeError('a stored response has no custom_id');
      return [id, entry as Parameters<typeof toBatchResult>[0]];
    }),
  );
  const submitted: BatchRequest<ExplanationPayload>[][] = [];
  return {
    submitted,
    submit(requests) {
      submitted.push([...requests]);
      return Promise.resolve(`stored-batch-${submitted.length}`);
    },
    ended: () => Promise.resolve(true),
    async *results(batchId) {
      await Promise.resolve();
      const requests = submitted[Number(batchId.replace('stored-batch-', '')) - 1] ?? [];
      for (const request of requests) {
        const entry = byOrgnr.get(request.orgnr);
        if (entry !== undefined) yield toBatchResult(entry);
      }
    },
  };
}

/** The wordings --plan names, for a test that reads them. */
export const WORDING_TEXTS = {
  direction: WORDINGS.direction.map((id) => t(id)),
  rank: WORDINGS.rank.map((id) => t(id)),
};
