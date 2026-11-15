// A subject whose document rows are all compared (Story 3.1b, decision 4;
// FR-21, FR-22, FR-24, FR-29), against the production build: the synthetic
// subject and its ten synthetic peers of e2e/synthetic.ts, each with a
// reconciled 2025 document, committed for this spec only and removed before
// and after it. It runs in the `synthetic` project, after every other spec
// (playwright.config.ts), so no other spec sees them.
//
// Every document row is checked against the engine run on the fixture's own
// figures here (an oracle independent of the page's view builder), one
// exclusion takes every document row below the floor, and the page carries
// no document field and no document line in øre.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { noSidewaysScroll, rendered } from './seed.ts';
import { expectNoDocumentFields } from './payload.ts';
import {
  SYNTHETIC_DOCUMENTS,
  insertSyntheticDocuments,
  removeSyntheticDocuments,
  syntheticDocumentCompanies,
  type SyntheticDocumentCompany,
} from './synthetic.ts';
import { benchmarkDocumentFigures } from '../src/engine/benchmark.ts';
import {
  DOCUMENT_FIGURE_COLUMNS,
  documentBasis,
  type DocumentBasis,
  type DocumentColumnRow,
  type DocumentField,
} from '../src/engine/document-inputs.ts';
import { formatDays, formatKronerExact, formatPercent, formatTurnover, formatWholePercent } from '../src/engine/format.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };

const { subject, peers, filingYear } = SYNTHETIC_DOCUMENTS;
const base = `/analyse/${subject.orgnr}`;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await insertSyntheticDocuments();
});

test.afterAll(async () => {
  await removeSyntheticDocuments();
});

/** A column as the read returns it: every figure column, null where the fixture leaves it empty. */
function column(lines: SyntheticDocumentCompany['current']): DocumentColumnRow {
  const fields = Object.keys(DOCUMENT_FIGURE_COLUMNS) as DocumentField[];
  return {
    status: 'reconciled',
    ...Object.fromEntries(fields.map((field) => [DOCUMENT_FIGURE_COLUMNS[field], lines[field] ?? null])),
  } as DocumentColumnRow;
}

/** The fixture company's document basis, as the server decides it from the committed rows. */
function basisOf(company: SyntheticDocumentCompany): DocumentBasis {
  return documentBasis({
    inManifest: true,
    filingYear,
    document: { status: 'reconciled', current: column(company.current), prior: column(company.prior), priorApiFailFields: [] },
    sumOmloepsmidler: BigInt(company.keyFigures.sum_omloepsmidler_ore),
  });
}

const expected = benchmarkDocumentFigures(basisOf(subject), peers.map(basisOf), 'NOK');

/** The document rows with a comparison, each with how its values are written. 7 and 8 are not read in v1. */
const ROWS = [
  ['ebitda', formatPercent],
  ['vare', formatPercent],
  ['lonn', formatPercent],
  ['andre', formatPercent],
  ['total', formatPercent],
  ['kfd', formatDays],
  ['lgd', formatDays],
  ['oml', formatTurnover],
  ['kontant', formatPercent],
  ['vekst', formatPercent],
] as const;

const region = (page: Page) => page.getByRole('region', { name: nb['keyFigures.regionLabel'] });
const desktopRow = (page: Page, figure: string) => region(page).locator(`tr[data-figure="${figure}"]`);
const cell = (page: Page, figure: string, name: string) => desktopRow(page, figure).locator(`td[data-cell="${name}"]`);

/** The group's size, from the header: the synthetic peers and the seed's companies in the band. */
async function groupSize(page: Page): Promise<number> {
  const count = page.getByTestId('header-peer-count');
  await expect(count).toHaveText(/^\d+ sammenlignbare$/);
  return Number((await count.innerText()).split(' ')[0]);
}

