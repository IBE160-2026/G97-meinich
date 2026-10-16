// The analysis route in every state (Stories 1.6b and 1.7), against the
// production build and the loaded demo seed: the specs' I/O matrices
// (covered, uncovered, non-AS, no filing, not found, invalid orgnr), the
// peer group on the header and the Peers tab, `ekskl` against the pool,
// titles, tabs and their history and
// focus, the invalid-settings notice, the header search, "Slik fungerer
// Peerless", and no storage and no sideways scroll in any state. The orgnrs
// come from the seed CSVs and ingest/config.toml, not from literals.
// The lookup-error state (a failing database) is covered by
// test/analysis-shell.test.ts: the build cannot be made to fail its reads here.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { formatKommune, formatMillions, formatOrgnr, formatReadDate } from '../src/engine/format.ts';
import { assemblePeerGroup, type CandidateFiling, type SizeBand, type SubjectFiling } from '../src/engine/peers.ts';
import { parseCsv } from '../scripts/seed-format.ts';

const root = path.resolve(import.meta.dirname, '..');

function csv(name: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(readFileSync(path.join(root, 'seed/demo', name), 'utf8'));
  if (header === undefined) throw new Error(`${name} is empty`);
  return rows
    .filter((row) => row.length === header.length)
    .map((row) => Object.fromEntries(header.map((column, i) => [column, row[i] ?? ''])));
}

