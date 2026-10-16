// The rate limit on the open route (Story 1.10), against the production
// build: within budget served; a page, an RSC payload, a prefetch and
// /api/sok refused over budget; the two budgets separate, both ways; a tab
// clicked after the budget ran out ends on the refusal page; the search
// field's alert; the refusal page at 375 and 320 px. Each test has its own
// X-Forwarded-For (e2e/fixtures.ts), so its budgets are its own.
// The window ending is tested with a fake clock (test/rate-limit.test.ts,
// test/proxy.test.ts); that no address is stored, in e2e/no-ip-stored.spec.ts.
import type { APIRequestContext, Page } from '@playwright/test';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { BUDGETS } from '../src/rate-limit/budgets.ts';
import { expect, test, uniqueAddress } from './fixtures.ts';

const ORGNR = '813235552'; // demo company A, covered in the seed
const OVERSIKT = `/analyse/${ORGNR}/oversikt`;
const CHEAP_PAGE = '/slik-fungerer-peerless';

// Each test sends a budget's worth of requests, alongside the rest of the suite.
test.describe.configure({ timeout: 120_000 });

/**
 * Sends requests on `path` until one is refused, and returns how many were
 * served first. Stops after twice the budget, so a limiter that never
 * refuses fails the test instead of hanging it.
 */
async function exhaust(request: APIRequestContext, path: string, limit: number): Promise<number> {
  for (let served = 0; served < 2 * limit; served += 1) {
    const response = await request.get(path, { maxRedirects: 0 });
    if (response.status() === 429) return served;
    expect(response.status(), `${path} after ${served}`).toBeLessThan(400);
  }
  throw new Error(`${path} was never refused`);
}

const exhaustAnalysis = (request: APIRequestContext) => exhaust(request, CHEAP_PAGE, BUDGETS.analysis.limit);
// One character is too short to search on: the route answers [] without a
// query, but the proxy has counted the request all the same.
const exhaustSearch = (request: APIRequestContext) => exhaust(request, '/api/sok?q=a', BUDGETS.search.limit);

async function expectRefusalPage(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb');
  await expect(page.getByRole('alert')).toHaveText(nb['rateLimit.refused']);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nb['rateLimit.title']);
  await expect(page).toHaveTitle(nb['rateLimit.pageTitle']);
  // No figure, no orgnr, no part of an analysis, no search.
  expect(await page.locator('body').innerText()).not.toMatch(/\d/);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
}

test('serves an address its whole analysis budget, then refuses the page with the refusal and no figure', async ({
  page,
  request,
}) => {
  for (let i = 0; i < BUDGETS.analysis.limit; i += 1) {
    expect((await request.get(CHEAP_PAGE)).status(), `request ${i + 1}`).toBe(200);
  }
  const refused = await request.get(OVERSIKT);
  expect(refused.status()).toBe(429);
  expect(refused.headers()['cache-control']).toBe('no-store');
  expect(Number(refused.headers()['retry-after'])).toBeGreaterThanOrEqual(1);
  const body = await refused.text();
  expect(body).toContain(`<p role="alert">${nb['rateLimit.refused']}</p>`);
  expect(body).not.toContain(ORGNR);

  const shown = await page.goto(OVERSIKT);
  expect(shown?.status()).toBe(429);
  await expectRefusalPage(page);
});

test('refuses an RSC payload and a prefetch over budget', async ({ request }) => {
  await exhaustAnalysis(request);
  const variants: Record<string, string>[] = [{ RSC: '1' }, { RSC: '1', 'Next-Router-Prefetch': '1' }];
  for (const headers of variants) {
    const response = await request.get(`/analyse/${ORGNR}/peers`, { headers });
    expect(response.status(), JSON.stringify(headers)).toBe(429);
    const body = await response.text();
    expect(body).toContain(nb['rateLimit.refused']);
    expect(body).not.toContain(ORGNR);
  }
});

test('serves /api/sok its budget, then refuses it with {} and no results', async ({ request }) => {
  expect(await exhaustSearch(request)).toBe(BUDGETS.search.limit);
  const refused = await request.get(`/api/sok?q=${ORGNR}`);
  expect(refused.status()).toBe(429);
  expect(refused.headers()['cache-control']).toBe('no-store');
  expect(await refused.text()).toBe('{}');
});

test('an exhausted search budget leaves the analysis served', async ({ page, request }) => {
  await exhaustSearch(request);
  const shown = await page.goto(OVERSIKT);
  expect(shown?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ADMMIT');
});

test('an exhausted analysis budget leaves the search served', async ({ request }) => {
  await exhaustAnalysis(request);
  const search = await request.get('/api/sok?q=admmit');
  expect(search.status()).toBe(200);
  expect(((await search.json()) as { orgnr: string }[]).map((row) => row.orgnr)).toContain(ORGNR);
});

test('another address is served while an exhausted one stays refused', async ({ playwright, request }) => {
  await exhaustAnalysis(request);
  const other = await playwright.request.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': uniqueAddress() } });
  try {
    expect((await other.get(CHEAP_PAGE)).status()).toBe(200);
  } finally {
    await other.dispose();
  }
  expect((await request.get(CHEAP_PAGE)).status()).toBe(429);
});

test('a tab clicked after the budget ran out ends on the refusal page', async ({ page, request }) => {
  await page.goto(OVERSIKT);
  await expect(page.getByRole('navigation', { name: nb['tabs.label'] })).toBeVisible();
  await exhaustAnalysis(request);
  await page.getByRole('navigation', { name: nb['tabs.label'] }).getByRole('link', { name: nb['tabs.peers'] }).click();
  await expect(page).toHaveURL(new RegExp(`/analyse/${ORGNR}/peers$`));
  await expectRefusalPage(page);
});

test('the search field shows the refusal in its alert, and no results', async ({ page, request }) => {
  await page.goto('/');
  await exhaustSearch(request);
  await page.getByRole('combobox', { name: nb['search.label'] }).fill('admmit');
  await expect(page.locator('main [role="alert"]')).toHaveText(nb['rateLimit.refused']);
  await expect(page.getByRole('option')).toHaveCount(0);
  await page.getByRole('button', { name: nb['search.submit'] }).click();
  await expect(page.locator('main [role="alert"]')).toHaveText(nb['rateLimit.refused']);
  await expect(page).toHaveURL(/\/$/);
});

for (const width of [375, 320]) {
  test.describe(`the refusal page at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('does not scroll sideways', async ({ page, request }) => {
      await exhaustAnalysis(request);
      expect((await page.goto(OVERSIKT))?.status()).toBe(429);
      await expectRefusalPage(page);
      const scroll = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll.doc).toBeLessThanOrEqual(scroll.inner);
      expect(scroll.body).toBeLessThanOrEqual(scroll.inner);
    });
  });
}
