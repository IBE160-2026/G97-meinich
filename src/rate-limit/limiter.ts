// The per-address rate limiter (Story 1.10; technical note, AD-10). One
// in-memory table per budget, held on globalThis in the one server process,
// so it survives module reloads and is shared by every request the proxy
// sees. Nothing is written anywhere else: no database table, file or cookie.
//
// No address is held either: a key is an HMAC of the address under a random
// salt made when the process starts, kept only in this process's memory and
// never written to a file, the environment, a log or the database. The same
// address gives a different key in another process, so a key read from
// memory cannot be matched against an address list.
//
// `consume` is pure apart from the table it is given: the clock is a
// parameter, so the window tests use a fake one.
import { createHmac, randomBytes } from 'node:crypto';
import { BUDGETS, MAX_KEYS, type Budget, type BudgetName } from './budgets.ts';

interface Entry {
  /** Requests served in this window. Refused requests do not count. */
  count: number;
  /** When the window began (ms since the epoch). */
  readonly windowStart: number;
}

/**
 * One budget's table: key → entry, in insertion order. An entry is only
 * ever inserted when its window starts (a new key, or a key whose window
 * ended is deleted and inserted again), so iteration order is oldest window
 * first.
 */
export type Store = Map<string, Entry>;

export type Decision =
  | { readonly allowed: true }
  | { readonly allowed: false; /** Whole seconds until the window ends, at least 1. */ readonly retryAfterSeconds: number };

const expired = (entry: Entry, budget: Budget, now: number): boolean => now - entry.windowStart >= budget.windowMs;

/**
 * Frees one slot in a full table (human decision 2026-10-16): expired
 * entries go first; then the oldest entry still within its budget; an
 * exhausted entry goes only when every live entry is exhausted. The table is
 * never cleared and a new address is never refused, so forged addresses can
 * push out other visitors' counts but cannot lift an exhausted address's
 * refusal while anyone within budget is left to evict.
 */
function makeRoom(store: Store, budget: Budget, now: number): void {
  // Iteration order is window order, so the expired entries are the first
  // ones: the sweep stops at the first that has not expired.
  for (const [key, entry] of store) {
    if (!expired(entry, budget, now)) break;
    store.delete(key);
  }
  if (store.size < MAX_KEYS) return;
  for (const [key, entry] of store) {
    if (entry.count < budget.limit) {
      store.delete(key);
      return;
    }
  }
  const oldest = store.keys().next();
  if (oldest.done !== true) store.delete(oldest.value);
}

/** Counts one request for `key` against `budget` at `now`, or refuses it. */
export function consume(store: Store, key: string, budget: Budget, now: number): Decision {
  let entry = store.get(key);
  if (entry !== undefined && expired(entry, budget, now)) {
    store.delete(key);
    entry = undefined;
  }
  if (entry === undefined) {
    if (store.size >= MAX_KEYS) makeRoom(store, budget, now);
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (entry.count >= budget.limit) {
    const remainingMs = entry.windowStart + budget.windowMs - now;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
  }
  entry.count += 1;
  return { allowed: true };
}

interface LimiterState {
  readonly salt: Buffer;
  readonly stores: Readonly<Record<BudgetName, Store>>;
}

const STATE_KEY = Symbol.for('peerless.rateLimit');

type GlobalWithLimiter = typeof globalThis & { [STATE_KEY]?: LimiterState };

/** The process's limiter: its salt and one table per budget, made on first use. */
export function limiterState(): LimiterState {
  const holder = globalThis as GlobalWithLimiter;
  holder[STATE_KEY] ??= {
    salt: randomBytes(32),
    stores: { search: new Map(), analysis: new Map() },
  };
  return holder[STATE_KEY];
}

/** For the tests: a fresh limiter, with a new salt, as a new process would have. */
export function resetLimiterState(): void {
  delete (globalThis as GlobalWithLimiter)[STATE_KEY];
}

/**
 * The client address the limit is keyed on: the rightmost X-Forwarded-For
 * entry, the one a single trusted proxy appends. Under `next start` with no
 * proxy in front, Next.js sets the header from the socket only when the
 * client sent none, so a client can choose its own entry. It then only buys
 * itself a budget of its own under that value: it cannot lift an exhausted
 * address's refusal or spend another address's budget unless it sends that
 * address. A v1 limitation (technical note, AD-10); a public deployment must
 * read the address the platform sets instead.
 * An IPv4-mapped IPv6 address counts as its IPv4 address.
 */
export function clientAddress(headers: Headers): string {
  const entries = (headers.get('x-forwarded-for') ?? '').split(',');
  const rightmost = (entries[entries.length - 1] ?? '').trim().toLowerCase();
  return rightmost.startsWith('::ffff:') ? rightmost.slice('::ffff:'.length) : rightmost;
}

/** The salted hash of an address: what the tables hold instead of the address. */
export function hashAddress(address: string, salt: Buffer): string {
  return createHmac('sha256', salt).update(address).digest('base64url');
}

/** Counts one request from `headers`' client against `budget`. */
export function limit(headers: Headers, budget: BudgetName, now: number): Decision {
  const state = limiterState();
  const key = hashAddress(clientAddress(headers), state.salt);
  return consume(state.stores[budget], key, BUDGETS[budget], now);
}
