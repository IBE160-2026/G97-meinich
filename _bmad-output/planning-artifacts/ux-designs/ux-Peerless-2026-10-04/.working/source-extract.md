# Source extract for UX — Peerless

Extracted 2026-10-04. Sources: brief.md (B), brief addendum.md (BA), prd.md (P), PRD addendum.md (PA), technical-note-architecture.md (TN), docs/key-figures.md (KF). Precedence: B, TN, KF, data-sources-brreg win over BA; per P §0 the four authoritative docs win over P. BA is non-authoritative.

---

## 1. Users / personas and jobs

- **Accountants and advisers — primary, likeliest to pay** (P §2.1, B "Who This Serves")
  - Answer "are we doing well?" for dozens of clients with evidence; turn unbillable conversation into billable service; judge whether a peer group is right (best placed to); carry client base as distribution.
  - Also use it on **prospects** before a first meeting (open route, public accounts) — B. Boundary: one orgnr at a time, no screening (B, P UJ-2).
  - In the system "Adviser" is *not a role* — a user with many workspaces (P §3, FR-43, TN Access control).
- **Managing directors and finance leads — also v1** (P §2.1): find out whether a known figure is good/bad before pricing/hiring/WC decision; will not maintain a modelling tool; change what they work on next. Reach via open route or as viewers in adviser's workspace (B).
- **Board members and co-owners — invited viewers** (P §2.1): read management's figures against external reference, often first time.
- **Non-users v1** (P §2.2): investors/fund professionals (deferred); anyone outside covered industry (gets own API figures + "not covered" statement, FR-4); credit/risk analysts; banks, insurers, entities outside ordinary layout.
- **Named protagonists** (P §2.3; names invented `[ASSUMPTION]`, peer stats real, subject margins invented):
  - **Kari** — finance lead, 12-person software co, `62.100`.
  - **Anders** — consultant selling improvement work to small companies.
  - **Solveig** — board chair of Anders's prospect-turned-client.
  - **Tore** — owner of the `69.202` bookkeeping firm.

## 2. User journeys (P §2.3)

All four: order is narrative not priority. **None states a phone.** UJ-1 entry state explicitly "laptop". UJ-2/3/4 device unstated (UJ-3 arrives by email invitation — plausibly phone, but not stated). **None touches the decomposition views** (FR-26). UJ-4 touches unfiled/YTD only.

- **UJ-1. "A company finds out that beating its industry is not the same as being good."**
  - Protagonist: Kari. Entry: no account, **laptop**, arrived from a search. ~16.7 m revenue.
  - Steps: enters own orgnr → company identified with filed key figures + peer group → reads **funnel counts** and **per-peer inclusion reasons**, **excludes two resellers** (FR-16, FR-17, FR-19) → walks key figures for largest kroner gaps → reads written explanation (FR-52).
  - Climax: 2.1 % op. margin *above* industry median −3.2 %, but vs favourable quartile 9.1 % a 7-point gap ≈ **1.17 m kr/yr** at full convergence (7.0 % × 16.7 m).
  - Resolution: wants PDF for board → export needs account → **magic link** sign-in, keeps analysis already built (FR-40, FR-42, FR-49).
  - Edge: receivable days has no peer aggregate (<10 usable) → row keeps her figure and states how many comparable values exist (FR-22).
  - Weak ending on purpose: nothing tells her the next filing arrived (monitoring deferred); portfolio (FR-63) only rewards her once back.
- **UJ-2. "An adviser walks into a first meeting already knowing where the company is weakest."**
  - Protagonist: Anders. Entry: not signed in; prospect is 9-person bookkeeping firm `69.202`, ~10.4 m revenue.
  - Steps: enters prospect orgnr cold → reads and judges peer group → straight to largest kroner gaps → notes one or two numbers.
  - Climax: op. margin 2.5 % vs median 9.7 %, favourable quartile 15.3 % → 12.8 pts ≈ **1.34 m kr/yr** at full convergence. Opens meeting with prospect's largest gap.
  - Resolution: wins the work → signs in, saves analysis into a workspace for that client, invites the MD (FR-40, FR-43, FR-44).
  - Edge: industry not covered → own filed key figures + plain statement industry not yet analysed; no peer group, median or kroner (FR-4).
  - Scope boundary: "show me every firm in `69.202` with a weak margin" = screening, excluded.
