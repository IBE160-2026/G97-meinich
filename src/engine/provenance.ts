// What a kroner amount is computed from (Story 3.7; FR-60, FR-64, FR-57;
// `docs/key-figures.md`): the filed values behind it with their names, how a
// derived value was derived, how beste fjerdedel was found, and whether the
// amount's inputs were checked against another source. Pure: figures in,
// facts out. Nothing here computes a kroner amount (every amount comes from
// `benchmark.ts` and `closable.ts`), and nothing here formats: the view
// (src/analysis/provenance.ts) writes every number through format.ts.
//
// - Names. An input from the key-figures API carries the register's own
//   leaf name (`REGISTER_FIELD_NAMES`, the last key of each path in
//   ingest/src/peerless_ingest/parse.py `KEY_FIGURES`; test/register-field-
//   names.test.ts fails if the two differ); a document line carries the
//   engine's name (`DOCUMENT_FIGURE_COLUMNS`), which keeps the register's
//   Norwegian.
// - Derivations. One table, `API_DERIVATIONS`, holds the four API
//   derivations `resolveApiInputs` makes; a document line's derivation is
//   `documentRevenue`'s or `documentCostLines`' rule. Every derived input
//   carries the operands it was derived from, and the operands give its
//   value (test/engine/provenance.test.ts "each rule reproduces its value").
// - The data-quality line (decision 4), from the subject's document basis
//   and the stored reconciliation of its current column, never inferred
//   (AD-15). An input is compared only when it is one of the figures both
//   sources hold (`SHARED_FIELDS`, reconcile.py), stated in the API, read in
//   the document, and the column's `api_check` passed. R3 is not a
//   comparison.
// - "≈" (decision 2, decision 7): a line of displayed numbers reads "≈" in
//   place of "=" exactly when its expression, evaluated from the displayed
//   operands, is not the displayed result (`lineIsApproximate`), the rule
//   Story 3.6 made for the EV product line (`productIsApproximate`).
import { Decimal } from './decimal.ts';
import {
  COST_LINES,
  type CostLine,
  DOCUMENT_FIGURE_COLUMNS,
  type DocumentBasis,
  type DocumentColumnRow,
  type DocumentField,
  type DocumentFigures,
  WITHIN_DOCUMENT_BOUND_ORE,
  documentCostLines,
  documentRevenue,
} from './document-inputs.ts';
import { parseOre } from './inputs.ts';
import { percentileInc } from './statistics.ts';
import type { ApiInputs, Direction, FigureInput } from './types.ts';

/**
 * Each `register.key_figures` column and the register's leaf name for it:
 * the last key of its path in parse.py `KEY_FIGURES`, with the register's
 * misspelling `sumInnskuttEgenkaptial` kept.
 */
export const REGISTER_FIELD_NAMES = {
  driftsresultat_ore: 'driftsresultat',
  sum_driftsinntekter_ore: 'sumDriftsinntekter',
  sum_driftskostnad_ore: 'sumDriftskostnad',
  netto_finans_ore: 'nettoFinans',
  sum_finansinntekter_ore: 'sumFinansinntekter',
  sum_finanskostnad_ore: 'sumFinanskostnad',
  ordinaert_resultat_foer_skattekostnad_ore: 'ordinaertResultatFoerSkattekostnad',
  aarsresultat_ore: 'aarsresultat',
  totalresultat_ore: 'totalresultat',
  sum_eiendeler_ore: 'sumEiendeler',
  sum_omloepsmidler_ore: 'sumOmloepsmidler',
  sum_anleggsmidler_ore: 'sumAnleggsmidler',
  sum_egenkapital_gjeld_ore: 'sumEgenkapitalGjeld',
  sum_egenkapital_ore: 'sumEgenkapital',
  sum_opptjent_egenkapital_ore: 'sumOpptjentEgenkapital',
  sum_innskutt_egenkaptial_ore: 'sumInnskuttEgenkaptial',
  sum_gjeld_ore: 'sumGjeld',
  sum_kortsiktig_gjeld_ore: 'sumKortsiktigGjeld',
  sum_langsiktig_gjeld_ore: 'sumLangsiktigGjeld',
} as const;

export type KeyFigureColumn = keyof typeof REGISTER_FIELD_NAMES;

/**
 * The figures a document column and the key-figures API filing both hold,
 * by the same name, in the order step 1 writes them to `api_fail_fields`:
 * reconcile.py `SHARED_FIELDS` (test/register-field-names.test.ts fails if
 * the two differ).
 */
