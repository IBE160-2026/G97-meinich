import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // The lint test loads the full ESLint config on first use.
    testTimeout: 30_000,
  },
});
