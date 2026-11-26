// Demo companies A and B: the acceptance reference cases of the demo seed
// (Story 5.4, decision 1, Meinich 2026-11-25), linked from the search's
// no-match and unknown-orgnr states (EXPERIENCE.md, State Patterns). Both
// are real companies in the committed demo seed with a SELSKAP filing in NOK
// for 2025 (1 January – 31 December) from which all three API key figures
// are computable (sumDriftsinntekter > 0, sumEiendeler > 0), and they and
// their peers at every size band are on seed/allow-list.json.
// test/db/demo-companies.test.ts checks this against the loaded seed.
//
// - A, 922425620 TRETOEN AS (Hamar): a typical IT consultancy, chosen to
//   show a full analysis. Its fingerprint type, its classification and its
//   register text agree; its 2025 driftsmargin is close to its band-0
//   group's median, and its 2024 and 2025 document columns are reconciled.
// - B, 912159329 HUMA AS (Oslo): a loss-making software product company,
//   chosen for a large gap against its stages 1–3 group. Its type,
//   classification and text agree.
//
// Neither was chosen to show an AI layer, and neither is in the labelled
// set. Demo company C (the uncovered state) is step 1's [demo_company_c] in
// ingest/config.toml.
//
// Names are written as the register stores them.

export interface DemoCompany {
  readonly orgnr: string;
  readonly navn: string;
}

export const DEMO_COMPANIES: readonly [DemoCompany, DemoCompany] = [
  { orgnr: '922425620', navn: 'TRETOEN AS' },
  { orgnr: '912159329', navn: 'HUMA AS' },
];
