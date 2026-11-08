// A pnpm classify run against a stubbed model and an in-memory store (Story
// 2.6), so no test needs a key. Invented companies only.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseArgs, readLabelled } from '../../scripts/classify.ts';
import { type BatchRequest, type BatchResult, type ModelClient, NoModelKey, createModelClient, toBatchResult } from '../../scripts/classify/model-client.ts';
import { type ClassificationRow, type Counts, type Failure, type Options, Refusal, type Store, planLines, runClassify } from '../../scripts/classify/run.ts';
import { MODEL_ID, type Target, promptHash, requestInput, textDigest } from '../../scripts/classify/request.ts';
import { Decimal } from '../../src/engine/decimal.ts';

const AT = new Date('2026-11-08T12:00:00Z');
const A = '100000001';
const B = '100000002';

const target = (orgnr: string, overrides: Partial<Target> = {}): Target => ({
  orgnr,
  navn: 'OPPDIKTET AS',
  naeringskode2: null,
  naeringskode3: null,
  aktivitet: 'Utvikling av programvare',
  vedtektsfestet_formaal: 'Drive konsulentvirksomhet',
  ...overrides,
});

type Row = ClassificationRow;

function fakeStore(targets: Target[], initial: Row[] = []) {
  const rows = new Map(initial.map((row) => [row.orgnr, row]));
  const run: { counts?: Counts; failures?: readonly Failure[]; error?: string | null } = {};
  const store: Store = {
    targets: () => Promise.resolve(targets),
    stored: () => Promise.resolve([...rows.values()]),
    write: (written) => {
      for (const row of written) rows.set(row.orgnr, row);
      return Promise.resolve();
    },
    startRun: () => Promise.resolve('1'),
    endRun: (_id, _at, result) => {
      Object.assign(run, result);
      return Promise.resolve();
    },
  };
  return { store, rows, run };
}

type Answering = (request: BatchRequest) => BatchResult['outcome'] | null;
const answers = (text: string): Answering => () => ({ kind: 'text', text, inputTokens: 10, outputTokens: 20 });

function stubModel(answering: Answering) {
  const submitted: BatchRequest[][] = [];
  const requests = new Map<string, readonly BatchRequest[]>();
  const model: ModelClient = {
    submit: (batch) => {
      submitted.push([...batch]);
      requests.set(`batch-${submitted.length}`, batch);
      return Promise.resolve(`batch-${submitted.length}`);
    },
    ended: () => Promise.resolve(true),
    async *results(batchId) {
      await Promise.resolve();
      for (const request of requests.get(batchId) ?? []) {
        const outcome = answering(request);
        if (outcome !== null) yield { orgnr: request.orgnr, outcome };
      }
    },
  };
  return { model, submitted, requests };
}

const ALL: Options = { selection: { kind: 'all' }, reclassifyStale: false, labelled: () => new Set() };
const CAP = new Decimal(10);

function deps(store: Store, model: ModelClient) {
  return { store, model, now: () => AT, sleep: () => Promise.resolve(), log: () => {} };
}

function stored(of: Target, overrides: Partial<Row> = {}): Row {
  return {
    orgnr: of.orgnr,
    status: 'classified',
    business_type: 'konsulent',
    text_digest: textDigest(requestInput(of)),
    model_id: MODEL_ID,
    prompt_hash: promptHash(),
    sample: false,
    batch_id: null,
    classified_at: AT,
    ...overrides,
  };
}

const KONSULENT = answers('{"business_type":"konsulent"}');

