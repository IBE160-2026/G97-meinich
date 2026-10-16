// Before anything streams: the cheap subject lookup decides a 404 while the
// status can still be set, so an invalid orgnr (front page with its message)
// and a valid orgnr Peerless has no data for (the not-found state) both
// answer HTTP 404; the root not-found page renders both. A failed read
// renders the lookup-error state here. The lookup is cached, so the page
// reads the same row without a second query.
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { URL_CONTEXT } from '@/analysis/view';
import { LookupError } from '@/components/analysis/lookup-error';
import { lookupSubject } from '@/server/analysis';
import { parseSegments } from '@/url/analysis-state';

export default async function AnalysisLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ orgnr: string }>;
}) {
  const { orgnr } = await params;
  const parsed = parseSegments({ orgnr }, '', URL_CONTEXT);
  if (parsed.kind !== 'analysis') notFound();
  const lookup = await lookupSubject(parsed.state.orgnr);
  if (lookup.kind === 'failed') return <LookupError />;
  if (lookup.kind === 'absent') notFound();
  return children;
}
