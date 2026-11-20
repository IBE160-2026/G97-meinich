// "Hvordan er dette regnet?" (Story 3.7; FR-57, FR-60, FR-64) against the
// production build and the loaded demo seed: demo A's drill-downs, whose
// values are the engine's, computed here from the seed (e2e/seed.ts); the
// quartile, recomputed from what "Vis fordelingen" shows; the focus moves;
// a company outside the demo data claiming no reconciliation; and every
// surface at 375 and 320 px. Every read after opening a drill-down or "Vis
// fordelingen" first waits for it to be visible.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { Decimal } from '../src/engine/decimal.ts';
import { formatKroner, formatKronerExact, formatPercent, shownPercent, wholeKroner } from '../src/engine/format.ts';
import { apiInputsFromRow } from '../src/engine/inputs.ts';
import { resolveApiInputs } from '../src/engine/key-figures.ts';
import { shareLineIsApproximate } from '../src/engine/closable.ts';
import { lineIsApproximate, REGISTER_FIELD_NAMES } from '../src/engine/provenance.ts';
import { percentileInc } from '../src/engine/statistics.ts';
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { A, companyShown, dataDate, expectedBenchmark, headerSearch, keyFigureRow, newestFiling, noSidewaysScroll, rendered, root } from './seed.ts';

const fill = (id: keyof typeof nb, vars: Record<string, string>) =>
  Object.entries(vars).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), nb[id]);
const NBSP = String.fromCharCode(0xa0);
const plain = (text: string) => text.replaceAll(NBSP, ' ');

const orgnr = A.orgnr ?? '';

/** Demo A's driftsmargin and its profit, as the engine gives them at the default URL. */
function oracle() {
  const benchmark = expectedBenchmark(orgnr, 0);
  const figure = benchmark.driftsmargin;
  const c = figure.comparison;
  if (c.kind !== 'compared' || c.best === null || figure.gap.kind !== 'amount') throw new Error('demo A has a profit amount');
  const row = keyFigureRow(newestFiling(orgnr).brreg_id ?? '');
  const revenue = resolveApiInputs(apiInputsFromRow(row)).sumDriftsinntekter;
  if (revenue === null) throw new Error('demo A has a revenue');
  return {
    c,
    best: c.best,
    gapOre: figure.gap.ore,
    revenueOre: revenue.ore,
    amount: formatKronerExact(figure.gap.ore.toString()),
    atMedian: formatKronerExact(c.median.minus(c.subject).mul(new Decimal(revenue.ore.toString())).toString()),
    driftsresultat: row.driftsresultat_ore,
    sumDriftsinntekter: row.sum_driftsinntekter_ore,
  };
}

const trigger = (scope: Locator | Page, id: string) => scope.locator(`[data-provenance-trigger="${id}"]`);
const body = (scope: Locator | Page, id: string) => scope.locator(`[data-provenance-body="${id}"]`);

/** Opens a drill-down by its trigger and waits for its body. */
async function open(page: Page, id: string): Promise<Locator> {
  await trigger(rendered(page), id).click();
  const drill = body(rendered(page), id);
  await expect(drill).toBeVisible();
  return drill;
}

const chips = async (drill: Locator) => (await drill.locator('[data-provenance-chip]').allInnerTexts()).map(plain);

