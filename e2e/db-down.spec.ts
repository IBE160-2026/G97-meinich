// The analysis with the database unreachable (Story 1.6b, human decision
// 2026-10-16): HTTP 503 and the lookup-error state — role="alert"
// "Noe gikk galt. Prøv igjen om litt." — with no detail of the error in the
// response. Runs against the second server in playwright.config.ts, whose
// READER_DATABASE_URL points at a closed port.
import { expect, test } from '@playwright/test';
import nb from '../src/messages/nb.json' with { type: 'json' };

const ORGNR = '813235552'; // demo company A; any valid orgnr is read first
// What an error could leak: the driver's message, the address, the role,
// the query, Next.js's own error page.
const DETAILS = [
  /ECONNREFUSED/i,
  /127\.0\.0\.1/,
  /:1\b\/postgres/,
  /postgres(ql)?:\/\//i,
  /PostgresError/,
  /register\./,
  /select /i,
  /stack/i,
  /Application error/i,
  /Internal Server Error/i,
  /digest/i,
];

for (const path of [`/analyse/${ORGNR}`, `/analyse/${ORGNR}/peers`, `/analyse/${ORGNR}/oversikt?band=x`]) {
  test(`${path} answers 503 with the alert and no error details`, async ({ page, request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(503);
    expect(response.headers()['cache-control']).toContain('no-store');
    const body = await response.text();
    for (const detail of DETAILS) expect(body, String(detail)).not.toMatch(detail);

    const shown = await page.goto(path);
    expect(shown?.status()).toBe(503);
    await expect(page.locator('main [role="alert"]')).toHaveText(nb['search.failed']);
    await expect(page.locator('main h1, main h2, main dl')).toHaveCount(0);
  });
}

test('a path that is not an analysis is not affected', async ({ request }) => {
  expect((await request.get('/slik-fungerer-peerless')).status()).toBe(200);
});
