// The Peers tab (Stories 1.7, 2.7) against the production build and the
// loaded demo seed: the peer group on the header and the tab, `ekskl`
// against the pool, the funnel, each row against the engine run on the seed,
// the payload, the subjects that cannot have peers, and phone widths.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { formatMillions } from '../src/engine/format.ts';
import type { PeerDisplayRow } from '../src/analysis/peer-rows.ts';
import { PHONE_CARDS } from '../src/components/analysis/peer-list.tsx';
import {
  A,
  ABSENT,
  companies,
  covered,
  expectedGroup,
  expectedPeerGroup,
  expectedPool,
  expectedRows,
  newestFiling,
  noSidewaysScroll,
  nonCalendar,
  notice,
  pick,
  revenue,
  revenueOf,
  tabs,
  withFiling,
} from './seed.ts';
import { expectNoPeerFields } from './payload.ts';

test.describe('the peer group (Story 1.7)', () => {
  const pool0 = expectedGroup(A.orgnr ?? '', 0);
  const pool1 = expectedGroup(A.orgnr ?? '', 1);
  const inBand0 = new Set(pool0.map((peer) => peer.orgnr));
  // A peer only the widened band 1 keeps.
  const widenedOnly = pool1.find((peer) => !inBand0.has(peer.orgnr));
  const peerTable = (page: Page) => page.getByRole('region', { name: nb['peers.regionLabel'] }).locator('table');
  const peersCount = (n: number) => nb['peers.count'].replace('{n}', String(n));
  const headerCount = (n: number) => nb['analysis.peerCount'].replace('{n}', String(n));

  test('the seed gives demo A a group to test with', () => {
    expect(pool0.length).toBeGreaterThan(1);
    expect(widenedOnly).toBeDefined();
  });

  test('the header shows "{n} sammenlignbare" after the revenue', async ({ page }) => {
    await page.goto(`/analyse/${A.orgnr}/oversikt`);
    const items = page.getByTestId('company-meta').locator('span:not([aria-hidden])');
    const texts = await items.allTextContents();
    expect(texts[texts.indexOf(revenue(A.orgnr ?? '')) + 1]).toBe(headerCount(pool0.length));
  });

  test('the Peers tab lists the group by revenue, with the count, in a labelled scroll region', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/peers`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool0.length));
    const region = page.getByRole('region', { name: nb['peers.regionLabel'] });
    await expect(region).toHaveAttribute('tabindex', '0');
    expect(await region.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
    await expect(peerTable(page).locator('thead th')).toHaveText([
      nb['peers.col.selskap'],
      nb['peers.col.omsetning'],
      nb['fig.driftsmargin'],
      nb['peers.col.reason'],
      nb['peers.col.basis'],
      nb['peers.col.flag'],
    ]);
    const rows = peerTable(page).locator('tbody tr');
    await expect(rows).toHaveCount(pool0.length);
    await expect(rows.locator('td:first-child')).toHaveText(pool0.map((peer) => peer.navn));
    await expect(rows.locator('td:nth-child(2)')).toHaveText(
      pool0.map((peer) => formatMillions(String(peer.sumDriftsinntekter))),
    );
  });

  // AD-4, Story 2.7: each peer reaches the page as display strings only.
  test('the HTML and the RSC payload of Peers carry no peer orgnr, peer key-figure amount or server field', async ({ request }) => {
    await expectNoPeerFields(request, `/analyse/${A.orgnr}/peers`, {
      pool: expectedPool(A.orgnr ?? '', 0),
      marker: nb['peers.funnel.stage5'],
    });
  });

  test('ekskl: a pool peer leaves the count, an orgnr outside the pool is dropped with the notice', async ({ page }) => {
    const peer = pool0[0]?.orgnr ?? '';
    await page.goto(`/analyse/${A.orgnr}/peers?ekskl=${peer},${ABSENT}`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool0.length - 1));
    await expect(page.getByTestId('company-meta')).toContainText(headerCount(pool0.length - 1));
    await expect(notice(page)).toHaveText(nb['analysis.notice']);
  });

  test('ekskl: a widened-band peer is kept at band 1 and dropped with the notice at the default band', async ({ page }) => {
    const peer = widenedOnly?.orgnr ?? '';
    await page.goto(`/analyse/${A.orgnr}/peers?band=1&ekskl=${peer}`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool1.length - 1));
    await expect(notice(page)).toHaveText('');
    // The tab links keep the exclusion: it was kept.
    await expect(tabs(page).getByRole('link', { name: nb['tabs.oversikt'] })).toHaveAttribute(
      'href',
      `/analyse/${A.orgnr}/oversikt?ekskl=${peer}&band=1`,
    );

    await page.goto(`/analyse/${A.orgnr}/peers?ekskl=${peer}`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool0.length));
    await expect(notice(page)).toHaveText(nb['analysis.notice']);
    await expect(tabs(page).getByRole('link', { name: nb['tabs.oversikt'] })).toHaveAttribute(
      'href',
      `/analyse/${A.orgnr}/oversikt`,
    );
  });

  for (const width of [375, 320]) {
    test(`the Peers tab reflows at ${width} px: cards instead of the table, the body never scrolls`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${A.orgnr}/peers`);
      await expect(peerTable(page)).toBeHidden();
      await expect(page.getByTestId('peer-cards')).toBeVisible();
      await noSidewaysScroll(page);
    });
  }
});

