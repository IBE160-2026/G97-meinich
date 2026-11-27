import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import clientRestrictedImports from './eslint-rules/client-restricted-imports.mjs';

// Server-only code and the database client must never reach the engine
// (AD-8: pure functions) or a client bundle (AD-19: nothing server-side in
// the browser). The same option object feeds both rules.
const serverImportRestriction = {
  paths: [
    { name: 'postgres', message: 'The database client is server-only (src/server).' },
  ],
  patterns: [
    {
      // The project's own server code only: @/server, src/server, or a
      // relative path ending in or passing through a `server` segment.
      // Package subpaths such as react-dom/server and next/server stay allowed.
      regex: /^(?:@\/server|src\/server|(?:\.{1,2}\/)+(?:[^/]+\/)*server)(?:\/.*)?$/.source,
      message: 'src/server is server-only; the engine and client modules may not import it.',
    },
    {
      regex: '^postgres/',
      message: 'The database client is server-only (src/server).',
    },
  ],
};

// A 'use client' module also may not import the engine's digest (Story 2.5):
// it hashes with node:crypto, which is server-only, and a digest is a batch
// and CI concern, never something a browser computes.
const clientImportRestriction = {
  paths: serverImportRestriction.paths,
  patterns: [
    ...serverImportRestriction.patterns,
    {
      regex: /^(?:@\/engine\/digest|src\/engine\/digest|(?:\.{1,2}\/)+(?:[^/]+\/)*digest)(?:\.[cm]?[jt]s)?$/.source,
      message: 'src/engine/digest.ts uses node:crypto; a client module may not import it.',
    },
  ],
};

// The engine is pure functions, figures in and figures out (AD-8; Story 1.4):
// on top of the server restriction it may import nothing from Next.js or
// React, subpaths included (next/server, react/jsx-runtime, react-dom/server).
// Client modules keep serverImportRestriction alone: they import React.
const engineImportRestriction = {
  paths: [
    ...serverImportRestriction.paths,
    { name: 'next', message: 'The engine is framework-free (AD-8): no Next.js import.' },
    { name: 'react', message: 'The engine is framework-free (AD-8): no React import.' },
    { name: 'react-dom', message: 'The engine is framework-free (AD-8): no React import.' },
  ],
  patterns: [
    ...serverImportRestriction.patterns,
    { regex: '^next/', message: 'The engine is framework-free (AD-8): no Next.js import.' },
    { regex: '^react/', message: 'The engine is framework-free (AD-8): no React import.' },
    { regex: '^react-dom/', message: 'The engine is framework-free (AD-8): no React import.' },
  ],
};

// Every displayed number goes through src/engine/format.ts (AD-6).
// Intl.NumberFormat writes different characters in Node and in browsers, so
// it is banned in all application code and scripts.
const intlRestriction = {
  object: 'Intl',
  property: 'NumberFormat',
  message: 'Format numbers with src/engine/format.ts (AD-6).',
};

// Money is rounded once, at display, half away from zero, by the engine's
// decimal formatter (AD-8). Math.round rounds half towards +Infinity and
// toFixed works on binary floats; both are banned where figures are handled.
// A later flat-config block replaces the rule's options rather than merging
// them, so this list repeats the Intl entry.
const mathRoundRestriction = { object: 'Math', property: 'round', message: 'Use the engine decimal rounding (AD-8).' };
const toFixedRestriction = { property: 'toFixed', message: 'Use the engine decimal formatter (AD-8).' };
const roundingRestriction = {
  'no-restricted-properties': ['error', intlRestriction, mathRoundRestriction, toFixedRestriction],
};

// Where numbers are displayed (src/app, src/components), format.ts stays the
// only formatter and the only rounding (Story 1.8): toFixed works on binary
// floats, Decimal's toDecimalPlaces/toDP/toSignificantDigits would round a
// second time outside the formatter, and toLocaleString uses Intl, whose
// output differs between Node and browsers. Math.round stays allowed here:
// layout code uses it for pixels. The list repeats the Intl entry, because a
// later block replaces the rule's options.
const displayRestrictions = [
  intlRestriction,
  toFixedRestriction,
  { property: 'toDecimalPlaces', message: 'Round only in src/engine/format.ts (AD-6, AD-8).' },
  { property: 'toDP', message: 'Round only in src/engine/format.ts (AD-6, AD-8).' },
  { property: 'toSignificantDigits', message: 'Round only in src/engine/format.ts (AD-6, AD-8).' },
  { property: 'toLocaleString', message: 'Format numbers with src/engine/format.ts (AD-6).' },
];

