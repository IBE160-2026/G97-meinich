import path from 'node:path';
import { defineConfig } from 'vitest/config';

// `pnpm test:db`: tests against the local Supabase Postgres
// (`pnpm db:start`, then `pnpm db:roles`). Kept out of `pnpm test`.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // src/server modules start with `import 'server-only'`, which throws
      // outside a React Server Components bundle. The database tests call
      // them directly, as the server would, so they get the package's own
      // server-side (empty) entry.
      'server-only': path.resolve(import.meta.dirname, 'node_modules/server-only/empty.js'),
    },
  },
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
