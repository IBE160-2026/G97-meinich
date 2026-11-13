// The Peers tab (Story 1.7) against the production build and the loaded
// demo seed: the peer group on the header and the tab, `ekskl` against the
// pool, the subjects that cannot have peers, and phone widths.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { formatMillions } from '../src/engine/format.ts';
import { A, ABSENT, expectedGroup, newestFiling, noSidewaysScroll, notice, pick, revenue, revenueOf, tabs, nonCalendar } from './seed.ts';

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
      nb['peers.col.basis'],
      nb['peers.col.flag'],
    ]);
    const rows = peerTable(page).locator('tbody tr');
    await expect(rows).toHaveCount(pool0.length);
    await expect(rows.locator('td:first-child')).toHaveText(pool0.map((peer) => peer.navn));
    await expect(rows.locator('td:nth-child(2)')).toHaveText(
      pool0.map((peer) => formatMillions(String(peer.sumDriftsinntekter))),
    );
  });

  test('no peer orgnr reaches the Peers page', async ({ request }) => {
    const html = await (await request.get(`/analyse/${A.orgnr}/peers`)).text();
    const leaked = pool0.filter((peer) => html.includes(peer.orgnr)).map((peer) => peer.orgnr);
    expect(leaked).toEqual([]);
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
  const noRevenue = [
    ['zero', pick('zero revenue', (c) => revenueOf(c) === '0')],
    ['negative', pick('negative revenue', (c) => revenueOf(c).startsWith('-'))],
    ['null', pick('no stated revenue', (c) => revenueOf(c) === '')],
  ] as const;

  for (const [label, subject] of noRevenue) {
    test(`${label} revenue: "0 sammenlignbare" and the no-revenue sentence with the year`, async ({ page }) => {
      await page.goto(`/analyse/${subject.orgnr}/peers`);
      await expect(page.getByTestId('company-meta')).toContainText(nb['analysis.peerCount'].replace('{n}', '0'));
      await expect(page.getByTestId('peer-count')).toHaveText(nb['peers.count'].replace('{n}', '0'));
      await expect(page.getByText(nb['peers.noRevenue'].replace('{aar}', newestFiling(subject.orgnr ?? '').filing_year ?? ''))).toBeVisible();
      await expect(page.getByText(nb['peers.none'])).toHaveCount(0);
    });
  }

  test('a non-calendar year: "0 sammenlignbare" and the non-calendar sentence', async ({ page }) => {
    await page.goto(`/analyse/${nonCalendar.orgnr}/peers`);
    await expect(page.getByTestId('company-meta')).toContainText(nb['analysis.peerCount'].replace('{n}', '0'));
    await expect(page.getByText(nb['peers.nonCalendar'])).toBeVisible();
    await expect(page.getByText(nb['peers.none'])).toHaveCount(0);
  });
});