test('every document row is compared against the engine', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/nokkeltall`);
  await expect(rendered(page)).toBeVisible();
  // The seed's companies in the band have no document figures: left out of every document row.
  const leftOut = (await groupSize(page)) - peers.length;
  expect(leftOut).toBeGreaterThanOrEqual(0);
  await expect(page.getByText(nb['keyFigures.notInDataset.state'])).toHaveCount(0);
  for (const [key, format] of ROWS) {
    const figure = expected[key];
    const c = figure.comparison;
    if (c.kind !== 'compared') throw new Error(`the fixture's ${key} is not compared`);
    expect(c.count, key).toBe(peers.length);
    await expect(cell(page, key, 'own'), key).toHaveText(format(c.subject.toString()));
    await expect(cell(page, key, 'median'), key).toHaveText(format(c.median.toString()));
    await expect(desktopRow(page, key).locator('th'), key).toContainText(`${c.count} sammenlignbare brukt · ${leftOut} utelatt`);
    if (c.best !== null) {
      await expect(cell(page, key, 'best'), key).toHaveText(format(c.best.quartile.toString()));
      await expect(cell(page, key, 'placement'), key).toHaveText(`bedre enn ${formatWholePercent(c.best.percentile.toString())}`);
    } else {
      await expect(cell(page, key, 'best'), key).not.toContainText(/\d/);
      await expect(cell(page, key, 'placement'), key).not.toContainText(/bedre enn/);
    }
  }
  // The kroner: a capital amount for 9, 10 and 11, each rounded once from the engine's exact øre.
  for (const key of ['kfd', 'lgd', 'oml'] as const) {
    const gap = expected[key].gap;
    if (gap.kind !== 'amount') throw new Error(`the fixture's ${key} has no capital amount`);
    await expect(cell(page, key, 'gap'), key).toHaveText(`${formatKronerExact(gap.ore.toString())}${nb['keyFigures.oneOff']}`);
  }
  for (const key of ['vare', 'lonn', 'andre']) {
    await expect(cell(page, key, 'gap'), key).toHaveText(nb['keyFigures.costShare.kroner']);
  }
  await expect(cell(page, 'ebitda', 'gap')).toHaveText(nb['keyFigures.noKroner']);
  // 7 and 8 are not read in v1, whatever the document.
  for (const key of ['omsArsverk', 'lonnArsverk']) {
    await expect(cell(page, key, 'own'), key).toContainText(nb['analysis.figures.notReadInV1']);
  }
});

test('excluding one peer puts the document rows below the floor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/peers`);
  const peer = peers[0];
  if (peer === undefined) throw new Error('the fixture has no peers');
  const action = page.locator(`[data-peer-action="${peer.orgnr}"]:visible`);
  await expect(action).toHaveText(nb['peers.action.exclude']);
  await action.click();
  await expect.poll(() => new URL(page.url()).search).toBe(`?ekskl=${peer.orgnr}`);
  await page.getByRole('link', { name: nb['tabs.nokkeltall'] }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(nb['tabs.nokkeltall']);
  for (const [key] of ROWS) {
    await expect(cell(page, key, 'merged'), key).toHaveText('For få sammenlignbare (9 av 10)');
    await expect(desktopRow(page, key).locator('th'), key).toContainText('9 sammenlignbare brukt');
  }
  await expect(region(page).locator('tr[data-figure="kfd"]')).not.toContainText(/\d\skr/);
});

test('no document øre reaches the page', async ({ request }) => {
  const ore = syntheticDocumentCompanies().flatMap((company) => [
    ...Object.values(company.current),
    ...Object.values(company.prior),
  ]);
  await expectNoDocumentFields(request, `${base}/nokkeltall`, { ore, marker: nb['keyFigures.regionLabel'] });
});

for (const width of [375, 320]) {
  test(`at ${width} px: every row on the phone, the capital amounts fit, no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/nokkeltall`);
    const phone = page.locator('table[data-layout="phone"]');
    await expect(phone).toBeVisible();
    await expect(phone.locator('button[aria-controls^="kf-p-exp-"]')).toHaveCount(15);
    await noSidewaysScroll(page);
    for (const key of ['kfd', 'lgd', 'oml']) {
      const gap = phone.locator(`tr:has(button[aria-controls="kf-p-exp-${key}"]) td[data-cell="gap"]`);
      await expect(gap, key).toContainText(nb['keyFigures.oneOff']);
      // The amount and its subline stay inside the screen, each on one line.
      for (const part of await gap.locator('span').all()) {
        const box = await part.boundingBox();
        if (box === null) throw new Error(`${key}: no box`);
        expect(box.x + box.width, key).toBeLessThanOrEqual(width);
        expect(box.height, key).toBeLessThan(30);
      }
      await phone.locator(`button[aria-controls="kf-p-exp-${key}"]`).click();
      await expect(page.locator(`[id="kf-p-exp-${key}"]`), key).toBeVisible();
      await noSidewaysScroll(page);
    }
  });
}
