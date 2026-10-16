'use client';

// The analysis error boundary: any error thrown below the analysis segment
// renders the lookup-error state (role="alert", no partial figures). The
// error itself is never rendered. A failed subject read in the layout throws
// before streaming: Next.js answers 500 with its error shell and renders this
// boundary on the client, inside the root layout.
import { LookupError } from '@/components/analysis/lookup-error';

export default function AnalysisError() {
  return <LookupError />;
}
