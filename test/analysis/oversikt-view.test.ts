// Oversikt's beeswarm over the shown group (Story 3.4, decisions 5 and 6):
// which peers it draws, the five nearest, and one Driftsmargin string per
// peer in the compact list, "Vis tallene" and the Peers list. Every company
// is synthetic: margins and revenues written out, in the Peers list's order
// (revenue descending), so each expected row can be read off the fixture.
import { describe, expect, it } from 'vitest';
import { groupBeeswarm } from '../../src/analysis/beeswarm.ts';
import { peerRows } from '../../src/analysis/peer-rows.ts';
import { shownGroup } from '../../src/analysis/shown-group.ts';
import type { SubjectKeyFigures } from '../../src/analysis/view.ts';
import type { FunnelSubject } from '../../src/engine/peers.ts';
import nb from '../../src/messages/nb.json' with { type: 'json' };
import { NOT_IN_DATASET } from './document-fixture.ts';

const row = (revenueOre: bigint, resultOre: bigint | null): SubjectKeyFigures => ({
  sum_driftsinntekter_ore: revenueOre.toString(),
  driftsresultat_ore: resultOre === null ? null : resultOre.toString(),
  sum_driftskostnad_ore: null,
  sum_eiendeler_ore: '200000000',
  sum_egenkapital_gjeld_ore: null,
  sum_egenkapital_ore: '80000000',
  sum_gjeld_ore: null,
});

/** A peer with `margin` percent on a revenue of `revenueKr` kroner; a null margin is an empty driftsresultat. */
function peer(i: number, revenueKr: bigint, margin: number | null) {
  const revenue = revenueKr * 100n;
  return {
    orgnr: `9000000${String(i).padStart(2, '0')}`,
    navn: `Peer ${String(i).padStart(2, '0')} AS`,
    organisasjonsform: 'AS',
    naeringskode1: '62.100',
    brregId: BigInt(i),
    filingYear: 2025,
    sumDriftsinntekter: revenue,
    fingerprint: null,
    classification: null,
    valuta: 'NOK',
    regnskapsregler: 'regnskapslovenAlminneligRegler',
    smaaForetak: true,
    avviklingsregnskap: false,
    regnskapstype: 'SELSKAP',
    periodeFra: '2025-01-01',
    periodeTil: '2025-12-31',
    keyFigures: row(revenue, margin === null ? null : (revenue * BigInt(margin)) / 100n),
    documentBasis: NOT_IN_DATASET,
    documentReadAt: null,
  };
}

const counts = { stage1: 0, stage2: 0, stage3: { legalForm: 0 }, stage4: { businessModel: 0 }, stage5: { classification: 0, flagged: 0 } };
const funnelOf = <P,>(group: readonly P[]) => ({ pool: group, group, flagged: [], counts, emptyReason: null });

/** The subject: 5 % on 1 000 000 kr. */
const subjectFiling = {
  keyFigures: row(100_000_000n, 5_000_000n),
  valuta: 'NOK',
  regnskapsregler: 'regnskapslovenAlminneligRegler',
  smaaForetak: true,
  avviklingsregnskap: false,
  filingYear: 2025,
  documentBasis: NOT_IN_DATASET,
};
const SUBJECT = { name: 'Selskapet AS', keyFigures: subjectFiling.keyFigures };

