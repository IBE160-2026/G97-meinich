// The analysis route in every state (Stories 1.6b to 1.9), against the
// production build and the loaded demo seed: the specs' I/O matrices
// (covered, uncovered, non-AS, no filing, not found, invalid orgnr), titles,
// tabs and their history and focus, the invalid-settings notice, the header
// search, "Slik fungerer Peerless", and no storage and no sideways scroll in
// any state. The Peers tab, the key-figure table and the Oversikt hero have
// specs of their own.
// The lookup-error state (a failing database) is covered by
// test/analysis-shell.test.ts: the build cannot be made to fail its reads here.
import { expect, test } from './fixtures.ts';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { formatKommune, formatOrgnr } from '../src/engine/format.ts';
import {
  A,
  ABSENT,
  C,
  C_ORGNR,
  NON_AS,
  NON_AS_NO_FILING,
  NO_FILING,
  coverageSentence,
  dataDate,
  h1,
  headerSearch,
  noSidewaysScroll,
  notice,
  rendered,
  revenue,
  tabs,
} from './seed.ts';

test.describe('covered company', () => {
  test('the bare path answers 307 to Oversikt, keeping the query', async ({ request }) => {
    const bare = await request.get(`/analyse/${A.orgnr}`, { maxRedirects: 0 });
    expect(bare.status()).toBe(307);
    expect(new URL(bare.headers().location ?? '', 'http://x').pathname).toBe(`/analyse/${A.orgnr}/oversikt`);
    const withQuery = await request.get(`/analyse/${A.orgnr}?band=1&utm_source=x`, { maxRedirects: 0 });
    expect(withQuery.status()).toBe(307);
    expect(withQuery.headers().location).toMatch(new RegExp(`/analyse/${A.orgnr}/oversikt\\?band=1$`));
    // A value that falls back is kept as it came, so the target shows the notice.
    const invalid = await request.get(`/analyse/${A.orgnr}?band=x`, { maxRedirects: 0 });
    expect(invalid.headers().location).toMatch(new RegExp(`/analyse/${A.orgnr}/oversikt\\?band=x$`));
  });

  test('shows the company header, three tabs and the title', async ({ page }) => {
    await page.goto(`/analyse/${A.orgnr}`);
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/oversikt$`));
    await expect(page).toHaveTitle(`${A.navn} – Oversikt – Peerless`);
    await expect(h1(page)).toHaveText(A.navn ?? '');
    const meta = page.getByTestId('company-meta');
    await expect(meta).toContainText(formatOrgnr(A.orgnr ?? ''));
    await expect(meta).toContainText(`${A.naeringskode1} ${A.naeringskode1_beskrivelse}`);
    await expect(meta).toContainText(revenue(A.orgnr ?? ''));
    await expect(meta).toContainText(dataDate(A.orgnr ?? ''));

    const links = tabs(page).getByRole('link');
    await expect(links).toHaveText([nb['tabs.oversikt'], nb['tabs.peers'], nb['tabs.nokkeltall']]);
    await expect(tabs(page).getByRole('link', { name: 'Verdi' })).toHaveCount(0);
    await expect(links.nth(0)).toHaveAttribute('aria-current', 'page');
    await expect(links.nth(1)).not.toHaveAttribute('aria-current', /.*/);
    await expect(page.getByRole('heading', { level: 2, name: nb['tabs.oversikt'] })).toBeVisible();
    await expect(notice(page)).toHaveText('');
  });

  test('a tab change pushes history, keeps the settings and focuses the panel heading; Back returns', async ({ page }) => {
    await page.goto(`/analyse/${A.orgnr}/oversikt?band=1`);
    await tabs(page).getByRole('link', { name: nb['tabs.peers'] }).click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/peers\\?band=1$`));
    await expect(page).toHaveTitle(`${A.navn} – Peers – Peerless`);
    await expect(page.getByRole('heading', { level: 2, name: nb['tabs.peers'] })).toBeFocused();
    await expect(tabs(page).getByRole('link', { name: nb['tabs.peers'] })).toHaveAttribute('aria-current', 'page');

    await tabs(page).getByRole('link', { name: nb['tabs.nokkeltall'] }).click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/nokkeltall\\?band=1$`));
    await expect(page).toHaveTitle(`${A.navn} – Nøkkeltall og gap – Peerless`);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/peers\\?band=1$`));
    await expect(page.getByRole('heading', { level: 2, name: nb['tabs.peers'] })).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/oversikt\\?band=1$`));
  });

  test('a route change to another company focuses its h1', async ({ page }) => {
    await page.goto(`/analyse/${A.orgnr}/oversikt`);
    await headerSearch(page).fill(C.orgnr ?? '');
    await headerSearch(page).press('Enter');
    await expect(page).toHaveURL(new RegExp(`/analyse/${C.orgnr}$`));
    await expect(h1(page)).toHaveText(C.navn ?? '');
    await expect(h1(page)).toBeFocused();
  });

  test('a setting that fell back shows the notice once, and the tab still renders', async ({ page }) => {
    await page.goto(`/analyse/${A.orgnr}/peers?band=x`);
    await expect(notice(page)).toHaveText(nb['analysis.notice']);
    await expect(page.locator('[data-testid="settings-notice"] p')).toHaveCount(1);
    await expect(tabs(page).getByRole('link', { name: nb['tabs.peers'] })).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(new RegExp(`/peers\\?band=x$`));
  });

  for (const fane of ['verdi', 'foo']) {
    test(`/${fane} renders Oversikt with the notice and no redirect`, async ({ page, request }) => {
      expect((await request.get(`/analyse/${A.orgnr}/${fane}`, { maxRedirects: 0 })).status()).toBe(200);
      await page.goto(`/analyse/${A.orgnr}/${fane}`);
      await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/${fane}$`));
      await expect(page).toHaveTitle(`${A.navn} – Oversikt – Peerless`);
      await expect(tabs(page).getByRole('link', { name: nb['tabs.oversikt'] })).toHaveAttribute('aria-current', 'page');
      await expect(notice(page)).toHaveText(nb['analysis.notice']);
    });
  }
});

