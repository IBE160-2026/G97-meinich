// What a pnpm explain run would do and cost (Story 4.1). Pure and without
// a key: `--plan` prints this, and a real run refuses when the ceiling is
// above its --max-usd. No token is counted by the API: the estimate rests
// on the characters of the real requests, as classify's does.
import type { ExplanationAnalysis } from '../../src/analysis/explanation-payload.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { digest } from '../../src/engine/digest.ts';
import type { EmptyReason } from '../../src/engine/peers.ts';
import { t } from '../../src/messages/index.ts';
import { PRICE_PER_MTOK } from '../classify/plan.ts';
import { MAX_TOKENS, SYSTEM_PROMPT } from './request.ts';

export { PRICE_DATE, PRICE_PER_MTOK } from '../classify/plan.ts';

// Norwegian text and JSON keys run fewer characters per token than
// classify's register text; the output is two to four sentences.
const CENTRAL = { charsPerToken: '2.5', overhead: 300, output: 250 };
const HIGH = { charsPerToken: '2.0', overhead: 500, output: 600 };

export type Estimate = { readonly inputTokens: number; readonly outputTokens: number; readonly usd: Decimal };
export type CostPlan = { readonly central: Estimate; readonly high: Estimate; readonly ceiling: Estimate };

function usd(inputTokens: number, outputTokens: number): Decimal {
  return new Decimal(inputTokens)
    .mul(PRICE_PER_MTOK.input)
    .add(new Decimal(outputTokens).mul(PRICE_PER_MTOK.output))
    .div(1_000_000);
}

function inputTokens(analyses: readonly ExplanationAnalysis[], assumption: typeof CENTRAL): number {
  const chars = analyses.reduce((sum, analysis) => sum + SYSTEM_PROMPT.length + JSON.stringify(analysis.payload).length, 0);
  return new Decimal(chars).div(assumption.charsPerToken).add(assumption.overhead * analyses.length).ceil().toNumber();
}

/** The central and high estimates, and the ceiling: high input plus MAX_TOKENS of output on every request. */
export function costPlan(analyses: readonly ExplanationAnalysis[]): CostPlan {
  const central = inputTokens(analyses, CENTRAL);
  const high = inputTokens(analyses, HIGH);
  const outputs = { central: CENTRAL.output * analyses.length, high: HIGH.output * analyses.length, ceiling: MAX_TOKENS * analyses.length };
  return {
    central: { inputTokens: central, outputTokens: outputs.central, usd: usd(central, outputs.central) },
    high: { inputTokens: high, outputTokens: outputs.high, usd: usd(high, outputs.high) },
    ceiling: { inputTokens: high, outputTokens: outputs.ceiling, usd: usd(high, outputs.ceiling) },
  };
}

/**
 * The order a sample is drawn in: every subject outside the labelled set,
 * by a digest, so the plan and the run draw the same ones. The caller takes
 * from it until it has `size` subjects with a peer group.
 */
export function sampleOrder(subjects: readonly string[], labelled: ReadonlySet<string>): string[] {
  return subjects
    .filter((orgnr) => !labelled.has(orgnr))
    .map((orgnr) => ({ orgnr, key: digest(['peerless-4.1-sample', orgnr]) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map(({ orgnr }) => orgnr);
}

/** The key under which an empty group is counted: its EmptyReason, or `no_reason` when no stage gave one. */
export const emptyKey = (reason: EmptyReason): string => reason ?? 'no_reason';

/** The slot words whose counts --plan prints (decision on slot words). */
export const WORDINGS = {
  direction: ['explanation.direction.above', 'explanation.direction.below', 'explanation.direction.equal'],
  rank: ['explanation.rank.1', 'explanation.rank.2', 'explanation.rank.3'],
} as const;

export type WordingCounts = { readonly direction: Record<string, number>; readonly rank: Record<string, number> };

/** How often each direction and rank word is a slot's text over `analyses`, every word listed, zero included. */
export function wordingCounts(analyses: readonly ExplanationAnalysis[]): WordingCounts {
  const direction = Object.fromEntries(WORDINGS.direction.map((id) => [t(id), 0]));
  const rank = Object.fromEntries(WORDINGS.rank.map((id) => [t(id), 0]));
  for (const analysis of analyses) {
    for (const slot of analysis.slots) {
      const counts = slot.id.endsWith('.retning') ? direction : slot.id.endsWith('.rang') ? rank : null;
      if (counts === null) continue;
      if (!(slot.text in counts)) throw new Error(`a slot word outside the wordings: ${slot.text}`);
      counts[slot.text] = (counts[slot.text] ?? 0) + 1;
    }
  }
  return { direction, rank };
}

export type StoredRow = {
  readonly orgnr: string;
  readonly status: 'explained' | 'failed' | 'pending';
  readonly analysis_digest: string;
  readonly model_id: string;
  readonly prompt_hash: string;
  readonly sample: boolean;
  readonly batch_id: string | null;
};

export type WorkItem = { readonly orgnr: string; readonly analysis: ExplanationAnalysis };

export type Work = { readonly send: readonly WorkItem[]; readonly unchanged: number; readonly pending: number };

/**
 * Which analyses need the model: every one without an explained row under
 * the same digest, model and prompt. A sample's row never stands in a full
 * run (it is never exported), and a pending row is left to its batch.
 */
export function decideWork(
  items: readonly WorkItem[],
  stored: readonly StoredRow[],
  options: { readonly sample: boolean; readonly modelId: string; readonly promptHash: string },
): Work {
  const byOrgnr = new Map(stored.map((row) => [row.orgnr, row]));
  const send: WorkItem[] = [];
  let unchanged = 0;
  let pending = 0;
  for (const item of items) {
    const row = byOrgnr.get(item.orgnr);
    if (row?.status === 'pending') pending += 1;
    else if (
      row?.status === 'explained' &&
      row.analysis_digest === item.analysis.digest &&
      row.model_id === options.modelId &&
      row.prompt_hash === options.promptHash &&
      (options.sample || !row.sample)
    ) {
      unchanged += 1;
    } else send.push(item);
  }
  return { send, unchanged, pending };
}
