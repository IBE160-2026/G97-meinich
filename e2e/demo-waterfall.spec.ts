// Story 5.4 (Epic 3 retro W5/E4): a real demo company shows the margin
// waterfall from the committed seed, not only the synthetic fixture of
// e2e/synthetic-documents.spec.ts. Demo A and B are on the committed
// manifest's list of orgnrs with document figures, their Oversikt shows no
// "Ikke i demodataene", and on Nøkkeltall "Hva forklarer marginavviket?" is
// a decomposition over a common peer set P of at least 10 at bands 0, 1 and
// 2, in which every row of "Vis tallene" has its "Hvordan er dette regnet?"
// drill-down (the phone at band 0). P is read from the drill-down's own
// sentence, never chosen here. Review: demo B's Verdi profit card has an
// amount, and demo A's capital drill-downs state the peers' read dates
// (FR-64).
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { documentKeyFigureFractions } from '../src/engine/document-key-figures.ts';
import { formatReadDate } from '../src/engine/format.ts';
import { peerDocumentBases, seedDocumentReadAt } from './seed-documents.ts';
import { companyShown, documentFigureOrgnrs, expectedBenchmark, noSidewaysScroll, rendered } from './seed.ts';

const COLUMNS = ['start', 'vare', 'lonn', 'andre', 'residual', 'sum', 'end'] as const;

const waterfallButton = (page: Page, layout: 'd' | 'p') =>
  (layout === 'd'
    ? page.getByRole('region', { name: nb['keyFigures.regionLabel'] })
    : page.locator('table[data-layout="phone"]')
  ).getByRole('button', { name: nb['keyFigures.foldout.waterfall'] });

/** Opens the waterfall fold-out and its "Vis tallene" in one layout, and waits for the table. */
async function openNumbers(page: Page, layout: 'd' | 'p'): Promise<Locator> {
  const button = waterfallButton(page, layout);
  await button.click();
  await expect(button).toHaveAttribute('aria-controls', `kf-${layout}-fold-waterfall`);
  const body = page.locator(`[id="kf-${layout}-fold-waterfall"]`);
  await expect(body).toBeVisible();
  // A decomposition, not an absence.
  await expect(body.getByTestId('waterfall-absent')).toHaveCount(0);
  await expect(body.getByTestId('waterfall-tag')).toBeVisible();
  await body.getByRole('button', { name: nb['chart.showNumbers'] }).click();
  await expect(body.getByRole('table', { name: nb['waterfall.table.caption'] })).toBeVisible();
  return body;
}

/** P's size as the bar drill-down's pooled sentence states it. */
function pooledCount(text: string): number {
  const [before] = nb['waterfall.prov.pooled'].split('{n}');
  const at = text.indexOf(before ?? '');
  if (before === undefined || at === -1) throw new Error('no pooled sentence in the drill-down');
  // A count of 1 000 or more is written in groups of three with a non-breaking space.
  const n = /^(\d{1,3}(?:[\u00a0 ]\d{3})*)/.exec(text.slice(at + before.length))?.[1];
  if (n === undefined) throw new Error('no count in the pooled sentence');
  return Number(n.replace(/[\u00a0 ]/g, ''));
}

