// The analysis loading state (EXPERIENCE.md "Loading"): `main` with
// aria-busy="true" and Skeleton placeholders — grey blocks in the shape of
// the company header and the card layout, hidden from assistive technology.
// They pulse only where motion is allowed. A local Skeleton: shadcn is not
// installed in Epic 1.
//
// It is the Suspense fallback inside the analysis page, below the 404 and
// redirect decisions, so it covers the page-level work Stories 1.7–1.9 add
// without starting the stream before a 404 or a 307 is decided.
function Skeleton({ className }: { readonly className: string }) {
  return <div className={`rounded-md bg-surface motion-safe:animate-pulse ${className}`} />;
}

export function AnalysisLoading() {
  return (
    <main id="innhold" aria-busy="true" className="flex-1">
      <div aria-hidden="true" data-testid="analysis-skeleton">
        <div className="px-gutter-phone pt-4 md:px-gutter-desktop md:pt-[22px]">
          <Skeleton className="mb-2 h-7 w-3/5 max-w-[360px]" />
          <Skeleton className="h-4 w-4/5 max-w-[560px]" />
        </div>
        <div className="mt-4 border-b border-divider px-gutter-phone pb-3 md:px-gutter-desktop">
          <Skeleton className="h-5 w-full max-w-[320px]" />
        </div>
        <div className="grid grid-cols-1 gap-grid-gap-phone px-gutter-phone pt-6 md:grid-cols-12 md:gap-grid-gap md:px-gutter-desktop md:pt-8">
          <Skeleton className="h-48 rounded-lg md:col-span-5" />
          <Skeleton className="h-48 rounded-lg md:col-span-7" />
          <Skeleton className="h-28 rounded-lg md:col-span-4" />
          <Skeleton className="h-28 rounded-lg md:col-span-4" />
          <Skeleton className="h-28 rounded-lg md:col-span-4" />
        </div>
      </div>
    </main>
  );
}