test.describe('uncovered company (demo company C)', () => {
  test('shows the header, the State block, three API figures and the search link; no tabs', async ({ page }) => {
    const response = await page.goto(`/analyse/${C.orgnr}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(`${C.navn} – Peerless`);
    await expect(h1(page)).toHaveText(C.navn ?? '');
    await expect(page.getByTestId('company-meta')).toContainText(revenue(C.orgnr ?? ''));
    await expect(page.getByTestId('company-meta')).toContainText(dataDate(C.orgnr ?? ''));
    await expect(tabs(page)).toHaveCount(0);

    const block = page.getByTestId('state-block');
    await expect(block).toContainText(nb['analysis.uncovered.kicker'], { ignoreCase: true });
    await expect(block).toContainText(
      `${C.naeringskode1_beskrivelse} (${C.naeringskode1}) er ikke dekket ennå. Foreløpig sammenligner Peerless bare selskaper innen ${coverageSentence}. Her er selskapets egne nøkkeltall fra Brønnøysundregistrene.`,
    );
    for (const key of ['driftsmargin', 'totalkapitalrentabilitet', 'egenkapitalandel']) {
      // One decimal, a decimal comma and U+00A0 before "%" (format.ts).
      await expect(page.getByTestId(`figure-${key}`)).toHaveText(/^−?\d+,\d %$/);
    }
    await expect(page.getByText(nb['analysis.figures.noPeers'])).toBeVisible();
    await expect(page.getByRole('link', { name: nb['analysis.searchAgain'] })).toHaveAttribute('href', '/');
    // No peer group, median, beste fjerdedel, Plassering or kroner gap.
    // (The note above names them only to say they are not shown.)
    await expect(page.locator('main dl')).toHaveCount(1);
    await expect(page.locator('main dl')).not.toContainText(/median|beste fjerdedel|Plassering|bedre enn/i);
    await expect(page.locator('main dt')).toHaveCount(3);
    await expect(page.locator('main section')).not.toContainText(/\bkr\b/);
  });

  test('a tab redirects (307) to the bare path, keeping the query', async ({ request }) => {
    const response = await request.get(`/analyse/${C.orgnr}/peers?band=2`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(new RegExp(`/analyse/${C.orgnr}\\?band=2$`));
  });
});

test.describe('ekskl on a subject with no pool', () => {
  for (const [label, orgnr] of [
    ['uncovered (demo C)', C_ORGNR],
    ['non-AS', NON_AS.orgnr ?? ''],
  ] as const) {
    test(`${label}: the bare path with an ekskl shows the notice`, async ({ page }) => {
      await page.goto(`/analyse/${orgnr}?ekskl=${A.orgnr}`);
      await expect(notice(page)).toHaveText(nb['analysis.notice']);
    });
  }
});

test.describe('non-AS company in a covered industry', () => {
  test('shows the header, the non-AS State block, three API figures and the search link; no tabs, no count', async ({ page }) => {
    const response = await page.goto(`/analyse/${NON_AS.orgnr}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(`${NON_AS.navn} – Peerless`);
    await expect(h1(page)).toHaveText(NON_AS.navn ?? '');
    await expect(page.getByTestId('company-meta')).toContainText(dataDate(NON_AS.orgnr ?? ''));
    await expect(page.getByTestId('company-meta')).not.toContainText('sammenlignbare');
    await expect(tabs(page)).toHaveCount(0);
    const block = page.getByTestId('state-block');
    await expect(block).toContainText(nb['analysis.nonAs.kicker'], { ignoreCase: true });
    await expect(block).toContainText(nb['analysis.nonAs.body']);
    await expect(page.locator('main dt')).toHaveCount(3);
    await expect(page.getByText(nb['analysis.figures.noPeers'])).toBeVisible();
    await expect(page.getByRole('link', { name: nb['analysis.searchAgain'] })).toHaveAttribute('href', '/');
    await noSidewaysScroll(page);
  });

  test('a tab redirects (307) to the bare path', async ({ request }) => {
    const response = await request.get(`/analyse/${NON_AS.orgnr}/peers`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(new RegExp(`/analyse/${NON_AS.orgnr}$`));
  });

  test('without a filing it is in the no-filing state', async ({ page }) => {
    const response = await page.goto(`/analyse/${NON_AS_NO_FILING.orgnr}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('state-block')).toHaveText(nb['analysis.noFiling']);
    await expect(tabs(page)).toHaveCount(0);
  });
});

test.describe('covered company with no filing', () => {
  test('shows identification only and the no-filing sentence', async ({ page }) => {
    const response = await page.goto(`/analyse/${NO_FILING.orgnr}`);
    expect(response?.status()).toBe(200);
    await expect(h1(page)).toHaveText(NO_FILING.navn ?? '');
    const meta = page.getByTestId('company-meta');
    await expect(meta).toContainText(formatOrgnr(NO_FILING.orgnr ?? ''));
    await expect(meta).toContainText(NO_FILING.naeringskode1 ?? '');
    await expect(meta).toContainText(formatKommune(NO_FILING.forretningsadresse_kommune ?? ''));
    await expect(meta).not.toContainText(/Omsetning|Regnskapsår/);
    await expect(tabs(page)).toHaveCount(0);
    await expect(page.getByTestId('state-block')).toHaveText(nb['analysis.noFiling']);
  });

  test('a tab redirects (307) to the bare path', async ({ request }) => {
    const response = await request.get(`/analyse/${NO_FILING.orgnr}/oversikt`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(new RegExp(`/analyse/${NO_FILING.orgnr}$`));
  });
});

// Neither 404 state is reachable by a client navigation from the UI: the
// search opens only a company it found, and every link points to a page that
// exists. So the router is driven directly (Next.js's window.next.router,
// the same router a Link uses). An unknown path is not covered: for a path
// no route matches, Next.js turns router.push into a full page load (checked
// with a marker on window), so there is no client navigation to test, and a
// full load moves no focus.
test.describe('a client navigation to a 404 state focuses its h1', () => {
  for (const [target, heading] of [[`/analyse/${ABSENT}`, nb['notFound.noDataTitle']]] as const) {
    test(`${target} → "${heading}"`, async ({ page }) => {
      await page.goto(`/analyse/${A.orgnr}/oversikt`);
      await page.waitForFunction(() => (window as { next?: { router?: unknown } }).next?.router !== undefined);
      await page.evaluate((url) => {
        (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(url);
      }, target);
      await expect(page).toHaveURL(new RegExp(`${target}$`));
      // The old page and the 404 can briefly both be in the document.
      await expect(h1(page)).toHaveCount(1);
      await expect(h1(page)).toHaveText(heading);
      await expect(h1(page)).toBeFocused();
    });
  }
});

test('an unknown path answers 404 with the h1 "Fant ikke siden"', async ({ page }) => {
  const response = await page.goto('/finnes-ikke');
  expect(response?.status()).toBe(404);
  await expect(h1(page)).toHaveText(nb['notFound.pageTitle']);
  await expect(page.getByTestId('state-block')).toContainText(nb['notFound.page']);
});

test('a valid orgnr not in the database answers 404 with the not-found state and the demo links', async ({ page }) => {
  const response = await page.goto(`/analyse/${ABSENT}`);
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Peerless');
  await expect(h1(page)).toHaveText(nb['notFound.noDataTitle']);
  const block = page.getByTestId('state-block');
  await expect(block).toContainText(
    `Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi ${coverageSentence}.`,
  );
  for (const demo of DEMO_COMPANIES) {
    await expect(block.getByRole('link', { name: demo.navn })).toHaveAttribute('href', `/analyse/${demo.orgnr}`);
  }
  await expect(headerSearch(page)).toHaveCount(1);
});

for (const [input, message] of [
  ['12345678', nb['search.orgnrLength']],
  ['123456789', nb['search.orgnrChecksum']],
] as const) {
  test(`an invalid orgnr (${input}) answers 404 with the front page and "${message}"`, async ({ page }) => {
    const response = await page.goto(`/analyse/${input}`);
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle('Peerless');
    await expect(h1(page)).toHaveText(nb['front.title']);
    const field = page.locator('main').getByRole('combobox', { name: nb['search.label'] });
    await expect(field).toHaveValue(input);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await field.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(message);
    // The hero search takes the header search's place, as on the front page.
    await expect(headerSearch(page)).toHaveCount(0);
  });
}

test.describe('the header search', () => {
  test('is on every page but the front page', async ({ page }) => {
    await page.goto('/');
    await expect(headerSearch(page)).toHaveCount(0);
    for (const url of [`/analyse/${A.orgnr}/oversikt`, `/analyse/${C.orgnr}`, `/analyse/${NO_FILING.orgnr}`, '/slik-fungerer-peerless']) {
      await page.goto(url);
      await expect(headerSearch(page), url).toHaveCount(1);
    }
  });

  test('takes its accessible name from the label, not the placeholder', async ({ page }) => {
    await page.goto('/slik-fungerer-peerless');
    const field = headerSearch(page);
    await expect(field).toHaveAttribute('placeholder', nb['search.label']);
    await expect(field).toHaveAccessibleName(nb['search.label']);
    await field.evaluate((el) => el.removeAttribute('placeholder'));
    await expect(field).toHaveAccessibleName(nb['search.label']);
  });

  test('can be used twice: the loading state is cleared after each navigation', async ({ page }) => {
    await page.goto(`/analyse/${C.orgnr}`);
    await headerSearch(page).fill('admmit');
    await page.getByRole('banner').getByRole('option', { name: /ADMMIT AS/ }).click();
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/oversikt$`));
    await expect(headerSearch(page)).not.toHaveAttribute('readonly', /.*/);
    await expect(page.getByRole('banner').locator('[role="status"]')).toHaveText('');

    await headerSearch(page).fill(C.orgnr ?? '');
    await headerSearch(page).press('Enter');
    await expect(page).toHaveURL(new RegExp(`/analyse/${C.orgnr}$`));
    await expect(headerSearch(page)).not.toHaveAttribute('readonly', /.*/);
    await expect(page.getByRole('banner').getByRole('button', { name: nb['search.submit'] })).toBeEnabled();
  });

  test('opening the company already shown does not leave it loading', async ({ page }) => {
    await page.goto(`/analyse/${A.orgnr}/oversikt`);
    await headerSearch(page).fill(A.orgnr ?? '');
    await headerSearch(page).press('Enter');
    await expect(page).toHaveURL(new RegExp(`/analyse/${A.orgnr}/oversikt$`));
    await expect(headerSearch(page)).not.toHaveAttribute('readonly', /.*/);
    await expect(page.getByRole('banner').getByRole('button', { name: nb['search.submit'] })).toBeEnabled();
  });
});

test.describe('Slik fungerer Peerless', () => {
  test('has the title, the h1 and only the "Kilder og lisens" section with the accepted copy', async ({ page }) => {
    await page.goto('/slik-fungerer-peerless');
    await expect(page).toHaveTitle('Slik fungerer Peerless – Peerless');
    await expect(h1(page)).toHaveText('Slik fungerer Peerless');
    const headings = page.locator('main h2');
    await expect(headings).toHaveText(['Kilder og lisens']);
    await expect(headings.first()).toHaveAttribute('id', 'kilder');
    const section = page.locator('main section');
    await expect(section).toContainText(nb['about.sources.origin']);
    await expect(page.getByTestId('nlod-credit')).toHaveText(
      'Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene',
    );
    await expect(section.getByRole('link', { name: nb['about.sources.nlodLicence'] })).toHaveAttribute(
      'href',
      'https://data.norge.no/nlod/no/2.0',
    );
    await expect(section.getByRole('link', { name: nb['about.sources.nlodLicensor'] })).toHaveAttribute(
      'href',
      'https://data.brreg.no',
    );
    await expect(section).toContainText(nb['about.sources.processed']);
    await expect(section).toContainText(nb['about.sources.endorsement']);
  });

  test('the header and footer links resolve on every page, the footer link to the section', async ({ page, request }) => {
    for (const url of ['/', `/analyse/${A.orgnr}/peers`, `/analyse/${C.orgnr}`, `/analyse/${ABSENT}`, '/slik-fungerer-peerless']) {
      await page.goto(url);
      const how = page.getByRole('banner').getByRole('link', { name: nb['shell.how'], exact: true });
      await expect(how, url).toHaveAttribute('href', '/slik-fungerer-peerless');
      const sources = page.getByRole('contentinfo').getByRole('link', { name: nb['footer.sources'] });
      await expect(sources, url).toHaveAttribute('href', '/slik-fungerer-peerless#kilder');
    }
    expect((await request.get('/slik-fungerer-peerless')).status()).toBe(200);
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: nb['footer.sources'] }).click();
    await expect(page).toHaveURL(/\/slik-fungerer-peerless#kilder$/);
    await expect(page.locator('#kilder')).toBeInViewport();
    await expect(page.locator('#kilder')).toBeFocused();
  });
});

