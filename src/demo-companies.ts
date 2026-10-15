// Demo companies A and B, linked from the search's no-match and
// unknown-orgnr states (EXPERIENCE.md, State Patterns).
//
// TEMPORARY: placeholders until Story 5.4 chooses demo A and B as the
// acceptance reference cases. Both are real companies in the committed demo
// seed with a SELSKAP filing in NOK for 2025 (1 January – 31 December) from
// which all three API key figures are computable (sumDriftsinntekter > 0,
// sumEiendeler > 0). test/db/demo-companies.test.ts checks this against the
// loaded seed.
//
// - 813235552 ADMMIT AS (Vindafjord): an AS in the covered industry with a
//   small positive driftsmargin in 2025, like Kari's company in UJ-1.
// - 814739082 EXEBENUS AS (Sola): an AS in the covered industry with a
//   negative driftsmargin in 2025, like Anders's prospect in UJ-2.
//
// Names are written as the register stores them.

export interface DemoCompany {
  readonly orgnr: string;
  readonly navn: string;
}

export const DEMO_COMPANIES: readonly [DemoCompany, DemoCompany] = [
  { orgnr: '813235552', navn: 'ADMMIT AS' },
  { orgnr: '814739082', navn: 'EXEBENUS AS' },
];
