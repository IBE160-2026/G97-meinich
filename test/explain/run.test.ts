// A pnpm explain run against stored model responses and an in-memory store
// (Story 4.1), so no test needs a key and none reaches the network. The
// analyses are demo A's default analysis from the committed seed, stored
// under invented orgnrs; no labelled-set orgnr appears.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseArgs } from '../../scripts/explain.ts';
import { type ModelClient, NoModelKey, createModelClient, toBatchResult } from '../../scripts/classify/model-client.ts';
import { MODEL_ID, MAX_TOKENS, REQUEST_SETTINGS, SYSTEM_PROMPT, parseTemplate, promptHash, requestParams } from '../../scripts/explain/request.ts';
import {
  type Computed,
  type Counts,
  type ExplanationRow,
  type Failure,
  type Options,
  Refusal,
  type Store,
  type StoredExplanation,
  planLines,
  runExplain,
  storedResponses,
} from '../../scripts/explain/run.ts';
import { SLOT_FIELD_MEANINGS, defaultAnalysis, type ExplanationAnalysis, type ExplanationPayload } from '../../src/analysis/explanation-payload.ts';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { digest } from '../../src/engine/digest.ts';
import { narrow } from '../narrow.ts';
import { seedInput } from './seed-analysis.ts';

const AT = new Date('2026-11-27T12:00:00Z');
const [GOOD, DIGIT, UNKNOWN, TRUNCATED] = ['100000001', '100000002', '100000003', '100000004'] as const;
const RESPONSES: unknown[] = JSON.parse(readFileSync(path.join(import.meta.dirname, '../fixtures/explain/responses.json'), 'utf8'));
const CAP = new Decimal(10);
const MARKER = 'sk-ant-test-marker-never-printed';

const demoA = (() => {
  const input = seedInput(DEMO_COMPANIES[0].orgnr);
  return narrow(defaultAnalysis(input.funnel, input.filing, input.candidates), 'analysis').analysis;
})();

type Run = { counts?: Counts; failures?: readonly Failure[]; error?: string | null };

function fakeStore(computed: Readonly<Record<string, Computed>>, dataset: 'demo' | 'full' | null = 'demo') {
  const rows = new Map<string, ExplanationRow>();
  const runs: Run[] = [];
  let started = 0;
  const store: Store = {
    subjects: () => Promise.resolve(Object.keys(computed).sort()),
    analysis: (orgnr) => {
      const found = computed[orgnr];
      if (found === undefined) throw new Error('no such subject');
      return Promise.resolve(found);
    },
    dataset: () => Promise.resolve(dataset),
    stored: () => Promise.resolve([...rows.values()] as StoredExplanation[]),
    write: (written) => {
      for (const row of written) rows.set(row.orgnr, row);
      return Promise.resolve();
    },
    startRun: () => {
      started += 1;
      runs.push({});
      return Promise.resolve(String(started));
    },
    endRun: (id, _at, result) => {
      Object.assign(runs[Number(id) - 1] ?? {}, result);
      return Promise.resolve();
    },
  };
  return { store, rows, runs };
}

const explaining = (analysis: ExplanationAnalysis = demoA): Computed => ({ kind: 'analysis', analysis });
const ALL: Options = { selection: { kind: 'all' }, labelled: () => new Set() };

function deps(store: Store, model: () => ModelClient<ExplanationPayload>, log: (line: string) => void = () => {}) {
  return { store, model, now: () => AT, sleep: () => Promise.resolve(), log };
}

/** A stored row as a run would have written it for demo A's analysis. */
function storedRow(orgnr: string, status: ExplanationRow['status'], overrides: Partial<ExplanationRow> = {}): ExplanationRow {
  return {
    orgnr,
    status,
    template: status === 'explained' ? 'Driftsmarginen er {{driftsmargin.egen}}.' : null,
    slot_ids: status === 'explained' ? ['driftsmargin.egen'] : null,
    filing_year: 2025,
    analysis_digest: demoA.digest,
    prompt_hash: promptHash(),
    model_id: MODEL_ID,
    dataset: 'demo',
    sample: false,
    batch_id: status === 'pending' ? 'left-batch' : null,
    generated_at: AT,
    ...overrides,
  };
}