- **UJ-3. "Someone else reads the analysis without being able to reach anything else."**
  - Protagonist: Solveig. Entry: email invitation, no account.
  - Steps: Anders invites her by email into one workspace as viewer (FR-44) → magic link sign-in → reads saved analysis, peer group, kroner gaps, read-only.
  - Climax: sees same figures management sees, sourced from public filings, **traces any kroner amount back to filed accounts** (FR-60).
  - Resolution: viewer in one workspace; Anders's other clients unreachable (FR-45, FR-47).
  - Edge: mistyped address → invitation grants nothing until accepted from that mailbox; one workspace, viewer (FR-44).
  - Not this: share link. Later: valuation-basis users (investors, M&A) are v2.
- **UJ-4. "An owner asks whether this year is going better, before anything is filed."**
  - Protagonist: Tore. Entry: signed in, **owner** of own workspace. Closes books monthly; prior filed year 2.5 %.
  - Steps: enters YTD figures stating **seven months** → enters same seven months of last year → sees **ratios only**, each labelled unaudited and user-entered (FR-33, FR-67).
  - Climax: 6.4 % over 7 months vs **4.8 % same 7 months last year**. Own last filed full year 2.5 % and peers' latest full-year median 9.7 % alongside as context, labelled *"hele år, ikke samme periode"*.
  - Resolution: direction not projection; nothing annualised; when filing arrives it takes precedence, entries kept as history (FR-36).
  - Edge: no prior-year same-period figures → YTD ratios shown with **no primary comparison** (FR-67).
  - Will not: no kroner from partial period; no seasonality adjustment (stated, not corrected).

## 3. Pages / surfaces and access

No routes/URLs are given anywhere in the sources.

| Surface | Shows | Who reaches it | Source |
|---|---|---|---|
| **Front page** | Short description of Peerless, the orgnr field, an **industry overview** per covered industry | Anyone (anon) | B Solution; TN Pages; FR-61; FR-42 |
| **Industry overview** (on front page) | Median margin over time; spread in personnel cost share; share of companies growing. Aggregates only, never names a company; min group size applies; covered industries only (2 at start); latest year only (spread, no trend) if older filings unreliable | Anyone | FR-61; BA; TN Pages |
| **Analysis — tabs**: overview, peers, key figures and gaps, development over time, value | Subject + peer group + position | Tabs open to anon except those needing account; **account-walled tabs are visible to anon but say an account opens them** | FR-62; TN Pages; B Solution |
| — *Overview* tab | Not specified in detail. Plausibly identification (FR-2), explanation (FR-52) | Anyone | FR-62 |
| — *Peers* tab | Funnel counts, peer list with inclusion reason + match basis + disagreement flag, exclude/restore, loosen | Anyone | FR-15–19 |
| — *Key figures and gaps* tab | Per figure: own value, median, favourable quartile, percentile; kroner gap; below-floor rows | Anyone | FR-21–29 |
| — *Development over time* tab | Subject vs peers 2021–2025 | **Account** | FR-28, FR-42 |
| — *Value* tab | Closable-share control, four amounts, EV/EBIT input | Anyone | FR-31, FR-32, FR-42 |
| **Decomposition views** (2) | Margin vs capital efficiency; pay level vs productivity | **Account**. Tab placement not specified | FR-26, FR-42 |
| **Uncovered-industry result** | 3 API figures (op. margin, ROA, equity ratio) + statement naming industry, coverage not yet available. No peers/median/quartile/percentile/kroner | Anyone | FR-4 |
| **Subject filing failed reconciliation** | 3 API figures with full comparison; 12 doc figures absent with stated reason | Anyone | FR-71 |
| **Error: malformed / non-existent orgnr** | Clear message, not empty analysis | Anyone | FR-1 |
| **Rate-limit refusal** | Refusal, not degraded analysis; CAPTCHA on anonymous sign-in | Anon | FR-6 |
| **Magic-link sign-in** | Email entry → link | Anyone; converts anon in place | FR-40, FR-41 |
| **Portfolio front page** | Signed-in user's front page: every company they follow, latest position, what changed since last filing, largest gaps. Reads saved analyses only; only member workspaces; no user widgets | **Signed-in** | FR-63; TN Pages; BA |
| **Workspaces** | Saved work, one per company typically; owner + viewers | Signed-in members | FR-43 |
| **Invitation** (send / accept) | Owner invites by email to one workspace as viewer | Owner sends; invitee accepts from that mailbox | FR-44 |
| **Member removal** | Revokes immediately | Owner (implied) | FR-46 |
| **Saved analysis + history** | Movement against peers over visits; shows its own read date | Members | FR-49, FR-50, FR-64 |
| **Unfiled / YTD entry form** | 4 required + optional components; months covered for YTD | Owner writes; viewers read; anon never | FR-34, FR-38, FR-67 |
| **PDF export** | Analysis incl. unaudited labels, filing year + read date, source credit | **Signed-in**; never anon | FR-51, FR-33, FR-64, FR-65 |
| **"Om"-style page** | Source credit / NLOD | Reachable from every page | FR-65 |
| Favourites | Listed in account wall; **no FR defines it** | Signed-in | FR-42, BA |
| Audit log | Append-only, actor/timestamp/prior state. No UI stated | n/a (no user surface stated) | FR-48 |

