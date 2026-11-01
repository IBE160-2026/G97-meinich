// The page's group-and-benchmark assembly (Stories 1.8, 2.5): the group
// after funnel stage 4 minus `ekskl`, never the stage 1–3 pool, and the
// subject's own `valuta` passed to the engine, so a filing not in NOK gets no
// kroner amount.
import { describe, expect, it } from 'vitest';
import { shownGroup } from '../../src/analysis/shown-group.ts';
import type { SubjectKeyFigures } from '../../src/analysis/view.ts';

const row = (revenue: string, result: string): SubjectKeyFigures => ({
  sum_driftsinntekter_ore: revenue,
  driftsresultat_ore: result,
  sum_driftskostnad_ore: null,
  sum_eiendeler_ore: '200000000',
  sum_egenkapital_gjeld_ore: null,
  sum_egenkapital_ore: '80000000',
  sum_gjeld_ore: null,
});

// Twelve peers with margins 1 %, 2 %, …, 12 % on 1 000 000 kr revenue.
const pool = Array.from({ length: 12 }, (_, i) => ({
  orgnr: `9000000${String(i).padStart(2, '0')}`,
  keyFigures: row('100000000', String((i + 1) * 1_000_000)),
}));

// No stage 4 removal: group equals pool.
const funnel = { pool, group: pool, emptyReason: null };

// The subject: 1 % margin, worse than beste fjerdedel.
const filing = (valuta: string) => ({
  keyFigures: row('100000000', '1000000'),
  valuta,
  smaaForetak: true,
  filingYear: 2025,
});

describe('shownGroup', () => {
  it('gives a NOK subject worse than beste fjerdedel a kroner amount', () => {
    const group = shownGroup(funnel, [], filing('NOK'));
    expect(group.benchmark.driftsmargin.comparison.kind).toBe('compared');
    expect(group.benchmark.driftsmargin.gap.kind).toBe('amount');
    expect(group.valuta).toBe('NOK');
  });

  it('passes the subject’s valuta to the engine: a USD subject gets not_nok', () => {
    const group = shownGroup(funnel, [], filing('USD'));
    expect(group.benchmark.driftsmargin.comparison.kind).toBe('compared');
    expect(group.benchmark.driftsmargin.gap.kind).toBe('not_nok');
  });

  it('removes the ekskl peers from the group and from every figure', () => {
    const group = shownGroup(funnel, [pool[0]?.orgnr ?? '', pool[1]?.orgnr ?? '', pool[2]?.orgnr ?? ''], filing('NOK'));
    expect(group.peers).toHaveLength(9);
    expect(group.benchmark.driftsmargin.comparison).toMatchObject({ kind: 'below_floor', count: 9 });
    expect(group.benchmark.egenkapitalandel.comparison).toMatchObject({ kind: 'below_floor', count: 9 });
  });

  // Story 2.5, review pass 1 (triage 3): stage 4 removed two peers, so pool
  // and group differ. The shown peers and every figure use the group.
  it('shows and benchmarks the group after stage 4, not the pool', () => {
    const removed = [pool[10]?.orgnr ?? '', pool[11]?.orgnr ?? ''];
    const afterStage4 = { pool, group: pool.filter((peer) => !removed.includes(peer.orgnr)), emptyReason: null };
    const shown = shownGroup(afterStage4, [], filing('NOK'));
    expect(shown.peers.map((peer) => peer.orgnr)).toEqual(afterStage4.group.map((peer) => peer.orgnr));
    for (const orgnr of removed) expect(shown.peers.map((peer) => peer.orgnr)).not.toContain(orgnr);
    expect(shown.benchmark.driftsmargin.comparison).toMatchObject({ kind: 'compared', count: 10 });
  });

  it('carries the funnel’s empty reason', () => {
    expect(shownGroup({ pool: [], group: [], emptyReason: 'subject_no_revenue' }, [], filing('NOK')).emptyReason).toBe(
      'subject_no_revenue',
    );
  });
});
