// The database half of the labelled set's draw (Story 5.1; README "The
// draw"): which 62.100 companies can be subjects, and each subject's pool.
// Both come from the reads and the funnel the analysis page uses
// (src/server/analysis.ts, src/engine/peers.ts), so nothing here selects a
// peer itself.
//
// Imported through Vite's module runner by draw.ts, for the same reason as
// scripts/document-set-compute.ts: src/server begins with
// `import 'server-only'`, which needs the bundler's resolution.
import { funnelSubject } from '../../src/analysis/view.ts';
import { type SubjectFiling as FunnelSubject, assemblePeerGroup, isCalendarYear } from '../../src/engine/peers.ts';
import { loadCandidates, loadSubject } from '../../src/server/analysis.ts';
import { readerSql } from '../../src/server/db.ts';

export const INDUSTRY = '62.100';

export type Ineligible = 'no_filing' | 'no_revenue' | 'non_calendar';

/** Every stored 62.100 AS, in byte order. Eligibility is decided per company below. */
export async function industryCompanies(): Promise<string[]> {
  const rows = await readerSql()<{ orgnr: string }[]>`
    select orgnr from register.company
     where naeringskode1 = ${INDUSTRY} and organisasjonsform = 'AS'
     order by orgnr`;
  return rows.map((row) => row.orgnr);
}

/**
 * The company's benchmark filing as the funnel reads it, or why it cannot be
 * a subject: no SELSKAP filing, no positive revenue, or a filing that does
 * not run 1 January – 31 December (README "Sampling frame").
 */
export async function benchmark(orgnr: string): Promise<{ funnel: FunnelSubject } | { ineligible: Ineligible }> {
  const subject = await loadSubject(orgnr);
  const funnel = subject === null ? null : funnelSubject(subject);
  if (funnel === null || funnel.naeringskode1 === null) return { ineligible: 'no_filing' };
  if (funnel.sumDriftsinntekter === null || funnel.sumDriftsinntekter <= 0n) return { ineligible: 'no_revenue' };
  if (!isCalendarYear(funnel)) return { ineligible: 'non_calendar' };
  return { funnel };
}

/** The orgnrs of the subject's pool: funnel stages 1–3 at the Standard band. */
export async function poolOf(funnel: FunnelSubject): Promise<string[]> {
  if (funnel.naeringskode1 === null) return [];
  const candidates = await loadCandidates(funnel.orgnr, funnel.naeringskode1, funnel.filingYear);
  // Band 0 is the Standard band (0.5–2× the subject's revenue).
  return assemblePeerGroup(funnel, candidates, 0).pool.map((peer) => peer.orgnr);
}

export async function closeReader(): Promise<void> {
  await readerSql().end();
}
