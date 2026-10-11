import { defineConfig } from 'vitest/config';

// `pnpm test:db`: tests against the local Supabase Postgres
// (`pnpm db:start`, then `pnpm db:roles`). Kept out of `pnpm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/db/**/*.test.ts'],
    // The files share one database and the roles' passwords: run them one
    // at a time.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
