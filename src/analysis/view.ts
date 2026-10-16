// Which state an analysis URL opens in (Story 1.6b; FR-2, FR-3, FR-4,
// FR-69; EXPERIENCE.md "State Patterns", "Invalid URL state"). Pure: the
// subject as read from the database and the parsed URL in, the state, any
// redirect, the effective tab, the notice flag and the page title out. The
// pages and the layout only carry out what this decides.
//
//   invalid orgnr                     → 404 with the front page (layout)
//   valid orgnr, not in the database  → 404 with the not-found state (layout)
//   no SELSKAP filing                 → bare path is the result; a tab redirects to it
//   filing, industry not covered      → bare path is the result; a tab redirects to it
//   filing, industry covered          → bare path redirects to Oversikt; a tab renders,
//                                       Verdi (Epic 3) renders Oversikt with the notice
//
// Every redirect keeps the query. With no fallback it is written
// canonically by `serialize`; when a value fell back, the query is kept as
// it came, so a fallback in the query is parsed again on the target and
// still shows the notice there. A fallback in the tab itself (an unknown
// tab, or verdi) is not carried: an uncovered or no-filing company has no
// tabs, so its redirect to the bare path drops the tab, and the target shows
// the notice only if its query has a fallback.
import { formatOrgnr } from '../engine/format.ts';
import type { KeyFiguresRow } from '../engine/inputs.ts';
import { t } from '../messages/index.ts';
import { defaultState, serialize, type Fane, type ParseContext, type ParseResult } from '../url/analysis-state.ts';

/**
 * What `parse` is told about the subject's peer group until the stories that
 * compute it. Accept-all `isCandidate` until Story 1.7 builds the candidate
 * pool (funnel stages 1–3 at the parsed band); until then any valid orgnr
 * other than the subject is kept in `ekskl`. `medianStepExists` is false
 * until Story 3.5 computes s_med, so `andel=median` falls back to 50 with
 * the notice.
 */
export const URL_CONTEXT: ParseContext = {
  isCandidate: () => true,
  medianStepExists: () => false,
};

/** The id of the analysis panel's heading, which a tab change focuses. */
export const PANEL_HEADING_ID = 'fane-tittel';

/** The tabs Epics 1–2 render. Verdi is added by Epic 3. */
export const OPEN_FANER = ['oversikt', 'peers', 'nokkeltall'] as const satisfies readonly Fane[];
export type OpenFane = (typeof OPEN_FANER)[number];

/** The amounts of the subject's filing the header and the API figures read. */
export type SubjectKeyFigures = Pick<
  KeyFiguresRow,
  | 'sum_driftsinntekter_ore'
  | 'driftsresultat_ore'
  | 'sum_driftskostnad_ore'
  | 'sum_eiendeler_ore'
  | 'sum_egenkapital_gjeld_ore'
  | 'sum_egenkapital_ore'
  | 'sum_gjeld_ore'
>;

/** The subject's newest SELSKAP filing by filing_year. */
export type SubjectFiling = {
  readonly filingYear: number;
  readonly valuta: string | null;
  /** When step 1 read the filing from the register (AD-18). */
  readonly readAt: Date;
  readonly keyFigures: SubjectKeyFigures;
};

/** One company as the analysis reads it: register.company, its coverage and its newest filing. */
export type Subject = {
  readonly orgnr: string;
  /** The current name; a company renamed between filings is one row by orgnr. */
  readonly navn: string | null;
  readonly naeringskode1: string | null;
  readonly naeringskode1Beskrivelse: string | null;
  readonly kommune: string | null;
  /** Its naeringskode1 has a row in register.covered_industry. */
  readonly covered: boolean;
  /** Null when the company has no SELSKAP filing in the loaded data. */
  readonly filing: SubjectFiling | null;
};

export type AnalysisStateKind = 'covered' | 'uncovered' | 'no-filing' | 'not-found' | 'invalid-orgnr';

export type AnalysisView = {
  readonly state: AnalysisStateKind;
  /** Where a 307 sends the request, or null when the URL renders as it is. */
  readonly redirect: string | null;
  /** The tab rendered and marked aria-current; null where there are no tabs. */
  readonly fane: OpenFane | null;
  /** Show "Noen innstillinger i lenken var ugyldige …" under the company header. */
  readonly notice: boolean;
  readonly title: string;
};

/** The company as written in a title: its name, or its orgnr in groups of three. */
export function displayName(subject: Pick<Subject, 'orgnr' | 'navn'>): string {
  return subject.navn ?? formatOrgnr(subject.orgnr);
}

/**
 * Decides the state of one analysis request. `search` is the query as
 * requested ("" or "?…"); a redirect keeps it (see above).
 */
export function analysisView(subject: Subject | null, parsed: ParseResult, search: string): AnalysisView {
  const brand = t('shell.brand');
  if (parsed.kind !== 'analysis') {
    return { state: 'invalid-orgnr', redirect: null, fane: null, notice: false, title: brand };
  }
  if (subject === null) {
    return { state: 'not-found', redirect: null, fane: null, notice: false, title: brand };
  }
  const { state, invalidSettings } = parsed;
  const query = search === '' || search.startsWith('?') ? search : `?${search}`;
  const redirectTo = (fane: Fane | null): string =>
    invalidSettings ? serialize({ ...defaultState(state.orgnr), fane }) + query : serialize({ ...state, fane });

  if (subject.filing === null || !subject.covered) {
    const kind = subject.filing === null ? 'no-filing' : 'uncovered';
    if (state.fane !== null) {
      return { state: kind, redirect: redirectTo(null), fane: null, notice: false, title: brand };
    }
    return {
      state: kind,
      redirect: null,
      fane: null,
      notice: invalidSettings,
      title: t('analysis.title.company', { selskap: displayName(subject) }),
    };
  }

  if (state.fane === null) {
    return {
      state: 'covered',
      redirect: redirectTo('oversikt'),
      fane: null,
      notice: false,
      title: brand,
    };
  }
  // Verdi is added by Epic 3; until then its path renders Oversikt as an
  // unknown tab would, with the notice.
  const fane: OpenFane = state.fane === 'verdi' ? 'oversikt' : state.fane;
  return {
    state: 'covered',
    redirect: null,
    fane,
    notice: invalidSettings || state.fane === 'verdi',
    title: t('analysis.title.tab', { selskap: displayName(subject), fane: t(`tabs.${fane}`) }),
  };
}
