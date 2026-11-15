// The key-figures filing a stored document belongs to (Story 3.1a, B2,
// Meinich 2026-11-15): the one source of the API subtotals that R3
// (`guardCurrentAssets`) and the fingerprint read. `pnpm derive`
// (scripts/derive.ts, DERIVE_SQL) and the request path (DOCUMENT_JOINS in
// document-basis.ts) both join it through this fragment, so a document's
// current kundefordringer and bankinnskudd are checked against the same
// `sum_omloepsmidler` in both: the filing in `register.document.brreg_id`,
// set by step 1 when exactly one SELSKAP key-figures filing has the
// document's orgnr and year, and NULL otherwise (R3 then checks nothing).
// Before, the request path read the benchmark filing's subtotal instead;
// the two differed in 0 of 2 778 current columns of the local document run
// (2026-11-15).
//
// Needs `d` (register.document); gives `dk` (register.key_figures).
export const DOCUMENT_FILING_JOIN = 'left join register.key_figures dk on dk.brreg_id = d.brreg_id';
