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
// `bankinnskudd` above the filing's API `sum_omloepsmidler` + 5 kr is absent
// with reason `exceeds_api_subtotal`. No within-document check covers these
// two lines, and the probe found such figures to be a digit read as two
// (analysis/output/cost-sum-probe.md). The stored figure is unchanged; the
// engine only does not use it.
import { ROUNDING_TOLERANCE_ORE } from './fingerprint.ts';
import { parseOre } from './inputs.ts';
import type { Absence } from './types.ts';

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

/** Why one figure of a reconciled column is not used (R3). */
export type SubtotalAbsence = Extract<Absence, { readonly reason: 'exceeds_api_subtotal' }>;

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
function statusOf(value: string | null): ReconciliationStatus | null {
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

/** The current asset lines R3 checks against the API's sum_omloepsmidler. */
export const GUARDED_CURRENT_ASSETS = ['kundefordringer', 'bankinnskudd'] as const satisfies readonly DocumentField[];

/**
 * R3 (Story 2.5c): a current column's `kundefordringer` or `bankinnskudd`
 * above `sumOmloepsmidler` (the key-figures API filing the document belongs
 * to) by more than 5 kr is absent with reason `exceeds_api_subtotal`. Every
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
    if (figure.kind === 'value' && figure.ore !== null && figure.ore > sumOmloepsmidler + ROUNDING_TOLERANCE_ORE) {
      out[field] = { kind: 'absent', absence: { reason: 'exceeds_api_subtotal' } };
    }
  }
  return out;
}