/**
 * The stored-responses client, also answering a batch an earlier run left
 * pending (`left-batch`) from the stored responses of `orgnrs`.
 */
function resuming(orgnrs: readonly string[]) {
  const model = storedResponses(RESPONSES);
  const left = RESPONSES.filter((entry) => orgnrs.includes((entry as { custom_id: string }).custom_id));
  return {
    ...model,
    async *results(batchId: string) {
      if (batchId !== 'left-batch') {
        yield* model.results(batchId);
        return;
      }
      await Promise.resolve();
      for (const entry of left) yield toBatchResult(entry as Parameters<typeof toBatchResult>[0]);
    },
  };
}

const noModel = () => {
  throw new Error('the model was reached');
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('a run', () => {
  it('runs from stored responses without a key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { store, rows } = fakeStore({ [GOOD]: explaining() });
    const model = storedResponses(RESPONSES);
    expect(await runExplain(deps(store, () => model), ALL, CAP)).toBe(0);
    expect(rows.get(GOOD)).toMatchObject({ status: 'explained', batch_id: null, sample: false });
    expect(rows.get(GOOD)?.slot_ids).toEqual([
      'aar',
      'driftsmargin.egen',
      'driftsmargin.retning',
      'driftsmargin.median',
      'driftsmargin.gap',
      'arbeidskapital.rang',
      'arbeidskapital.gap',
      'vare.egen',
      'vare.plassering',
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stores the model, the hash of the prompt sent and the dataset', async () => {
    const { store, rows } = fakeStore({ [GOOD]: explaining() }, 'full');
    const model = storedResponses(RESPONSES);
    await runExplain(deps(store, () => model), ALL, CAP);
    const sent = model.submitted.flat();
    expect(sent).toHaveLength(1);
    const request = sent[0];
    if (request === undefined) throw new Error('nothing was sent');
    const params = requestParams(request.input);
    const { model: modelId, system, messages, ...settings } = params;
    expect(messages).toEqual([{ role: 'user', content: JSON.stringify(demoA.payload) }]);
    expect(modelId).toBe('claude-haiku-5-5');
    const row = rows.get(GOOD);
    expect(row?.model_id).toBe('claude-haiku-5-5');
    const { slot_fields } = JSON.parse(String(messages[0]?.content)) as { slot_fields: unknown };
    expect(row?.prompt_hash).toBe(digest({ system, settings, slot_fields } as never));
    expect(row?.dataset).toBe('full');
    expect(row?.analysis_digest).toBe(demoA.digest);
    expect(row?.filing_year).toBe(2025);
  });

  it('a digit outside a slot is not stored', async () => {
    const { store, rows, runs } = fakeStore({ [DIGIT]: explaining() });
    expect(await runExplain(deps(store, () => storedResponses(RESPONSES)), ALL, CAP)).toBe(1);
    expect(rows.get(DIGIT)).toMatchObject({ status: 'failed', template: null, slot_ids: null });
    expect(runs[0]?.failures).toEqual([{ orgnr: DIGIT, reason: 'digit_outside_slot' }]);
    expect(runs[0]?.counts?.failure_reasons).toEqual({ digit_outside_slot: 1 });
  });

  it('a sample run prints each refused text with its reason, stores no text and shows no orgnr', async () => {
    const stored = RESPONSES.find((entry) => (entry as { custom_id?: unknown }).custom_id === DIGIT) as
      | { result: { message: { content: { type: string; text: string }[] } } }
      | undefined;
    const text = stored?.result.message.content.find((part) => part.type === 'text')?.text;
    expect(text).toMatch(/\d/);
    const sample: Options = { selection: { kind: 'sample', size: 1 }, labelled: () => new Set() };
    const run = async (options: Options) => {
      const { store, rows, runs } = fakeStore({ [DIGIT]: explaining() });
      const lines: string[] = [];
      expect(await runExplain(deps(store, () => storedResponses(RESPONSES), (line) => lines.push(line)), options, CAP)).toBe(1);
      return { lines, row: rows.get(DIGIT), run: runs[0] };
    };

    const drawn = await run(sample);
    expect(drawn.lines.filter((line) => line.startsWith('explain: refused'))).toEqual([
      `explain: refused (digit_outside_slot): ${JSON.stringify(text)}`,
    ]);
    expect(drawn.lines.filter((line) => line.includes(DIGIT))).toEqual([]);
    expect(drawn.row).toMatchObject({ status: 'failed', template: null, slot_ids: null });
    expect(JSON.stringify(drawn.run)).not.toContain(JSON.stringify(text).slice(1, -1));

    // A full run prints no refused text: only a sample explains itself.
    const full = await run(ALL);
    expect(full.lines.filter((line) => line.startsWith('explain: refused'))).toEqual([]);
  });

  it('an unknown slot is not stored', async () => {
    const { store, rows, runs } = fakeStore({ [UNKNOWN]: explaining() });
    expect(await runExplain(deps(store, () => storedResponses(RESPONSES)), ALL, CAP)).toBe(1);
    expect(rows.get(UNKNOWN)).toMatchObject({ status: 'failed', template: null });
    expect(runs[0]?.failures).toEqual([{ orgnr: UNKNOWN, reason: 'unknown_slot' }]);
  });

  it("counts a failed response's tokens", async () => {
    const { store, rows, runs } = fakeStore({ [TRUNCATED]: explaining() });
    expect(await runExplain(deps(store, () => storedResponses(RESPONSES)), ALL, CAP)).toBe(1);
    expect(rows.get(TRUNCATED)?.status).toBe('failed');
    expect(runs[0]?.failures).toEqual([{ orgnr: TRUNCATED, reason: 'stop_max_tokens' }]);
    expect(runs[0]?.counts?.input_tokens).toBe(1800);
    expect(runs[0]?.counts?.output_tokens).toBe(1000);
  });

  it('an empty group makes no call and is counted by reason', async () => {
    const { store, rows, runs } = fakeStore({
      '100000005': { kind: 'empty', reason: 'subject_no_revenue' },
      '100000006': { kind: 'empty', reason: 'subject_no_revenue' },
      '100000007': { kind: 'empty', reason: null },
      '100000008': { kind: 'no_peer_group' },
    });
    expect(await runExplain(deps(store, noModel), ALL, CAP)).toBe(0);
    expect(rows.size).toBe(0);
    expect(runs[0]?.counts).toMatchObject({
      subjects: 4,
      with_peer_group: 0,
      empty: { subject_no_revenue: 2, no_reason: 1 },
      no_peer_group: 1,
      sent: 0,
    });
    expect(runs[0]?.error).toBeNull();
  });

  it('refuses above --max-usd', async () => {
    const { store, rows, runs } = fakeStore({ [GOOD]: explaining() });
    const model = storedResponses(RESPONSES);
    await expect(runExplain(deps(store, () => model), ALL, new Decimal('0.000001'))).rejects.toBeInstanceOf(Refusal);
    expect(model.submitted).toEqual([]);
    expect(rows.size).toBe(0);
    expect(runs[0]?.error).toMatch(/above --max-usd/);
  });

  it('a sample is drawn outside the labelled set', async () => {
    const subjects = Object.fromEntries(['100000001', '100000002', '100000003', '100000004', '100000005', '100000006'].map((o) => [o, explaining()]));
    const labelled = new Set(['100000001', '100000003', '100000005']);
    const { store, rows } = fakeStore(subjects);
    const model = storedResponses([]);
    await runExplain(deps(store, () => model), { selection: { kind: 'sample', size: 2 }, labelled: () => labelled }, CAP);
    const sent = model.submitted.flat().map((request) => request.orgnr);
    expect(sent).toHaveLength(2);
    expect(sent.filter((orgnr) => labelled.has(orgnr))).toEqual([]);
    expect([...rows.values()].map((row) => row.sample)).toEqual([true, true]);
  });

  it('an explained row under the same digest, model and prompt is not sent again', async () => {
    const { store, rows, runs } = fakeStore({ [GOOD]: explaining() });
    rows.set(GOOD, storedRow(GOOD, 'explained'));
    expect(await runExplain(deps(store, noModel), ALL, CAP)).toBe(0);
    expect(runs[0]?.counts).toMatchObject({ sent: 0, unchanged: 1 });
    expect(rows.get(GOOD)?.template).toBe('Driftsmarginen er {{driftsmargin.egen}}.');
  });

  it("a sample's explained row is sent again by a full run", async () => {
    const { store, rows, runs } = fakeStore({ [GOOD]: explaining() });
    rows.set(GOOD, storedRow(GOOD, 'explained', { sample: true }));
    const model = storedResponses(RESPONSES);
    await runExplain(deps(store, () => model), ALL, CAP);
    expect(model.submitted.flat().map((request) => request.orgnr)).toEqual([GOOD]);
    expect(runs[0]?.counts).toMatchObject({ sent: 1, unchanged: 0 });
    expect(rows.get(GOOD)?.sample).toBe(false);
  });

  it('a pending row is not sent again', async () => {
    const { store, rows, runs } = fakeStore({ [GOOD]: explaining() });
    rows.set(GOOD, storedRow(GOOD, 'pending'));
    const model = resuming([]);
    await runExplain(deps(store, () => model), ALL, CAP);
    expect(model.submitted).toEqual([]);
    expect(runs[0]?.counts).toMatchObject({ sent: 0, pending: 1 });
  });

  it('writes a sent row pending before it waits for the batch', async () => {
    const { store, rows } = fakeStore({ [GOOD]: explaining() });
    const model = storedResponses(RESPONSES);
    const statuses: (string | undefined)[] = [];
    await runExplain(deps(store, () => ({ ...model, ended: () => (statuses.push(rows.get(GOOD)?.status), Promise.resolve(true)) })), ALL, CAP);
    expect(statuses).toEqual(['pending']);
  });
});

describe('the run record', () => {
  it('--plan writes one run record', async () => {
    const { store, rows, runs } = fakeStore({ [GOOD]: explaining(), '100000005': { kind: 'empty', reason: 'subject_currency' } });
    const lines = await planLines(store, ALL, () => AT);
    expect(lines.join('\n')).toMatch(/would send 1;/);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.counts).toMatchObject({ plan: true, subjects: 2, with_peer_group: 1, empty: { subject_currency: 1 }, sent: 0 });
    expect(runs[0]?.error).toBeNull();
    expect(rows.size).toBe(0);
  });

  it('a run writes one run record', async () => {
    const { store, runs } = fakeStore({ [GOOD]: explaining() });
    await runExplain(deps(store, () => storedResponses(RESPONSES)), ALL, CAP);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.counts).toMatchObject({ plan: false, sent: 1, explained: 1, failed: 0 });
    expect(runs[0]?.error).toBeNull();
  });

  it('a refused run still writes its run record', async () => {
    const { store, runs } = fakeStore({ [GOOD]: explaining() }, null);
    await expect(runExplain(deps(store, noModel), ALL, CAP)).rejects.toBeInstanceOf(Refusal);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.error).toBe('Error: no dataset is loaded; run `pnpm seed` first');
  });
});

