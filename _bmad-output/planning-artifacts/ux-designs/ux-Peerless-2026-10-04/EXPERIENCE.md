---
name: Peerless
status: draft
updated: 2026-10-10
sources:
  - _bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/addendum.md
  - _bmad-output/planning-artifacts/briefs/brief-Peerless-2026-09-17/tilbakemelding-product-brief.md
  - _bmad-output/planning-artifacts/prds/prd-Peerless-2026-09-25/prd.md
  - _bmad-output/planning-artifacts/prds/prd-Peerless-2026-09-25/addendum.md
  - _bmad-output/planning-artifacts/technical-note-architecture.md
  - docs/key-figures.md
---

# Peerless — Experience Spine

v1 scope (memlog 2026-10-10): one industry, `62.100`; no accounts and no account wall; four open tabs; no Utvikling, no sparklines, no portfolio, no industry overviews. Stage-2 and stage-3 decisions are kept in [Later stages](#later-stages-decided-not-in-v1).

## Foundation

- **Form factor:** responsive web, desktop down to 375px (FR-55, FR-56). Every screen is designed at both widths.
- **UI system:** Next.js App Router, Tailwind + shadcn/ui, Recharts for charts. This spine specifies the behavioural delta on shadcn; `DESIGN.md` is the visual reference.
- **Language:** the interface is Norwegian bokmål. All copy lives in message files keyed by dotted ids (`front.title`, `gap.wf.title`), starting from [.working/messages-v1.nb.json](.working/messages-v1.nb.json). No string is hard-coded in a component. An English version is out of v1 (PRD §5, §6.2); the keys are a code convention only.
- **State:** nothing is stored about the visitor. Everything they change — orgnr, excluded peers, size-band step, closable share, multiple — lives in the URL (FR-69).
- **Data:** every lookup reads Peerless's own database (the seed, FR-73). Nothing calls the register, a model or OCR at request time.
- **Mocks:** [.working/v1-front.html](.working/v1-front.html), [.working/v1-analysis.html](.working/v1-analysis.html), [.working/v1-about.html](.working/v1-about.html), with arithmetic in [.working/review-notes-v1.md](.working/review-notes-v1.md). **This spine wins on conflict with any mock**; known discrepancies are listed in [Mock discrepancies](#mock-discrepancies).

## Information Architecture

| Surface | Route | Reached from | Purpose |
|---|---|---|---|
| Forside | `/` | Wordmark, direct | One hero search field; one honest headline and one sentence saying v1 covers 62.100; "Slik fungerer det" in three steps; link to "Slik fungerer Peerless". No SaaS buttons |
| Analyse · Oversikt | `/analyse/{orgnr}` | Search result, URL | Company header; hero card (largest gap); beeswarm with compact peer list; small cards; explanation |
| Analyse · Peers | same, tab | Tab, "Se alle 23" | Funnel, size-band control, full peer list with exclude/restore |
| Analyse · Nøkkeltall og gap | same, tab | Tab, "Se alle nøkkeltall" | Benchmark table with fold-outs |
| Analyse · Verdi | same, tab | Tab, "Endre i Verdi" | Closable-share control, amount cards, multiple field |
| Uncovered result | `/analyse/{orgnr}`, no tabs | Search result outside 62.100 | Three API figures and the statement (FR-4) |
| Slik fungerer Peerless | `[ASSUMPTION]` `/slik-fungerer-peerless` | Header on every page, front page link, footer "Kilder og lisens" | Funnel in plain words, where AI is used, what is measured, sources and licence, limitations, data age (FR-72) |

- **One header on every page:** wordmark, search field, "Slik fungerer Peerless". No menu items for features not in v1.
- **On the front page the header search is hidden**; the hero search takes its place (decided).
- Footer on every page: the source line (FR-65).
- `[ASSUMPTION]` How the active tab is addressed (sub-path or query) is not decided; it must survive reload and sharing like the rest of the URL state.

**Surface closure.** Every need has a surface and every surface a journey:

| Need (memlog / PRD) | Surface | Journey |
|---|---|---|
| Who are our real peers | Peers, Oversikt beeswarm | UJ-1, UJ-2, Flow 3 |
| Where are we losing money, in kroner | Oversikt hero, Nøkkeltall og gap | UJ-1, UJ-2, Flow 3 |
| What would closing it be worth | Verdi | UJ-2 |
| Why the margin differs | Nøkkeltall og gap fold-outs | Flow 4 |
| Trace any kroner amount | Provenance drill-down | Flow 4, UJ-2 |
| How it works, can I trust it | Slik fungerer Peerless | UJ-1 |
| Company outside 62.100 | Uncovered result | UJ-2 edge |

## Voice and Tone

Plain Norwegian, short sentences, honest about uncertainty. A limit is stated as plainly as a result. Explains, never recommends (FR-54). No exclamation marks, no "Kom i gang", no superlatives.

| Do | Don't |
|---|---|
| "Foreløpig dekker Peerless én bransje: 62.100 Dataprogrammeringstjenester." | "Sammenlign hvilket som helst norsk selskap" |
| "For få sammenlignbare (7 av 10)" | Hiding the row, or "Ikke nok data" |
| "Regnskapsår 2025 · hentet 3. okt. 2026" | "Oppdaterte tall" |
| "Peerless foreslår ingen multippel." | A pre-filled multiple |
| "Dette forklarer avviket. Det er ikke et gap som skal lukkes" | Language that invites adding the waterfall to the profit uplift |

### Vocabulary

Decided once; used verbatim everywhere (memlog vocabulary entries; messages-v1).

| Concept | Term in UI | Notes |
|---|---|---|
| Peers, in running text | sammenlignbare selskaper / sammenlignbare | |
| Peer group, as a term | peer-gruppe | "standard peer-gruppe" for the default |
| Revenue-weighted peer aggregate | peer-gruppen samlet | Reference for the margin waterfall only, never a target |
| Median | Median | |
| Favourable quartile | beste fjerdedel | The target of every kroner amount |
| Percentile | Plassering — "bedre enn 34 %" | |
| Interquartile range | Midtre halvdel | |
| Match basis | Grunnlag for treff: **Beskrivelse og regnskap** / **Kun regnskap** / **Kun bransje og størrelse** | |
| Inclusion reason | Hvorfor med | |
| Flagged by FR-14 | Usikker klassifisering | |
| Kroner gap | gap i kroner | |
| Closable share | Hvor mye av gapet som lukkes | Steps 0 / 25 / 50 / 75 / 100 % and "Til medianen (42 %)" |
| Median on the control | "Median nås ved 42 % av gapet"; disabled: "ligger allerede over medianen" | |
| Funnel stages | Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering | |
| Widen size band | Utvid størrelsesintervallet; steps labelled Standard / Utvidet | |
| Data date | Regnskapsår 2025 · hentet 3. okt. 2026 | |
| Below minimum group | For få sammenlignbare (7 av 10) | Phone short form "For få (7 av 10)" |
| No declared direction | Ingen retning | |
| Direction | ↑ Høyere er bedre / ↓ Lavere er bedre; "Bedre →" on axes | |
| Strength | ▲ Styrke | No kroner |
| Adjusted group | Forklaringen gjelder standard peer-gruppe | |
| Capital amount | Frigjort kapital: 412 000 kr (engangsbeløp) | Profit amounts say "per år" |
| Cost-share group row | Forklarer marginavviket – summeres ikke | |
| Table top note | Viser gap ved full tilnærming · Endre i Verdi | |
| Decompositions | Hva forklarer marginavviket? · Margin eller kapitalbruk? · Lønnsnivå eller produktivitet? | |
| Revenue / total assets | totalkapitalens omløpshastighet | Never confused with key figure 11, "omløpshastighet driftseiendeler" |
| Provenance | Hvordan er dette regnet? | |
| Expand explanation | Les mer | |
| Exclude / restore | Ekskluder / Ta med igjen; tag "Ekskludert"; "Tilbakestill til standard" | |
| User-entered figures (stage 2) | Egne tall – ikke levert | Never "urevidert" |
| AI content, screen readers | KI-generert | |
| Source line | Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens | |
| NLOD credit (API figures only, on Slik fungerer Peerless) | Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene | |

### Number formatting

`Intl.NumberFormat('nb-NO')` for every displayed number; non-breaking space before units.

| Kind | Format | Example |
|---|---|---|
| Kroner | whole kroner, space thousands, "kr" | 1 170 000 kr |
| Signed kroner | true minus `−` and `+` | −501 428 kr |
| Millions | one decimal, "mill. kr" | 16,7 mill. kr |
| Percent | one decimal | 2,1 % |
| Percentage points | one decimal, "pp" | 7,0 pp |
| Days | whole days | 48 dager |
| Turnover | two decimals | 2,85 |
| Orgnr | grouped 3-3-3 | 912 345 678 |

Display rounding only; computation stays exact (AGENTS.md, FR-21). Displayed waterfall bars use largest remainder so they sum to the displayed total.

## Component Patterns

Behavioural. Visual specs are in `DESIGN.md` Components.

| Component | Behaviour |
|---|---|
| **Search field** | One field for name or orgnr (FR-1). Exactly nine digits (spaces ignored) → exact orgnr match; anything else → fuzzy name match. Searches the seed only, never the register. Validation on submit and blur, never while typing. Focus ring `{colors.navy-700}`. |
| **Search results** | Each result: name, orgnr, primary industry, municipality. Arrow keys move, Enter opens, Esc closes. Choosing a result resolves on orgnr. A nine-digit exact match goes straight to the analysis. Results never filter on financial criteria (PRD §5). `[ASSUMPTION]` result count cap and debounce not decided. |
| **Company header** | Name, orgnr, industry, revenue, filing year and read date on every analysis (FR-2, FR-64). |
| **Tabs** | Four links, all open. State in the URL survives switching. 375: all four fit, labels may wrap; no horizontal scroll. |
| **Hero card** | The largest kroner gap per year at full convergence; own vs beste fjerdedel; context line (median, Plassering, pp to beste fjerdedel). Links "Hvordan er dette regnet?" and "Se alle nøkkeltall". |
| **Small card** | Three: "Nest største gap" (carries its unit — "Frigjort kapital: 412 000 kr (engangsbeløp)"; cost shares never qualify, being a breakdown), "Største styrke" (no kroner), "Mangler grunnlag" (own value + reason). |
| **Explanation card** | Stored text for the default peer group (FR-52), clamped to two lines, "Les mer" expands in place. Marked ✦ as a whole. Every figure in it links to its calculation (FR-52). Adjusted group → tag "Forklaringen gjelder standard peer-gruppe" plus hint. No stored text → a plain statement, nothing generated (FR-73). |
| **Beeswarm** | Driftsmargin; every peer a dot, the company highlighted. Hover, focus or tap shows name, value and revenue in a tooltip. Keyboard: the chart is one tab stop; `[ASSUMPTION]` arrow keys step through dots in value order, Esc closes. Compact list beneath (five peers nearest the company, "Se alle 23" → Peers). |
| **Benchmark row** | Own value, median, beste fjerdedel, Plassering, distribution strip, gap in kroner (memlog). Cost shares: no kroner of their own, cell reads "Se forklaring av marginen" and jumps to the waterfall. Total cost share is a check row, no placement. No-direction rows: own, median, midtre halvdel, "Ingen retning", no kroner. Below-floor rows keep the own value. 375: tap expands the row (median, beste fjerdedel, Plassering, direction, count, kroner, fold-outs). |
| **Distribution strip** | Focusable; tooltip per marker. Every distribution row shows median and beste fjerdedel where both exist (FR-27). |
| **Fold-out** | Collapsible under its row: "Hva forklarer marginavviket?" under Driftsmargin; "Margin eller kapitalbruk?" under Totalkapitalrentabilitet; "Lønnsnivå eller produktivitet?" under Lønnskostnadsandel. All open in v1 (FR-26). Closed by default `[ASSUMPTION]`. |
| **Margin waterfall** | Against peer-gruppen samlet: four bars (Varekostnad, Lønn, Andre driftskostnader, Avskrivninger og øvrige poster), summing exactly to (own margin − samlet margin) × revenue. Names its reference. Never scaled by the closable share, never added to profit uplift (FR-30). Fewer than 10 in the common set, or a missing component → no waterfall, count stated. "Vis tallene" opens the numbers as a table. |
| **Factor pair** | Each factor against its own median, never multiplied; no named peer as benchmark. "Margin eller kapitalbruk?": driftsmargin and totalkapitalens omløpshastighet. "Lønnsnivå eller produktivitet?": personnel cost per FTE (no direction, so no beste fjerdedel) and revenue per FTE. `[ASSUMPTION]` the second is spine-only, not mocked. |
| **Funnel** | Five stage counts, always shown, even below the floor (FR-15); flagged count; "n ekskludert av deg → m i analysen". |
| **Size-band control** | Three fixed steps, one action each: 0,5–2× → 0,33–3× → 0,25–4× (FR-18). Shows the resulting revenue range. Any step beyond Standard tags the group "Utvidet" and shows a banner with "Tilbake til standard (0,5–2×)". Comparability is never loosenable, and the page says so. |
| **Peer list** | Name, revenue, Hvorfor med, Grunnlag for treff, flag, action. "Ekskluder" greys the row and keeps it with "Ta med igjen" (FR-17). "Tilbakestill til standard" clears all. Every change recomputes everything at once (FR-19). |
| **Closable-share control** | Steps 0 / 25 / 50 / 75 / 100 % plus "Til medianen (n %)" as its own step, n from driftsmargin, placed in order. Disabled, with "ligger allerede over medianen", when the company is above the median. Target is always beste fjerdedel. `[ASSUMPTION]` default step 100 % (hero and table read "ved full tilnærming"); the mock renders 50 %. |
| **Amount card** | Three always: Økt driftsresultat per år; Frigjort arbeidskapital; Frigjort kapital i driftseiendeler — shown beside working capital, never added to it. Each has its own median line. An amount without a target reads "Ikke beregnet – for få sammenlignbare på …". |
| **Multiple field** | EV/EBIT, empty by default, no suggestion. Empty → "Verdi beregnes når du legger inn en multippel. Peerless foreslår ingen multippel." Entered → "Økt selskapsverdi" with the visible product. Carried in the URL. |
| **Provenance drill-down** | "Hvordan er dette regnet?" on every kroner amount: formula → key figure and benchmark → filed values with register field names → source, filing year, read date, data quality (FR-60). The data quality flag lives here, not as a badge. "Lukk" closes; Esc too. |
| **State block** | One kicker, one or two sentences, at most one link. Never an empty analysis. |
| **Tag** | Non-interactive label for state ("Utvidet", "Ekskludert", "Forklaringen gjelder standard peer-gruppe", direction). Never the only carrier of a number. |
| **Uncertain flag** | "Usikker klassifisering" beside the match basis of a flagged peer (FR-14); the peer stays in the group. Counted under the funnel. |
| **AI marker (✦)** | See [AI marking](#ai-marking-). |
| **Tooltip** | Hover, focus or tap; Esc or tapping elsewhere closes; on touch only one open at a time. |
| **Source line** | Footer on every page; "Kilder og lisens" links to the sources section of Slik fungerer Peerless. |

## State Patterns

| State | Surface | Treatment and copy |
|---|---|---|
| Below the 10-peer floor (FR-22) | Benchmark row, cards | Row stays with own value; comparison cells replaced by "For få sammenlignbare (n av 10)"; no kroner. Funnel still shows counts. |
| **62.100 company outside the demo seed** (FR-73) | Analysis | API figures (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) compared in full, with kroner for driftsmargin. Document-based figures withheld as "For få sammenlignbare (n av 10)"; no waterfall, count stated; no stored explanation → stated. See Open questions. |
| Uncovered industry (FR-4) — demo company C | `/analyse/{orgnr}`, no tabs | Company header; state block "Bransjen er ikke dekket ennå" + "{name} er registrert i bransjen {industry}. Peerless dekker foreløpig bare 62.100 …"; three API figures with filing year and read date; "Uten sammenlignbare selskaper viser vi ingen median, plassering eller kroner."; link "Søk på et annet selskap". |
| **Orgnr not in the database** | Front page / header search | "Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi programmeringstjenester (62.100)." followed by links to demo companies A and B. Never a live register call, never an empty analysis. (Decided.) |
| Search, no match | Search results | `[ASSUMPTION]` "Ingen treff på «{q}». Peerless har foreløpig bare selskaper i programmeringstjenester (62.100)." with the same demo links. |
| Malformed number | Search field | Input of digits only (spaces ignored) with a count other than nine: "Organisasjonsnummeret må ha 9 siffer"; error border and glyph, announced by `aria-live`. `[ASSUMPTION]` the digits-only rule that separates a malformed number from a name search. |
| Own filing fails reconciliation (FR-71) | Analysis | The three API figures keep full comparison; the twelve document figures are absent with "Regnskapet for 2025 kunne ikke leses sikkert" (`[ASSUMPTION]` adapted from the stage-2 Utvikling string). Not demoted to uncovered. |
| Non-small subject below the floor | Analysis | "Peerless sammenligner foreløpig bare små foretak" — shown only when a non-small subject's comparison falls below the floor (memlog). |
| Adjusted peer group (FR-52) | Explanation card | Tag "Forklaringen gjelder standard peer-gruppe" + "Du har ekskludert {x} sammenlignbare. Tallene i analysen er oppdatert, teksten er ikke." |
| Widened size band (FR-18) | Peers, Oversikt | Tag "Utvidet", banner "Utvidet størrelsesintervall (0,33–3×). Dette er ikke standard peer-gruppe, og forklaringen gjelder standard peer-gruppe." + "Tilbake til standard (0,5–2×)". |
| Above median | Verdi | "Til medianen" disabled; "Fjordkode ligger allerede over medianen · Medianen gjelder driftsmargin." Each amount's median line: "Median: allerede over". |
| Below median | Verdi | "Til medianen (42 %)" enabled; "Median nås ved 42 % av gapet". |
| EV empty | Verdi | Field empty, no value shown, explanatory sentence. |
| Strength | Benchmark row, card | "▲ Styrke", no kroner (FR-29). |
| Rate-limit refusal (FR-6) | Any lookup | A refusal, never a partial analysis. `[ASSUMPTION]` copy: "Det er gjort mange oppslag fra denne adressen på kort tid. Vent litt, og prøv igjen." |
| Loading | Search field, analysis | Field read-only, button disabled, spinner, "Henter analysen …" announced (`[ASSUMPTION]` replaces the mock's "Henter regnskap …"); analysis: shadcn `Skeleton` in the card layout. |
| Lookup error | Search field, analysis | `[ASSUMPTION]` "Noe gikk galt. Prøv igjen om litt." No partial figures. |
| Data date | Every analysis | "Regnskapsår 2025 · hentet 3. okt. 2026" in the company header and in every provenance drill-down (FR-64). |
| Source attribution | Every page | Footer source line; NLOD credit for API figures and the separate credit for document figures on Slik fungerer Peerless (FR-65). |
| Measurement pending | Slik fungerer Peerless | "Målingen pågår. Resultatene publiseres her når de foreligger." No placeholder figures (FR-72). |

## Interaction Primitives

- **URL is state.** Every change writes to the URL; reload, bookmark and forwarded links reproduce the analysis (FR-69). Back steps through the user's own changes `[ASSUMPTION]` (replace vs push not decided).
- **Immediate recompute.** Exclude, restore, widen and step changes update every figure on every tab at once, with no stale value (FR-19).
- **Fixed steps, not sliders**, for the size band and the closable share.
- **Fold-outs, not dialogs.** Decompositions and provenance open inline under what they explain. No modal in v1.
- **Tooltips** on hover, focus and tap; never the only place a value lives — legends and tables carry every number shown in a chart.
- **Keyboard:** Tab order follows reading order; Enter/Space toggle fold-outs and steps; arrow keys move within segmented controls and search results; Esc closes tooltips, results and drill-downs.
- **Banned:** sliders for money, infinite scroll, hover-only affordances, autoplaying motion, any browser storage for state that matters.

## Accessibility Floor

WCAG 2.2 AA. Visual contrast is in `DESIGN.md` Colors.

- **Shape, not colour:** company dot (`{components.marker-company}`), median tick (`{components.marker-median}`), beste fjerdedel triangle (`{components.marker-best-quartile}`); direction always an arrow or a word, with `{colors.favourable}` / `{colors.unfavourable}` as reinforcement only.
- **✦ has a text alternative:** "KI-generert" for screen readers; the glyph itself is `aria-hidden`.
- **Charts:** each is one focusable element with an `aria-label`; tooltips reachable by keyboard; every charted value also exists as text (legend, table, or "Vis tallene").
- **Focus:** visible 2px `{colors.navy-700}` ring on every interactive element.
- **Live regions:** search errors, loading and recomputed totals announced politely.
- **Reduced motion:** honour `prefers-reduced-motion`; no transitions on recompute in that mode.
- **Reflow:** tables and charts in their own `overflow-x: auto` container; the body never scrolls sideways at 375 or above.
- Tap targets ≥ 44px on the phone `[ASSUMPTION]` (not stated in sources; mock steps are smaller).

## Responsive & Platform

Designed at 1200 and 375. `[ASSUMPTION]` the switch point (Tailwind `md`, 768px) is not decided.

| Element | Desktop | 375 |
|---|---|---|
| Header | Wordmark, compact search, link | Search flexes; link wraps to two lines |
| Front page | Centred hero, field and button joined, steps in three columns | Left-aligned, field and full-width button stacked, steps stacked |
| Tabs | Text tabs | All four fit, labels wrap; no scroll strip |
| Oversikt | 12-column card grid | One column: hero, plot + list, small cards, explanation |
| Beeswarm tooltip | Follows pointer | Opens above the plot with a leader line; never covers the company marker |
| Benchmark table | Seven columns in a scroll container | Three-column rows (Nøkkeltall · own · Gap i kroner) that expand on tap |
| Funnel | Five columns | Vertical list, count right, bar beneath |
| Margin waterfall | Columns | Vertical rows, one per step, floating bar on a shared kroner scale |
| Peer list | Table | One card per peer; "Vis alle 25" |
| Segmented controls | Inline | Full-width grid, wrapping to two rows for the closable share |
| Amount cards | Three across | Stacked |

## AI marking (✦)

- ✦ marks AI-produced content: **the explanation block as a whole**, peer classification labels, and "Hvorfor med" where AI was involved (memlog).
- ✦ is **never** on an individual number, and engine figures never carry it — including the numbers inside the explanation, which link to their calculations instead (FR-52).
- Screen readers hear "KI-generert".
- The explanation keeps its source line: "Skrevet av KI ut fra tall Peerless har regnet ut. Hvert tall finnes i analysen."
- Open: see Open questions on "Hvorfor med" and FR-16.

## Numbers and their context

**Rule (decided): every number shows its context, or says why it has none.** Context is the peer median, beste fjerdedel or peer-gruppen samlet.

| Number | Context, or the stated reason |
|---|---|
| Benchmarked figure | Median and beste fjerdedel (and Plassering) |
| Kroner gap | Own vs beste fjerdedel, the step it was computed at, and its drill-down |
| Waterfall bar | Own share vs peer-gruppen samlet |
| Uncovered-state API figures | The statement that the industry is not yet covered, so there is no peer comparison |
| Below-floor own value | "For få sammenlignbare (n av 10)" |
| Header revenue | Identification, not a benchmarked figure; carries its filing year and read date |
| No-direction figures | Median and midtre halvdel, plus "Ingen retning" |

## Key Flows

Figures come from the PRD journeys and the v1 mocks; Kari's company is rendered as Fjordkode AS (16 714 286 kr revenue, 2,1 % margin). Figures are for the default peer group.

### UJ-1. A company finds out that beating its industry is not the same as being good (Kari, v1 part)

Kari, finance lead at a twelve-person software company in `62.100`, laptop, no account.

1. On the front page she enters her own organisation number in the hero search; an exact nine-digit match goes straight to the analysis.
2. Oversikt opens: company header with "Regnskapsår 2025 · hentet 3. okt. 2026"; the beeswarm shows 23 sammenlignbare.
3. In Peers she reads the funnel (214 → 131 → 88 → 31 → 23, 2 with "Usikker klassifisering") and each peer's "Hvorfor med" and "Grunnlag for treff". Two are resellers; she clicks "Ekskluder" on both. They grey out with "Ta med igjen"; every figure recomputes; the explanation now carries "Forklaringen gjelder standard peer-gruppe".
4. She walks Nøkkeltall og gap for the largest kroner gaps, then reads the explanation and "Les mer".
5. **Climax:** her 2,1 % margin is above the median of −3,2 % — the number she would have quoted — and "bedre enn 61 %". Against beste fjerdedel, 9,1 %, it is 7,0 pp: **1 170 000 kr per år** at full convergence. Beating a loss-making industry told her nothing.
6. Edge: Kundefordringsdager shows 48 dager and "For få sammenlignbare (7 av 10)", no median, no kroner.

Ends in v1 with the analysis as its URL; PDF and sign-in are stage 2. Failure: lookup error → the error state; no partial analysis.

### UJ-2. An adviser walks into a first meeting already knowing where the company is weakest (Anders)

Anders, consultant, preparing for Thursday's meeting with a prospect: a nine-person `62.100` consultancy, about 12,5 mill. kr revenue. Not signed in.

1. He enters the prospect's orgnr in the header search and lands on Oversikt.
2. In Peers he judges the group himself; the funnel and "Hvorfor med" convince him.
3. Oversikt's hero shows the largest gap. **Climax:** driftsmargin −4,9 % against a median of −3,2 % and beste fjerdedel 9,1 % — 14,0 pp, **1 752 531 kr per år** at full convergence (14,0 pp × 12 518 082 kr).
4. In Verdi, "Til medianen (12 %)" is enabled: just reaching the median is worth 212 807 kr per år (1,7 pp × 12 518 082 kr). He enters no multiple; nothing is valued.
5. He copies the URL into his meeting notes.

Edge: his next prospect is a `69.202` bookkeeping firm (demo company C) → uncovered state, three API figures, no comparison. Failure: rate limit → refusal state, retry later.

### Flow 3 — Anders on his phone before the meeting

`[ASSUMPTION]` device and context, to be confirmed: Anders, in the lobby ten minutes before the UJ-2 meeting, on a 375px phone.

1. He opens the URL from his notes; the same analysis loads, because the state is in the address.
2. Oversikt is one column: the hero card shows 1 752 531 kr per år first.
3. He taps a dot in the beeswarm; the tooltip opens above the plot, naming a peer he knows.
4. In Nøkkeltall og gap he taps the Driftsmargin row; it expands with median −3,2 %, beste fjerdedel 9,1 % and Plassering.
5. **Climax:** he taps "Hvordan er dette regnet?" and sees the line from the prospect's own filed `driftsresultat` and `sumDriftsinntekter` to the amount — the sentence he will open the meeting with, with its source.

Failure: no signal → the browser's own error; nothing Peerless-specific is cached.

### Flow 4 — Kari asks why the margin differs

`[ASSUMPTION]` protagonist and context: Kari, after UJ-1, the next morning.

1. In Nøkkeltall og gap the cost-share rows say "Se forklaring av marginen" instead of kroner.
2. She opens "Hva forklarer marginavviket?" under Driftsmargin. The tag reads "Mot peer-gruppen samlet: 0,5 %, ikke beste fjerdedel".
3. The waterfall runs from 83 571 kr (samlet margin on her revenue) to her 351 000 kr driftsresultat: Varekostnad +1 019 571 (5,1 % mot 11,2 %, lavere enn samlet), Lønn −501 428 (66,9 % mot 63,9 %), Andre driftskostnader −568 286 (24,4 % mot 21,0 %), Avskrivninger og øvrige poster +317 572 (1,5 % mot 3,4 %). The bars sum to 267 429 kr = 1,6 pp × 16 714 286 kr.
4. **Climax:** her low goods cost hides it: lønn and andre driftskostnader together are 1 069 714 kr more than the group as a whole would spend on her revenue. And the page says plainly that this explains the difference — it is never added to the 1 170 000 kr.
5. She opens "Margin eller kapitalbruk?": margin 2,1 % against a median of −3,2 %, totalkapitalens omløpshastighet 2,29 against 1,86 — above the median on both, each against its own median, never multiplied.
6. She opens "Lønnsnivå eller produktivitet?" to see whether lønn is pay level or output per person.

Failure: fewer than 10 peers in the common set → no waterfall, count stated.

## Inspiration & Anti-patterns

- **Lifted:** the institutional research report — restraint, dense readable tables, a stated source under every exhibit.
- **Not adopted** (memlog; out of scope per brief addendum): composite scores; peer-match percentages; AI chat; screening and rankings; a compare module.
- **Rejected layouts:** round-1 directions A, B and C as wholes, including the persistent summary rail ([.working/directions-analysis-1.html](.working/directions-analysis-1.html)).

## Later stages (decided, not in v1)

One line each; detail in `.memlog.md`.

- **Account wall** (stage 2): tabs that need an account are visible and say so; sparklines open to everyone with a faint peer-median line, no band, no placement, no own figures.
- **Utvikling** (stage 2): one chart per key figure 2021–2025, company line, dashed median, shaded median-to-beste-fjerdedel band; a failed year is a break with "Regnskapet for 2022 kunne ikke leses sikkert"; engine-decided persistence text ([.working/analysis-2.html](.working/analysis-2.html)).
- **Own figures** (stage 2): owner-only "Legg inn tall som ikke er levert" in Utvikling; labelled "Egne tall – ikke levert"; ratios and percentiles only, never kroner, period difference stated.
- **Portfolio** (stage 2): signed-in front page with every followed company, latest position, what changed, largest gaps; orgnr field in the header; "follow" = a saved analysis.
- **Explicit save** (stage 2): "Lagre i arbeidsområde"; until saved, URL state as for anonymous users; exclusions saved with the analysis.
- **Viewer what-if** (stage 2): a viewer may move the closable-share control and enter a multiple locally, never saved.
- **Withdrawn company** (stage 2 for saved analyses): as subject, "Selskapet er slettet fra Enhetsregisteret 12.03.2027, og tallene er fjernet"; as peer, row removed, note "Én sammenlignbar er fjernet fra registeret".
- **Live register lookup** for an orgnr not in the database may be considered (stage 2).
- **Landing page with industry overviews** (stage 3): distributions and medians only, never named companies ([.working/landing-2.html](.working/landing-2.html)).

## Mock discrepancies

The v1 mocks predate the newest decisions. The spines win; no re-render is planned.

1. **Search:** mocks are orgnr-only (label, placeholder "Organisasjonsnummer, f.eks. …", numeric keyboard, step 1 "Skriv inn organisasjonsnummer"); name search and the results list are not drawn.
2. **Not-found copy** says "finnes ikke i Enhetsregisteret", implying a register check; superseded by the decided copy with demo links.
3. **✦** appears nowhere; explanation figures do not link to their calculations.
4. **Header search:** the header field is orgnr-only ("Org.nr."); hidden on the front page as decided.
5. **Headline:** "Sammenlign selskapet ditt med selskaper som faktisk ligner" and its lead do not say 62.100; coverage sits in a separate small line. The decision is one honest headline plus one sentence that says v1 covers 62.100. Step 1 body "Vi henter selskapets regnskap fra Brønnøysundregistrene" and loading "Henter regnskap …" suggest a live fetch.
6. The key-figure table omits EBITDA-margin, omsetning per årsverk, lønnskostnad per årsverk, leverandørgjeldsdager and kontantandel; the built table carries the full set (FR-21).
7. Peers: the list shows 23 active plus 2 excluded peers while the summary says 21 in the analysis and 23 in the standard group.
8. "Lønnsnivå eller produktivitet?" is drawn closed with no content.
9. The about page frames the small-company limit as "small with small, larger with larger" rather than the memlog's state string.
10. Not drawn: no-match, rate-limit, lookup error, FR-71, outside-seed states, dark mode.

## Open questions

- **"Hvorfor med" and ✦:** the memlog puts ✦ on "Hvorfor med" where AI was involved, but FR-16 says the inclusion reason is rules-written, never model-written. Does ✦ attach to the reason, or only to the classification it cites?
- **62.100 outside the demo seed:** the subject's own document figures are not in the demo seed either, so "For få sammenlignbare" cannot show an own value as FR-22 expects. Copy for a missing own value is undecided.
- **Closable-share default** and whether the key-figure table follows the control or always shows full convergence.
- **Demo companies A and B:** names and orgnrs for the not-in-database links are not yet fixed (README, FR-73).
- **Source inconsistency:** PRD glossary says the open route is rate-limited "from stage 2"; FR-6 puts the per-IP limit in v1. This spine follows FR-6.
