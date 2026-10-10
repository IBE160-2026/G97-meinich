import { expect, test } from '@playwright/test';
import nb from '../src/messages/nb.json' with { type: 'json' };

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

      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.innerWidth);
      expect(scroll.bodyScrollWidth).toBeLessThanOrEqual(scroll.innerWidth);

      // The link wraps to exactly two lines and stays inside the viewport.
      // Measure with the webfont in place, not the fallback.
      await page.evaluate(() => document.fonts.ready);
      const how = page.getByTestId('header-how');
      const lines = await how.evaluate((el) => {
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
        return Math.round(el.getBoundingClientRect().height / lineHeight);
      });
      expect(lines).toBe(2);
      const box = await how.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    });
  });
}

test('the header link stays on one line on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const lines = await page.getByTestId('header-how').evaluate((el) => {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    return Math.round(el.getBoundingClientRect().height / lineHeight);
  });
  expect(lines).toBe(1);
});
