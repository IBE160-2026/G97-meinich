// The Oversikt hero (Story 1.9) against the production build and the loaded
// demo seed: the engine's amount, the same amount as the table, the
// settings kept, phone and desktop sizing, a subject with no peers, and the
// payload.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { heroContext, type ApiBenchmark } from '../src/engine/benchmark.ts';
import { formatKronerExact, formatPercent, formatPercentagePoints, formatWholePercent } from '../src/engine/format.ts';
import {
  A,
  expectedBenchmark,
  expectedGroup,
  expectedPool,
  h1,
  keyFigureRow,
  noSidewaysScroll,
  nonCalendar,
  notice,
  rendered,
} from './seed.ts';

test.describe('the Oversikt hero (Story 1.9)', () => {
  const hero = (page: Page) => page.getByTestId('hero');
  const heroAmount = (page: Page) => page.getByTestId('hero-amount');
  const tableGap = (page: Page) =>
    page
      .getByRole('region', { name: nb['keyFigures.regionLabel'] })
      .locator('tr[data-figure="driftsmargin"] td[data-cell="gap"] > span')
      .first();
  const pct = (value: { toString(): string }) => formatPercent(value.toString());
  const pool = expectedGroup(A.orgnr ?? '', 0);
  const firstPeer = pool[0]?.orgnr;
  if (firstPeer === undefined) throw new Error('demo A has no peers at the default band in the seed');
  const withSettings = `?ekskl=${firstPeer}&band=1`;
  const amountFor = (benchmark: ApiBenchmark): string => {
    const gap = benchmark.driftsmargin.gap;
    if (gap.kind !== 'amount') throw new Error(`demo A's driftsmargin gap is ${gap.kind}, not an amount`);
    return formatKronerExact(gap.ore.toString());
  };

  test('search for demo A by name and choose it: Oversikt, h1 focused, the engine’s amount in the hero', async ({ page }) => {
    const expected = expectedBenchmark(A.orgnr ?? '', 0);
    const c = expected.driftsmargin.comparison;
    if (c.kind !== 'compared' || c.best === null) throw new Error('demo A’s driftsmargin is not compared');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.getByRole('combobox', { name: nb['search.label'] }).fill(A.navn ?? '');
    await page.getByRole('option', { name: A.navn ?? '' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/oversikt$`));
    await expect(h1(page)).toHaveText(A.navn ?? '');
    await expect(h1(page)).toBeFocused();

    await expect(heroAmount(page)).toHaveText(amountFor(expected));
    await expect(page.getByRole('heading', { level: 3, name: nb['hero.kicker'] })).toBeVisible();
    await expect(page.getByRole('region', { name: nb['hero.kicker'] })).toBeVisible();
    await expect(hero(page)).toContainText(nb['keyFigures.dir.higher']);
    await expect(hero(page)).toContainText(nb['hero.perYear']);
    await expect(page.getByTestId('hero-vs')).toHaveText(`${pct(c.subject)} mot ${pct(c.best.quartile)} i beste fjerdedel`);
    // The context line from the engine's sides and distance, worded by the message ids.
    const side = heroContext(c);
    if (side === null || side.best !== 'below') throw new Error('demo A is not below beste fjerdedel');
    await expect(page.getByTestId('hero-context')).toHaveText(
      [
        nb[`hero.ctx.median.${side.median}`].replace('{med}', pct(c.median)),
        `bedre enn ${formatWholePercent(c.best.percentile.toString())}`,
        nb['hero.ctx.best.below'].replace('{pp}', formatPercentagePoints(side.toBest.toString())),
      ].join(' · '),
    );
    await expect(page.getByText(nb['keyFigures.topNote'])).toBeVisible();
  });

  for (const query of ['', withSettings]) {
    test(`the hero amount is the table’s driftsmargin cell for the same URL (${query === '' ? 'default' : query})`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/analyse/${A.orgnr}/oversikt${query}`);
      await expect(notice(page)).toHaveText('');
      const fromHero = await heroAmount(page).textContent();
      await page.goto(`/analyse/${A.orgnr}/nokkeltall${query}`);
      const fromTable = await tableGap(page).textContent();
      expect(fromHero).toMatch(/\d kr$/);
      expect(fromHero).toBe(fromTable);
    });
  }

  test('"Se alle nøkkeltall" opens the table, keeping the settings', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/oversikt?band=1`);
    await hero(page).getByRole('link', { name: nb['hero.link'] }).click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/nokkeltall\\?band=1$`));
    await expect(page.getByRole('region', { name: nb['keyFigures.regionLabel'] })).toBeVisible();
  });

  for (const width of [375, 320]) {
    test(`at ${width} px: the hero first, the amount on one line inside its card, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${A.orgnr}/oversikt`);
      await expect(heroAmount(page)).toBeVisible();
      await noSidewaysScroll(page);
      const heading = await page.getByRole('heading', { level: 2, name: nb['tabs.oversikt'] }).boundingBox();
      const card = await hero(page).boundingBox();
      const amount = await heroAmount(page).boundingBox();
      if (heading === null || card === null || amount === null) throw new Error('hero not rendered');
      // Directly under the panel heading, full width: one column.
      expect(card.y).toBeGreaterThan(heading.y);
      expect(card.width).toBeGreaterThan(width - 40);
      expect(card.x + card.width).toBeLessThanOrEqual(width);
      expect(amount.x + amount.width).toBeLessThanOrEqual(card.x + card.width);
      const fit = await heroAmount(page).evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
        height: el.getBoundingClientRect().height,
        line: parseFloat(getComputedStyle(el).lineHeight),
        size: parseFloat(getComputedStyle(el).fontSize),
      }));
      expect(fit.scroll).toBeLessThanOrEqual(fit.client);
      expect(fit.height).toBeLessThan(fit.line * 1.5);
      expect(fit.size).toBeLessThanOrEqual(40);
    });
  }

  test('just above md (800 px) the amount scales down to fit its five-of-twelve column', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/oversikt`);
    await expect(rendered(page).getByTestId('hero-amount')).toBeVisible();
    await noSidewaysScroll(page);
    const fit = await heroAmount(page).evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      size: parseFloat(getComputedStyle(el).fontSize),
    }));
    expect(fit.scroll).toBeLessThanOrEqual(fit.client);
    expect(fit.size).toBeLessThan(52);
  });

  test('at 1280 px the amount is set at 52 px in a five-of-twelve column', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/oversikt`);
    await expect(rendered(page).getByTestId('hero-amount')).toBeVisible();
    await expect(heroAmount(page)).toHaveCSS('font-size', '52px');
    // The card is the size container the amount scales against.
    await expect(rendered(page).getByTestId('hero')).toHaveCSS('container-type', 'inline-size');
    const card = await rendered(page).getByTestId('hero').boundingBox();
    if (card === null) throw new Error('hero not rendered');
    expect(card.width).toBeLessThan(1280 / 2);
  });

  test('a non-calendar year: the own value and the Peers tab’s sentence, not "(0 av 10)", no amount', async ({ page }) => {
    const c = expectedBenchmark(nonCalendar.orgnr ?? '', 0).driftsmargin.comparison;
    await page.goto(`/analyse/${nonCalendar.orgnr}/oversikt`);
    if (c.kind === 'subject_absent') await expect(page.getByTestId('hero-own')).toContainText('Kan ikke beregnes');
    else await expect(page.getByTestId('hero-own')).toHaveText(pct(c.subject));
    await expect(hero(page)).toContainText(nb['peers.nonCalendar']);
    await expect(hero(page)).not.toContainText('0 av 10');
    await expect(heroAmount(page)).toHaveCount(0);
    await expect(page.getByText(nb['keyFigures.topNote'])).toHaveCount(0);
  });

  for (const [query, band] of [
    ['', 0],
    [withSettings, 1],
  ] as const) {
    test(`the HTML and the RSC payload of Oversikt carry no peer orgnr and no peer key-figure amount (${query === '' ? 'default' : query})`, async ({ request }) => {
      const bandPool = expectedPool(A.orgnr ?? '', band);
      const url = `/analyse/${A.orgnr}/oversikt${query}`;
      const html = await (await request.get(url)).text();
      const payload = await (await request.get(url, { headers: { RSC: '1' } })).text();
      // The excluded peer is in the URL, and the tab links keep it.
      const scanned = bandPool.filter((peer) => !(query !== '' && peer.orgnr === firstPeer));
      // Every non-null key-figure amount of every pool peer, excluded or not, as
      // its øre digits without the sign; under 6 digits skipped, as in Story 1.8's test.
      const amounts = bandPool
        .flatMap((peer) => Object.values(keyFigureRow(String(peer.brregId))))
        .filter((ore): ore is string => ore !== null)
        .map((ore) => ore.replace(/^-/, ''))
        .filter((digits) => digits.length >= 6);
      expect(amounts.length).toBeGreaterThan(bandPool.length);
      for (const [label, body] of [
        ['html', html],
        ['rsc', payload],
      ] as const) {
        expect(body, label).toContain(nb['hero.kicker']);
        expect(scanned.filter((peer) => body.includes(peer.orgnr)).map((peer) => peer.orgnr), label).toEqual([]);
        const leaked = amounts.filter((digits) => new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(body));
        expect(leaked, label).toEqual([]);
      }
    });
  }
});
