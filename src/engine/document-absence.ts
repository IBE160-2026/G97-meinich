// The twelve document key figures and why each is absent for one company
// (Story 2.9; FR-21, FR-23, FR-71; `docs/key-figures.md`). Pure: a company's
// document basis (`documentBasis` in `document-inputs.ts`) and a figure in,
// an absence with exactly one reason out, or null when the figure's inputs
// are read and Story 3.1a may compute it from the formula. This module
// computes no value and no kroner.
//
// The order of the rules:
// 1. Key figures 7 and 8 (per årsverk) read `aarsverk` from the notes, which
//    v1 does not read: `not_read_in_v1` / `notes` on every basis.
// 2. A basis that passes no column gives its own reason for every figure:
//    `not_in_dataset`, `not_read_in_v1` (`filing_year`, `paper`),
//    `document_missing`, `refused`, `failed_reconciliation`, `not_reconciled`.
// 3. A read column: a figure reading a line R3 did not admit (above its API
//    subtotal) is undefined, `line_not_read_safely`; a figure reading
//    `sumDriftsinntekter` that is neither stated nor derivable from its parts
//    is undefined, `component_missing`; revenue growth (14) also needs the
//    prior column, and takes its reason when that column passes nothing.
//    Every other empty line, and the sign of a denominator, is Story 3.1a's
//    to decide with the formula.
import {
  type DocumentBasis,
  type DocumentField,
  type DocumentFigures,
  documentRevenue,
  exceedsApiSubtotal,
} from './document-inputs.ts';
import type { FigureAbsence } from './types.ts';

/**
 * The twelve document key figures, keyed by their message id's suffix
 * (`fig.{key}` in EXPERIENCE.md), with their number in `docs/key-figures.md`
 * (kontantandel has none) and the document lines their formula reads.
 * `revenue` marks a formula reading `sumDriftsinntekter` (stated or derived,
 * `documentRevenue`); `prior` marks revenue growth, which also reads the
 * prior column's.
 */
export const DOCUMENT_KEY_FIGURES = {
  ebitda: { number: 2, lines: ['driftsresultat', 'avskrivninger', 'nedskrivninger'], revenue: true },
  vare: { number: 3, lines: ['varekostnad'], revenue: true },
  lonn: { number: 4, lines: ['lonnskostnad'], revenue: true },
  andre: { number: 5, lines: ['annenDriftskostnad'], revenue: true },
  total: { number: 6, lines: ['varekostnad', 'lonnskostnad', 'annenDriftskostnad'], revenue: true },
  omsArsverk: { number: 7, lines: [], revenue: true },
  lonnArsverk: { number: 8, lines: ['lonnskostnad'], revenue: false },
  kfd: { number: 9, lines: ['kundefordringer', 'salgsinntekt'], revenue: false },
  lgd: { number: 10, lines: ['leverandorgjeld', 'varekostnad', 'annenDriftskostnad'], revenue: false },
  oml: { number: 11, lines: ['sumEiendeler', 'bankinnskudd'], revenue: true },
  vekst: { number: 14, lines: [], revenue: true, prior: true },
  kontant: { number: null, lines: ['bankinnskudd', 'sumEiendeler'], revenue: false },
} as const satisfies Record<
  string,
  {
    readonly number: number | null;
    readonly lines: readonly DocumentField[];
    readonly revenue: boolean;
    readonly prior?: true;
  }
>;

export type DocumentKeyFigure = keyof typeof DOCUMENT_KEY_FIGURES;

export const DOCUMENT_KEY_FIGURE_KEYS = Object.keys(DOCUMENT_KEY_FIGURES) as DocumentKeyFigure[];

/** Key figures 7 and 8: `aarsverk` is printed in the notes, which v1 does not read. */
const FROM_THE_NOTES: ReadonlySet<DocumentKeyFigure> = new Set(['omsArsverk', 'lonnArsverk']);

const NOT_READ_NOTES: FigureAbsence = { reason: 'not_read_in_v1', scope: 'notes' };
const LINE_NOT_READ_SAFELY: FigureAbsence = { reason: 'undefined', cause: 'line_not_read_safely' };
const COMPONENT_MISSING: FigureAbsence = { reason: 'undefined', cause: 'component_missing' };

/** The absence of a figure whose formula reads `sumDriftsinntekter` of `figures`, or null when it is there. */
function revenueAbsence(figures: DocumentFigures): FigureAbsence | null {
  const revenue = documentRevenue(figures);
  return revenue.kind === 'absent' ? revenue.absence : null;
}

/**
 * Why `figure` is absent for a company with `basis`, or null when its inputs
 * are read (Story 3.1a computes it). Exactly one reason; never throws.
 */
export function documentFigureAbsence(basis: DocumentBasis, figure: DocumentKeyFigure): FigureAbsence | null {
  if (FROM_THE_NOTES.has(figure)) return NOT_READ_NOTES;
  switch (basis.kind) {
    case 'not_in_dataset':
      return { reason: 'not_in_dataset' };
    case 'not_read_in_v1':
      return { reason: 'not_read_in_v1', scope: basis.scope };
    case 'document_missing':
      return { reason: 'document_missing' };
    case 'refused':
      return { reason: 'refused' };
    case 'failed_reconciliation':
      return { reason: 'failed_reconciliation' };
    case 'not_reconciled':
      return { reason: 'not_reconciled' };
    case 'read':
      return readAbsence(basis.current, basis.prior, figure);
  }
}

function readAbsence(
  current: DocumentFigures,
  prior: DocumentFigures | null,
  figure: DocumentKeyFigure,
): FigureAbsence | null {
  const definition: (typeof DOCUMENT_KEY_FIGURES)[DocumentKeyFigure] = DOCUMENT_KEY_FIGURES[figure];
  const lines: readonly DocumentField[] = definition.lines;
  if (lines.some((line) => exceedsApiSubtotal(current[line]))) return LINE_NOT_READ_SAFELY;
  if (definition.revenue) {
    const absent = revenueAbsence(current);
    if (absent !== null) return absent;
  }
  if ('prior' in definition) {
    if (prior === null) return COMPONENT_MISSING;
    return revenueAbsence(prior);
  }
  return null;
}