**Account wall (verbatim-ish, FR-42 = TN Access control = BA table):**

| Open to anyone | Needs an account |
|---|---|
| Front page and industry overviews | Development over time |
| Lookup, peer group and adjustment | Decomposition views |
| Key figures, percentiles and gaps in kroner | PDF export |
| Closable-share control and valuation | Saved analyses and history, favourites |
| | Unfiled current-year figures |
| | Workspaces, invitations and the portfolio front page |

"The core — peers and the gap in kroner — never requires an account." (FR-42)

**Roles** (P §3, FR-43, TN): `owner`, `viewer` only. **There is no "editor" role and no "adviser" role.**
- Anonymous session: Supabase anon sign-in, real `auth.uid()`; reads public figures only; **writes nothing to any table**; state in URL (orgnr, excluded peers, closable share, EV/EBIT multiple) (FR-39, FR-69). Never triggers explanation generation (FR-52). Can trigger description classification (FR-5, rate-limited).
- Signed-in (non-member of a given workspace): own workspaces only (FR-45).
- Owner: creates workspace, owns it, writes unfiled figures, invites viewers (P §3).
- Viewer: read-only member of one workspace; reads unfiled figures; cannot write them (FR-34, FR-44).
- Same-owner isolation: viewer in workspace A cannot reach owner's workspace B (FR-45).

## 4. FRs with UI consequence

Exact Norwegian strings given in sources are **only three**: *"hele år, ikke samme periode"* (FR-67, UJ-4), *"Forklaringen gjelder standard peer-gruppe"* (FR-52), *"Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene"* (FR-65). Everything else needs copy.

**Lookup / eligibility**
- FR-1 — 9-digit orgnr field, with or without account; malformed/non-existent → clear message.
- FR-2 — show registered name, orgnr, primary industry code, **accounting year analysed = year of returned filing** (never requested year).
- FR-3 — covered-industry gate; SN2025 codes.
- FR-4 — uncovered: 3 API figures only; statement **names the industry**, says coverage not yet available, **must not imply company ineligible/unavailable**. No peers/median/quartile/percentile/kroner.
- FR-5 — optional free-text subject description; takes precedence over register's for subject classification; anon: used not stored; signed-in: belongs to workspace; rate-limited; maps only to fixed category.
- FR-6 — rate limit per session + IP; CAPTCHA on anonymous sign-in; over limit → refusal.

**Peer group**
- FR-8 — comparability (6 fields) is hard exclusion, **never loosenable** → UI must not offer it as loosenable.
- FR-9 — segmentation: legal form (AS only v1), geography only where industry calls for it and then **named to user** so it can be seen and loosened; each criterion reported separately in funnel counts.
- FR-14 — text vs fingerprint disagreement → candidate **flagged**, stays in group, flag shown next to match basis; flagged count reported with funnel counts.
- FR-15 — **funnel counts**: each of 5 stages shows surviving count, shown even when group too small for aggregates. (Plus per-criterion segmentation counts FR-9 and flagged count FR-14.)
- FR-16 — per-peer **inclusion reason** (rules-written, deterministic from shared profile fields) + **match basis**, exactly one of *description and accounts* / *accounts alone* / *industry and size alone* (English in source; no Norwegian given). Where industry and size alone, product says so. Peers shown **by name**.
- FR-17 — **exclude a peer**: analysis-only; anon in URL, signed-in saved with analysis; excluded peer **shown as excluded, not vanished, can be put back**; can push figures below floor.
- FR-18 — **loosen**: size band default 0.5–2× subject `sumDriftsinntekter`, max 0.25–4×; segmentation (legal form/geography). Loosened criterion **shown as loosened**, funnel counts updated, "a larger group never looks like the default one". (Step granularity unspecified.)
- FR-19 — immediate recompute of everything; no stale value anywhere on screen.
- FR-20 — assembly <1 s.

