// Values from Postgres into the engine. postgres.js returns `int8` and
// `numeric` as strings by default; they are parsed here exactly, never
// through a JavaScript number, so an amount above 2^53 øre survives.
import { Decimal } from './decimal.ts';
import type { ApiInputs } from './types.ts';

const WHOLE = /^-?\d+$/;
const DECIMAL = /^-?\d+(\.\d+)?$/;

function shown(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : typeof value;
}

/** An `int8` amount in øre: a whole-number string, or null. Anything else throws. */
export function parseOre(value: string | null): bigint | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !WHOLE.test(value)) {
    throw new TypeError(`not a whole-number string: ${shown(value)}`);
  }
  return BigInt(value);
}

/** A `numeric` value: a plain decimal string (no exponent), or null. Anything else throws. */
export function parseDecimal(value: string | null): Decimal | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !DECIMAL.test(value)) {
    throw new TypeError(`not a plain decimal string: ${shown(value)}`);
  }
  return new Decimal(value);
}

/** A `register.key_figures` row as postgres.js returns it: every `bigint` column a string or null. */
export type KeyFiguresRow = {
  readonly brreg_id: string;
  readonly driftsresultat_ore: string | null;
  readonly sum_driftsinntekter_ore: string | null;
  readonly sum_driftskostnad_ore: string | null;
  readonly netto_finans_ore: string | null;
  readonly sum_finansinntekter_ore: string | null;
  readonly sum_finanskostnad_ore: string | null;
  readonly ordinaert_resultat_foer_skattekostnad_ore: string | null;
  readonly aarsresultat_ore: string | null;
  readonly totalresultat_ore: string | null;
  readonly sum_eiendeler_ore: string | null;
  readonly sum_omloepsmidler_ore: string | null;
  readonly sum_anleggsmidler_ore: string | null;
  readonly sum_egenkapital_gjeld_ore: string | null;
  readonly sum_egenkapital_ore: string | null;
  readonly sum_opptjent_egenkapital_ore: string | null;
  readonly sum_innskutt_egenkaptial_ore: string | null;
  readonly sum_gjeld_ore: string | null;
  readonly sum_kortsiktig_gjeld_ore: string | null;
  readonly sum_langsiktig_gjeld_ore: string | null;
};

/**
 * The seven `register.key_figures` columns the engine's API inputs read, the
 * one list of them (Story 2.10): the request path's reads select these and
 * no other key-figure column.
 */
export const API_KEY_FIGURE_COLUMNS = [
  'sum_driftsinntekter_ore',
  'driftsresultat_ore',
  'sum_driftskostnad_ore',
  'sum_eiendeler_ore',
  'sum_egenkapital_gjeld_ore',
  'sum_egenkapital_ore',
  'sum_gjeld_ore',
] as const satisfies readonly (keyof KeyFiguresRow)[];

export type ApiKeyFigureColumn = (typeof API_KEY_FIGURE_COLUMNS)[number];

/** The part of a key-figures row the API inputs read. */
export type ApiKeyFiguresRow = Pick<KeyFiguresRow, ApiKeyFigureColumn>;

/** Exactly the API_KEY_FIGURE_COLUMNS of `row`, so a wider row carries nothing further. */
export function apiKeyFigures(row: ApiKeyFiguresRow): ApiKeyFiguresRow {
  const picked: Partial<Record<ApiKeyFigureColumn, string | null>> = {};
  for (const column of API_KEY_FIGURE_COLUMNS) picked[column] = row[column];
  return picked as ApiKeyFiguresRow;
}

/** The engine's API inputs from a key-figures row, by its column names. */
export function apiInputsFromRow(row: ApiKeyFiguresRow): ApiInputs {
  return {
    sumDriftsinntekter: parseOre(row.sum_driftsinntekter_ore),
    driftsresultat: parseOre(row.driftsresultat_ore),
    sumDriftskostnad: parseOre(row.sum_driftskostnad_ore),
    sumEiendeler: parseOre(row.sum_eiendeler_ore),
    sumEgenkapitalGjeld: parseOre(row.sum_egenkapital_gjeld_ore),
    sumEgenkapital: parseOre(row.sum_egenkapital_ore),
    sumGjeld: parseOre(row.sum_gjeld_ore),
  };
}
