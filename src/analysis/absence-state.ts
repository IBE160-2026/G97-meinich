// Each absence reason's one UI state, and the words for it (Story 2.9;
// FR-21, FR-23, FR-71; EXPERIENCE.md "State Patterns"). Two exhaustive
// switches: `absenceState` over the engine's `Absence` reasons, and
// `documentSubline` over a subject's document basis. A new reason or basis
// without a state fails to compile here, at the `never` defaults.
//
// Pure: no component, so the key-figure table, the hero, the peer list and
// the company header word an absence the same way.
import type { DocumentBasis } from '../engine/document-inputs.ts';
import { DOCUMENT_YEARS } from '../engine/document-inputs.ts';
import { MIN_PEERS, type Absence, type UndefinedCause } from '../engine/types.ts';
import type { MessageId, MessageVars } from '../messages/index.ts';

/**
 * The UI states an absent figure can be in, one per EXPERIENCE.md state:
 * "Own value undefined", "Below the 10-peer floor", "outside the demo
 * seed" ("Ikke i demodataene"), "Own filing fails reconciliation" (also a
 * document not yet reconciled or refused at reading), "Document not
 * stored" and "Document figure not read in v1".
 */
export const ABSENCE_STATES = [
  'undefined',
  'below_floor',
  'not_in_dataset',
  'document_failed',
  'document_missing',
  'not_read_in_v1',
] as const;

export type AbsenceState = (typeof ABSENCE_STATES)[number];

/** Fails to compile when a reason reaches it: the switch above it is not exhaustive. */
function unhandled(value: never): never {
  throw new TypeError(`no state for ${JSON.stringify(value)}`);
}

/** The one state `absence` is shown in. */
export function absenceState(absence: Absence): AbsenceState {
  switch (absence.reason) {
    case 'undefined':
      return 'undefined';
    case 'below_floor':
      return 'below_floor';
    case 'not_in_dataset':
      return 'not_in_dataset';
    case 'failed_reconciliation':
    case 'not_reconciled':
    case 'refused':
      return 'document_failed';
    case 'document_missing':
      return 'document_missing';
    case 'not_read_in_v1':
      return 'not_read_in_v1';
    default:
      return unhandled(absence);
  }
}

/** A message id and the values for its placeholders. */
export type Message = { readonly id: MessageId; readonly vars: MessageVars };

/** What an absence's words need besides the absence. */
export type AbsenceContext = {
  /** The reason a zero or negative denominator is given for this figure ("omsetningen er null eller negativ"). */
  readonly denominator: MessageId;
  /** The benchmark filing's year, for "Regnskapet for {aar} …". */
  readonly filingYear: number;
};

/** The words for an absence: the cell text, and for "not read in v1" its explanation. */
export type AbsenceWords = { readonly text: Message; readonly detail: Message | null };

function causeMessage(cause: UndefinedCause, denominator: MessageId): MessageId {
  switch (cause) {
    case 'denominator_not_positive':
      return denominator;
    case 'component_missing':
      return 'analysis.figures.reason.componentMissing';
    case 'line_not_read_safely':
      return 'analysis.figures.reason.lineNotReadSafely';
    default:
      return unhandled(cause);
  }
}

/**
 * The words for `absence`. For `undefined`, the cause's words go into
 * "Kan ikke beregnes: {grunn}" as the `grunn` message, which the caller
 * renders first (`absenceText` in figure-text.ts).
 */
export function absenceWords(absence: Absence, context: AbsenceContext): AbsenceWords {
  const aar = String(context.filingYear);
  switch (absence.reason) {
    case 'undefined':
      return {
        text: { id: 'analysis.figures.undefined', vars: {} },
        detail: { id: causeMessage(absence.cause, context.denominator), vars: {} },
      };
    case 'below_floor':
      return {
        text: { id: 'keyFigures.belowFloor', vars: { n: String(absence.count), min: String(MIN_PEERS) } },
        detail: null,
      };
    case 'not_in_dataset':
      return { text: { id: 'analysis.figures.notInDataset', vars: {} }, detail: null };
    case 'failed_reconciliation':
    case 'not_reconciled':
    case 'refused':
      return { text: { id: 'analysis.documentFailed', vars: { aar } }, detail: null };
    case 'document_missing':
      return { text: { id: 'analysis.figures.documentMissing', vars: { aar } }, detail: null };
    case 'not_read_in_v1':
      return { text: { id: 'analysis.figures.notReadInV1', vars: {} }, detail: notReadDetail(absence.scope, aar) };
    default:
      return unhandled(absence);
  }
}

function notReadDetail(scope: Extract<Absence, { readonly reason: 'not_read_in_v1' }>['scope'], aar: string): Message {
  switch (scope) {
    case 'notes':
      return { id: 'analysis.figures.notReadInV1.notes', vars: {} };
    case 'filing_year':
      return {
        id: 'analysis.figures.notReadInV1.filingYear',
        vars: { fra: String(DOCUMENT_YEARS.from), til: String(DOCUMENT_YEARS.to), aar },
      };
    case 'paper':
      return { id: 'analysis.figures.notReadInV1.paper', vars: { aar } };
    default:
      return unhandled(scope);
  }
}

/**
 * The company header's slate subline for the subject's document basis
 * (FR-57, FR-71), or null: no subline for a company outside the demo data
 * or a document that was read.
 */
export function documentSubline(basis: DocumentBasis): Message | null {
  switch (basis.kind) {
    case 'not_in_dataset':
    case 'read':
      return null;
    case 'failed_reconciliation':
    case 'not_reconciled':
    case 'refused':
      return { id: 'analysis.documentFailed', vars: { aar: String(basis.filingYear) } };
    case 'not_read_in_v1':
      return { id: 'analysis.documentNotRead', vars: { aar: String(basis.filingYear) } };
    case 'document_missing':
      return { id: 'analysis.figures.documentMissing', vars: { aar: String(basis.filingYear) } };
    default:
      return unhandled(basis);
  }
}
