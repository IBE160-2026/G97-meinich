import { t } from '@/messages';

// Source-line placeholder. The "Kilder og lisens" link joins it when the
// about page exists.
export function SiteFooter() {
  return (
    <footer className="mx-gutter-phone mt-7 border-t border-divider pt-4 pb-[22px] text-[12.5px] text-slate md:mx-gutter-desktop md:mt-10">
      <p className="m-0">{t('footer.source')}</p>
    </footer>
  );
}
