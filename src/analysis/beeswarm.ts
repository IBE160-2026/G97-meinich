// The driftsmargin beeswarm on Oversikt as a view (Story 3.4, decisions 4–6;
// FR-27; EXPERIENCE.md "Beeswarm"; DESIGN.md "Beeswarm"; spec Design Notes,
// "Beeswarm geometry"): every peer in the analysis with a driftsmargin as a
// dot, the company as its marker, the median and beste fjerdedel, the five
// nearest peers and the "Vis tallene" table.
//
// - Domain: [P5, P95] of the peers' driftsmargin (decision 4), through the
//   engine's `stripPosition` (not mirrored: higher is better). A peer
//   outside it is a dot in the edge column on its side; the company outside
//   it sits at the axis end with the outward chevron. Legend and summary
//   carry the true values.
// - Packing: dots in exact driftsmargin order, then orgnr; each takes the
//   smallest vertical offset in 0, +s, −s, +2s, … at which its centre is at
//   least 2r + gap from every placed dot. A swarm taller than its maximum is
//   packed again with a smaller radius, down to 2 units, and then grows.
// - Nearest five (decision 5): by |peer − company| in exact driftsmargin,
//   ties in the Peers list's order; shown by driftsmargin, highest first,
//   with the company's own row in its place.
// - No driftsmargin (decision 6): not in the plot, last in "Vis tallene"
//   with the Peers list's words, and counted under the plot (K7).
//
// Pure, and a payload boundary (AD-4): the orgnrs and exact margins stay
// here. Out go strings (through `peerMarginText`/`peerRevenueText`, the
// Peers list's own, so a peer's values read the same everywhere) and plot
// coordinates as Numbers, which are geometry only.
import { stripPosition } from '../engine/benchmark.ts';
import { Decimal } from '../engine/decimal.ts';
import { formatOrgnr, formatPercent, formatWholePercent } from '../engine/format.ts';
import { apiInputsFromRow } from '../engine/inputs.ts';
import { computeApiKeyFigures } from '../engine/key-figures.ts';
import { MIN_PEERS, type Comparison } from '../engine/types.ts';
import { t } from '../messages/index.ts';
import { absenceText } from './figure-text.ts';
import { peerMarginText, peerRevenueText } from './peer-rows.ts';
import type { ShownGroup } from './shown-group.ts';
import type { SubjectKeyFigures } from './view.ts';

type Compared = Extract<Comparison, { readonly kind: 'compared' }>;

/** One layout's fixed geometry, in viewBox units (spec Design Notes, "Beeswarm geometry"). */
export type LayoutSpec = {
  readonly width: number;
  /** The axis, P5 to P95. */
  readonly axisFrom: number;
  readonly axisTo: number;
  /** The edge columns' x, below P5 and above P95. */
  readonly edgeLow: number;
  readonly edgeHigh: number;
  /** The dot radius before any step down. */
  readonly radius: number;
  readonly gap: number;
  /** The swarm's height before the radius steps down. */
  readonly maxHeight: number;
  /** How many axis ticks at most. */
  readonly maxTicks: number;
};

export const DESKTOP: LayoutSpec = {
  width: 640,
  axisFrom: 16,
  axisTo: 624,
  edgeLow: 8,
  edgeHigh: 632,
  radius: 4,
  gap: 1,
  maxHeight: 240,
  maxTicks: 5,
};

export const PHONE: LayoutSpec = {
  width: 320,
  axisFrom: 12,
  axisTo: 308,
  edgeLow: 6,
  edgeHigh: 314,
  radius: 3.5,
  gap: 1,
  maxHeight: 200,
  maxTicks: 3,
};

/** The vertical step between candidate offsets. */
export const STEP = 0.5;
/** The radius steps down by this much while the swarm is too tall. */
export const RADIUS_STEP = 0.5;
/** It never steps below this. */
export const MIN_RADIUS = 2;
/** Room above the swarm (the company's name) and below it (the axis and its ticks). */
export const ABOVE = 28;
export const BELOW = 24;
/**
 * The swarm area is at least this tall, so a small, spread-out group still
 * has room for the median tick and the company's line (Story 3.4,
 * Implementation Notes).
 */
