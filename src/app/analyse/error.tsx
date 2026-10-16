'use client';

// The analysis error boundary: any error thrown below the analysis segment
// renders the lookup-error state (role="alert", no partial figures). The
// error itself is never rendered. A failed subject read does not throw; the
// layout renders the same state for it (src/server/analysis.ts).
import { LookupError } from '@/components/analysis/lookup-error';

export default function AnalysisError() {
  return <LookupError />;
}