describe('a run', () => {
  it('stores the type, the model id, the prompt hash and the text digest', async () => {
    const { store, rows, run } = fakeStore([target(A)]);
    const { model } = stubModel(KONSULENT);
    expect(await runClassify(deps(store, model), ALL, CAP)).toBe(0);
    expect(rows.get(A)).toEqual(stored(target(A)));
    expect(run.counts?.classified.konsulent).toBe(1);
    expect(run.counts?.input_tokens).toBe(10);
    expect(run.error).toBeNull();
  });

  it('answer outside the set is failed, not coerced', async () => {
    const { store, rows, run } = fakeStore([target(A)]);
    const { model } = stubModel(answers('{"business_type":"saas"}'));
    expect(await runClassify(deps(store, model), ALL, CAP)).toBe(1);
    expect(rows.get(A)?.status).toBe('failed');
    expect(rows.get(A)?.business_type).toBeNull();
    expect(run.failures).toEqual([{ orgnr: A, reason: 'answer_outside_category_set' }]);
    expect(run.counts?.failed).toBe(1);
  });

  it('uklart is stored without a type and counted apart', async () => {
    const { store, rows, run } = fakeStore([target(A)]);
    const { model } = stubModel(answers('{"business_type":"uklart"}'));
    await runClassify(deps(store, model), ALL, CAP);
    expect(rows.get(A)).toMatchObject({ status: 'classified', business_type: null });
    expect(run.counts?.uklart).toBe(1);
    expect(Object.values(run.counts?.classified ?? {})).toEqual([0, 0, 0, 0]);
  });

  it('a request with no result is failed', async () => {
    const { store, rows, run } = fakeStore([target(A)]);
    const { model } = stubModel(() => null);
    await runClassify(deps(store, model), ALL, CAP);
    expect(rows.get(A)?.status).toBe('failed');
    expect(run.failures).toEqual([{ orgnr: A, reason: 'no_result_in_batch' }]);
  });

  it('unchanged text makes no model call', async () => {
    const { store, run } = fakeStore([target(A)], [stored(target(A))]);
    const { model, submitted } = stubModel(KONSULENT);
    await runClassify(deps(store, model), ALL, CAP);
    expect(submitted).toEqual([]);
    expect(run.counts?.unchanged).toBe(1);
  });

  it('changed text is reclassified', async () => {
    const { store } = fakeStore([target(A, { aktivitet: 'Ny tekst' })], [stored(target(A))]);
    const { model, submitted } = stubModel(KONSULENT);
    await runClassify(deps(store, model), ALL, CAP);
    expect(submitted.flat().map((request) => request.orgnr)).toEqual([A]);
  });

  it('a failed row is tried again', async () => {
    const { store } = fakeStore([target(A)], [stored(target(A), { status: 'failed', business_type: null })]);
    const { model, submitted } = stubModel(KONSULENT);
    await runClassify(deps(store, model), ALL, CAP);
    expect(submitted.flat()).toHaveLength(1);
  });

  it('a changed prompt is not reclassified without the flag', async () => {
    const old = stored(target(A), { prompt_hash: 'a'.repeat(64) });
    const without = fakeStore([target(A)], [old]);
    const first = stubModel(KONSULENT);
    await runClassify(deps(without.store, first.model), ALL, CAP);
    expect(first.submitted).toEqual([]);
    expect(without.run.counts?.stale).toBe(1);

    const withFlag = fakeStore([target(A)], [old]);
    const second = stubModel(KONSULENT);
    await runClassify(deps(withFlag.store, second.model), { ...ALL, reclassifyStale: true }, CAP);
    expect(second.submitted.flat()).toHaveLength(1);
  });

  it('no_text makes no call', async () => {
    const empty = target(A, { aktivitet: null, vedtektsfestet_formaal: null });
    const { store, rows, run } = fakeStore([empty, target(B)]);
    const { model, submitted } = stubModel(KONSULENT);
    await runClassify(deps(store, model), ALL, CAP);
    expect(submitted.flat().map((request) => request.orgnr)).toEqual([B]);
    expect(rows.get(A)).toMatchObject({ status: 'no_text', business_type: null, model_id: null });
    expect(run.counts?.no_text).toBe(1);
  });

  it('refuses when no covered AS has text, storing nothing', async () => {
    const { store, rows } = fakeStore([target(A, { aktivitet: null, vedtektsfestet_formaal: null })]);
    const { model, submitted } = stubModel(KONSULENT);
    await expect(runClassify(deps(store, model), ALL, CAP)).rejects.toThrow(/no covered AS has register text/);
    expect(submitted).toEqual([]);
    expect(rows.size).toBe(0);
  });

  it('refuses above the cap with nothing sent and the refusal in the run record', async () => {
    const { store, rows, run } = fakeStore([target(A)]);
    const { model, submitted } = stubModel(KONSULENT);
    await expect(runClassify(deps(store, model), ALL, new Decimal('0.0001'))).rejects.toBeInstanceOf(Refusal);
    expect(submitted).toEqual([]);
    expect(rows.size).toBe(0);
    expect(run.error).toMatch(/above --max-usd/);
  });

  it('marks a submitted row pending before it waits', async () => {
    const { store, rows } = fakeStore([target(A)]);
    const { model } = stubModel(KONSULENT);
    const statuses: (string | undefined)[] = [];
    await runClassify(
      { ...deps(store, { ...model, ended: () => (statuses.push(rows.get(A)?.status), Promise.resolve(true)) }) },
      ALL,
      CAP,
    );
    expect(statuses).toEqual(['pending']);
  });

  it('collects a batch an interrupted run left, without sending it again', async () => {
    const left = stored(target(A), { status: 'pending', business_type: null, batch_id: 'batch-1' });
    const { store, rows } = fakeStore([target(A)], [left]);
    const stub = stubModel(KONSULENT);
    stub.requests.set('batch-1', [{ orgnr: A, input: requestInput(target(A)) }]);
    await runClassify(deps(store, stub.model), ALL, CAP);
    expect(stub.submitted).toEqual([]);
    expect(rows.get(A)).toMatchObject({ status: 'classified', business_type: 'konsulent', batch_id: null });
  });

  it('marks sample rows, and a full run classifies them again', async () => {
    const sample: Options = { ...ALL, selection: { kind: 'sample', size: 1 } };
    const { store, rows } = fakeStore([target(A)]);
    const stub = stubModel(KONSULENT);
    await runClassify(deps(store, stub.model), sample, CAP);
    expect(rows.get(A)?.sample).toBe(true);
    await runClassify(deps(store, stub.model), ALL, CAP);
    expect(stub.submitted).toHaveLength(2);
    expect(rows.get(A)?.sample).toBe(false);
  });
});

