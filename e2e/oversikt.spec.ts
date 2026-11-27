// The Oversikt hero (Story 1.9) against the production build and the loaded
// demo seed: the engine's amount, the same amount as the table, the
// settings kept, phone and desktop sizing, a subject with no peers, and the
// payload.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { atOrBeyondBest, heroContext, type ApiBenchmark } from '../src/engine/benchmark.ts';
import { formatKronerExact, formatPercent, formatPercentagePoints, formatWholePercent } from '../src/engine/format.ts';
import { apiInputsFromRow } from '../src/engine/inputs.ts';
import { computeApiKeyFigures } from '../src/engine/key-figures.ts';
import {
  A,
  expectedBenchmark,
  expectedGroup,
  expectedPool,
  h1,
  keyFigureRow,
  newestFiling,
  noSidewaysScroll,
  nonCalendar,
  notice,
  rendered,
  root,
  OUTSIDE,
  documentFigureOrgnrs,
  PROFIT_DRILL_FIELDS,
  expectProfitInputsStated,
} from './seed.ts';
import { expectNoPeerFields } from './payload.ts';
import { narrow } from '../test/narrow.ts';

/** A box as `Locator.boundingBox` gives it once the element is laid out. */
type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

/**
 * Each filing's exact driftsmargin as the engine computes it, cut to its
 * first 12 characters without the sign ("0.0183456789"): a run of digits no
 * formatted figure or plot coordinate on the page has (those have at most
 * two decimals). Short exact values ("0.05") are left out, as ordinary text.
 */
