// R3's tolerance (Story 2.5c, Spec Change Log, Meinich 2026-11-06) is the
// between-sources rule of [reconciliation] in ingest/config.toml:
// max(between_sources_floor_kr, between_sources_tolerance x |API|). The
// engine keeps its own copy; this test fails when the two differ, so there
// is no second free constant.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { BETWEEN_SOURCES_FLOOR_ORE, BETWEEN_SOURCES_TOLERANCE } from '../../src/engine/document-inputs.ts';

const root = path.resolve(import.meta.dirname, '../..');

/** One key of [reconciliation], as written. */
function reconciliation(key: string, value: RegExp): string {
  const config = readFileSync(path.join(root, 'ingest/config.toml'), 'utf8');
  const section = /^\[reconciliation\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(config)?.[1];
  if (section === undefined) throw new Error('ingest/config.toml has no [reconciliation] section');
  const found = new RegExp(`^${key}\\s*=\\s*${value.source}\\s*$`, 'm').exec(section)?.[1];
  if (found === undefined) throw new Error(`${key} is missing or malformed in [reconciliation]`);
  return found;
}

it('equals between_sources_floor_kr in ingest/config.toml, in øre', () => {
  expect(BETWEEN_SOURCES_FLOOR_ORE).toBe(BigInt(reconciliation('between_sources_floor_kr', /(\d+)/)) * 100n);
});

it('equals between_sources_tolerance in ingest/config.toml, exactly', () => {
  expect(BETWEEN_SOURCES_TOLERANCE.eq(reconciliation('between_sources_tolerance', /"([0-9.]+)"/))).toBe(true);
});
