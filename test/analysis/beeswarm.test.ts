// The beeswarm's geometry (Story 3.4, decision 4; spec Design Notes,
// "Beeswarm geometry"): packing, the swarm that is too tall, and peers and
// the company outside P5–P95. Every fixture is synthetic: seeded random
// groups (a fixed seed, so a failure can be rerun) and hand-made ones.
import { describe, expect, it } from 'vitest';
import {
  ABOVE,
  BELOW,
  DESKTOP,
  MIN_RADIUS,
  MIN_SWARM,
  PHONE,
  beeswarmView,
  packSwarm,
  type BeeswarmPeer,
  type LayoutSpec,
  type PackedSwarm,
  type SwarmInput,
} from '../../src/analysis/beeswarm.ts';
import { Decimal } from '../../src/engine/decimal.ts';
import { compareFigure } from '../../src/engine/statistics.ts';
import type { Comparison } from '../../src/engine/types.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };

type Compared = Extract<Comparison, { readonly kind: 'compared' }>;

/** A comparison of `subject` against `values`, as the engine makes it for driftsmargin. */
function compared(subject: string, values: readonly string[]): Compared {
  const result = (value: string) => ({
    kind: 'value' as const,
    value: new Decimal(value),
    source: 'api' as const,
    denominatorDerived: false,
    inputs: [],
  });
  const c = compareFigure(result(subject), values.map(result), 'higher_is_better');
  if (c.kind !== 'compared') throw new Error('the fixture is not compared');
  return c;
}

/** Mulberry32: a small seeded generator, so every run draws the same groups. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const orgnr = (i: number) => String(900_000_000 + i);

/** The closest pair's distance, less 2r + gap: never negative when nothing overlaps. */
function worstClearance(swarm: PackedSwarm, spec: LayoutSpec): number {
  const distance = 2 * swarm.radius + spec.gap;
  let worst = Number.POSITIVE_INFINITY;
  const dots = swarm.dots;
  for (let i = 0; i < dots.length; i += 1) {
    for (let j = i + 1; j < dots.length; j += 1) {
      const a = dots[i];
      const b = dots[j];
      if (a === undefined || b === undefined) continue;
      const d = Math.hypot(a.x - b.x, a.offset - b.offset);
      worst = Math.min(worst, d - distance);
    }
  }
  return worst;
}

/** A random group: 10–60 peers, margins drawn from a few shapes (spread, clustered, with ties and outliers). */
function randomGroup(next: () => number): { readonly inputs: SwarmInput[]; readonly domain: Compared } {
  const n = 10 + Math.floor(next() * 51);
  const shape = Math.floor(next() * 3);
  const values = Array.from({ length: n }, () => {
    if (shape === 0) return (next() * 0.6 - 0.3).toFixed(4);
    if (shape === 1) return (Math.round(next() * 8) / 100 - 0.04).toFixed(4);
    return next() < 0.15 ? (next() * 4 - 2).toFixed(4) : (next() * 0.1).toFixed(4);
  });
  const subject = (next() * 0.8 - 0.4).toFixed(4);
  return {
    inputs: values.map((value, i) => ({ key: orgnr(i), value: new Decimal(value) })),
    domain: compared(subject, values),
  };
}

describe('packing', () => {
  const next = random(20261119);
  const cases = Array.from({ length: 1000 }, () => randomGroup(next));

  for (const [name, spec] of [
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ] as const) {
    it(`packing: no two dots closer than 2r + gap, 1 000 seeded groups (${name})`, () => {
      // Fixture: 1 000 random groups of 10–60 peers from a fixed seed, three shapes of margin.
      let worst = Number.POSITIVE_INFINITY;
      for (const { inputs, domain } of cases) {
        const swarm = packSwarm(inputs, domain, spec);
        expect(swarm.dots).toHaveLength(inputs.length);
        worst = Math.min(worst, worstClearance(swarm, spec));
      }
      expect(worst).toBeGreaterThanOrEqual(-1e-6);
    });

    it(`packing: the same input gives the same output, in any order (${name})`, () => {
      // Fixture: the first 200 seeded groups, each packed as given, again, and reversed.
      for (const { inputs, domain } of cases.slice(0, 200)) {
        const first = packSwarm(inputs, domain, spec);
        expect(packSwarm(inputs, domain, spec)).toEqual(first);
        expect(packSwarm([...inputs].reverse(), domain, spec)).toEqual(first);
      }
    });
  }

  it('packing: the first offsets follow 0, +s, −s, +2s in value order, then orgnr', () => {
    // Fixture: three peers with one equal value, so each must step off the centre line.
    const values = ['0.05', '0.05', '0.05', '0.1', '0.1', '0.1', '0.1', '0.1', '0.2', '0.3'];
    const domain = compared('0.1', values);
    const swarm = packSwarm(
      ['900000003', '900000001', '900000002'].map((key) => ({ key, value: new Decimal('0.05') })),
      domain,
      DESKTOP,
    );
    expect(swarm.dots.map((dot) => dot.key)).toEqual(['900000001', '900000002', '900000003']);
    // 2r + gap = 9: the second sits 9 above, the third 9 below.
    expect(swarm.dots.map((dot) => dot.offset)).toEqual([0, 9, -9]);
  });
});

