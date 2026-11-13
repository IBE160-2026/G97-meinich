// The key-figure table (Story 1.8) against the production build and the
// loaded demo seed: every cell against the engine run on the seed, the
// scroll region, below the floor, `ekskl`, another currency, the phone
// table and the payload.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import {
  formatKronerExact,
  formatPercent,
  formatPercentNumber,
  formatWholePercent,
} from '../src/engine/format.ts';
import {
  A,
  companies,
  covered,
  expectedBenchmark,
  expectedGroup,
  expectedPool,
  keyFigureRow,
  newestFiling,
  noSidewaysScroll,
  notice,
  withFiling,
} from './seed.ts';

test.describe('the key-figure table (Story 1.8)', () => {
  const NBSP = ' ';
  const MINUS = '−';
  const region = (page: Page) => page.getByRole('region', { name: nb['keyFigures.regionLabel'] });
  const desktopRow = (page: Page, figure: string) => region(page).locator(`tr[data-figure="${figure}"]`);
  const cell = (page: Page, figure: string, name: string) => desktopRow(page, figure).locator(`td[data-cell="${name}"]`);
  const pct = (value: { toString(): string }) => formatPercent(value.toString());

  test('demo A: every cell matches the engine run on the seed', async ({ page }) => {
    const expected = expectedBenchmark(A.orgnr ?? '', 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/nokkeltall`);
    await expect(region(page).locator('caption')).toHaveText(nb['keyFigures.caption']);
    await expect(page.getByText(nb['keyFigures.topNote'])).toBeVisible();
    for (const figure of ['driftsmargin', 'totalkapitalrentabilitet', 'egenkapitalandel'] as const) {
      const c = expected[figure].comparison;
      if (c.kind !== 'compared') throw new Error(`demo A's ${figure} is not compared`);
      await expect(cell(page, figure, 'own')).toHaveText(pct(c.subject));
      await expect(cell(page, figure, 'median')).toHaveText(pct(c.median));
      await expect(desktopRow(page, figure).locator('th')).toContainText(
        `${c.count} sammenlignbare brukt · ${c.leftOut} utelatt`,
      );
      const lo = formatPercentNumber(c.lowerQuartile.toString());
      const hi = formatPercentNumber(c.upperQuartile.toString());
      const range = lo.startsWith(MINUS) || hi.startsWith(MINUS) ? `${lo} til ${hi}` : `${lo}–${hi}`;
      await expect(cell(page, figure, 'distribution')).toContainText(`${range}${NBSP}%`);
      if (c.best !== null) {
        await expect(cell(page, figure, 'best')).toHaveText(pct(c.best.quartile));
        await expect(cell(page, figure, 'placement')).toHaveText(
          `bedre enn ${formatWholePercent(c.best.percentile.toString())}`,
        );
      }
    }
    const gap = expected.driftsmargin.gap;
    const gapText =
      gap.kind === 'amount'
        ? `${formatKronerExact(gap.ore.toString())}${nb['keyFigures.perYear']}`
        : gap.kind === 'strength'
          ? nb['keyFigures.strength']
          : '';
    expect(gapText).not.toBe('');
    await expect(cell(page, 'driftsmargin', 'gap')).toHaveText(gapText);
    await expect(cell(page, 'totalkapitalrentabilitet', 'gap')).toHaveText(nb['keyFigures.noKroner']);
    await expect(page.getByText(nb['keyFigures.nonSmall'])).toHaveCount(0);
  });

  test('the table sits in a labelled, focusable scroll region with a visible focus style', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/nokkeltall`);
    const r = region(page);
    await expect(r).toHaveAttribute('tabindex', '0');
    expect(await r.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
    expect(await r.evaluate((el) => getComputedStyle(el).backgroundAttachment)).toContain('local');
    await r.focus();
    expect(await r.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    // The strips are decorative: hidden from assistive technology, never focusable.
    const strips = r.getByTestId('distribution-strip');
    await expect(strips).toHaveCount(3);
    for (const strip of await strips.all()) await expect(strip).toHaveAttribute('aria-hidden', 'true');
    await expect(r.locator('[data-testid="distribution-strip"] :is([tabindex], a, button)')).toHaveCount(0);
  });

  // A covered, non-small AS in NOK with fewer than 10 peers at the default band and at least 10 at the widest.
  const belowFloor = companies
    .filter((c) => covered.has(c.naeringskode1 ?? '') && c.organisasjonsform === 'AS' && withFiling.has(c.orgnr ?? ''))
    .filter((c) => {
      const f = newestFiling(c.orgnr ?? '');
      return f.valuta === 'NOK' && f.smaa_foretak === 'f';
    })
    .find((c) => {
      const narrow = expectedBenchmark(c.orgnr ?? '', 0).driftsmargin.comparison;
      const wide = expectedBenchmark(c.orgnr ?? '', 2).driftsmargin.comparison;
      // At most 20 peers can be excluded (MAX_EKSKL), so the widest pool must be at most 29.
      return narrow.kind === 'below_floor' && narrow.count > 0 && wide.kind === 'compared' && wide.count + wide.leftOut <= 29;
    });

  test('below the floor at the default band: the merged cell and the non-small notice; compared once widened', async ({ page }) => {
    if (belowFloor === undefined) throw new Error('no covered non-small AS below the floor at band 0 in the seed');
    const narrow = expectedBenchmark(belowFloor.orgnr ?? '', 0).driftsmargin.comparison;
    if (narrow.kind !== 'below_floor') throw new Error('not below the floor');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${belowFloor.orgnr}/nokkeltall`);
    await expect(cell(page, 'driftsmargin', 'own')).toHaveText(pct(narrow.subject));
    const merged = cell(page, 'driftsmargin', 'merged');
    await expect(merged).toHaveText(`For få sammenlignbare (${narrow.count} av 10)`);
    await expect(merged).toHaveAttribute('colspan', '5');
    await expect(page.getByTestId('state-block')).toHaveText(nb['keyFigures.nonSmall']);
    await expect(region(page)).not.toContainText(/\d kr/);

    await page.goto(`/analyse/${belowFloor.orgnr}/nokkeltall?band=2`);
    await expect(cell(page, 'driftsmargin', 'merged')).toHaveCount(0);
    await expect(cell(page, 'driftsmargin', 'median')).toBeVisible();
  });

  test('ekskl takes peers out of every figure: excluded until below the floor, and one out of demo A', async ({ page }) => {
    if (belowFloor === undefined) throw new Error('no covered non-small AS below the floor at band 0 in the seed');
    // The same shown group as the Peers tab: excluded peers leave every aggregate.
    // At most MAX_EKSKL (20) can be excluded, so the subject's widest pool is small.
    const ekskl = expectedGroup(belowFloor.orgnr ?? '', 2)
      .slice(9)
      .map((peer) => peer.orgnr);
    const expected = expectedBenchmark(belowFloor.orgnr ?? '', 2, ekskl).driftsmargin.comparison;
    if (expected.kind !== 'below_floor') throw new Error('not below the floor with the exclusions');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${belowFloor.orgnr}/nokkeltall?band=2&ekskl=${ekskl.join(',')}`);
    await expect(notice(page)).toHaveText('');
    await expect(cell(page, 'driftsmargin', 'merged')).toHaveText(`For få sammenlignbare (${expected.count} av 10)`);

    const one = expectedGroup(A.orgnr ?? '', 0)[0]?.orgnr ?? '';
    const withoutOne = expectedBenchmark(A.orgnr ?? '', 0, [one]).driftsmargin.comparison;
    if (withoutOne.kind !== 'compared') throw new Error('demo A is not compared without one peer');
    await page.goto(`/analyse/${A.orgnr}/nokkeltall?ekskl=${one}`);
    await expect(desktopRow(page, 'driftsmargin').locator('th')).toContainText(`${withoutOne.count} sammenlignbare brukt`);
    await expect(cell(page, 'driftsmargin', 'median')).toHaveText(pct(withoutOne.median));
  });

  // Every covered AS reporting in USD in the seed has an empty pool, so this
  // checks only that such a page writes no "kr" amount in its table (every
  // figure is below the floor). That the page gives the engine the subject's
  // valuta, and a compared USD subject gets not_nok, is tested in
  // test/analysis/shown-group.test.ts.
  test('a subject not in NOK shows no kroner amount', async ({ page }) => {
    const usd = companies.find(
      (c) =>
        covered.has(c.naeringskode1 ?? '') &&
        c.organisasjonsform === 'AS' &&
        withFiling.has(c.orgnr ?? '') &&
        newestFiling(c.orgnr ?? '').valuta === 'USD',
    );
    if (usd === undefined) throw new Error('no covered AS reporting in USD in the seed');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${usd.orgnr}/nokkeltall`);
    await expect(page.getByTestId('key-figure-table')).toBeVisible();
    await expect(page.getByTestId('key-figure-table')).not.toContainText(/\d kr/);
  });

  for (const width of [375, 320]) {
    test(`at ${width} px: the phone table, an expansion that opens and closes, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${A.orgnr}/nokkeltall`);
      await expect(region(page)).toBeHidden();
      const phone = page.locator('table[data-layout="phone"]');
      await expect(phone).toBeVisible();
      await noSidewaysScroll(page);
      const button = phone.getByRole('button', { name: nb['fig.driftsmargin'] });
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      const controls = await button.getAttribute('aria-controls');
      const expansion = page.locator(`[id="${controls}"]`);
      await expect(expansion).toBeHidden();
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(expansion).toBeVisible();
      await expect(expansion).toContainText(nb['keyFigures.col.median']);
      await noSidewaysScroll(page);
      await button.click();
      await expect(expansion).toBeHidden();
      const box = await phone.boundingBox();
      if (box === null) throw new Error('phone table not rendered');
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    });
  }

  test('the HTML and the RSC payload carry no peer orgnr and no peer key-figure amount', async ({ request }) => {
    const pool = expectedPool(A.orgnr ?? '', 0);
    const url = `/analyse/${A.orgnr}/nokkeltall`;
    const html = await (await request.get(url)).text();
    const rsc = await request.get(url, { headers: { RSC: '1' } });
    expect(rsc.headers()['content-type']).toContain('text/x-component');
    const payload = await rsc.text();
    for (const [label, body] of [
      ['html', html],
      ['rsc', payload],
    ] as const) {
      // The table is in the body, so the scan is not of an empty page.
      expect(body, label).toContain(nb['keyFigures.regionLabel']);
      const orgnrs = pool.filter((peer) => body.includes(peer.orgnr)).map((peer) => peer.orgnr);
      expect(orgnrs, label).toEqual([]);
      // Every non-null key-figure amount of every pool peer (the seven inputs
      // the candidate read now carries), as its øre digits without the sign.
      // Amounts under 6 digits (below 10 000 kr) are skipped: such short digit
      // runs occur in ordinary page text, ids and asset hashes.
      const amounts = pool
        .flatMap((peer) => Object.values(keyFigureRow(String(peer.brregId))))
        .filter((ore): ore is string => ore !== null)
        .map((ore) => ore.replace(/^-/, ''))
        .filter((digits) => digits.length >= 6);
      expect(amounts.length, label).toBeGreaterThan(pool.length);
      const leaked = amounts.filter((digits) => new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(body));
      expect(leaked, label).toEqual([]);
    }
  });
});
