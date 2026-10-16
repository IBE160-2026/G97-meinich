// Every 404, with the header and footer (Story 1.6b). The analysis layout
// calls notFound() for an invalid orgnr and for a valid orgnr Peerless has
// no data for, before anything streams; Next.js renders that 404 from the
// root not-found page, not a nested one, so both analysis cases are told
// apart here by NotFoundBody from the path. The coverage copy is read at
// request time from register.covered_industry; if that read fails, the
// lookup-error state shows instead.
import { connection } from 'next/server';
import { LookupError } from '@/components/analysis/lookup-error';
import { NotFoundBody } from '@/components/analysis/not-found-body';
import { industryInSentence, industryNamed, joinList, type CoveredIndustry } from '@/messages/industry';
import { coveredIndustries } from '@/server/search';

export default async function NotFound() {
  await connection();
  let industries: CoveredIndustry[];
  try {
    industries = await coveredIndustries();
  } catch {
    console.error('not-found: coverage read failed');
    return <LookupError />;
  }
  return (
    <NotFoundBody
      lead={joinList(industries.map(industryNamed))}
      coverage={joinList(industries.map(industryInSentence))}
    />
  );
}
