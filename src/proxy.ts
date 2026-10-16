// The proxy (Story 1.6b): an analysis request whose subject read fails
// answers HTTP 503. A page cannot set that status itself — Next.js 16.4 sets
// only 404, 403, 401 and redirect statuses from rendering, and an error
// thrown before streaming ends in its global error page with 500 — so the
// proxy reads the subject first and, when the read fails, lets the request
// through with status 503 (NextResponse.next({ status })). The page then
// reads again, fails again and renders the lookup-error state, role="alert"
// "Noe gikk galt. Prøv igjen om litt.", with no detail of the error.
//
// Only analysis paths with a valid orgnr are read; the path is parsed by the
// URL module. Every other request passes untouched, without a read. The proxy adds no route
// to the request surface.
import { NextResponse, type NextRequest } from 'next/server';
import { URL_CONTEXT } from '@/analysis/view';
import { readSubject } from '@/server/analysis';
import { parse } from '@/url/analysis-state';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const parsed = parse(request.nextUrl.pathname, URL_CONTEXT);
  if (parsed.kind !== 'analysis') return NextResponse.next();
  const lookup = await readSubject(parsed.state.orgnr);
  if (lookup.kind !== 'failed') return NextResponse.next();
  return NextResponse.next({ status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } });
}

// Every request but static assets: which paths are analyses is the URL
// module's to say (parse above), not a second path pattern here.
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
