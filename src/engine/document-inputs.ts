// The blocking rule for document figures (Story 2.2; FR-57, FR-58). A figure
// read from a filed document reaches the engine only when its column
// reconciled: within the document (checks c1-c5) and, for this year's
// column, against the key-figures API. Batch step 1 decides and stores the
// status (`register.document_column.status`); this module is the one place
// that turns a stored column into what the engine may use. Story 2.9
// consumes it.
//
// - `reconciled`: every figure as stored, parsed exactly from its øre string.
//   A NULL figure (absent from or unreadable in the filing) stays null, never
//   0; its reason is Story 2.9's.
// - `failed_reconciliation`: no value at all. Every figure is an absence with
//   reason `failed_reconciliation`; nothing is caveated, substituted or
//   estimated.
// - no status (NULL: read, not yet reconciled): every figure is an absence
//   with reason `not_reconciled`. Visible, not silent, and it never throws,
//   so one such row cannot fail a whole analysis page.
//
// `guardCurrentAssets` (R3, Story 2.5c; Meinich 2026-11-06) applies to a
// current column's figures, after `documentFigures`: a `kundefordringer` or
// `bankinnskudd` above the filing's API `sum_omloepsmidler` by more than the
// between-sources rule, max(5 kr, 0.001 % of the subtotal), is absent with
// reason `exceeds_api_subtotal` (review triage 19: a document figure against
// an API figure takes the between-sources rule, never the within-document
// bound). No within-document check covers these
// two lines, and the probe found such figures to be a digit read as two
// (analysis/output/cost-sum-probe.md). The stored figure is unchanged; the
// engine only does not use it.
//
// Story 2.9 adds the document basis of one company (`documentBasis`): which
// document, if any, its document figures may come from for the filing year,
// decided in a fixed order from the dataset manifest, the filing year and the
// stored statuses; and the one derivation of a document figure the engine
// makes, `sumDriftsinntekter` from its stated parts (`documentRevenue`).
// Neither computes a key figure's value (Story 3.1a).
import { Decimal } from './decimal.ts';
import { parseOre } from './inputs.ts';
import type { Absence, FigureAbsence } from './types.ts';

/**
 * The filing years v1 reads documents for, both included: the years batch
 * step 1 fetches (`DOCUMENT_YEARS` in ingest/src/peerless_ingest/run.py;
 * test/engine/document-years.test.ts fails if the two differ).
 */
export const DOCUMENT_YEARS = { from: 2021, to: 2025 } as const;

/** Whether `year` is one v1 reads documents for. */
export function isDocumentYear(year: number): boolean {
  return Number.isInteger(year) && year >= DOCUMENT_YEARS.from && year <= DOCUMENT_YEARS.to;
}

/** The stored status of a document column; null while it is not yet reconciled. */
export type ReconciliationStatus = 'reconciled' | 'failed_reconciliation';

/**
 * Each figure column of `register.document_column` and its engine name,
 * which keeps the register's Norwegian. The 27 fields of the generated
 * layout, in table order: the 23 of Story 2.1b, then the four parts of
 * intangible assets (Story 2.5b), which the fingerprint does not read.
 */
export const DOCUMENT_FIGURE_COLUMNS = {
  salgsinntekt: 'salgsinntekt_ore',
  sumDriftsinntekter: 'sum_driftsinntekter_ore',
  varekostnad: 'varekostnad_ore',
  lonnskostnad: 'lonnskostnad_ore',
  avskrivninger: 'avskrivninger_ore',
  nedskrivninger: 'nedskrivninger_ore',
  annenDriftskostnad: 'annen_driftskostnad_ore',
  sumDriftskostnad: 'sum_driftskostnad_ore',
  driftsresultat: 'driftsresultat_ore',
  nettoFinans: 'netto_finans_ore',
  ordinaertResultatFoerSkattekostnad: 'ordinaert_resultat_foer_skattekostnad_ore',
  aarsresultat: 'aarsresultat_ore',
  sumImmaterielleEiendeler: 'sum_immaterielle_eiendeler_ore',
  sumVarigeDriftsmidler: 'sum_varige_driftsmidler_ore',
  varer: 'varer_ore',
  kundefordringer: 'kundefordringer_ore',
  bankinnskudd: 'bankinnskudd_ore',
  sumEiendeler: 'sum_eiendeler_ore',
  sumEgenkapital: 'sum_egenkapital_ore',
  leverandorgjeld: 'leverandorgjeld_ore',
  sumKortsiktigGjeld: 'sum_kortsiktig_gjeld_ore',
  sumGjeld: 'sum_gjeld_ore',
  sumEgenkapitalGjeld: 'sum_egenkapital_gjeld_ore',
  forskningOgUtvikling: 'forskning_og_utvikling_ore',
  konsesjonerPatenter: 'konsesjoner_patenter_ore',
  goodwill: 'goodwill_ore',
  utsattSkattefordel: 'utsatt_skattefordel_ore',
} as const;

