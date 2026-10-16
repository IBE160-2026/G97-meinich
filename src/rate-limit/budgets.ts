// The rate-limit budgets (Story 1.10; technical note, AD-10): the one place
// they are set. Search (GET /api/sok) and everything else the server renders
// (pages, RSC payloads, prefetches, 404s) count separately, per client
// address, in fixed windows. No environment variable changes or disables
// them.

export const BUDGET_NAMES = ['search', 'analysis'] as const;

export type BudgetName = (typeof BUDGET_NAMES)[number];

export interface Budget {
  readonly name: BudgetName;
  /** Requests served per window; the next one is refused. */
  readonly limit: number;
  readonly windowMs: number;
}

export const BUDGETS: Readonly<Record<BudgetName, Budget>> = {
  search: { name: 'search', limit: 60, windowMs: 60_000 },
  analysis: { name: 'analysis', limit: 60, windowMs: 60_000 },
};

/**
 * Most addresses one budget's table holds. At the cap, a new address makes
 * room (see makeRoom in limiter.ts); it is never refused for want of room.
 */
export const MAX_KEYS = 10_000;
