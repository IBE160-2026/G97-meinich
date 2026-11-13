// The one module that names the model key or imports the SDK (Story 2.6;
// AD-19; test/classify/key-boundary.test.ts). The key comes from the
// environment, then .env, and is never logged.
import Anthropic from '@anthropic-ai/sdk';
import { setting } from '../run-ingest.ts';
import type { RequestInput } from './request.ts';
import { requestParams } from './request.ts';

export type BatchRequest = { readonly orgnr: string; readonly input: RequestInput };

/** One company's result, reduced to what step 2 stores. */
export type BatchResult = {
  readonly orgnr: string;
  readonly outcome:
    | { readonly kind: 'text'; readonly text: string; readonly inputTokens: number; readonly outputTokens: number }
    | { readonly kind: 'failed'; readonly reason: string };
};

export interface ModelClient {
  /** Submits the batch and returns its id. */
  submit(requests: readonly BatchRequest[]): Promise<string>;
  /** Whether the batch has ended. */
  ended(batchId: string): Promise<boolean>;
  results(batchId: string): AsyncIterable<BatchResult>;
}

export class NoModelKey extends Error {}

/** One entry of a batch's results, reduced. Anything but a finished text is failed, with its reason. */
export function toBatchResult(entry: Anthropic.Messages.MessageBatchIndividualResponse): BatchResult {
  const orgnr = entry.custom_id;
  if (entry.result.type !== 'succeeded') return { orgnr, outcome: { kind: 'failed', reason: `batch_${entry.result.type}` } };
  const { message } = entry.result;
  if (message.stop_reason !== 'end_turn') {
    return { orgnr, outcome: { kind: 'failed', reason: `stop_${message.stop_reason ?? 'none'}` } };
  }
  const block = message.content.find((part) => part.type === 'text');
  if (block === undefined) return { orgnr, outcome: { kind: 'failed', reason: 'no_text_block' } };
  return {
    orgnr,
    outcome: { kind: 'text', text: block.text, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
  };
}

/** The real client. Throws NoModelKey when the key is unset or empty. */
export function createModelClient(root: string): ModelClient {
  const apiKey = setting(root, 'ANTHROPIC_API_KEY');
  if (apiKey === undefined || apiKey === '') {
    throw new NoModelKey('ANTHROPIC_API_KEY is not set; a real run needs it, --plan does not');
  }
  const client = new Anthropic({ apiKey });
  return {
    async submit(requests) {
      const batch = await client.messages.batches.create({
        requests: requests.map(({ orgnr, input }) => ({ custom_id: orgnr, params: requestParams(input) })),
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
