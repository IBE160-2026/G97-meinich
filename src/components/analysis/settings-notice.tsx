'use client';

// The invalid-settings notice (EXPERIENCE.md "Invalid URL state"): one slate
// line under the company header, announced once after load. Story 5.4: the
// median notice, when `andel=median` fell back for a group with no median
// step, is a line of its own in the same region. The live region
// is rendered empty and filled after mount, so assistive technology sees a
// change to announce rather than a region that arrived already filled.
import { useEffect, useState } from 'react';
import { t } from '@/messages';

export function SettingsNotice({ show, median }: { readonly show: boolean; readonly median: boolean }) {
  const [filled, setFilled] = useState(false);
  const any = show || median;
  useEffect(() => {
    if (!any) return;
    const timer = setTimeout(() => setFilled(true), 50);
    return () => clearTimeout(timer);
  }, [any]);
  return (
    <div role="status" data-testid="settings-notice" className="px-gutter-phone text-[13px] text-slate md:px-gutter-desktop">
      {show && filled ? <p className="m-0 mt-2">{t('analysis.notice')}</p> : null}
      {median && filled ? <p className="m-0 mt-2">{t('analysis.notice.median')}</p> : null}
    </div>
  );
}