test.describe('the drill-down (Story 3.7)', () => {
  test('values equal the engine: demo A’s driftsmargin cell, at the default URL', async ({ page }) => {
    const o = oracle();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${orgnr}/nokkeltall`);
    await companyShown(page, A.navn ?? '');
    const drill = await open(page, 'kf-d-prov-driftsmargin');
    // Focus on the heading (decision 9).
    await expect(drill.getByRole('heading', { name: nb['provenance.trigger'] })).toBeFocused();
    // The four steps.
    for (const step of ['formula', 'figure', 'filed', 'source'] as const) await expect(drill).toContainText(nb[`provenance.step.${step}`]);
    const lines = await chips(drill);
    expect(lines[0]).toBe('(T − r) × sumDriftsinntekter');
    // The fixture's state, by the displayed-operand rule: demo A's own margin is positive (no
    // parentheses), and (T − r) × revenue from the displayed T, r and revenue is not the displayed
    // amount, so the line reads "≈".
    const T = formatPercent(o.best.quartile.toString());
    const r = formatPercent(o.c.subject.toString());
    expect(o.c.subject.isPositive()).toBe(true);
    const shown = shownPercent(o.best.quartile.toString()).minus(shownPercent(o.c.subject.toString())).mul(wholeKroner(o.revenueOre.toString()));
    expect(lineIsApproximate(shown, wholeKroner(o.gapOre.toString()))).toBe(true);
    expect(lines[1]).toBe(plain(`(${T} − ${r}) × ${formatKroner(o.revenueOre.toString())} ≈ ${o.amount} ${nb['keyFigures.perYear']}`));
    expect(lines).toContain(`T = ${plain(formatPercent(o.best.quartile.toString()))}`);
    expect(lines).toContain(`M = ${plain(formatPercent(o.c.median.toString()))}`);
    expect(lines.some((line) => line.startsWith('r = driftsresultat / sumDriftsinntekter') && line.endsWith(plain(formatPercent(o.c.subject.toString()))))).toBe(true);
    await expect(drill).toContainText(
      fill('provenance.best', { T: formatPercent(o.best.quartile.toString()), kvartil: nb['provenance.quartile.upper'], n: String(o.c.count) }),
    );
    // The filed values, their data date, the source and the data-quality line: demo A is outside the demo data.
    const text = plain(await drill.innerText());
    expect(text).toContain(plain(`driftsresultat ${formatKroner(o.driftsresultat ?? '')}`));
    expect(text).toContain(plain(`sumDriftsinntekter ${formatKroner(o.sumDriftsinntekter ?? '')}`));
    // "Registerets nøkkeltall: " and the header's data date (the same filing year and read date).
    expect(nb['provenance.date.api'].endsWith(nb['analysis.dataDate'])).toBe(true);
    expect(text).toContain(plain(nb['provenance.date.api'].replace(nb['analysis.dataDate'], dataDate(orgnr))));
    expect(text).toContain(plain(nb['provenance.source.api']));
    await expect(drill.locator('[data-provenance-quality]')).toHaveText(nb['provenance.quality.notInDataset']);
  });

  test('values equal the engine: Verdi at andel=median&multippel=6.5', async ({ page }) => {
    const o = oracle();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${orgnr}/verdi?andel=median&multippel=6.5`);
    await companyShown(page, A.navn ?? '');
    const profit = await open(page, 'verdi-prov-profit');
    const lines = await chips(profit);
    // The median step's profit is (M − r) × sumDriftsinntekter, and its amount the card's.
    expect(lines).toContain('(M − r) × sumDriftsinntekter');
    expect(lines.some((line) => line.endsWith(`${plain(o.atMedian)} ${nb['keyFigures.perYear']}`))).toBe(true);
    await expect(rendered(page).getByTestId('verdi-profit').locator('[data-card="amount"]')).toHaveText(
      fill('verdi.profit.value', { a: o.atMedian, full: o.amount }),
    );
    // No share line on the profit at the median step: its formula replaces it.
    // (A share line is "{full} kr × {andel} % = {a}".)
    expect(lines.filter((line) => / kr × [\d ]+ %/.test(line))).toEqual([]);
    // EV: the same steps, with the product line the card shows.
    const ev = await open(page, 'verdi-prov-ev');
    const product = plain(await rendered(page).getByTestId('verdi-ev').locator('[data-ev="product"]').innerText());
    expect(await chips(ev)).toContain(product);
  });

  // Review: the share line the browser writes into Verdi's drill-down, at 50 % and after a share change.
  test('Verdi: the profit drill-down’s share line is its own card’s, and follows the share', async ({ page }) => {
    const o = oracle();
    const line = (percent: number) => {
      const factor = new Decimal(percent).div(100);
      const amount = o.gapOre.mul(factor);
      return {
        // The fixture's state for the sign: "=" where the shown full × the share is the shown amount.
        approximate: shareLineIsApproximate(o.gapOre, factor, amount),
        text: (sign: '=' | '≈') =>
          plain(`${formatKronerExact(o.gapOre.toString())} × ${percent} % ${sign} ${formatKronerExact(amount.toString())}`),
      };
    };
    // Demo A: 3 128 453 kr exact to the øre is odd in whole kroner, so 50 % is "≈" and 25 % too.
    const at50 = line(50);
    const at25 = line(25);
    expect(at50.approximate).toBe(true);
    expect(at25.approximate).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${orgnr}/verdi`);
    await companyShown(page, A.navn ?? '');
    const drill = await open(page, 'verdi-prov-profit');
    expect(await chips(drill)).toContain(at50.text('≈'));
    await rendered(page).locator('[data-share-step="25"]').click();
    // Wait for the share to render before reading the drill-down (PR #78).
    await expect(rendered(page).locator('[data-share-step="25"]')).toHaveAttribute('aria-checked', 'true');
    await expect(drill.locator('[data-provenance-chip]', { hasText: ' × 25' })).toHaveCount(1);
    const lines = await chips(drill);
    expect(lines).toContain(at25.text('≈'));
    expect(lines).not.toContain(at50.text('≈'));
  });

  test('outside the demo data: no reconciliation claim', async ({ page }) => {
    // The fixture's state: demo A is not on the committed manifest's list of orgnrs with document figures.
    const manifest = JSON.parse(readFileSync(path.join(root, 'seed/demo/manifest.json'), 'utf8')) as {
      readonly document_figure_orgnrs: readonly string[];
    };
    expect(manifest.document_figure_orgnrs.length).toBeGreaterThan(0);
    expect(manifest.document_figure_orgnrs).not.toContain(orgnr);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${orgnr}/nokkeltall`);
    await companyShown(page, A.navn ?? '');
    // One trigger in the desktop table: driftsmargin's; no capital cell has an amount.
    await expect(rendered(page).locator('table[data-layout="desktop"] [data-provenance-trigger]')).toHaveCount(1);
    for (const key of ['kfd', 'lgd', 'oml']) await expect(trigger(rendered(page), `kf-d-prov-${key}`)).toHaveCount(0);
    const drill = await open(page, 'kf-d-prov-driftsmargin');
    await expect(drill.locator('[data-provenance-quality]')).toHaveText(nb['provenance.quality.notInDataset']);
    await expect(drill).not.toContainText(nb['provenance.quality.reconciled']);
    // Oversikt: the hero has its drill-down, the capital card none.
    await page.goto(`/analyse/${orgnr}/oversikt`);
    await companyShown(page, A.navn ?? '');
    await expect(trigger(rendered(page), 'hero-prov')).toBeVisible();
    await expect(trigger(rendered(page), 'card-capital-prov')).toHaveCount(0);
  });

  test('"Vis fordelingen": n sorted values, no name, T marked, and T recomputes from them', async ({ page }) => {
    const o = oracle();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${orgnr}/nokkeltall`);
    await companyShown(page, A.navn ?? '');
    const drill = await open(page, 'kf-d-prov-driftsmargin');
    await drill.getByRole('button', { name: nb['provenance.showDistribution'] }).click();
    const list = drill.locator('[data-provenance-distribution] ol');
    await expect(list).toBeVisible();
    await expect(drill).toContainText(fill('provenance.distribution.caption', { n: String(o.c.count) }));
    const texts = await list.locator('li').allInnerTexts();
    expect(texts).toHaveLength(o.c.count);
    // Values only: a percent each, never a name or an orgnr.
    for (const value of texts) expect(plain(value)).toMatch(/^−?\d+,\d %$/);
    const values = texts.map((value) => new Decimal(plain(value).replace(' %', '').replace(',', '.').replace('−', '-')).div(100));
    for (let i = 1; i < values.length; i += 1) expect((values[i] as Decimal).gte(values[i - 1] as Decimal)).toBe(true);
    // PERCENTILE.INC at 0,75 on the shown values, written as the page writes T.
    expect(formatPercent(percentileInc(values, '0.75').toString())).toBe(formatPercent(o.best.quartile.toString()));
    // The fixture's state: h = (n − 1) × 0,75 has the fraction f = 0,25 for demo A's n, so T lies
    // between two values and both are marked.
    expect(new Decimal(o.c.count - 1).mul('0.75').mod(1).toString()).toBe('0.25');
    await expect(list.locator('li[data-marked]')).toHaveCount(2);
  });

  test('focus: opening moves it to the heading; Lukk and Esc return it to the trigger', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${orgnr}/oversikt`);
    await companyShown(page, A.navn ?? '');
    const button = trigger(rendered(page), 'hero-prov');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAttribute('aria-controls', 'hero-prov-body');
    const drill = await open(page, 'hero-prov');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(drill.getByRole('heading', { name: nb['provenance.trigger'] })).toBeFocused();
    await drill.getByRole('button', { name: nb['provenance.close'] }).click();
    await expect(drill).toBeHidden();
    await expect(button).toBeFocused();
    // Esc with focus inside.
    await button.click();
    await expect(drill).toBeVisible();
    await expect(drill.getByRole('heading', { name: nb['provenance.trigger'] })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drill).toBeHidden();
    await expect(button).toBeFocused();
  });

  // Review: the open state is kept by id outside React, so it must be forgotten when the drill-down
  // unmounts; otherwise the next company's hero drill-down, with the same id, opens unasked.
  test('a drill-down open on one company is closed on the next, after a client navigation', async ({ page }) => {
    const [, demoB] = DEMO_COMPANIES;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${orgnr}/oversikt`);
    await companyShown(page, A.navn ?? '');
    await open(page, 'hero-prov');
    await headerSearch(page).fill(demoB.navn);
    await page.getByRole('option', { name: demoB.navn }).first().click();
    await companyShown(page, demoB.navn);
    // The fixture's state: demo B's hero has a drill-down too.
    const button = trigger(rendered(page), 'hero-prov');
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(body(rendered(page), 'hero-prov')).toBeHidden();
  });

  // DESIGN.md: a register field name may break anywhere, so the longest one never widens the page.
  // Demo A's own names are short, so the longest register name is put into a chip of the most
  // deeply indented drill-down, Verdi's EV, at 320 px, as a field name is written.
  test('phone: the longest register field name wraps inside its chip at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/analyse/${orgnr}/verdi?multippel=6.5`);
    await companyShown(page, A.navn ?? '');
    const drill = await open(page, 'verdi-prov-ev');
    const longest = Object.values(REGISTER_FIELD_NAMES).reduce((a, b) => (b.length > a.length ? b : a));
    expect(longest).toBe('ordinaertResultatFoerSkattekostnad');
    const chip = drill.locator('[data-provenance-chip]').first();
    await chip.evaluate((element, name) => {
      const code = document.createElement('code');
      code.setAttribute('data-provenance-field', '');
      code.textContent = name;
      element.append(code);
    }, longest);
    await expect(chip.locator('code', { hasText: longest })).toBeVisible();
    await noSidewaysScroll(page);
    const box = await chip.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  });

  for (const width of [375, 320]) {
    test(`phone: every surface open at ${width} px, no sideways scroll, targets at least 24 × 24`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const targets: Locator[] = [];
      // Nøkkeltall: the driftsmargin row's expansion, its drill-down and its distribution.
      await page.goto(`/analyse/${orgnr}/nokkeltall`);
      await companyShown(page, A.navn ?? '');
      const phone = rendered(page).locator('table[data-layout="phone"]');
      await phone.locator('th button').first().click();
      const table = await open(page, 'kf-p-prov-driftsmargin');
      await table.getByRole('button', { name: nb['provenance.showDistribution'] }).click();
      await expect(table.locator('[data-provenance-distribution] ol')).toBeVisible();
      await noSidewaysScroll(page);
      targets.push(trigger(rendered(page), 'kf-p-prov-driftsmargin'), table.getByRole('button', { name: nb['provenance.close'] }));
      for (const target of targets.splice(0)) {
        const box = await target.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
      }
      // Oversikt's hero, and Verdi's profit card and EV.
      const surfaces: readonly (readonly [string, readonly string[]])[] = [
        [`/analyse/${orgnr}/oversikt`, ['hero-prov']],
        [`/analyse/${orgnr}/verdi?multippel=6.5`, ['verdi-prov-profit', 'verdi-prov-ev']],
      ];
      for (const [url, ids] of surfaces) {
        await page.goto(url);
        await companyShown(page, A.navn ?? '');
        for (const id of ids) {
          const drill = await open(page, id);
          await drill.getByRole('button', { name: nb['provenance.showDistribution'] }).click();
          await expect(drill.locator('[data-provenance-distribution] ol')).toBeVisible();
          // Several open at once: each stays open while the next opens.
          for (const shown of ids.slice(0, ids.indexOf(id))) await expect(body(rendered(page), shown)).toBeVisible();
          for (const target of [trigger(rendered(page), id), drill.getByRole('button', { name: nb['provenance.close'] }), drill.getByRole('button', { name: nb['provenance.showDistribution'] })]) {
            const box = await target.boundingBox();
            expect(box?.width ?? 0, id).toBeGreaterThanOrEqual(24);
            expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(24);
          }
        }
        await noSidewaysScroll(page);
      }
    });
  }
});
