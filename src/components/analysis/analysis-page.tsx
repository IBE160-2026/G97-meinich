// The one server renderer behind both analysis pages (Story 1.6b): the bare
// path and the path with a tab. It reads the subject once as `reader`
// (cached with the layout's read) and, for a covered AS with a filing, its
// candidate filings in one more read (Story 1.7). It then parses the URL
// with the URL module, the candidate pool at each band deciding `ekskl`,
// lets analysisView pick the state, and redirects (307) or renders it.
//
// The redirect is decided before anything below a Suspense boundary renders:
// once a fallback renders, the response has started with status 200 and a
// redirect could only be streamed. So the loading state is a Suspense
// boundary inside this page, after the decision, not a loading.tsx file,
// which would wrap the page and start the stream first. Every read happens
// before that boundary too, the coverage read for an uncovered company
// included, so a failed read answers 500, never a streamed 200.
//
// Nothing here writes: the reader connection is read-only, and no state
// leaves the URL (no cookie, no browser storage).
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  PANEL_HEADING_ID,
  PATH_CONTEXT,
  analysisView,
  funnelSubject,
  hasPeerGroup,
  urlContext,
  type AnalysisView,
  type Subject,
} from '@/analysis/view';
import { shownGroup, type ShownGroup as ShownGroupOf } from '@/analysis/shown-group';
import { ApiFigures } from '@/components/analysis/api-figures';
import { CompanyHeader } from '@/components/analysis/company-header';
import { KeyFigureTable } from '@/components/analysis/key-figure-table';
import { AnalysisLoading } from '@/components/analysis/analysis-loading';
import { OversiktHero } from '@/components/analysis/oversikt-hero';
import { PeerList } from '@/components/analysis/peer-list';
import { SettingsNotice } from '@/components/analysis/settings-notice';
import { StateBlock } from '@/components/analysis/state-block';
import { TabLinks } from '@/components/analysis/tab-links';
import { formatOrgnr } from '@/engine/format';
import { assemblePeerGroup, type PeerGroup } from '@/engine/peers';
import { failureKind, log } from '@/logger';
import { t } from '@/messages';
import { industryInSentence, joinList } from '@/messages/industry';
import { lookupCandidates, lookupSubject, type Candidate } from '@/server/analysis';
import { coveredIndustries } from '@/server/search';
import { parseSegments, type AnalysisState, type Band } from '@/url/analysis-state';

export type Segments = { readonly orgnr: string; readonly fane?: string };
export type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** The query as requested, rebuilt from Next.js's searchParams: "" or "?…". */
export function searchString(searchParams: SearchParams): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(name, item);
  }
  const text = query.toString();
  return text === '' ? '' : `?${text}`;
}

/** The peer group as the page shows it (src/analysis/shown-group.ts). */
type ShownGroup = ShownGroupOf<Candidate>;

const NO_POOL: ReadonlySet<string> = new Set();

async function resolve(segments: Segments, searchParams: SearchParams) {
  const search = searchString(searchParams);
  // The path names the company; the query is parsed again below, once the
  // candidate pool is known.
  const path = parseSegments(segments, search, PATH_CONTEXT);
  const subject = path.kind === 'analysis' ? await lookupSubject(path.state.orgnr) : null;

  // Read before analysisView and the redirect decision: an `ekskl` outside
  // the pool sets the notice, which changes how a redirect keeps the query.
  const funnel = subject !== null && hasPeerGroup(subject) ? funnelSubject(subject) : null;
  const candidates =
    funnel !== null && funnel.naeringskode1 !== null
      ? await lookupCandidates(funnel.orgnr, funnel.naeringskode1, funnel.filingYear)
      : [];

  // Each band's group, computed on demand from the one read.
  const groups = new Map<Band, { readonly group: PeerGroup<Candidate>; readonly orgnrs: ReadonlySet<string> }>();
  const groupAt = (band: Band) => {
    if (funnel === null) return null;
    let entry = groups.get(band);
    if (entry === undefined) {
      const group = assemblePeerGroup(funnel, candidates, band);
      entry = { group, orgnrs: new Set(group.pool.map((peer) => peer.orgnr)) };
      groups.set(band, entry);
    }
    return entry;
  };

  // A subject without a peer group has an empty pool: every `ekskl` item
  // is dropped with the notice.
  const parsed = parseSegments(segments, search, urlContext((band) => groupAt(band)?.orgnrs ?? NO_POOL));
  const at = parsed.kind === 'analysis' ? groupAt(parsed.state.band) : null;
  const filing = subject?.filing ?? null;
  const group =
    at === null || parsed.kind !== 'analysis' || filing === null
      ? null
      : shownGroup(at.group.pool, parsed.state.ekskl, at.group.emptyReason, filing);
  return { parsed, subject, group, view: analysisView(subject, parsed, search) };
}

export async function analysisMetadata(segments: Segments, searchParams: SearchParams): Promise<Metadata> {
  const { view } = await resolve(segments, searchParams);
  return { title: view.title };
}