export type DocumentField = keyof typeof DOCUMENT_FIGURE_COLUMNS;
type FigureColumn = (typeof DOCUMENT_FIGURE_COLUMNS)[DocumentField];

/** A `register.document_column` row as postgres.js returns it: status, and every `bigint` figure a string or null. */
export type DocumentColumnRow = { readonly status: string | null } & { readonly [C in FigureColumn]: string | null };

/** Why a document column passes no value. */
export type ReconciliationAbsence = Extract<Absence, { readonly reason: 'failed_reconciliation' | 'not_reconciled' }>;

/**
 * Why one figure of a reconciled column is not used (R3). An input-level
 * absence, local to this module and the fingerprint: it is not an `Absence`
 * of a key figure. A key figure that reads such a line is undefined with the
 * cause `line_not_read_safely` (`src/engine/document-absence.ts`).
 */
export type SubtotalAbsence = { readonly reason: 'exceeds_api_subtotal' };

/**
 * One document figure: a value (øre as filed; null when the filing does not
 * state it) from a reconciled column, or an absence naming why the column
 * passes nothing, or (after `guardCurrentAssets`) why this one figure is
 * not used.
 */
export type DocumentFigure =
  | { readonly kind: 'value'; readonly ore: bigint | null }
  | { readonly kind: 'absent'; readonly absence: ReconciliationAbsence | SubtotalAbsence };

export type DocumentFigures = { readonly [F in DocumentField]: DocumentFigure };

const FIELDS = Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[];

function every(figure: (field: DocumentField) => DocumentFigure): DocumentFigures {
  return Object.fromEntries(FIELDS.map((field) => [field, figure(field)])) as Record<DocumentField, DocumentFigure>;
}

/** The stored status, or null. Any other value is not a status and throws. */
export function statusOf(value: string | null): ReconciliationStatus | null {
  if (value === null || value === 'reconciled' || value === 'failed_reconciliation') return value;
  throw new TypeError(`not a reconciliation status: ${JSON.stringify(value)}`);
}

/**
 * What the engine may use from one stored document column: its figures only
 * when the column reconciled, otherwise every figure absent with the reason.
 */
export function documentFigures(column: DocumentColumnRow): DocumentFigures {
  const status = statusOf(column.status);
  switch (status) {
    case 'reconciled':
      return every((field) => ({ kind: 'value', ore: parseOre(column[DOCUMENT_FIGURE_COLUMNS[field]]) }));
    case 'failed_reconciliation': {
      const absent: DocumentFigure = { kind: 'absent', absence: { reason: 'failed_reconciliation' } };
      return every(() => absent);
    }
    case null: {
      const absent: DocumentFigure = { kind: 'absent', absence: { reason: 'not_reconciled' } };
      return every(() => absent);
    }
  }
}

/** Whether R3 made this figure absent: above the API subtotal (`exceeds_api_subtotal`). */
export function exceedsApiSubtotal(figure: DocumentFigure): boolean {
  return figure.kind === 'absent' && figure.absence.reason === 'exceeds_api_subtotal';
}

/**
 * The between-sources rule of `[reconciliation]` in ingest/config.toml:
 * `between_sources_floor_kr` in øre and `between_sources_tolerance` as an
 * exact decimal. test/engine/between-sources-tolerance.test.ts fails if
 * either differs from the config.
 */
