// The key-figure table (Stories 1.8, 3.1b) against the production build and
// the loaded demo seed: every cell against the engine run on the seed, the
// scroll region, below the floor, `ekskl`, another currency, the phone
// table and the payload; since Story 3.1b, the document rows of a subject
// outside the demo data, the info popover, and every row on the phone; since
// Story 3.2, the two decomposition fold-outs.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import {
  formatKronerExact,
  formatPercent,
  formatPercentNumber,
  formatTurnover,
  formatWholePercent,
} from '../src/engine/format.ts';
import type { Comparison } from '../src/engine/types.ts';
import {
  A,
  companies,
  covered,
  expectedBenchmark,
  expectedGroup,
  expectedPool,
  expectedTurnover,
  newestFiling,
  noSidewaysScroll,
  notice,
  withFiling,
  PROFIT_DRILL_FIELDS,
  expectProfitInputsStated,
} from './seed.ts';
import { expectNoPeerFields } from './payload.ts';

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
    // The fixture's state: demo A's driftsmargin is below beste fjerdedel, a profit amount, followed by
    // its "Hvordan er dette regnet?" (Story 3.7).
    const gap = expected.driftsmargin.gap;
    if (gap.kind !== 'amount') throw new Error(`demo A's driftsmargin gap is ${gap.kind}, not an amount`);
    await expect(cell(page, 'driftsmargin', 'gap')).toHaveText(
      `${formatKronerExact(gap.ore.toString())}${nb['keyFigures.perYear']}${nb['provenance.trigger']}`,
    );
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
    // One per compared row; since Story 3.2 the margin fold-out's two factors draw their own.
    await expect(r.locator('tr[data-figure]').getByTestId('distribution-strip')).toHaveCount(3);
    const strips = r.getByTestId('distribution-strip');
    await expect(strips).toHaveCount(5);
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
    await expect(page.getByTestId('non-small-notice')).toHaveText(nb['keyFigures.nonSmall']);
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

  test('the HTML and the RSC payload carry no peer orgnr, peer key-figure amount or server field', async ({ request }) => {
    expectProfitInputsStated(A.orgnr ?? '');
    await expectNoPeerFields(request, `/analyse/${A.orgnr}/nokkeltall`, {
      pool: expectedPool(A.orgnr ?? '', 0),
      marker: nb['keyFigures.regionLabel'],
      // Story 3.7: demo A's one amount is driftsmargin's, outside the demo data.
      fields: PROFIT_DRILL_FIELDS,
    });
  });

  // Story 3.1b: every document row, in key-figures order, and how they read
  // for a subject outside the demo data (demo A is not on the manifest's list).
  const ORDER = [
    'driftsmargin',
    'ebitda',
    'vare',
    'lonn',
    'andre',
    'total',
    'omsArsverk',
    'lonnArsverk',
    'kfd',
    'lgd',
    'oml',
    'totalkapitalrentabilitet',
    'egenkapitalandel',
    'kontant',
    'vekst',
  ];
  // The document rows that take the subject's basis: 7 and 8 are not read in v1 on any basis.
  const OUTSIDE_ROWS = ['ebitda', 'vare', 'lonn', 'andre', 'total', 'kfd', 'lgd', 'oml', 'kontant', 'vekst'];

  test('outside the demo data: document rows withheld', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/nokkeltall`);
    await expect(region(page).locator('tr[data-figure]')).toHaveCount(ORDER.length);
    expect(await region(page).locator('tr[data-figure]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-figure')))).toEqual(
      ORDER,
    );
    // One State block, and every withheld cell points to it.
    const state = page.getByText(nb['keyFigures.notInDataset.state']);
    await expect(state).toHaveCount(1);
    await expect(state).toBeVisible();
    const stateId = await state.getAttribute('id');
    expect(stateId).not.toBeNull();
    for (const figure of OUTSIDE_ROWS) {
      const own = cell(page, figure, 'own');
      await expect(own, figure).toContainText(nb['analysis.figures.notInDataset']);
      await expect(own, figure).toHaveAttribute('aria-describedby', stateId ?? '');
      await expect(cell(page, figure, 'merged'), figure).not.toContainText(/\d/);
    }
    // The API rows are compared as for every company.
    for (const figure of ['driftsmargin', 'totalkapitalrentabilitet', 'egenkapitalandel']) {
      await expect(cell(page, figure, 'median'), figure).toBeVisible();
      await expect(cell(page, figure, 'own'), figure).not.toHaveAttribute('aria-describedby', /./);
    }

    // The info button: a real button named "Mer om dette", toggled by click, Enter and Space,
    // closed by Esc (focus back on the button) and by a click outside.
    const button = cell(page, 'kfd', 'own').getByRole('button', { name: nb['keyFigures.moreAbout'] });
    await expect(button).toHaveText(/ⓘ/);
    const text = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(text).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(text.locator('[data-popover-text]')).toHaveText(nb['keyFigures.notInDataset.popover']);
    await expect(text).toBeVisible();
    // Story 5.4: it links to "Kilder og lisens"'s paragraph on the documents.
    await expect(text.getByRole('link', { name: nb['keyFigures.notInDataset.popoverLink'] })).toHaveAttribute(
      'href',
      '/slik-fungerer-peerless#arsregnskap',
    );
    // It stays open while hovered, and when the pointer moves over the text.
    await text.hover();
    await expect(text).toBeVisible();
    // Moving the pointer away does not close it either.
    await page.mouse.move(5, 5);
    await expect(text).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(text).toBeHidden();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(text).toBeVisible();
    await page.keyboard.press('Space');
    await expect(text).toBeHidden();
    await button.click();
    await expect(text).toBeVisible();
    await page.getByRole('heading', { level: 2 }).click();
    await expect(text).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  for (const width of [375, 320]) {
    test(`phone: every row expands, no sideways scroll (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${A.orgnr}/nokkeltall`);
      const phone = page.locator('table[data-layout="phone"]');
      await expect(phone).toBeVisible();
      // The cost-share row group's heading spans the three columns.
      await expect(phone.locator('th[scope="rowgroup"]')).toHaveText(nb['keyFigures.costShare.group']);
      await noSidewaysScroll(page);
      const buttons = phone.locator('button[aria-controls^="kf-p-exp-"]');
      expect(await buttons.evaluateAll((all) => all.map((b) => b.getAttribute('aria-controls')))).toEqual(
        ORDER.map((figure) => `kf-p-exp-${figure}`),
      );
      for (const figure of ORDER) {
        const button = phone.locator(`button[aria-controls="kf-p-exp-${figure}"]`);
        const expansion = page.locator(`[id="kf-p-exp-${figure}"]`);
        await expect(expansion, figure).toBeHidden();
        await button.click();
        await expect(button, figure).toHaveAttribute('aria-expanded', 'true');
        await expect(expansion, figure).toBeVisible();
        await expect(expansion, figure).toContainText(nb['keyFigures.col.count']);
        await noSidewaysScroll(page);
      }
      // An open info popover on the phone still fits the screen.
      const info = phone.locator('tr:has(button[aria-controls="kf-p-exp-kfd"])').getByRole('button', { name: nb['keyFigures.moreAbout'] });
      await info.click();
      await expect(page.locator('[id="kf-p-pop-kfd"]')).toBeVisible();
      await noSidewaysScroll(page);
      const box = await phone.boundingBox();
      if (box === null) throw new Error('phone table not rendered');
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    });
  }
});

// Story 3.2: the two decomposition fold-outs (FR-26). Demo A is not on the
// manifest's list, so it is also the subject outside the demo data: the
// margin fold-out is compared (both factors are API), the pay fold-out is
// not read in v1.
test.describe('the decomposition fold-outs (Story 3.2)', () => {
  const region = (page: Page) => page.getByRole('region', { name: nb['keyFigures.regionLabel'] });
  const phone = (page: Page) => page.locator('table[data-layout="phone"]');
  const companyName = A.navn ?? '';

  /** What a factor shows for the engine's comparison. */
  async function expectFactor(factor: Locator, label: string, c: Comparison, format: (value: string) => string): Promise<void> {
    await expect(factor).toContainText(label);
    await expect(factor).toContainText(companyName);
    if (c.kind === 'subject_absent') throw new Error(`${label}: demo A has its own value`);
    await expect(factor).toContainText(format(c.subject.toString()));
    await expect(factor).toContainText(`${c.count} sammenlignbare brukt · ${c.leftOut} utelatt`);
    if (c.kind === 'compared') {
      await expect(factor).toContainText(`${nb['keyFigures.col.median']}${format(c.median.toString())}`);
      await expect(factor.getByTestId('distribution-strip')).toHaveCount(1);
    } else {
      await expect(factor).toContainText(`For få sammenlignbare (${c.count} av 10)`);
    }
    // No beste fjerdedel, Plassering or kroner in a factor.
    await expect(factor).not.toContainText(/bedre enn|kronebeløp|\d kr/);
  }

  test('margin or capital: each factor against the engine', async ({ page }) => {
    const api = expectedBenchmark(A.orgnr ?? '', 0);
    const margin = api.driftsmargin.comparison;
    const turnover = expectedTurnover(A.orgnr ?? '', 0).comparison;
    if (margin.kind !== 'compared' || turnover.kind !== 'compared') {
      throw new Error('demo A: both factors are compared at the default band');
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/nokkeltall`);
    const fold = region(page).locator('tr[data-foldout="margin"]');
    // An h3 whose name is the heading alone: the caret is aria-hidden.
    await expect(fold.getByRole('heading', { level: 3 })).toHaveAccessibleName(nb['keyFigures.foldout.margin']);
    const button = fold.getByRole('button', { name: nb['keyFigures.foldout.margin'] });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const body = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
    await expect(body).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(body).toBeVisible();
    const factors = body.locator('[data-factor]');
    await expect(factors).toHaveCount(2);
    await expectFactor(factors.nth(0), nb['fig.driftsmargin'], margin, formatPercent);
    await expectFactor(factors.nth(1), nb['fig.tkOml'], turnover, formatTurnover);
    await expect(factors.nth(1)).toContainText(nb['keyFigures.dir.none']);
    await expect(body).not.toContainText(nb['fig.oml']);
    // Neither product of the factors is shown.
    for (const product of [margin.subject.mul(turnover.subject), margin.median.mul(turnover.median)]) {
      await expect(body).not.toContainText(formatPercent(product.toString()));
      await expect(body).not.toContainText(formatTurnover(product.toString()));
    }

    // "Lønnsnivå eller produktivitet?": both factors not read in v1, with no median, count or strip.
    const pay = region(page).locator('tr[data-foldout="pay"]');
    const payButton = pay.getByRole('button', { name: nb['keyFigures.foldout.pay'] });
    await payButton.click();
    const payBody = page.locator(`[id="${await payButton.getAttribute('aria-controls')}"]`);
    const payFactors = payBody.locator('[data-factor]');
    await expect(payFactors).toHaveCount(2);
    for (const [i, label] of [nb['fig.lonnArsverk'], nb['fig.omsArsverk']].entries()) {
      await expect(payFactors.nth(i)).toContainText(label);
      await expect(payFactors.nth(i)).toContainText(nb['analysis.figures.notReadInV1']);
      await expect(payFactors.nth(i)).toContainText(nb['analysis.figures.notReadInV1.notes']);
    }
    await expect(payBody).not.toContainText(nb['keyFigures.col.median']);
    await expect(payBody).not.toContainText('sammenlignbare brukt');
    await expect(payBody.getByTestId('distribution-strip')).toHaveCount(0);
  });

  // Story 3.3: demo A is outside the demo data, so "Hva forklarer marginavviket?" reads "Ikke i demodataene".
  test('the waterfall is not in the demo data', async ({ page }) => {
    for (const [width, scope] of [
      [1280, region],
      [375, phone],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/analyse/${A.orgnr}/nokkeltall`);
      const button = scope(page).getByRole('button', { name: nb['keyFigures.foldout.waterfall'] });
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await button.click();
      const body = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
      await expect(body).toBeVisible();
      await expect(body.getByTestId('waterfall-absent')).toHaveText(nb['analysis.figures.notInDataset']);
      await expect(body.locator('svg')).toHaveCount(0);
      await expect(body).not.toContainText(/\d\skr/);
      // Story 3.8: no waterfall, so no drill-down of one, anywhere on the page.
      await expect(page.locator('[data-provenance-trigger*="-wf-prov-"]')).toHaveCount(0);
      await noSidewaysScroll(page);
    }
  });

  for (const width of [1280, 375, 320]) {
    test(`fold-outs: keyboard and phone (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/analyse/${A.orgnr}/nokkeltall`);
      const desktop = width >= 768;
      const scope = desktop ? region(page) : phone(page);
      for (const which of ['margin', 'pay'] as const) {
        const button = scope.getByRole('button', { name: nb[`keyFigures.foldout.${which}`] });
        await expect(button).toBeVisible();
        const body = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
        // Closed by default; Enter and Space each open and close it, from the keyboard.
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await expect(body).toBeHidden();
        await button.focus();
        await page.keyboard.press('Enter');
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        await expect(body).toBeVisible();
        // Side by side from md, stacked below it.
        const first = await body.locator('[data-factor]').nth(0).boundingBox();
        const second = await body.locator('[data-factor]').nth(1).boundingBox();
        if (first === null || second === null) throw new Error('factors not rendered');
        if (desktop) {
          expect(second.y).toBe(first.y);
          expect(second.x).toBeGreaterThanOrEqual(first.x + first.width);
        } else {
          expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
          // Full width: the fold-out spans the phone table, and stays on the screen.
          const table = await phone(page).boundingBox();
          const box = await body.boundingBox();
          if (table === null || box === null) throw new Error('phone table not rendered');
          expect(box.width).toBeGreaterThan(table.width * 0.9);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
        await noSidewaysScroll(page);
        // Each key both ways: Enter closes, Space opens and closes.
        await page.keyboard.press('Enter');
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await expect(body).toBeHidden();
        await page.keyboard.press('Space');
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        await expect(body).toBeVisible();
        await page.keyboard.press('Space');
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await expect(body).toBeHidden();
      }
    });
  }
});
