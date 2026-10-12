// Distribution statistics (`docs/key-figures.md`, "Distribution",
// "Percentile", "Same basis for subject and peers"). Every value is a
// Decimal to 40 significant digits, rounded only at display.
import { Decimal } from './decimal.ts';
import { type Comparison, type Direction, type FigureResult, MIN_PEERS } from './types.ts';

/**
 * Excel `PERCENTILE.INC`: linear interpolation between order statistics,
 * inclusive. `sorted` must be ascending and non-empty; `p` is in [0, 1].
 * With rank h = (n − 1) × p, the result is x[⌊h⌋] + (h − ⌊h⌋) × (x[⌊h⌋+1] − x[⌊h⌋]).
 */
export function percentileInc(sorted: readonly Decimal[], p: Decimal | string): Decimal {
  const n = sorted.length;
  if (n === 0) throw new RangeError('percentileInc needs at least one value');
  const share = new Decimal(p);
  if (share.lt(0) || share.gt(1)) throw new RangeError(`p must be in [0, 1], got ${share.toString()}`);
  for (let i = 1; i < n; i += 1) {
    if ((sorted[i] as Decimal).lt(sorted[i - 1] as Decimal)) {
      throw new RangeError('percentileInc needs values sorted ascending');
    }
  }
  const rank = share.mul(n - 1);
  const lowerIndex = rank.floor();
  const fraction = rank.minus(lowerIndex);
  const lower = sorted[lowerIndex.toNumber()] as Decimal;
  if (fraction.isZero()) return lower;
  const upper = sorted[lowerIndex.toNumber() + 1] as Decimal;
  return lower.plus(fraction.mul(upper.minus(lower)));
}

/**
 * Plassering: (peers worse + 0.5 × peers equal) / peers × 100, in the
 * favourable direction. Returns percent (0–100) as a Decimal to 40
 * significant digits, rounded only at display. A figure with no direction
 * has no percentile.
 */
export function percentileRank(
  subject: Decimal,
  peers: readonly Decimal[],
  direction: Exclude<Direction, 'none'>,
): Decimal {
  if (peers.length === 0) throw new RangeError('percentileRank needs at least one peer');
  let worse = 0;
  let equal = 0;
  for (const peer of peers) {
    if (peer.eq(subject)) equal += 1;
    else if (direction === 'higher_is_better' ? peer.lt(subject) : peer.gt(subject)) worse += 1;
  }
  return new Decimal(worse).plus(new Decimal(equal).mul('0.5')).div(peers.length).mul(100);
}

/**
 * The subject's figure against its peers. A peer counts only when its value
 * is defined and from the subject's source; every other peer is left out of
 * this figure only. Below MIN_PEERS no statistic is returned.
 */
export function compareFigure(
  subject: FigureResult,
  peers: readonly FigureResult[],
  direction: Direction,
): Comparison {
  if (subject.kind === 'absent') {
    const count = peers.filter((peer) => peer.kind === 'value').length;
    return { kind: 'subject_absent', absence: subject.absence, count, leftOut: peers.length - count };
  }
  const values: Decimal[] = [];
  for (const peer of peers) {
    if (peer.kind === 'value' && peer.source === subject.source) values.push(peer.value);
  }
  const count = values.length;
  const leftOut = peers.length - count;
  if (count < MIN_PEERS) {
    return {
      kind: 'below_floor',
      subject: subject.value,
      source: subject.source,
      absence: { reason: 'below_floor', count },
      count,
      leftOut,
    };
  }
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const lowerQuartile = percentileInc(sorted, '0.25');
  const median = percentileInc(sorted, '0.5');
  const upperQuartile = percentileInc(sorted, '0.75');
  const best =
    direction === 'none'
      ? null
      : {
          quartile: direction === 'higher_is_better' ? upperQuartile : lowerQuartile,
          percentile: percentileRank(subject.value, sorted, direction),
        };
  return {
    kind: 'compared',
    subject: subject.value,
    source: subject.source,
    count,
    leftOut,
    median,
    lowerQuartile,
    upperQuartile,
    best,
  };
}