export const MIN_SWARM = 48;

/** A dot to pack: an id that orders ties (the orgnr, server only) and its exact value. */
export type SwarmInput = { readonly key: string; readonly value: Decimal };

export type PackedSwarm = {
  readonly radius: number;
  /** The swarm's own height: highest dot top to lowest dot bottom. */
  readonly height: number;
  /** In packing order (value, then key): each dot's x and its offset from the centre line (positive is up). */
  readonly dots: readonly { readonly key: string; readonly x: number; readonly offset: number }[];
};

/** The order every dot is taken in: exact value, then key. */
function packingOrder(a: SwarmInput, b: SwarmInput): number {
  const byValue = a.value.comparedTo(b.value);
  if (byValue !== 0) return byValue;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** A value's x on a layout: the edge column outside [P5, P95], otherwise its share of the axis. */
export function dotX(value: Decimal, domain: Compared, spec: LayoutSpec): number {
  const position = stripPosition(value, domain, 'higher_is_better');
  if (position.clipped === 'low') return spec.edgeLow;
  if (position.clipped === 'high') return spec.edgeHigh;
  return spec.axisFrom + position.at.toNumber() * (spec.axisTo - spec.axisFrom);
}

/**
 * The smallest grid offset (in steps) free of every forbidden range, in the
 * order 0, +1, −1, +2, −2, …. `ranges` are inclusive [lo, hi] step ranges,
 * merged and sorted by lo.
 */
function firstFree(ranges: readonly (readonly [number, number])[]): number {
  let up = 0;
  for (const [lo, hi] of ranges) {
    if (hi < up) continue;
    if (lo <= up) up = hi + 1;
    else break;
  }
  let down = 0;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const [lo, hi] = ranges[i] as readonly [number, number];
    if (lo > down) continue;
    if (hi >= down) down = lo - 1;
    else break;
  }
  return up <= -down ? up : down;
}

/** Packs at one radius; the dots must come with non-decreasing x. */
function packAt(xs: readonly number[], radius: number, gap: number): number[] {
  const distance = 2 * radius + gap;
  const placed: { readonly x: number; readonly y: number }[] = [];
  const offsets: number[] = [];
  for (const x of xs) {
    const ranges: [number, number][] = [];
    for (let i = placed.length - 1; i >= 0; i -= 1) {
      const other = placed[i] as { readonly x: number; readonly y: number };
      const dx = x - other.x;
      if (dx >= distance) break;
      // Forbidden: |y − other.y| < h, the open interval; its boundary is allowed (a distance of exactly 2r + gap).
      const h = Math.sqrt(distance * distance - dx * dx);
      const lo = Math.floor((other.y - h) / STEP + 1e-9) + 1;
      const hi = Math.ceil((other.y + h) / STEP - 1e-9) - 1;
      if (lo <= hi) ranges.push([lo, hi]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last !== undefined && range[0] <= last[1] + 1) last[1] = Math.max(last[1], range[1]);
      else merged.push([range[0], range[1]]);
    }
    const y = firstFree(merged) * STEP;
    placed.push({ x, y });
    offsets.push(y);
  }
  return offsets;
}

function heightOf(offsets: readonly number[], radius: number): number {
  let top = 0;
  let bottom = 0;
  for (const offset of offsets) {
    if (offset > top) top = offset;
    if (offset < bottom) bottom = offset;
  }
  return top - bottom + 2 * radius;
}

/**
 * The swarm on one layout: every dot packed, the radius stepped down while
 * the swarm is taller than `spec.maxHeight`, to `MIN_RADIUS`; if it still
 * does not fit, it grows past the maximum. No dot is dropped. The input's
 * order does not matter.
 */