describe('the plan', () => {
  it('sends nothing and writes nothing', async () => {
    const { store, rows } = fakeStore([target(A)]);
    const lines = await planLines(store, ALL);
    expect(lines.join('\n')).toMatch(/would send 1;/);
    expect(rows.size).toBe(0);
  });

  it('names no company', async () => {
    const { store } = fakeStore([target(A)]);
    expect((await planLines(store, ALL)).join('\n')).not.toContain(A);
  });
});

describe('the batch result', () => {
  const message = (stop_reason: string, content: unknown[] = [{ type: 'text', text: '{}' }]) =>
    ({ custom_id: A, result: { type: 'succeeded', message: { stop_reason, content, usage: { input_tokens: 1, output_tokens: 2 } } } }) as never;

  it('refusal, truncation and errored are failed', () => {
    expect(toBatchResult(message('refusal')).outcome).toEqual({ kind: 'failed', reason: 'stop_refusal' });
    expect(toBatchResult(message('max_tokens')).outcome).toEqual({ kind: 'failed', reason: 'stop_max_tokens' });
    for (const type of ['errored', 'expired', 'canceled']) {
      expect(toBatchResult({ custom_id: A, result: { type } } as never).outcome).toEqual({ kind: 'failed', reason: `batch_${type}` });
    }
  });

  it('skips the thinking block and reads the text', () => {
    const result = toBatchResult(message('end_turn', [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'svar' }]));
    expect(result.outcome).toEqual({ kind: 'text', text: 'svar', inputTokens: 1, outputTokens: 2 });
  });

  it('a message with no text is failed', () => {
    expect(toBatchResult(message('end_turn', [])).outcome).toEqual({ kind: 'failed', reason: 'no_text_block' });
  });
});

describe('the arguments and the key', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('a real run without a key refuses', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const empty = mkdtempSync(path.join(tmpdir(), 'classify-'));
    try {
      expect(() => createModelClient(empty)).toThrow(NoModelKey);
    } finally {
      rmSync(empty, { recursive: true });
    }
  });

  it('a real run needs --max-usd; --plan does not', () => {
    expect(() => parseArgs(['--sample', '300'])).toThrow(/--max-usd/);
    expect(parseArgs(['--plan', '--sample', '300']).plan).toBe(true);
  });

  it('takes exactly one of --sample and --all', () => {
    expect(() => parseArgs(['--plan'])).toThrow(/exactly one/);
    expect(() => parseArgs(['--plan', '--all', '--sample', '1'])).toThrow(/exactly one/);
    expect(() => parseArgs(['--plan', '--include-labelled', '--all'])).toThrow(/unknown argument/);
  });

  it('refuses a sample when the labelled list cannot be read', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'classify-'));
    try {
      expect(() => readLabelled(empty)).toThrow();
    } finally {
      rmSync(empty, { recursive: true });
    }
  });
});