**Key figures display**
- FR-21 — figure set per KF; rounding: **% one decimal, days whole, kroner whole kroner**. Total cost share = reconciliation check, not primary. Cash share = diagnostic, no direction, never ranked, no kroner.
- FR-22 — **below-floor (10 peers per figure)**: row persists, shows own value; where median/quartile/percentile would be, states **how many comparable values exist against the ten required**. No kroner.
- FR-23 — undefined ≠ zero; **number of companies left out of each figure's distribution is shown**.
- FR-24 — same source for subject and peers; else no comparison, own value shown with reason; displayed **same way as below-floor**. If own value not computable, row says so.
- FR-25 — benchmark year = subject's latest filed year.
- FR-26 — **decomposition views**: (a) margin vs capital efficiency [ROA = op. margin × (`sumDriftsinntekter`/`sumEiendeler`)]; (b) pay level vs productivity [personnel cost share = personnel cost per FTE ÷ revenue per FTE] — "paying more per person vs producing less per person". Account required. TN "Data out" calls (a) "decomposition of return into margin and asset turnover".
- FR-27 — distribution display: own value, median, favourable quartile, percentile. **Median and favourable quartile both always shown where both exist.** No-direction figures (revenue growth, personnel cost per FTE, equity ratio, cash share): no favourable quartile, no percentile, never ranked; show value against distribution (KF: "the peer median and quartiles as a distribution").
- FR-28 — development over time 2021–2025; account required.

**Kroner and control**
- FR-29 — only gaps where worse than target produce kroner; better → shown as **strength**, no amount. B: "Strengths are shown as clearly as weaknesses."
- FR-30 — **no double counting**: cost-share kroner presented as **subordinate breakdown of operating-margin amount**, never independent/addable; no total sums >1 of {op. margin, COGS share, personnel share, other cost share}; working capital released = receivable days + payable days only; capital released from operating assets **beside, never inside** WC released; receivable-days never summed with op-asset-turnover amount.
- FR-31 — **closable-share control**: single control, 0 → full convergence with favourable quartile; live update of **four amounts, not one total**: annual profit uplift, working capital released, capital released from operating assets, implied EV. Target = favourable quartile at every setting. **Peer median marked on the control**, never the target.
- FR-32 — **EV/EBIT multiple**: user input, **no default, field starts empty, EV not shown at all until entered**; no lookup/range/suggestion. Profit uplift and WC released show without it.

**Unfiled / YTD**
- FR-33 — **unaudited and user-entered label** wherever unfiled-derived figure appears, including PDF; never merged with filed in one displayed value. (No Norwegian label string given.)
- FR-34 — owner writes, viewers read, anon never.
- FR-35 — compared against peers' latest filed year **with period difference stated**.
- FR-36 — filing arrives → takes precedence; entries kept as history.
- FR-37 — never in an aggregate.
- FR-38 — entry: 4 required (revenue, operating profit, total assets, total equity) → op. margin, ROA, equity ratio; optional doc components (cost lines, receivables, payables, FTEs); further figures only when all components present; blank = undefined.
- FR-67 — **YTD**: months covered required and **shown with every derived figure**; nothing annualised; **ratios only, no kroner**; primary comparison = own same period last year (owner-entered); absent → no primary comparison; own last full year + peers' latest full year as context labelled *"hele år, ikke samme periode"*; no seasonality adjustment **and the product says so**.

**Accounts / access**
- FR-39/40 — anon sign-in on arrival; registration converts in place; URL state (orgnr, exclusions, closable share, multiple) written into **new workspace** at registration.
- FR-41 — **magic link** only; no password.
- FR-42 — account wall (table above).
- FR-43 — workspaces, roles owner/viewer.
- FR-44 — invite by email, one workspace, viewer, read-only; grants nothing until accepted from that mailbox.
- FR-46 — remove member → immediate revocation.
- FR-69 — anon state in URL; refresh/bookmark/pass on reproduces analysis.

**Saved / export**
- FR-49 — signed-in owner saves analysis into workspace.
- FR-50 — history: later visit shows movement against peer group.
- FR-51 — **PDF export**, signed-in only; carries unaudited labels.