test.describe('a covered AS that cannot have peers', () => {
  const noRevenue = [
    ['zero', pick('zero revenue', (c) => revenueOf(c) === '0')],
    ['negative', pick('negative revenue', (c) => revenueOf(c).startsWith('-'))],
    ['null', pick('no stated revenue', (c) => revenueOf(c) === '')],
  ] as const;

  for (const [label, subject] of noRevenue) {
    test(`${label} revenue: "0 sammenlignbare" and the no-revenue sentence with the year`, async ({ page }) => {
      await page.goto(`/analyse/${subject.orgnr}/peers`);
      await expect(page.getByTestId('company-meta')).toContainText(nb['analysis.peerCount'].replace('{n}', '0'));
      await expect(page.getByTestId('peer-count')).toHaveText(nb['peers.count'].replace('{n}', '0'));
      await expect(page.getByText(nb['peers.noRevenue'].replace('{aar}', newestFiling(subject.orgnr ?? '').filing_year ?? ''))).toBeVisible();
      await expect(page.getByText(nb['peers.none'])).toHaveCount(0);
    });
  }

  test('a non-calendar year: "0 sammenlignbare" and the non-calendar sentence', async ({ page }) => {
    await page.goto(`/analyse/${nonCalendar.orgnr}/peers`);
    await expect(page.getByTestId('company-meta')).toContainText(nb['analysis.peerCount'].replace('{n}', '0'));
    await expect(page.getByText(nb['peers.nonCalendar'])).toBeVisible();
    await expect(page.getByText(nb['peers.none'])).toHaveCount(0);
  });
});

// Story 2.7: the funnel and why each peer is in the group.
const labelled = new Set(
  (
    JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../analysis/labelled-set/document-run.json'), 'utf8')) as {
      orgnr: string;
    }[]
  ).map((entry) => entry.orgnr),
);
const GLYPH = '✦';

/**
 * A covered AS outside the labelled set whose group mixes match bases,
 * picked from the seed when the test runs. Its orgnr is never named in a
 * title.
 */
function mixedBasisSubject(): string {
  for (const c of companies) {
    const orgnr = c.orgnr ?? '';
    if (!covered.has(c.naeringskode1 ?? '') || c.organisasjonsform !== 'AS' || !withFiling.has(orgnr)) continue;
    if (labelled.has(orgnr)) continue;
    const rows = expectedRows(orgnr, 0);
    if (rows.length > 0 && new Set(rows.map((row) => row.grunnlag)).size >= 2) return orgnr;
  }
  throw new Error('no covered AS outside the labelled set with mixed match bases in the seed');
}

/** ✦ is hidden from screen readers wherever it is drawn: one read of every marker, not one wait per marker. */
async function expectEveryMarkHidden(page: Page): Promise<void> {
  const hidden = await page.getByTestId('ai-mark').evaluateAll((marks) => marks.map((mark) => mark.getAttribute('aria-hidden')));
  expect(hidden.filter((value) => value !== 'true')).toEqual([]);
}

