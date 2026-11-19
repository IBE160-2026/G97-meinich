// Adjusting the peer group (Story 2.8; FR-17, FR-18, FR-19) against the
// production build and the loaded demo seed: exclude and restore, the size
// band, reset, the history, the band change that drops exclusions, the
// floor crossed both ways, "Vis alle" across changes, the pending and failed
// states, the rate limit mid-series, one request per change, the exclusion
// cap (Story 2.10), phone widths, and the decomposition factors below the floor (Story 3.2). Every expected count is the engine's on the seed (e2e/seed.ts).
// The floor subject is picked from the seed outside the labelled set and
// named by no title; its peers are compared by count only.
import type { Page, Route } from '@playwright/test';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { bandFactors } from '../src/analysis/size-band.ts';
import { PHONE_CARDS } from '../src/components/analysis/phone-cards.ts';
import { PANEL_HEADING_ID } from '../src/analysis/view.ts';
import { BUDGETS } from '../src/rate-limit/budgets.ts';
import { expect, test } from './fixtures.ts';
import { formatPercent, formatTurnover } from '../src/engine/format.ts';
import { A, expectedBenchmark, expectedGroup, expectedTurnover, floorSubject, noSidewaysScroll, notice, tabs } from './seed.ts';
import { medianStep } from '../src/engine/closable.ts';

const DB_DOWN_PORT = '3101'; // playwright.config.ts: the server whose database is unreachable

const group0 = expectedGroup(A.orgnr ?? '', 0);
const group1 = expectedGroup(A.orgnr ?? '', 1);
const inGroup0 = new Set(group0.map((peer) => peer.orgnr));
const widenedOnly = group1.find((peer) => !inGroup0.has(peer.orgnr));
const first = group0[0];
const peersPath = (orgnr: string) => `/analyse/${orgnr}/peers`;
const PEERS = peersPath(A.orgnr ?? '');

const fill = (id: keyof typeof nb, vars: Record<string, string>) =>
  Object.entries(vars).reduce((text, [name, value]) => text.replace(`{${name}}`, value), nb[id]);
const status = (page: Page) => page.getByTestId('peer-change-status');
const action = (page: Page, orgnr: string) => page.locator(`[data-peer-action="${orgnr}"]:visible`);
const desktopRows = (page: Page) => page.getByRole('region', { name: nb['peers.regionLabel'] }).locator('tbody tr');
const peerCount = (page: Page) => page.getByTestId('peer-count');
const headerCount = (page: Page) => page.getByTestId('header-peer-count');
const historyLength = (page: Page) => page.evaluate(() => window.history.length);
/** The path and query the browser shows, without the origin. */
const shown = (page: Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
};
const count = (n: number) => (n === 1 ? nb['peers.countOne'] : fill('peers.count', { n: String(n) }));

async function open(page: Page, path: string, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  // The streamed panel, not the loading state.
  await expect(page.getByTestId('size-band')).toBeVisible();
}

