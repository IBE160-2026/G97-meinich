// The Peers tab (Stories 1.7, 2.7) against the production build and the
// loaded demo seed: the peer group on the header and the tab, `ekskl`
// against the pool, the funnel, each row against the engine run on the seed,
// the payload, the subjects that cannot have peers, and phone widths.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { formatMillions } from '../src/engine/format.ts';
import type { PeerDisplayRow } from '../src/analysis/peer-rows.ts';
import { businessType } from '../src/engine/fingerprint.ts';
import { matchBasis } from '../src/engine/peers.ts';
import { PHONE_CARDS } from '../src/components/analysis/phone-cards.ts';
import {
  A,
  ABSENT,
  companies,
  company,
  companyShown,
  classificationOf,
  covered,
  expectedGroup,
  expectedPeerGroup,
  expectedPool,
  expectedRows,
  expectedSubject,
  labelled,
  newestFiling,
  noSidewaysScroll,
  nonCalendar,
  notice,
  pick,
  rendered,
  revenue,
  revenueOf,
  tabs,
  withFiling,
} from './seed.ts';
import { expectNoPeerFields } from './payload.ts';

test.describe('the peer group (Story 1.7)', () => {
  const pool0 = expectedGroup(A.orgnr ?? '', 0);
  const pool1 = expectedGroup(A.orgnr ?? '', 1);
  const inBand0 = new Set(pool0.map((peer) => peer.orgnr));
  // A peer only the widened band 1 keeps.
  const widenedOnly = pool1.find((peer) => !inBand0.has(peer.orgnr));
  const peerTable = (page: Page) => page.getByRole('region', { name: nb['peers.regionLabel'] }).locator('table');
  const peersCount = (n: number) => nb['peers.count'].replace('{n}', String(n));
  const headerCount = (n: number) => nb['analysis.peerCount'].replace('{n}', String(n));

  test('the seed gives demo A a group to test with', () => {
    expect(pool0.length).toBeGreaterThan(1);
    expect(widenedOnly).toBeDefined();
  });

  test('the header shows "{n} sammenlignbare" after the revenue', async ({ page }) => {
    await page.goto(`/analyse/${A.orgnr}/oversikt`);
    // allTextContents does not wait: read the header once the page is shown.
    await companyShown(page, A.navn ?? '');
    const items = page.getByTestId('company-meta').locator('span:not([aria-hidden])');
    const texts = await items.allTextContents();
    expect(texts[texts.indexOf(revenue(A.orgnr ?? '')) + 1]).toBe(headerCount(pool0.length));
  });

  test('the Peers tab lists the group by revenue, with the count, in a labelled scroll region', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/peers`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool0.length));
    const region = page.getByRole('region', { name: nb['peers.regionLabel'] });
    await expect(region).toHaveAttribute('tabindex', '0');
    expect(await region.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
    await expect(peerTable(page).locator('thead th')).toHaveText([
      nb['peers.col.selskap'],
      nb['peers.col.omsetning'],
      nb['fig.driftsmargin'],
      nb['peers.col.reason'],
      nb['peers.col.action'],
    ]);
    const rows = peerTable(page).locator('tbody tr');
    await expect(rows).toHaveCount(pool0.length);
    await expect(rows.locator('td:first-child')).toHaveText(pool0.map((peer) => peer.navn));
    await expect(rows.locator('td:nth-child(2)')).toHaveText(
      pool0.map((peer) => formatMillions(String(peer.sumDriftsinntekter))),
    );
  });

  // AD-4, Story 2.7: each peer reaches the page as display strings only.
  test('the HTML and the RSC payload of Peers carry no orgnr outside the group, peer key-figure amount or server field', async ({ request }) => {
    await expectNoPeerFields(request, `/analyse/${A.orgnr}/peers`, {
      pool: expectedPool(A.orgnr ?? '', 0),
      marker: nb['peers.funnel.stage3'],
      // Story 2.8: every group member's orgnr, for its exclude action.
      inUrl: pool0.map((peer) => peer.orgnr),
      // Story 3.7: the Peers tab shows no kroner amount, so no drill-down.
      fields: [],
    });
  });

  // Story 2.8: the states a peer-group change adds, the widest band with exclusions.
  test('the HTML and the RSC payload of Peers at band 2 with exclusions carry no orgnr outside the group', async ({ request }) => {
    const group2 = expectedGroup(A.orgnr ?? '', 2);
    const ekskl = group2.slice(0, 2).map((peer) => peer.orgnr).sort();
    await expectNoPeerFields(request, `/analyse/${A.orgnr}/peers?ekskl=${ekskl.join(',')}&band=2`, {
      pool: expectedPool(A.orgnr ?? '', 2),
      marker: nb['peers.funnel.stage3'],
      inUrl: group2.map((peer) => peer.orgnr),
      fields: [],
    });
  });

  test('ekskl: a pool peer leaves the count, an orgnr outside the pool is dropped with the notice', async ({ page }) => {
    const peer = pool0[0]?.orgnr ?? '';
    await page.goto(`/analyse/${A.orgnr}/peers?ekskl=${peer},${ABSENT}`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool0.length - 1));
    await expect(page.getByTestId('company-meta')).toContainText(headerCount(pool0.length - 1));
    await expect(notice(page)).toHaveText(nb['analysis.notice']);
  });

  test('ekskl: a widened-band peer is kept at band 1 and dropped with the notice at the default band', async ({ page }) => {
    const peer = widenedOnly?.orgnr ?? '';
    await page.goto(`/analyse/${A.orgnr}/peers?band=1&ekskl=${peer}`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool1.length - 1));
    await expect(notice(page)).toHaveText('');
    // The tab links keep the exclusion: it was kept.
    await expect(tabs(page).getByRole('link', { name: nb['tabs.oversikt'] })).toHaveAttribute(
      'href',
      `/analyse/${A.orgnr}/oversikt?ekskl=${peer}&band=1`,
    );

    await page.goto(`/analyse/${A.orgnr}/peers?ekskl=${peer}`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool0.length));
    await expect(notice(page)).toHaveText(nb['analysis.notice']);
    await expect(tabs(page).getByRole('link', { name: nb['tabs.oversikt'] })).toHaveAttribute(
      'href',
      `/analyse/${A.orgnr}/oversikt`,
    );
  });

  for (const width of [375, 320]) {
    test(`the Peers tab reflows at ${width} px: cards instead of the table, the body never scrolls`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${A.orgnr}/peers`);
      await expect(peerTable(page)).toBeHidden();
      await expect(page.getByTestId('peer-cards')).toBeVisible();
      await noSidewaysScroll(page);
    });
  }
});

