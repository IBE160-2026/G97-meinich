// The Verdi tab (Story 3.5; FR-30, FR-31, FR-62) against the production
// build and the loaded demo seed: the closable-share control and the three
// cards for demo A and B, the share written with one `history.replaceState`,
// the share kept by every later link, "· Endre i Verdi" wherever the top
// note is, the payload, and the phone. Every expected amount is the
// engine's, computed here from the seed (e2e/seed.ts), with the median
// step's profit as (M − r) × revenue; each fixture's state is asserted
// before it is used.
//
// Story 3.6 (FR-32, FR-55): the EV/EBIT multiple field and "Økt
// selskapsverdi": empty by default, a valid entry written to the URL with
// the same one `history.replaceState` and announced once, an invalid one
// shown as an error with `multippel` removed, the multiple kept by a share
// change and a reload, the payload unchanged with a multiple, and the
// phone. Every read after a `replaceState` change first waits for the
// change to render (PR #78).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { medianStep } from '../src/engine/closable.ts';
import { Decimal } from '../src/engine/decimal.ts';
import { formatKronerExact, formatMultiple, formatWholePercentNumber, wholeKroner } from '../src/engine/format.ts';
import { apiInputsFromRow } from '../src/engine/inputs.ts';
import { computeApiKeyFigures, resolveApiInputs } from '../src/engine/key-figures.ts';
import { expectNoPeerFields, expectWireSet } from './payload.ts';
import {
  A,
  companyShown,
  expectedBenchmark,
  expectedGroup,
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
    /** The exact profit uplift at a share, in øre. */
    exactAt: (share: number | 'median') => (share === 'median' ? atMedian : full.mul(share).div(100)),
    fullExact: full,
  };
}

/**
 * Story 3.6: EV at a share and a multiple (as the URL writes it, "6.5"), rounded once from the exact
 * uplift × m, and whether its product line is approximate: U × m ≠ V, U and V the displayed kroner.
 */
function evOracle(oracle: ReturnType<typeof profitOracle>, share: number | 'median', m: string) {
  const exact = oracle.exactAt(share);
  const value = exact.mul(m);
  const shownUplift = wholeKroner(exact.toString());
  return {
    a: formatKronerExact(exact.toString()),
    m: formatMultiple(m),
    v: formatKronerExact(value.toString()),
    approximate: !shownUplift.mul(m).eq(wholeKroner(value.toString())),
  };
}

/** Records every call the page's own code makes to window.history.replaceState (see "a share change …"). */
async function countReplaceState(page: Page): Promise<void> {
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
}

async function replaced(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __replaced: string[] }).__replaced);
}

/** Records every non-empty text the multiple field's status region takes, from now on: one per announcement. */
async function recordAnnouncements(page: Page): Promise<void> {
  await page.getByTestId('multiple-status').evaluate((region) => {
    const w = window as unknown as { __announced: string[] };
    w.__announced = [];
    new MutationObserver(() => {
      const text = region.textContent ?? '';
      if (text !== '') w.__announced.push(text);
    }).observe(region, { childList: true, subtree: true, characterData: true });
  });
}

async function announced(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __announced: string[] }).__announced);
}

const control = (page: Page) => page.getByRole('radiogroup', { name: nb['verdi.control.label'] });
const step = (page: Page, share: number | 'median') => control(page).locator(`[data-share-step="${share}"]`);
const card = (page: Page, id: string) => rendered(page).getByTestId(id);
const profitValue = (page: Page) => card(page, 'verdi-profit').locator('[data-card="amount"]');
const evSection = (page: Page) => rendered(page).getByTestId('verdi-ev');
const evField = (page: Page) => evSection(page).getByRole('textbox', { name: nb['verdi.ev.label'] });
const ev = (page: Page, part: 'value' | 'product' | 'explanation' | 'empty' | 'reason') => evSection(page).locator(`[data-ev="${part}"]`);

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

