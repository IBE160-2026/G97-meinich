'use client';

// Focus after a client-side navigation (EXPERIENCE.md "Status messages and
// focus"): a tab change moves focus to the panel's h2, any other route
// change to the element the URL's hash names (focusable with tabIndex -1),
// or else to the page's h1. Mounted once in the root layout, so it sees every
// pathname change; the first render (a full page load) focuses nothing.
//
// It keeps the previous pathname in a ref and parses both with the URL
// module: the same orgnr with another tab is a tab change. The target may not
// be in the document yet while a loading state shows, so it waits for it,
// for at most a few seconds.
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { PANEL_HEADING_ID, PATH_CONTEXT } from '@/analysis/view';
import { parse } from '@/url/analysis-state';

const WAIT_MS = 5000;

// The bare path is not a tab: a search opens a company's bare path, and the
// server's redirect to its Oversikt tab reaches usePathname as a second change.
// That arrival is a route change to the company (focus its h1), not a tab
// change (Story 1.9).
function isTabChange(from: string, to: string): boolean {
  const before = parse(from, PATH_CONTEXT);
  const after = parse(to, PATH_CONTEXT);
  return (
    before.kind === 'analysis' &&
    after.kind === 'analysis' &&
    before.state.orgnr === after.state.orgnr &&
    before.state.fane !== null &&
    after.state.fane !== null
  );
}

/** The element the URL's hash names (the footer's "#kilder"), if there is one. */
function hashTarget(): HTMLElement | null {
  const hash = window.location.hash.slice(1);
  if (hash === '') return null;
  let id = hash;
  try {
    id = decodeURIComponent(hash);
  } catch {
    // A malformed escape names no element we render.
  }
  return document.getElementById(id);
}

function target(tabChange: boolean): HTMLElement | null {
  // While the new page streams in, the old page can still be in the
  // document beside the loading state, or beside the new page. Wait until no
  // loading state and one main is left, so focus never lands on the old page.
  if (document.querySelector('main[aria-busy="true"]') !== null) return null;
  if (document.querySelectorAll('main').length > 1) return null;
  if (tabChange) return document.getElementById(PANEL_HEADING_ID);
  const hash = hashTarget();
  if (hash !== null) return hash;
  return document.querySelector<HTMLElement>('main h1');
}

export function FocusManager() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === pathname) return;
    const tabChange = isTabChange(from, pathname);
    const started = Date.now();
    let frame = 0;
    const attempt = () => {
      const element = target(tabChange);
      if (element !== null) {
        element.focus();
        return;
      }
      if (Date.now() - started < WAIT_MS) frame = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
