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

/** Opens Nøkkeltall at 1280 px, once the streamed page is in. */
async function openKeyFigures(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await expect(rendered(page)).toBeVisible();
}

/** Every cell of the three API rows of the desktop key-figure table, by row and cell. */
function apiCells(page: Page): Promise<Record<string, string>> {
  const region = page.getByRole('region', { name: nb['keyFigures.regionLabel'] });
  const cells = ['driftsmargin', 'totalkapitalrentabilitet', 'egenkapitalandel'].map((figure) => `tr[data-figure="${figure}"] td[data-cell]`);
  return region.locator(cells.join(', ')).evaluateAll((tds) =>
    Object.fromEntries(
      tds.map((td) => [`${td.closest('tr')?.getAttribute('data-figure')}.${td.getAttribute('data-cell')}`, (td as HTMLElement).innerText.trim()]),
    ),
  );
}

test('a failed subject keeps its tabs and peers, with the subline and no uncovered state', async ({ page }) => {
  await page.goto(base);
  await expect(page).toHaveURL(new RegExp(`${base}/oversikt$`));
  await expect(h1(page)).toHaveText(SYNTHETIC.navn);
  await expect(subline(page)).toHaveText(FAILED);
  await expect(tabs(page).getByRole('link')).toHaveText([nb['tabs.oversikt'], nb['tabs.peers'], nb['tabs.nokkeltall'], nb['tabs.verdi']]);
  await expect(page.getByText(nb['analysis.uncovered.kicker'])).toHaveCount(0);
  // A peer group of its own: the count is in the header, and the Peers tab lists them.
  const count = page.getByTestId('header-peer-count');
  // At least one: a count that does not start with 0.
  await expect(count).toHaveText(/^[1-9]\d* sammenlignbare$/);
  await page.goto(`${base}/peers`);
  await expect(subline(page)).toHaveText(FAILED);
  await expect(page.getByText(nb['peers.funnel.heading'])).toBeVisible();
});

test('the API figures and the driftsmargin kroner are compared as for a company outside the dataset', async ({ page }) => {
  await openKeyFigures(page);
  await expect(subline(page)).toHaveText(FAILED);
  const failed = await apiCells(page);
  // The driftsmargin gap in kroner: −5,0 % is below beste fjerdedel.
  expect(failed['driftsmargin.gap']).toMatch(/\d kr/);
  expect(failed['driftsmargin.median']).toMatch(/ %$/);
  // Off the dataset's list, the same document is not read at all, and the
  // header has no subline: the API rows do not move.
  await setSyntheticListed(false);
  try {
    await openKeyFigures(page);
    await expect(subline(page)).toHaveCount(0);
    await expect.poll(() => apiCells(page)).toEqual(failed);
  } finally {
    await setSyntheticListed(true);
  }
});

// Story 3.7 (decision 4): the profit's drill-down names what failed, the stored c1 as its
// equation in register names (e2e/synthetic.ts stores c1 fail and nothing else failing), and no
// capital cell has a drill-down.
test('the drill-down: "Avvik ved avstemming" with the failed check, and no capital trigger', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await expect(h1(page)).toHaveText(SYNTHETIC.navn);
  const desktop = rendered(page).locator('table[data-layout="desktop"]');
  await expect(desktop.locator('[data-provenance-trigger]')).toHaveCount(1);
  await desktop.locator('[data-provenance-trigger="kf-d-prov-driftsmargin"]').click();
  const body = desktop.locator('[data-provenance-body="kf-d-prov-driftsmargin"]');
  await expect(body).toBeVisible();
  await expect(body.locator('[data-provenance-quality]')).toHaveText(
    nb['provenance.quality.failed'].replace('{felt}', 'sumDriftsinntekter − sumDriftskostnad ≠ driftsresultat'),
  );
  await expect(body).not.toContainText(nb['provenance.quality.reconciled']);
});

type ShownTable = { readonly inRegion: boolean; readonly regionOwn: boolean; readonly right: number };

// A visible table either sits in a scroll container of its own, or, below
// md, is the phone layout's table, which fits the screen by design.
const inOwnRegion = (table: ShownTable, fane: string) => expect(table.inRegion && table.regionOwn, fane).toBe(true);
const inOwnRegionOrFits = (width: number) => (table: ShownTable, fane: string) =>
  expect((table.inRegion && table.regionOwn) || table.right <= width, fane).toBe(true);
/** The fewest visible tables each tab has: Nøkkeltall its key-figure table. */
const MIN_TABLES = { oversikt: 0, peers: 0, nokkeltall: 1 } as const;

for (const [width, expectTable] of [
  [1280, inOwnRegion],
  [375, inOwnRegionOrFits(375)],
  [320, inOwnRegionOrFits(320)],
] as const) {
  test(`at ${width} px the subline wraps, the body does not scroll sideways, and each table has its own scroll container`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const fane of ['oversikt', 'peers', 'nokkeltall'] as const) {
      await page.goto(`${base}/${fane}`);
      await expect(rendered(page)).toBeVisible();
      await expect(subline(page)).toHaveText(FAILED);
      await expect(async () => {
        const box = await subline(page).boundingBox();
        if (box === null) throw new Error('subline not rendered');
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }).toPass();
      await noSidewaysScroll(page);
      await expect(async () => {
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
        expect(tables.length, fane).toBeGreaterThanOrEqual(MIN_TABLES[fane]);
        for (const table of tables) expectTable(table, fane);
      }).toPass();
    }
  });
}

// Story 3.1b (FR-71): every document row of the table reads that the filing
// could not be read, in place of its value and comparison; 7 and 8 keep
// their own reason, as on every basis.
test('document rows say the filing could not be read', async ({ page }) => {
  const DOCUMENT_ROWS = ['ebitda', 'vare', 'lonn', 'andre', 'total', 'kfd', 'lgd', 'oml', 'kontant', 'vekst'];
  for (const [width, layout] of [
    [1280, 'desktop'],
    [375, 'phone'],
    [320, 'phone'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/nokkeltall`);
    await expect(rendered(page)).toBeVisible();
    const table = page.locator(`table[data-layout="${layout}"]`);
    for (const figure of DOCUMENT_ROWS) {
      const own =
        layout === 'desktop'
          ? table.locator(`tr[data-figure="${figure}"] td[data-cell="own"]`)
          : table.locator(`tr:has(button[aria-controls="kf-p-exp-${figure}"]) td[data-cell="own"]`);
      await expect(own, `${width} ${figure}`).toHaveText(FAILED);
    }
    for (const figure of ['omsArsverk', 'lonnArsverk']) {
      const own =
        layout === 'desktop'
          ? table.locator(`tr[data-figure="${figure}"] td[data-cell="own"]`)
          : table.locator(`tr:has(button[aria-controls="kf-p-exp-${figure}"]) td[data-cell="own"]`);
      await expect(own, `${width} ${figure}`).toContainText(nb['analysis.figures.notReadInV1']);
    }
    // Not outside the demo data: no such State block.
    await expect(page.getByText(nb['keyFigures.notInDataset.state'])).toHaveCount(0);
  }
  // The desktop table only: each document row's merged cell holds no figure, and the API rows keep their comparison.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await expect(rendered(page)).toBeVisible();
  const desktop = page.locator('table[data-layout="desktop"]');
  for (const figure of DOCUMENT_ROWS) {
    await expect(desktop.locator(`tr[data-figure="${figure}"] td[data-cell="merged"]`), figure).not.toContainText(/\d/);
  }
  await expect(desktop.locator('tr[data-figure="driftsmargin"] td[data-cell="median"]')).toHaveText(/\d\s%$/);
});
