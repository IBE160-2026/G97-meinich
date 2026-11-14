// A subject whose own filing failed reconciliation (Story 2.9; FR-57, FR-71),
// against the production build: the synthetic company of e2e/synthetic.ts,
// committed for this spec only and removed before and after it. Its own
// Playwright project runs after every other spec (playwright.config.ts),
// so no other spec sees it.
//
// The subject keeps its tabs and peer group, is not shown as uncovered, and
// its three API figures are compared exactly as for a company outside the
// dataset; the header says in a slate subline that its filing could not be
// read safely. Checked at 1280, 375 and 320 px.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { h1, noSidewaysScroll, rendered, tabs } from './seed.ts';
import { SYNTHETIC, insertSynthetic, removeSynthetic, setSyntheticListed } from './synthetic.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };

const FAILED = nb['analysis.documentFailed'].replace('{aar}', String(SYNTHETIC.filingYear));
const base = `/analyse/${SYNTHETIC.orgnr}`;
const subline = (page: Page) => page.getByTestId('document-subline');

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await insertSynthetic();
});

test.afterAll(async () => {
  await removeSynthetic();
});

/** Every cell of the three API rows of the desktop key-figure table, by row and cell. */
async function apiCells(page: Page): Promise<Record<string, string>> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await expect(rendered(page)).toBeVisible();
  const region = page.getByRole('region', { name: nb['keyFigures.regionLabel'] });
  const out: Record<string, string> = {};
  for (const figure of ['driftsmargin', 'totalkapitalrentabilitet', 'egenkapitalandel']) {
    const cells = region.locator(`tr[data-figure="${figure}"] td[data-cell]`);
    for (const cell of await cells.all()) {
      out[`${figure}.${await cell.getAttribute('data-cell')}`] = (await cell.innerText()).trim();
    }
  }
  return out;
}

test('a failed subject keeps its tabs and peers, with the subline and no uncovered state', async ({ page }) => {
  await page.goto(base);
  await expect(page).toHaveURL(new RegExp(`${base}/oversikt$`));
  await expect(h1(page)).toHaveText(SYNTHETIC.navn);
  await expect(subline(page)).toHaveText(FAILED);
  await expect(tabs(page).getByRole('link')).toHaveText([nb['tabs.oversikt'], nb['tabs.peers'], nb['tabs.nokkeltall']]);
  await expect(page.getByText(nb['analysis.uncovered.kicker'])).toHaveCount(0);
  // A peer group of its own: the count is in the header, and the Peers tab lists them.
  const count = page.getByTestId('header-peer-count');
  await expect(count).toHaveText(/^\d+ sammenlignbare$/);
  expect(Number((await count.innerText()).split(' ')[0])).toBeGreaterThan(0);
  await page.goto(`${base}/peers`);
  await expect(subline(page)).toHaveText(FAILED);
  await expect(page.getByText(nb['peers.funnel.heading'])).toBeVisible();
});

test('the API figures and the driftsmargin kroner are compared as for a company outside the dataset', async ({ page }) => {
  const failed = await apiCells(page);
  await expect(subline(page)).toHaveText(FAILED);
  // The driftsmargin gap in kroner: −5,0 % is below beste fjerdedel.
  expect(failed['driftsmargin.gap']).toMatch(/\d kr/);
  expect(failed['driftsmargin.median']).toMatch(/ %$/);
  // Off the dataset's list, the same document is not read at all, and the
  // header has no subline: the API rows do not move.
  await setSyntheticListed(false);
  try {
    const outside = await apiCells(page);
    await expect(subline(page)).toHaveCount(0);
    expect(outside).toEqual(failed);
  } finally {
    await setSyntheticListed(true);
  }
});

for (const width of [1280, 375, 320]) {
  test(`at ${width} px the subline wraps, the body does not scroll sideways, and each table has its own scroll container`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const fane of ['oversikt', 'peers', 'nokkeltall']) {
      await page.goto(`${base}/${fane}`);
      await expect(rendered(page)).toBeVisible();
      await expect(subline(page)).toHaveText(FAILED);
      const box = await subline(page).boundingBox();
      if (box === null) throw new Error('subline not rendered');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await noSidewaysScroll(page);
      // A visible table either sits in a scroll container of its own, or is
      // the phone layout's table, which fits the screen by design.
      const tables = await page.locator('main table').evaluateAll((elements) =>
        elements
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => {
            const region = el.closest('.scroll-region');
            return {
              inRegion: region !== null && getComputedStyle(region).overflowX === 'auto',
              regionOwn: region !== null && region.querySelectorAll('table').length === 1,
              right: el.getBoundingClientRect().right,
            };
          }),
      );
      if (fane === 'nokkeltall') expect(tables.length, fane).toBeGreaterThanOrEqual(1);
      for (const table of tables) {
        if (width >= 768) expect(table.inRegion && table.regionOwn, fane).toBe(true);
        else expect((table.inRegion && table.regionOwn) || table.right <= width, fane).toBe(true);
      }
    }
  });
}
