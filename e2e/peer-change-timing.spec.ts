// Recompute and render times (Story 2.8; NFR1, NFR2, NFR27 / SM-5): in a
// real browser against the production build and the loaded demo seed, the
// time from opening demo A's Peers tab to the rendered analysis, and from a
// peer-group change (exclude, restore, a band step, reset) to the
// re-rendered analysis, which is when the change's announcement fills the
// live region. Each time is printed and attached to the test as an
// annotation, for the PR. The bound is the target's "within a few seconds"
// (NFR2), held loosely so a slow CI machine does not fail it; the numbers
// recorded in the PR are what matter.
import type { Page } from '@playwright/test';
import nb from '../src/messages/nb.json' with { type: 'json' };
import { expect, test } from './fixtures.ts';
import { A, expectedGroup } from './seed.ts';

const PEERS = `/analyse/${A.orgnr ?? ''}/peers`;
const FEW_SECONDS_MS = 5000;
const ROUNDS = 3;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

/**
 * Milliseconds from `act` to the announcement of the change it makes: the
 * live region holds a new, non-empty sentence (the provider fills it 50 ms
 * after the commit, which the time includes).
 */
async function timed(page: Page, act: () => Promise<void>): Promise<number> {
  const status = page.getByTestId('peer-change-status');
  const previous = await status.textContent();
  const started = Date.now();
  await act();
  await expect
    .poll(
      async () => {
        const text = await status.textContent();
        return text !== null && text !== '' && text !== previous;
      },
      { timeout: FEW_SECONDS_MS * 2, intervals: [10] },
    )
    .toBe(true);
  return Date.now() - started;
}

test('the time to the re-rendered analysis after each peer-group change (recorded in the PR)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const peer = expectedGroup(A.orgnr ?? '', 0)[0]?.orgnr ?? '';
  const times: Record<string, number[]> = { load: [], exclude: [], restore: [], band: [], reset: [] };

  for (let round = 0; round < ROUNDS; round += 1) {
    const started = Date.now();
    await page.goto(PEERS);
    await expect(page.getByTestId('size-band')).toBeVisible();
    times.load?.push(Date.now() - started);

    times.exclude?.push(await timed(page, () => page.locator(`[data-peer-action="${peer}"]:visible`).click()));
    times.restore?.push(await timed(page, () => page.locator(`[data-peer-action="${peer}"]:visible`).click()));
    times.band?.push(await timed(page, () => page.locator('[data-band-step="1"]').click()));
    times.reset?.push(await timed(page, () => page.getByRole('link', { name: nb['peers.reset'] }).click()));
  }

  for (const [name, values] of Object.entries(times)) {
    const line = `${name}: median ${median(values)} ms (${values.join(', ')} ms)`;
    console.log(`peer-change timing, demo A Peers tab, ${line}`);
    test.info().annotations.push({ type: 'timing', description: line });
    expect(median(values)).toBeLessThan(FEW_SECONDS_MS);
  }
});