test.describe('adjusting the peer group (Story 2.8)', () => {
  test('the seed gives demo A a group and a widened-only peer', () => {
    expect(group0.length).toBeGreaterThan(PHONE_CARDS + 1);
    expect(widenedOnly).toBeDefined();
  });

  test('exclude and restore keep focus, announce and push one history entry each', async ({ page }) => {
    const peer = first?.orgnr ?? '';
    const navn = first?.navn ?? '';
    await open(page, PEERS);
    const before = await historyLength(page);

    await action(page, peer).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}`);
    await expect(status(page)).toHaveText(fill('peers.announce.excluded', { navn, m: String(group0.length - 1) }));
    // The row stays, struck through and tagged; the button is now "Ta med igjen {Navn}", with focus.
    const excluded = desktopRows(page).and(page.locator('[data-excluded="true"]'));
    await expect(excluded).toHaveCount(1);
    await expect(excluded.locator('td').first()).toHaveText(`${navn} ${nb['peers.excluded']}`);
    await expect(excluded.locator('.line-through')).toHaveText(navn);
    await expect(desktopRows(page)).toHaveCount(group0.length);
    await expect(action(page, peer)).toHaveAccessibleName(fill('peers.action.restoreName', { navn }));
    await expect(action(page, peer)).toHaveText(nb['peers.action.restore']);
    await expect(action(page, peer)).toBeFocused();
    await expect(page.getByTestId('funnel-excluded')).toHaveText(
      fill('peers.funnel.excluded', { n: '1', m: String(group0.length - 1) }),
    );
    await expect(peerCount(page)).toHaveText(count(group0.length - 1));
    await expect(headerCount(page)).toHaveText(fill('analysis.peerCount', { n: String(group0.length - 1) }));
    expect(await historyLength(page)).toBe(before + 1);

    // Restore by keyboard, from the focused button.
    await page.keyboard.press('Enter');
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(status(page)).toHaveText(fill('peers.announce.restored', { navn, m: String(group0.length) }));
    await expect(action(page, peer)).toHaveAccessibleName(fill('peers.action.excludeName', { navn }));
    await expect(action(page, peer)).toBeFocused();
    await expect(page.getByTestId('funnel-excluded')).toHaveCount(0);
    expect(await historyLength(page)).toBe(before + 2);
  });

  test('back returns the previous peer group', async ({ page }) => {
    const peer = first?.orgnr ?? '';
    await open(page, PEERS);
    await action(page, peer).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}`);
    await page.locator('[data-band-step="1"]').click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}&band=1`);
    await expect(peerCount(page)).toHaveText(count(group1.length - 1));
    await page.getByRole('link', { name: nb['peers.reset'] }).click();
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(peerCount(page)).toHaveText(count(group0.length));
    // The band control follows the rendered band: it keeps no choice of its own.
    await expect(page.locator('[data-band-step="0"]')).toHaveAttribute('aria-checked', 'true');

    await page.goBack();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}&band=1`);
    await expect(peerCount(page)).toHaveText(count(group1.length - 1));
    await expect(page.locator('[data-band-step="1"]')).toHaveAttribute('aria-checked', 'true');
    await page.goBack();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}`);
    await expect(peerCount(page)).toHaveText(count(group0.length - 1));
    await expect(page.locator('[data-band-step="0"]')).toHaveAttribute('aria-checked', 'true');
    await page.goBack();
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(peerCount(page)).toHaveText(count(group0.length));
  });

  test('reset restores the standard group and focuses the heading', async ({ page }) => {
    const peer = first?.orgnr ?? '';
    await open(page, `${PEERS}?ekskl=${peer}&band=2`);
    await expect(page.getByTestId('widened-tag')).toHaveText(nb['peers.band.widened']);
    await page.getByRole('link', { name: nb['peers.reset'] }).click();
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(status(page)).toHaveText(fill('peers.announce.reset', { n: String(group0.length) }));
    await expect(page.locator(`#${PANEL_HEADING_ID}`)).toBeFocused();
    await expect(page.getByTestId('widened-tag')).toHaveCount(0);
    await expect(page.locator('[data-band-step="0"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('link', { name: nb['peers.reset'] })).toHaveCount(0);
  });

  test('the size band is a radiogroup with roving tabindex: an arrow key chooses the next step and keeps focus on it', async ({
    page,
  }) => {
    await open(page, PEERS);
    const group = page.getByRole('radiogroup', { name: nb['peers.band.label'] });
    await expect(group.getByRole('radio')).toHaveCount(3);
    await expect(group).toHaveAccessibleDescription(nb['peers.band.fixed']);
    await expect(page.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
    await page.locator('[data-band-step="0"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => shown(page)).toBe(`${PEERS}?band=1`);
    await expect(status(page)).toHaveText(fill('peers.announce.band', { b: bandFactors(1), n: String(group1.length) }));
    const step = page.locator('[data-band-step="1"]');
    await expect(step).toBeFocused();
    await expect(step).toHaveAttribute('aria-checked', 'true');
    await expect(step).toHaveAttribute('tabindex', '0');
    await expect(page.locator('[data-band-step="0"]')).toHaveAttribute('tabindex', '-1');
    // Beyond Standard: the tag and the widened block with its way back.
    await expect(page.getByTestId('widened-tag')).toHaveText(nb['peers.band.widened']);
    await expect(page.getByTestId('widened-block')).toContainText(fill('peers.widened.body', { b: bandFactors(1) }));
    await expect(page.getByTestId('widened-block').getByRole('link')).toHaveText(
      fill('peers.widened.back', { b: bandFactors(0) }),
    );
    // No control offers anything but the band.
    await expect(page.getByRole('radiogroup')).toHaveCount(1);

    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(page.locator('[data-band-step="0"]')).toBeFocused();
    await expect(page.getByTestId('widened-tag')).toHaveCount(0);
  });

  test('a band change drops exclusions outside the pool with the notice once', async ({ page }) => {
    const widened = widenedOnly?.orgnr ?? '';
    await open(page, `${PEERS}?ekskl=${widened}&band=1`);
    await expect(notice(page)).toHaveText('');
    await page.locator('[data-band-step="0"]').click();
    // The pushed URL keeps the exclusion; the server parses it against the new band's pool and drops it.
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${widened}`);
    await expect(notice(page)).toHaveText(nb['analysis.notice']);
    await expect(peerCount(page)).toHaveText(count(group0.length));
    // The next change builds on what the server kept: the dropped orgnr does not return, nor the notice.
    const peer = first?.orgnr ?? '';
    await action(page, peer).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}`);
    await expect(status(page)).toHaveText(fill('peers.announce.excluded', { navn: first?.navn ?? '', m: String(group0.length - 1) }));
    await expect(notice(page)).toHaveText('');
  });

  // Story 3.5 (Epic 2 retro B6): a peer change keeps andel=median, which the
  // provider's base used to lose to 50 by parsing it with no median step.
  test('exclude, restore, a band step and reset keep andel=median', async ({ page }) => {
    const peer = first?.orgnr ?? '';
    // Fixture: the median step exists for the standard group, with the peer excluded, and at band 1.
    for (const [band, ekskl] of [
      [0, []],
      [0, [peer]],
      [1, [peer]],
      [1, []],
    ] as const) {
      expect(medianStep(expectedBenchmark(A.orgnr ?? '', band, ekskl).driftsmargin.comparison).kind, `${band} ${ekskl.join()}`).toBe('exists');
    }
    await open(page, `${PEERS}?andel=median`);
    await expect(notice(page)).toHaveText('');
    await action(page, peer).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}&andel=median`);
    await expect(status(page)).toHaveText(fill('peers.announce.excluded', { navn: first?.navn ?? '', m: String(group0.length - 1) }));
    await expect(notice(page)).toHaveText('');
    await page.locator('[data-band-step="1"]').click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}&band=1&andel=median`);
    await expect(notice(page)).toHaveText('');
    await action(page, peer).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?band=1&andel=median`);
    await page.getByRole('link', { name: nb['peers.reset'] }).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?andel=median`);
    await expect(notice(page)).toHaveText('');
  });

  test('a share written on Verdi is kept by a later peer change', async ({ page }) => {
    const peer = first?.orgnr ?? '';
    await page.goto(`/analyse/${A.orgnr}/verdi`);
    await page.locator('[data-share-step="75"]').click();
    await expect.poll(() => shown(page)).toBe(`/analyse/${A.orgnr}/verdi?andel=75`);
    await tabs(page).getByRole('link', { name: nb['tabs.peers'] }).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?andel=75`);
    await expect(page.getByTestId('size-band')).toBeVisible();
    await action(page, peer).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}&andel=75`);
  });

  test('an exclusion takes a figure below the floor and back', async ({ page }) => {
    const subject = floorSubject();
    const group = expectedGroup(subject, 0);
    const kept = group.slice(0, group.length - 10).map((peer) => peer.orgnr);
    const next = group[group.length - 10]?.orgnr ?? '';
    const path = peersPath(subject);
    const ekskl = [...kept].sort().join(',');
    const belowFloor = fill('keyFigures.belowFloor', { n: '9', min: '10' });
    await open(page, `${path}?ekskl=${ekskl}`);
    await expect(peerCount(page)).toHaveText(count(10));
    await expect(page.getByTestId('too-small-block')).toHaveCount(0);

    await action(page, next).click();
    await expect(page.getByTestId('too-small-block')).toContainText(fill('peers.tooSmall', { n: '9' }));
    await expect(headerCount(page)).toHaveText(fill('analysis.peerCount', { n: '9' }));
    await page.getByRole('link', { name: nb['tabs.nokkeltall'] }).click();
    await expect(page.getByText(belowFloor).first()).toBeVisible();

    await page.getByRole('link', { name: nb['tabs.peers'] }).click();
    await action(page, next).click();
    await expect(page.getByTestId('too-small-block')).toHaveCount(0);
    await expect(peerCount(page)).toHaveText(count(10));
    await page.getByRole('link', { name: nb['tabs.nokkeltall'] }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(nb['tabs.nokkeltall']);
    await expect(page.getByText(belowFloor)).toHaveCount(0);
  });

  // Story 3.2: each decomposition factor is gated on its own. The floor
  // subject excluded down to nine peers: each factor keeps the subject's
  // value with "For få sammenlignbare (n av 10)", n the engine's for that factor.
  test('factors below the floor', async ({ page }) => {
    const subject = floorSubject();
    const group = expectedGroup(subject, 0);
    const excluded = group.slice(0, group.length - 9).map((peer) => peer.orgnr);
    const margin = expectedBenchmark(subject, 0, excluded).driftsmargin.comparison;
    const turnover = expectedTurnover(subject, 0, excluded).comparison;
    if (margin.kind !== 'below_floor' || margin.count !== 9) throw new Error('the floor subject is below the floor on nine');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/analyse/${subject}/nokkeltall?ekskl=${[...excluded].sort().join(',')}`);
    const fold = page.getByRole('region', { name: nb['keyFigures.regionLabel'] }).locator('tr[data-foldout="margin"]');
    await fold.getByRole('button', { name: nb['keyFigures.foldout.margin'] }).click();
    const factors = fold.locator('[data-factor]');
    await expect(factors).toHaveCount(2);
    const expected = [
      [margin, formatPercent],
      [turnover, formatTurnover],
    ] as const;
    for (const [i, [c, format]] of expected.entries()) {
      const factor = factors.nth(i);
      // Nine peers or fewer: no factor can be compared.
      expect(c.kind, `factor ${i}`).not.toBe('compared');
      if (c.kind === 'below_floor') {
        await expect(factor).toContainText(format(c.subject.toString()));
        await expect(factor).toContainText(fill('keyFigures.belowFloor', { n: String(c.count), min: '10' }));
      }
      await expect(factor).not.toContainText(nb['keyFigures.col.median']);
      await expect(factor.getByTestId('distribution-strip')).toHaveCount(0);
    }
  });

  test('"Vis alle" at 375 px stays open across an exclusion and closes when the band changes', async ({ page }) => {
    await open(page, PEERS, 375);
    const cards = page.getByTestId('peer-cards').locator('[data-testid="peer-card"]:visible');
    await expect(cards).toHaveCount(PHONE_CARDS);
    await page.getByRole('button', { name: fill('peers.showAll', { n: String(group0.length) }) }).click();
    await expect(cards).toHaveCount(group0.length);
    const revealed = group0[PHONE_CARDS];
    await action(page, revealed?.orgnr ?? '').click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${revealed?.orgnr ?? ''}`);
    await expect(status(page)).toHaveText(
      fill('peers.announce.excluded', { navn: revealed?.navn ?? '', m: String(group0.length - 1) }),
    );
    await expect(cards).toHaveCount(group0.length);
    await expect(action(page, revealed?.orgnr ?? '')).toBeFocused();
    await noSidewaysScroll(page);

    await page.locator('[data-band-step="1"]').click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${revealed?.orgnr ?? ''}&band=1`);
    await expect(cards).toHaveCount(PHONE_CARDS);
    await expect(page.getByRole('button', { name: fill('peers.showAll', { n: String(group1.length) }) })).toBeVisible();
  });

  test('a pending change dims the figures and marks them busy', async ({ page }) => {
    await open(page, PEERS);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) => url.pathname.startsWith('/analyse/'),
      async (route: Route) => {
        if (route.request().headers()['rsc'] === '1') await held;
        await route.continue();
      },
    );
    const peer = first?.orgnr ?? '';
    await action(page, peer).click();
    const panel = page.getByTestId('analysis-panel');
    await expect(panel).toHaveAttribute('aria-busy', 'true');
    await expect(headerCount(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('peer-change-pending')).toHaveText(nb['peers.pending']);
    // The previous figures stay, dimmed, with no transition.
    await expect(desktopRows(page)).toHaveCount(group0.length);
    await expect(page.locator('[data-excluded="true"]')).toHaveCount(0);
    const style = await panel.locator(':scope > div').last().evaluate((el) => {
      const computed = getComputedStyle(el);
      return { opacity: computed.opacity, transition: computed.transitionDuration, animation: computed.animationName };
    });
    expect(style).toEqual({ opacity: '0.5', transition: '0s', animation: 'none' });

    release();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}`);
    await expect(panel).not.toHaveAttribute('aria-busy');
    await expect(headerCount(page)).not.toHaveAttribute('aria-busy');
    await expect(page.getByTestId('peer-change-pending')).toHaveCount(0);
  });

  test('a failed change keeps the last good URL and figures', async ({ page }) => {
    await open(page, PEERS);
    // The change's RSC request is answered by the server whose database is unreachable.
    await page.route(
      (url) => url.pathname.startsWith('/analyse/'),
      async (route: Route) => {
        if (route.request().headers()['rsc'] !== '1') return route.continue();
        const url = new URL(route.request().url());
        url.port = DB_DOWN_PORT;
        const response = await route.fetch({ url: url.toString() });
        return route.fulfill({ response });
      },
    );
    const peer = first?.orgnr ?? '';
    await action(page, peer).click();
    await expect(page.getByTestId('peer-change-alert').getByRole('paragraph')).toHaveText(nb['peers.failed']);
    await expect(page.getByTestId('peer-change-alert')).toHaveAttribute('role', 'alert');
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(desktopRows(page)).toHaveCount(group0.length);
    await expect(page.locator('[data-excluded="true"]')).toHaveCount(0);
    await expect(peerCount(page)).toHaveText(count(group0.length));
    await expect(page.getByText(nb['search.failed'])).toHaveCount(0);

    // A failed band step: the control returns to the band still shown.
    // Waiting for the step's own request, so the first failure's alert cannot pass for this one.
    const bandRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('band') === '1');
    await page.locator('[data-band-step="1"]').click();
    await bandRequest;
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(page.getByTestId('peer-change-alert').getByRole('paragraph')).toHaveText(nb['peers.failed']);
    await expect(page.locator('[data-band-step="0"]')).toHaveAttribute('aria-checked', 'true');
    await expect(peerCount(page)).toHaveText(count(group0.length));

    // Another page clears the alert: a tab change.
    await page.unrouteAll();
    await page.getByRole('link', { name: nb['tabs.nokkeltall'] }).click();
    await expect.poll(() => shown(page)).toBe(`/analyse/${A.orgnr ?? ''}/nokkeltall`);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(nb['tabs.nokkeltall']);
    await expect(page.getByTestId('peer-change-alert')).toHaveText('');

    // The next change succeeds.
    await page.getByRole('link', { name: nb['tabs.peers'] }).click();
    await expect(page.getByTestId('size-band')).toBeVisible();
    await action(page, peer).click();
    await expect.poll(() => shown(page)).toBe(`${PEERS}?ekskl=${peer}`);
    await expect(page.getByTestId('peer-change-alert')).toHaveText('');
  });

  test('a change undone before it commits ends at the standard URL and is announced', async ({ page }) => {
    await open(page, PEERS);
    // The first change's response is held until the second has been asked for.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let rscRequests = 0;
    await page.route(
      (url) => url.pathname.startsWith('/analyse/'),
      async (route: Route) => {
        if (route.request().headers()['rsc'] === '1') {
          rscRequests += 1;
          if (rscRequests === 1) await held;
        }
        await route.continue();
      },
    );
    await page.locator('[data-band-step="1"]').click();
    await expect.poll(() => rscRequests).toBe(1);
    // Back to Standard while the first is pending: the same URL and count as the last commit.
    await page.locator('[data-band-step="0"]').click();
    await expect.poll(() => rscRequests).toBe(2);
    release();
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(status(page)).toHaveText(fill('peers.announce.band', { b: bandFactors(0), n: String(group0.length) }));
    await expect(peerCount(page)).toHaveText(count(group0.length));
    await expect(page.locator('[data-band-step="0"]')).toHaveAttribute('aria-checked', 'true');
  });

  test('a page error outside a peer-group change shows the error state and does not navigate', async ({ page }) => {
    await open(page, PEERS);
    // No change in flight: a tab's RSC request is answered by the server whose database is unreachable.
    await page.route(
      (url) => url.pathname.startsWith('/analyse/'),
      async (route: Route) => {
        if (route.request().headers()['rsc'] !== '1') return route.continue();
        const url = new URL(route.request().url());
        url.port = DB_DOWN_PORT;
        return route.fulfill({ response: await route.fetch({ url: url.toString() }) });
      },
    );
    const tab = `/analyse/${A.orgnr ?? ''}/nokkeltall`;
    await page.getByRole('link', { name: nb['tabs.nokkeltall'] }).click();
    await expect(page.locator('main [role="alert"]')).toHaveText(nb['search.failed']);
    const entries = await historyLength(page);
    // Long enough for a Back the boundary would have sent.
    await page.waitForTimeout(1000);
    expect(shown(page)).toBe(tab);
    expect(await historyLength(page)).toBe(entries);
    await expect(page.locator('main [role="alert"]')).toHaveText(nb['search.failed']);
    await expect(page.getByTestId('peer-change-alert')).toHaveCount(0);
  });

  test('a failure of the second of two quick changes returns to the last good URL and figures', async ({ page }) => {
    await open(page, PEERS);
    const [one, two] = group0;
    // The second change's request (both orgnrs excluded) is answered by the server whose database is unreachable.
    await page.route(
      (url) => url.pathname.startsWith('/analyse/'),
      async (route: Route) => {
        const request = route.request();
        if (request.headers()['rsc'] !== '1' || !(new URL(request.url()).searchParams.get('ekskl') ?? '').includes(',')) {
          return route.continue();
        }
        const url = new URL(request.url());
        url.port = DB_DOWN_PORT;
        return route.fulfill({ response: await route.fetch({ url: url.toString() }) });
      },
    );
    await action(page, one?.orgnr ?? '').click();
    await action(page, two?.orgnr ?? '').click();
    await expect(page.getByTestId('peer-change-alert').getByRole('paragraph')).toHaveText(nb['peers.failed']);
    await expect.poll(() => shown(page)).toBe(PEERS);
    await expect(desktopRows(page)).toHaveCount(group0.length);
    await expect(page.locator('[data-excluded="true"]')).toHaveCount(0);
    await expect(peerCount(page)).toHaveText(count(group0.length));
  });

  test('a change over the rate limit shows the refusal page', async ({ page, request }) => {
    await open(page, PEERS);
    // The page's own address: the fixture sends the same X-Forwarded-For from the page and from `request`.
    let refused = false;
    for (let i = 0; i < 2 * BUDGETS.analysis.limit && !refused; i += 1) {
      refused = (await request.get('/slik-fungerer-peerless')).status() === 429;
    }
    expect(refused).toBe(true);
    const peer = first?.orgnr ?? '';
    await action(page, peer).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(nb['rateLimit.title']);
    await expect(page.getByRole('alert')).toHaveText(nb['rateLimit.refused']);
    expect(shown(page)).toBe(`${PEERS}?ekskl=${peer}`);
  });

  test('a change costs one analysis request', async ({ page }) => {
    await open(page, PEERS);
    const requests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/analyse/')) requests.push(url.pathname);
    });
    const peer = first?.orgnr ?? '';
    await action(page, peer).click();
    await expect(status(page)).not.toHaveText('');
    // Anything a prefetch would send has had time to go.
    await page.waitForTimeout(1000);
    expect(requests).toEqual([PEERS]);
  });

  // Story 2.10 (FR-17): at MAX_EKSKL exclusions every "Ekskluder" is
  // aria-disabled, focusable and described by the cap text; a press pushes
  // nothing and sets no notice. Below the cap a press pushes as before.
  test.describe('the exclusion cap', () => {
    const ekskl = (n: number) => group0.slice(0, n).map((peer) => peer.orgnr).sort();
    const capPath = (n: number) => `${PEERS}?ekskl=${ekskl(n).join(',')}`;
    const excludeButtons = (page: Page) =>
      page.locator(`[data-peer-action]:visible[aria-label^="${nb['peers.action.exclude']} "]`);
    const capText = (page: Page) => page.getByTestId('exclusion-cap');
    const ekskOf = (page: Page) => new URL(page.url()).searchParams.get('ekskl')?.split(',') ?? [];
    /**
     * Every request a push or a page load would make from now on: an RSC
     * fetch (the `rsc` header a soft navigation sends) or a navigation.
     * A press that pushes nothing leaves it empty.
     */
    const pushes = (page: Page): string[] => {
      const seen: string[] = [];
      page.on('request', (request) => {
        if (request.headers()['rsc'] === '1' || request.isNavigationRequest()) seen.push(request.url());
      });
      return seen;
    };

    test('the seed gives demo A more than 20 peers', () => {
      expect(group0.length).toBeGreaterThan(20);
    });

    test('with 20 exclusions every "Ekskluder" is aria-disabled and described by the cap text; a press pushes nothing', async ({
      page,
    }) => {
      await open(page, capPath(20));
      await expect(notice(page)).toHaveText('');
      await expect(capText(page)).toHaveText(nb['peers.exclusionCap']);
      await expect(capText(page)).toHaveText('Du kan ekskludere opptil 20 selskaper. Ta med et selskap igjen for å ekskludere et annet.');
      const buttons = excludeButtons(page);
      const n = await buttons.count();
      expect(n).toBeGreaterThan(0);
      await expect(page.locator('[data-peer-action]:visible[aria-disabled="true"]')).toHaveCount(n);
      // "Ta med igjen" is never disabled.
      await expect(page.locator(`[data-peer-action]:visible[aria-label^="${nb['peers.action.restore']} "][aria-disabled]`)).toHaveCount(0);
      const target = action(page, group0[20]?.orgnr ?? '');
      await expect(target).toHaveAttribute('aria-disabled', 'true');
      await expect(target).toHaveAccessibleDescription(nb['peers.exclusionCap']);
      await expect(target).not.toHaveAttribute('disabled');
      await expect(target).not.toHaveAttribute('tabindex', '-1');
      // Focusable, and Enter or a click pushes nothing.
      const before = await historyLength(page);
      const url = shown(page);
      const requests = pushes(page);
      await target.focus();
      await expect(target).toBeFocused();
      await page.keyboard.press('Enter');
      await target.click({ force: true });
      // A push would start its RSC fetch at once; a short settle catches it.
      await page.waitForTimeout(250);
      expect(requests).toEqual([]);
      expect(shown(page)).toBe(url);
      expect(await historyLength(page)).toBe(before);
      await expect(notice(page)).toHaveText('');
      await expect(status(page)).toHaveText('');
      await expect(target).toBeFocused();
    });

    test('with 19 exclusions the buttons are enabled and a press takes the group to 20 and the cap', async ({ page }) => {
      await open(page, capPath(19));
      await expect(capText(page)).toHaveCount(0);
      await expect(page.locator('[data-peer-action][aria-disabled]')).toHaveCount(0);
      const before = await historyLength(page);
      const peer = group0[19]?.orgnr ?? '';
      await action(page, peer).click();
      await expect.poll(() => shown(page)).toBe(capPath(20));
      expect(await historyLength(page)).toBe(before + 1);
      await expect(capText(page)).toHaveText(nb['peers.exclusionCap']);
      await expect(action(page, group0[20]?.orgnr ?? '')).toHaveAttribute('aria-disabled', 'true');
      await expect(notice(page)).toHaveText('');
      // Restoring one lifts the cap.
      await action(page, peer).click();
      await expect.poll(() => shown(page)).toBe(capPath(19));
      await expect(capText(page)).toHaveCount(0);
      await expect(page.locator('[data-peer-action][aria-disabled]')).toHaveCount(0);
    });

    test('a second exclude pressed while the 20th is in flight is refused', async ({ page }) => {
      await open(page, capPath(19));
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        (url) => url.pathname.startsWith('/analyse/'),
        async (route: Route) => {
          if (route.request().headers()['rsc'] === '1') await held;
          await route.continue();
        },
      );
      const before = await historyLength(page);
      const requests = pushes(page);
      await action(page, group0[19]?.orgnr ?? '').click();
      // The page still shows 19: this button is not yet aria-disabled.
      const late = action(page, group0[20]?.orgnr ?? '');
      await expect(late).not.toHaveAttribute('aria-disabled');
      await late.click();
      release();
      await expect.poll(() => shown(page)).toBe(capPath(20));
      await page.waitForTimeout(250);
      // One push, the 20th: the second press made no request.
      expect(requests.map((url) => new URL(url).searchParams.get('ekskl'))).toEqual([ekskl(20).join(',')]);
      expect(ekskOf(page)).not.toContain(group0[20]?.orgnr);
      expect(shown(page)).toBe(capPath(20));
      expect(await historyLength(page)).toBe(before + 1);
      await expect(notice(page)).toHaveText('');
    });
  });

  for (const width of [375, 320]) {
    test(`at ${width} px every Story 2.8 state fits: no sideways body scroll, the band control a three-column grid`, async ({
      page,
    }) => {
      // Widened, with an excluded peer.
      const peer = group1[0]?.orgnr ?? '';
      await open(page, `${PEERS}?ekskl=${peer}&band=1`, width);
      await expect(page.getByTestId('widened-block')).toBeVisible();
      await expect(page.locator('[data-testid="peer-card"][data-excluded="true"]:visible')).toHaveCount(1);
      await noSidewaysScroll(page);
      const steps = await page.locator('[role="radio"]').evaluateAll((items) =>
        items.map((item) => {
          const box = item.getBoundingClientRect();
          return { top: Math.round(box.top), left: box.left, right: box.right, height: box.height };
        }),
      );
      expect(steps).toHaveLength(3);
      expect(new Set(steps.map((step) => step.top)).size).toBe(1);
      expect(steps[0]?.left ?? 0).toBeLessThan(steps[1]?.left ?? 0);
      expect(steps[2]?.right ?? width).toBeLessThanOrEqual(width - 16 + 1);
      for (const step of steps) expect(step.height).toBeGreaterThanOrEqual(44);
      // Every target at least 24 × 24 px.
      const small = await page.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>('main a, main button, main [tabindex="0"]')]
            .filter((el) => el.offsetParent !== null)
            .map((el) => el.getBoundingClientRect())
            .filter((box) => box.width < 24 || box.height < 24).length,
      );
      expect(small).toBe(0);

      // Too small, below the floor.
      const subject = floorSubject();
      const group = expectedGroup(subject, 0);
      const ekskl = group
        .slice(0, group.length - 9)
        .map((p) => p.orgnr)
        .sort()
        .join(',');
      await open(page, `${peersPath(subject)}?ekskl=${ekskl}`, width);
      await expect(page.getByTestId('too-small-block')).toBeVisible();
      await noSidewaysScroll(page);

      // Story 2.10: the exclusion cap, its text and the aria-disabled actions.
      // The last 20 are excluded, so the first phone cards are not excluded
      // and show an aria-disabled "Ekskluder".
      const twenty = group0
        .slice(-20)
        .map((p) => p.orgnr)
        .sort()
        .join(',');
      await open(page, `${PEERS}?ekskl=${twenty}`, width);
      await expect(page.getByTestId('exclusion-cap')).toBeVisible();
      await expect(page.locator('[data-peer-action]:visible[aria-disabled="true"]').first()).toBeVisible();
      await noSidewaysScroll(page);
    });
  }
});
