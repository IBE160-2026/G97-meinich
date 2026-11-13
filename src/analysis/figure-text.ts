// The words for a key figure that cannot be computed (Stories 1.6b, 1.8,
// 2.7): "Kan ikke beregnes: {reason}". Shared by the subject's own figures,
// the key-figure table, the Oversikt hero and each peer's driftsmargin on
// the Peers tab, so the analysis layer does not depend on a component.
import type { FigureAbsence } from '../engine/types.ts';
import { t, type MessageId } from '../messages/index.ts';

/** "Kan ikke beregnes: {reason}" for a figure the company's own filing cannot give. */
export function undefinedText(absence: FigureAbsence, denominator: MessageId): string {
  const reason: MessageId =
    absence.reason === 'undefined' && absence.cause === 'denominator_not_positive'
      ? denominator
      : 'analysis.figures.reason.componentMissing';
  return t('analysis.figures.undefined', { grunn: t(reason) });
}
