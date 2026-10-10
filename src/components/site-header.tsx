import Link from 'next/link';
import { t } from '@/messages';

// Header per DESIGN.md: wordmark left, "Slik fungerer Peerless" right-aligned,
// 1px divider below. On the phone the link wraps to two lines (max ~92px).
// No search field yet (later story) and no item for a non-v1 feature.
export function SiteHeader() {
  return (
    <header className="flex items-center gap-3 border-b border-divider bg-background px-gutter-phone py-2.5 md:gap-5 md:px-gutter-desktop md:py-3">
      <Link
        href="/"
        className="text-[17px] font-bold tracking-[0.01em] whitespace-nowrap text-navy-700 no-underline"
      >
        {t('shell.brand')}
      </Link>
      {/* /slik-fungerer-peerless is built in a later story (1.6b). */}
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
