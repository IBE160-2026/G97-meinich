// The page's group-and-benchmark assembly (Stories 1.8, 2.5, 2.7): the group
// after funnel stages 4 and 5 minus `ekskl`, never the stage 1–3 pool, and the
// subject's own `valuta` passed to the engine, so a filing not in NOK gets no
// kroner amount.
import { describe, expect, it } from 'vitest';
import { driftsmarginComparison, shownGroup } from '../../src/analysis/shown-group.ts';
import { medianStep } from '../../src/engine/closable.ts';
import type { SubjectKeyFigures } from '../../src/analysis/view.ts';
import { daysBasis, NOT_IN_DATASET, TEN_PEERS } from './document-fixture.ts';

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
  // The first ten have a read document; the last two are outside the dataset.
  documentBasis: TEN_PEERS[i] ?? NOT_IN_DATASET,
  documentReadAt: i < 10 ? new Date('2026-10-21T08:00:00Z') : null,
}));

// No stage 4 removal: group equals pool.
const counts = { stage1: 12, stage2: 12, stage3: { legalForm: 12 }, stage4: { businessModel: 12 }, stage5: { classification: 12, flagged: 0 } };
const funnel = { pool, group: pool, flagged: [], counts, emptyReason: null };

// The subject: 1 % margin, worse than beste fjerdedel.
const filing = (valuta: string) => ({
  keyFigures: row('100000000', '1000000'),
  valuta,
  regnskapsregler: 'regnskapslovenAlminneligRegler',
  smaaForetak: true,
  avviklingsregnskap: false,
  filingYear: 2025,
  // Receivable days 50, turnover 5: worse than beste fjerdedel on 9 and 11.
  documentBasis: daysBasis(50n, 5n),
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
  it('shows and benchmarks the group after stages 4 and 5, not the pool', () => {
    const removed = [pool[10]?.orgnr ?? '', pool[11]?.orgnr ?? ''];
    const afterStage4 = { pool, group: pool.filter((peer) => !removed.includes(peer.orgnr)), flagged: [], counts, emptyReason: null };
    const shown = shownGroup(afterStage4, [], filing('NOK'));
    expect(shown.peers.map((peer) => peer.orgnr)).toEqual(afterStage4.group.map((peer) => peer.orgnr));
    for (const orgnr of removed) expect(shown.peers.map((peer) => peer.orgnr)).not.toContain(orgnr);
    expect(shown.benchmark.driftsmargin.comparison).toMatchObject({ kind: 'compared', count: 10 });
  });

  it('carries the funnel’s empty reason', () => {
    expect(shownGroup({ pool: [], group: [], flagged: [], counts, emptyReason: 'subject_no_revenue' }, [], filing('NOK')).emptyReason).toBe(
      'subject_no_revenue',
    );
  });

  // Story 2.10 (R3): the sentence for subject_field_not_stated names the first unstated field.
  it('gives the first stage-2 field the subject leaves unstated, or null', () => {
    expect(shownGroup(funnel, [], filing('NOK')).unstatedField).toBeNull();
    expect(shownGroup(funnel, [], { ...filing('NOK'), smaaForetak: null, avviklingsregnskap: null }).unstatedField).toBe('smaaForetak');
  });

  // Story 2.7: the Peers tab shows the funnel's counts and tags its flagged peers.
  it('passes the funnel’s stage counts and flagged orgnrs through', () => {
    const flaggedCounts = { ...counts, stage5: { classification: 12, flagged: 1 } };
    const flagged = [pool[3]?.orgnr ?? ''];
    const shown = shownGroup({ ...funnel, counts: flaggedCounts, flagged }, [pool[0]?.orgnr ?? ''], filing('NOK'));
    expect(shown.counts).toEqual(flaggedCounts);
    expect(shown.flagged).toBe(flagged);
  });

  // Story 2.8 (triage row 13 of Story 2.7): an excluded flagged peer is not
  // in the analysis, so the funnel's flagged count leaves it out; the row
  // keeps its tag, so `flagged` keeps it.
  it('counts flagged among the peers in the analysis', () => {
    const flaggedCounts = { ...counts, stage5: { classification: 12, flagged: 2 } };
    const flagged = [pool[3]?.orgnr ?? '', pool[5]?.orgnr ?? ''];
    const ekskl = [pool[3]?.orgnr ?? '', pool[4]?.orgnr ?? ''];
    const shown = shownGroup({ ...funnel, counts: flaggedCounts, flagged }, ekskl, filing('NOK'));
    expect(shown.counts.stage5).toEqual({ classification: 12, flagged: 1 });
    expect(shown.counts.stage4).toEqual(flaggedCounts.stage4);
    expect(shown.flagged).toEqual(flagged);
    expect(shown.excludedInGroup).toEqual(ekskl);
    expect(shown.analysisCount).toBe(10);
  });

  it('keeps every member of the group, excluded peers included, and leaves an ekskl peer stage 4 removed out of excludedInGroup', () => {
    const removed = pool[11]?.orgnr ?? '';
    const afterStage4 = { ...funnel, group: pool.filter((peer) => peer.orgnr !== removed) };
    const ekskl = [pool[2]?.orgnr ?? '', removed].sort();
    const shown = shownGroup(afterStage4, ekskl, filing('NOK'));
    expect(shown.members.map((peer) => peer.orgnr)).toEqual(afterStage4.group.map((peer) => peer.orgnr));
    expect(shown.excludedInGroup).toEqual([pool[2]?.orgnr]);
    expect(shown.peers).toHaveLength(10);
    expect(shown.analysisCount).toBe(10);
  });

  // Story 2.8 (FR-19): a figure crosses the 10-peer floor both ways.
  it('crosses the 10-peer floor both ways', () => {
    const ten = { ...funnel, group: pool.slice(0, 10) };
    const before = shownGroup(ten, [], filing('NOK'));
    expect(before.benchmark.driftsmargin.comparison).toMatchObject({ kind: 'compared', count: 10 });
    const excluded = shownGroup(ten, [pool[0]?.orgnr ?? ''], filing('NOK'));
    expect(excluded.benchmark.driftsmargin.comparison).toMatchObject({ kind: 'below_floor', count: 9 });
    expect(excluded.benchmark.driftsmargin.gap.kind).not.toBe('amount');
    const restored = shownGroup(ten, [], filing('NOK'));
    expect(restored.benchmark).toEqual(before.benchmark);
    // Story 3.2: total asset turnover is benchmarked over the same peers, the group minus ekskl.
    expect(before.turnoverBenchmark.comparison).toMatchObject({ kind: 'compared', count: 10 });
    expect(excluded.turnoverBenchmark.comparison).toMatchObject({ kind: 'below_floor', count: 9 });
  });

  // Story 3.1b: the document figures from each company's document basis,
  // against the same peers as the API figures.
  it('benchmarks the document figures against the group minus ekskl, from each document basis', () => {
    const shown = shownGroup(funnel, [], filing('NOK'));
    // Ten peers with a read document, two outside the dataset: left out.
    expect(shown.documentBenchmark.kfd.comparison).toMatchObject({ kind: 'compared', count: 10, leftOut: 2 });
    expect(shown.documentBenchmark.kfd.gap.kind).toBe('amount');
    const excluded = shownGroup(funnel, [pool[0]?.orgnr ?? ''], filing('NOK'));
    expect(excluded.documentBenchmark.kfd.comparison).toMatchObject({ kind: 'below_floor', count: 9, leftOut: 2 });
    // The subject's own valuta: no capital amount outside NOK.
    expect(shownGroup(funnel, [], filing('USD')).documentBenchmark.kfd.gap.kind).toBe('not_nok');
    // The subject's own basis: outside the dataset, every document figure is absent.
    const outside = shownGroup(funnel, [], { ...filing('NOK'), documentBasis: NOT_IN_DATASET });
    expect(outside.documentBenchmark.kfd.comparison).toMatchObject({ kind: 'subject_absent', absence: { reason: 'not_in_dataset' } });
  });
});

