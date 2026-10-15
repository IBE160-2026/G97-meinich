// GET /api/sok?q= — the only JSON endpoint (technical note, request
// surface). Validates q itself, then reads Peerless's own database through
// the reader client. No register call, no write, no detail on failure.
import { classifySearchInput } from '@/engine/orgnr';
import { MAX_SEARCH_LENGTH, MAX_SEARCH_RESULTS, toSearchResult } from '@/search-contract';
import { searchCompanies } from '@/server/search';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (q.length > MAX_SEARCH_LENGTH) return Response.json({}, { status: 400, headers: NO_STORE });

  const input = classifySearchInput(q);
  if (input.kind === 'empty') return Response.json([], { headers: NO_STORE });
  // Digits only, but not a valid nine-digit orgnr: malformed, never a name.
  if (input.kind === 'length' || input.kind === 'checksum') {
    return Response.json({}, { status: 400, headers: NO_STORE });
  }
  // One character is too short to search on.
  if (input.kind === 'name' && Array.from(input.name).length < 2) {
    return Response.json([], { headers: NO_STORE });
  }

  try {
    const rows = await searchCompanies(input);
    // The query already returns at most eight rows of these fields; the
    // route enforces the contract again so no later change to the query can
    // widen what leaves the server.
    return Response.json(rows.slice(0, MAX_SEARCH_RESULTS).map(toSearchResult), { headers: NO_STORE });
  } catch {
    // No detail: neither the error nor the query reaches the client or the log.
    console.error('GET /api/sok: search failed');
    return Response.json({}, { status: 500, headers: NO_STORE });
  }
}