export const SHARED_FIELDS = [
  'sum_driftsinntekter',
  'sum_driftskostnad',
  'driftsresultat',
  'netto_finans',
  'ordinaert_resultat_foer_skattekostnad',
  'aarsresultat',
  'sum_eiendeler',
  'sum_egenkapital',
  'sum_kortsiktig_gjeld',
  'sum_gjeld',
  'sum_egenkapital_gjeld',
] as const;

export type SharedField = (typeof SHARED_FIELDS)[number];

/** A shared field's register name: `sum_driftsinntekter` → `sumDriftsinntekter`. */
export function sharedFieldName(field: SharedField): string {
  return REGISTER_FIELD_NAMES[`${field}_ore`];
}

/** The register names of the shared fields: the document fields of those names are the same lines. */
const SHARED_NAMES: ReadonlySet<string> = new Set(SHARED_FIELDS.map(sharedFieldName));

/** Where an input is read: the key-figures API filing, or the filed document's current column. */
export type InputSource = 'api' | 'document';

/** One operand of a derivation: a stated value, added (+1) or subtracted (−1). */
export type Operand = { readonly field: string; readonly ore: bigint; readonly sign: 1 | -1 };

/**
 * How a derived input was derived, from stated values only, one level deep:
 * - `sum`: its value is the signed sum of the operands;
 * - `rounding_zero`: a cost line set to 0, because the remainder of
 *   `sumDriftskostnad` minus the stated lines, `rest`, is within ±5 kr,
 *   both bounds included (`documentCostLines`).
 */
export type Derivation =
  | { readonly kind: 'sum'; readonly operands: readonly Operand[] }
  | { readonly kind: 'rounding_zero'; readonly operands: readonly Operand[]; readonly rest: bigint };

/** One input of an amount, with its value in øre as filed or derived, and how it was derived (null: stated). */
export type ProvenanceInput = {
  readonly field: string;
  readonly source: InputSource;
  readonly ore: bigint;
  readonly derivation: Derivation | null;
};

/** The signed sum of a derivation's operands. */
export function operandSum(operands: readonly Operand[]): bigint {
  let sum = 0n;
  for (const operand of operands) sum += operand.sign === 1 ? operand.ore : -operand.ore;
  return sum;
}

// ---- The API inputs --------------------------------------------------------

/** The API inputs an amount can read, and the stated fields each one is derived from when empty. */
export type ApiInputField = 'sumDriftsinntekter' | 'driftsresultat' | 'sumEiendeler' | 'sumEgenkapital';

/**
 * The derivations of `docs/key-figures.md`, "Deriving a missing API input":
 * the one table `apiInput` reads, tested against `resolveApiInputs`.
 */
export const API_DERIVATIONS: Readonly<Record<ApiInputField, readonly (readonly [keyof ApiInputs, 1 | -1])[]>> = {
  sumDriftsinntekter: [
    ['driftsresultat', 1],
    ['sumDriftskostnad', 1],
  ],
  driftsresultat: [
    ['sumDriftsinntekter', 1],
    ['sumDriftskostnad', -1],
  ],
  sumEiendeler: [['sumEgenkapitalGjeld', 1]],
  sumEgenkapital: [
    ['sumEgenkapitalGjeld', 1],
    ['sumGjeld', -1],
  ],
};

/** An API input as stated, or derived from stated values by `API_DERIVATIONS`; null when neither. */
export function apiInput(inputs: ApiInputs, field: ApiInputField): ProvenanceInput | null {
  const stated = inputs[field];
  if (stated !== null) return { field, source: 'api', ore: stated, derivation: null };
  const operands: Operand[] = [];
  for (const [name, sign] of API_DERIVATIONS[field]) {
    const value = inputs[name];
    if (value === null) return null;
    operands.push({ field: name, ore: value, sign });
  }
  return { field, source: 'api', ore: operandSum(operands), derivation: { kind: 'sum', operands } };
}

// ---- The document inputs ---------------------------------------------------

/** A stated figure of a column, or null when the column leaves it empty or passes no value. */
function statedFigure(figures: DocumentFigures, field: DocumentField): bigint | null {
  const figure = figures[field];
  return figure.kind === 'value' ? figure.ore : null;
}

function isCostLine(field: DocumentField): field is CostLine {
  return (COST_LINES as readonly string[]).includes(field);
}

/**
 * A document line as the engine reads it from a read column: stated, or
 * derived by `documentRevenue` (`sumDriftsinntekter`) or `documentCostLines`
 * (a cost line), with the rule. Null when it is not available (empty and
 * underivable, or absent): such a figure has no value, so no amount reads it.
 */
