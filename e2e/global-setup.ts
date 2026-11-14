// Playwright's global setup (Story 2.9, review; Story 2.10): removes both
// synthetic companies of e2e/synthetic.ts before any project runs, so one
// left by a crashed run is never seen by the other specs. Idempotent; refuses a
// non-local database and a company that is not the synthetic one.
import { removeSynthetic, removeSyntheticUsd } from './synthetic.ts';

export default async function globalSetup(): Promise<void> {
  await removeSynthetic();
  await removeSyntheticUsd();
}
