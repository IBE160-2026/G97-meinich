// Playwright's global setup (Story 2.9, review; Stories 2.10, 3.1b): removes
// every synthetic company of e2e/synthetic.ts before any project runs, so one
// left by a crashed run is never seen by the other specs. Idempotent; refuses a
// non-local database and a company that is not the synthetic one.
import { removeSynthetic, removeSyntheticDocuments, removeSyntheticUsd } from './synthetic.ts';

export default async function globalSetup(): Promise<void> {
  await removeSynthetic();
  await removeSyntheticUsd();
  await removeSyntheticDocuments();
}