test.describe('EV/EBIT (Story 3.6)', () => {
  test('EV: empty by default', async ({ page }) => {
    const { orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    // The fixture's state: demo A's profit card has an amount, so the field is enabled.
    await expect(profitValue(page)).toHaveText(fill('verdi.profit.value', { a: DEMO_A.oracle.at(50), full: DEMO_A.oracle.full }));
    await expect(evSection(page).getByRole('heading', { level: 3 })).toHaveText(nb['verdi.ev.kicker']);
    await expect(evField(page)).toHaveValue('');
    await expect(evField(page)).not.toHaveAttribute('placeholder', /.*/);
    await expect(evField(page)).not.toHaveAttribute('aria-disabled', /.*/);
    await expect(evField(page)).toHaveAttribute('inputmode', 'decimal');
    await expect(ev(page, 'empty')).toHaveText(nb['verdi.ev.empty']);
    await expect(ev(page, 'value')).toHaveCount(0);
    await expect(ev(page, 'product')).toHaveCount(0);
    await expect(page.getByTestId('multiple-status')).toHaveText('');
  });

  test('EV: a multiple replaces the URL, announces once', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    const expected = evOracle(oracle, 50, '6.5');
    // The fixture's state: at 50 % × 6,5 demo A's shown uplift × 6,5 is not the shown value, so "≈".
    expect(expected.approximate).toBe(true);
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    await countReplaceState(page);
    await recordAnnouncements(page);
    const lengthBefore = await page.evaluate(() => window.history.length);
    await evField(page).fill('6,5');
    // Not per keystroke: nothing is written or announced before Enter.
    expect(await replaced(page)).toEqual([]);
    await evField(page).press('Enter');
    await expect.poll(() => new URL(page.url()).search).toBe('?multippel=6.5');
    // Wait for the change to render before any one-shot read (PR #78).
    await expect(ev(page, 'value')).toHaveText(expected.v);
    await expect(ev(page, 'product')).toHaveText(fill('verdi.ev.productApprox', { a: expected.a, m: expected.m, v: expected.v }));
    await expect(ev(page, 'explanation')).toHaveText(nb['verdi.ev.explanation']);
    await expect(ev(page, 'empty')).toHaveCount(0);
    await expect(evField(page)).toBeFocused();
    await expect(evField(page)).toHaveValue('6,5');
    await expect(page.getByTestId('multiple-status')).toHaveText(fill('verdi.ev.announce', { v: expected.v }));
    // Blur: an unchanged value writes and announces nothing more.
    await page.keyboard.press('Tab');
    await expect(evField(page)).not.toBeFocused();
    expect(await replaced(page)).toEqual([`/analyse/${orgnr}/verdi?multippel=6.5`]);
    expect(await announced(page)).toEqual([fill('verdi.ev.announce', { v: expected.v })]);
    expect(await page.evaluate(() => window.history.length)).toBe(lengthBefore);
    // The share's region says nothing; the cards are unchanged.
    await expect(page.getByTestId('verdi-status')).toHaveText('');
    await expect(profitValue(page)).toHaveText(fill('verdi.profit.value', { a: oracle.at(50), full: oracle.full }));
    // Each accepted form; " 6.5 " and "6.50" are the multiple already in the URL and write nothing;
    // "06" is shown as "6".
    for (const [typed, shown, written] of [
      [' 6.5 ', '6,5', '6.5'],
      ['6.50', '6,5', '6.5'],
      ['06', '6', '6'],
      ['50', '50', '50'],
      ['0,1', '0,1', '0.1'],
    ] as const) {
      await evField(page).fill(typed);
      await evField(page).press('Enter');
      await expect(evField(page), typed).toHaveValue(shown);
      await expect.poll(() => new URL(page.url()).search, typed).toBe(`?multippel=${written}`);
      await expect(ev(page, 'value'), typed).toHaveText(evOracle(oracle, 50, written).v);
    }
    expect(await replaced(page)).toEqual([
      `/analyse/${orgnr}/verdi?multippel=6.5`,
      `/analyse/${orgnr}/verdi?multippel=6`,
      `/analyse/${orgnr}/verdi?multippel=50`,
      `/analyse/${orgnr}/verdi?multippel=0.1`,
    ]);
    // One announcement per changing entry, none for " 6.5 " and "6.50" (the multiple already there).
    await expect
      .poll(() => announced(page))
      .toEqual(['6.5', '6', '50', '0.1'].map((m) => fill('verdi.ev.announce', { v: evOracle(oracle, 50, m).v })));
    // Clearing removes it and says the empty sentence.
    await evField(page).fill('');
    await evField(page).press('Enter');
    await expect.poll(() => new URL(page.url()).search).toBe('');
    await expect(ev(page, 'empty')).toHaveText(nb['verdi.ev.empty']);
    await expect(page.getByTestId('multiple-status')).toHaveText(nb['verdi.ev.empty']);
    expect((await replaced(page)).length).toBe(5);
  });

  test('EV: invalid input', async ({ page }) => {
    const { orgnr, navn } = DEMO_A;
    for (const typed of ['0', '50,1', '6,55', 'abc', '6 ,5', '-1']) {
      // From a URL holding a valid multiple, so the removal shows.
      await page.goto(`/analyse/${orgnr}/verdi?multippel=6.5`);
      await companyShown(page, navn);
      await expect(ev(page, 'value')).toHaveCount(1);
      await evField(page).fill(typed);
      await evField(page).press('Enter');
      await expect.poll(() => new URL(page.url()).search, typed).toBe('');
      const error = page.getByTestId('multiple-status').locator('p');
      await expect(error, typed).toHaveText(nb['verdi.ev.error']);
      await expect(evField(page), typed).toHaveAttribute('aria-invalid', 'true');
      await expect(evField(page), typed).toHaveAttribute('aria-describedby', (await error.getAttribute('id')) ?? 'none');
      await expect(evField(page), typed).toHaveValue(typed);
      await expect(evField(page), typed).toBeFocused();
      await expect(ev(page, 'value'), typed).toHaveCount(0);
      await expect(ev(page, 'product'), typed).toHaveCount(0);
      await expect(notice(page), typed).toHaveText('');
    }
  });

  test('EV: a share change keeps the multiple', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi?multippel=6.5`);
    await companyShown(page, navn);
    await expect(ev(page, 'value')).toHaveText(evOracle(oracle, 50, '6.5').v);
    await expect(evField(page)).toHaveValue('6,5');
    await recordAnnouncements(page);
    await step(page, 25).click();
    await expect.poll(() => new URL(page.url()).search).toBe('?andel=25&multippel=6.5');
    // Wait for the share to render, then the value rescales with it.
    await expect(step(page, 25)).toHaveAttribute('aria-checked', 'true');
    const at25 = evOracle(oracle, 25, '6.5');
    // The fixture's state: at 25 % the product line is approximate too.
    expect(at25.approximate).toBe(true);
    await expect(ev(page, 'value')).toHaveText(at25.v);
    await expect(ev(page, 'product')).toHaveText(fill('verdi.ev.productApprox', { a: at25.a, m: at25.m, v: at25.v }));
    await expect(evField(page)).toHaveValue('6,5');
    // One announcement: the share's, 3.5's approved sentence; the field's region says nothing.
    await expect(page.getByTestId('verdi-status')).toHaveText(fill('verdi.announce.profit', { a: oracle.at(25), full: oracle.full }));
    expect(await announced(page)).toEqual([]);
    // The median step: (M − r) × revenue × m.
    await step(page, 'median').click();
    await expect.poll(() => new URL(page.url()).search).toBe('?andel=median&multippel=6.5');
    await expect(step(page, 'median')).toHaveAttribute('aria-checked', 'true');
    await expect(ev(page, 'value')).toHaveText(evOracle(oracle, 'median', '6.5').v);
  });

  test('EV: a reload renders the same, with no hydration error', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    await evField(page).fill('6,5');
    await evField(page).press('Enter');
    await expect.poll(() => new URL(page.url()).search).toBe('?multippel=6.5');
    // Wait for the value to render before reading the section (PR #78).
    const expected = evOracle(oracle, 50, '6.5');
    await expect(ev(page, 'value')).toHaveText(expected.v);
    const before = await evSection(page).innerText();
    expect(before).toContain(fill('verdi.ev.productApprox', { a: expected.a, m: expected.m, v: expected.v }));
    await page.reload();
    await companyShown(page, navn);
    await expect(evField(page)).toHaveValue('6,5');
    await expect.poll(() => evSection(page).innerText()).toBe(before);
    await expect(page.getByTestId('multiple-status')).toHaveText('');
    await expect(notice(page)).toHaveText('');
    expect(errors).toEqual([]);
  });

  test('EV: band and share are kept by every multiple entry', async ({ page }) => {
    // Band 1 is another group than the oracles' band 0, so the value is checked as shown, not computed.
    const { orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi?band=1&andel=25`);
    await companyShown(page, navn);
    // The fixture's state: the URL's band and share are valid, so nothing falls back.
    await expect(notice(page)).toHaveText('');
    await expect(step(page, 25)).toHaveAttribute('aria-checked', 'true');
    await expect(ev(page, 'empty')).toHaveText(nb['verdi.ev.empty']);
    await evField(page).fill('6,5');
    await evField(page).press('Enter');
    await expect.poll(() => new URL(page.url()).search).toBe('?band=1&andel=25&multippel=6.5');
    await expect(ev(page, 'value')).toHaveCount(1);
    await expect(ev(page, 'value')).toHaveText(/kr$/);
    await evField(page).fill('');
    await evField(page).press('Enter');
    await expect.poll(() => new URL(page.url()).search).toBe('?band=1&andel=25');
    await expect(ev(page, 'empty')).toHaveText(nb['verdi.ev.empty']);
    await evField(page).fill('abc');
    await evField(page).press('Enter');
    await expect(page.getByTestId('multiple-status').locator('p')).toHaveText(nb['verdi.ev.error']);
    expect(new URL(page.url()).search).toBe('?band=1&andel=25');
  });

  test('EV: from an error to a value, and from an error to an empty field', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    await countReplaceState(page);
    await recordAnnouncements(page);
    const error = page.getByTestId('multiple-status').locator('p');
    // An invalid entry from a URL with no multiple shows the error and writes nothing.
    await evField(page).fill('abc');
    await evField(page).press('Enter');
    await expect(error).toHaveText(nb['verdi.ev.error']);
    await expect(evField(page)).toHaveAttribute('aria-invalid', 'true');
    expect(await replaced(page)).toEqual([]);
    expect(await announced(page)).toEqual([nb['verdi.ev.error']]);
    // Invalid → valid: the error and its ties go, the value shows, the URL is written, one announcement.
    const expected = evOracle(oracle, 50, '6.5');
    await evField(page).fill('6,5');
    await evField(page).press('Enter');
    await expect.poll(() => new URL(page.url()).search).toBe('?multippel=6.5');
    await expect(ev(page, 'value')).toHaveText(expected.v);
    await expect(error).toHaveCount(0);
    await expect(evField(page)).not.toHaveAttribute('aria-invalid', /.*/);
    await expect(evField(page)).not.toHaveAttribute('aria-describedby', /.*/);
    await expect(page.getByTestId('multiple-status')).toHaveText(fill('verdi.ev.announce', { v: expected.v }));
    expect(await replaced(page)).toEqual([`/analyse/${orgnr}/verdi?multippel=6.5`]);
    expect(await announced(page)).toEqual([nb['verdi.ev.error'], fill('verdi.ev.announce', { v: expected.v })]);
    // Invalid (removing the multiple) → cleared: the error goes, the empty sentence is announced once.
    await evField(page).fill('xyz');
    await evField(page).press('Enter');
    await expect(error).toHaveText(nb['verdi.ev.error']);
    await expect.poll(() => new URL(page.url()).search).toBe('');
    await evField(page).fill('');
    await evField(page).press('Enter');
    await expect(error).toHaveCount(0);
    await expect(page.getByTestId('multiple-status')).toHaveText(nb['verdi.ev.empty']);
    await expect(evField(page)).not.toHaveAttribute('aria-invalid', /.*/);
    await expect
      .poll(() => announced(page))
      .toEqual([nb['verdi.ev.error'], fill('verdi.ev.announce', { v: expected.v }), nb['verdi.ev.error'], nb['verdi.ev.empty']]);
  });

  test('EV: two different invalid entries announce twice, the same one twice announces once', async ({ page }) => {
    const { orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    await recordAnnouncements(page);
    await evField(page).fill('abc');
    await evField(page).press('Enter');
    await expect.poll(() => announced(page)).toEqual([nb['verdi.ev.error']]);
    await evField(page).fill('6,55');
    await evField(page).press('Enter');
    await expect.poll(() => announced(page)).toEqual([nb['verdi.ev.error'], nb['verdi.ev.error']]);
    // The same invalid text again, by Enter and by blur: nothing changes, so there is nothing to wait for;
    // the wait covers the field's 50 ms announcement delay.
    await evField(page).press('Enter');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    expect(await announced(page)).toEqual([nb['verdi.ev.error'], nb['verdi.ev.error']]);
  });

  test('EV: Enter and an immediate blur are one entry', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, navn);
    await countReplaceState(page);
    await recordAnnouncements(page);
    await evField(page).fill('6,5');
    // Enter and the blur in one task, before Next.js renders the new URL into the field's props.
    await evField(page).evaluate((input) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      (input as HTMLInputElement).blur();
    });
    const expected = evOracle(oracle, 50, '6.5');
    await expect(ev(page, 'value')).toHaveText(expected.v);
    await expect.poll(() => announced(page)).toEqual([fill('verdi.ev.announce', { v: expected.v })]);
    expect(await replaced(page)).toEqual([`/analyse/${orgnr}/verdi?multippel=6.5`]);
  });

  test('EV: a multiple of 1 writes the "=" line', async ({ page }) => {
    const { oracle, orgnr, navn } = DEMO_A;
    const expected = evOracle(oracle, 50, '1');
    // The fixture's state: × 1 the shown uplift is the shown value, so the line is exact.
    expect(expected.approximate).toBe(false);
    await page.goto(`/analyse/${orgnr}/verdi?multippel=1`);
    await companyShown(page, navn);
    await expect(ev(page, 'value')).toHaveText(expected.v);
    await expect(ev(page, 'product')).toHaveText(fill('verdi.ev.product', { a: expected.a, m: expected.m, v: expected.v }));
  });

  test('EV: a peer change keeps the multiple, and Verdi shows it after', async ({ page }) => {
    const { orgnr, navn } = DEMO_A;
    const peer = expectedGroup(orgnr, 0)[0]?.orgnr ?? '';
    // The fixture's state: demo A has a peer to exclude.
    expect(peer).toMatch(/^\d{9}$/);
    await page.goto(`/analyse/${orgnr}/peers?multippel=6.5`);
    await companyShown(page, navn);
    await page.locator(`[data-peer-action="${peer}"]:visible`).click();
    await expect.poll(() => new URL(page.url()).search).toBe(`?ekskl=${peer}&multippel=6.5`);
    await tabs(page).getByRole('link', { name: nb['tabs.verdi'] }).click();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(`/analyse/${orgnr}/verdi?ekskl=${peer}&multippel=6.5`);
    await expect(page.getByRole('heading', { level: 2, name: nb['tabs.verdi'] })).toBeFocused();
    await expect(evField(page)).toHaveValue('6,5');
    await expect(ev(page, 'value')).toHaveText(/kr$/);
    await expect(ev(page, 'product')).toHaveCount(1);
    await expect(notice(page)).toHaveText('');
  });

  test('EV: the payload with a multiple carries exactly the wire set', async ({ request }) => {
    const { orgnr } = DEMO_A;
    // The multiple adds no wire value: the browser computes EV from the profit's own.
    await expectWireSet(request, `/analyse/${orgnr}/verdi?multippel=6.5`, orgnr, wireSetOf(DEMO_A.oracle));
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
    // Story 3.6: the multiple field is 90 px and a target of at least 24 × 24; its value, product line and
    // error fit without sideways scroll.
    const field = evField(page);
    const fieldBox = await field.boundingBox();
    expect(fieldBox?.width).toBe(90);
    expect(fieldBox?.height ?? 0).toBeGreaterThanOrEqual(24);
    await field.fill('6,5');
    await field.press('Enter');
    await expect(ev(page, 'value')).toHaveText(evOracle(DEMO_A.oracle, 50, '6.5').v);
    await expect(ev(page, 'product')).toBeVisible();
    await noSidewaysScroll(page);
    await field.fill('abc');
    await field.press('Enter');
    await expect(page.getByTestId('multiple-status').locator('p')).toHaveText(nb['verdi.ev.error']);
    await noSidewaysScroll(page);
  });
}

// Demo A is the subject the tests above name.
test('demo A is the seed’s first demo company', () => {
  expect(A.orgnr).toBe(DEMO_A.orgnr);
});