export function documentInput(figures: DocumentFigures, field: DocumentField): ProvenanceInput | null {
  if (field === 'sumDriftsinntekter') {
    const revenue = documentRevenue(figures);
    if (revenue.kind !== 'value') return null;
    if (!revenue.derived) return { field, source: 'document', ore: revenue.ore, derivation: null };
    const operands: Operand[] = [
      { field: 'driftsresultat', ore: statedOrThrow(figures, 'driftsresultat'), sign: 1 },
      { field: 'sumDriftskostnad', ore: statedOrThrow(figures, 'sumDriftskostnad'), sign: 1 },
    ];
    return { field, source: 'document', ore: revenue.ore, derivation: { kind: 'sum', operands } };
  }
  if (isCostLine(field)) {
    const line = documentCostLines(figures)[field];
    if (line.kind !== 'value') return null;
    if (!line.derived) return { field, source: 'document', ore: line.ore, derivation: null };
    // Derived from the stated total: sumDriftskostnad minus every stated line.
    const operands: Operand[] = [{ field: 'sumDriftskostnad', ore: statedOrThrow(figures, 'sumDriftskostnad'), sign: 1 }];
    for (const other of COST_LINES) {
      const stated = statedFigure(figures, other);
      if (stated !== null) operands.push({ field: other, ore: stated, sign: -1 });
    }
    const rest = operandSum(operands);
    const rounding = rest >= -WITHIN_DOCUMENT_BOUND_ORE && rest <= WITHIN_DOCUMENT_BOUND_ORE;
    return {
      field,
      source: 'document',
      ore: line.ore,
      derivation: rounding ? { kind: 'rounding_zero', operands, rest } : { kind: 'sum', operands },
    };
  }
  const stated = statedFigure(figures, field);
  return stated === null ? null : { field, source: 'document', ore: stated, derivation: null };
}

function statedOrThrow(figures: DocumentFigures, field: DocumentField): bigint {
  const stated = statedFigure(figures, field);
  // documentRevenue and documentCostLines derive only from stated values.
  if (stated === null) throw new Error(`a derivation read ${field}, which is not stated`);
  return stated;
}

/**
 * The inputs of a figure, in the order its formula reads them (the
 * engine's `FigureResult.inputs`), each with its value: the API filing's
 * for an `api` input, the current column's for a document line. Throws on
 * an input that has no value: a computed figure has one for every input.
 */
export function figureInputs(
  inputs: readonly FigureInput[],
  api: ApiInputs,
  current: DocumentFigures | null,
): ProvenanceInput[] {
  return inputs.map((input) => {
    const found =
      input.column === 'api'
        ? apiInput(api, input.field as ApiInputField)
        : input.column === 'current' && current !== null
          ? documentInput(current, input.field as DocumentField)
          : null;
    if (found === null) throw new Error(`a computed figure's input ${input.field} has no value`);
    if ((found.derivation !== null) !== input.derived) throw new Error(`${input.field}: derived differs from the engine`);
    return found;
  });
}

// ---- The data-quality line (decision 4) -------------------------------------

export type CheckResult = 'pass' | 'fail' | 'not_evaluable';

/** The five within-document checks, as step 1 names them (reconcile.py). */
export const CHECKS = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;
export type CheckId = (typeof CHECKS)[number];

/** Each check's operands in register names, and its equation's two sides (decision 4's equations). */
export const CHECK_EQUATIONS: Readonly<
  Record<CheckId, { readonly left: readonly Operand['field'][]; readonly leftSigns: readonly (1 | -1)[]; readonly right: readonly string[] }>
> = {
  c1: { left: ['sumDriftsinntekter', 'sumDriftskostnad'], leftSigns: [1, -1], right: ['driftsresultat'] },
  c2: { left: ['driftsresultat', 'nettoFinans'], leftSigns: [1, 1], right: ['ordinaertResultatFoerSkattekostnad'] },
  c3: { left: ['sumEiendeler'], leftSigns: [1], right: ['sumEgenkapitalGjeld'] },
  c4: { left: ['sumEgenkapital', 'sumGjeld'], leftSigns: [1, 1], right: ['sumEgenkapitalGjeld'] },
  c5: { left: ['sumEiendeler'], leftSigns: [1], right: ['sumEgenkapital', 'sumGjeld'] },
};