describe('the plot draws the group less ekskl', () => {
  it('the plot draws the group less ekskl', () => {
    // Fixture: 13 peers in revenue order; peers 11 and 12 have no driftsresultat (no margin);
    // peer 00 is in `ekskl`. Margins 1 %, 2 %, …, 11 % for peers 00–10.
    const peers = Array.from({ length: 13 }, (_, i) => peer(i, 2_000_000n - BigInt(i) * 10_000n, i < 11 ? i + 1 : null));
    const group = shownGroup(funnelOf(peers), ['900000000'], subjectFiling);
    const view = groupBeeswarm(group, SUBJECT, null);
    if (view.kind !== 'shown') throw new Error('the fixture has a beeswarm');
    // Drawn: the ten with a margin in the analysis (01–10), never the excluded 00.
    expect(view.entries.map((entry) => entry.name)).toEqual(peers.slice(1, 11).map((p) => p.navn));
    expect(view.layouts.desktop.dots).toHaveLength(10);
    expect(view.layouts.phone.dots).toHaveLength(10);
    const names = [...view.table.rows, ...view.nearest.rows].map((r) => r.name);
    expect(names).not.toContain('Peer 00 AS');
    // The two without a margin: last in "Vis tallene", with the Peers list's words, and K7.
    const last = view.table.rows.slice(-2);
    expect(last.map((r) => r.name)).toEqual(['Peer 11 AS', 'Peer 12 AS']);
    for (const r of last) expect(r.margin).toMatch(/^Kan ikke beregnes: /);
    expect(view.noMargin).toBe(nb['oversikt.beeswarm.noMargin'].replace('{k}', '2'));
    // "Se alle {n}": every peer in the analysis, with or without a margin.
    expect(view.nearest.seeAll).toBe('Se alle 12');
    // The summary counts the peers with a margin.
    expect(view.summary).toMatch(/^Driftsmargin for 10 sammenlignbare\. Selskapet AS 5,0/);
  });
});

describe('nearest five', () => {
  it('nearest five, ties in the Peers list’s order, shown highest first with the company in its place', () => {
    // Fixture, in the Peers list's order (revenue descending): margins 8, 2, 7, 3, 6, 4, 9, 1, 10, 11 %.
    // The company is at 5 %: distances 3, 3, 2, 2, 1, 1, 4, 4, 5, 6. Ties (3: peers 00 and 01;
    // 4: peers 06 and 07) go to the earlier peer, so the five are 04, 05, 02, 03 and 00.
    const margins = [8, 2, 7, 3, 6, 4, 9, 1, 10, 11];
    const peers = margins.map((margin, i) => peer(i, 2_000_000n - BigInt(i) * 10_000n, margin));
    const view = groupBeeswarm(shownGroup(funnelOf(peers), [], subjectFiling), SUBJECT, null);
    if (view.kind !== 'shown') throw new Error('the fixture has a beeswarm');
    expect(view.nearest.rows.map((r) => [r.name, r.margin, r.selected])).toEqual([
      ['Peer 00 AS', '8,0 %', false],
      ['Peer 02 AS', '7,0 %', false],
      ['Peer 04 AS', '6,0 %', false],
      ['Selskapet AS', '5,0 %', true],
      ['Peer 05 AS', '4,0 %', false],
      ['Peer 03 AS', '3,0 %', false],
    ]);
    // Reversing the list's order flips the ties: peer 01 (2 %) before peer 00 (8 %).
    const reversed = groupBeeswarm(shownGroup(funnelOf([...peers].reverse()), [], subjectFiling), SUBJECT, null);
    if (reversed.kind !== 'shown') throw new Error('the fixture has a beeswarm');
    expect(reversed.nearest.rows.map((r) => r.name)).toEqual(['Peer 02 AS', 'Peer 04 AS', 'Selskapet AS', 'Peer 05 AS', 'Peer 03 AS', 'Peer 01 AS']);
  });

  it('a peer at the company’s margin comes after the company', () => {
    // Fixture: ten peers, one at exactly 5 %, the company's margin.
    const margins = [5, 1, 2, 3, 4, 6, 7, 8, 9, 10];
    const peers = margins.map((margin, i) => peer(i, 2_000_000n - BigInt(i) * 10_000n, margin));
    const view = groupBeeswarm(shownGroup(funnelOf(peers), [], subjectFiling), SUBJECT, null);
    if (view.kind !== 'shown') throw new Error('the fixture has a beeswarm');
    const names = view.nearest.rows.map((r) => r.name);
    expect(names.indexOf('Selskapet AS')).toBe(names.indexOf('Peer 00 AS') - 1);
  });
});