export function packSwarm(inputs: readonly SwarmInput[], domain: Compared, spec: LayoutSpec): PackedSwarm {
  const sorted = [...inputs].sort(packingOrder);
  const xs = sorted.map((input) => dotX(input.value, domain, spec));
  for (let i = 1; i < xs.length; i += 1) {
    // Value order is x order: the edge columns lie outside the axis on their own side.
    if ((xs[i] as number) < (xs[i - 1] as number)) throw new Error('packSwarm: x must follow the value order');
  }
  let radius = spec.radius;
  let offsets = packAt(xs, radius, spec.gap);
  while (heightOf(offsets, radius) > spec.maxHeight && radius - RADIUS_STEP >= MIN_RADIUS) {
    radius -= RADIUS_STEP;
    offsets = packAt(xs, radius, spec.gap);
  }
  return {
    radius,
    height: heightOf(offsets, radius),
    dots: sorted.map((input, i) => ({ key: input.key, x: xs[i] as number, offset: offsets[i] as number })),
  };
}

/** A text on the plot. */
export type PlotText = { readonly x: number; readonly text: string; readonly anchor: 'start' | 'middle' | 'end' };

/** One layout as drawn: every coordinate in viewBox units. */
export type SwarmLayout = {
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  /** The swarm area, top to bottom. */
  readonly swarmTop: number;
  readonly swarmBottom: number;
  readonly axis: { readonly from: number; readonly to: number; readonly y: number };
  /** Each plotted peer's centre, indexed as `BeeswarmView.entries`. */
  readonly dots: readonly { readonly x: number; readonly y: number }[];
  /** The company's marker on the axis; `clipped` names the side it fell outside, where the chevron points. */
  readonly company: { readonly x: number; readonly clipped: 'low' | 'high' | null; readonly label: PlotText };
  readonly median: number;
  readonly best: number;
  /** The edge columns' counts, under each column; null for an empty column. */
  readonly edges: { readonly low: PlotText | null; readonly high: PlotText | null };
  /** Gridlines and their labels. */
  readonly ticks: readonly PlotText[];
};

/** A row of the compact list or the "Vis tallene" table. */
export type MarginRow = {
  readonly name: string;
  readonly margin: string;
  readonly revenue: string;
  /** The company's own row, marked "(valgt selskap)". */
  readonly selected: boolean;
};

export type BeeswarmView =
  | { readonly kind: 'absent'; readonly heading: string; readonly text: string }
  | {
      readonly kind: 'shown';
      readonly heading: string;
      /** The image's aria-label (C5). */
      readonly summary: string;
      readonly legend: {
        readonly company: string;
        readonly median: string;
        readonly best: string;
        /** "Prikkene ved kantene …", only when an edge column holds a dot. */
        readonly edge: string | null;
      };
      readonly betterRight: string;
      /** K7, when some peer in the analysis has no driftsmargin. */
      readonly noMargin: string | null;
      /** Each plotted peer's tooltip, in packing order: the dots of both layouts are indexed by it. */
      readonly entries: readonly { readonly name: string; readonly margin: string; readonly revenue: string }[];
      readonly layouts: { readonly desktop: SwarmLayout; readonly phone: SwarmLayout };
      readonly nearest: { readonly caption: string; readonly rows: readonly MarginRow[]; readonly seeAll: string };
      readonly table: {
        readonly caption: string;
        readonly heads: { readonly name: string; readonly margin: string; readonly revenue: string };
        readonly rows: readonly MarginRow[];
      };
      readonly selected: string;
      readonly showNumbers: string;
      readonly hideNumbers: string;
    };

/** A peer in the analysis (the group less `ekskl`), in the Peers list's order. */
export type BeeswarmPeer = {
  readonly orgnr: string;
  readonly navn: string;
  readonly sumDriftsinntekter: bigint | null;
  readonly keyFigures: SubjectKeyFigures;
};

/** A coordinate as the page receives it: to a hundredth of a unit, which no screen can show finer. Geometry only. */
const unit = (value: number): number => Math.round(value * 100) / 100;

/** Candidate tick steps, as fractions (0.001 is 0,1 pp). */
const TICK_STEPS = ['0.001', '0.002', '0.0025', '0.005', '0.01', '0.02', '0.025', '0.05', '0.1', '0.2', '0.25', '0.5', '1', '2', '5', '10', '20', '50', '100'];
/** No tick this close to an axis end, where the edge counts sit. */
const TICK_CLEARANCE = 28;