**Explanation (LLM text)**
- FR-52 — names **largest gaps in kroner**, **strengths**, and (where multi-year data exists) **which gaps persisted** (persistence decided by engine). **Every figure in the text links back to its calculation.** Generated/cached for **default peer group only**; adjusted group shows default text labelled *"Forklaringen gjelder standard peer-gruppe"*; signed-in can **regenerate** for adjusted group (rate-limited); anon never triggers generation.
- FR-53 — no figure absent from engine output; test parses Norwegian number formats (`1 234 567,89`, nbsp/narrow-space thousands, comma decimal, `kr` before/after, `%`).
- FR-54 — explains, does not recommend.

**Responsive**
- FR-55 — works to ~375 px; stacks to one column; body never scrolls horizontally.
- FR-56 — ratio tables, distribution plots and peer list each scroll horizontally in own container.

**Data quality / provenance**
- FR-57 — **data quality flag per filing** (§4.10 "visible to the user"), from reconciliation only, never OCR confidence.
- FR-58 — failing figure withheld; **not shown with a caveat, not substituted**.
- FR-60 — **traceability**: from any kroner figure user reaches the key figure and the filed values behind it. Degraded (paper) filings reported as unavailable.
- FR-71 — **subject's own filing fails reconciliation**: show 3 API figures (with full comparison); state the subject's own filing could not be read reliably; not demoted to uncovered.
- FR-64 — **every figure, aggregate and industry overview states filing year + date data was read from register**; survives into PDF and saved analysis; saved analysis shows its own read date, never today's; no freshness promise.
- FR-65 — **source credit**: credit Brønnøysundregistrene, state Peerless processed the data, no implied endorsement; NLOD string for API data only; document-derived figures credited to Brreg **without** licence claim; credit distinguishes the two; reaches PDF; may live on *Om*-style page reachable from every page, not hidden.
- FR-66 — withdrawn company (410 Gone): disappears from peer groups/aggregates; saved analyses keep their figures; cannot be looked up or re-added as peer.

**Front page / nav**
- FR-61 — front page with industry overviews (see §3).
- FR-62 — tabs; walled tabs visible to anon with "account opens them".
- FR-63 — portfolio front page.

## 5. Key figures (KF)

Direction: ↑ higher better, ↓ lower better, – none. Norwegian names are **not given** in KF (English only); Norwegian names below are proposals marked (prop.) — need confirmation.

| # | English | Norwegian (prop.) | Formula | Src | Dir | Kroner |
|---|---|---|---|---|---|---|
| 1 | Operating margin | Driftsmargin | `driftsresultat / sumDriftsinntekter` | API | ↑ | **Profit**: (T − r) × `sumDriftsinntekter` × s = annual profit uplift |
| 2 | EBITDA margin | EBITDA-margin | (`driftsresultat` + `avskrivninger` + `nedskrivninger`) / `sumDriftsinntekter` | OCR | ↑ | – |
| 3 | Cost of goods share | Varekostnadsandel | `varekostnad / sumDriftsinntekter` | OCR | ↓ | Profit, **explains 1**: (r − T) × rev × s |
| 4 | Personnel cost share | Lønnskostnadsandel | `lonnskostnad / sumDriftsinntekter` | OCR | ↓ | Profit, **explains 1** |
| 5 | Other operating cost share | Andel andre driftskostnader | `annenDriftskostnad / sumDriftsinntekter` | OCR | ↓ | Profit, **explains 1** |
| 6 | Total cost share *(check)* | Total kostnadsandel | (3+4+5 numerators) / rev | OCR | ↓ | – (reconciliation check, not primary) |
| 7 | Revenue per FTE | Omsetning per årsverk | `sumDriftsinntekter / aarsverk` | OCR | ↑ | – |
| 8 | Personnel cost per FTE | Lønnskostnad per årsverk | `lonnskostnad / aarsverk` | OCR | – | – |
| 9 | Receivable days | Kundefordringsdager | `kundefordringer / salgsinntekt × 365` | OCR | ↓ | **Capital**: (r − T)/365 × `salgsinntekt` × s |
| 10 | Payable days | Leverandørgjeldsdager | `leverandorgjeld / (varekostnad + annenDriftskostnad) × 365` | OCR | ↑ | **Capital**: (T − r)/365 × (`varekostnad`+`annenDriftskostnad`) × s |
| 11 | Operating asset turnover | Omløpshastighet driftseiendeler | `sumDriftsinntekter / (sumEiendeler − bankinnskudd)` | OCR | ↑ | **Capital** (separate): ((`sumEiendeler` − `bankinnskudd`) − rev/T) × s |
| 12 | Return on assets | Totalkapitalrentabilitet | `driftsresultat / sumEiendeler` | API | ↑ | – |
| 13 | Equity ratio | Egenkapitalandel | `sumEgenkapital / sumEiendeler` | API | – | – |
| – | Cash share (diagnostic) | Kontantandel | `bankinnskudd / sumEiendeler` | OCR | – | – (never ranked) |
| 14 | Revenue growth (context) | Omsetningsvekst | rev / rev(prior year) − 1 | OCR | – | – |

