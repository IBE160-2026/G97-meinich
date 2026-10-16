// The front page (FR-61; EXPERIENCE.md "Forside"); its content is
// FrontPageBody. The header search is hidden here: the hero search takes its
// place (Story 1.6b).
//
// Coverage is read at request time from register.covered_industry, with the
// register's own industry name, so the page is never prerendered with a
// stale or hard-coded industry.
import { connection } from 'next/server';
import { FrontPageBody } from '@/components/front-page-body';
import { industryInSentence, industryNamed, joinList } from '@/messages/industry';
import { coveredIndustries } from '@/server/search';

export default async function HomePage() {
  await connection();
  const industries = await coveredIndustries();
  return (
    <FrontPageBody
      lead={joinList(industries.map(industryNamed))}
      coverage={joinList(industries.map(industryInSentence))}
    />
  );
}
