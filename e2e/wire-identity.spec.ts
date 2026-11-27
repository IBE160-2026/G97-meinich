// AD-6's identity test (Story 3.5, decision 7): for the same wire values,
// the server (Node) and a real browser engine (Chromium) write
// byte-identical Verdi texts at every closable share, and (Story 3.6) with
// every multiple: the EV value, its product line and its announcement. The browser runs a
// vite bundle of the same modules the page ships (src/analysis/verdi-view.ts
// and the engine under it), loaded into an empty page: no route, no server.
// No new dependency: vite is the one Vitest already runs on.
import path from 'node:path';
import { build } from 'vite';
import { expect, test } from './fixtures.ts';
import { texts } from './wire-identity/entry.ts';
import { MULTIPLES, WIRES } from './wire-identity/fixtures.ts';

const root = path.resolve(import.meta.dirname, '..');
const NBSP = ' ';
const MINUS = '−';

/** The entry bundled as one script that sets `globalThis.WireIdentity`. */
async function bundle(): Promise<string> {
  const output = await build({
    configFile: false,
    logLevel: 'silent',
    root,
    resolve: { alias: { '@': path.join(root, 'src') } },
    build: {
      write: false,
      minify: false,
      lib: { entry: path.join(root, 'e2e/wire-identity/entry.ts'), formats: ['iife'], name: 'WireIdentity' },
    },
  });
  const results = Array.isArray(output) ? output : [output];
  for (const result of results) {
    if ('output' in result) {
      const chunk = result.output.find((item) => item.type === 'chunk');
      if (chunk !== undefined && chunk.type === 'chunk') return chunk.code;
    }
  }
  throw new Error('vite wrote no chunk');
}

test('byte-identical Verdi texts in Node and Chromium for the same wire values', async ({ page }) => {
  const node = texts(WIRES, MULTIPLES);
  // The fixture's state: 40-digit values, a negative and a zero cross the wire, and amounts are written.
  expect(WIRES.map((wire) => JSON.stringify(wire)).join('')).toMatch(/\d{9}\.\d{31}/);
  expect(node).toContain('−');
  expect(node).toContain('0 kr');
  // A half krone of each sign, rounded away from zero: −0,5 kr at the median step and 1,5 kr at 25 %.
  expect(node).toContain(`"${MINUS}1${NBSP}kr av ${MINUS}10${NBSP}kr per år"`);
  expect(node).toContain(`"2${NBSP}kr av 6${NBSP}kr"`);
  // Story 3.6: the multiples are written with a comma, and the 999,5 kr wire's product line reads "≈" at 7.
  expect(node).toContain(`"product":"1${NBSP}000${NBSP}kr × 7 ≈ 6${NBSP}997${NBSP}kr"`);
  expect(node).toContain(`"field":"0,1"`);
  expect(node).toContain(`"field":"6,5"`);
  expect(node).toContain(`"field":"50"`);
  // Story 3.7: the drill-downs' share lines, "=" where the displayed numbers give the amount and
  // "≈" where they do not, at a fixed share and at the median step with capital amounts.
  expect(node).toContain(`"shareLine":"1${NBSP}170${NBSP}000${NBSP}kr × 50${NBSP}% = 585${NBSP}000${NBSP}kr"`);
  expect(node).toContain(`"shareLine":"3${NBSP}500${NBSP}kr × 25${NBSP}% = 875${NBSP}kr"`);
  expect(node).toContain(`"shareLines":["4${NBSP}000${NBSP}kr × 25${NBSP}% = 1${NBSP}000${NBSP}kr"]`);
  expect(node).toMatch(/"shareLine":"[^"]+ × 15 % ≈ [^"]+"/u);
  const code = await bundle();
  await page.setContent('<!doctype html><html lang="nb"><head><meta charset="utf-8"></head><body></body></html>');
  await page.addScriptTag({ content: code });
  await expect
    .poll(() =>
      page.evaluate(
        ({ wires, multiples }) =>
          (globalThis as unknown as { WireIdentity: { texts: (w: unknown, m: unknown) => string } }).WireIdentity.texts(wires, multiples),
        { wires: WIRES, multiples: MULTIPLES },
      ),
    )
    .toBe(node);
  await expect.poll(() => page.evaluate(() => navigator.userAgent)).toMatch(/Chrome/);
});
