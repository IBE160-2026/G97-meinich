// The acceptance set of Story 2.1b's document run, computed from the loaded
// database (see scripts/document-set.ts). Demo companies A and B and, for
// each, its candidate pool at the standard size band: funnel stages 1–3 as
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
import { assemblePeerGroup } from '../src/engine/peers.ts';
import { loadCandidates, loadSubject } from '../src/server/analysis.ts';
import { readerSql } from '../src/server/db.ts';

/** A subject and the orgnrs of its candidate pool. */
export interface SubjectPool {
  readonly subject: string;
  readonly pool: readonly { readonly orgnr: string }[];
}

/** Demo A's and B's pools at the standard band. */
export async function demoPools(): Promise<SubjectPool[]> {
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
    // Band 0 is the standard band (0.5–2× the subject's revenue).
    groups.push({ subject: demo.orgnr, pool: assemblePeerGroup(funnel, candidates, 0).pool });
  }
  return groups;
}

export async function closeReader(): Promise<void> {
  await readerSql().end();
}
