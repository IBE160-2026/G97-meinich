'use client';

// The compact search in the header (UX-DR7; Story 1.6b), on every page but
// the front page, whose hero search takes its place, and an analysis URL
// with an invalid orgnr, which shows the front page's content and its hero
// field. Below `md` it takes a full-width second row under the wordmark and
// the link; from `md` it sits inline between them.
import { usePathname } from 'next/navigation';
import { URL_CONTEXT } from '@/analysis/view';
import { SearchField } from '@/components/search-field';
import { parse } from '@/url/analysis-state';

/** Whether the page at `pathname` shows the front page's hero search instead. */
export function showsHeroSearch(pathname: string): boolean {
  return pathname === '/' || parse(pathname, URL_CONTEXT).kind === 'invalid-orgnr';
}

export function HeaderSearch({ coverage }: { readonly coverage: string }) {
  const pathname = usePathname();
  if (showsHeroSearch(pathname)) return null;
  return (
    <div className="order-last w-full min-w-0 basis-full md:order-none md:max-w-[420px] md:flex-1 md:basis-auto">
      <SearchField variant="compact" coverage={coverage} />
    </div>
  );
}