test.describe('a covered AS that cannot have peers', () => {
  // Story 2.10 (R2): no stated revenue has its own sentence, never the no-revenue one.
  const noRevenue = [
    ['zero', pick('zero revenue', (c) => revenueOf(c) === '0'), 'peers.noRevenue'],
    ['negative', pick('negative revenue', (c) => revenueOf(c).startsWith('-')), 'peers.noRevenue'],
    ['null', pick('no stated revenue', (c) => revenueOf(c) === ''), 'peers.revenueNotStated'],
  ] as const;

  for (const [label, subject, sentenceId] of noRevenue) {
    test(`${label} revenue: "0 sammenlignbare" and its sentence with the year, on Peers and the hero`, async ({ page }) => {
      const aar = newestFiling(subject.orgnr ?? '').filing_year ?? '';
      const other = sentenceId === 'peers.noRevenue' ? 'peers.revenueNotStated' : 'peers.noRevenue';
      await page.goto(`/analyse/${subject.orgnr}/peers`);
      await expect(page.getByTestId('company-meta')).toContainText(nb['analysis.peerCount'].replace('{n}', '0'));
      await expect(page.getByTestId('peer-count')).toHaveText(nb['peers.count'].replace('{n}', '0'));
      await expect(page.getByText(nb[sentenceId].replace('{aar}', aar))).toBeVisible();
      await expect(page.getByText(nb[other].replace('{aar}', aar))).toHaveCount(0);
      await expect(page.getByText(nb['peers.none'])).toHaveCount(0);
      await page.goto(`/analyse/${subject.orgnr}/oversikt`);
      await expect(page.getByTestId('hero')).toContainText(nb[sentenceId].replace('{aar}', aar));
      await expect(page.getByTestId('hero')).not.toContainText(nb[other].replace('{aar}', aar));
    });
  }

  test('a non-calendar year: "0 sammenlignbare" and the non-calendar sentence', async ({ page }) => {
    await page.goto(`/analyse/${nonCalendar.orgnr}/peers`);
    await expect(page.getByTestId('company-meta')).toContainText(nb['analysis.peerCount'].replace('{n}', '0'));
    await expect(page.getByText(nb['peers.nonCalendar'])).toBeVisible();
    await expect(page.getByText(nb['peers.none'])).toHaveCount(0);
  });
});

// Story 2.7: the funnel and why each peer is in the group.
const GLYPH = '✦';

/**
 * The first covered AS outside the labelled set that `eligible` admits and
 * whose expected rows pass `wanted`, picked from the seed when the test
 * runs and then kept: building every peer's rows is the slow part, so
 * `eligible` first drops subjects that cannot qualify. Its orgnr is never
 * named in a title.
 */