export const BETWEEN_SOURCES_FLOOR_ORE = 500n;
export const BETWEEN_SOURCES_TOLERANCE = new Decimal('0.00001');

/** `line` above `subtotal` by more than max(floor, tolerance × |subtotal|), exactly. */
function aboveSubtotal(line: bigint, subtotal: bigint): boolean {
  const excess = line - subtotal;
  if (excess <= BETWEEN_SOURCES_FLOOR_ORE) return false;
  const magnitude = subtotal < 0n ? -subtotal : subtotal;
  return new Decimal(excess.toString()).gt(BETWEEN_SOURCES_TOLERANCE.mul(new Decimal(magnitude.toString())));
}

/** The current asset lines R3 checks against the API's sum_omloepsmidler. */
export const GUARDED_CURRENT_ASSETS = ['kundefordringer', 'bankinnskudd'] as const satisfies readonly DocumentField[];

/**
 * R3 (Story 2.5c): a current column's `kundefordringer` or `bankinnskudd`
 * above `sumOmloepsmidler` (the key-figures API filing the document belongs
 * to) by more than max(5 kr, 0.001 % of it) is absent with reason
 * `exceeds_api_subtotal`: the line or the subtotal is wrong. Every
 * other figure, a prior column, an API subtotal that is NULL, and a column
 * that passes no value are returned unchanged. `salgsinntekt` and
 * `leverandorgjeld` are not checked: a revenue line can exceed its total
 * when another revenue row is negative (40 of 56 cases in the probe).
 */
export function guardCurrentAssets(
  figures: DocumentFigures,
  role: 'current' | 'prior',
  sumOmloepsmidler: bigint | null,
): DocumentFigures {
  if (role !== 'current' || sumOmloepsmidler === null) return figures;
  const out: Record<DocumentField, DocumentFigure> = { ...figures };
  for (const field of GUARDED_CURRENT_ASSETS) {
    const figure = figures[field];
    if (figure.kind === 'value' && figure.ore !== null && aboveSubtotal(figure.ore, sumOmloepsmidler)) {
      out[field] = { kind: 'absent', absence: { reason: 'exceeds_api_subtotal' } };
    }
  }
  return out;
}

/**
 * An amount the engine reads from a document column: stated, or derived from
 * stated values (`derived`), or absent with the reason. Never 0 in place of
 * a missing value.
 */
export type DocumentAmount =
  | { readonly kind: 'value'; readonly ore: bigint; readonly derived: boolean }
  | {
      readonly kind: 'absent';
      readonly absence: ReconciliationAbsence | Extract<FigureAbsence, { readonly reason: 'undefined' }>;
    };

const COMPONENT_MISSING: DocumentAmount = {
  kind: 'absent',
  absence: { reason: 'undefined', cause: 'component_missing' },
};

/**
 * The column's `sumDriftsinntekter`: as stated, or, when the filing leaves it
 * empty, derived one level from its stated parts, `driftsresultat` +
 * `sumDriftskostnad` (`docs/key-figures.md`, "Deriving a missing API input",
 * applied to the document's own lines). With either part also empty it is
 * undefined (`component_missing`), never 0. A column that passes no value
 * gives its reason. The derivation lives here only; step 1 stores the
 * figures as filed (AD-15).
 */
export function documentRevenue(figures: DocumentFigures): DocumentAmount {
  const stated = figures.sumDriftsinntekter;
  if (stated.kind === 'absent') {
    // R3 empties only kundefordringer and bankinnskudd, never revenue; were
    // it ever applied to revenue, the line would be missing, not 0.
    if (stated.absence.reason === 'exceeds_api_subtotal') return COMPONENT_MISSING;
    return { kind: 'absent', absence: stated.absence };
  }
  if (stated.ore !== null) return { kind: 'value', ore: stated.ore, derived: false };
  const result = figures.driftsresultat;
  const costs = figures.sumDriftskostnad;
  if (result.kind !== 'value' || costs.kind !== 'value' || result.ore === null || costs.ore === null) {
    return COMPONENT_MISSING;
  }
  return { kind: 'value', ore: result.ore + costs.ore, derived: true };
}

