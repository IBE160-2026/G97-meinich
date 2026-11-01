// The one digest function (Story 2.5; technical note AD-9, AD-13). Batch
// step 2 stores, beside each derived row, a digest of the raw inputs it was
// derived from, and CI recomputes it from the committed figures: a mismatch
// means the stored row no longer follows from its inputs. Fingerprints use
// it first; classifications and explanations reuse it.
//
// sha256 over canonical JSON: object keys sorted by UTF-16 code unit at
// every level, no whitespace, arrays in their order, a bigint as its decimal
// string. Anything that JSON cannot write exactly (undefined, a function, a
// non-finite number, a symbol) throws instead of being dropped or coerced.
//
// node:crypto is server-only: no 'use client' module may import this file
// (eslint.config.mjs, test/lint.test.ts).
import { createHash } from 'node:crypto';

/** What the digest accepts: JSON values, plus bigint written as its decimal string. */
export type Canonical =
  | string
  | number
  | boolean
  | bigint
  | null
  | readonly Canonical[]
  | { readonly [key: string]: Canonical };

/** The canonical JSON text of `value`: sorted keys, no whitespace, bigint as a decimal string. */
export function canonicalJson(value: Canonical): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'bigint':
      return JSON.stringify(value.toString());
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`not a finite number: ${String(value)}`);
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) return `[${(value as readonly Canonical[]).map(canonicalJson).join(',')}]`;
      const record = value as { readonly [key: string]: Canonical };
      const keys = Object.keys(record).sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(member(record, key))}`).join(',')}}`;
    }
    default:
      throw new TypeError(`not a canonical value: ${typeof value}`);
  }
}

function member(record: { readonly [key: string]: Canonical }, key: string): Canonical {
  const value = record[key];
  if (value === undefined) throw new TypeError(`key ${JSON.stringify(key)} is undefined`);
  return value;
}

/** sha256 of the canonical JSON of `value`, as 64 lower-case hex digits. */
export function digest(value: Canonical): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
