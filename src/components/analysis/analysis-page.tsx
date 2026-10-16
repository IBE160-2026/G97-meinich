// The one server renderer behind both analysis pages (Story 1.6b): the bare
// path and the path with a tab. It parses the URL with the URL module, reads
// the subject once as `reader` (cached with the layout's read), lets
// analysisView pick the state, and redirects (307) or renders it.
//
// The redirect is decided before anything below a Suspense boundary renders:
// once a fallback renders, the response has started with status 200 and a
// redirect could only be streamed. So the loading state is a Suspense
// boundary inside this page, after the decision, not a loading.tsx file,
// which would wrap the page and start the stream first.
//
// Nothing here writes: the reader connection is read-only, and no state
// leaves the URL (no cookie, no browser storage).
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PANEL_HEADING_ID, URL_CONTEXT, analysisView, type AnalysisView, type Subject } from '@/analysis/view';
import { ApiFigures } from '@/components/analysis/api-figures';
import { CompanyHeader } from '@/components/analysis/company-header';
import { AnalysisLoading } from '@/components/analysis/analysis-loading';
import { SettingsNotice } from '@/components/analysis/settings-notice';
import { StateBlock } from '@/components/analysis/state-block';
import { TabLinks } from '@/components/analysis/tab-links';
import { t } from '@/messages';
import { industryInSentence, joinList } from '@/messages/industry';
import { lookupSubject } from '@/server/analysis';
import { coveredIndustries } from '@/server/search';
import { parseSegments, type AnalysisState } from '@/url/analysis-state';

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

async function resolve(segments: Segments, searchParams: SearchParams) {
  const search = searchString(searchParams);
  const parsed = parseSegments(segments, search, URL_CONTEXT);
  const subject = parsed.kind === 'analysis' ? await lookupSubject(parsed.state.orgnr) : null;
  return { parsed, subject, view: analysisView(subject, parsed, search) };
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

function SearchAgain() {
  return (
    <p className="m-0 mt-4">
      <Link href="/" className="inline-flex min-h-6 items-center">
        {t('analysis.searchAgain')}
      </Link>
    </p>
  );
}

function Covered({ state, view }: { readonly state: AnalysisState; readonly view: AnalysisView }) {
  if (view.fane === null) return null;
  return (
    <>
      <TabLinks state={state} active={view.fane} />
      {/* The panel's content arrives with Stories 1.7–1.9. */}
      <section aria-labelledby={PANEL_HEADING_ID} className="px-gutter-phone pt-6 md:px-gutter-desktop md:pt-8">
        <h2 id={PANEL_HEADING_ID} tabIndex={-1} className="m-0 text-xl">
          {t(`tabs.${view.fane}`)}
        </h2>
      </section>
    </>
  );
}

export async function AnalysisPage({
  segments,
  searchParams,
}: {
  readonly segments: Segments;
  readonly searchParams: SearchParams;
}) {
  const { parsed, subject, view } = await resolve(segments, searchParams);
  // The layout has already answered 404 for both; this keeps the types honest.
  if (parsed.kind !== 'analysis' || subject === null) notFound();
  if (view.redirect !== null) redirect(view.redirect);
  return (
    <Suspense fallback={<AnalysisLoading />}>
      <AnalysisBody subject={subject} state={parsed.state} view={view} />
    </Suspense>
  );
}

async function AnalysisBody({
  subject,
  state,
  view,
}: {
  readonly subject: Subject;
  readonly state: AnalysisState;
  readonly view: AnalysisView;
}) {
  const coverage =
    view.state === 'uncovered' ? joinList((await coveredIndustries()).map(industryInSentence)) : '';

  return (
    <main id="innhold" className="flex-1">
      <CompanyHeader subject={subject} />
      <SettingsNotice show={view.notice} />
      {view.state === 'covered' ? <Covered state={state} view={view} /> : null}
      {view.state === 'uncovered' && subject.filing !== null ? (
        <div className="px-gutter-phone pt-6 md:px-gutter-desktop md:pt-8">
          <StateBlock kicker={t('analysis.uncovered.kicker')}>
            <p className="m-0">
              {t('analysis.uncovered.body', { bransje: uncoveredIndustry(subject), industry: coverage })}
            </p>
          </StateBlock>
          <ApiFigures filing={subject.filing} />
          <SearchAgain />
        </div>
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
