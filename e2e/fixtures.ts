// The e2e suite's `test` (Story 1.10): every test sends its own
// X-Forwarded-For, so each test has budgets of its own on the rate limiter
// (src/rate-limit) and no test is refused because others ran before it on
// the same server. Every spec imports `test` and `expect` from here.
//
// The address is a unique-local IPv6 address: a random prefix per worker
// process (so a rerun against a reused server starts fresh too) and a
// counter per test. It is set on extraHTTPHeaders, which the page's browser
// context and the `request` fixture both send.
import { randomBytes } from 'node:crypto';
import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

const workerPrefix = `fd${randomBytes(1).toString('hex')}:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}`;
let counter = 0;

/** A client address no other test in this run uses. */
export function uniqueAddress(): string {
  counter += 1;
  return `${workerPrefix}::${counter.toString(16)}`;
}

export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ 'X-Forwarded-For': uniqueAddress() });
  },
});
