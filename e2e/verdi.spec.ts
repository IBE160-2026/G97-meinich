// The Verdi tab (Story 3.5; FR-30, FR-31, FR-62) against the production
// build and the loaded demo seed: the closable-share control and the three
// cards for demo A and B, the share written with one `history.replaceState`,
// the share kept by every later link, "· Endre i Verdi" wherever the top
// note is, the payload, and the phone. Every expected amount is the
// engine's, computed here from the seed (e2e/seed.ts), with the median
// step's profit as (M − r) × revenue; each fixture's state is asserted
// before it is used.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { medianStep } from '../src/engine/closable.ts';
import { Decimal } from '../src/engine/decimal.ts';
import { formatKronerExact, formatWholePercentNumber } from '../src/engine/format.ts';
import { apiInputsFromRow } from '../src/engine/inputs.ts';
import { computeApiKeyFigures, resolveApiInputs } from '../src/engine/key-figures.ts';
import { expectNoPeerFields, expectWireSet } from './payload.ts';
import {
  A,
  companyShown,
  expectedBenchmark,
  expectedPool,
  keyFigureRow,
  newestFiling,
  noSidewaysScroll,
  notice,
  rendered,
  tabs,
} from './seed.ts';

const fill = (id: keyof typeof nb, vars: Record<string, string>) =>
  Object.entries(vars).reduce((text, [name, value]) => text.replace(`{${name}}`, value), nb[id]);

/** What the engine gives a demo company's profit card at the default band, written out from the seed. */
function profitOracle(orgnr: string) {
  const benchmark = expectedBenchmark(orgnr, 0);
  const c = benchmark.driftsmargin.comparison;
  if (c.kind !== 'compared' || c.best === null) throw new Error(`${orgnr}: driftsmargin is not compared`);
  const step = medianStep(c);
  if (step.kind !== 'exists') throw new Error(`${orgnr}: no median step`);
  const revenue = resolveApiInputs(apiInputsFromRow(keyFigureRow(newestFiling(orgnr).brreg_id ?? ''))).sumDriftsinntekter;
  if (revenue === null) throw new Error(`${orgnr}: no revenue`);
  const ore = new Decimal(revenue.ore.toString());
  const full = c.best.quartile.minus(c.subject).mul(ore);
  const atMedian = c.median.minus(c.subject).mul(ore);
  const kr = (value: Decimal) => formatKronerExact(value.toString());
  return {
    sMed: step.share,
    percent: formatWholePercentNumber(step.share.mul(100).toString()),
    full: kr(full),
    at: (share: number | 'median') => kr(share === 'median' ? atMedian : full.mul(share).div(100)),
    fullExact: full,
  };
}

const control = (page: Page) => page.getByRole('radiogroup', { name: nb['verdi.control.label'] });
const step = (page: Page, share: number | 'median') => control(page).locator(`[data-share-step="${share}"]`);
const card = (page: Page, id: string) => rendered(page).getByTestId(id);
const profitValue = (page: Page) => card(page, 'verdi-profit').locator('[data-card="amount"]');

const DEMOS = DEMO_COMPANIES.map((demo) => ({ ...demo, oracle: profitOracle(demo.orgnr) }));
const DEMO_A = ((): (typeof DEMOS)[number] => {
  const demo = DEMOS[0];
  if (demo === undefined) throw new Error('no demo A');
  return demo;
})();

