// The blocking rule for document figures (Story 2.2; FR-57, FR-58). A figure
// read from a filed document reaches the engine only when its column
// reconciled: within the document (checks c1-c4) and, for this year's
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
import { parseOre } from './inputs.ts';
import type { Absence } from './types.ts';

/** The stored status of a document column; null while it is not yet reconciled. */
export type ReconciliationStatus = 'reconciled' | 'failed_reconciliation';

/**
 * Each figure column of `register.document_column` and its engine name,
 * which keeps the register's Norwegian. The 23 fields of the generated
 * layout, in table order.
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
} as const;

export type DocumentField = keyof typeof DOCUMENT_FIGURE_COLUMNS;
type FigureColumn = (typeof DOCUMENT_FIGURE_COLUMNS)[DocumentField];

/** A `register.document_column` row as postgres.js returns it: status, and every `bigint` figure a string or null. */
export type DocumentColumnRow = { readonly status: string | null } & { readonly [C in FigureColumn]: string | null };

/** Why a document column passes no value. */
export type ReconciliationAbsence = Extract<Absence, { readonly reason: 'failed_reconciliation' | 'not_reconciled' }>;

/**
 * One document figure: a value (øre as filed; null when the filing does not
 * state it) from a reconciled column, or an absence naming why the column
 * passes nothing.
 */
export type DocumentFigure =
  | { readonly kind: 'value'; readonly ore: bigint | null }
  | { readonly kind: 'absent'; readonly absence: ReconciliationAbsence };

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
