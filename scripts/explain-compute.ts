// The default analyses pnpm explain explains (Story 4.1), computed from the
// loaded database as `reader` through the request path's own reads
// (`loadSubject`, `loadCandidates` in src/server/analysis.ts) and the
// page's own functions (`funnelSubject`, `hasPeerGroup`, and
// `defaultAnalysis`, which runs `assemblePeerGroup` and `shownGroup` at the
// standard band with no `ekskl` under `V1_FUNNEL`).
//
// One candidate read per industry and benchmark year, shared by every
// subject of that year: `loadCandidates` is asked with an orgnr no company
// has, so it returns every company's filings, and `assemblePeerGroup`
// ignores the subject's own, exactly as when the read leaves them out
// (src/engine/peers.ts). The result is the page's group; the read is not
// repeated eight thousand times.
//
// Imported through Vite's module runner by scripts/explain.ts and directly
// by test/db/explanation.test.ts, as scripts/document-set-compute.ts is,
// because src/ imports JSON without an import attribute and src/server
// begins with `import 'server-only'`.
import { defaultAnalysis, type DefaultAnalysis } from '../src/analysis/explanation-payload.ts';
import { funnelSubject, hasPeerGroup } from '../src/analysis/view.ts';
import { loadCandidates, loadSubject, type Candidate } from '../src/server/analysis.ts';
import { readerSql } from '../src/server/db.ts';

/** No company has it (modulus 11 fails), so a read asked with it leaves no one out. */
export const NO_SUBJECT = '000000001';

const candidateReads = new Map<string, Promise<Candidate[]>>();

function candidatesOf(naeringskode1: string, filingYear: number): Promise<Candidate[]> {
  const key = `${naeringskode1}/${filingYear}`;
  let read = candidateReads.get(key);
  if (read === undefined) {
    read = loadCandidates(NO_SUBJECT, naeringskode1, filingYear);
    candidateReads.set(key, read);
  }
  return read;
}

/** The AS companies in a covered industry, in byte order of orgnr. */
export async function coveredAsOrgnrs(): Promise<string[]> {
  const rows = await readerSql()<{ orgnr: string }[]>`
    select c.orgnr from register.company c
      join register.covered_industry ci on ci.code = c.naeringskode1
     where c.organisasjonsform = 'AS'
     order by c.orgnr collate "C"`;
  return rows.map((row) => row.orgnr);
}

/** The loaded dataset's tag, or null when no seed is loaded. */
export async function datasetTag(): Promise<'demo' | 'full' | null> {
  const [row] = await readerSql()<{ dataset: string }[]>`select dataset from register.dataset`;
  if (row === undefined) return null;
  if (row.dataset !== 'demo' && row.dataset !== 'full') throw new TypeError(`not a dataset tag: ${JSON.stringify(row.dataset)}`);
  return row.dataset;
}

export type SubjectAnalysis = { readonly kind: 'no_peer_group' } | DefaultAnalysis<Candidate>;

/** One subject's default analysis, or `no_peer_group` when it has no filing (or is not a covered AS). */
export async function subjectAnalysis(orgnr: string): Promise<SubjectAnalysis> {
  const subject = await loadSubject(orgnr);
  if (subject === null || !hasPeerGroup(subject)) return { kind: 'no_peer_group' };
  const funnel = funnelSubject(subject);
  const filing = subject.filing;
  if (funnel === null || filing === null || funnel.naeringskode1 === null) return { kind: 'no_peer_group' };
  return defaultAnalysis(funnel, filing, await candidatesOf(funnel.naeringskode1, funnel.filingYear));
}

export async function closeReader(): Promise<void> {
  await readerSql().end();
}
