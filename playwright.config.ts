import { defineConfig, devices } from '@playwright/test';

// Renders the production build (`pnpm build` first), the same way the README
// runs the app. Two servers run the same build:
// - port 3100 with the database from .env, for every spec but one;
// - port 3101 with READER_DATABASE_URL pointing at a closed port, for
//   e2e/db-down.spec.ts: the front page and the analysis answer 500 with the
//   lookup-error state, and the search endpoint 500 {}.
//
// e2e/failed-subject.spec.ts (Story 2.9) commits a synthetic company to the
// local database for its own run and removes it after (e2e/synthetic.ts).
// It is a project of its own that depends on the other two, so it runs
// last and no other spec sees the company; the global setup removes one a
// crashed run left behind before any project starts.
const port = 3100;
const dbDownPort = 3101;
// Port 1 on the loopback interface: nothing listens, so every read is refused.
const UNREACHABLE_READER_URL = 'postgresql://reader:unreachable@127.0.0.1:1/postgres';

export default defineConfig({
  testDir: 'e2e',
  // Removes a synthetic company left by a crashed run before anything runs.
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: [/db-down\.spec\.ts/, /failed-subject\.spec\.ts/],
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}` },
    },
    {
      name: 'db-down',
      testMatch: /db-down\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${dbDownPort}` },
    },
    {
      name: 'synthetic',
      testMatch: /failed-subject\.spec\.ts/,
      dependencies: ['chromium', 'db-down'],
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}` },
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