function seedSubject(
  eligible: (orgnr: string) => boolean,
  wanted: (rows: readonly PeerDisplayRow[]) => boolean,
  missing: string,
): () => string {
  let found: string | null = null;
  return () => {
    if (found !== null) return found;
    for (const c of companies) {
      const orgnr = c.orgnr ?? '';
      if (!covered.has(c.naeringskode1 ?? '') || c.organisasjonsform !== 'AS' || !withFiling.has(orgnr)) continue;
      if (labelled.has(orgnr) || !eligible(orgnr)) continue;
      if (wanted(expectedRows(orgnr, 0))) {
        found = orgnr;
        return orgnr;
      }
    }
    throw new Error(`no covered AS outside the labelled set ${missing} in the seed`);
  };
}

/** The funnel as built, both signals on (Story 5.2): what v1 no longer runs. */
const AS_BUILT = { textSignal: true, fingerprintSignal: true } as const;

/**
 * A subject with a type of its own whose group the funnel as built gives
 * mixed match bases. v1 (Story 5.2) shows no match basis at all.
 */
const mixedBasisSubject = seedSubject(
  (orgnr) => {
    if (classificationOf(orgnr) === null) return false;
    const own = expectedSubject(orgnr);
    const bases = expectedPeerGroup(orgnr, 0, AS_BUILT).group.map((peer) => matchBasis(own, peer, AS_BUILT));
    return new Set(bases).size >= 2;
  },
  () => true,
  'with mixed match bases as built and a type of its own',
);

/**
 * A subject whose group the funnel as built would flag a peer in: it needs
 * both signals of its own. v1 (Story 5.2) shows no flag.
 */
const flaggedSubject = seedSubject(
  (orgnr) => {
    const own = expectedSubject(orgnr);
    if (own.classification === null || own.fingerprint === null || businessType(own.fingerprint) === null) return false;
    return expectedPeerGroup(orgnr, 0, AS_BUILT).flagged.length > 0;
  },
  () => true,
  'with a peer the funnel as built would flag',
);

/**
 * A subject whose as-built group (both signals on) is strictly smaller than
 * its pool, so a page that ran the funnel as built would list fewer peers
 * (triage 17). Fails loudly when the seed has none.
 */
const narrowedAsBuiltSubject = seedSubject(
  (orgnr) => expectedPeerGroup(orgnr, 0, AS_BUILT).group.length < expectedPool(orgnr, 0).length,
  () => true,
  'whose as-built group (AS_BUILT) is smaller than its pool',
);

/**
 * What v1's Peers tab never shows (Story 5.2): the basis and flag columns
 * and ✦. Read only once the subject's page is shown, and from the rendered
 * <main>, never the Suspense fallback's: while the stream swaps them, both
 * are in the document (the PR #76 race).
 */
async function expectNoModelMarks(page: Page, orgnr: string): Promise<void> {
  await companyShown(page, company(orgnr).navn ?? '');
  const main = rendered(page);
  await expect(main.getByTestId('ai-mark')).toHaveCount(0);
  const body = (await main.textContent()) ?? '';
  expect(body).not.toContain(GLYPH);
  expect(body).not.toContain(nb['peers.col.basis']);
  expect(body).not.toContain(nb['peers.col.flag']);
  expect(body).not.toContain(nb['peers.flag']);
  expect(body).not.toContain(nb['peers.ai']);
}

