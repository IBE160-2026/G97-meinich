// Peer-group assembly time (Story 2.8; NFR1, epics.md "Given the seeded
// 62.100 dataset"): what the server does for a peer-group change's URL,
// against the loaded demo seed through the app's own reader client — the
// subject read, the one candidate read, funnel stages 1–5 at the URL's band
// and the shown group with `ekskl` — under 1 s for demo A and B at each
// band, with exclusions. The reads are the uncached ones (loadSubject,
// loadCandidates), so each run reads the database. Read-only.
import { afterAll, describe, expect, it } from 'vitest';
import { funnelSubject } from '../../src/analysis/view.ts';
import { shownGroup } from '../../src/analysis/shown-group.ts';
import { DEMO_COMPANIES } from '../../src/demo-companies.ts';
import { assemblePeerGroup, type SizeBand } from '../../src/engine/peers.ts';
import { setting } from './db-env.ts';

const url = setting('READER_DATABASE_URL');
if (url === undefined) throw new Error('READER_DATABASE_URL is not set; run `pnpm db:roles`');
process.env.READER_DATABASE_URL = url;

const { readerSql } = await import('../../src/server/db.ts');
const { loadCandidates, loadSubject } = await import('../../src/server/analysis.ts');

afterAll(async () => {
  await readerSql().end();
  delete (globalThis as { peerlessReaderSql?: unknown }).peerlessReaderSql;
});

const LIMIT_MS = 1000;

/** One request's work for `orgnr` at `band`, excluding the first `exclude` peers of the group. Returns the time and the sizes. */
async function assemble(orgnr: string, band: SizeBand, exclude: number) {
  const started = performance.now();
  const subject = await loadSubject(orgnr);
  const funnel = subject === null ? null : funnelSubject(subject);
  if (subject?.filing == null || funnel === null || funnel.naeringskode1 === null) {
    throw new Error(`${orgnr} has no peer group in the seed`);
  }
  const candidates = await loadCandidates(funnel.orgnr, funnel.naeringskode1, funnel.filingYear);
  const group = assemblePeerGroup(funnel, candidates, band);
  const ekskl = group.group.slice(0, exclude).map((peer) => peer.orgnr);
  const shown = shownGroup(group, ekskl, subject.filing);
  const ms = performance.now() - started;
  return { ms, members: shown.members.length, analysis: shown.analysisCount, excluded: shown.excludedInGroup.length };
}

describe('peer-group assembly for a change URL', () => {
  // A first read warms the connection, as a running server's would be.
  it('warms the reader connection', async () => {
    await loadSubject(DEMO_COMPANIES[0].orgnr);
  });

  for (const demo of DEMO_COMPANIES) {
    for (const band of [0, 1, 2] as const) {
      it(`demo ${demo.navn}, band ${band}, with exclusions: under ${LIMIT_MS} ms`, async () => {
        const result = await assemble(demo.orgnr, band, 3);
        expect(result.members).toBeGreaterThan(3);
        expect(result.excluded).toBe(3);
        expect(result.analysis).toBe(result.members - 3);
        // Recorded for the PR (NFR1).
        console.log(`assembly ${demo.navn} band ${band}: ${result.ms.toFixed(0)} ms, ${result.members} in the group`);
        expect(result.ms).toBeLessThan(LIMIT_MS);
      });
    }
  }
});
