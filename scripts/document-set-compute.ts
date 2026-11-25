// The acceptance set of Story 2.1b's document run, and the allow-listed
// groups of Story 5.4, computed from the loaded database (see
// scripts/document-set.ts). Demo companies A and B and, for each, its
// candidate pool at a size band: funnel stages 1–3 as
// the analysis page assembles them (src/engine/peers.ts), from the subject
// and candidate reads the page uses (src/server/analysis.ts). Nothing here
// selects a peer itself.
//
// Imported through Vite's module runner by the CLI and directly by
// test/db/document-set.test.ts, because src/ imports JSON without an import
// attribute and src/server begins with `import 'server-only'`, which both
// need the bundler's resolution. It imports nothing from
// scripts/document-set.ts: that module is the CLI entry, and importing it
// back from inside its own top-level await would never settle.
import { funnelSubject } from '../src/analysis/view.ts';
import { DEMO_COMPANIES } from '../src/demo-companies.ts';
import { type SizeBand, assemblePeerGroup } from '../src/engine/peers.ts';
import { loadCandidates, loadSubject } from '../src/server/analysis.ts';
import { readerSql } from '../src/server/db.ts';

/** A subject and the orgnrs of its candidate pool at one size band. */
export interface SubjectPool {
  readonly subject: string;
  readonly band: SizeBand;
  readonly pool: readonly { readonly orgnr: string }[];
}

/**
 * Demo A's and B's pools at each of `bands` (the standard band, 0, unless
 * the caller asks for more), A's before B's, and each company's in the
 * order of `bands`.
 */
export async function demoPools(bands: readonly SizeBand[] = [0]): Promise<SubjectPool[]> {
  const groups: SubjectPool[] = [];
  for (const demo of DEMO_COMPANIES) {
    const subject = await loadSubject(demo.orgnr);
    if (subject === null || !subject.covered) {
      throw new Error(`demo company ${demo.orgnr} is not a stored company in a covered industry; run \`pnpm seed\``);
    }
    const funnel = funnelSubject(subject);
    if (funnel === null || funnel.naeringskode1 === null) {
      throw new Error(`demo company ${demo.orgnr} has no benchmark filing`);
    }
    const candidates = await loadCandidates(funnel.orgnr, funnel.naeringskode1, funnel.filingYear);
    // The pool is stages 1–3: stage 4 (Story 2.5) reads fingerprints that
    // come from these very documents, so it must not narrow the set they
    // are read for. In v1 the shown group is the pool (Story 5.2), and the
    // pool contains the group whatever the funnel switches, so listing the
    // pool lists the group.
    for (const band of bands) {
      groups.push({ subject: demo.orgnr, band, pool: assemblePeerGroup(funnel, candidates, band).pool });
    }
  }
  return groups;
}

export async function closeReader(): Promise<void> {
  await readerSql().end();
}