/** A timestamptz as COPY writes it ("2026-10-11 10:09:57.319216+00") → Date. */
function timestamp(text: string): Date {
  return new Date(text.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
}

const covered = new Set(
  (JSON.parse(readFileSync(path.join(root, 'seed/coverage.json'), 'utf8')) as { code: string }[]).map((e) => e.code),
);
const companies = csv('company.csv');
const filings = csv('filing.csv').filter((f) => f.regnskapstype === 'SELSKAP');
const keyFigures = new Map(csv('key_figures.csv').map((k) => [k.brreg_id, k]));
const withFiling = new Set(filings.map((f) => f.orgnr));

// The subject's filing as SUBJECT_SQL picks it: newest filing_year, then
// periode_til, periode_fra and brreg_id, each descending.
const filingOrder = (a: Record<string, string>, b: Record<string, string>): number =>
  Number(b.filing_year) - Number(a.filing_year) ||
  (b.periode_til ?? '').localeCompare(a.periode_til ?? '') ||
  (b.periode_fra ?? '').localeCompare(a.periode_fra ?? '') ||
  (BigInt(b.brreg_id ?? '0') > BigInt(a.brreg_id ?? '0') ? 1 : BigInt(b.brreg_id ?? '0') < BigInt(a.brreg_id ?? '0') ? -1 : 0);

function newestFiling(orgnr: string): Record<string, string> {
  const own = filings.filter((f) => f.orgnr === orgnr).sort(filingOrder);
  if (own[0] === undefined) throw new Error(`${orgnr} has no filing in the seed`);
  return own[0];
}

function company(orgnr: string): Record<string, string> {
  const found = companies.find((c) => c.orgnr === orgnr);
  if (found === undefined) throw new Error(`${orgnr} is not in the seed`);
  return found;
}

// Demo company A: covered, with a NOK filing (test/db/demo-companies.test.ts).
const A = company(DEMO_COMPANIES[0].orgnr);
// Demo company C: chosen in Story 1.3a, read from step 1's configuration.
const C_ORGNR = /\[demo_company_c\][^[]*?orgnr\s*=\s*"(\d{9})"/.exec(
  readFileSync(path.join(root, 'ingest/config.toml'), 'utf8'),
)?.[1];
if (C_ORGNR === undefined) throw new Error('no [demo_company_c] orgnr in ingest/config.toml');
const C = company(C_ORGNR);
// A covered company with no SELSKAP filing and a municipality.
const NO_FILING = companies.find(
  (c) => covered.has(c.naeringskode1 ?? '') && !withFiling.has(c.orgnr ?? '') && c.forretningsadresse_kommune !== '',
);
if (NO_FILING === undefined) throw new Error('no covered company without a filing in the seed');
const ABSENT = '910000004'; // valid modulus 11, not in the seed
if (companies.some((c) => c.orgnr === ABSENT)) throw new Error(`${ABSENT} is in the seed`);
// A covered NUF with a SELSKAP filing (the non-AS state), and a covered ENK
// with none (the no-filing state comes first).
const NON_AS = companies.find(
  (c) => covered.has(c.naeringskode1 ?? '') && c.organisasjonsform === 'NUF' && withFiling.has(c.orgnr ?? ''),
);
if (NON_AS === undefined) throw new Error('no covered NUF with a filing in the seed');
const NON_AS_NO_FILING = companies.find(
  (c) => covered.has(c.naeringskode1 ?? '') && c.organisasjonsform === 'ENK' && !withFiling.has(c.orgnr ?? ''),
);
if (NON_AS_NO_FILING === undefined) throw new Error('no covered ENK without a filing in the seed');

// The expected peer group, computed by the engine from the seed CSVs as the
// server computes it from the database.
const companyByOrgnr = new Map(companies.map((c) => [c.orgnr ?? '', c]));
const allFilings = csv('filing.csv');
const bool = (text: string | undefined): boolean | null => (text === 't' ? true : text === 'f' ? false : null);
const ore = (text: string | undefined): bigint | null => (text === undefined || text === '' ? null : BigInt(text));
const orNull = (text: string | undefined): string | null => (text === undefined || text === '' ? null : text);
function comparability(f: Record<string, string>) {
  return {
    regnskapstype: f.regnskapstype ?? '',
    periodeFra: f.periode_fra ?? '',
    periodeTil: f.periode_til ?? '',
    valuta: orNull(f.valuta),
    regnskapsregler: orNull(f.regnskapsregler),
    smaaForetak: bool(f.smaa_foretak),
    avviklingsregnskap: bool(f.avviklingsregnskap),
  };
}
type SeedCandidate = CandidateFiling & { readonly navn: string };
function expectedGroup(orgnr: string, band: SizeBand) {
  const own = company(orgnr);
  const filing = newestFiling(orgnr);
  const subject: SubjectFiling = {
    orgnr,
    naeringskode1: orNull(own.naeringskode1),
    filingYear: Number(filing.filing_year),
    sumDriftsinntekter: ore(keyFigures.get(filing.brreg_id ?? '')?.sum_driftsinntekter_ore),
    ...comparability(filing),
  };
  const candidates: SeedCandidate[] = allFilings
    .filter((f) => f.filing_year === filing.filing_year && f.orgnr !== orgnr)
    .filter((f) => companyByOrgnr.get(f.orgnr ?? '')?.naeringskode1 === own.naeringskode1)
    .map((f) => {
      const c = companyByOrgnr.get(f.orgnr ?? '');
      return {
        orgnr: f.orgnr ?? '',
        navn: c?.navn === undefined || c.navn === '' ? formatOrgnr(f.orgnr ?? '') : c.navn,
        organisasjonsform: orNull(c?.organisasjonsform),
        naeringskode1: orNull(c?.naeringskode1),
        brregId: BigInt(f.brreg_id ?? '0'),
        filingYear: Number(f.filing_year),
        sumDriftsinntekter: ore(keyFigures.get(f.brreg_id ?? '')?.sum_driftsinntekter_ore),
        ...comparability(f),
      };
    });
  return assemblePeerGroup(subject, candidates, band).pool;
}

const coverageSentence = 'dataprogrammeringstjenester (62.100)';
const dataDate = (orgnr: string) => {
  const filing = newestFiling(orgnr);
  return `Regnskapsår ${filing.filing_year} · hentet ${formatReadDate(timestamp(filing.read_at ?? ''))}`;
};
const revenue = (orgnr: string) =>
  `Omsetning ${formatMillions(keyFigures.get(newestFiling(orgnr).brreg_id ?? '')?.sum_driftsinntekter_ore ?? '')}`;

const h1 = (page: Page) => page.locator('main h1');
// The rendered page, not the Suspense fallback: while the stream swaps one
// for the other, both <main> elements can be in the document.
const rendered = (page: Page) => page.locator('main:not([aria-busy="true"])');
const tabs = (page: Page) => page.getByRole('navigation', { name: nb['tabs.label'] });
const notice = (page: Page) => page.getByTestId('settings-notice');
const headerSearch = (page: Page) => page.getByRole('banner').getByRole('combobox');

async function noSidewaysScroll(page: Page): Promise<void> {
  const scroll = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(scroll.doc).toBeLessThanOrEqual(scroll.inner);
  expect(scroll.body).toBeLessThanOrEqual(scroll.inner);
}

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
    await page.goto(`/analyse/${A.orgnr}/peers`);
    await expect(page.getByTestId('peer-count')).toHaveText(peersCount(pool0.length));
    const region = page.getByRole('region', { name: nb['peers.regionLabel'] });
    await expect(region).toHaveAttribute('tabindex', '0');
    expect(await region.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
    await expect(peerTable(page).locator('thead th')).toHaveText([
      nb['peers.col.selskap'],
      nb['peers.col.omsetning'],
      nb['peers.col.kommune'],
    ]);
    const rows = peerTable(page).locator('tbody tr');
    await expect(rows).toHaveCount(pool0.length);
    await expect(rows.locator('td:first-child')).toHaveText(pool0.map((peer) => peer.navn));
    await expect(rows.locator('td:nth-child(2)')).toHaveText(
      pool0.map((peer) => formatMillions(String(peer.sumDriftsinntekter))),
    );
  });

  test('no peer orgnr reaches the Peers page', async ({ request }) => {
    const html = await (await request.get(`/analyse/${A.orgnr}/peers`)).text();
    const leaked = pool0.filter((peer) => html.includes(peer.orgnr)).map((peer) => peer.orgnr);
    expect(leaked).toEqual([]);
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
    test(`the Peers tab reflows at ${width} px: the table scrolls in its region, the body never`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/analyse/${A.orgnr}/peers`);
      await expect(peerTable(page)).toBeVisible();
      await noSidewaysScroll(page);
      const region = await page.getByRole('region', { name: nb['peers.regionLabel'] }).boundingBox();
      if (region === null) throw new Error('peer region not rendered');
      expect(region.x + region.width).toBeLessThanOrEqual(width);
    });
  }
});

test.describe('a covered AS that cannot have peers', () => {
  // Covered AS subjects from the seed, by what their newest filing holds.
  const coveredAs = companies.filter(
    (c) => covered.has(c.naeringskode1 ?? '') && c.organisasjonsform === 'AS' && withFiling.has(c.orgnr ?? ''),
  );
  const revenueOf = (c: Record<string, string>) =>
    keyFigures.get(newestFiling(c.orgnr ?? '').brreg_id ?? '')?.sum_driftsinntekter_ore ?? '';
  const isCalendar = (c: Record<string, string>) => {
    const f = newestFiling(c.orgnr ?? '');
    return /-01-01$/.test(f.periode_fra ?? '') && /-12-31$/.test(f.periode_til ?? '') && f.periode_fra?.slice(0, 4) === f.periode_til?.slice(0, 4);
  };
  const pick = (label: string, test: (c: Record<string, string>) => boolean) => {
    const found = coveredAs.find(test);
    if (found === undefined) throw new Error(`no covered AS with ${label} in the seed`);
    return found;
  };
  const noRevenue = [
    ['zero', pick('zero revenue', (c) => revenueOf(c) === '0')],
    ['negative', pick('negative revenue', (c) => revenueOf(c).startsWith('-'))],
    ['null', pick('no stated revenue', (c) => revenueOf(c) === '')],
  ] as const;
  const nonCalendar = pick('a non-calendar year and positive revenue', (c) => /^\d+$/.test(revenueOf(c)) && revenueOf(c) !== '0' && !isCalendar(c));

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