- API-sourced (shown for uncovered / failed-reconciliation subjects): 1, 12, 13. All others document/OCR-dependent ("twelve") (KF, FR-4, FR-71).
- **Cost shares 3–5 decompose the op. margin gap**; never added to it or each other (KF "From gap to kroner", FR-30).
- **Working capital released** = (9) + (10) only. **(11) reported separately**, never added to (9)/(10).
- **EV** = annual profit uplift × user EV/EBIT multiple; no default.
- **Four amounts** at chosen s: profit uplift, WC released, capital released from operating assets, EV (FR-31, TN Data out).
- Only gaps worse than T produce kroner; better = strength, no amount.
- s = 0 → no kroner; s = 1 → full convergence with favourable quartile. Median shown in every distribution and marked on control; never in arithmetic.
- **Favourable quartile**: upper quartile where ↑, lower where ↓. None for no-direction figures.
- **Quartiles/median**: linear interpolation, inclusive (`PERCENTILE.INC`).
- **Percentile**: (peers worse + 0.5 × peers equal) / peers × 100, in favourable direction. None for no-direction figures.
- **Below-floor rule**: 10 peers per key figure, after undefined excluded; row persists with own value + count vs 10; no kroner. Same display when subject/peers source differs (FR-24).
- **Undefined**: zero/negative denominator or missing non-derivable component; count left out shown.
- **Size band**: `sumDriftsinntekter` from same filing; default 0.5–2× subject; loosenable to 0.25–4×. Revenue only, never assets or employees.
- **Coarse bands**: COGS share and personnel cost share may enter selection only banded, benchmarked within band — **proposed, not settled** (FR-13, P §11 q12).
- Decompositions: ROA = op. margin × (rev/`sumEiendeler`); personnel cost share = personnel cost per FTE ÷ revenue per FTE.
- Known limitations to disclose: receivable days overstated by VAT up to 25 %; cost-line classification differences (total cost share shown as check); FTEs from notes not register headcount.
- Closing balances, not averages. Calendar-year filings only.

## 6. Out of scope — UX must NOT design

(P §5, §6.2; BA "Out of scope"; B Scope)
- Named rankings / league tables / top lists (incl. on front page; overviews never name companies).
- Share links / bearer links of any kind.
- Full valuation tool (DCF, transaction multiples, multiple methods); no multiple lookup, default or suggested range.
- Screening, searching register by financial criteria, "find companies like this", multi-company lists by criteria.
- Composite score / overall rating.
- Free-form chat over the data.
- Credit scoring/default prediction; forecasting (incl. annualising YTD).
- Automated monitoring / alerting on peer movements / "new filing arrived" notifications (deferred).
- User-arranged widgets / customisable dashboard (deferred).
- Group consolidation, ownership/group mapping, cross-border comparison, custom ratio definitions.
- Payment / subscription; multi-language (Norwegian bokmål only); native mobile apps.
- Investor/portfolio-screening use cases; banks/insurers.
- Third industry `43.210` not committed; inventory days not in set.
- Excluded figures: cash flow, gearing, interest cover, ROE, ROIC, inventory days.
- Embeddings not user-facing (FR-68) — no "similar companies" UI.
- Recommendations/advice in generated text (FR-54).
- Password sign-in (FR-41).
- Loosening comparability fields (FR-8).
- Showing OCR confidence as a quality signal (FR-57).
- Showing a failed figure "with a caveat" or substituted/estimated (FR-58, FR-71).

## 7. Norwegian terminology present in sources