describe('the plan', () => {
  it('--plan prints the count per wording', async () => {
    // Demo A: driftsmargin and lgd over the median, kfd, vare and andre under it, oml over it; three ranked capital gaps.
    const { store } = fakeStore({ [GOOD]: explaining(), [DIGIT]: explaining() });
    const lines = await planLines(store, ALL, () => AT);
    expect(lines).toContain('  direction words: «over medianen» 6, «under medianen» 6, «lik medianen» 0');
    expect(lines).toContain('  rank words: «det største kapitalgapet» 2, «nest største kapitalgapet» 2, «tredje største kapitalgapet» 2');
  });

  it('names no company', async () => {
    const { store } = fakeStore({ [GOOD]: explaining() });
    expect((await planLines(store, ALL, () => AT)).join('\n')).not.toContain(GOOD);
  });
});

describe('the key', () => {
  it('a real run without a key is refused and sends nothing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const empty = mkdtempSync(path.join(tmpdir(), 'explain-'));
    try {
      const { store, rows, runs } = fakeStore({ [GOOD]: explaining() });
      await expect(runExplain(deps(store, () => createModelClient(empty, requestParams)), ALL, CAP)).rejects.toBeInstanceOf(NoModelKey);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(rows.size).toBe(0);
      expect(runs[0]?.error).toMatch(/^Error: ANTHROPIC_API_KEY is not set/);
    } finally {
      rmSync(empty, { recursive: true });
    }
  });

  it('the key is never printed or recorded', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', MARKER);
    const lines: string[] = [];
    const { store, rows, runs } = fakeStore({ [GOOD]: explaining(), [DIGIT]: explaining() });
    lines.push(...(await planLines(store, ALL, () => AT)));
    await runExplain(deps(store, () => storedResponses(RESPONSES), (line) => lines.push(line)), ALL, CAP);
    expect(lines).not.toHaveLength(0);
    expect(runs).toHaveLength(2);
    const written = JSON.stringify({ lines, runs, rows: [...rows.values()] });
    expect(written).not.toContain(MARKER);
    expect(written).not.toContain('sk-ant');
  });

  it('a real run needs --max-usd; --plan does not', () => {
    expect(() => parseArgs(['--sample', '20'])).toThrow(/--max-usd/);
    expect(parseArgs(['--plan', '--sample', '20'])).toMatchObject({ plan: true, selection: { kind: 'sample', size: 20 } });
    expect(() => parseArgs(['--plan'])).toThrow(/exactly one/);
  });
});

