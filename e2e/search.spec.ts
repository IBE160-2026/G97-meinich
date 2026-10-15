// The front page and its search (Story 1.5b), against the production build
// and the loaded demo seed. The analysis pages arrive in Story 1.6b, so a
// navigation is checked by its URL only.
import { expect, test, type Page } from '@playwright/test';
import nb from '../src/messages/nb.json' with { type: 'json' };

const ADMMIT = '813235552'; // demo company A; a covered company in the seed
const UNKNOWN = '910000004'; // valid modulus 11, not in the seed
const MISTYPED = '813235553';

const combobox = (page: Page) => page.getByRole('combobox', { name: nb['search.label'] });
const status = (page: Page) => page.locator('main [role="status"]');
const alert = (page: Page) => page.locator('main [role="alert"]');
const submit = (page: Page) => page.getByRole('button', { name: nb['search.submit'] });

// Every request to /api/sok the page makes.
function trackSearches(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/sok') urls.push(request.url());
  });
  return urls;
}

test.describe('front page', () => {
  test('has the title, one headline, the coverage sentence, three steps and the about link', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Peerless');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(nb['front.title']);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // The industry comes from register.covered_industry and the register's name.
    await expect(page.getByText('Peerless dekker foreløpig 62.100 Dataprogrammeringstjenester.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: nb['front.steps.title'] })).toBeVisible();
    const steps = page.locator('main ol > li');
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText(nb['front.steps.1.title']);
    await expect(steps.nth(0)).toContainText(nb['front.steps.1.body']);
    await expect(page.getByRole('link', { name: nb['front.howLink'] })).toHaveAttribute('href', '/slik-fungerer-peerless');
    // The header carries no search on the front page; there is no SaaS button.
    await expect(page.getByRole('banner').getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(1);
    await expect(page.getByText(/Kom i gang/i)).toHaveCount(0);
  });

  test('the footer links "Kilder og lisens" to the sources section', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText(`${nb['footer.source']} · ${nb['footer.sources']}`);
    await expect(footer.getByRole('link', { name: nb['footer.sources'] })).toHaveAttribute(
      'href',
      '/slik-fungerer-peerless#kilder',
    );
  });

  test('the live region and the alert are present and empty on load', async ({ page }) => {
    await page.goto('/');
    await expect(status(page)).toHaveCount(1);
    await expect(status(page)).toHaveText('');
    await expect(alert(page)).toHaveCount(1);
    await expect(alert(page)).toHaveText('');
    await expect(combobox(page)).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('typing', () => {
  test('searches once after a pause and lists the results in the combobox', async ({ page }) => {
    const searches = trackSearches(page);
    await page.goto('/');
    await combobox(page).pressSequentially('admm', { delay: 40 });
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await expect(combobox(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(combobox(page)).toHaveAttribute('aria-controls', (await listbox.getAttribute('id')) ?? '');
    const options = listbox.getByRole('option');
    await expect(options.first()).toContainText('ADMMIT AS');
    await expect(options.first()).toContainText('813 235 552 · 62.100 Dataprogrammeringstjenester · Vindafjord');
    expect(await options.count()).toBeLessThanOrEqual(8);
    await expect(status(page)).toHaveText(`${await options.count()} treff`);
    // One request for the whole word, and nothing navigated.
    expect(searches).toHaveLength(1);
    await expect(page).toHaveURL('/');
  });

  test('arrow keys move, Escape closes, Enter opens the active result', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill('admmit');
    const first = page.getByRole('option').first();
    await expect(first).toBeVisible();
    await expect(combobox(page)).not.toHaveAttribute('aria-activedescendant', /.+/);

    await combobox(page).press('ArrowDown');
    await expect(combobox(page)).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id')) ?? '');
    await expect(first).toHaveAttribute('aria-selected', 'true');

    await combobox(page).press('Escape');
    await expect(combobox(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toBeHidden();

    await combobox(page).press('ArrowDown');
    await expect(combobox(page)).toHaveAttribute('aria-expanded', 'true');
    await combobox(page).press('Enter');
    await page.waitForURL(`**/analyse/${ADMMIT}`);
  });

  test('a click on a result opens it', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill('admmit');
    await page.getByRole('option', { name: /ADMMIT AS/ }).click();
    await page.waitForURL(`**/analyse/${ADMMIT}`);
  });

  test('typing the ninth digit opens nothing; fewer digits make no request and no error', async ({ page }) => {
    const searches = trackSearches(page);
    await page.goto('/');
    await combobox(page).pressSequentially('81323555', { delay: 20 });
    await page.waitForTimeout(600);
    expect(searches).toHaveLength(0);
    await expect(combobox(page)).not.toHaveAttribute('aria-invalid', 'true');
    await expect(status(page)).toHaveText('');

    await combobox(page).press('2');
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.waitForTimeout(400);
    await expect(page).toHaveURL('/');
  });

  test('folds accents: "algard" finds ÅLGÅRD DATA AS', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill('algard');
    await expect(page.getByRole('option', { name: /ÅLGÅRD DATA AS/ })).toBeVisible();
  });

  test('a result without a municipality shows orgnr and industry only', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill('fujitsu finland');
    const option = page.getByRole('option', { name: /FUJITSU FINLAND OY/ });
    await expect(option).toContainText('811 873 772 · 62.100 Dataprogrammeringstjenester');
    await expect(option).not.toContainText('Dataprogrammeringstjenester ·');
  });

  test('a result without an industry name shows the code alone', async ({ page }) => {
    // 920768695 KIRKEBY GÅRDSDRIFT: stored under 62.100 with a NULL
    // naeringskode1_beskrivelse (Story 1.5a), municipality BÆRUM.
    await page.goto('/');
    await combobox(page).fill('920768695');
    const option = page.getByRole('option', { name: /KIRKEBY GÅRDSDRIFT/ });
    await expect(option.locator('span').nth(1)).toHaveText('920 768 695 · 62.100 · Bærum');
  });
});

test.describe('submit', () => {
  test('a nine-digit orgnr that matches exactly goes straight to the analysis', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill('813 235 552');
    await submit(page).click();
    await page.waitForURL(`**/analyse/${ADMMIT}`);
  });

  test('a valid orgnr not in the database shows the not-in-database copy and the demo links', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill(UNKNOWN);
    await combobox(page).press('Enter');
    await expect(status(page)).toHaveText(
      'Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi dataprogrammeringstjenester (62.100).',
    );
    await expect(page.getByRole('link', { name: 'ADMMIT AS' })).toHaveAttribute('href', '/analyse/813235552');
    await expect(page.getByRole('link', { name: 'EXEBENUS AS' })).toHaveAttribute('href', '/analyse/814739082');
    await expect(page).toHaveURL('/');
  });

  test('a name with no match shows the no-match copy in the live region and the demo links', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill('zzqxjvw');
    await submit(page).click();
    await expect(status(page)).toHaveText(
      'Ingen treff på «zzqxjvw». Peerless har foreløpig bare selskaper i dataprogrammeringstjenester (62.100).',
    );
    await expect(page.getByRole('link', { name: 'ADMMIT AS' })).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);
  });

  test('an empty field shows the empty message and makes no request', async ({ page }) => {
    const searches = trackSearches(page);
    await page.goto('/');
    await combobox(page).fill('   ');
    await submit(page).click();
    await expect(status(page)).toHaveText(nb['search.empty']);
    expect(searches).toHaveLength(0);
  });

  for (const [input, message] of [
    [MISTYPED, nb['search.orgnrChecksum']],
    ['81323555', nb['search.orgnrLength']],
    ['8132355520', nb['search.orgnrLength']],
  ] as const) {
    test(`"${input}" shows "${message}" with the error state, and no request`, async ({ page }) => {
      const searches = trackSearches(page);
      await page.goto('/');
      await combobox(page).fill(input);
      await expect(combobox(page)).not.toHaveAttribute('aria-invalid', 'true');
      await submit(page).click();
      const field = combobox(page);
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      const describedBy = await field.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(message);
      await expect(status(page)).toContainText(message);
      expect(await field.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('2px');
      expect(searches).toHaveLength(0);
    });
  }

  test('validates on blur, not while typing', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill(MISTYPED);
    await page.waitForTimeout(400);
    await expect(combobox(page)).not.toHaveAttribute('aria-invalid', 'true');
    await combobox(page).blur();
    await expect(combobox(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(status(page)).toHaveText(nb['search.orgnrChecksum']);
  });

  test('a name containing digits is a name search', async ({ page }) => {
    await page.goto('/');
    await combobox(page).fill('1881 Media');
    await submit(page).click();
    await expect(combobox(page)).not.toHaveAttribute('aria-invalid', 'true');
    await expect(status(page)).not.toContainText(nb['search.orgnrLength']);
  });

  test('loading: the field is read-only, the button disabled and "Henter analysen …" announced', async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/sok**', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/');
    await combobox(page).fill(UNKNOWN);
    await submit(page).click();
    await expect(status(page)).toHaveText(nb['search.loading']);
    await expect(combobox(page)).toHaveAttribute('readonly', '');
    await expect(submit(page)).toBeDisabled();
    release();
    await expect(status(page)).toContainText('Peerless har ikke data');
    await expect(submit(page)).toBeEnabled();
  });
});

test.describe('failure', () => {
  test('a failed request shows the alert and no results', async ({ page }) => {
    await page.route('**/api/sok**', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/');
    await combobox(page).fill('admmit');
    await expect(alert(page)).toHaveText(nb['search.failed']);
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(combobox(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('a network error on submit shows the alert', async ({ page }) => {
    await page.route('**/api/sok**', (route) => route.abort());
    await page.goto('/');
    await combobox(page).fill(ADMMIT);
    await submit(page).click();
    await expect(alert(page)).toHaveText(nb['search.failed']);
    await expect(page).toHaveURL('/');
  });
});

test.describe('the API', () => {
  test('answers 400 for q over 100 characters and for a mistyped orgnr', async ({ request }) => {
    expect((await request.get(`/api/sok?q=${'a'.repeat(101)}`)).status()).toBe(400);
    expect((await request.get(`/api/sok?q=${MISTYPED}`)).status()).toBe(400);
  });

  // Two characters, so the query gets past the route's two-character minimum
  // and reaches the LIKE escaping. A single "%" returns [] before any query.
  for (const query of ['%%', '_%']) {
    test(`"${query}" does not return every company`, async ({ request }) => {
      const response = await request.get(`/api/sok?q=${encodeURIComponent(query)}`);
      expect(response.status()).toBe(200);
      const rows = (await response.json()) as { navn: string }[];
      expect(rows.length).toBeLessThan(8);
      for (const row of rows) expect(row.navn).toContain(query);
    });
  }

  test('accepts no method but GET', async ({ request }) => {
    expect((await request.post('/api/sok?q=admmit')).status()).toBe(405);
  });
});

for (const width of [375, 320]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('the field and a full-width button stack, the steps stack, targets are at least 24 px, no sideways scroll', async ({
      page,
    }) => {
      await page.goto('/');
      const field = await combobox(page).boundingBox();
      const button = await submit(page).boundingBox();
      if (field === null || button === null) throw new Error('field or button not rendered');
      expect(button.y).toBeGreaterThanOrEqual(field.y + field.height);
      expect(Math.abs(button.width - field.width)).toBeLessThanOrEqual(1);
      expect(field.height).toBe(56);
      expect(button.height).toBe(52);

      const steps = page.locator('main ol > li');
      const boxes = await steps.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON()));
      for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y + boxes[i - 1].height - 1);

      // With the results list and the no-match state open as well.
      await combobox(page).fill('data');
      await expect(page.getByRole('option').first()).toBeVisible();

      const targets = page.locator('main a, main button, main input, footer a, [role="option"]');
      for (const box of await targets.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
        expect(box.width).toBeGreaterThanOrEqual(24);
        expect(box.height).toBeGreaterThanOrEqual(24);
      }

      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.innerWidth);
      expect(scroll.bodyScrollWidth).toBeLessThanOrEqual(scroll.innerWidth);

      await combobox(page).fill('zzqxjvw');
      await submit(page).click();
      await expect(page.getByRole('link', { name: 'EXEBENUS AS' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}

test('on desktop the field and button sit side by side and the steps in three columns', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  const field = await combobox(page).boundingBox();
  const button = await submit(page).boundingBox();
  if (field === null || button === null) throw new Error('field or button not rendered');
  expect(field.height).toBe(60);
  expect(Math.abs(button.y - field.y)).toBeLessThanOrEqual(1);
  const ys = await page.locator('main ol > li').evaluateAll((items) => items.map((i) => i.getBoundingClientRect().y));
  expect(new Set(ys).size).toBe(1);
});
