// Each absence reason has exactly one UI state, and its words (Story 2.9;
// FR-21, FR-23, FR-71). The list of reasons below is typed as a record over
// the reasons of `Absence`, so a new reason fails typecheck here as well as
// at the `never` default in src/analysis/absence-state.ts.
import { describe, expect, it } from 'vitest';
import {
  ABSENCE_STATES,
  absenceState,
  absenceWords,
  documentSubline,
  type AbsenceState,
} from '../../src/analysis/absence-state.ts';
import { absenceDetail, absenceText } from '../../src/analysis/figure-text.ts';
import type { DocumentBasis } from '../../src/engine/document-inputs.ts';
import type { Absence } from '../../src/engine/types.ts';
import { t } from '../../src/messages/index.ts';


/** One absence of every reason, each with the state it must be shown in. */
const EVERY_REASON: { readonly [R in Absence['reason']]: readonly [Extract<Absence, { reason: R }>, AbsenceState] } = {
  undefined: [{ reason: 'undefined', cause: 'component_missing' }, 'undefined'],
  below_floor: [{ reason: 'below_floor', count: 9 }, 'below_floor'],
  not_in_dataset: [{ reason: 'not_in_dataset' }, 'not_in_dataset'],
  failed_reconciliation: [{ reason: 'failed_reconciliation' }, 'document_failed'],
  not_reconciled: [{ reason: 'not_reconciled' }, 'document_failed'],
  refused: [{ reason: 'refused' }, 'document_failed'],
  document_missing: [{ reason: 'document_missing' }, 'document_missing'],
  not_read_in_v1: [{ reason: 'not_read_in_v1', scope: 'notes' }, 'not_read_in_v1'],
};

const CONTEXT = { denominator: 'analysis.figures.reason.revenueNotPositive', filingYear: 2025 } as const;

describe('absenceState', () => {
  it('every reason has exactly one state', () => {
    expect(Object.keys(EVERY_REASON)).toHaveLength(8);
    const reached = new Set<AbsenceState>();
    for (const [reason, [absence, state]] of Object.entries(EVERY_REASON)) {
      expect(absenceState(absence), reason).toBe(state);
      expect(ABSENCE_STATES, reason).toContain(state);
      reached.add(state);
    }
    // Every state is some reason's.
    expect([...reached].sort()).toEqual([...ABSENCE_STATES].sort());
  });

  it('refuses a value that is not a reason at run time', () => {
    expect(() => absenceState({ reason: 'exceeds_api_subtotal' } as unknown as Absence)).toThrow(TypeError);
  });
});