/** The stored reconciliation of a document's current column (`register.document_column`). */
export type CurrentReconciliation = {
  readonly checks: Readonly<Record<CheckId, CheckResult | null>>;
  readonly apiCheck: CheckResult | null;
  /** `api_fail_fields`, the shared fields that disagreed with the API, in step 1's order. */
  readonly apiFailFields: readonly string[] | null;
  /** The column's stored figures, to tell which lines a check could not read. */
  readonly figures: DocumentColumnRow;
};

/** What is stored about the subject's document beyond its basis: when it was read, and its current column's checks. */
export type StoredDocumentFacts = {
  /** `register.document.read_at`; null when there is no document row. */
  readonly readAt: Date | null;
  /** The current column's reconciliation; null when there is no current column. */
  readonly current: CurrentReconciliation | null;
};

/**
 * The data-quality line of one amount (decision 4), one of:
 * - `absent`: a document amount without a read document (it has no
 *   drill-down: such an amount does not exist);
 * - for an API amount: `not_in_dataset`, `not_read_in_v1`,
 *   `document_missing`, `not_read_safely` (refused, or not yet reconciled),
 *   `failed` (with what failed), `reconciled` (every input compared) or
 *   `not_compared`;
 * - for a document amount with a read document: always `not_compared`.
 */
export type DataQuality =
  | { readonly kind: 'absent' }
  | { readonly kind: 'not_in_dataset' }
  | { readonly kind: 'not_read_in_v1'; readonly filingYear: number }
  | { readonly kind: 'document_missing'; readonly filingYear: number }
  | { readonly kind: 'not_read_safely'; readonly filingYear: number }
  | {
      readonly kind: 'failed';
      /** `api_fail_fields` in register names, in step 1's order. */
      readonly apiFields: readonly string[];
      /** The checks that failed, in order. */
      readonly checks: readonly CheckId[];
      /**
       * Only when nothing failed outright: the lines a required check could
       * not read (c1, or both c3 and c5, not evaluable), in register names.
       * See Implementation Notes: "≠" would claim an inequality no one saw.
       */
      readonly unread: readonly string[];
    }
  | { readonly kind: 'reconciled' }
  | { readonly kind: 'not_compared'; readonly fields: readonly string[] };

/** A column's stored figure by its register name; null when empty. */
function columnFigure(figures: DocumentColumnRow, field: string): bigint | null {
  const column = (DOCUMENT_FIGURE_COLUMNS as Readonly<Record<string, string>>)[field];
  if (column === undefined) throw new Error(`no document column for ${field}`);
  return parseOre((figures as unknown as Readonly<Record<string, string | null>>)[column] ?? null);
}

/** The API filing's stated value of a shared field; null when the register's element is empty. */
function apiStated(api: ApiInputs, field: string): bigint | null {
  return field in api ? api[field as keyof ApiInputs] : null;
}

/**
 * Whether an input was compared with the other source (decision 4): it is
 * one of the shared figures, stated (not derived) in the API, read in the
 * document, and the column's `api_check` passed. A derived input is never
 * compared: an input is derived exactly when its own source left it empty,
 * which one of the two tests below finds. R3 is not a comparison.
 */
export function inputCompared(input: ProvenanceInput, api: ApiInputs, current: CurrentReconciliation | null): boolean {
  if (current === null || current.apiCheck !== 'pass') return false;
  if (!SHARED_NAMES.has(input.field)) return false;
  return apiStated(api, input.field) !== null && columnFigure(current.figures, input.field) !== null;
}

/** The checks a failed column failed, its API fields, or (with neither) the lines its required checks could not read. */
function failure(current: CurrentReconciliation | null): Extract<DataQuality, { readonly kind: 'failed' }> {
  const apiFields = (current?.apiFailFields ?? []).map((field) => {
    if (!(SHARED_FIELDS as readonly string[]).includes(field)) throw new Error(`not a shared field: ${field}`);
    return sharedFieldName(field as SharedField);
  });
  const checks = current === null ? [] : CHECKS.filter((check) => current.checks[check] === 'fail');
  const unread: string[] = [];
  if (current !== null && apiFields.length === 0 && checks.length === 0) {
    // step 1's column_status: c1 must pass, and the balance by c3 or c5.
    const required: CheckId[] = [];
    if (current.checks.c1 !== 'pass') required.push('c1');
    if (current.checks.c3 !== 'pass' && current.checks.c5 !== 'pass') required.push('c3', 'c5');
    for (const check of required) {
      const { left, right } = CHECK_EQUATIONS[check];
      for (const field of [...left, ...right]) {
        if (columnFigure(current.figures, field) === null && !unread.includes(field)) unread.push(field);
      }
    }
  }
  if (apiFields.length === 0 && checks.length === 0 && unread.length === 0) {
    throw new Error('a failed column with nothing that failed: no stored check names it');
  }
  return { kind: 'failed', apiFields, checks, unread };
}

