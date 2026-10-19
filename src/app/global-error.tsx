'use client';

// The global error page: what an error that no nearer error boundary
// catches renders — one thrown by the root layout itself, or by the front
// page (src/app/page.tsx, its failed coverage read). A failed subject
// read in the analysis layout is caught nearer, by the analysis segment's error.tsx
// (Next.js answers 500 and renders that boundary on the client). This page
// replaces the root layout, so it brings its own <html lang="nb"> and
// <body>, the fonts and styles, and the header and footer (the header
// without its search, which needs a database read).
//
// It shows only the lookup-error state, role="alert" "Noe gikk galt. Prøv
// igjen om litt.": the `error` prop (message, digest, stack) is never read.
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './globals.css';
import { LookupError } from '@/components/analysis/lookup-error';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { t } from '@/messages';

export default function GlobalError() {
  return (
    <html lang="nb">
      <head>
        <title>{t('shell.brand')}</title>
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <LookupError />
        <SiteFooter />
      </body>
    </html>
  );
}
