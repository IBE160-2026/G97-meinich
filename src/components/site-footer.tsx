import Link from 'next/link';
import { t } from '@/messages';

// The source line on every page (FR-65): "Data fra Brønnøysundregistrene,
// bearbeidet av Peerless · Kilder og lisens". The link goes to the sources
// section of /slik-fungerer-peerless, which Story 1.6b builds.
export function SiteFooter() {
  return (
    <footer className="mx-gutter-phone mt-7 border-t border-divider pt-4 pb-[22px] text-[12.5px] text-slate md:mx-gutter-desktop md:mt-10">
      <p className="m-0">
        {t('footer.source')}
        {' · '}
        <Link href="/slik-fungerer-peerless#kilder" className="inline-flex min-h-6 items-center">
          {t('footer.sources')}
        </Link>
      </p>
    </footer>
  );
}
