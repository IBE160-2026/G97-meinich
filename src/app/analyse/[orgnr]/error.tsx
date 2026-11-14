'use client';

// The error boundary inside the analysis layout (Story 2.8). A peer-group
// change is a soft navigation; when its render fails (a database or engine
// error), Next.js answers 200 with the error in the RSC payload and this
// boundary catches it, with the layout's provider still mounted. While the
// provider has a change in flight, the boundary goes back to the last good
// URL (served from the router cache, no request) and resets itself once the
// query has changed back, because Next.js resets a boundary only on a new
// pathname; the provider shows "Kunne ikke oppdatere analysen. Prøv igjen."
// over the last good figures. Until then it renders nothing, for about one
// frame.
//
// Any other error, the first load of a page included, shows the
// lookup-error state as the analysis segment's error.tsx does, with no detail of
// the error, and never navigates (e2e/db-down.spec.ts).
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LookupError } from '@/components/analysis/lookup-error';
import { usePeerChange } from '@/components/analysis/peer-change';

export default function AnalysisChangeError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  const peerChange = usePeerChange();
  const router = useRouter();
  // Decided once, when the error is caught: was it a change in flight?
  const [recovering] = useState(() => peerChange?.hasChangeInFlight() === true);
  const search = useSearchParams().toString();
  const [failedSearch] = useState(search);
  const fail = peerChange?.fail;

  useEffect(() => {
    if (!recovering) return;
    fail?.();
    router.back();
  }, [recovering, fail, router]);

  useEffect(() => {
    if (recovering && search !== failedSearch) reset();
  }, [recovering, search, failedSearch, reset]);

  if (recovering) return null;
  return <LookupError />;
}