describe('absenceText', () => {
  it('words an undefined figure by its cause', () => {
    expect(absenceText({ reason: 'undefined', cause: 'denominator_not_positive' }, CONTEXT)).toBe(
      'Kan ikke beregnes: omsetningen er null eller negativ',
    );
    expect(absenceText({ reason: 'undefined', cause: 'component_missing' }, CONTEXT)).toBe(
      'Kan ikke beregnes: en regnskapslinje mangler',
    );
    expect(absenceText({ reason: 'undefined', cause: 'line_not_read_safely' }, CONTEXT)).toBe(
      'Kan ikke beregnes: en regnskapslinje kunne ikke leses sikkert',
    );
  });

  it('never words a document reason as a missing line', () => {
    // Before Story 2.9 every reason but undefined read "en regnskapslinje mangler".
    for (const [absence] of Object.values(EVERY_REASON)) {
      if (absence.reason === 'undefined') continue;
      expect(absenceText(absence, CONTEXT), absence.reason).not.toContain('regnskapslinje mangler');
    }
  });

  it('words each document reason with the filing year', () => {
    expect(absenceText({ reason: 'failed_reconciliation' }, CONTEXT)).toBe('Regnskapet for 2025 kunne ikke leses sikkert');
    expect(absenceText({ reason: 'not_reconciled' }, CONTEXT)).toBe('Regnskapet for 2025 kunne ikke leses sikkert');
    expect(absenceText({ reason: 'refused' }, CONTEXT)).toBe('Regnskapet for 2025 kunne ikke leses sikkert');
    expect(absenceText({ reason: 'document_missing' }, CONTEXT)).toBe('Regnskapet for 2025 er ikke lest inn');
    expect(absenceText({ reason: 'not_in_dataset' }, CONTEXT)).toBe('Ikke i demodataene');
    expect(absenceText({ reason: 'below_floor', count: 9 }, CONTEXT)).toBe('For få sammenlignbare (9 av 10)');
  });

  it('words "not read in v1" with one explanation per scope', () => {
    for (const scope of ['notes', 'filing_year', 'paper'] as const) {
      expect(absenceText({ reason: 'not_read_in_v1', scope }, CONTEXT)).toBe('Ikke lest i denne versjonen');
    }
    expect(absenceDetail({ reason: 'not_read_in_v1', scope: 'notes' }, CONTEXT)).toBe(
      'Antall årsverk står i notene til årsregnskapet. Denne versjonen av Peerless leser ikke notene.',
    );
    expect(absenceDetail({ reason: 'not_read_in_v1', scope: 'filing_year' }, { ...CONTEXT, filingYear: 2026 })).toBe(
      'I denne versjonen leser Peerless årsregnskapene for 2021–2025. Regnskapet for 2026 er ikke lest.',
    );
    expect(absenceDetail({ reason: 'not_read_in_v1', scope: 'paper' }, CONTEXT)).toBe(
      'Regnskapet for 2025 er levert på papir. Denne versjonen av Peerless leser ikke papirregnskap.',
    );
    expect(absenceDetail({ reason: 'failed_reconciliation' }, CONTEXT)).toBeNull();
    expect(absenceDetail({ reason: 'undefined', cause: 'component_missing' }, CONTEXT)).toBeNull();
  });

  it('gives every reason words that fill every placeholder', () => {
    for (const [absence] of Object.values(EVERY_REASON)) {
      const words = absenceWords(absence, CONTEXT);
      expect(() => t(words.text.id, { ...words.text.vars, grunn: 'x' }), absence.reason).not.toThrow();
      if (words.detail !== null) expect(() => t(words.detail!.id, words.detail!.vars), absence.reason).not.toThrow();
    }
  });
});

describe('documentSubline', () => {
  const subline = (basis: DocumentBasis): string | null => {
    const message = documentSubline(basis);
    return message === null ? null : t(message.id, message.vars);
  };

  it('says why the subject’s own document is not read, in words', () => {
    expect(subline({ kind: 'failed_reconciliation', filingYear: 2025 })).toBe('Regnskapet for 2025 kunne ikke leses sikkert');
    expect(subline({ kind: 'not_reconciled', filingYear: 2025 })).toBe('Regnskapet for 2025 kunne ikke leses sikkert');
    expect(subline({ kind: 'refused', filingYear: 2024 })).toBe('Regnskapet for 2024 kunne ikke leses sikkert');
    expect(subline({ kind: 'not_read_in_v1', scope: 'filing_year', filingYear: 2026 })).toBe(
      'Regnskapet for 2026 er ikke lest i denne versjonen',
    );
    expect(subline({ kind: 'not_read_in_v1', scope: 'paper', filingYear: 2023 })).toBe(
      'Regnskapet for 2023 er ikke lest i denne versjonen',
    );
    expect(subline({ kind: 'document_missing', filingYear: 2025 })).toBe('Regnskapet for 2025 er ikke lest inn');
  });

  it('has no subline outside the demo data or for a document that was read', () => {
    expect(subline({ kind: 'not_in_dataset' })).toBeNull();
    expect(
      documentSubline({ kind: 'read', filingYear: 2025, current: {} as never, prior: null }),
    ).toBeNull();
  });
});