/** Round values inside [P5, P95], at most `spec.maxTicks`, each with its x. */
function ticks(domain: Compared, spec: LayoutSpec): PlotText[] {
  const { p5, p95 } = domain;
  if (p5.eq(p95)) return [{ x: (spec.axisFrom + spec.axisTo) / 2, text: formatPercent(p5.toString()), anchor: 'middle' }];
  for (const text of TICK_STEPS) {
    const step = new Decimal(text);
    const first = p5.div(step).ceil();
    const last = p95.div(step).floor();
    const count = last.minus(first).plus(1).toNumber();
    if (count > spec.maxTicks) continue;
    const out: PlotText[] = [];
    for (let i = 0; i < count; i += 1) {
      const value = first.plus(i).mul(step);
      const x = dotX(value, domain, spec);
      if (x < spec.axisFrom + TICK_CLEARANCE || x > spec.axisTo - TICK_CLEARANCE) continue;
      out.push({ x: unit(x), text: formatPercent(value.toString()), anchor: 'middle' });
    }
    // Every tick of this step fell by an axis end: try a coarser step rather than draw no gridline.
    if (out.length === 0) continue;
    return out;
  }
  return [];
}

/** The company's name above the plot: anchored so it stays inside the viewBox. */
function companyLabel(x: number, name: string, spec: LayoutSpec): PlotText {
  if (x < spec.width / 4) return { x: Math.max(x - 6, 2), text: name, anchor: 'start' };
  if (x > (spec.width * 3) / 4) return { x: Math.min(x + 6, spec.width - 2), text: name, anchor: 'end' };
  return { x, text: name, anchor: 'middle' };
}

/** One layout: the packed swarm placed between the label row and the axis. */
function layout(
  plotted: readonly SwarmInput[],
  order: ReadonlyMap<string, number>,
  domain: Compared,
  spec: LayoutSpec,
  subjectName: string,
): SwarmLayout {
  const swarm = packSwarm(plotted, domain, spec);
  const area = Math.max(swarm.height, MIN_SWARM);
  const top = Math.max(...swarm.dots.map((dot) => dot.offset), 0);
  const pad = (area - swarm.height) / 2;
  const dots: { x: number; y: number }[] = new Array<{ x: number; y: number }>(plotted.length);
  for (const dot of swarm.dots) {
    const index = order.get(dot.key);
    if (index === undefined) throw new Error('a packed dot has no entry');
    dots[index] = { x: unit(dot.x), y: unit(ABOVE + pad + swarm.radius + (top - dot.offset)) };
  }
  const own = stripPosition(domain.subject, domain, 'higher_is_better');
  const companyX = unit(spec.axisFrom + own.at.toNumber() * (spec.axisTo - spec.axisFrom));
  const lows = swarm.dots.filter((dot) => dot.x === spec.edgeLow).length;
  const highs = swarm.dots.filter((dot) => dot.x === spec.edgeHigh).length;
  const axisY = ABOVE + area + 5;
  const at = (value: Decimal) => unit(spec.axisFrom + stripPosition(value, domain, 'higher_is_better').at.toNumber() * (spec.axisTo - spec.axisFrom));
  if (domain.best === null) throw new Error('a compared driftsmargin has a beste fjerdedel');
  return {
    width: spec.width,
    height: unit(ABOVE + area + BELOW),
    radius: swarm.radius,
    swarmTop: ABOVE,
    swarmBottom: unit(ABOVE + area),
    axis: { from: spec.axisFrom, to: spec.axisTo, y: unit(axisY) },
    dots,
    company: { x: companyX, clipped: own.clipped, label: companyLabel(companyX, subjectName, spec) },
    median: at(domain.median),
    best: at(domain.best.quartile),
    edges: {
      low: lows === 0 ? null : { x: 2, text: t('oversikt.beeswarm.edgeLow', { k: String(lows) }), anchor: 'start' },
      high: highs === 0 ? null : { x: spec.width - 2, text: t('oversikt.beeswarm.edgeHigh', { k: String(highs) }), anchor: 'end' },
    },
    ticks: ticks(domain, spec),
  };
}

