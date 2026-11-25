// Story 5.4 (Epic 3 retro W5/E4): a real demo company shows the margin
// waterfall from the committed seed, not only the synthetic fixture of
// e2e/synthetic-documents.spec.ts. Demo A is on the committed manifest's
// list of orgnrs with document figures, its Oversikt shows no "Ikke i
// demodataene", and on Nøkkeltall "Hva forklarer marginavviket?" is a
// decomposition over a common peer set P of at least 10, in which every row
// of "Vis tallene" has its "Hvordan er dette regnet?" drill-down, on the
// desktop and on the phone. P is read from the drill-down's own sentence,
// never chosen here.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { A, companyShown, documentFigureOrgnrs, noSidewaysScroll, rendered } from './seed.ts';

const orgnr = A.orgnr ?? '';
const navn = A.navn ?? '';
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
  const body = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
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

test('demo A shows the margin waterfall from the committed seed', async ({ page }) => {
  // The fixture's state: demo A has document figures in the committed seed.
  expect(documentFigureOrgnrs.has(orgnr)).toBe(true);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/analyse/${orgnr}/oversikt`);
  await companyShown(page, navn);
  await expect(rendered(page)).not.toContainText(nb['analysis.figures.notInDataset']);

  for (const [width, layout] of [
    [1280, 'd'],
    [375, 'p'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/analyse/${orgnr}/nokkeltall`);
    await companyShown(page, navn);
    const body = await openNumbers(page, layout);
    // Every row of "Vis tallene" is a column with its own drill-down.
    const rows = body.locator('tr[data-wf-table-row]');
    expect(await rows.evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-wf-table-row')))).toEqual([...COLUMNS]);
    for (const key of COLUMNS) {
      const trigger = body.locator(`tr[data-wf-table-row="${key}"] [data-provenance-trigger="kf-${layout}-wf-prov-${key}"]`);
      await expect(trigger, key).toBeVisible();
      await trigger.click();
      const drill = body.locator(`[data-provenance-body="kf-${layout}-wf-prov-${key}"]`);
      await expect(drill, key).toBeVisible();
      await expect(drill.locator('[data-provenance-quality]'), key).toHaveCount(1);
    }
    // P has at least 10 members: the minimum for a decomposition (MIN_PEERS).
    const vare = body.locator(`[data-provenance-body="kf-${layout}-wf-prov-vare"]`);
    expect(pooledCount(await vare.innerText())).toBeGreaterThanOrEqual(10);
    // Samlet's read dates: the filing year and the range of P's dates, never one peer's.
    await expect(vare.locator('[data-provenance-pooled] p', { hasText: 'Peer-gruppen samlet: Regnskapsår' })).toHaveCount(1);
    await noSidewaysScroll(page);
  }
});
