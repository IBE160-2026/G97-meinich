import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's `@/` path alias (tsconfig.json), for tests that import
  // components.
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Database tests need a running local Supabase: `pnpm test:db`
    // (vitest.db.config.ts), never `pnpm test`.
    exclude: ['test/db/**', '**/node_modules/**'],
    // The lint test loads the full ESLint config on first use.
    testTimeout: 30_000,
  },
});