/** On Nøkkeltall at `band`: the waterfall is a decomposition over P ≥ 10, and every row of "Vis tallene" has its drill-down. */
async function expectWaterfall(page: Page, subject: { readonly orgnr: string; readonly navn: string }, band: 0 | 1 | 2, layout: 'd' | 'p') {
  const label = `${subject.navn} band ${band} ${layout}`;
  await page.goto(`/analyse/${subject.orgnr}/nokkeltall${band === 0 ? '' : `?band=${band}`}`);
  await companyShown(page, subject.navn);
  const body = await openNumbers(page, layout);
  // Every row of "Vis tallene" is a column with its own drill-down.
  const rows = body.locator('tr[data-wf-table-row]');
  await expect.poll(() => rows.evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-wf-table-row'))), label).toEqual([...COLUMNS]);
  for (const key of COLUMNS) {
    const trigger = body.locator(`tr[data-wf-table-row="${key}"] [data-provenance-trigger="kf-${layout}-wf-prov-${key}"]`);
    await expect(trigger, `${label} ${key}`).toBeVisible();
    await trigger.click();
    const drill = body.locator(`[data-provenance-body="kf-${layout}-wf-prov-${key}"]`);
    await expect(drill, `${label} ${key}`).toBeVisible();
    await expect(drill.locator('[data-provenance-quality]'), `${label} ${key}`).toHaveCount(1);
  }
  // P has at least 10 members: the minimum for a decomposition (MIN_PEERS).
  const vare = body.locator(`[data-provenance-body="kf-${layout}-wf-prov-vare"]`);
  await expect.poll(async () => pooledCount(await vare.innerText()), label).toBeGreaterThanOrEqual(10);
  // Samlet's read dates: the filing year and the range of P's dates, never one peer's.
  await expect(vare.locator('[data-provenance-pooled] p', { hasText: 'Peer-gruppen samlet: Regnskapsår' }), label).toHaveCount(1);
  await noSidewaysScroll(page);
}

for (const demo of DEMO_COMPANIES) {
  test(`${demo.navn} shows the margin waterfall from the committed seed at every band`, async ({ page }) => {
    // The fixture's state: the demo company has document figures in the committed seed.
    expect(documentFigureOrgnrs.has(demo.orgnr)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${demo.orgnr}/oversikt`);
    await companyShown(page, demo.navn);
    await expect(rendered(page)).not.toContainText(nb['analysis.figures.notInDataset']);
    for (const band of [0, 1, 2] as const) await expectWaterfall(page, demo, band, 'd');
    await page.setViewportSize({ width: 375, height: 900 });
    await expectWaterfall(page, demo, 0, 'p');
  });
}

test('demo B’s Verdi profit card shows an amount', async ({ page }) => {
  const [, demoB] = DEMO_COMPANIES;
  // The fixture's state: demo B's driftsmargin lies below beste fjerdedel at the default band.
  expect(expectedBenchmark(demoB.orgnr, 0).driftsmargin.gap.kind).toBe('amount');
  await page.goto(`/analyse/${demoB.orgnr}/verdi`);
  await companyShown(page, demoB.navn);
  await expect(rendered(page).getByTestId('verdi-profit').locator('[data-card="amount"]')).toHaveText(/\d\skr/);
});

// FR-64: the drill-downs of (9) and (10) state the compared peers' filing year and the range of
// their documents' read dates. The oracle reads document.csv for the group members whose current
// column gives the figure, independently of the app's date code.
test('demo A: the capital drill-downs state the peers’ filing year and read-date range', async ({ page }) => {
  const [demoA] = DEMO_COMPANIES;
  const { year, peers } = peerDocumentBases(demoA.orgnr, 0);
  expect(year).toBe(2025);
  const expectedLine = (key: 'kfd' | 'lgd'): string => {
    const dates = peers
      .filter((peer) => documentKeyFigureFractions(peer.basis)[key].kind === 'value')
      .map((peer) => seedDocumentReadAt(peer.orgnr, year));
    if (dates.length < 10 || dates.some((date) => date === null)) throw new Error(`${key}: ten compared peers, each with a read date`);
    const times = (dates as Date[]).map((date) => date.getTime());
    const fra = formatReadDate(new Date(Math.min(...times)));
    const til = formatReadDate(new Date(Math.max(...times)));
    return fra === til
      ? `Peer-gruppen: Regnskapsår ${year} · årsregnskapene hentet ${fra}`
      : `Peer-gruppen: Regnskapsår ${year} · årsregnskapene hentet ${fra}–${til}`;
  };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/analyse/${demoA.orgnr}/nokkeltall`);
  await companyShown(page, demoA.navn);
  for (const key of ['kfd', 'lgd'] as const) {
    await rendered(page).locator(`[data-provenance-trigger="kf-d-prov-${key}"]`).click();
    const drill = rendered(page).locator(`[data-provenance-body="kf-d-prov-${key}"]`);
    await expect(drill, key).toBeVisible();
    await expect(drill.locator('p', { hasText: 'Peer-gruppen: Regnskapsår' }), key).toHaveText(expectedLine(key));
  }
});
