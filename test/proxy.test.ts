// The proxy (Story 1.10): which budget a request counts against, which
// paths it sees, and what an over-budget request gets.
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { budgetFor, config, proxy } from '../src/proxy.ts';
import { BUDGETS } from '../src/rate-limit/budgets.ts';
import { resetLimiterState } from '../src/rate-limit/limiter.ts';
import { refusalPage } from '../src/rate-limit/refusal.ts';

const ORGNR = '813235552';

function request(pathname: string, xff: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(pathname, 'http://localhost:3000'), {
    headers: { 'x-forwarded-for': xff, ...headers },
  });
}

/** Sends `n` requests and returns their statuses (200 for a request passed on). */
function send(pathname: string, xff: string, n: number, headers: Record<string, string> = {}): number[] {
  return Array.from({ length: n }, () => {
    const response = proxy(request(pathname, xff, headers));
    return response.headers.get('x-middleware-next') === '1' ? 200 : response.status;
  });
}

const quiet = () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
};

afterEach(() => {
  resetLimiterState();
  vi.restoreAllMocks();
});

describe('budgetFor', () => {
  it('counts GET /api/sok as search and everything else as analysis', () => {
    expect(budgetFor('/api/sok')).toBe('search');
    for (const pathname of ['/', '/slik-fungerer-peerless', `/analyse/${ORGNR}`, `/analyse/${ORGNR}/peers`, '/finnes-ikke', '/api/sok/x']) {
      expect(budgetFor(pathname)).toBe('analysis');
    }
  });
});

describe('the matcher', () => {
  const matches = (url: string, headers: Record<string, string> = {}) =>
    unstable_doesMiddlewareMatch({ config, url, headers });

  it('sees every page, RSC payload, prefetch, 404 and the search', () => {
    for (const url of ['/', '/slik-fungerer-peerless', `/analyse/${ORGNR}`, `/analyse/${ORGNR}/nokkeltall?band=x`, '/api/sok?q=ad', '/finnes-ikke', '/favicon.ico', '/x.json']) {
      expect(matches(url), url).toBe(true);
    }
    expect(matches(`/analyse/${ORGNR}/peers`, { rsc: '1', 'next-router-prefetch': '1' })).toBe(true);
  });

  it('skips the build’s static assets and image optimisation', () => {
    for (const url of ['/_next/static/chunks/main.js', '/_next/static/media/inter.woff2', '/_next/image?url=%2Fa.png&w=64&q=75']) {
      expect(matches(url), url).toBe(false);
    }
  });
});

describe('proxy', () => {
  it('passes requests within budget on, and refuses the next one', () => {
    quiet();
    const statuses = send(`/analyse/${ORGNR}`, '198.51.100.1', BUDGETS.analysis.limit + 1);
    expect(statuses.slice(0, -1).every((status) => status === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('refuses a page, an RSC payload and a prefetch over budget with the refusal page and no figure', async () => {
    quiet();
    send('/', '198.51.100.2', BUDGETS.analysis.limit);
    const variants: Record<string, string>[] = [{}, { rsc: '1' }, { rsc: '1', 'next-router-prefetch': '1' }];
    for (const headers of variants) {
      const response = proxy(request(`/analyse/${ORGNR}/oversikt?band=0.25-4&ekskl=999999999`, '198.51.100.2', headers));
      expect(response.status).toBe(429);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(Number(response.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
      const body = await response.text();
      expect(body).toBe(refusalPage());
      expect(body).not.toMatch(new RegExp(`${ORGNR}|999999999|0\\.25|band|ekskl|analyse`));
    }
  });

  it('refuses /api/sok over budget with an empty object', async () => {
    quiet();
    send('/api/sok', '198.51.100.3', BUDGETS.search.limit);
    const response = proxy(request(`/api/sok?q=${ORGNR}`, '198.51.100.3'));
    expect(response.status).toBe(429);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(Number(response.headers.get('retry-after'))).toBeLessThanOrEqual(60);
    expect(await response.text()).toBe('{}');
  });

  it('keeps the budgets separate, both ways', () => {
    quiet();
    send('/api/sok', '198.51.100.4', BUDGETS.search.limit + 1);
    expect(send('/', '198.51.100.4', 1)).toEqual([200]);
    send('/', '198.51.100.5', BUDGETS.analysis.limit + 1);
    expect(send('/api/sok', '198.51.100.5', 1)).toEqual([200]);
  });

  it('keeps an exhausted address refused while another header value only gets its own budget', () => {
    quiet();
    send('/', '198.51.100.6', BUDGETS.analysis.limit + 1);
    // Another address, and a client-set entry in front of the exhausted one:
    // the first is counted on its own; the second is still the exhausted one.
    expect(send('/', '198.51.100.7', 1)).toEqual([200]);
    expect(send('/', '203.0.113.1, 198.51.100.6', 1)).toEqual([429]);
    expect(send('/', '198.51.100.6', 1)).toEqual([429]);
  });

  it('serves again once the window has passed', () => {
    quiet();
    vi.useFakeTimers({ now: 1_760_000_000_000 });
    try {
      send('/', '198.51.100.8', BUDGETS.analysis.limit + 1);
      vi.setSystemTime(1_760_000_000_000 + BUDGETS.analysis.windowMs);
      expect(send('/', '198.51.100.8', 1)).toEqual([200]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs each outcome with its budget and status only: no address, header or path', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    send(`/analyse/${ORGNR}`, '203.0.113.77', BUDGETS.analysis.limit + 1, { 'user-agent': 'sentinel-agent' });
    send(`/api/sok?q=${ORGNR}`, '203.0.113.77', BUDGETS.search.limit + 1);
    const lines = [...out.mock.calls, ...err.mock.calls].map(([line]) => String(line));
    expect(lines).toHaveLength(BUDGETS.analysis.limit + BUDGETS.search.limit + 2);
    expect(lines.filter((line) => line.includes('"outcome":"refused"'))).toEqual([
      '{"level":"warn","event":"request","budget":"analysis","outcome":"refused","status":429}',
      '{"level":"warn","event":"request","budget":"search","outcome":"refused","status":429}',
    ]);
    expect(lines.join('\n')).not.toMatch(/203\.0\.113\.77|813235552|sentinel-agent|analyse|sok/);
  });
});

describe('the refusal page', () => {
  const page = refusalPage();

  it('is in Norwegian, with the refusal as an alert and no figure', () => {
    expect(page).toMatch(/^<!doctype html>\n<html lang="nb">/);
    expect(page).toContain(`<title>${nb['rateLimit.pageTitle']}</title>`);
    expect(page).toContain(`<h1>${nb['rateLimit.title']}</h1>`);
    expect(page).toContain(`<p role="alert">${nb['rateLimit.refused']}</p>`);
    expect(page).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    // The text a reader sees has no digit: no figure, no orgnr.
    const text = page.replace(/<style>[\s\S]*<\/style>/, '').replace(/<[^>]+>/g, '');
    expect(text).not.toMatch(/\d/);
  });

  it('has no search, form, link or script', () => {
    expect(page).not.toMatch(/<(form|input|a|script)\b/);
  });
});