/** A peer's exact driftsmargin, as the benchmark computes it; null when undefined. */
function exactMargin(keyFigures: SubjectKeyFigures): Decimal | null {
  const result = computeApiKeyFigures(apiInputsFromRow(keyFigures)).driftsmargin;
  return result.kind === 'value' ? result.value : null;
}

/**
 * The beeswarm card. `comparison` is the shown group's driftsmargin
 * comparison (the hero's); `peers` the peers in the analysis, in the Peers
 * list's order; `empty` the empty group's sentence (the hero's), when the
 * group is empty for the subject's own reason.
 */
export function beeswarmView({
  comparison,
  peers,
  subject,
  valuta,
  filingYear,
  analysisCount,
  empty,
  absent,
}: {
  readonly comparison: Comparison;
  readonly peers: readonly BeeswarmPeer[];
  readonly subject: { readonly name: string; readonly keyFigures: SubjectKeyFigures; readonly sumDriftsinntekter: bigint | null };
  readonly valuta: string | null;
  readonly filingYear: number;
  /** "Se alle {n}": the peers in the analysis. */
  readonly analysisCount: number;
  readonly empty: string | null;
  /** The words for a driftsmargin with no comparison: below the floor, or the own value's absence. */
  readonly absent: string;
}): BeeswarmView {
  const heading = t('oversikt.beeswarm.heading');
  if (empty !== null) return { kind: 'absent', heading, text: empty };
  if (comparison.kind !== 'compared' || comparison.best === null) return { kind: 'absent', heading, text: absent };
  const domain: Compared = comparison;
  const best = comparison.best;

  // Each peer's exact margin once, then split: those drawn, and those without one.
  const margins = peers.map((peer, index) => ({ peer, index, value: exactMargin(peer.keyFigures) }));
  const withMargin = margins.flatMap(({ peer, index, value }) => (value === null ? [] : [{ peer, index, value }]));
  const without = margins.filter(({ value }) => value === null).map(({ peer }) => peer);
  const row = (peer: BeeswarmPeer): MarginRow => ({
    name: peer.navn,
    margin: peerMarginText(peer.keyFigures, filingYear),
    revenue: peerRevenueText(peer.sumDriftsinntekter, valuta),
    selected: false,
  });
  const own: MarginRow = {
    name: subject.name,
    margin: peerMarginText(subject.keyFigures, filingYear),
    revenue: peerRevenueText(subject.sumDriftsinntekter, valuta),
    selected: true,
  };

  // Packing order: exact value, then orgnr; the entries follow it, so dot i of either layout is entry i.
  const plotted: SwarmInput[] = withMargin.map(({ peer, value }) => ({ key: peer.orgnr, value }));
  const packed = [...withMargin].sort((a, b) => packingOrder({ key: a.peer.orgnr, value: a.value }, { key: b.peer.orgnr, value: b.value }));
  const order = new Map(packed.map(({ peer }, i) => [peer.orgnr, i]));
  const entries = packed.map(({ peer }) => {
    const r = row(peer);
    return { name: r.name, margin: r.margin, revenue: t('oversikt.beeswarm.revenue', { v: r.revenue }) };
  });

  // Highest driftsmargin first; equal margins in the Peers list's order, the company first among them.
  type Plotted = (typeof withMargin)[number];
  const withCompany = (items: readonly Plotted[]): MarginRow[] => {
    const rows: MarginRow[] = [];
    let placed = false;
    for (const item of [...items].sort((a, b) => b.value.comparedTo(a.value) || a.index - b.index)) {
      if (!placed && domain.subject.gte(item.value)) {
        rows.push(own);
        placed = true;
      }
      rows.push(row(item.peer));
    }
    if (!placed) rows.push(own);
    return rows;
  };

  // The five nearest: distance exact, ties in the Peers list's order.
  const nearest = [...withMargin]
    .sort((a, b) => a.value.minus(domain.subject).abs().comparedTo(b.value.minus(domain.subject).abs()) || a.index - b.index)
    .slice(0, 5);

  const desktop = layout(plotted, order, domain, DESKTOP, subject.name);
  const phone = layout(plotted, order, domain, PHONE, subject.name);
  const pct = (value: Decimal) => formatPercent(value.toString());
  const edgeShown = desktop.edges.low !== null || desktop.edges.high !== null;

  return {
    kind: 'shown',
    heading,
    summary: t('oversikt.beeswarm.summary', {
      n: String(domain.count),
      selskap: subject.name,
      own: pct(domain.subject),
      median: pct(domain.median),
      best: pct(best.quartile),
      plassering: formatWholePercent(best.percentile.toString()),
    }),
    legend: {
      company: t('oversikt.beeswarm.legend.company', { selskap: subject.name, v: pct(domain.subject) }),
      median: t('oversikt.beeswarm.legend.median', { v: pct(domain.median) }),
      best: t('oversikt.beeswarm.legend.best', { v: pct(best.quartile) }),
      edge: edgeShown ? t('oversikt.beeswarm.edgeLegend') : null,
    },
    betterRight: t('keyFigures.betterRight'),
    noMargin: without.length === 0 ? null : t('oversikt.beeswarm.noMargin', { k: String(without.length) }),
    entries,
    layouts: { desktop, phone },
    nearest: {
      caption: t('oversikt.beeswarm.nearest'),
      rows: withCompany(nearest),
      seeAll: t('oversikt.beeswarm.seeAll', { n: String(analysisCount) }),
    },
    table: {
      caption: t('oversikt.beeswarm.caption'),
      heads: { name: t('peers.col.selskap'), margin: t('fig.driftsmargin'), revenue: t('peers.col.omsetning') },
      rows: [...withCompany(withMargin), ...without.map(row)],
    },
    selected: t('oversikt.beeswarm.selected'),
    showNumbers: t('chart.showNumbers'),
    hideNumbers: t('chart.hideNumbers'),
  };
}