- *"hele år, ikke samme periode"* — label on full-year context figures beside YTD comparison (FR-67, UJ-4).
- *"Forklaringen gjelder standard peer-gruppe"* — label on explanation when peer group adjusted (FR-52). Note: uses "peer-gruppe" (anglicism, hyphenated).
- *"Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene"* — prescribed NLOD credit (FR-65).
- *Om* — "about"-style page for credit (FR-65).
- `Programvareutvikling` — "software development", example self-description (FR-10).
- `Dataprogrammeringstjenester` (62.100), `Regnskapsføring og bokføring` (69.202), `Elektrisk installasjonsarbeid` (43.210) — SN2025 industry names (P §6.1, TN).
- Brønnøysundregistrene / Brreg; Enhetsregisteret — the register(s).
- `organisasjonsnummer` — organisation number (P §3).
- Register field names kept untranslated in code (`driftsresultat`, `sumDriftsinntekter`, …) — UI labels for them not given.
- `AS` — legal form covered.
- "kr" / "kroner", "øre".
- Norwegian number format per FR-53: `1 234 567,89`, (narrow) nbsp thousands, comma decimal, `kr` before or after, `%`. Sources write e.g. "1 390 898 kr", "16.7 million" (English docs).
- Nothing else: tab names, match-basis tiers, unaudited label, below-floor copy, uncovered statement, funnel stage names, button labels — **all lack Norwegian copy**.

## 8. Open questions / contradictions affecting UX

1. **Median marker on a *single* closable-share control** (FR-31, KF, P §3): the control is one global slider across all figures, but each figure has its own median/quartile gap. A per-figure median cannot sit on one shared 0–1 control unless it is expressed per figure (e.g. the s at which each figure reaches its median) or shown per-row. Unresolved design problem.
2. **Three vs four outputs of the control**: B Solution says it updates "profit uplift, working capital released and enterprise value" (three); PA says the control "drives three outputs"; FR-31 / TN Data out say **four amounts** (adds capital released from operating assets). Authoritative (TN) = four.
3. **Decomposition views — placement and content**: FR-26 names two views but no tab holds them (tabs: overview, peers, key figures and gaps, development over time, value). TN Data out calls one "margin and asset turnover" — but the ROA identity uses rev/`sumEiendeler` (total asset turnover), **not** key figure 11 operating asset turnover (rev/(`sumEiendeler` − `bankinnskudd`)). Risk of mislabelling.
4. **Persistence in explanation vs account wall**: FR-52 says explanation names persisted gaps (multi-year), and explanation is open to anon, while development over time requires an account. Does the anon explanation leak walled multi-year content, or omit persistence for anon?
5. **Industry overview "median margin over time"** needs multi-year operating margin, but API gives only the latest year → trend depends on OCR'd older filings (fallback: latest year only, FR-61). Also "share of companies growing" needs prior-year revenue (OCR). Which margin (operating?) is unstated.
6. **Signed-in front page**: FR-63 makes the portfolio *the* front page for signed-in users. Does a signed-in user still see the orgnr field and industry overviews? Unspecified.
7. **"Follow" / favourites undefined**: portfolio lists "every company they follow" and reads saved analyses only; account wall lists "favourites" — no FR defines favouriting or how "follow" relates to saved analyses/workspaces.
8. **Implicit vs explicit save**: FR-17 says a signed-in user's exclusions are "saved with the analysis"; FR-49 says an owner *saves* an analysis. Is a signed-in unsaved analysis auto-saved, or URL-state like anon?
9. **Registration creates a workspace automatically** (FR-40/FR-69: URL state "written into the new workspace") — so every sign-in from an analysis creates a workspace? Unclear for sign-in from front page with no analysis.
10. **Viewer interactivity**: viewers are read-only, but can a viewer move the closable-share control, enter an EV/EBIT multiple, exclude peers (ephemerally), or regenerate explanation? Unspecified.
11. **Full-year unfiled figures (FR-38) vs YTD (FR-67)**: does a full-year unfiled entry get percentiles/kroner against peers' latest filed year (FR-35 says compared, period difference stated), whereas YTD gets ratios only? Kroner for full-year unfiled is not stated either way. Where does entry live (which tab)?
12. **Total cost share (6)** has direction ↓ in KF, but FR-21 says it is a check, not a primary benchmarking figure. Does it get favourable quartile/percentile in the table, or display differently?
13. **No-direction figures' display**: FR-27 says show value against peer distribution, never ranked; KF says show "the peer median and quartiles as a distribution". Consistent, but they also sit in the same table whose columns are median / favourable quartile / percentile — needs a distinct row treatment.
14. **VAT limitation wording conflict**: KF says receivable-day VAT overstatement is "similar across a VAT-registered peer group, so the comparison holds"; P §5 says "only roughly similar, not cancelled … comparison is weakest where the peer group is most mixed". KF is authoritative per §0 but P is the more recent, stricter reading. Affects disclosure copy.
15. **Funnel count count**: FR-15 says five stage counts; FR-9 adds a separate count per segmentation criterion; FR-14 adds flagged count; FR-23 adds per-figure undefined counts. More than five numbers to fit at 375 px (PA).
16. **Loosen control granularity**: size band 0.5–2× → max 0.25–4× — one step, several steps, or continuous? Geography loosening only exists in some industries.
17. **Large non-`smaaForetak` subjects** (e.g. ~8 in 69.202) get no peer group at all and every aggregate withheld (P §10) — loosening cannot help (comparability not loosenable). Needs its own state, distinct from below-floor on a single row and from uncovered.
18. **Data quality flag visibility**: FR-57 / TN Data out say per-filing flag is user-visible, but since failing figures are withheld (FR-58), what does a flag show on a passing filing, and where?
19. **Audit log**: in brief v1 scope and FR-48, but no user-facing surface defined.
20. **CAPTCHA timing**: CAPTCHA on anonymous sign-in (FR-6) and anon sign-in happens "on arrival" (FR-39) → a CAPTCHA before the first lookup would contradict "one field and a minute" (B). Placement unstated.
21. **Development-over-time vs YTD history**: replaced unfiled entries "kept as history" (FR-36) — where is that history visible?
22. **"About a dozen measures"** (B) vs 14 numbered + cash share (KF) — copy/marketing must not say a different number than the table shows.
23. **No device in journeys**: responsiveness is mandatory (FR-55) but no journey is on a phone; UJ-3 (email invitation) is the natural phone case, unconfirmed.
24. **Withdrawn company in a saved analysis** (FR-66): kept in saved figures but cannot be re-added — how a saved analysis marks it is unspecified.
25. **Persona naming**: P §2.3 names are `[ASSUMPTION]` (invented) — fine for UX narratives but flagged.

