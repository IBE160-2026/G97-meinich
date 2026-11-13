'use client';

// The analysis error boundary: an error thrown below the analysis segment
// and outside the [orgnr] segment's own error.tsx — in practice the [orgnr]
// layout's subject read — renders the lookup-error state (role="alert", no
// partial figures). The error itself is never rendered. A failed subject
// read in the layout throws before streaming: Next.js answers 500 with its
// error shell and renders this boundary on the client, inside the root
// layout. An error in a page reaches [orgnr]/error.tsx, which shows the
// same state, or recovers from a failed peer-group change (Story 2.8).
import { LookupError } from '@/components/analysis/lookup-error';

export default function AnalysisError() {
  return <LookupError />;
}
