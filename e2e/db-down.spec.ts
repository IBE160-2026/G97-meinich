// The analysis with the database unreachable (Story 1.6b, human decision
// 2026-10-16, revised: "not 200 on a database failure"): the subject read
// throws, Next.js answers HTTP 500, and the analysis error boundary
// (src/app/analyse/error.tsx, rendered on the client inside the root layout)
// shows the lookup-error state — role="alert"
// "Noe gikk galt. Prøv igjen om litt." — with no detail of the error in the
// response. Runs against the second server in playwright.config.ts, whose
// READER_DATABASE_URL points at a closed port.
import { expect, test } from '@playwright/test';
import nb from '../src/messages/nb.json' with { type: 'json' };

const ORGNR = '813235552'; // demo company A; any valid orgnr is read
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
  /subject lookup failed/i,
];
// Next.js puts the error's digest, a hash it logs on the server, into the
// RSC payload ({"digest":"…"}); it is no detail of the error and it is not
// rendered. The page shows no digest text.
const RENDERED_DETAILS = [...DETAILS, /digest/i];

for (const path of [`/analyse/${ORGNR}`, `/analyse/${ORGNR}/peers`, `/analyse/${ORGNR}/oversikt?band=x`]) {
  test(`${path} answers 500 with the alert and no error details`, async ({ page, request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(500);
    const body = await response.text();
    for (const detail of DETAILS) expect(body, String(detail)).not.toMatch(detail);

    const shown = await page.goto(path);
    expect(shown?.status()).toBe(500);
    // Next.js serves its error shell and renders on the client: the root
    // layout with src/app/analyse/error.tsx in it, not its default error page.
    await expect(page.locator('html')).toHaveAttribute('lang', 'nb');
    await expect(page.locator('main [role="alert"]')).toHaveText(nb['search.failed']);
    await expect(page.locator('main h1, main h2, main dl')).toHaveCount(0);
    await expect(page.getByRole('banner').getByRole('link', { name: nb['shell.brand'], exact: true })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText(nb['footer.source']);
    const shownText = await page.locator('body').innerText();
    for (const detail of RENDERED_DETAILS) expect(shownText, String(detail)).not.toMatch(detail);
  });
}

// The header's coverage read fails too, but the header renders without its
// search, so a page that reads nothing else still answers 200.
test('a path that is not an analysis is not affected', async ({ request }) => {
  expect((await request.get('/slik-fungerer-peerless')).status()).toBe(200);
});