/**
 * The data-quality line of an amount (decision 4), decided by an exhaustive
 * switch over the subject's document basis, in `documentBasis`' order.
 * `amount` says whose inputs these are: an API amount (profit, the hero,
 * Verdi's profit card, EV) or a document amount ((9), (10), (11), working
 * capital, Største kapitalgap, Verdi's capital cards).
 */
export function dataQuality({
  basis,
  facts,
  api,
  inputs,
  amount,
}: {
  readonly basis: DocumentBasis;
  readonly facts: StoredDocumentFacts;
  readonly api: ApiInputs;
  readonly inputs: readonly ProvenanceInput[];
  readonly amount: InputSource;
}): DataQuality {
  const document = amount === 'document';
  switch (basis.kind) {
    case 'not_in_dataset':
      return document ? { kind: 'absent' } : { kind: 'not_in_dataset' };
    case 'not_read_in_v1':
      return document ? { kind: 'absent' } : { kind: 'not_read_in_v1', filingYear: basis.filingYear };
    case 'document_missing':
      return document ? { kind: 'absent' } : { kind: 'document_missing', filingYear: basis.filingYear };
    case 'refused':
    case 'not_reconciled':
      return document ? { kind: 'absent' } : { kind: 'not_read_safely', filingYear: basis.filingYear };
    case 'failed_reconciliation':
      return document ? { kind: 'absent' } : failure(facts.current);
    case 'read': {
      const notCompared = inputs.filter((input) => !inputCompared(input, api, facts.current)).map((input) => input.field);
      const fields = [...new Set(notCompared)];
      // A document amount is never "Avstemt": some line of it no check covers.
      if (document && fields.length === 0) throw new Error('a document amount whose every line was compared');
      return fields.length === 0 ? { kind: 'reconciled' } : { kind: 'not_compared', fields };
    }
  }
}

// ---- "≈" and the quartile line ---------------------------------------------

/**
 * Whether a line of displayed numbers is approximate (Story 3.6, decision 3,
 * made general in Story 3.7): the exact value of its expression, evaluated
 * from the displayed operands, is not the displayed result. A boolean, not
 * an amount.
 */
export function lineIsApproximate(expression: Decimal, shownResult: Decimal): boolean {
  return !expression.eq(shownResult);
}

/** Which quartile beste fjerdedel is: the upper where higher is better, the lower where lower is better. */
export function bestQuartile(direction: Exclude<Direction, 'none'>): { readonly which: 'upper' | 'lower'; readonly p: Decimal } {
  return direction === 'higher_is_better' ? { which: 'upper', p: new Decimal('0.75') } : { which: 'lower', p: new Decimal('0.25') };
}

/**
 * How `percentileInc` reaches the quartile at `p` in `sorted` (decision 2):
 * with h = (n − 1) × p, k = ⌊h⌋ + 1 (1-based) and f = h − ⌊h⌋,
 * - `at`: f = 0, the quartile is value k;
 * - `between`: a + f × (b − a), a value k and b value k + 1; `approximate`
 *   when that expression, from the values as displayed (`shown`), is not
 *   the quartile as displayed.
 */
export type QuartileLine =
  | { readonly kind: 'at'; readonly k: number; readonly quartile: Decimal }
  | {
      readonly kind: 'between';
      readonly k: number;
      readonly f: Decimal;
      readonly a: Decimal;
      readonly b: Decimal;
      readonly quartile: Decimal;
      readonly approximate: boolean;
    };

export function quartileLine(sorted: readonly Decimal[], p: Decimal, shown: (value: Decimal) => Decimal): QuartileLine {
  const quartile = percentileInc(sorted, p);
  const h = p.mul(sorted.length - 1);
  const lower = h.floor();
  const f = h.minus(lower);
  const k = lower.toNumber() + 1;
  if (f.isZero()) return { kind: 'at', k, quartile };
  const a = sorted[k - 1];
  const b = sorted[k];
  if (a === undefined || b === undefined) throw new RangeError('the quartile lies outside the values');
  const expression = shown(a).plus(f.mul(shown(b).minus(shown(a))));
  return { kind: 'between', k, f, a, b, quartile, approximate: lineIsApproximate(expression, shown(quartile)) };
}