/** What the beeswarm reads of a peer in the shown group (a `Candidate` on the server). */
export type GroupPeer = {
  readonly orgnr: string;
  readonly navn: string | null;
  readonly sumDriftsinntekter: bigint | null;
  readonly keyFigures: SubjectKeyFigures;
};

/**
 * The beeswarm for the shown group (decision 6): it draws `group.peers`, the
 * group less `ekskl`, the same peers the benchmark uses, in the Peers list's
 * order, against the hero's driftsmargin comparison. `empty` is the empty
 * group's sentence, as the hero gives it, or null.
 */
export function groupBeeswarm<P extends GroupPeer>(
  group: Pick<ShownGroup<P>, 'peers' | 'benchmark' | 'valuta' | 'filingYear' | 'analysisCount'>,
  subject: { readonly name: string; readonly keyFigures: SubjectKeyFigures },
  empty: string | null,
): BeeswarmView {
  const comparison = group.benchmark.driftsmargin.comparison;
  let absent: string;
  if (comparison.kind === 'below_floor') {
    absent = t('keyFigures.belowFloor', { n: String(comparison.count), min: String(MIN_PEERS) });
  } else if (comparison.kind === 'subject_absent') {
    absent = absenceText(comparison.absence, { denominator: 'analysis.figures.reason.revenueNotPositive', filingYear: group.filingYear });
  } else if (comparison.best === null) {
    // Driftsmargin has a direction, so a compared one always has a beste fjerdedel.
    throw new Error('groupBeeswarm: a compared driftsmargin without beste fjerdedel');
  } else {
    // Compared: the plot is drawn, and no absence sentence is shown.
    absent = '';
  }
  return beeswarmView({
    comparison,
    peers: group.peers.map((peer) => ({
      orgnr: peer.orgnr,
      navn: peer.navn ?? formatOrgnr(peer.orgnr),
      sumDriftsinntekter: peer.sumDriftsinntekter,
      keyFigures: peer.keyFigures,
    })),
    subject: {
      name: subject.name,
      keyFigures: subject.keyFigures,
      sumDriftsinntekter: apiInputsFromRow(subject.keyFigures).sumDriftsinntekter,
    },
    valuta: group.valuta,
    filingYear: group.filingYear,
    analysisCount: group.analysisCount,
    empty,
    absent,
  });
}
