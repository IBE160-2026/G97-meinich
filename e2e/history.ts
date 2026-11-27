// The browser's session history length, which the peer-group changes
// (Story 2.8) and the Verdi controls (Stories 3.5, 3.6) are tested against:
// a change pushes one entry, a share or multiple replaces it.
import type { Page } from '@playwright/test';
import { expect } from './fixtures.ts';

/**
 * The length now: the baseline a later `expectHistoryLength` compares with.
 * The caller reads it once the page shows what it waits for; history.length
 * changes only when the test navigates.
 */
export function historyLength(page: Page): Promise<number> {
  return page.evaluate(() => window.history.length);
}

/** The length, polled until it is what the test expects (Epic 3 retro action 8). */
export const expectHistoryLength = (page: Page, message?: string) =>
  expect.poll(() => page.evaluate(() => window.history.length), message);
