import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { noSidewaysScroll } from './seed.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };

/** The lines `locator` wraps to, polled until the layout settles. */
const expectLineCount = (locator: Locator) =>
  expect.poll(() =>
    locator.evaluate((el) => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      return Math.round(el.getBoundingClientRect().height / lineHeight);
    }),
  );

for (const width of [375, 320]) {
  test.describe(`shell at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('renders the header and footer in Norwegian without horizontal scroll', async ({
      page,
    }) => {
      await page.goto('/');

      await expect(page.locator('html')).toHaveAttribute('lang', 'nb');

      const header = page.getByRole('banner');
      await expect(header.getByRole('link', { name: nb['shell.brand'], exact: true })).toHaveAttribute('href', '/');
      await expect(header.getByRole('link', { name: nb['shell.how'], exact: true })).toHaveAttribute(
        'href',
        '/slik-fungerer-peerless',
      );
      await expect(page.getByRole('contentinfo')).toContainText(nb['footer.source']);

      await noSidewaysScroll(page);

      // The link wraps to exactly two lines and stays inside the viewport.
      // Measure with the webfont in place, not the fallback.
      await page.evaluate(() => document.fonts.ready);
      const how = page.getByTestId('header-how');
      await expectLineCount(how).toBe(2);
      await expect(async () => {
        const box = await how.boundingBox();
        if (box === null) throw new Error('header link not rendered');
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }).toPass();
    });
  });
}

test('the header link stays on one line on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expectLineCount(page.getByTestId('header-how')).toBe(1);
});
