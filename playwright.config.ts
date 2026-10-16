import { defineConfig, devices } from '@playwright/test';

// Renders the production build (`pnpm build` first), the same way the README
// runs the app. Two servers run the same build:
// - port 3100 with the database from .env, for every spec but one;
// - port 3101 with READER_DATABASE_URL pointing at a closed port, for
//   e2e/db-down.spec.ts: the analysis answers 500 with the lookup-error state.
const port = 3100;
const dbDownPort = 3101;
// Port 1 on the loopback interface: nothing listens, so every read is refused.
const UNREACHABLE_READER_URL = 'postgresql://reader:unreachable@127.0.0.1:1/postgres';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /db-down\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}` },
    },
    {
      name: 'db-down',
      testMatch: /db-down\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${dbDownPort}` },
    },
  ],
  webServer: [
    {
      command: `pnpm start --port ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm start --port ${dbDownPort}`,
      // /slik-fungerer-peerless reads nothing but the coverage for the header,
      // which renders without it, so it answers 200 with the database down.
      url: `http://localhost:${dbDownPort}/slik-fungerer-peerless`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { READER_DATABASE_URL: UNREACHABLE_READER_URL },
    },
  ],
});
