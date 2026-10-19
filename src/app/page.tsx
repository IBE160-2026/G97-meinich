// The front page (FR-61; EXPERIENCE.md "Forside"); its content is
// FrontPageBody. The header search is hidden here: the hero search takes its
// place (Story 1.6b).
//
// Coverage is read at request time from register.covered_industry, with the
// register's own industry name, so the page is never prerendered with a
// stale or hard-coded industry. A failed read throws a new error with a
// fixed message, so the driver's error (its message, the address) goes no
// further than the one log line below; there is no error.tsx at the root, so
// Next.js answers 500 and src/app/global-error.tsx shows only the alert.
import { connection } from 'next/server';
import { FrontPageBody } from '@/components/front-page-body';
import { failureKind, log } from '@/logger';
import { industryInSentence, industryNamed, joinList, type CoveredIndustry } from '@/messages/industry';
import { coveredIndustries } from '@/server/search';

export default async function HomePage() {
  await connection();
  let industries: CoveredIndustry[];
  try {
    industries = await coveredIndustries();
  } catch (error) {
    // Only the error's class and its Postgres SQLSTATE reach the log.
    log('error', 'home.coverageFailed', { failure: failureKind(error) });
    throw new Error('home: coverage lookup failed');
  }
  return (
    <FrontPageBody
      lead={joinList(industries.map(industryNamed))}
      coverage={joinList(industries.map(industryInSentence))}
    />
  );
}
