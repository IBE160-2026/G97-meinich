import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '@/messages';

// Header per DESIGN.md: wordmark left, compact search, "Slik fungerer
// Peerless" right-aligned, 1px divider below. On the phone the link wraps to
// two lines (max ~92px) and the search takes a full-width second row; a
// two-row header is never sticky. The search is hidden on the front page.
// No item for a non-v1 feature.
//
// The search comes in as `search` (the root layout passes the server-side
// HeaderSearchSlot), so this component imports nothing server-only and the
// global error page can render the header without it.
export function SiteHeader({ search }: { readonly search?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-divider bg-background px-gutter-phone py-2.5 md:flex-nowrap md:gap-5 md:px-gutter-desktop md:py-3">
      <Link
        href="/"
        className="text-[17px] font-bold tracking-[0.01em] whitespace-nowrap text-navy-700 no-underline"
      >
        {t('shell.brand')}
      </Link>
      {search}
      <Link
        href="/slik-fungerer-peerless"
        data-testid="header-how"
        className="ml-auto max-w-[92px] text-right text-[12.5px] leading-[1.2] text-link md:max-w-none md:text-[13.5px] md:leading-[1.45] md:whitespace-nowrap"
      >
        {t('shell.how')}
      </Link>
    </header>
  );
}
