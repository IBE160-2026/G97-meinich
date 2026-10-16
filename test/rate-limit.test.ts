// The rate limiter (Story 1.10; technical note, AD-10): the I/O matrix rows
// that need a clock, with a fake one; the full table; the salted keys.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUDGETS, MAX_KEYS, type Budget } from '../src/rate-limit/budgets.ts';
import {
  clientAddress,
  consume,
  hashAddress,
  limit,
  limiterState,
  resetLimiterState,
  type Store,
} from '../src/rate-limit/limiter.ts';

const root = path.resolve(import.meta.dirname, '..');
const T0 = 1_760_000_000_000;
const SMALL: Budget = { name: 'analysis', limit: 3, windowMs: 60_000 };

const run = (store: Store, key: string, n: number, budget: Budget, now: number): boolean[] =>
  Array.from({ length: n }, () => consume(store, key, budget, now).allowed);

afterEach(() => resetLimiterState());

describe('budgets', () => {
  it('are 60 analysis and 60 search requests per minute (human decision 2026-10-16)', () => {
    expect(BUDGETS.analysis).toEqual({ name: 'analysis', limit: 60, windowMs: 60_000 });
    expect(BUDGETS.search).toEqual({ name: 'search', limit: 60, windowMs: 60_000 });
    expect(MAX_KEYS).toBe(10_000);
  });
});

describe('consume', () => {
  it('serves up to the budget in a window, then refuses', () => {
    const store: Store = new Map();
    expect(run(store, 'a', 3, SMALL, T0)).toEqual([true, true, true]);
    const refused = consume(store, 'a', SMALL, T0 + 1_500);
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: 59 });
  });

  it('does not count refused requests', () => {
    const store: Store = new Map();
    run(store, 'a', 10, SMALL, T0);
    expect(store.get('a')?.count).toBe(3);
  });

  it('serves again once the window has passed', () => {
    const store: Store = new Map();
    run(store, 'a', 4, SMALL, T0);
    expect(consume(store, 'a', SMALL, T0 + 59_999).allowed).toBe(false);
    expect(consume(store, 'a', SMALL, T0 + 60_000).allowed).toBe(true);
    expect(run(store, 'a', 3, SMALL, T0 + 60_000)).toEqual([true, true, false]);
  });

  it('asks for at least one second', () => {
    const store: Store = new Map();
    run(store, 'a', 3, SMALL, T0);
    expect(consume(store, 'a', SMALL, T0 + 59_900)).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('counts each key separately', () => {
    const store: Store = new Map();
    run(store, 'a', 3, SMALL, T0);
    expect(consume(store, 'a', SMALL, T0).allowed).toBe(false);
    expect(consume(store, 'b', SMALL, T0).allowed).toBe(true);
    expect(consume(store, 'a', SMALL, T0).allowed).toBe(false);
  });
});