describe('the request and the template', () => {
  it('sends the payload as JSON and nothing else about the company', () => {
    const params = requestParams(demoA.payload);
    expect(params.model).toBe(MODEL_ID);
    expect(params.max_tokens).toBe(MAX_TOKENS);
    expect(params.system).toBe(SYSTEM_PROMPT);
    expect(params.messages).toEqual([{ role: 'user', content: JSON.stringify(demoA.payload) }]);
    expect(promptHash()).toBe(digest({ system: SYSTEM_PROMPT, settings: REQUEST_SETTINGS, slot_fields: SLOT_FIELD_MEANINGS } as never));
  });

  it('a changed slot-field meaning changes the prompt hash', () => {
    expect(SLOT_FIELD_MEANINGS).not.toHaveLength(0);
    const changed = SLOT_FIELD_MEANINGS.map((entry, i) => (i === 0 ? { ...entry, meaning: `${entry.meaning} Endret.` } : entry));
    expect(promptHash(changed)).not.toBe(promptHash());
  });

  it.each([
    ['Marginen er 3,4 %.', 'digit_outside_slot'],
    ['Marginen er ٣ %.', 'digit_outside_slot'],
    ['Marginen er {{driftsmargin.foo}}.', 'unknown_slot'],
    ['Marginen er {{driftsmargin.egen}.', 'malformed_slot'],
    ['   ', 'empty_template'],
  ])('refuses %j as %s', (text, reason) => {
    expect(parseTemplate(text, demoA.slots)).toEqual({ kind: 'refused', reason });
  });

  // Sample run 185: «bedre enn bedre enn» in 12 of 20 templates (Meinich, 2026-11-27).
  it.each([
    ['Marginen er {{driftsmargin.egen}} % i år.', "the end of egen's text, «%», after it"],
    ['Marginen ligger {{driftsmargin.retning}} MEDIANEN.', 'the end of retning after it, in another case'],
    ['Marginen ligger {{driftsmargin.retning}} medianen.', 'the end of retning after it'],
    ['Marginen ligger {{driftsmargin.retning}} Medianen, og mer.', 'the same in another case, before a comma'],
    ['Det er {{antall}} sammenlignbare selskaper.', "the end of antall's page phrase after it"],
    ['Gapet er {{driftsmargin.gap}} kr per år.', 'kr after an amount'],
  ])('refuses %j as repeated_slot_words: %s', (text) => {
    expect(parseTemplate(text, demoA.slots)).toEqual({ kind: 'refused', reason: 'repeated_slot_words' });
  });

  // Sample run 193: a refusal across a full stop. The rule stays within the slot's sentence, both ways.
  it.each([
    ['Marginen ligger {{driftsmargin.retning}}. Medianen er {{driftsmargin.median}}.', 'a word after the full stop'],
    ['Det er målt mot medianen. {{driftsmargin.retning}} ligger marginen.', 'medianen before the full stop'],
    // Would repeat the rank's start «det» if the rule read across the full stop (the BMAD session's case).
    ['Slik er det. {{arbeidskapital.rang}} er arbeidskapitalen.', 'the start of rang before the full stop'],
    ['Er den {{driftsmargin.retning}}? Medianen er {{driftsmargin.median}}!', 'after a question mark'],
  ])('keeps %j: %s', (text) => {
    expect(parseTemplate(text, demoA.slots)).toMatchObject({ kind: 'template', template: text });
  });

  // Run 195: «bedre enn» before the placement in 10 of 20 although forbidden; the slot is now
  // only the percent, and the template must write «bedre enn» right before it (Meinich, 2026-11-27).
  it.each([
    ['Selskapet er bedre enn {{driftsmargin.plassering}} av gruppen.', 'template'],
    ['Selskapet er BEDRE Enn {{driftsmargin.plassering}}.', 'template'],
    ['Selskapet er blant de {{driftsmargin.plassering}} beste.', 'placement_without_bedre_enn'],
    ['Selskapet gjør det bedre enn. {{driftsmargin.plassering}} er plasseringen.', 'placement_without_bedre_enn'],
    ['{{driftsmargin.plassering}} er plasseringen.', 'placement_without_bedre_enn'],
    ['Bedre enn {{driftsmargin.plassering}}, men ikke {{vare.plassering}}.', 'placement_without_bedre_enn'],
  ])('a placement slot right after «bedre enn» in its sentence: %j gives %s', (text, kind) => {
    const parsed = parseTemplate(text, demoA.slots);
    expect(parsed.kind === 'template' ? 'template' : parsed.reason).toBe(kind);
  });

  it('keeps words beside a slot that do not repeat its own', () => {
    const text = 'Marginen ligger {{driftsmargin.retning}}, og selskapet er bedre enn {{driftsmargin.plassering}} av {{antall}}.';
    expect(parseTemplate(text, demoA.slots)).toEqual({
      kind: 'template',
      template: text,
      slotIds: ['driftsmargin.retning', 'driftsmargin.plassering', 'antall'],
    });
  });

  it('keeps a template that uses only slots, each id once in order of first use', () => {
    expect(parseTemplate(' {{aar}}: {{driftsmargin.egen}} og {{aar}}. ', demoA.slots)).toEqual({
      kind: 'template',
      template: '{{aar}}: {{driftsmargin.egen}} og {{aar}}.',
      slotIds: ['aar', 'driftsmargin.egen'],
    });
  });
});