test.describe('the Peers tab shows why (Story 2.7)', () => {
  const desktopRows = (page: Page) => page.getByRole('region', { name: nb['peers.regionLabel'] }).locator('tbody tr');

  test('the funnel shows stages 1–3 with the engine’s counts, the Segment criterion and the not-applied sentence', async ({ page }) => {
    const { counts } = expectedPeerGroup(A.orgnr ?? '', 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/peers`);
    const stages = page.getByTestId('funnel-stage');
    await expect(stages).toHaveCount(3);
    await expect(page.getByTestId('funnel-count')).toHaveText([counts.stage1, counts.stage2, counts.stage3.legalForm].map(String));
    await expect(stages.nth(2)).toContainText(nb['peers.funnel.segment.legalForm']);
    await expect(page.getByTestId('funnel-criterion-count')).toHaveText(String(counts.stage3.legalForm));
    await expect(page.getByTestId('funnel-not-applied')).toHaveText(nb['peers.funnel.notApplied']);
    await expect(page.getByTestId('funnel-flagged')).toHaveCount(0);
    // Three columns side by side at desktop width.
    const tops = await stages.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await expectNoModelMarks(page, A.orgnr ?? '');
  });

  // Demo A is not in the labelled set: row by row, names and reasons may be compared.
  test("demo A: each row's figures and reason match the engine on the seed", async ({ page }) => {
    const rows = expectedRows(A.orgnr ?? '', 0);
    expect(rows.length).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/peers`);
    const shown = desktopRows(page);
    await expect(shown).toHaveCount(rows.length);
    await expect(shown.locator('td:nth-child(1)')).toHaveText(rows.map((row) => row.navn));
    await expect(shown.locator('td:nth-child(2)')).toHaveText(rows.map((row) => row.omsetning));
    await expect(shown.locator('td:nth-child(3)')).toHaveText(rows.map((row) => row.driftsmargin));
    await expect(shown.locator('td:nth-child(4)')).toHaveText(rows.map((row) => row.hvorforMed));
    await expect(shown.first().locator('td')).toHaveCount(5);
    await expectNoModelMarks(page, A.orgnr ?? '');
  });

  // These subjects' peers may be in the labelled set, so a failure must not
  // print a name: the tests compare the row count and what is absent.
  for (const [label, subjectOf] of [
    ['a mixed-basis subject from the seed', mixedBasisSubject],
    ['a subject the funnel as built would flag a peer for', flaggedSubject],
    ['a subject the funnel as built would narrow', narrowedAsBuiltSubject],
  ] as const) {
    test(`${label}: v1 shows the whole pool, with no basis, flag or ✦`, async ({ page }) => {
      const orgnr = subjectOf();
      const rows = expectedRows(orgnr, 0);
      expect(rows.length).toBe(expectedPool(orgnr, 0).length);
      // The pool, not the as-built group, is what v1 lists.
      expect(rows.map((row) => row.orgnr)).toEqual(expectedPool(orgnr, 0).map((peer) => peer.orgnr));
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/analyse/${orgnr}/peers`);
      await expect(desktopRows(page)).toHaveCount(rows.length);
      await expectNoModelMarks(page, orgnr);
    });

    test(`${label}: the HTML and the RSC payload carry no orgnr outside the group, peer key-figure amount or server field`, async ({ request }) => {
      const orgnr = subjectOf();
      await expectNoPeerFields(request, `/analyse/${orgnr}/peers`, {
        pool: expectedPool(orgnr, 0),
        marker: nb['peers.funnel.stage3'],
        // Story 2.8: the group's orgnrs, for the exclude actions.
        inUrl: expectedGroup(orgnr, 0).map((peer) => peer.orgnr),
        fields: [],
      });
    });
  }

  test('the table is named for screen readers and has no basis or flag column', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/peers`);
    const region = page.getByRole('region', { name: nb['peers.regionLabel'] });
    await expect(region.locator('caption')).toHaveText(nb['peers.regionLabel']);
    await expect(region.locator('caption')).toHaveClass(/sr-only/);
    await expect(region.locator('thead th')).toHaveCount(5);
    await expectNoModelMarks(page, A.orgnr ?? '');
  });

  for (const width of [375, 320]) {
    test(`at ${width} px: the funnel is a list and peers are cards`, async ({ page }) => {
      const rows = expectedRows(A.orgnr ?? '', 0);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${A.orgnr}/peers`);
      // The streamed panel replaces the loading state after the load event: measure once it is shown.
      await expect(page.getByTestId('funnel-stage').last()).toBeVisible();
      await noSidewaysScroll(page);
      // The funnel stacks: each stage below the one before, full width.
      const stages = await page.getByTestId('funnel-stage').evaluateAll((items) =>
        items.map((item) => {
          const box = item.getBoundingClientRect();
          return { top: box.top, width: box.width };
        }),
      );
      expect(stages).toHaveLength(3);
      for (let i = 1; i < stages.length; i += 1) expect(stages[i]?.top ?? 0).toBeGreaterThan(stages[i - 1]?.top ?? 0);
      for (const stage of stages) expect(stage.width).toBeGreaterThan(width - 40);
      // Cards, not the table.
      await expect(page.getByRole('region', { name: nb['peers.regionLabel'] })).toBeHidden();
      const visibleCards = page.getByTestId('peer-cards').locator('[data-testid="peer-card"]:visible');
      await expect(visibleCards).toHaveCount(Math.min(rows.length, PHONE_CARDS));
      await expect(visibleCards.first()).toContainText(rows[0]?.navn ?? '');
      // Demo A's group is larger than the first cards, so "Vis alle" is tested.
      expect(rows.length).toBeGreaterThan(PHONE_CARDS);
      const more = page.getByRole('button', { name: nb['peers.showAll'].replace('{n}', String(rows.length)) });
      await more.focus();
      await page.keyboard.press('Enter');
      await expect(visibleCards).toHaveCount(rows.length);
      await expect(page.locator(':focus')).toHaveText(rows[PHONE_CARDS]?.navn ?? '');
      // Every target at least 24 × 24 px.
      const small = await page.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>('main a, main button, main [tabindex="0"]')]
            .filter((el) => el.offsetParent !== null)
            .map((el) => el.getBoundingClientRect())
            .filter((box) => box.width < 24 || box.height < 24).length,
      );
      expect(small).toBe(0);
      await expectNoModelMarks(page, A.orgnr ?? '');
      await noSidewaysScroll(page);
    });
  }
});
