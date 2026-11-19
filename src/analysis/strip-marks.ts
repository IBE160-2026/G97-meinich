// A comparison's distribution-strip marks and a direction's words, shared by
// the key-figure table's rows (key-figure-rows.ts) and the decomposition
// fold-outs' factors (decomposition-view.ts). Pure: the engine's comparison
// in, geometry and a message id out.
import { stripPosition } from '../engine/benchmark.ts';
import type { Comparison, Direction } from '../engine/types.ts';
import type { MessageId } from '../messages/index.ts';

/** A figure's direction in words: "↑ Høyere er bedre", "↓ Lavere er bedre", "Ingen retning". */
export const DIRECTION_WORDS: Readonly<Record<Direction, MessageId>> = {
  higher_is_better: 'keyFigures.dir.higher',
  lower_is_better: 'keyFigures.dir.lower',
  none: 'keyFigures.dir.none',
};

/** Mark positions as a share of the strip's width from the left, 0–1. Geometry, not figures. */
export type StripMarks = {
  readonly own: { readonly at: number; readonly clipped: boolean };
  readonly median: number;
  /** The midtre halvdel's ends, left and right as drawn. */
  readonly bandFrom: number;
  readonly bandTo: number;
  /** Null for a figure with no direction. */
  readonly best: number | null;
  /** Lower is better: drawn mirrored and labelled "Bedre →". */
  readonly mirrored: boolean;
};

type Compared = Extract<Comparison, { readonly kind: 'compared' }>;

/** The strip's marks from the engine's positions; `toNumber` only for geometry. */
export function stripMarks(comparison: Compared, direction: Direction): StripMarks {
  const at = (mark: Compared['median']) => stripPosition(mark, comparison, direction).at.toNumber();
  const own = stripPosition(comparison.subject, comparison, direction);
  return {
    own: { at: own.at.toNumber(), clipped: own.clipped !== null },
    median: at(comparison.median),
    bandFrom: at(comparison.lowerQuartile),
    bandTo: at(comparison.upperQuartile),
    best: comparison.best === null ? null : at(comparison.best.quartile),
    mirrored: direction === 'lower_is_better',
  };
}
