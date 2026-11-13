// What a pnpm classify run would do and cost (Story 2.6). Pure and without a
// key: `--plan` prints this, and a real run refuses when the ceiling is above
// its --max-usd. No token is counted by the API: the estimate rests on the
// characters of the real requests.
import { Decimal } from '../../src/engine/decimal.ts';
import { digest } from '../../src/engine/digest.ts';
import { MAX_TOKENS, SYSTEM_PROMPT, type RequestInput, type Target, hasText, requestInput, textDigest } from './request.ts';

/** Batch API, per million tokens. Read from the pricing page on PRICE_DATE. */
export const PRICE_PER_MTOK = { input: new Decimal('0.05'), output: new Decimal('0.25') };
export const PRICE_DATE = '2026-11-08';

const CENTRAL = { charsPerToken: '3.0', overhead: 300, output: 115 };
const HIGH = { charsPerToken: '2.2', overhead: 500, output: 1015 };

export type Estimate = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly usd: Decimal;
};

export type CostPlan = { readonly central: Estimate; readonly high: Estimate; readonly ceiling: Estimate };

function usd(inputTokens: number, outputTokens: number): Decimal {
  return new Decimal(inputTokens)
    .mul(PRICE_PER_MTOK.input)
    .add(new Decimal(outputTokens).mul(PRICE_PER_MTOK.output))
    .div(1_000_000);
}

function inputTokens(inputs: readonly RequestInput[], assumption: typeof CENTRAL): number {
  const chars = inputs.reduce((sum, input) => sum + SYSTEM_PROMPT.length + JSON.stringify(input).length, 0);
  return new Decimal(chars).div(assumption.charsPerToken).add(assumption.overhead * inputs.length).ceil().toNumber();
}

export function costPlan(inputs: readonly RequestInput[]): CostPlan {
  const central = inputTokens(inputs, CENTRAL);
  const high = inputTokens(inputs, HIGH);
  const outputs = {
    central: CENTRAL.output * inputs.length,
    high: HIGH.output * inputs.length,
    ceiling: MAX_TOKENS * inputs.length,
  };
  return {
    central: { inputTokens: central, outputTokens: outputs.central, usd: usd(central, outputs.central) },
    high: { inputTokens: high, outputTokens: outputs.high, usd: usd(high, outputs.high) },
    ceiling: { inputTokens: high, outputTokens: outputs.ceiling, usd: usd(high, outputs.ceiling) },
  };
}

/**
 * The sample: companies with text, never one of the labelled set, ordered by
 * a digest so the plan and the run draw the same ones.
 */
export function drawSample(targets: readonly Target[], labelled: ReadonlySet<string>, size: number): Target[] {
  return targets
    .filter((target) => hasText(target) && !labelled.has(target.orgnr))
    .map((target) => ({ target, key: digest(['peerless-2.6-sample', target.orgnr]) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(0, size)
    .map(({ target }) => target);
}

export type StoredRow = {
  readonly orgnr: string;
  readonly status: 'classified' | 'no_text' | 'failed' | 'pending';
  readonly text_digest: string;
  readonly model_id: string | null;
  readonly prompt_hash: string | null;
  readonly sample: boolean;
};

export type WorkItem = { readonly orgnr: string; readonly input: RequestInput; readonly textDigest: string };

export type Work = {
  readonly send: readonly WorkItem[];
  readonly noText: readonly WorkItem[];
  readonly unchanged: number;
  readonly stale: number;
  readonly pending: number;
};

export type WorkOptions = {
  readonly sample: boolean;
  readonly reclassifyStale: boolean;
  readonly modelId: string;
  readonly promptHash: string;
};

/** Which targets need the model, which have nothing to classify on, and which are left alone. */
export function decideWork(targets: readonly Target[], stored: readonly StoredRow[], options: WorkOptions): Work {
  const byOrgnr = new Map(stored.map((row) => [row.orgnr, row]));
  const send: WorkItem[] = [];
  const noText: WorkItem[] = [];
  let unchanged = 0;
  let stale = 0;
  let pending = 0;
  for (const target of targets) {
    const input = requestInput(target);
    const item = { orgnr: target.orgnr, input, textDigest: textDigest(input) };
    const row = byOrgnr.get(target.orgnr);
    if (row?.status === 'pending') {
      pending += 1;
    } else if (!hasText(target)) {
      if (row?.status === 'no_text' && row.text_digest === item.textDigest) unchanged += 1;
      else noText.push(item);
    } else if (row === undefined || row.status !== 'classified' || row.text_digest !== item.textDigest) {
      send.push(item);
    } else if (row.sample && !options.sample) {
      // A sample's answers never stand in a full run: they do not reach the seed.
      send.push(item);
    } else if (row.model_id !== options.modelId || row.prompt_hash !== options.promptHash) {
      if (options.reclassifyStale) send.push(item);
      else stale += 1;
    } else {
      unchanged += 1;
    }
  }
  return { send, noText, unchanged, stale, pending };
}
