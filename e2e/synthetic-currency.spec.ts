// A subject whose stage 2 its own currency empties (Story 2.10, decision 7
// as amended; FR-8), against the production build: the USD synthetic company
// of e2e/synthetic.ts, committed for this spec only and removed before and
// after it. It runs in the `synthetic` project, after every other spec
// (playwright.config.ts), so no other spec sees it.
//
// Stage 1 finds the seed's small NOK companies and none in USD, so the
// Peers tab shows the currency sentence above the funnel, never a bare
// "Fant ingen …", and the Oversikt hero shows the same sentence. Checked at
// 1280, 375 and 320 px.
import { expect, test } from './fixtures.ts';
import { noSidewaysScroll } from './seed.ts';
import { SYNTHETIC_USD, insertSyntheticUsd, removeSyntheticUsd } from './synthetic.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };

const SENTENCE = nb['peers.currency'].replace('{aar}', String(SYNTHETIC_USD.filingYear)).replaceAll('{valuta}', SYNTHETIC_USD.valuta);
const base = `/analyse/${SYNTHETIC_USD.orgnr}`;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await insertSyntheticUsd();
});

test.afterAll(async () => {
  await removeSyntheticUsd();
});

for (const width of [1280, 375, 320]) {
  test(`at ${width} px: the currency sentence with the funnel on Peers and in the hero, no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/peers`);
    await expect(page.getByTestId('peer-count')).toHaveText(nb['peers.count'].replace('{n}', '0'));
    await expect(page.getByTestId('too-small-block')).toContainText(SENTENCE);
    await expect(page.getByTestId('peer-funnel')).toBeVisible();
    await expect(page.getByText(nb['peers.none'])).toHaveCount(0);
    await noSidewaysScroll(page);

    await page.goto(`${base}/oversikt`);
    await expect(page.getByTestId('hero')).toContainText(SENTENCE);
    await noSidewaysScroll(page);
  });
}