/** "{Bransjenavn} ({kode})" as the register names it, for the uncovered statement. */
function uncoveredIndustry(subject: Subject): string {
  const { naeringskode1: code, naeringskode1Beskrivelse: beskrivelse } = subject;
  if (code !== null && beskrivelse !== null) return t('industry.inSentence', { navn: beskrivelse, kode: code });
  return code ?? beskrivelse ?? t('analysis.uncovered.unknownIndustry');
}

/**
 * The covered industries as the uncovered statement names them. A failed
 * read throws a new error with a fixed message, so the driver's error goes
 * no further than the one log line below.
 */
async function uncoveredCoverage(): Promise<string> {
  try {
    return joinList((await coveredIndustries()).map(industryInSentence));
  } catch (error) {
    // Only the error's class and its Postgres SQLSTATE reach the log.
    log('error', 'analysis.coverageFailed', { failure: failureKind(error) });
    throw new Error('analysis: coverage lookup failed');
  }
}

function SearchAgain() {
  return (
    <p className="m-0 mt-4">
      <Link href="/" className="inline-flex min-h-6 items-center">
        {t('analysis.searchAgain')}
      </Link>
    </p>
  );
}

function Covered({
  subject,
  state,
  view,
  group,
}: {
  readonly subject: Subject;
  readonly state: AnalysisState;
  readonly view: AnalysisView;
  readonly group: ShownGroup;
}) {
  if (view.fane === null) return null;
  return (
    <>
      <TabLinks state={state} active={view.fane} />
      <section aria-labelledby={PANEL_HEADING_ID} className="px-gutter-phone pt-6 md:px-gutter-desktop md:pt-8">
        <h2 id={PANEL_HEADING_ID} tabIndex={-1} className="m-0 text-xl">
          {t(`tabs.${view.fane}`)}
        </h2>
        {view.fane === 'oversikt' ? (
          <OversiktHero
            figure={group.benchmark.driftsmargin}
            state={state}
            emptyReason={group.emptyReason}
            filingYear={group.filingYear}
          />
        ) : null}
        {view.fane === 'peers' ? (
          <PeerList
            peers={group.peers}
            valuta={group.valuta}
            emptyReason={group.emptyReason}
            filingYear={group.filingYear}
          />
        ) : null}
        {view.fane === 'nokkeltall' ? (
          <KeyFigureTable
            benchmark={group.benchmark}
            companyName={subject.navn ?? formatOrgnr(subject.orgnr)}
            smaaForetak={group.smaaForetak}
          />
        ) : null}
      </section>
    </>
  );
}

/** The uncovered and non-AS states: a State block, the subject's own API figures, a way on. No peers. */
function OwnFigures({
  subject,
  kicker,
  body,
}: {
  readonly subject: Subject;
  readonly kicker: string;
  readonly body: string;
}) {
  if (subject.filing === null) return null;
  return (
    <div className="px-gutter-phone pt-6 md:px-gutter-desktop md:pt-8">
      <StateBlock kicker={kicker}>
        <p className="m-0">{body}</p>
      </StateBlock>
      <ApiFigures filing={subject.filing} />
      <SearchAgain />
    </div>
  );
}

export async function AnalysisPage({
  segments,
  searchParams,
}: {
  readonly segments: Segments;
  readonly searchParams: SearchParams;
}) {
  const { parsed, subject, group, view } = await resolve(segments, searchParams);
  // The layout has already answered 404 for both; this keeps the types honest.
  if (parsed.kind !== 'analysis' || subject === null) notFound();
  if (view.redirect !== null) redirect(view.redirect);
  // Read before the Suspense boundary, like the subject and the candidates.
  const coverage = view.state === 'uncovered' ? await uncoveredCoverage() : '';
  return (
    <Suspense fallback={<AnalysisLoading />}>
      <AnalysisBody subject={subject} state={parsed.state} view={view} group={group} coverage={coverage} />
    </Suspense>
  );
}

function AnalysisBody({
  subject,
  state,
  view,
  group,
  coverage,
}: {
  readonly subject: Subject;
  readonly state: AnalysisState;
  readonly view: AnalysisView;
  readonly group: ShownGroup | null;
  /** The covered industries, for the uncovered statement; "" in every other state. */
  readonly coverage: string;
}) {
  const coveredGroup = view.state === 'covered' ? group : null;

  return (
    <main id="innhold" className="flex-1">
      <CompanyHeader subject={subject} peerCount={coveredGroup?.peers.length} />
      <SettingsNotice show={view.notice} />
      {coveredGroup !== null ? <Covered subject={subject} state={state} view={view} group={coveredGroup} /> : null}
      {view.state === 'uncovered' ? (
        <OwnFigures
          subject={subject}
          kicker={t('analysis.uncovered.kicker')}
          body={t('analysis.uncovered.body', { bransje: uncoveredIndustry(subject), industry: coverage })}
        />
      ) : null}
      {view.state === 'non-as' ? (
        <OwnFigures subject={subject} kicker={t('analysis.nonAs.kicker')} body={t('analysis.nonAs.body')} />
      ) : null}
      {view.state === 'no-filing' ? (
        <div className="px-gutter-phone pt-6 md:px-gutter-desktop md:pt-8">
          <StateBlock>
            <p className="m-0">{t('analysis.noFiling')}</p>
          </StateBlock>
        </div>
      ) : null}
    </main>
  );
}