function exactMargins(brregIds: readonly string[]): string[] {
  return brregIds.flatMap((id) => {
    const margin = computeApiKeyFigures(apiInputsFromRow(keyFigureRow(id))).driftsmargin;
    if (margin.kind !== 'value') return [];
    const digits = margin.value.toString().replace(/^-/, '');
    return digits.length >= 12 ? [digits.slice(0, 12)] : [];
  });
}

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
    await expect(hero(page).getByText(nb['keyFigures.topNote'])).toBeVisible();
    // Story 3.7 (UX-DR12): the hero's "Hvordan er dette regnet?", the link Story 1.9 left out, opens the
    // drill-down of the same amount.
    const drillDown = hero(page).getByRole('button', { name: nb['provenance.trigger'] });
    await expect(drillDown).toHaveAttribute('aria-expanded', 'false');
    await drillDown.click();
    const body = hero(page).locator('[data-provenance-body="hero-prov"]');
    await expect(body).toBeVisible();
    await expect(body).toContainText(amountFor(expected));
  });

  for (const [query, label, band, ekskl] of [
    ['', 'default', 0, []],
    [withSettings, withSettings, 1, [firstPeer]],
  ] as const) {
    test(`the hero amount is the table’s driftsmargin cell for the same URL (${label})`, async ({ page }) => {
      // Both against the engine's amount for the URL's group, so they are each other's.
      const amount = amountFor(expectedBenchmark(A.orgnr ?? '', band, ekskl));
      expect(amount).toMatch(/\d kr$/);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/analyse/${A.orgnr}/oversikt${query}`);
      await expect(notice(page)).toHaveText('');
      await expect(heroAmount(page)).toHaveText(amount);
      await page.goto(`/analyse/${A.orgnr}/nokkeltall${query}`);
      await expect(tableGap(page)).toHaveText(amount);
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
      await expect(async () => {
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
      }).toPass();
    });
  }

  test('just above md (800 px) the amount scales down to fit its five-of-twelve column', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/oversikt`);
    await expect(rendered(page).getByTestId('hero-amount')).toBeVisible();
    await noSidewaysScroll(page);
    await expect(async () => {
      const fit = await heroAmount(page).evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
        size: parseFloat(getComputedStyle(el).fontSize),
      }));
      expect(fit.scroll).toBeLessThanOrEqual(fit.client);
      expect(fit.size).toBeLessThan(52);
    }).toPass();
  });

  test('at 1280 px the amount is set at 52 px in a five-of-twelve column', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/oversikt`);
    await expect(rendered(page).getByTestId('hero-amount')).toBeVisible();
    await expect(heroAmount(page)).toHaveCSS('font-size', '52px');
    // The card is the size container the amount scales against.
    await expect(rendered(page).getByTestId('hero')).toHaveCSS('container-type', 'inline-size');
    await expect(async () => {
      const card = await rendered(page).getByTestId('hero').boundingBox();
      if (card === null) throw new Error('hero not rendered');
      expect(card.width).toBeLessThan(1280 / 2);
    }).toPass();
  });

  test('a non-calendar year: the own value and the Peers tab’s sentence, not "(0 av 10)", no amount', async ({ page }) => {
    // In the committed seed it has its own value and no peers: below the floor.
    const c = narrow(expectedBenchmark(nonCalendar.orgnr ?? '', 0).driftsmargin.comparison, 'below_floor');
    await page.goto(`/analyse/${nonCalendar.orgnr}/oversikt`);
    await expect(page.getByTestId('hero-own')).toHaveText(pct(c.subject));
    await expect(hero(page)).toContainText(nb['peers.nonCalendar']);
    await expect(hero(page)).not.toContainText('0 av 10');
    // Story 3.4: the beeswarm card says the same, with no plot.
    await expect(page.getByTestId('beeswarm-absent')).toHaveText(nb['peers.nonCalendar']);
    await expect(page.getByTestId('beeswarm')).not.toContainText('0 av 10');
    await expect(page.getByTestId('beeswarm').getByRole('img')).toHaveCount(0);
    await expect(heroAmount(page)).toHaveCount(0);
    await expect(hero(page).getByText(nb['keyFigures.topNote'])).toHaveCount(0);
  });

  // Story 5.4: against the company outside the demo data (e2e/seed.ts), whose
  // only drill-down field names are the hero's: demo A's capital card now has
  // a drill-down of document lines (a subject with document figures is
  // scanned in e2e/synthetic-documents.spec.ts).
  const outsidePeer = expectedGroup(OUTSIDE.orgnr ?? '', 0)[0]?.orgnr ?? '';
  for (const [query, band] of [
    ['', 0],
    [`?ekskl=${outsidePeer}&band=1`, 1],
  ] as const) {
    test(`the HTML and the RSC payload of Oversikt carry no peer orgnr, peer key-figure amount or server field (${query === '' ? 'default' : 'ekskl and band 1'})`, async ({ request }) => {
      // The excluded peer is in the URL, and the tab links keep it. Story 3.4:
      // and no exact driftsmargin, the beeswarm's server-side input.
      const orgnr = OUTSIDE.orgnr ?? '';
      expect(documentFigureOrgnrs.has(orgnr)).toBe(false);
      const pool = expectedPool(orgnr, band);
      const exact = exactMargins([...pool.map((peer) => String(peer.brregId)), newestFiling(orgnr).brreg_id ?? '']);
      expect(exact.length).toBeGreaterThan(pool.length / 2);
      expectProfitInputsStated(orgnr);
      await expectNoPeerFields(request, `/analyse/${orgnr}/oversikt${query}`, {
        pool,
        marker: nb['oversikt.beeswarm.heading'],
        inUrl: query === '' ? [] : [outsidePeer],
        exact,
        // Story 3.7: the hero's drill-down; outside the demo data the capital card has none.
        fields: PROFIT_DRILL_FIELDS,
      });
    });
  }
});

// Story 3.4: the rest of Oversikt, against the production build and the
// loaded demo seed, for a company outside the demo data (not on the
// manifest's list of orgnrs with document figures), which every test below
// checks first; its group at the default band is the seed's. Story 5.4:
// demo A is in the demo data now, so the subject is OUTSIDE (e2e/seed.ts),
// chosen by a fixed rule.
test.describe('the rest of Oversikt (Story 3.4)', () => {
  const S = OUTSIDE;
  const manifest = JSON.parse(readFileSync(path.join(root, 'seed/demo/manifest.json'), 'utf8')) as {
    readonly document_figure_orgnrs: readonly string[];
  };
  const outsideDemoData = () => expect(manifest.document_figure_orgnrs).not.toContain(S.orgnr);
  const card = (page: Page, id: string) => rendered(page).getByTestId(id);
  const beeswarm = (page: Page) => card(page, 'beeswarm');
  const pct = (value: { toString(): string }) => formatPercent(value.toString());

  /** The summary the chart's image is named by, from the engine's comparison on the seed. */
  function expectedSummary(): string {
    const c = expectedBenchmark(S.orgnr ?? '', 0).driftsmargin.comparison;
    if (c.kind !== 'compared' || c.best === null) throw new Error('the subject’s driftsmargin is not compared');
    return (
      `Driftsmargin for ${c.count} sammenlignbare. ${S.navn ?? ''} ${pct(c.subject)}, median ${pct(c.median)}, ` +
      `beste fjerdedel ${pct(c.best.quartile)}, bedre enn ${formatWholePercent(c.best.percentile.toString())}.`
    );
  }

  test('outside the demo data: the cards', async ({ page }) => {
    outsideDemoData();
    // Fixture: outside the demo data every document figure is absent, so only the three API figures
    // can be a strength; on the seed, driftsmargin and totalkapitalrentabilitet are compared and below
    // beste fjerdedel, and egenkapitalandel has no direction.
    const api = expectedBenchmark(S.orgnr ?? '', 0);
    for (const key of ['driftsmargin', 'totalkapitalrentabilitet'] as const) {
      expect(api[key].comparison.kind, key).toBe('compared');
      expect(atOrBeyondBest(api[key].comparison, api[key].direction), key).toBe(false);
    }
    expect(api.egenkapitalandel.direction).toBe('none');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${S.orgnr}/oversikt`);
    // The hero and the beeswarm as normal: driftsmargin is an API figure.
    await expect(page.getByTestId('hero-amount')).toHaveText(/\d\skr$/);
    await expect(beeswarm(page).getByRole('img', { name: expectedSummary() })).toBeVisible();
    // Største kapitalgap: the basis's words, and no capital line.
    await expect(card(page, 'card-capital').locator('[data-card="empty"]')).toHaveText(nb['analysis.figures.notInDataset']);
    await expect(card(page, 'card-capital')).not.toContainText(nb['oversikt.capital.notPerYear']);
    // Største styrke: none of the three is at or beyond beste fjerdedel.
    await expect(card(page, 'card-strength').locator('[data-card="empty"]')).toHaveText('Ingen nøkkeltall ligger på eller over beste fjerdedel.');
    // Outside the demo data, EBITDA-margin (2) is the first figure without a basis, with eleven more after it (7 and 8 among them).
    await expect(card(page, 'card-missing').locator('[data-card="name"]')).toHaveText(nb['fig.ebitda']);
    await expect(card(page, 'card-missing').locator('[data-card="value"]')).toHaveText(nb['analysis.figures.notInDataset']);
    // "og 11 til" opens the table, keeping the settings.
    await card(page, 'card-missing').getByRole('link', { name: 'og 11 til' }).click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${S.orgnr}/nokkeltall$`));
  });

  test('the grid at three widths', async ({ page }) => {
    outsideDemoData();
    const ids = ['hero', 'beeswarm', 'card-capital', 'card-strength', 'card-missing'];
    const cards = () => ids.map((id) => card(page, id));
    /** Every card's box, in `ids` order; throws while one is not rendered. */
    const present = (boxes: readonly (Box | null)[]): Box[] =>
      boxes.map((box, i) => {
        if (box === null) throw new Error(`${ids[i]} is not rendered`);
        return box;
      });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${S.orgnr}/oversikt`);
    await expect(card(page, 'card-missing')).toBeVisible();
    await expect(async () => {
      const [hero, plot, capital, strength, missing] = present(await Promise.all(cards().map((c) => c.boundingBox())));
      if (hero === undefined || plot === undefined || capital === undefined || strength === undefined || missing === undefined) {
        throw new Error('a card is missing');
      }
      // 12 columns: the hero (5) beside the plot (7), then three cards of 4 in one row.
      expect(Math.abs(plot.y - hero.y)).toBeLessThan(1);
      expect(plot.width / hero.width).toBeGreaterThan(1.3);
      expect(plot.width / hero.width).toBeLessThan(1.5);
      for (const small of [strength, missing]) expect(Math.abs(small.y - capital.y)).toBeLessThan(1);
      expect(capital.y).toBeGreaterThan(hero.y + hero.height - 1);
      expect(Math.abs(strength.width - capital.width)).toBeLessThan(1);
    }).toPass();
    await noSidewaysScroll(page);
    // 800 px: still 12 columns, the phone plot in the 7-column card, three narrow cards side by side.
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto(`/analyse/${S.orgnr}/oversikt`);
    await expect(card(page, 'card-missing')).toBeVisible();
    await expect(async () => {
      const boxes = present(await Promise.all(cards().map((c) => c.boundingBox())));
      const [, narrowPlot, ...smalls] = boxes;
      expect(narrowPlot?.y).toBeCloseTo(boxes[0]?.y ?? 0, 0);
      for (const box of smalls) {
        expect(Math.abs(box.y - (smalls[0]?.y ?? 0))).toBeLessThan(1);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(800);
      }
      for (let i = 1; i < smalls.length; i += 1) expect(smalls[i]?.x ?? 0).toBeGreaterThanOrEqual((smalls[i - 1]?.x ?? 0) + (smalls[i - 1]?.width ?? 0));
    }).toPass();
    await expect(beeswarm(page).locator('[data-layout="phone"]').getByRole('img')).toBeVisible();
    await noSidewaysScroll(page);
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${S.orgnr}/oversikt`);
      await expect(card(page, 'card-missing')).toBeVisible();
      await expect(async () => {
        const stacked = present(await Promise.all(cards().map((c) => c.boundingBox())));
        // One column, in the order hero, plot and list, the three cards; every card inside the screen.
        for (let i = 1; i < stacked.length; i += 1) expect(stacked[i]?.y ?? 0).toBeGreaterThan((stacked[i - 1]?.y ?? 0) + 1);
        for (const box of stacked) expect(box.x + box.width).toBeLessThanOrEqual(width);
      }).toPass();
      await noSidewaysScroll(page);
      await beeswarm(page).getByRole('button', { name: nb['chart.showNumbers'] }).click();
      await noSidewaysScroll(page);
    }
  });

  test('one beeswarm image at each width', async ({ page }) => {
    outsideDemoData();
    for (const width of [1280, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/analyse/${S.orgnr}/oversikt`);
      await expect(beeswarm(page)).toBeVisible();
      // Two layouts are rendered; the one not shown has display: none, so exactly one image is accessible.
      await expect(beeswarm(page).locator('svg[role="img"]')).toHaveCount(2);
      await expect(beeswarm(page).getByRole('img')).toHaveCount(1);
      await expect(beeswarm(page).getByRole('img')).toHaveAttribute('aria-label', expectedSummary());
    }
  });

  test('the beeswarm is an image with a table', async ({ page }) => {
    outsideDemoData();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${S.orgnr}/oversikt`);
    const image = beeswarm(page).getByRole('img');
    await expect(image).toHaveAttribute('focusable', 'false');
    await expect(image).not.toHaveAttribute('tabindex');
    // Every child hidden: the image's one child is an aria-hidden group.
    await expect.poll(() => image.evaluate((svg) => [...svg.children].map((child) => child.getAttribute('aria-hidden')))).toEqual(['true']);
    // The legend names each marker with its value.
    const c = expectedBenchmark(S.orgnr ?? '', 0).driftsmargin.comparison;
    if (c.kind !== 'compared' || c.best === null) throw new Error('the subject’s driftsmargin is not compared');
    await expect(beeswarm(page).getByTestId('beeswarm-legend').locator('li')).toHaveText([
      `${S.navn ?? ''} ${pct(c.subject)}`,
      `Median ${pct(c.median)}`,
      `Beste fjerdedel ${pct(c.best.quartile)}`,
    ]);
    // "Vis tallene": the table in a scroll region named by its caption, the company's row marked.
    await beeswarm(page).getByRole('button', { name: nb['chart.showNumbers'] }).click();
    const region = beeswarm(page).getByRole('region', { name: nb['oversikt.beeswarm.caption'] });
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute('tabindex', '0');
    const table = region.getByRole('table', { name: nb['oversikt.beeswarm.caption'] });
    await expect(table.locator('tbody tr')).toHaveCount(expectedGroup(S.orgnr ?? '', 0).length + 1);
    await expect(table.locator('tr[data-selected="true"] th')).toHaveText(`${S.navn ?? ''} ${nb['oversikt.beeswarm.selected']}`);
    await beeswarm(page).getByRole('button', { name: nb['chart.hideNumbers'] }).click();
    await expect(region).toBeHidden();
    // Forced colours: the company, the peers, the median and beste fjerdedel each drawn their own way.
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(async () => {
      const looks = await beeswarm(page)
        .locator('[data-layout="desktop"] .bs-mark')
        .evaluateAll((marks) =>
          marks.map((mark) => {
            const style = getComputedStyle(mark);
            return { mark: mark.getAttribute('data-mark') ?? '', look: `${style.fill}|${style.stroke}|${style.strokeDasharray}` };
          }),
        );
      const byMark = new Map<string, Set<string>>();
      for (const { mark, look } of looks) byMark.set(mark, (byMark.get(mark) ?? new Set<string>()).add(look));
      expect([...byMark.keys()].sort()).toEqual(['best', 'company', 'median', 'peer']);
      for (const [mark, set] of byMark) expect(set.size, mark).toBe(1);
      expect(new Set([...byMark.values()].map((set) => [...set][0])).size).toBe(4);
    }).toPass();
  });

  test('Driftsmargin reads the same in the list, the table and Peers', async ({ page }) => {
    outsideDemoData();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${S.orgnr}/oversikt`);
    // Each row's name and the margin in its first data cell (run in the browser).
    const nameAndMargin = (trs: Element[]) =>
      trs.map((tr) => ({ name: tr.querySelector('th')?.textContent ?? '', margin: tr.querySelector('td')?.textContent ?? '' }));
    const group = expectedGroup(S.orgnr ?? '', 0).length;
    // Each list is read inside a retried block that asserts it is complete, then compared with the next.
    let nearest: { name: string; margin: string }[] = [];
    await expect(async () => {
      nearest = await beeswarm(page).locator('[data-testid="beeswarm-nearest"] tbody tr[data-selected="false"]').evaluateAll(nameAndMargin);
      expect(nearest).toHaveLength(5);
    }).toPass();
    await beeswarm(page).getByRole('button', { name: nb['chart.showNumbers'] }).click();
    let numbers: { name: string; margin: string }[] = [];
    await expect(async () => {
      numbers = await beeswarm(page).locator('[data-testid="beeswarm-table"] tbody tr:not([data-selected])').evaluateAll(nameAndMargin);
      expect(numbers).toHaveLength(group);
    }).toPass();
    // "Se alle {n}" goes to Peers, keeping the settings.
    await beeswarm(page).getByTestId('beeswarm-see-all').click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${S.orgnr}/peers$`));
    const peerRows = rendered(page).getByRole('region', { name: nb['peers.regionLabel'] }).locator('tbody tr');
    // The Peers list lists the group, as "Vis tallene" does (no peer is excluded here).
    await expect(peerRows).toHaveCount(group);
    await expect(async () => {
      const peers = await peerRows.evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '')));
      const fromPeers = new Map(peers.map((cells) => [cells[0] ?? '', cells[2] ?? '']));
      for (const row of [...nearest, ...numbers]) expect(row.margin, row.name).toBe(fromPeers.get(row.name));
    }).toPass();
  });

  test('tooltip on hover', async ({ page }) => {
    outsideDemoData();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${S.orgnr}/oversikt`);
    const desktop = beeswarm(page).locator('[data-layout="desktop"]');
    await expect(desktop.getByRole('img')).toBeVisible();
    // A dot on the axis, away from the edge columns: the middle of the swarm's dots, which are drawn in
    // packing order, by driftsmargin and so by x (src/analysis/beeswarm.ts).
    const circles = desktop.locator('g[data-mark="peer"] circle');
    const plotted = expectedGroup(S.orgnr ?? '', 0).length;
    await expect(circles).toHaveCount(plotted);
    const dot = circles.nth(Math.floor(plotted / 2));
    await dot.hover();
    const tooltip = page.getByTestId('beeswarm-tooltip');
    await expect(tooltip).toHaveCount(1);
    await expect(tooltip).toBeVisible();
    await expect(async () => {
      // The tooltip names the dot it belongs to: the picked ring sits on that dot.
      const picked = await desktop.locator('circle[data-mark="picked"]').boundingBox();
      const at = await dot.boundingBox();
      if (picked === null || at === null) throw new Error('no picked dot');
      expect(Math.hypot(picked.x + picked.width / 2 - (at.x + at.width / 2), picked.y + picked.height / 2 - (at.y + at.height / 2))).toBeLessThan(12);
      // Its name is a peer's, and its value that peer's Driftsmargin in "Vis tallene".
      const [margin, name] = await tooltip.locator('span').allTextContents();
      const row = beeswarm(page).locator('[data-testid="beeswarm-table"] tbody tr').filter({ has: page.locator('th', { hasText: name ?? '' }) });
      expect(await row.first().locator('td').first().textContent()).toBe(margin);
    }).toPass();
    // Out of the plot: no tooltip.
    await beeswarm(page).getByRole('heading', { level: 3 }).hover({ position: { x: 5, y: 5 } });
    await expect(tooltip).toHaveCount(0);
  });

  test.describe('on touch', () => {
    test.use({ hasTouch: true });

    test('tooltip on touch', async ({ page }) => {
      outsideDemoData();
      await page.setViewportSize({ width: 375, height: 900 });
      await page.goto(`/analyse/${S.orgnr}/oversikt`);
      const phone = beeswarm(page).locator('[data-layout="phone"]');
      const svg = phone.getByRole('img');
      await expect(svg).toBeVisible();
      await svg.scrollIntoViewIfNeeded();
      const circles = phone.locator('g[data-mark="peer"] circle');
      await expect(circles).toHaveCount(expectedGroup(S.orgnr ?? '', 0).length);
      // A tap on a dot opens its tooltip above the plot, with a leader line to the dot.
      await circles.first().tap();
      const tooltip = page.getByTestId('beeswarm-tooltip');
      await expect(tooltip).toHaveCount(1);
      await expect(tooltip).toBeVisible();
      await expect(async () => {
        const tip = await tooltip.boundingBox();
        const plot = await svg.boundingBox();
        if (tip === null || plot === null) throw new Error('no tooltip or plot');
        expect(tip.y + tip.height).toBeLessThanOrEqual(plot.y);
      }).toPass();
      await expect(page.getByTestId('beeswarm-leader')).toBeVisible();
      // Another dot: still one tooltip.
      await circles.last().tap();
      await expect(tooltip).toHaveCount(1);
      // A tap elsewhere closes it.
      await beeswarm(page).getByRole('heading', { level: 3 }).tap({ position: { x: 5, y: 5 } });
      await expect(tooltip).toHaveCount(0);
    });
  });
});