// Story 3.5, review: the URL module's median-step predicate reads the
// subject's driftsmargin compared with the group minus `ekskl`, the same
// comparison shownGroup shows.
describe('driftsmarginComparison', () => {
  // Eleven peers with margins 1, 2, 3, 4, 4.5, 5, 7, 10, 11, 12 and 13 %; the subject at 4.8 %.
  const margins = [1_000_000, 2_000_000, 3_000_000, 4_000_000, 4_500_000, 5_000_000, 7_000_000, 10_000_000, 11_000_000, 12_000_000, 13_000_000];
  const eleven = margins.map((result, i) => ({
    orgnr: `9100000${String(i).padStart(2, '0')}`,
    keyFigures: row('100000000', String(result)),
    documentBasis: NOT_IN_DATASET,
    documentReadAt: null,
  }));
  const elevenFunnel = { pool: eleven, group: eleven, flagged: [], counts, emptyReason: null };
  const subject = { ...filing('NOK'), keyFigures: row('100000000', '4800000') };
  const top = eleven[10]?.orgnr ?? '';

  it('is shownGroup’s driftsmargin comparison, with and without an ekskl that removes the median step', () => {
    // The fixture's state: with all eleven the median is 5 % (r < M < T); without the 13 % peer
    // it is 4.75 %, below the subject's 4.8 %, still above the floor.
    const all = shownGroup(elevenFunnel, [], subject).benchmark.driftsmargin.comparison;
    const without = shownGroup(elevenFunnel, [top], subject).benchmark.driftsmargin.comparison;
    expect(all).toMatchObject({ kind: 'compared', count: 11 });
    expect(without).toMatchObject({ kind: 'compared', count: 10 });
    if (all.kind !== 'compared' || without.kind !== 'compared') throw new Error('both compared');
    expect(all.median.eq('0.05')).toBe(true);
    expect(without.median.eq('0.0475')).toBe(true);
    expect(driftsmarginComparison(elevenFunnel, [], subject)).toEqual(all);
    expect(driftsmarginComparison(elevenFunnel, [top], subject)).toEqual(without);
    expect(medianStep(driftsmarginComparison(elevenFunnel, [], subject)).kind).toBe('exists');
    expect(medianStep(driftsmarginComparison(elevenFunnel, [top], subject))).toEqual({ kind: 'none', reason: 'above_median' });
  });
});