## 9. Non-functional items with UX consequence

- **Performance**: peer group assembly < 1 s; complete analysis "within a few seconds" (FR-20, P §7, TN Performance). Recompute after exclude/loosen "immediately" (FR-19). Closable-share control updates "live" (FR-31). Explanation regeneration is a model call (latency + rate limit) — needs pending/limit state (FR-52). Description classification is a model call on entry (FR-5).
- **Brand promise**: "one field and a few seconds"; insight "in under a minute" (B; P FR-6 note says unmeasured).
- **Responsiveness**: down to ~375 px; single column when narrow; page body never scrolls horizontally; tables, distribution plots, peer list scroll in own `overflow-x: auto` container; check at phone width while building (FR-55, FR-56, SM-7, AGENTS.md).
- **Accessibility**: P §7 heading "Accessibility and responsiveness" contains only responsiveness — **no WCAG level or a11y requirement stated**.
- **Language**: UI Norwegian bokmål only; docs/code English; register field names untranslated (P §11 q2, AGENTS.md). No multi-language.
- **Number display**: Norwegian formats; % one decimal, days whole, kroner whole (FR-21, FR-53).
- **Rate limiting / CAPTCHA** on open route; refusal state (FR-6).
- **Freshness disclosure**: filing year + read date on every figure/aggregate/overview, in PDF and saved analysis (FR-64).
- **Traceability**: every kroner figure → key figure → filed values (FR-60); every figure in explanation links to its calculation (FR-52).
- **No browser storage** for anything that matters; anon state in URL only (FR-69, AGENTS.md).
- **Privacy**: a user's lookups, workspaces, unfiled figures are private; never put workspace id or unfiled figure in URL (TN Access control).
- **Licence credit** on every route incl. PDF, reachable from every page (FR-65).
- **Counter-metrics shaping UI**: don't pad tables to avoid empty rows — "an empty row that says why is the correct output" (SM-C2); "Unclassified" is a correct answer (SM-C3); bigger peer group isn't better (SM-C1).
- **Cut order** if time short (P §6.2, TN Schedule): portfolio front page → industry overviews → unfiled/YTD → PDF export → withdrawn removal → development-over-time view → 43.210 → embeddings. UI for these lands late (weeks 11–12).
