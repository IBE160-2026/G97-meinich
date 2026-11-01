// The fingerprint's rounding tolerance (Story 2.5, Spec Change Log, Meinich
// 2026-11-01) is within_document_bound_kr in ingest/config.toml, the bound
// step 1 reconciles a document with. The engine keeps its own copy in øre;
// this test fails when the two differ, so there is no second free constant.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ROUNDING_TOLERANCE_ORE } from '../../src/engine/fingerprint.ts';

const root = path.resolve(import.meta.dirname, '../..');

/** within_document_bound_kr of [reconciliation], as written: whole kroner. */
function withinDocumentBoundKr(): bigint {
  const config = readFileSync(path.join(root, 'ingest/config.toml'), 'utf8');
  const section = /^\[reconciliation\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(config)?.[1];
  if (section === undefined) throw new Error('ingest/config.toml has no [reconciliation] section');
  const value = /^within_document_bound_kr\s*=\s*(\d+)\s*$/m.exec(section)?.[1];
  if (value === undefined) throw new Error('within_document_bound_kr is not a whole number of kroner in [reconciliation]');
  return BigInt(value);
}

it('equals within_document_bound_kr in ingest/config.toml, in øre', () => {
  expect(ROUNDING_TOLERANCE_ORE).toBe(withinDocumentBoundKr() * 100n);
});