test.describe('Verdi (Story 3.5)', () => {
  for (const demo of DEMOS) {
    test(`${demo.navn}: the median step, the profit card at 50 % and both capital cards outside the demo data`, async ({ page }) => {
      // Fixture: the demo company is outside the demo data (no document figures) and has a median step.
      expect(demo.oracle.sMed.gt(0) && demo.oracle.sMed.lt(1)).toBe(true);
      await page.goto(`/analyse/${demo.orgnr}/verdi`);
      await companyShown(page, demo.navn);
      await expect(page).toHaveTitle(`${demo.navn} – ${nb['tabs.verdi']} – Peerless`);
      await expect(tabs(page).getByRole('link', { name: nb['tabs.verdi'] })).toHaveAttribute('aria-current', 'page');
      await expect(notice(page)).toHaveText('');
      const median = step(page, 'median');
      await expect(median).toHaveText(fill('verdi.step.median', { n: demo.oracle.percent }));
      await expect(median).not.toHaveAttribute('aria-disabled', /.*/);
      await expect(step(page, 50)).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('verdi-median-line')).toHaveText(fill('verdi.median.share', { n: demo.oracle.percent }));
      await expect(profitValue(page)).toHaveText(fill('verdi.profit.value', { a: demo.oracle.at(50), full: demo.oracle.full }));
      for (const id of ['verdi-working-capital', 'verdi-oml']) {
        await expect(card(page, id).locator('[data-card="text"]')).toHaveText(nb['analysis.figures.notInDataset']);
        await expect(card(page, id)).not.toContainText(nb['verdi.workingCapital.noTotal']);
      }
    });
  }

  test('the median step uses the exact s: andel=median is kept with no notice', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi?andel=median`);
    await companyShown(page, navn);
    await expect(notice(page)).toHaveText('');
    await expect(step(page, 'median')).toHaveAttribute('aria-checked', 'true');
    await expect(profitValue(page)).toHaveText(fill('verdi.profit.value', { a: oracle.at('median'), full: oracle.full }));
    // The amount at the rounded whole percent is another one.
    expect(formatKronerExact(oracle.fullExact.mul(oracle.percent).div(100).toString())).not.toBe(oracle.at('median'));
  });

  test('a share change replaces the URL and keeps focus', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    // Every call the page's own code makes to window.history.replaceState. Next.js wraps the method
    // to keep its router in step, and its own sync after the change calls it again with its internal
    // state (`__NA`), which is not the page's write and is not counted.
    await page.evaluate(() => {
      const w = window as unknown as { __replaced: string[] };
      w.__replaced = [];
      const wrapped = window.history.replaceState.bind(window.history);
      window.history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
        const internal = typeof data === 'object' && data !== null && '__NA' in data;
        if (!internal) w.__replaced.push(String(url ?? ''));
        wrapped(data, unused, url);
      };
    });
    const status = page.getByTestId('verdi-status');
    await expect(status).toHaveText('');
    const before = await page.evaluate(() => ({ length: window.history.length, replaced: (window as unknown as { __replaced: string[] }).__replaced.length }));
    await step(page, 25).click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${orgnr}/verdi\\?andel=25$`));
    await expect(step(page, 25)).toBeFocused();
    await expect(step(page, 25)).toHaveAttribute('aria-checked', 'true');
    await expect(profitValue(page)).toHaveText(fill('verdi.profit.value', { a: oracle.at(25), full: oracle.full }));
    await expect(status).toHaveText(fill('verdi.announce.profit', { a: oracle.at(25), full: oracle.full }));
    const after = await page.evaluate(() => ({
      length: window.history.length,
      replaced: (window as unknown as { __replaced: string[] }).__replaced,
    }));
    // One replaceState, with andel in the URL; no history entry added.
    expect(before.replaced).toBe(0);
    expect(after.replaced).toEqual([`/analyse/${orgnr}/verdi?andel=25`]);
    expect(after.length).toBe(before.length);
    // The arrow keys move to the next step and choose it, focus with it.
    await page.keyboard.press('ArrowRight');
    await expect(step(page, 50)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/analyse/${orgnr}/verdi$`));
    await expect(status).toHaveText(fill('verdi.announce.profit', { a: oracle.at(50), full: oracle.full }));
    // No entry was added by the second change either.
    expect(await page.evaluate(() => window.history.length)).toBe(before.length);
  });

  test('the arrow keys wrap and choose; Tab leaves the group and Shift+Tab returns to the checked step', async ({ page }) => {
    const { orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    // The fixture's state: demo A's steps, the median step second, all enabled.
    await expect(control(page).getByRole('radio')).toHaveCount(6);
    await expect(control(page).locator('[aria-disabled="true"]')).toHaveCount(0);
    await step(page, 0).click();
    await expect.poll(() => new URL(page.url()).search).toBe('?andel=0');
    await page.keyboard.press('ArrowLeft');
    await expect(step(page, 100)).toBeFocused();
    await expect(step(page, 100)).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => new URL(page.url()).search).toBe('?andel=100');
    await page.keyboard.press('ArrowRight');
    await expect(step(page, 0)).toBeFocused();
    await expect(step(page, 0)).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => new URL(page.url()).search).toBe('?andel=0');
    // Roving tabindex: only the checked step is in the tab order.
    await expect(control(page).locator('[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(control(page).locator(':focus')).toHaveCount(0);
    await page.keyboard.press('Shift+Tab');
    await expect(step(page, 0)).toBeFocused();
  });

  test('a reload after a share change renders the same step and cards, with no hydration error', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    await step(page, 'median').click();
    await expect.poll(() => new URL(page.url()).search).toBe('?andel=median');
    // replaceState writes the URL before React renders the cards again (PR #78, CI): read them
    // only once the median step is checked, and check they are the median step's.
    await expect(step(page, 'median')).toHaveAttribute('aria-checked', 'true');
    const before = await rendered(page).getByTestId('verdi-cards').innerText();
    expect(before).toContain(fill('verdi.profit.share', { andel: fill('verdi.share.percent', { n: oracle.percent }) }));
    await page.reload();
    await companyShown(page, navn);
    await expect(step(page, 'median')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => rendered(page).getByTestId('verdi-cards').innerText()).toBe(before);
    expect(errors.filter((text) => /hydrat/i.test(text))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a tab change after a share change keeps both', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/oversikt`);
    await companyShown(page, navn);
    const hero = await page.getByTestId('hero-amount').innerText();
    expect(hero).toBe(oracle.full);
    await tabs(page).getByRole('link', { name: nb['tabs.verdi'] }).click();
    await expect(page.getByRole('heading', { level: 2, name: nb['tabs.verdi'] })).toBeFocused();
    await page.goto(`/analyse/${orgnr}/verdi?multippel=6.5`);
    await companyShown(page, navn);
    await step(page, 'median').click();
    await expect(page).toHaveURL(new RegExp(`/verdi\\?andel=median&multippel=6\\.5$`));
    for (const fane of ['oversikt', 'peers', 'nokkeltall'] as const) {
      await expect(tabs(page).getByRole('link', { name: nb[`tabs.${fane}`] })).toHaveAttribute(
        'href',
        `/analyse/${orgnr}/${fane}?andel=median&multippel=6.5`,
      );
    }
    await tabs(page).getByRole('link', { name: nb['tabs.oversikt'] }).click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${orgnr}/oversikt\\?andel=median&multippel=6\\.5$`));
    await expect(notice(page)).toHaveText('');
    // Oversikt stays at full convergence whatever the share.
    await expect(page.getByTestId('hero-amount')).toHaveText(hero);
    await tabs(page).getByRole('link', { name: nb['tabs.nokkeltall'] }).click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${orgnr}/nokkeltall\\?andel=median&multippel=6\\.5$`));
    await expect(rendered(page).locator('tr[data-figure="driftsmargin"] td[data-cell="gap"]')).toContainText(hero);
  });

  test('Endre i Verdi everywhere the top note is', async ({ page }) => {
    // Demo A: the hero and the table carry the top note; its capital card has no amount, so no note
    // (the synthetic subject's capital card is checked in e2e/synthetic-documents.spec.ts).
    const { orgnr, navn } = DEMO_A;
    for (const fane of ['oversikt', 'nokkeltall'] as const) {
      await page.goto(`/analyse/${orgnr}/${fane}?band=1`);
      await companyShown(page, navn);
      const notes = rendered(page).getByTestId('top-note');
      await expect(notes).toHaveCount(1);
      await expect(notes).toHaveText(`${nb['keyFigures.topNote']} · ${nb['keyFigures.editInVerdi']}`);
      await expect(notes.getByRole('link', { name: nb['keyFigures.editInVerdi'] })).toHaveAttribute('href', `/analyse/${orgnr}/verdi?band=1`);
    }
    await rendered(page).getByTestId('top-note').getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${orgnr}/verdi\\?band=1$`));
    await expect(page.getByRole('heading', { level: 2, name: nb['tabs.verdi'] })).toBeFocused();
  });

  test('the HTML and the RSC payload of Verdi carry exactly the wire set', async ({ request }) => {
    const { orgnr } = DEMO_A;
    const pool = expectedPool(orgnr, 0);
    const exact = pool.flatMap((peer) => {
      const margin = computeApiKeyFigures(apiInputsFromRow(keyFigureRow(String(peer.brregId)))).driftsmargin;
      if (margin.kind !== 'value') return [];
      const digits = margin.value.toString().replace(/^-/, '');
      return digits.length >= 12 ? [digits.slice(0, 12)] : [];
    });
    expect(exact.length).toBeGreaterThan(pool.length / 2);
    const url = `/analyse/${orgnr}/verdi`;
    // The client component's name: in the RSC payload, and in the HTML's inline copy of it.
    await expectNoPeerFields(request, url, { pool, marker: 'VerdiPanel', exact });
    await expectWireSet(request, url, orgnr, wireSetOf(DEMO_A.oracle));
  });
});

/** Demo A's wire values: the profit at full convergence and at the median step, and s_med. */
function wireSetOf(oracle: (typeof DEMOS)[number]['oracle']): string[] {
  const { orgnr } = DEMO_A;
  const c = expectedBenchmark(orgnr, 0).driftsmargin.comparison;
  if (c.kind !== 'compared') throw new Error('demo A is compared');
  const revenue = resolveApiInputs(apiInputsFromRow(keyFigureRow(newestFiling(orgnr).brreg_id ?? ''))).sumDriftsinntekter;
  if (revenue === null) throw new Error('demo A has a revenue');
  const atMedian = c.median.minus(c.subject).mul(new Decimal(revenue.ore.toString()));
  return [oracle.fullExact.toString(), atMedian.toString(), oracle.sMed.toString()].sort();
}

for (const width of [375, 320]) {
  test(`at ${width} px: the control 3 × 2, the cards stacked, targets at least 24 × 24, no sideways scroll`, async ({ page }) => {
    const { orgnr, navn } = DEMO_A;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    await noSidewaysScroll(page);
    const boxes = await control(page).getByRole('radio').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
    expect(boxes).toHaveLength(6);
    expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(2);
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
    const cards = await rendered(page)
      .getByTestId('verdi-cards')
      .locator(':scope > section')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().y));
    expect(cards).toHaveLength(3);
    expect(cards[1] ?? 0).toBeGreaterThan(cards[0] ?? 0);
    expect(cards[2] ?? 0).toBeGreaterThan(cards[1] ?? 0);
    // Every tab is on the page, wrapping rather than scrolling.
    await expect(tabs(page).getByRole('link')).toHaveCount(4);
    await noSidewaysScroll(page);
  });
}

// Demo A is the subject the tests above name.
test('demo A is the seed’s first demo company', () => {
  expect(A.orgnr).toBe(DEMO_A.orgnr);
});