// Epic 3 retro action 8 (issue #89): a test asserts unconditionally, and an
// e2e test reads a page value only through an auto-waiting assertion. A
// snapshot read (textContent, boundingBox, evaluate …) taken before the
// streamed page settles passed or failed by timing in Stories 3.4–3.6, and
// an expect inside a condition passes without testing when the condition
// is false (Epic 3 retro P6). Reads inside expect.poll's callback or an
// expect(…).toPass() block are retried, so they stay allowed; awaiting a
// read for its side effect (page.evaluate(() => document.fonts.ready))
// uses no value and stays allowed too.
const SNAPSHOT_READS =
  '/^(textContent|innerText|innerHTML|inputValue|allTextContents|allInnerTexts|getAttribute|count|all|boundingBox|evaluate|evaluateAll|isVisible|isHidden|isChecked|isEnabled|isDisabled|isEditable)$/';
// Not a read of the page: inside a retried callback, inside the browser-side
// function of an evaluate call (DOM getAttribute there is the DOM's), or
// Promise.all.
const NOT_A_SNAPSHOT = [
  "CallExpression[callee.object.name='expect'][callee.property.name='poll'] *",
  "CallExpression[callee.property.name='toPass'] *",
  'CallExpression[callee.property.name=/^(evaluate|evaluateAll)$/] > :function *',
  "[callee.object.name='Promise']",
].join(', ');
const READ = `CallExpression[callee.property.name=${SNAPSHOT_READS}]:not(${NOT_A_SNAPSHOT})`;
const snapshotReadMessage =
  'Read a page value through an auto-waiting assertion (toHaveText, toHaveCSS, toHaveAttribute, toHaveCount), expect.poll or an expect(…).toPass() block, never a snapshot (Epic 3 retro action 8).';
const snapshotReads = [
  // The value is used: an awaited read anywhere but as a statement of its
  // own (kept, compared, passed on, iterated over, put into a selector), or
  // a read returned unawaited, from a function or as an arrow's body.
  ...[':not(ExpressionStatement) > AwaitExpression > ', 'ReturnStatement > ', 'ArrowFunctionExpression > '].map((parent) => ({
    selector: `${parent}${READ}`,
    message: snapshotReadMessage,
  })),
];
const CONDITION = ':matches(IfStatement, ConditionalExpression, SwitchStatement, LogicalExpression, CatchClause)';
const conditionalExpectMessage =
  'No expect inside a condition: a branch that is not taken tests nothing. Assert the case, narrow with a throwing helper (test/narrow.ts), split the cases, or filter first and assert the filtered list (Epic 3 retro action 8).';
const conditionalExpects = [
  { selector: `${CONDITION} CallExpression[callee.name='expect']`, message: conditionalExpectMessage },
  { selector: `${CONDITION} CallExpression[callee.object.name='expect']`, message: conditionalExpectMessage },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}', 'scripts/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    rules: { 'no-restricted-properties': ['error', intlRestriction] },
  },
  {
    files: ['src/app/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}', 'src/components/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    rules: { 'no-restricted-properties': ['error', ...displayRestrictions] },
  },
  {
    files: ['src/engine/**/*.{ts,tsx}', '**/*[fF]ormat*.{ts,tsx}'],
    rules: roundingRestriction,
  },
  {
    // A formatting file under src/app or src/components gets both lists.
    files: ['src/app/**/*[fF]ormat*.{ts,tsx}', 'src/components/**/*[fF]ormat*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': ['error', ...displayRestrictions, mathRoundRestriction],
    },
  },
  {
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', engineImportRestriction],
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    plugins: {
      local: { rules: { 'client-restricted-imports': clientRestrictedImports } },
    },
    rules: {
      'local/client-restricted-imports': ['error', clientImportRestriction],
    },
  },
  {
    files: ['test/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...conditionalExpects] },
  },
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...conditionalExpects, ...snapshotReads] },
  },
  globalIgnores([
    // Gitignored local work: dumps, logs and old worktrees.
    '.local/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'test/fixtures/**',
    'playwright-report/**',
    'test-results/**',
    '_bmad/**',
    '_bmad-output/**',
    '.claude/**',
    'analysis/**',
  ]),
]);
