// The database half of `pnpm analysis:layers` (Story 5.2): each labelled
// subject as the analysis page reads it, its candidate filings, and, for the
// labelled companies, the stored facts behind a missing signal. The subject
// and candidates come from the page's own reads (src/server/analysis.ts),
// the path analysis/labelled-set/draw-compute.ts uses, so nothing here
// selects a peer: scripts/layer-measurement.ts runs the funnel
// (src/engine/peers.ts) on what this returns.
//
// Imported through Vite's module runner by scripts/layer-measurement.ts, for
// the same reason as scripts/document-set-compute.ts: src/server begins with
// `import 'server-only'`, which needs the bundler's resolution. It imports
// only types from that module, which is the CLI entry.
import { funnelSubject } from '../src/analysis/view.ts';
import { loadCandidates, loadSubject } from '../src/server/analysis.ts';
import { readerSql } from '../src/server/db.ts';
import type { CompanyFacts, MeasurementData, SubjectData } from './layer-measurement.ts';

// For each orgnr asked ($1) and the labelled filing year ($2): whether the
// company is stored, its document's status and its current column's, whether
// it has a fingerprint for that year, and its classification's status and
// type. Read as `reader`, which holds SELECT on each table.
const FACTS_SQL = `
select o.orgnr,
       c.orgnr is not null as company_exists,
       d.status as document_status,
       cur.status as current_status,
       exists (select 1 from register.fingerprint fp
                where fp.orgnr = o.orgnr and fp.filing_year = $2::smallint) as has_fingerprint,
       cl.status as classification_status,
       cl.business_type as classification_type
  from unnest($1::text[]) as o(orgnr)
  left join register.company c on c.orgnr = o.orgnr
  left join register.document d on d.orgnr = o.orgnr and d.filing_year = $2::smallint
  left join register.document_column cur
         on cur.orgnr = d.orgnr and cur.filing_year = d.filing_year and cur.role = 'current'
  left join register.classification cl on cl.orgnr = o.orgnr`;

type FactsRow = {
  orgnr: string;
  company_exists: boolean;
  document_status: string | null;
  current_status: string | null;
  has_fingerprint: boolean;
  classification_status: string | null;
  classification_type: string | null;
};

/** The labelled subjects in the order asked, each with its candidate filings and the facts of every company in its pairs. */
export async function loadMeasurementData(
  subjects: readonly { readonly orgnr: string; readonly filingYear: number; readonly candidates: readonly string[] }[],
): Promise<MeasurementData> {
  const years = new Set(subjects.map((subject) => subject.filingYear));
  const orgnrs = [...new Set(subjects.flatMap((subject) => [subject.orgnr, ...subject.candidates]))];
  const facts = new Map<string, CompanyFacts>();
  for (const year of years) {
    const rows = await readerSql().unsafe<FactsRow[]>(FACTS_SQL, [orgnrs, year]);
    for (const row of rows) {
      facts.set(`${row.orgnr}/${year}`, {
        companyExists: row.company_exists,
        documentStatus: row.document_status,
        currentStatus: row.current_status,
        hasFingerprint: row.has_fingerprint,
        classificationStatus: row.classification_status,
        classificationType: row.classification_type,
      });
    }
  }
  let fingerprinted = 0;
  const counted = new Set<string>();
  for (const subject of subjects) {
    for (const orgnr of [subject.orgnr, ...subject.candidates]) {
      if (counted.has(orgnr)) continue;
      counted.add(orgnr);
      if (facts.get(`${orgnr}/${subject.filingYear}`)?.hasFingerprint === true) fingerprinted += 1;
    }
  }

  const out: SubjectData[] = [];
  for (const [index, drawn] of subjects.entries()) {
    const subject = await loadSubject(drawn.orgnr);
    const funnel = subject === null ? null : funnelSubject(subject);
    if (funnel === null || funnel.naeringskode1 === null) {
      throw new Error(`labelled subject ${index + 1} (drawn.json order) has no stored company or benchmark filing`);
    }
    const candidates = await loadCandidates(funnel.orgnr, funnel.naeringskode1, funnel.filingYear);
    const own = new Map<string, CompanyFacts>();
    for (const orgnr of [drawn.orgnr, ...drawn.candidates]) {
      const fact = facts.get(`${orgnr}/${drawn.filingYear}`);
      if (fact === undefined) throw new Error(`no facts read for a company of labelled subject ${index + 1}`);
      own.set(orgnr, fact);
    }
    out.push({ orgnr: drawn.orgnr, funnel, candidates, facts: own });
  }
  return { companies: counted.size, fingerprinted, subjects: out };
}

export async function closeReader(): Promise<void> {
  await readerSql().end();
}