/** One stored document of a company and filing year, as the analysis reads it. */
export type StoredDocument = {
  /** `register.document.status`. */
  readonly status: string;
  /** The document's `current` column; null when it has none. */
  readonly current: DocumentColumnRow | null;
  /** The document's `prior` column; null when it has none. */
  readonly prior: DocumentColumnRow | null;
};

/** What `documentBasis` decides from. */
export type DocumentBasisInput = {
  /** The orgnr is on `register.dataset.manifest->'document_figure_orgnrs'`. */
  readonly inManifest: boolean;
  /** The benchmark filing's year. */
  readonly filingYear: number;
  /** The stored document for (orgnr, filingYear), or null when there is no row. */
  readonly document: StoredDocument | null;
  /** The key-figures API's `sum_omloepsmidler` of the benchmark filing, for R3. */
  readonly sumOmloepsmidler: bigint | null;
};

/**
 * Where a company's document figures come from for its filing year, or why
 * none do. Decided once per company by `documentBasis`; each document key
 * figure's absence follows from it (`documentFigureAbsence`).
 */
export type DocumentBasis =
  | { readonly kind: 'not_in_dataset' }
  | { readonly kind: 'not_read_in_v1'; readonly scope: 'filing_year' | 'paper'; readonly filingYear: number }
  | { readonly kind: 'document_missing'; readonly filingYear: number }
  | { readonly kind: 'refused'; readonly filingYear: number }
  | { readonly kind: 'failed_reconciliation'; readonly filingYear: number }
  | { readonly kind: 'not_reconciled'; readonly filingYear: number }
  | {
      readonly kind: 'read';
      readonly filingYear: number;
      /** The current column's figures, after R3 (`guardCurrentAssets`). */
      readonly current: DocumentFigures;
      /** The prior column's figures, or null when the document has none. */
      readonly prior: DocumentFigures | null;
    };

/**
 * The document basis, in this order (Story 2.9, decision 3):
 *
 * 1. orgnr not on the manifest's list → `not_in_dataset`, whatever rows exist;
 * 2. filing year outside `DOCUMENT_YEARS` → `not_read_in_v1` / `filing_year`;
 * 3. no document row → `document_missing`, the only basis decided from a
 *    missing row (the caller logs it: `analysis.documentMissing`);
 * 4. `paper` → `not_read_in_v1` / `paper`;
 * 5. `not_extracted` → `refused`;
 * 6. otherwise the current column through `documentFigures`:
 *    `failed_reconciliation`, `not_reconciled` (no status yet), or `read`.
 *    A document with no current column, which step 1 never writes, takes
 *    the document's own status: `failed_reconciliation` if so, otherwise
 *    `not_reconciled` (nothing checked can be read).
 *
 * Pure, and no basis throws; only a stored status value the schema's CHECK
 * refuses would (`statusOf`).
 */
export function documentBasis(input: DocumentBasisInput): DocumentBasis {
  const { filingYear } = input;
  if (!input.inManifest) return { kind: 'not_in_dataset' };
  if (!isDocumentYear(filingYear)) return { kind: 'not_read_in_v1', scope: 'filing_year', filingYear };
  const document = input.document;
  if (document === null) return { kind: 'document_missing', filingYear };
  if (document.status === 'paper') return { kind: 'not_read_in_v1', scope: 'paper', filingYear };
  if (document.status === 'not_extracted') return { kind: 'refused', filingYear };
  const current = document.current;
  if (current === null) {
    return document.status === 'failed_reconciliation'
      ? { kind: 'failed_reconciliation', filingYear }
      : { kind: 'not_reconciled', filingYear };
  }
  const status = statusOf(current.status);
  switch (status) {
    case 'failed_reconciliation':
      return { kind: 'failed_reconciliation', filingYear };
    case null:
      return { kind: 'not_reconciled', filingYear };
    case 'reconciled':
      return {
        kind: 'read',
        filingYear,
        current: guardCurrentAssets(documentFigures(current), 'current', input.sumOmloepsmidler),
        prior: document.prior === null ? null : documentFigures(document.prior),
      };
  }
}
