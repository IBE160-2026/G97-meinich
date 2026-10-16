// What an over-budget request gets (Story 1.10; EXPERIENCE.md, refusal
// state; UX-DR59): built here, by pure functions, and sent by the proxy
// itself, so no page, layout or query runs. The page holds the refusal and
// nothing else: no figure, no part of an analysis, no header search and
// nothing from the request (not its path, so not the orgnr asked for).
// /api/sok gets an empty object, as for its other failures.
import { t } from '../messages/index.ts';
import type { BudgetName } from './budgets.ts';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// DESIGN.md tokens, inline: the app's stylesheet is a build asset this
// response does not link to. The page reflows to any width; nothing in it
// is wider than the viewport.
const STYLE = `
:root{--navy-900:#0b2340;--background:#ffffff;--surface:#f5f7fa;--divider:#d9e0e8;--slate:#5b6b7f}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--background);color:var(--navy-900);font-family:'Inter Variable',Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.5;overflow-wrap:anywhere}
header{border-bottom:1px solid var(--divider);padding:16px}
header p{margin:0;font-family:'Source Serif 4 Variable','Source Serif 4',ui-serif,Georgia,serif;font-size:20px;font-weight:600}
main{max-width:720px;margin:0 auto;padding:40px 16px}
h1{margin:0 0 16px;font-family:'Source Serif 4 Variable','Source Serif 4',ui-serif,Georgia,serif;font-size:28px;line-height:1.2;font-weight:600}
[role=alert]{margin:0;padding:16px;background:var(--surface);border:1px solid var(--divider);border-radius:6px}
`.trim();

/** The refusal page for a page, RSC or prefetch request over budget. */
export function refusalPage(): string {
  return [
    '<!doctype html>',
    '<html lang="nb">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${escapeHtml(t('rateLimit.pageTitle'))}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    `<header><p>${escapeHtml(t('shell.brand'))}</p></header>`,
    '<main>',
    `<h1>${escapeHtml(t('rateLimit.title'))}</h1>`,
    `<p role="alert">${escapeHtml(t('rateLimit.refused'))}</p>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('\n');
}

/** Headers on every refusal: never cached, and when to try again. */
export function refusalHeaders(retryAfterSeconds: number, contentType: string): Headers {
  return new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Retry-After': String(retryAfterSeconds),
  });
}

export const REFUSAL_STATUS = 429;

/** The refusal for a request over its budget: JSON {} for search, the page for the rest. */
export function refusalResponse(budget: BudgetName, retryAfterSeconds: number): Response {
  if (budget === 'search') {
    return new Response('{}', {
      status: REFUSAL_STATUS,
      headers: refusalHeaders(retryAfterSeconds, 'application/json'),
    });
  }
  return new Response(refusalPage(), {
    status: REFUSAL_STATUS,
    headers: refusalHeaders(retryAfterSeconds, 'text/html; charset=utf-8'),
  });
}
