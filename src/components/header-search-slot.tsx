// The server part of the header search (Story 1.6b): reads the covered
// industries for the search's messages at request time, never at build
// time, and renders nothing if that read fails, so a database error never
// takes the header down with it; the page itself shows the error state.
import { connection } from 'next/server';
import { HeaderSearch } from '@/components/header-search';
import { industryInSentence, joinList } from '@/messages/industry';
import { coveredIndustries } from '@/server/search';

export async function HeaderSearchSlot() {
  await connection();
  let coverage: string;
  try {
    coverage = joinList((await coveredIndustries()).map(industryInSentence));
  } catch {
    console.error('header search: coverage read failed');
    return null;
  }
  return <HeaderSearch coverage={coverage} />;
}