test('nothing is written to browser storage or cookies in any state', async ({ page, context }) => {
  for (const url of [
    `/analyse/${A.orgnr}`,
    `/analyse/${A.orgnr}/peers?band=x`,
    `/analyse/${C.orgnr}`,
    `/analyse/${NO_FILING.orgnr}`,
    `/analyse/${ABSENT}`,
    '/analyse/12345678',
    '/slik-fungerer-peerless',
  ]) {
    await page.goto(url);
    await expect(rendered(page)).toBeVisible();
  }
  const storage = await page.evaluate(async () => ({
    local: window.localStorage.length,
    session: window.sessionStorage.length,
    databases: (await indexedDB.databases()).length,
  }));
  expect(storage).toEqual({ local: 0, session: 0, databases: 0 });
  expect(await context.cookies()).toEqual([]);
});

for (const width of [375, 320]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('no state scrolls sideways; the header search is a full-width second row at least 200 px wide', async ({ page }) => {
      for (const url of [
        `/analyse/${A.orgnr}/oversikt`,
        `/analyse/${A.orgnr}/peers?band=x`,
        `/analyse/${C.orgnr}`,
        `/analyse/${NO_FILING.orgnr}`,
        `/analyse/${ABSENT}`,
        '/analyse/12345678',
        '/analyse/123456789',
        '/slik-fungerer-peerless',
      ]) {
        await page.goto(url);
        await expect(rendered(page)).toBeVisible();
        await noSidewaysScroll(page);
        if ((await headerSearch(page).count()) > 0) {
          const field = await headerSearch(page).boundingBox();
          const brand = await page.getByRole('banner').getByRole('link', { name: nb['shell.brand'], exact: true }).boundingBox();
          if (field === null || brand === null) throw new Error(`${url}: header not rendered`);
          expect(field.width, url).toBeGreaterThanOrEqual(200);
          expect(field.y, url).toBeGreaterThan(brand.y + brand.height - 1);
        }
      }
    });

    test('the header search button is a 44 px icon named "Sammenlign", and the field keeps 200 px', async ({ page }) => {
      await page.goto(`/analyse/${A.orgnr}/oversikt`);
      const button = page.getByRole('banner').locator('button[type="submit"]');
      await expect(button).toHaveAccessibleName(nb['search.submit']);
      await expect(button.locator('svg')).toBeVisible();
      const box = await button.boundingBox();
      const field = await headerSearch(page).boundingBox();
      if (box === null || field === null) throw new Error('header search not rendered');
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(field.width).toBeGreaterThanOrEqual(200);
    });

    test('the tabs wrap rather than scroll', async ({ page }) => {
      await page.goto(`/analyse/${A.orgnr}/oversikt`);
      const nav = tabs(page);
      const sizes = await nav.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
      await noSidewaysScroll(page);
    });
  });
}

test('on desktop the header search sits inline between the wordmark and the link', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(`/analyse/${A.orgnr}/oversikt`);
  const field = await headerSearch(page).boundingBox();
  const how = await page.getByTestId('header-how').boundingBox();
  if (field === null || how === null) throw new Error('header not rendered');
  expect(Math.abs(field.y + field.height / 2 - (how.y + how.height / 2))).toBeLessThanOrEqual(12);
  expect(field.x + field.width).toBeLessThan(how.x);
});
