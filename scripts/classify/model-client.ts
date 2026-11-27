// The one module that names the model key or imports the SDK (Story 2.6;
// AD-19; test/classify/key-boundary.test.ts). The key comes from the
// environment, then .env, and is never logged.
//
// Story 4.1: generic over what a request carries. Each step passes its own
// `params` function (classify's and explain's request.ts), so pnpm explain
// reaches the model through this file too. A failed outcome carries the
// usage of a response that was billed (a message that stopped on
// `max_tokens` or `refusal`, or has no text block), so the run's token
// counts include it (deferred-work entry from the review of PR #54).
import Anthropic from '@anthropic-ai/sdk';
import { setting } from '../run-ingest.ts';

export type BatchRequest<I = unknown> = { readonly orgnr: string; readonly input: I };

/** The tokens a response was billed for. */
export type Usage = { readonly inputTokens: number; readonly outputTokens: number };

/** One company's result, reduced to what step 2 stores. */
export type BatchResult = {
  readonly orgnr: string;
  readonly outcome:
    | { readonly kind: 'text'; readonly text: string; readonly inputTokens: number; readonly outputTokens: number }
    /** `usage` is null when no message came back (errored, expired, canceled): nothing was billed. */
    | { readonly kind: 'failed'; readonly reason: string; readonly usage: Usage | null };
};

export interface ModelClient<I = unknown> {
  /** Submits the batch and returns its id. */
  submit(requests: readonly BatchRequest<I>[]): Promise<string>;
  /** Whether the batch has ended. */
  ended(batchId: string): Promise<boolean>;
  results(batchId: string): AsyncIterable<BatchResult>;
}

/** The body of one request in a batch, as a step's request.ts builds it. */
export type RequestParams = Anthropic.Messages.MessageCreateParamsNonStreaming;

export class NoModelKey extends Error {}

/** One entry of a batch's results, reduced. Anything but a finished text is failed, with its reason and its usage. */
export function toBatchResult(entry: Anthropic.Messages.MessageBatchIndividualResponse): BatchResult {
  const orgnr = entry.custom_id;
  if (entry.result.type !== 'succeeded') {
    return { orgnr, outcome: { kind: 'failed', reason: `batch_${entry.result.type}`, usage: null } };
  }
  const { message } = entry.result;
  const usage: Usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
  if (message.stop_reason !== 'end_turn') {
    return { orgnr, outcome: { kind: 'failed', reason: `stop_${message.stop_reason ?? 'none'}`, usage } };
  }
  const block = message.content.find((part) => part.type === 'text');
  if (block === undefined) return { orgnr, outcome: { kind: 'failed', reason: 'no_text_block', usage } };
  return { orgnr, outcome: { kind: 'text', text: block.text, ...usage } };
}

/** The real client. Throws NoModelKey when the key is unset or empty. */
export function createModelClient<I>(root: string, params: (input: I) => RequestParams): ModelClient<I> {
  const apiKey = setting(root, 'ANTHROPIC_API_KEY');
  if (apiKey === undefined || apiKey === '') {
    throw new NoModelKey('ANTHROPIC_API_KEY is not set; a real run needs it, --plan does not');
  }
  const client = new Anthropic({ apiKey });
  return {
    async submit(requests) {
      const batch = await client.messages.batches.create({
        requests: requests.map(({ orgnr, input }) => ({ custom_id: orgnr, params: params(input) })),
      });
      return batch.id;
    },
    async ended(batchId) {
      const batch = await client.messages.batches.retrieve(batchId);
      return batch.processing_status === 'ended';
    },
    async *results(batchId) {
      for await (const entry of await client.messages.batches.results(batchId)) yield toBatchResult(entry);
    },
  };
}