describe('a swarm too tall', () => {
  it('a swarm too tall shrinks, then grows', () => {
    // Fixture: 2 000 peers with the same driftsmargin and ten spread out, so the domain is not a point.
    const equal = Array.from({ length: 2000 }, (_, i) => ({ key: orgnr(i), value: new Decimal('0.05') }));
    const values = [...Array.from({ length: 2000 }, () => '0.05'), '-0.2', '0.3'];
    const domain = compared('0.05', values);
    for (const spec of [DESKTOP, PHONE]) {
      const swarm = packSwarm(equal, domain, spec);
      // The radius stepped down to its minimum, and the swarm still grew past the maximum.
      expect(swarm.radius).toBe(MIN_RADIUS);
      expect(swarm.height).toBeGreaterThan(spec.maxHeight);
      expect(swarm.dots).toHaveLength(2000);
      // One column: every centre exactly 2r + gap from the next, none overlapping.
      const offsets = swarm.dots.map((dot) => dot.offset).sort((a, b) => a - b);
      for (let i = 1; i < offsets.length; i += 1) {
        expect((offsets[i] ?? 0) - (offsets[i - 1] ?? 0)).toBeGreaterThanOrEqual(2 * MIN_RADIUS + spec.gap - 1e-9);
      }
    }
  });

  it('a swarm that fits at a smaller radius keeps the largest radius that fits', () => {
    // Fixture: 30 equal values: 30 × 9 = 270 > 240 at r 4; at r 3.5, 30 × 8 = 240 fits on the desktop.
    const equal = Array.from({ length: 30 }, (_, i) => ({ key: orgnr(i), value: new Decimal('0.05') }));
    const domain = compared('0.05', [...Array.from({ length: 30 }, () => '0.05'), '-0.2', '0.3']);
    const swarm = packSwarm(equal, domain, DESKTOP);
    expect(swarm.radius).toBe(3.5);
    expect(swarm.height).toBeLessThanOrEqual(DESKTOP.maxHeight);
  });
});

describe('clipped peers and the company', () => {
  const peer = (i: number, margin: string): BeeswarmPeer => ({
    orgnr: orgnr(i),
    navn: `Peer ${i}`,
    sumDriftsinntekter: 100_000_000n,
    keyFigures: {
      sum_driftsinntekter_ore: '100000000',
      driftsresultat_ore: new Decimal(margin).mul(100_000_000).toFixed(0),
      sum_driftskostnad_ore: null,
      sum_eiendeler_ore: '200000000',
      sum_egenkapital_gjeld_ore: null,
      sum_egenkapital_ore: '80000000',
      sum_gjeld_ore: null,
    },
  });

  it('clipped peers and company', () => {
    // Fixture: 20 peers from −0,30 to +0,65 in steps of 0,05, so P5 and P95 leave one peer
    // outside each end; the company at −0,50, below every peer.
    const margins = Array.from({ length: 20 }, (_, i) => (i * 0.05 - 0.3).toFixed(2));
    const peers = margins.map((margin, i) => peer(i, margin));
    const subject = peer(99, '-0.5');
    const comparison = compared('-0.5', margins);
    const view = beeswarmView({
      comparison,
      peers,
      subject: { name: 'Selskapet', keyFigures: subject.keyFigures, sumDriftsinntekter: subject.sumDriftsinntekter },
      valuta: 'NOK',
      filingYear: 2025,
      analysisCount: peers.length,
      empty: null,
      absent: '',
    });
    if (view.kind !== 'shown') throw new Error('the fixture is shown');
    for (const [spec, plot] of [
      [DESKTOP, view.layouts.desktop],
      [PHONE, view.layouts.phone],
    ] as const) {
      // P5 = −0,2525, P95 = 0,6025: −0,30 is below, 0,65 above, each in its edge column.
      expect(plot.dots.filter((dot) => dot.x === spec.edgeLow)).toHaveLength(1);
      expect(plot.dots.filter((dot) => dot.x === spec.edgeHigh)).toHaveLength(1);
      expect(plot.edges.low?.text).toBe(nb['oversikt.beeswarm.edgeLow'].replace('{k}', '1'));
      expect(plot.edges.high?.text).toBe(nb['oversikt.beeswarm.edgeHigh'].replace('{k}', '1'));
      // The company at the axis end, with the outward chevron's side.
      expect(plot.company.x).toBe(spec.axisFrom);
      expect(plot.company.clipped).toBe('low');
      // Every in-domain dot on the axis, and the SVG's height follows the swarm.
      for (const dot of plot.dots) {
        if (dot.x === spec.edgeLow || dot.x === spec.edgeHigh) continue;
        expect(dot.x).toBeGreaterThanOrEqual(spec.axisFrom);
        expect(dot.x).toBeLessThanOrEqual(spec.axisTo);
      }
      expect(plot.height).toBe(ABOVE + Math.max(plot.swarmBottom - plot.swarmTop, MIN_SWARM) + BELOW);
    }
    // The legend, the summary and the edge line carry the true value.
    expect(view.legend.company).toBe('Selskapet −50,0 %');
    expect(view.summary).toContain('Selskapet −50,0 %');
    expect(view.legend.edge).toBe(nb['oversikt.beeswarm.edgeLegend']);
  });

  it('no edge column: no counts and no edge line', () => {
    // Fixture: 10 peers with two equal at each end, so P5 and P95 are those ends and no
    // peer lies outside them; the company at 0,03, inside.
    const margins = ['0', '0', '0.01', '0.02', '0.03', '0.04', '0.05', '0.06', '0.07', '0.07'];
    const peers = margins.map((margin, i) => peer(i, margin));
    const view = beeswarmView({
      comparison: compared('0.03', margins),
      peers,
      subject: { name: 'Selskapet', keyFigures: peer(99, '0.03').keyFigures, sumDriftsinntekter: 100_000_000n },
      valuta: 'NOK',
      filingYear: 2025,
      analysisCount: peers.length,
      empty: null,
      absent: '',
    });
    if (view.kind !== 'shown') throw new Error('the fixture is shown');
    expect(view.layouts.desktop.edges).toEqual({ low: null, high: null });
    expect(view.legend.edge).toBeNull();
    expect(view.layouts.desktop.company.clipped).toBeNull();
  });
});
