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
    // Story 3.4: the beeswarm card says the same, never "(0 av 10)", and draws no plot.
    await expect(page.getByTestId('beeswarm-absent')).toHaveText(SENTENCE);
    await expect(page.getByTestId('beeswarm')).not.toContainText('0 av 10');
    await expect(page.getByTestId('beeswarm').getByRole('img')).toHaveCount(0);
    await noSidewaysScroll(page);
  });
}

// Story 3.6 (decision 7): the USD subject's group is empty, so driftsmargin is below the floor and the
// profit card has no amount. The EV field is aria-disabled and read-only, still focusable, described by
// the profit card's own words; a valid multiple in the URL stays there and shows read-only; no value.
test('EV disabled below the floor', async ({ page }) => {
  const reason = nb['verdi.noTarget'].replace('{figur}', 'driftsmargin');
  await page.goto(`${base}/verdi?multippel=6.5`);
  const verdi = page.locator('main:not([aria-busy="true"])').getByTestId('verdi');
  // The fixture's state: the profit card reads the below-floor words.
  await expect(verdi.getByTestId('verdi-profit').locator('[data-card="text"]')).toHaveText(reason);
  const ev = verdi.getByTestId('verdi-ev');
  const field = ev.getByRole('textbox', { name: nb['verdi.ev.label'] });
  await expect(field).toHaveAttribute('aria-disabled', 'true');
  await expect(field).toHaveAttribute('readonly', '');
  // Never the native disabled attribute (Playwright's toBeDisabled also counts aria-disabled).
  await expect(field).not.toHaveAttribute('disabled', /.*/);
  await expect(field).toHaveValue('6,5');
  const describedBy = await field.getAttribute('aria-describedby');
  expect(describedBy).not.toBeNull();
  await expect(page.locator(`[id="${describedBy ?? ''}"]`)).toHaveText(reason);
  await field.focus();
  await expect(field).toBeFocused();
  // Typing changes nothing, and Enter writes nothing: the multiple stays in the URL, and no value shows.
  await page.keyboard.type('7');
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('6,5');
  expect(new URL(page.url()).search).toBe('?multippel=6.5');
  await expect(ev.locator('[data-ev="value"]')).toHaveCount(0);
  await expect(ev.locator('[data-ev="product"]')).toHaveCount(0);
  await expect(ev.locator('[data-ev="empty"]')).toHaveCount(0);
  await expect(page.getByTestId('settings-notice')).toHaveText('');
});
