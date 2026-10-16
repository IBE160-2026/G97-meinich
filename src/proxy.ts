// The rate limit's one choke point (Story 1.10; technical note, AD-10,
// AD-12). Every request the server would render or answer passes here
// first: pages, RSC payloads, prefetches and soft navigations, 404s and
// GET /api/sok. Each is counted against its budget for the client address
// (src/rate-limit); one over budget is answered here with the refusal, so
// no page, layout or query runs for it. Each outcome is logged with its
// budget and status only: no address, header or path.
//
// The proxy is not a route: `pnpm check:routes` sees no entry for it.
import { NextResponse, type NextRequest } from 'next/server';
import { log } from './logger.ts';
import type { BudgetName } from './rate-limit/budgets.ts';
import { limit } from './rate-limit/limiter.ts';
import { REFUSAL_STATUS, refusalResponse } from './rate-limit/refusal.ts';

/** Search is GET /api/sok; everything else the server renders is the analysis budget. */
export function budgetFor(pathname: string): BudgetName {
  return pathname === '/api/sok' ? 'search' : 'analysis';
}

export function proxy(request: NextRequest): Response {
  const budget = budgetFor(request.nextUrl.pathname);
  const decision = limit(request.headers, budget, Date.now());
  if (!decision.allowed) {
    log('warn', 'request', { budget, outcome: 'refused', status: REFUSAL_STATUS });
    return refusalResponse(budget, decision.retryAfterSeconds);
  }
  log('info', 'request', { budget, outcome: 'served' });
  return NextResponse.next();
}

export const config = {
  // Every path except the build's static assets (_next/static: scripts,
  // styles, fonts) and image optimisation. There is no public/ directory, so
  // any other path, a "file" name included, renders a page or the 404 page,
  // which reads the database: it is counted.
  matcher: ['/((?!_next/static/|_next/image(?:/|$)).*)'],
};
