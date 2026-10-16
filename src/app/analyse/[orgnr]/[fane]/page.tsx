// An analysis tab: rendered for a covered company, redirected to the bare
// path for an uncovered company or one with no filing (Story 1.6b).
import type { Metadata } from 'next';
import { AnalysisPage, analysisMetadata, type SearchParams } from '@/components/analysis/analysis-page';

type Props = {
  readonly params: Promise<{ orgnr: string; fane: string }>;
  readonly searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return analysisMetadata(await params, await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  return <AnalysisPage segments={await params} searchParams={await searchParams} />;
}
