'use client';

// The invalid-settings notice (EXPERIENCE.md "Invalid URL state"): one slate
// line under the company header, announced once after load. The live region
// is rendered empty and filled after mount, so assistive technology sees a
// change to announce rather than a region that arrived already filled.
import { useEffect, useState } from 'react';
import { t } from '@/messages';

export function SettingsNotice({ show }: { readonly show: boolean }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setFilled(true), 50);
    return () => clearTimeout(timer);
  }, [show]);
  return (
    <div role="status" data-testid="settings-notice" className="px-gutter-phone text-[13px] text-slate md:px-gutter-desktop">
      {show && filled ? <p className="m-0 mt-2">{t('analysis.notice')}</p> : null}
    </div>
  );
}
