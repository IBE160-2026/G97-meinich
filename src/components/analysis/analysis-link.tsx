'use client';
// A link within an analysis (Story 3.5, decision 6): its href is built by
// the URL hook on the page's state with the live share and multiple, so a
// share chosen on Verdi is kept by every later tab change and link. Used by
// the tabs, "· Endre i Verdi", "Se alle {n}", "og {n} til" and "Se alle
// nøkkeltall". No prefetch (Story 2.8): every analysis request counts
// against the rate limit.
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AnalysisTarget } from '@/analysis/peer-change';
import { useAnalysisUrl } from './analysis-url';

export function AnalysisLink({
  target,
  className,
  children,
  ...rest
}: {
  readonly target: AnalysisTarget;
  readonly className?: string;
  readonly children: ReactNode;
  readonly 'aria-current'?: 'page';
  readonly lang?: string;
  readonly 'data-testid'?: string;
  readonly 'data-card'?: string;
}) {
  const { hrefFor } = useAnalysisUrl();
  return (
    <Link href={hrefFor(target)} prefetch={false} className={className} {...rest}>
      {children}
    </Link>
  );
}
