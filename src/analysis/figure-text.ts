// The words for a key figure that is absent (Stories 1.6b, 1.8, 2.7, 2.9):
// "Kan ikke beregnes: {reason}" for an undefined figure, and each other
// reason's own words, all through the one exhaustive switch in
// absence-state.ts. Shared by the subject's own figures, the key-figure
// table, the Oversikt hero and each peer's driftsmargin on the Peers tab, so
// the analysis layer does not depend on a component.
import type { Absence } from '../engine/types.ts';
import { t } from '../messages/index.ts';
import { absenceWords, type AbsenceContext, type Message } from './absence-state.ts';

const text = (message: Message): string => t(message.id, message.vars);

/**
 * The cell text for an absent figure: "Kan ikke beregnes: {reason}" for an
 * undefined one (the reason from its cause), otherwise the reason's own
 * words ("Regnskapet for 2025 kunne ikke leses sikkert", "Ikke lest i denne
 * versjonen", …).
 */
export function absenceText(absence: Absence, context: AbsenceContext): string {
  const words = absenceWords(absence, context);
  if (absence.reason === 'undefined') {
    if (words.detail === null) throw new Error('an undefined figure has a cause');
    return t(words.text.id, { grunn: text(words.detail) });
  }
  return text(words.text);
}

/** The explanation shown with "Ikke lest i denne versjonen", or null for every other reason. */
export function absenceDetail(absence: Absence, context: AbsenceContext): string | null {
  if (absence.reason === 'undefined') return null;
  const detail = absenceWords(absence, context).detail;
  return detail === null ? null : text(detail);
}