describe('a full table (human decision 2026-10-16)', () => {
  const budget = BUDGETS.analysis;

  it('keeps an exhausted address refused after 10 000 forged addresses in the same window', () => {
    const store: Store = new Map();
    run(store, 'victim-exhausted', budget.limit, budget, T0);
    for (let i = 0; i < MAX_KEYS; i += 1) {
      expect(consume(store, `forged-${i}`, budget, T0 + 1).allowed).toBe(true);
    }
    expect(store.size).toBe(MAX_KEYS);
    expect(consume(store, 'victim-exhausted', budget, T0 + 2).allowed).toBe(false);
  });

  it('sweeps expired entries first, then evicts the oldest entry still within budget', () => {
    const store: Store = new Map();
    for (let i = 0; i < 10; i += 1) consume(store, `old-${i}`, budget, T0);
    run(store, 'exhausted', budget.limit, budget, T0 + 30_000);
    for (let i = 0; store.size < MAX_KEYS; i += 1) consume(store, `live-${i}`, budget, T0 + 30_000);

    // The old entries' window has ended: they go, and nothing live does.
    expect(consume(store, 'new-1', budget, T0 + 60_000).allowed).toBe(true);
    expect([...store.keys()].some((key) => key.startsWith('old-'))).toBe(false);
    expect(store.has('live-0')).toBe(true);
    expect(store.size).toBe(MAX_KEYS - 10 + 1);

    // Full again: the oldest live entry within budget goes, the exhausted one stays.
    for (let i = 0; store.size < MAX_KEYS; i += 1) consume(store, `more-${i}`, budget, T0 + 60_000);
    expect(consume(store, 'new-2', budget, T0 + 60_000).allowed).toBe(true);
    expect(store.has('live-0')).toBe(false);
    expect(store.has('exhausted')).toBe(true);
    expect(store.size).toBe(MAX_KEYS);
    expect(consume(store, 'exhausted', budget, T0 + 60_000).allowed).toBe(false);
  });

  it('evicts the oldest exhausted entry only when every live entry is exhausted, and never refuses a new address', () => {
    const tiny: Budget = { name: 'analysis', limit: 1, windowMs: 60_000 };
    const store: Store = new Map();
    for (let i = 0; i < MAX_KEYS; i += 1) consume(store, `x-${i}`, tiny, T0);
    expect(consume(store, 'newcomer', tiny, T0).allowed).toBe(true);
    expect(store.has('x-0')).toBe(false);
    expect(store.has('x-1')).toBe(true);
    expect(store.size).toBe(MAX_KEYS);
  });
});

describe('the client address', () => {
  const headers = (xff?: string) => new Headers(xff === undefined ? {} : { 'x-forwarded-for': xff });

  it('is the rightmost X-Forwarded-For entry, the one a single proxy appends', () => {
    expect(clientAddress(headers('203.0.113.9, 198.51.100.4'))).toBe('198.51.100.4');
    expect(clientAddress(headers(' 198.51.100.4 '))).toBe('198.51.100.4');
  });

  it('counts an IPv4-mapped IPv6 address as its IPv4 address', () => {
    expect(clientAddress(headers('::ffff:127.0.0.1'))).toBe('127.0.0.1');
    expect(clientAddress(headers('::1'))).toBe('::1');
  });

  it('is empty, one shared key, without the header', () => {
    expect(clientAddress(headers())).toBe('');
  });
});

describe('the keys', () => {
  const ADDRESS = '203.0.113.77';

  it('hold no address: the tables hold only salted hashes', () => {
    const request = new Headers({ 'x-forwarded-for': ADDRESS });
    limit(request, 'analysis', T0);
    limit(request, 'search', T0);
    const { salt, stores } = limiterState();
    for (const store of Object.values(stores)) {
      expect([...store.keys()]).toEqual([hashAddress(ADDRESS, salt)]);
      expect(JSON.stringify([...store])).not.toContain(ADDRESS);
      expect(JSON.stringify([...store])).not.toContain('203');
    }
  });

  it('differ between salts for the same address', () => {
    const first = hashAddress(ADDRESS, limiterState().salt);
    resetLimiterState();
    expect(hashAddress(ADDRESS, limiterState().salt)).not.toBe(first);
  });

  it('differ between two processes for the same address (the salt is made at process start)', () => {
    const script = [
      "const { hashAddress, limiterState } = await import('./src/rate-limit/limiter.ts');",
      `process.stdout.write(hashAddress('${ADDRESS}', limiterState().salt));`,
    ].join('\n');
    const hash = () =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
    const [a, b] = [hash(), hash()];
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(b).toMatch(/^[\w-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe('limit', () => {
  it('counts search and analysis against separate budgets', () => {
    const request = new Headers({ 'x-forwarded-for': '198.51.100.1' });
    for (let i = 0; i < BUDGETS.search.limit; i += 1) expect(limit(request, 'search', T0).allowed).toBe(true);
    expect(limit(request, 'search', T0).allowed).toBe(false);
    expect(limit(request, 'analysis', T0).allowed).toBe(true);
  });
});