describe('one margin string per peer', () => {
  it('one margin string per peer', () => {
    // Fixture: ten peers with margins that need rounding (1/3 %, 2/3 %, …) and one with none.
    const peers = [
      ...Array.from({ length: 10 }, (_, i) => {
        const p = peer(i, 3_000_000n - BigInt(i) * 10_000n, null);
        const revenue = p.sumDriftsinntekter;
        return { ...p, keyFigures: row(revenue, (revenue * BigInt(i + 1)) / 300n) };
      }),
      peer(10, 1_000_000n, null),
    ];
    const group = shownGroup(funnelOf(peers), [], subjectFiling);
    const view = groupBeeswarm(group, SUBJECT, null);
    if (view.kind !== 'shown') throw new Error('the fixture has a beeswarm');
    const subject: FunnelSubject = {
      orgnr: '912345678',
      naeringskode1: '62.100',
      filingYear: 2025,
      sumDriftsinntekter: 100_000_000n,
      fingerprint: null,
      classification: null,
      valuta: 'NOK',
      regnskapsregler: 'regnskapslovenAlminneligRegler',
      smaaForetak: true,
      avviklingsregnskap: false,
      regnskapstype: 'SELSKAP',
      periodeFra: '2025-01-01',
      periodeTil: '2025-12-31',
    };
    const list = new Map(peerRows(subject, SUBJECT.name, group.members, 'NOK').map((r) => [r.navn, r]));
    const shown = [...view.table.rows, ...view.nearest.rows, ...view.entries.map((e) => ({ ...e, selected: false }))].filter(
      (r) => !r.selected,
    );
    expect(shown.length).toBeGreaterThan(11);
    for (const r of shown) {
      const fromList = list.get(r.name);
      if (fromList === undefined) throw new Error(`${r.name} is not in the Peers list`);
      expect(r.margin, r.name).toBe(fromList.driftsmargin);
    }
    // And the revenue: the table's is the Peers list's; the tooltip's is "Omsetning {v}".
    // The fixture's eleven peers are all in the table; the ten with a margin are plotted, each with its tooltip.
    const tablePeers = view.table.rows.filter((x) => !x.selected);
    expect(tablePeers).toHaveLength(11);
    for (const r of tablePeers) expect(r.revenue).toBe(list.get(r.name)?.omsetning);
    expect(view.entries).toHaveLength(10);
    for (const e of view.entries) expect(e.revenue).toBe(`Omsetning ${list.get(e.name)?.omsetning ?? ''}`);
  });
});

describe('the beeswarm with no comparison', () => {
  const peers = Array.from({ length: 12 }, (_, i) => peer(i, 2_000_000n - BigInt(i) * 10_000n, i + 1));

  it('an empty group: the hero’s sentence, as given', () => {
    // Fixture: twelve peers with margins, but the caller passes the empty group's sentence.
    const view = groupBeeswarm(shownGroup(funnelOf(peers), [], subjectFiling), SUBJECT, 'Peerless sammenligner foreløpig bare selskaper med kalenderår som regnskapsår.');
    expect(view).toEqual({
      kind: 'absent',
      heading: nb['oversikt.beeswarm.heading'],
      text: 'Peerless sammenligner foreløpig bare selskaper med kalenderår som regnskapsår.',
    });
  });

  it('driftsmargin below the floor: "For få sammenlignbare (n av 10)"', () => {
    // Fixture: twelve peers with margins, three excluded: nine left, below the floor of ten.
    const group = shownGroup(funnelOf(peers), ['900000000', '900000001', '900000002'], subjectFiling);
    expect(group.benchmark.driftsmargin.comparison.kind).toBe('below_floor');
    expect(groupBeeswarm(group, SUBJECT, null)).toEqual({
      kind: 'absent',
      heading: nb['oversikt.beeswarm.heading'],
      text: 'For få sammenlignbare (9 av 10)',
    });
  });

  it('the subject’s own margin absent: its reason', () => {
    // Fixture: twelve peers with margins; the subject states a revenue of 0, so its margin is undefined.
    const filing = { ...subjectFiling, keyFigures: row(0n, 5_000_000n) };
    const group = shownGroup(funnelOf(peers), [], filing);
    expect(group.benchmark.driftsmargin.comparison.kind).toBe('subject_absent');
    expect(groupBeeswarm(group, { ...SUBJECT, keyFigures: filing.keyFigures }, null)).toEqual({
      kind: 'absent',
      heading: nb['oversikt.beeswarm.heading'],
      text: 'Kan ikke beregnes: omsetningen er null eller negativ',
    });
  });
});