test.describe('the Peers tab shows why (Story 2.7)', () => {
  const basisText = (row: PeerDisplayRow) => (row.grunnlagKi ? `${GLYPH}${nb['peers.ai']} ${row.grunnlag}` : row.grunnlag);
  const flagText = (row: PeerDisplayRow) => (row.flagg === null ? '' : `${GLYPH}${nb['peers.ai']} ${row.flagg}`);
  const desktopRows = (page: Page) => page.getByRole('region', { name: nb['peers.regionLabel'] }).locator('tbody tr');

  test('the funnel shows the five stages with the engine’s counts, the Segment criterion and the flagged count', async ({ page }) => {
    const { counts } = expectedPeerGroup(A.orgnr ?? '', 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/peers`);
    const stages = page.getByTestId('funnel-stage');
    await expect(stages).toHaveCount(5);
    await expect(page.getByTestId('funnel-count')).toHaveText(
      [counts.stage1, counts.stage2, counts.stage3.legalForm, counts.stage4.businessModel, counts.stage5.classification].map(String),
    );
    await expect(stages.nth(2)).toContainText(nb['peers.funnel.segment.legalForm']);
    await expect(page.getByTestId('funnel-criterion-count')).toHaveText(String(counts.stage3.legalForm));
    await expect(page.getByTestId('funnel-flagged')).toHaveText(
      `${GLYPH}${nb['peers.ai']} ${nb['peers.funnel.flagged'].replace('{n}', String(counts.stage5.flagged))}`,
    );
    // Five columns side by side at desktop width.
    const tops = await stages.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });

  // Demo A is not in the labelled set, and its group has no type on either
  // signal for it: row by row, names and reasons may be compared.
  test("demo A: each row's figures, reason, basis and flag match the engine on the seed", async ({ page }) => {
    const rows = expectedRows(A.orgnr ?? '', 0);
    expect(rows.length).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/peers`);
    const shown = desktopRows(page);
    await expect(shown).toHaveCount(rows.length);
    await expect(shown.locator('td:nth-child(1)')).toHaveText(rows.map((row) => row.navn));
    await expect(shown.locator('td:nth-child(2)')).toHaveText(rows.map((row) => row.omsetning));
    await expect(shown.locator('td:nth-child(3)')).toHaveText(rows.map((row) => row.driftsmargin));
    await expect(shown.locator('td:nth-child(4)')).toHaveText(rows.map((row) => row.hvorforMed));
    await expect(shown.getByTestId('peer-basis')).toHaveText(rows.map(basisText));
    await expect(shown.locator('td:nth-child(6)')).toHaveText(rows.map(flagText));
    await expectEveryMarkHidden(page);
  });

  // The mixed-basis subject's peers may be in the labelled set, so a failure
  // must not print a basis or a flag next to a name: the test compares
  // totals per basis and per flag only, and the row count.
  test('a mixed-basis subject from the seed: the totals per basis and flag match the engine', async ({ page }) => {
    const orgnr = mixedBasisSubject();
    const rows = expectedRows(orgnr, 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${orgnr}/peers`);
    const shown = desktopRows(page);
    await expect(shown).toHaveCount(rows.length);
    const tally = (texts: readonly string[]) => {
      const counts: Record<string, number> = {};
      for (const text of texts) counts[text] = (counts[text] ?? 0) + 1;
      return counts;
    };
    expect(tally(await shown.getByTestId('peer-basis').allTextContents())).toEqual(tally(rows.map(basisText)));
    expect(tally(await shown.locator('td:nth-child(6)').allTextContents())).toEqual(tally(rows.map(flagText)));
    await expectEveryMarkHidden(page);
  });

  test('the caption carries the key "✦ KI-generert", and the flag column has a screen-reader header', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${A.orgnr}/peers`);
    const region = page.getByRole('region', { name: nb['peers.regionLabel'] });
    await expect(region.locator('caption')).toBeVisible();
    await expect(region.locator('caption')).toContainText(`${GLYPH}${nb['peers.ai']}`);
    await expect(region.locator('thead th').nth(5)).toHaveText(nb['peers.col.flag']);
  });

  for (const width of [375, 320]) {
    test(`at ${width} px: the funnel is a list and peers are cards`, async ({ page }) => {
      const rows = expectedRows(A.orgnr ?? '', 0);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${A.orgnr}/peers`);
      await noSidewaysScroll(page);
      // The funnel stacks: each stage below the one before, full width.
      const stages = await page.getByTestId('funnel-stage').evaluateAll((items) =>
        items.map((item) => {
          const box = item.getBoundingClientRect();
          return { top: box.top, width: box.width };
        }),
      );
      expect(stages).toHaveLength(5);
      for (let i = 1; i < stages.length; i += 1) expect(stages[i]?.top ?? 0).toBeGreaterThan(stages[i - 1]?.top ?? 0);
      for (const stage of stages) expect(stage.width).toBeGreaterThan(width - 40);
      // Cards, not the table.
      await expect(page.getByRole('region', { name: nb['peers.regionLabel'] })).toBeHidden();
      const visibleCards = page.getByTestId('peer-cards').locator('[data-testid="peer-card"]:visible');
      await expect(visibleCards).toHaveCount(Math.min(rows.length, PHONE_CARDS));
      await expect(visibleCards.first()).toContainText(rows[0]?.navn ?? '');
      if (rows.length > PHONE_CARDS) {
        const more = page.getByRole('button', { name: nb['peers.showAll'].replace('{n}', String(rows.length)) });
        await more.focus();
        await page.keyboard.press('Enter');
        await expect(visibleCards).toHaveCount(rows.length);
        await expect(page.locator(':focus')).toHaveText(rows[PHONE_CARDS]?.navn ?? '');
      }
      // Every target at least 24 × 24 px.
      const small = await page.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>('main a, main button, main [tabindex="0"]')]
            .filter((el) => el.offsetParent !== null)
            .map((el) => el.getBoundingClientRect())
            .filter((box) => box.width < 24 || box.height < 24).length,
      );
      expect(small).toBe(0);
      await noSidewaysScroll(page);
    });
  }
});
