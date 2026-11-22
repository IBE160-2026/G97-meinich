// The ids of Verdi's drill-downs (Story 3.7), unique on the page: a plain
// module, so the server's drill-downs (verdi-provenance.tsx) and the panel in
// the browser (verdi-panel.tsx) read the same values; a constant imported
// from a 'use client' module would reach a server module as a reference.
export const VERDI_PROVENANCE_IDS = {
  profit: 'verdi-prov-profit',
  workingCapital: 'verdi-prov-working-capital',
  oml: 'verdi-prov-oml',
  ev: 'verdi-prov-ev',
} as const;
