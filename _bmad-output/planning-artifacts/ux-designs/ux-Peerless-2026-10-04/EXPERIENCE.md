---
name: Peerless
description: How Peerless v1 behaves — surfaces, vocabulary, components, states, interaction, accessibility and flows for one industry (62.100), no accounts. DESIGN.md is the visual reference.
status: final
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

v1 scope: one industry, `62.100`; no accounts and no account wall; four open tabs; light mode only; no Utvikling, no sparklines, no portfolio, no industry overviews. Stage-2 and stage-3 decisions are kept in [Later stages](#later-stages-decided-not-in-v1). UJ-3 and UJ-4 are stage 2 and have no v1 flow.

## Foundation

- **Form factor:** responsive web (FR-55, FR-56). Every screen is designed at 1200 and 375 CSS px, and must not break down to **320 CSS px** (WCAG 1.4.10 reflow floor).
- **UI system:** Next.js App Router, Tailwind + shadcn/ui, Recharts for charts. This spine specifies the behavioural delta on shadcn; `DESIGN.md` is the visual reference.
- **Theme:** light mode only in v1. The dark tokens in `DESIGN.md` are stage 2; nothing in this spine specifies dark behaviour.
- **Language:** the interface is Norwegian bokmål; `<html lang="nb">`. All copy lives in message files keyed by dotted ids (`front.title`, `gap.wf.title`); no string is hard-coded in a component. **The [Vocabulary](#vocabulary) table and the copy quoted in this spine are authoritative.** [mockups/messages-v1.nb.json](mockups/messages-v1.nb.json) is mock-era: it holds superseded strings (listed in [Mock discrepancies](#mock-discrepancies)) and must be regenerated from this spine before it seeds the app's message files. An English version is out of v1 (PRD §5, §6.2); the keys are a code convention only.
- **State:** nothing is stored about the visitor. Everything they change — orgnr, active tab, excluded peers, size-band step, closable share, multiple — lives in the URL (FR-69), and every URL value is validated on each request (see [Invalid URL state](#state-patterns)).
- **Data:** every lookup reads Peerless's own database (the seed, FR-73). Nothing calls the register, a model or OCR at request time.
- **Mocks:** [mockups/v1-front.html](mockups/v1-front.html), [mockups/v1-analysis.html](mockups/v1-analysis.html), [mockups/v1-about.html](mockups/v1-about.html), with arithmetic in [mockups/review-notes-v1.md](mockups/review-notes-v1.md). **The spines win on conflict with any mock** (stated here once; `DESIGN.md` refers to it). Known discrepancies are listed in [Mock discrepancies](#mock-discrepancies). Earlier rounds (`analysis-2.html`, `landing-2.html`, `directions-analysis-1.html`) stay in `.working/` as history.

### Build order

Thin slices, each shippable on its own, matching the technical note's schedule ([technical-note-architecture.md](../../technical-note-architecture.md), "Schedule"; week 2 is the first working analysis page). This note orders the work; it does not restate the schedule.

0. **Slice 0:** search → company header → Nøkkeltall og gap table, API figures first (driftsmargin, totalkapitalrentabilitet, egenkapitalandel), with the below-floor, not-found, uncovered and invalid-URL states.
1. Peers tab: funnel, size-band control, peer list with exclude/restore and the URL state.
2. Oversikt: hero card, small cards, beeswarm with its table, explanation card.
3. Verdi: closable-share control, amount cards, multiple field.
4. Decompositions: "Margin eller kapitalbruk?", "Lønnsnivå eller produktivitet?", then the margin waterfall.

Document-derived rows join the table as the seed's document figures land (TN weeks 4–6).

## Information Architecture

| Surface | Route | Reached from | Purpose |
|---|---|---|---|
| Forside | `/` | Wordmark, direct | One hero search field; one honest headline and one sentence saying v1 covers 62.100; "Slik fungerer det" in three steps; link to "Slik fungerer Peerless". No SaaS buttons |
| Analyse · Oversikt | `/analyse/{orgnr}/{fane}` | Search result, URL | Company header; hero card; beeswarm with compact peer list; small cards; explanation |
| Analyse · Peers | same, own `{fane}` | Tab, "Se alle 23" | Funnel, size-band control, full peer list with exclude/restore |
| Analyse · Nøkkeltall og gap | same, own `{fane}` | Tab, "Se alle nøkkeltall" | Benchmark table with fold-outs |
| Analyse · Verdi | same, own `{fane}` | Tab, "Endre i Verdi" | Closable-share control, amount cards, multiple field |
| Uncovered result | `/analyse/{orgnr}`, no tabs | Search result outside 62.100 | Three API figures and the statement (FR-4) |
| Slik fungerer Peerless | `/slik-fungerer-peerless` | Header on every page, front page link, footer "Kilder og lisens" | Funnel in plain words, where AI is used, what is measured, sources and licence, limitations, data age (FR-72) |

- **One header on every page:** wordmark, search field, "Slik fungerer Peerless". No menu items for features not in v1. On the front page the header search is hidden; the hero search takes its place.
- Footer on every page: the source line (FR-65).
- **Tabs are links**, not ARIA tabs: each tab is the path segment `{fane}` in `/analyse/{orgnr}/{fane}`, with `aria-current="page"` on the active one.
- **Page titles:** "{Selskap} – {Fane} – Peerless"; front page "Peerless"; about page "Slik fungerer Peerless – Peerless".
- **Headings:** `h1` is the company name (front page: the headline; about page: its title); `h2` the tab panel or page section; `h3` cards and fold-outs.

**Surface closure.** Every need has a surface and every surface a journey:

| Need (memlog / PRD) | Surface | Journey |
|---|---|---|
| Who are our real peers | Peers, Oversikt beeswarm | UJ-1, UJ-2, Flow 3 |
| Where are we losing money, in kroner | Oversikt hero, Nøkkeltall og gap | UJ-1, UJ-2, Flow 3 |
| What would closing it be worth | Verdi | UJ-2 |
| Why the margin differs | Nøkkeltall og gap fold-outs | Flow 4 |
| Trace any kroner amount | Provenance drill-down | Flow 3 |
| How it works, can I trust it | Slik fungerer Peerless | UJ-1 (step 8) |
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

Decided once; used verbatim everywhere. This table is the source the message files are regenerated from.

| Concept | Term in UI | Notes |
|---|---|---|
| Peers, in running text | sammenlignbare selskaper / sammenlignbare | |
| Peer group, as a term | peer-gruppe | "standard peer-gruppe" for the default |
| Revenue-weighted peer aggregate | peer-gruppen samlet | Reference for the margin waterfall only, never a target |
| Median | Median | |
| Favourable quartile | beste fjerdedel | The target of every kroner amount |
| Percentile | Plassering — "bedre enn 61 %" | **Plassering vises i hele prosent** (`docs/key-figures.md`, Arithmetic) |
| Interquartile range | midtre halvdel — "midtre halvdel 18,4–49,0 %"; "midtre halvdel −6,3 til 9,1 %" when a bound is negative | Shown as text in every row that draws the band |
| Match basis | Grunnlag for treff: **Beskrivelse og regnskap** / **Kun regnskap** / **Kun bransje og størrelse** | ✦ per [AI marking](#ai-marking-) |
| Inclusion reason | Hvorfor med | Rules-written (FR-16); see [AI marking](#ai-marking-) |
| Flagged by FR-14 | Usikker klassifisering | See [AI marking](#ai-marking-) |
| Kroner gap | gap i kroner | |
| Closable share | Hvor mye av gapet som lukkes | Steps 0 / 25 / 50 / 75 / 100 % and "Til medianen for driftsmargin (12 %)" |
| Median on the control | "Median nås ved 12 % av gapet. Medianen gjelder driftsmargin."; disabled: "{Selskap} ligger allerede over medianen. Medianen gjelder driftsmargin." | 12 % is UJ-2's value, s_med rounded to whole percent; amounts use the exact s (`docs/key-figures.md`) |
| Profit amount at a share, on Verdi | "585 000 kr av 1 170 000 kr per år" | The second figure is the hero's full-convergence amount, so the two read as one gap |
| Funnel stages | Bransje og størrelse → Sammenlignbart regnskap → Segment → Forretningsmodell → Klassifisering | |
| Widen size band | Utvid størrelsesintervallet; steps labelled Standard / Utvidet | |
| Data date | Regnskapsår 2025 · hentet 3. okt. 2026 | |
| Oversikt small cards | Største kapitalgap · Største styrke · Mangler grunnlag | The capital card shows the largest one-off capital amount and is not ranked against the per-year hero |
| Below minimum group | For få sammenlignbare (7 av 10) | Phone short form "For få (7 av 10)". Only for genuine below-floor cases |
| Figure not in the demo seed | Ikke i demodataene | Info popover: "Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen. Hele datasettet bygges lokalt med pnpm seed:full." |
| Own value undefined (FR-23) | Kan ikke beregnes | Plus the reason: "omsetningen er null eller negativ" / "en regnskapslinje mangler" |
| No declared direction | Ingen retning | |
| Direction | ↑ Høyere er bedre / ↓ Lavere er bedre; "Bedre →" on axes | Glyphs `aria-hidden`; screen readers get the words ("bedre mot høyre") |
| Strength | ▲ Styrke | No kroner |
| Adjusted group, explanation | Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den. | Replaces the explanation; "Tilbakestill" is the reset action |
| Capital amount | Frigjort kapital i driftseiendeler: 412 000 kr (engangsbeløp, ved full tilnærming) | Profit amounts say "per år"; capital amounts always "engangsbeløp" plus the share |
| Capital never summed | Ikke per år, og legges ikke til resultatet. | Mandatory under every capital amount on Oversikt |
| Cost-share group row | Forklarer marginavviket – summeres ikke | |
| Table top note | Viser gap ved full tilnærming · Endre i Verdi | On the key-figure table, the Oversikt hero and the small cards |
| Decompositions | Hva forklarer marginavviket? · Margin eller kapitalbruk? · Lønnsnivå eller produktivitet? | |
| Waterfall never added | Dette forklarer avviket. Det er ikke et gap som skal lukkes, og det legges aldri til økt driftsresultat. | Mandatory, directly above the waterfall at both widths |
| Waterfall reference differs from median | Mot peer-gruppen samlet, ikke medianen | Bar subline when the share's row and its bar point opposite ways |
| Revenue / total assets | totalkapitalens omløpshastighet | Never confused with key figure 11, "omløpshastighet driftseiendeler" |
| Provenance | Hvordan er dette regnet? | |
| Chart text alternative | Vis tallene / Skjul tallene | |
| Expand explanation | Les mer | |
| Exclude / restore | Ekskluder / Ta med igjen; tag "Ekskludert"; "Tilbakestill til standard" | Button accessible names include the peer: "Ekskluder Holmengrå Data AS" |
| User-entered figures (stage 2) | Egne tall – ikke levert | Never "urevidert" |
| AI content, screen readers | KI-generert | |
| Source line | Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens | |
| NLOD credit (API figures only, on Slik fungerer Peerless) | Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Brønnøysundregistrene | |

**Key figures in the UI.** One label per figure, used everywhere (`docs/key-figures.md` numbering):

| # | Label | Message key |
|---|---|---|
| 1 | Driftsmargin | `fig.driftsmargin` |
| 2 | EBITDA-margin | `fig.ebitda` |
| 3 | Varekostnadsandel | `fig.vare` |
| 4 | Lønnskostnadsandel | `fig.lonn` |
| 5 | Andel andre driftskostnader | `fig.andre` |
| 6 | Total kostnadsandel | `fig.total` |
| 7 | Omsetning per årsverk | `fig.omsArsverk` |
| 8 | Lønnskostnad per årsverk | `fig.lonnArsverk` |
| 9 | Kundefordringsdager | `fig.kfd` |
| 10 | Leverandørgjeldsdager | `fig.lgd` |
| 11 | Omløpshastighet driftseiendeler | `fig.oml` |
| 12 | Totalkapitalrentabilitet | `fig.tkr` |
| 13 | Egenkapitalandel | `fig.ek` |
| – | Kontantandel | `fig.kontant` |
| 14 | Omsetningsvekst | `fig.vekst` |
| factor | Totalkapitalens omløpshastighet | `fig.tkOml` |

### Number formatting

`Intl.NumberFormat('nb-NO')` for every displayed number; non-breaking space before units.

| Kind | Format | Example |
|---|---|---|
| Kroner | whole kroner, space thousands, "kr" | 1 170 000 kr |
| Signed kroner | true minus `−` and `+` | −501 428 kr |
| Millions | one decimal, "mill. kr" | 16,7 mill. kr |
| Percent | one decimal | 2,1 % |
| Plassering | **whole percent** | bedre enn 61 % |
| Closable share, "Til medianen" label | whole percent, from the exact s | 12 % |
| Percentage points | one decimal, "pp" | 7,0 pp |
| Days | whole days | 48 dager |
| Turnover | two decimals | 2,85 |
| Multiple | up to one decimal, comma | 6,5 |
| Orgnr | grouped 3-3-3 | 912 345 678 |

Display rounding only; computation stays exact (AGENTS.md, FR-21). The waterfall's total, start bar and bars are rounded as defined in `docs/key-figures.md` ("Margin decomposition against the peer group as a whole"), so the displayed bars always sum to the displayed total. How screen readers read space-grouped numbers is open ([Open questions](#open-questions)).

## Component Patterns

Behavioural. Visual specs are in `DESIGN.md` Components.

| Component | Behaviour |
|---|---|
| **Header** | Wordmark links to `/`; search field (hidden on the front page); "Slik fungerer Peerless" link. Same on every page. |
| **Search field** | One field for name or orgnr (FR-1), with a visible label or persistent hint "Navn eller organisasjonsnummer"; the accessible name contains that text. Exactly nine digits (spaces ignored) → exact orgnr match; anything else → name match. Searches the seed only, never the register. Validation on submit and blur, never while typing; an error is tied to the field by `aria-describedby` with `aria-invalid="true"`. Submitting an empty field does nothing but show "Skriv inn et navn eller et organisasjonsnummer". |
| **Search results** | ARIA 1.2 combobox: the input has `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`; results are a `listbox` of `option`s. Each result: name, orgnr, primary industry, municipality. Arrow keys move, Enter opens, Esc closes. **Navigation happens only on Enter, click or submit — never on input**, so typing the ninth digit opens nothing by itself. A nine-digit exact match submitted goes straight to the analysis. A polite count ("5 treff") and the no-match message share one live region. At most 8 results; queries are debounced 300 ms. Results never filter on financial criteria (PRD §5). Not mocked. |
| **Company header** | Name, orgnr, industry, revenue, filing year and read date on every analysis (FR-2, FR-64). When the subject's filing is not fully reconciled, a slate subline says so in words (FR-57); not a badge. |
| **Tabs** | Four links, all open. State in the URL survives switching. Phone: all four fit, labels may wrap; no horizontal scroll. |
| **Hero card** | **Always driftsmargin**, the only key figure with a per-year kroner amount (`docs/key-figures.md`). Shows its profit uplift at full convergence whatever the Verdi control says, with the top note "Viser gap ved full tilnærming · Endre i Verdi"; own vs beste fjerdedel; context line (median, Plassering, pp to beste fjerdedel). Links "Hvordan er dette regnet?" and "Se alle nøkkeltall". No-gap and below-floor treatments in [State Patterns](#state-patterns). → `v1-analysis.html`, Oversikt. |
| **Small card** | Three, each at full convergence with the top note. **"Største kapitalgap"**: the largest one-off capital amount at full convergence — working capital released (9 + 10) or capital released from operating assets (11) — with no ranking against the per-year hero; carries its full label and unit ("Frigjort kapital i driftseiendeler: 412 000 kr (engangsbeløp, ved full tilnærming)") and the line "Ikke per år, og legges ikke til resultatet."; cost shares never qualify. **"Største styrke"**: the strength (at or beyond beste fjerdedel) with the highest Plassering, ties by key-figure number; no kroner. **"Mangler grunnlag"**: the first figure in key-figure order without a comparison, with own value and reason, plus "og {n} til" linking to the table. Empty treatments in [State Patterns](#state-patterns). |
| **Explanation card** | Stored text for the **default** peer group only (FR-52), clamped to two lines, "Les mer" expands in place. ✦ per [AI marking](#ai-marking-). Every figure in it links to its calculation in the default group, which is the group on screen whenever the text is shown. **Adjusted group** (any exclusion or a widened band) → the text is hidden and replaced by "Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den.", where "Tilbakestill" restores the default group (exclusions cleared, band to Standard; share and multiple kept). No stored text → "Det finnes ingen lagret forklaring for dette selskapet."; nothing is generated (FR-73). |
| **Beeswarm** | Driftsmargin; every peer a dot, the company highlighted. Pointer hover or tap shows name, value and revenue in a tooltip as a convenience only. The chart is not focusable: its SVG has `role="img"` and an `aria-label` summary ("Driftsmargin for 23 sammenlignbare. Fjordkode 2,1 %, median −3,2 %, beste fjerdedel 9,1 %, bedre enn 61 %."), children `aria-hidden`. Its text alternative is the adjacent compact list plus "Vis tallene", a table of Selskap · Driftsmargin · Omsetning sorted by driftsmargin with the company row marked "(valgt selskap)". Compact list beneath: the five peers nearest the company with their driftsmargin, "Se alle 23" → Peers. Legend above names each marker with its value. |
| **Benchmark row** | Own value, median, beste fjerdedel, Plassering, distribution strip, gap in kroner. The kroner column always shows full convergence, never the closable share; the table carries the top note. Subline: direction · "{n} sammenlignbare brukt · {k} utelatt" (FR-23: k peers left out with an undefined value). Every row with a band also shows its midtre halvdel as text. Cost shares: no kroner of their own, cell reads "Se forklaring av marginen" and jumps to the waterfall (opens it and moves focus to its heading). Total cost share is a check row with no placement; its empty cells carry sr-only "ikke relevant". No-direction rows: own, median, midtre halvdel, "Ingen retning", no kroner. Below-floor and undefined rows: see [State Patterns](#state-patterns). Phone: see [Responsive](#responsive--platform). → `v1-analysis.html`, Nøkkeltall og gap. |
| **Benchmark table semantics** | A real `<table>` with a caption. Cost-share rows sit in their own `<tbody>` whose first row is `<th scope="rowgroup">` "Forklarer marginavviket – summeres ikke". Midtre halvdel in no-direction rows is prefixed "Midtre halvdel:" in its cell; inapplicable cells carry sr-only "ikke relevant – ingen retning". A merged below-floor cell uses `headers` naming every column it spans. |
| **Distribution strip** | Decorative within the table: `aria-hidden`, not in the tab order, because the cells carry every value and the midtre halvdel text. Every distribution row shows median and beste fjerdedel where both exist (FR-27). Mirrored rows (lower is better) are labelled at both ends on the phone expansion and in the tooltip ("lavere er bedre"); no-direction and check rows are drawn unmirrored with no "Bedre" label. |
| **Fold-out** | `Collapsible` with a `button` trigger, `aria-expanded` and `aria-controls`. "Hva forklarer marginavviket?" under Driftsmargin; "Margin eller kapitalbruk?" under Totalkapitalrentabilitet; "Lønnsnivå eller produktivitet?" under Lønnskostnadsandel. All open to everyone in v1 (FR-26). Closed by default. On the phone it opens full width below its row, never nested inside the row. |
| **Margin waterfall** | Against peer-gruppen samlet: four bars (Varekostnad, Lønn, Andre driftskostnader, Avskrivninger og øvrige poster), summing exactly to (own margin − samlet margin) × revenue. Leads with the reference tag "Mot peer-gruppen samlet: 0,5 %, ikke beste fjerdedel" and, directly above the bars, the mandatory sentence "Dette forklarer avviket. Det er ikke et gap som skal lukkes, og det legges aldri til økt driftsresultat." Every bar carries a sign and a word; the residual is a remainder, not a cost category, so its colour never signals direction (`DESIGN.md`). When a cost share's row reads above the median (or ▲ Styrke) but its bar is unfavourable against samlet, or the reverse, the bar's subline adds "Mot peer-gruppen samlet, ikke medianen". Never scaled by the closable share, never added to profit uplift (FR-30). Fewer than 10 in the common set, or a missing component → no waterfall, with "Ingen forklaring av marginen: bare {n} sammenlignbare har alle kostnadslinjene (av 10 som trengs)." Total, start bar and bar rounding: `docs/key-figures.md`. SVG `role="img"` with summary "Fra 83 571 kr (peer-gruppen samlet) til 351 000 kr, fire poster, sum +267 429 kr". "Vis tallene" opens a table with a caption and `th scope="row"` names: start, the four parts with sign and word, end, and the reference. |
| **Factor pair** | Each factor against its own median, never multiplied; no named peer as benchmark. "Margin eller kapitalbruk?": driftsmargin and totalkapitalens omløpshastighet, a derived factor shown with median and count only, never labelled key figure 11 (`docs/key-figures.md`, Decompositions). "Lønnsnivå eller produktivitet?": lønnskostnad per årsverk (no direction, so no beste fjerdedel) and omsetning per årsverk. Each factor is gated by FR-22 on its own and shows its count; below the floor it shows the subject's value with "For få sammenlignbare (n av 10)". |
| **Funnel** | Five stage counts, always shown, even below the floor (FR-15); flagged count; "{n} ekskludert av deg → {m} i analysen". In the demo seed stage 4 runs for every 62.100 candidate from committed fingerprint categories (FR-73). |
| **Size-band control** | Three fixed steps, one action each: 0,5–2× → 0,33–3× → 0,25–4× (FR-18). `radiogroup` with roving tabindex. Shows the resulting revenue range. Any step beyond Standard tags the group "Utvidet" and shows the widened notice, a State block whose one link is "Tilbake til standard (0,5–2×)". Comparability is never loosenable, and the page says so. → `v1-analysis.html`, Peers (widened). |
| **Peer list** | Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · flag · action. ✦ per [AI marking](#ai-marking-). "Ekskluder" keeps the row in the list, drawn as excluded (`DESIGN.md`) with the tag "Ekskludert" and the action "Ta med igjen" (FR-17); focus stays on the same button while its label changes. "Tilbakestill til standard" clears all. Every change recomputes everything (FR-19). A visible key "✦ KI-generert" sits in the list's caption. |
| **Closable-share control** | `radiogroup` with roving tabindex: 0 / 25 / 50 / 75 / 100 % plus "Til medianen for driftsmargin (n %)", placed in order. n is s_med = (median − r) / (beste fjerdedel − r) on driftsmargin, computed exactly and shown in whole percent; amounts use the exact s (`docs/key-figures.md`, "From gap to kroner"). Exists only where r < median < beste fjerdedel; otherwise the step is `aria-disabled="true"` (still focusable and reached by the arrow keys, so its reason can be read) with `aria-describedby` → the reason line. "Medianen gjelder driftsmargin." shows in every state. Target is always beste fjerdedel. Starts at 50 %; it moves only the Verdi amount cards — the hero, small cards and key-figure table stay at full convergence. |
| **Amount card** | Three always: Økt driftsresultat per år ("585 000 kr av 1 170 000 kr per år"); Frigjort arbeidskapital; Frigjort kapital i driftseiendeler — shown beside working capital, never added to it. Working capital shows its two parts as separate lines (kundefordringsdager, leverandørgjeldsdager) and a total only when both clear the floor (`docs/key-figures.md`, "Two amounts that must never be added"); a missing part names itself with its reason and the total reads "Ingen sum – én del mangler grunnlag". Each card has its own median line ("Median nås ved x %" for that figure, or "Median: allerede over"). No target → "Ikke beregnet – for få sammenlignbare på …". Strength → see [State Patterns](#state-patterns). |
| **Multiple field** | EV/EBIT, empty by default, no suggestion. Accepts a number > 0 with up to one decimal, comma or point; anything else → "Skriv inn et tall større enn 0, for eksempel 6 eller 6,5", no value shown. Empty → "Verdi beregnes når du legger inn en multippel. Peerless foreslår ingen multippel." Entered → "Økt selskapsverdi", computed as round(exact uplift × m); the visible product line shows the displayed uplift and is prefixed "≈" whenever its product differs from the result. Carried in the URL; announced on Enter or blur, not per keystroke. |
| **Provenance drill-down** | "Hvordan er dette regnet?" on every kroner amount, opening inline: (1) formula, with the share factor only when opened from Verdi (from the hero or the table there is none: full convergence); (2) key figure and **how beste fjerdedel was derived** — "Beste fjerdedel 9,1 % = øvre kvartil av 23 verdier (lineær interpolasjon, som PERCENTILE.INC i Excel)" with a link "Vis fordelingen" to the figure's values; (3) filed values with register field names; (4) source, filing year, read date and the data-quality line (FR-57, FR-60), one of: "Avstemt mot innsendt årsregnskap" / "Ikke avstemt – årsregnskapet er ikke i demodataene" / "Avvik ved avstemming: {felt}". "Lukk" or Esc closes and returns focus to the trigger; opening moves focus to its heading. → `v1-analysis.html`, Verdi. |
| **State block** | One kicker, one or two sentences, at most one link or action. Also the widened notice and the outside-seed note. Never an empty analysis. |
| **Info button** | A real `button` ("Mer om dette", visible ⓘ) opening a shadcn `Popover`: toggles on tap, click, Enter or Space; Esc and tapping elsewhere close it; stays open while hovered. Carries the long text of a caveat whose key text is already inline. Never the only place a caveat lives. |
| **Tag** | Non-interactive label for state ("Utvidet", "Ekskludert", direction). Never the only carrier of a number. |
| **Uncertain flag** | "✦ Usikker klassifisering" beside the match basis of a flagged peer (FR-14); the peer stays in the group. Counted under the funnel. Any "?" glyph is `aria-hidden`. |
| **AI marker (✦)** | See [AI marking](#ai-marking-). |
| **Tooltip** | Supplementary only — never the only place a value or caveat lives. Pointer hover or tap; Esc or tapping elsewhere closes; on touch only one open at a time. |
| **Source line** | Footer on every page; "Kilder og lisens" links to the sources section of Slik fungerer Peerless. |
| **Scroll container** | Every table or chart container that can overflow: `overflow-x: auto`, `tabindex="0"`, `role="region"`, an `aria-label` ("Nøkkeltall, kan rulles sideveis"), a visible focus style, and an edge fade as the scroll cue. |

## State Patterns

| State | Surface | Treatment and copy |
|---|---|---|
| Below the 10-peer floor (FR-22) | Benchmark row, cards | Row stays with own value; comparison cells replaced by "For få sammenlignbare (n av 10)"; no kroner. Funnel still shows counts. |
| **Own value undefined** (FR-23, FR-24) | Benchmark row | Own cell "Kan ikke beregnes" with the reason; no median, beste fjerdedel, Plassering or kroner, because a comparison needs the subject's value (FR-24); the subline keeps the peer count. |
| **62.100 company outside the demo seed** (FR-73) | Analysis | **Peers:** full funnel and peer group — stage 4 runs on the committed fingerprint categories, stage 5 on stored classifications. **Nøkkeltall og gap:** API rows (driftsmargin, totalkapitalrentabilitet, egenkapitalandel) compared as normal, with kroner for driftsmargin; every document-based row keeps its label and reads "Ikke i demodataene" in place of own value and comparison, with an info button carrying the popover text. A State block above the table says once: "Regnskapstallene for dette selskapet er ikke lastet inn i demoversjonen." Every "Ikke i demodataene" cell points to it with `aria-describedby`. A figure that needs peers' document figures is withheld the same way. **"Margin eller kapitalbruk?"** shown (both factors are API). **"Hva forklarer marginavviket?"** and **"Lønnsnivå eller produktivitet?"** not shown: "Ikke i demodataene". **Oversikt:** hero and beeswarm as normal (driftsmargin is API); "Største kapitalgap" reads "Ikke i demodataene"; no stored explanation → its statement. **Verdi:** profit uplift and EV as normal; both capital cards read "Ikke i demodataene". Provenance data-quality line: "Ikke avstemt – årsregnskapet er ikke i demodataene". |
| Uncovered industry (FR-4) — demo company C | `/analyse/{orgnr}`, no tabs | Company header; state block "Bransjen er ikke dekket ennå" + "{name} er registrert i bransjen {industry}. Peerless dekker foreløpig bare 62.100 …"; three API figures with filing year and read date; "Uten sammenlignbare selskaper viser vi ingen median, plassering eller kroner."; link "Søk på et annet selskap". |
| **Orgnr not in the database** | Front page / header search | "Peerless har ikke data for dette organisasjonsnummeret ennå. Foreløpig dekker vi programmeringstjenester (62.100)." followed by links to demo companies A and B. Never a live register call, never an empty analysis. |
| Search, no match | Search results | "Ingen treff på «{q}». Peerless har foreløpig bare selskaper i programmeringstjenester (62.100)." with the same demo links. |
| Empty search submitted | Search field | "Skriv inn et navn eller et organisasjonsnummer"; no request. |
| Malformed number | Search field | Input of digits only (spaces ignored) with a count other than nine: "Organisasjonsnummeret må ha 9 siffer"; error border and glyph, `aria-invalid`, message in the field's live region. The digits-only rule is what separates a malformed number from a name search. |
| **Invalid URL state** | Analysis | Every URL value is validated on each request. An orgnr that is not nine digits → the malformed-number message on the front page with the search field. Any other invalid value falls back to its default: an unknown tab → Oversikt; an excluded orgnr not in the current group → ignored; a size step, share or multiple that is not one of the allowed values → Standard / 50 % / empty. One slate notice under the company header says so: "Noen innstillinger i lenken var ugyldige og er satt tilbake til standard." A URL made before a seed refresh reproduces the current data, dated in the header; nothing in the URL names a year. |
| **Hero, no profit gap** | Oversikt hero | Driftsmargin at or beyond beste fjerdedel: kicker unchanged, "▲ Styrke", own vs beste fjerdedel, context line, "Driftsmarginen er på eller over beste fjerdedel. Det er ikke noe gap å regne om til kroner."; no amount. Driftsmargin below the floor: own value and "For få sammenlignbare (n av 10)"; no amount. |
| **Small cards, nothing to show** | Oversikt | No capital gap: "Største kapitalgap" reads "Ingen kapitalgap: ingen av kapitalnøkkeltallene ligger under beste fjerdedel." No strength: "Største styrke" reads "Ingen nøkkeltall ligger på eller over beste fjerdedel." Every figure has a comparison: "Mangler grunnlag" reads "Alle nøkkeltall har grunnlag for sammenligning." Cards keep their place. |
| **Peer group too small** | Peers (above the funnel) | Fewer than 10 after stage 5 at Standard: State block "Peer-gruppen har bare {n} sammenlignbare. Med under 10 viser vi ingen median eller kroner." with the action "Utvid størrelsesintervallet". Still too few at 0,25–4×: same block without the action, "… også med det videste intervallet". Zero: "Fant ingen sammenlignbare selskaper." Funnel counts always shown. |
| Own filing fails reconciliation (FR-71) | Analysis | The three API figures keep full comparison; the twelve document figures are absent with "Regnskapet for 2025 kunne ikke leses sikkert" (adapted from the stage-2 Utvikling string). Not demoted to uncovered. |
| Non-small subject below the floor | Analysis | "Peerless sammenligner foreløpig bare små foretak" — shown only when a non-small subject's comparison falls below the floor. |
| **Adjusted peer group** (FR-52) | Explanation card | Text hidden and replaced, per the Explanation card row. Regeneration for an adjusted group is stage 2. |
| Widened size band (FR-18) | Peers, Oversikt | Tag "Utvidet"; State block "Utvidet størrelsesintervall (0,33–3×). Dette er ikke standard peer-gruppe." + "Tilbake til standard (0,5–2×)". The explanation card shows the adjusted-group state. |
| Recompute (FR-19) | Every figure | Pending: affected regions get `aria-busy="true"` and keep their previous figures dimmed with a slate "Oppdaterer …"; nothing stale is shown as current once the new figures arrive. Failure: `role="alert"` "Kunne ikke oppdatere analysen. Prøv igjen.", and the figures and URL return to the last good state. |
| Above median | Verdi | "Til medianen for driftsmargin" disabled; "{Selskap} ligger allerede over medianen. Medianen gjelder driftsmargin." Each amount's median line: "Median: allerede over". |
| Below median | Verdi | "Til medianen for driftsmargin (12 %)" enabled; "Median nås ved 12 % av gapet. Medianen gjelder driftsmargin." (UJ-2's figures.) |
| **Driftsmargin is a strength** | Verdi | Profit card: "▲ Styrke. Driftsmarginen er på eller over beste fjerdedel, så det er ikke noe økt driftsresultat å regne ut."; EV field disabled with the same reason. "Til medianen" disabled. |
| EV empty | Verdi | Field empty, no value shown, explanatory sentence. |
| EV invalid | Verdi | Inline error tied to the field; no value shown. |
| Strength | Benchmark row, card | "▲ Styrke", no kroner (FR-29). |
| Rate-limit refusal (FR-6) | Any lookup | A refusal, never a partial analysis. `role="alert"`: "Det er gjort mange oppslag fra denne adressen på kort tid. Vent litt, og prøv igjen." |
| Loading | Search field, analysis | Field read-only, button disabled, static "Henter analysen …" (a spinner only when motion is allowed), announced once (replaces the mock's "Henter regnskap …"); analysis: `aria-busy` on `main` and shadcn `Skeleton` in the card layout. |
| Lookup error | Search field, analysis | `role="alert"`: "Noe gikk galt. Prøv igjen om litt." No partial figures. |
| Data date | Every analysis | The data-date string (Vocabulary) in the company header and in every provenance drill-down (FR-64). |
| Source attribution | Every page | Footer source line; on Slik fungerer Peerless, the NLOD credit for API figures and a separate paragraph for document figures (FR-65): "Tall fra innsendte årsregnskap er lest av Peerless fra dokumentene i Regnskapsregisteret. Registeret oppgir ingen lisens for disse dokumentene. Demoversjonen inneholder derfor bare et avgrenset utvalg av slike tall, og for resten av bransjen bare avledede kategorier." Publication waits for the licence assessment (FR-73; [Open questions](#open-questions)). The "Ikke i demodataene" popover links to it. |
| Measurement pending | Slik fungerer Peerless | Before measurement results exist: "Målingen pågår. Resultatene publiseres her når de foreligger." No placeholder figures. A plain paragraph, not a live region. The measurement is part of v1, so the delivered page shows its results (FR-72); this does not conflict with PRD §6.1. |

## Interaction Primitives

- **URL is state.** Every change writes to the URL; reload, bookmark and forwarded links reproduce the analysis (FR-69). Tab and peer-group changes (exclude, restore, size band, reset) push a history entry; closable-share and multiple changes replace the current one.
- **Immediate recompute.** Exclude, restore, widen and step changes update every figure on every tab, with no stale value presented as current (FR-19). Pending and failure: [State Patterns](#state-patterns).
- **Fixed steps, not sliders**, for the size band and the closable share.
- **Fold-outs, not dialogs.** Decompositions and provenance open inline under what they explain. No modal in v1.
- **Caveats inline.** A caveat's key text is always on the page; its long text may sit behind an info button, never only in a tooltip.
- **Keyboard:** Tab order follows reading order; Enter/Space toggle fold-outs, info buttons and steps; arrow keys move within segmented controls and search results; Esc closes popovers, results and drill-downs. Charts are not keyboard stops; their values are in tables.
- **Banned:** sliders for money, infinite scroll, hover-only affordances, autoplaying motion, any browser storage for state that matters.

### Status messages and focus

Live regions exist empty in the DOM from page load and are filled on change; one action gives one announcement (debounced). Polite unless marked.

| Event | Announced | Focus |
|---|---|---|
| Search submitted | "Henter analysen …" once | Stays on the field |
| Results shown | "{n} treff" | Stays on the field (combobox) |
| No match / malformed / empty | The state's copy | Stays on the field |
| Rate limit, lookup error | The state's copy, `role="alert"` | Stays where it was |
| Route change to an analysis | — (page title updates) | To `h1` |
| Tab change | — (page title updates) | To the panel's `h2` |
| Exclude / restore | "{Navn} er ekskludert. {m} sammenlignbare i analysen." / "{Navn} er tatt med igjen. …" | Stays on the same button |
| Tilbakestill til standard | "Standard peer-gruppe er gjenopprettet. {n} sammenlignbare." | To the Peers `h2` (or the explanation heading, when reset from there) |
| Widen / narrow | "Størrelsesintervall {b}. {n} sammenlignbare." | Stays on the step |
| Closable-share step | "Økt driftsresultat per år: {a} av {full}." | Stays on the step |
| Multiple entered | "Økt selskapsverdi: {v}." on Enter or blur | Stays in the field |
| Recompute failed | The state's copy, `role="alert"` | Stays where it was |
| Provenance opened / closed | — | To its heading / back to the trigger |
| "Se forklaring av marginen" | — | Opens the waterfall fold-out, focus to its heading |
| Invalid URL notice | The notice, once after load | To `h1` as for any route |

## Accessibility Floor

WCAG 2.2 AA. Visual contrast is in `DESIGN.md` Colors.

- **Shape, not colour:** markers differ by shape (`DESIGN.md` Shapes); direction is always an arrow or a word, colour only reinforces it. Direction glyphs are `aria-hidden` with the word available to screen readers. ✦ has a text alternative ([AI marking](#ai-marking-)).
- **Charts:** each has an `aria-label` summary on a non-focusable `role="img"` SVG and a text alternative — an adjacent table or a "Vis tallene" toggle. Distribution strips inside the benchmark table are `aria-hidden`; the cells and the midtre halvdel text carry their values. No arrow-key stepping through chart marks.
- **Focus:** visible 2px `{colors.navy-700}` ring drawn with `outline` (survives forced colours), never clipped by a container. Live regions and focus moves follow [Status messages and focus](#status-messages-and-focus).
- **Reduced motion:** honour `prefers-reduced-motion`: Recharts `isAnimationActive={false}`, no transitions on recompute, static loading text instead of a spinner. Recompute never animates in any mode.
- **Reflow:** 320 CSS px floor ([Foundation](#foundation)). Tables and charts sit in labelled, keyboard-scrollable containers (Component Patterns, Scroll container); the body never scrolls sideways.
- **Target size:** every target at least 24 × 24 px (SC 2.5.8), inline text buttons ("Ekskluder", "Ta med igjen", "Les mer", "Lukk") padded to reach it; 44 × 44 px recommended on the phone.
- **Language:** `lang="nb"` on `html`; the standalone tab label "Peers" may carry `lang="en"`.
- **Forced colours:** markers and bars are tested under `forced-colors: active`.

## Responsive & Platform

The switch point is Tailwind `md`, 768px; widths per [Foundation](#foundation).

| Element | Desktop | Phone |
|---|---|---|
| Header | Wordmark, compact search, link | Search flexes; link wraps to two lines |
| Front page | Centred hero, field and button joined, steps in three columns | Left-aligned, field and full-width button stacked, steps stacked |
| Tabs | Text tabs | All four fit, labels wrap; no scroll strip |
| Oversikt | 12-column card grid | One column: hero, plot + list, small cards, explanation |
| Beeswarm | Pointer tooltip | Tooltip opens above the plot with a leader line; the compact list (sorted by driftsmargin, company highlighted) is the primary way to read peers |
| Benchmark table | Seven columns in a scroll container | A real three-column table (Nøkkeltall · own · Gap i kroner); the row name is a `button` with `aria-expanded`/`aria-controls`, and the expansion (median, beste fjerdedel, Plassering, midtre halvdel, direction, count, kroner) opens as a full-width row beneath. Fold-outs open full width below the row group. No fixed column widths that break at 320 |
| Funnel | Five columns | Vertical list, count right, bar beneath |
| Margin waterfall | Columns | Vertical rows, one per step, floating bar on a shared kroner scale |
| Peer list | Table | One card per peer, with driftsmargin; "Vis alle 23" |
| Segmented controls | Inline | Full-width grid, wrapping to two rows for the closable share |
| Amount cards | Three across | Stacked |

## AI marking (✦)

**This section is the one place the ✦ rule lives**; every other mention links here.

- ✦ marks AI-produced content, and exactly three things carry it: **the explanation as a whole**, the match basis **"Beskrivelse og regnskap"**, and the flag **"Usikker klassifisering"**.
- ✦ is **not** on "Hvorfor med": the inclusion reason is rules-written (FR-16).
- ✦ is **never** on an individual number, and engine figures never carry it — including the numbers inside the explanation, which link to their calculations instead (FR-52).
- Screen readers hear "KI-generert", once per cell; where a basis and a flag share a cell, once for both. The glyph is `aria-hidden`.
- A visible key "✦ KI-generert" sits in the peer list caption and in the explanation's source line.
- The explanation's source line: "Skrevet av KI ut fra tall Peerless har regnet ut. Hvert tall finnes i analysen." This is true because the text is shown only with the default peer group, whose figures are the ones on screen.
- **What the explanation may say in v1.** Direction and rank words ("over medianen", "største gap") come from engine-provided slots, and the FR-53 test checks them against the engine output as well as the figures. v1 explanations make no claims about persistence over years (that needs stage-2 multi-year data).
- **How the guard works in v1.** The FR-53 figure test runs over the stored explanation fixtures at build and test time (FR-53, FR-73); there is no runtime filter. The about page says so: "En automatisk test sjekker hver lagrede forklaring mot tallene Peerless har regnet ut. En tekst med et tall som ikke finnes i beregningen, kommer ikke gjennom testen og tas ikke med."

## Numbers and their context

**Rule: every number shows its context, or says why it has none.** Context is the peer median, beste fjerdedel or peer-gruppen samlet. This table is an index; treatments live in [State Patterns](#state-patterns).

| Number | Context, or the stated reason |
|---|---|
| Benchmarked figure | Median and beste fjerdedel (and Plassering, midtre halvdel) |
| Kroner gap | Own vs beste fjerdedel, the share it was computed at, and its drill-down |
| Waterfall bar | Own share vs peer-gruppen samlet |
| Waterfall start and end bars | "margin 0,5 %" (samlet) and "margin 2,1 %" (the company) |
| EV amount | The entered multiple and the profit uplift it multiplies |
| "Til medianen" share | Driftsmargin's median, named on the control |
| Funnel counts, peer revenues, size-band range | Identification, not benchmarked figures |
| Header revenue | Identification; carries its filing year and read date |
| Uncovered, below-floor, undefined, outside-seed | The reason, per the matching state row |
| No-direction figures | Median and midtre halvdel, plus "Ingen retning" |

## Key Flows

Figures come from the PRD journeys and the v1 mocks; Kari's company is rendered as Fjordkode AS (16 714 286 kr revenue, 351 000 kr driftsresultat, 2,1 % margin). Every figure below is for the **default peer group of 23**; where a step changes the group, it says so and quotes no recomputed figure. Fjordkode and Anders's prospect are illustrations: the acceptance figures come from demo companies A and B once chosen ([Open questions](#open-questions)).

### UJ-1. A company finds out that beating its industry is not the same as being good (Kari, v1 part)

Kari, finance lead at a twelve-person software company in `62.100`, laptop, no account.

1. On the front page she enters her own organisation number in the hero search; an exact nine-digit match goes straight to the analysis.
2. Oversikt opens: company header with "Regnskapsår 2025 · hentet 3. okt. 2026"; the beeswarm shows 23 sammenlignbare.
3. In Peers she reads the funnel (214 → 131 → 88 → 31 → 23, 2 with "Usikker klassifisering") and each peer's "Hvorfor med" and "Grunnlag for treff". Two look like resellers; she notes them.
4. She walks Nøkkeltall og gap for the largest kroner gaps, then reads the explanation and "Les mer".
5. **Climax:** her 2,1 % margin is above the median of −3,2 % — the number she would have quoted — and "bedre enn 61 %". Against beste fjerdedel, 9,1 %, it is 7,0 pp: **1 170 000 kr per år** at full convergence (0,091 × 16 714 286 − 351 000). Beating a loss-making industry told her nothing.
6. Edge: Kundefordringsdager shows 48 dager and "For få sammenlignbare (7 av 10)", no median, no kroner.
7. Back in Peers she excludes the two resellers. They stay in the list in slate, struck through, tagged "Ekskludert", with "Ta med igjen"; the funnel reads "2 ekskludert av deg → 21 i analysen"; every figure recomputes for 21; the explanation is replaced by "Forklaringen gjelder standard peer-gruppe. Tilbakestill for å se den."
8. She opens "Slik fungerer Peerless" to see how the group was chosen and where AI is used.

Ends in v1 with the analysis as its URL; PDF and sign-in are stage 2. Failure: lookup error → the error state; no partial analysis.

### UJ-2. An adviser walks into a first meeting already knowing where the company is weakest (Anders)

Anders, consultant, preparing for Thursday's meeting with a prospect: a nine-person `62.100` consultancy, 12 518 082 kr revenue and −613 386 kr driftsresultat. Not signed in.

1. He enters the prospect's orgnr in the header search and lands on Oversikt.
2. In Peers he judges the group himself; the funnel and "Hvorfor med" convince him. He changes nothing.
3. Oversikt's hero shows driftsmargin. **Climax:** −4,9 % against a median of −3,2 % and beste fjerdedel 9,1 % — 14,0 pp, **1 752 531 kr per år** at full convergence ((0,091 − (−613 386 / 12 518 082)) × 12 518 082).
4. In Verdi, "Til medianen for driftsmargin (12 %)" is enabled; s_med = 1,7 / 14,0 = 12,14 %, shown as 12 %. Just reaching the median is worth "212 807 kr av 1 752 531 kr per år" ((−0,032 − (−613 386 / 12 518 082)) × 12 518 082, computed with the exact s). He enters no multiple; nothing is valued.
5. He copies the URL into his meeting notes.

Edge: his next prospect is a `69.202` bookkeeping firm (demo company C) → uncovered state, three API figures, no comparison. Failure: rate limit → refusal state, retry later.

### Flow 3 — Anders on his phone before the meeting

Anders, in the lobby ten minutes before the UJ-2 meeting, on a 375px phone.

1. He opens the URL from his notes; the same analysis loads, because the state is in the address.
2. Oversikt is one column: the hero card shows 1 752 531 kr per år first.
3. Under the beeswarm he scans the compact list, sorted by driftsmargin with the prospect highlighted, and finds a peer he knows.
4. In Nøkkeltall og gap he taps the Driftsmargin row name; the expansion opens beneath with median −3,2 %, beste fjerdedel 9,1 %, Plassering and midtre halvdel.
5. **Climax:** he taps "Hvordan er dette regnet?" and sees the line from the prospect's own filed `driftsresultat` and `sumDriftsinntekter`, and from the 23 peer values behind beste fjerdedel, to the amount — the sentence he will open the meeting with, with its source.

Failure: no signal → the browser's own error; nothing Peerless-specific is cached.

### Flow 4 — Kari asks why the margin differs

Kari, after UJ-1, the next morning. She presses "Tilbakestill til standard", so the group is the default 23 again; the waterfall's common set is 22 (one peer lacks a cost line).

1. In Nøkkeltall og gap the cost-share rows say "Se forklaring av marginen" instead of kroner.
2. She opens "Hva forklarer marginavviket?" under Driftsmargin. The tag reads "Mot peer-gruppen samlet: 0,5 %, ikke beste fjerdedel", and above the bars: "Dette forklarer avviket. Det er ikke et gap som skal lukkes, og det legges aldri til økt driftsresultat."
3. The waterfall runs from 83 571 kr (samlet margin on her revenue) to her 351 000 kr driftsresultat: Varekostnad +1 019 571 (5,1 % mot 11,2 %, lavere enn samlet), Lønn −501 428 (66,9 % mot 63,9 %), Andre driftskostnader −568 286 (24,4 % mot 21,0 %), Avskrivninger og øvrige poster +317 572 (1,5 % mot 3,4 %). The bars sum to 267 429 kr = (351 000 / 16 714 286 − 0,005) × 16 714 286.
4. **Climax:** her low goods cost hides it: lønn and andre driftskostnader both pull her margin below the group as a whole, by more than varekostnad lifts it. And the page says plainly that this explains the difference — it is never added to the 1 170 000 kr.
5. She opens "Margin eller kapitalbruk?": margin 2,1 % against a median of −3,2 %, totalkapitalens omløpshastighet 2,29 against 1,86 — above the median on both, each against its own median, never multiplied.
6. She opens "Lønnsnivå eller produktivitet?" to see whether lønn is pay level or output per person.

Failure: fewer than 10 peers in the common set → no waterfall, count stated.

## Inspiration & Anti-patterns

- **Lifted:** the institutional research report — restraint, dense readable tables, a stated source under every exhibit.
- **Not adopted** (out of scope per brief addendum): composite scores; peer-match percentages; AI chat; screening and rankings; a compare module.
- **Rejected layouts:** round-1 directions A, B and C as wholes, including the persistent summary rail (history: [.working/directions-analysis-1.html](.working/directions-analysis-1.html)).

## Later stages (decided, not in v1)

One line each; detail in `.memlog.md`.

- **Dark mode** (stage 2): tokens kept in `DESIGN.md` with their known gaps.
- **Account wall** (stage 2): tabs that need an account are visible and say so; sparklines open to everyone with a faint peer-median line, no band, no placement, no own figures.
- **Utvikling** (stage 2): one chart per key figure 2021–2025, company line, dashed median, shaded median-to-beste-fjerdedel band; a failed year is a break with "Regnskapet for 2022 kunne ikke leses sikkert"; engine-decided persistence text (history: [.working/analysis-2.html](.working/analysis-2.html)).
- **Explanation regeneration for an adjusted group** (stage 2): signed-in, rate-limited (FR-52).
- **Own figures** (stage 2): owner-only "Legg inn tall som ikke er levert" in Utvikling; labelled "Egne tall – ikke levert"; ratios and percentiles only, never kroner, period difference stated.
- **Portfolio** (stage 2): signed-in front page with every followed company, latest position, what changed, largest gaps; orgnr field in the header; "follow" = a saved analysis.
- **Explicit save** (stage 2): "Lagre i arbeidsområde"; until saved, URL state as for anonymous users; exclusions saved with the analysis.
- **Viewer what-if** (stage 2): a viewer may move the closable-share control and enter a multiple locally, never saved.
- **Withdrawn company** (stage 2 for saved analyses): as subject, "Selskapet er slettet fra Enhetsregisteret 12.03.2027, og tallene er fjernet"; as peer, row removed, note "Én sammenlignbar er fjernet fra registeret".
- **Live register lookup** for an orgnr not in the database may be considered (stage 2).
- **Landing page with industry overviews** (stage 3): distributions and medians only, never named companies (history: [.working/landing-2.html](.working/landing-2.html)).

## Mock discrepancies

The v1 mocks predate the newest decisions. The spines win; no re-render is planned. `review-notes-v1.md` lists which states each mock draws.

1. **Search:** mocks are orgnr-only (label, placeholder "Organisasjonsnummer, f.eks. …", numeric keyboard, step 1 "Skriv inn organisasjonsnummer"); name search, the results list and the visible label are not drawn.
2. **Not-found copy** says "finnes ikke i Enhetsregisteret", implying a register check; superseded by the decided copy with demo links.
3. **✦** appears nowhere; explanation figures do not link to their calculations.
4. **Header search:** the header field is orgnr-only ("Org.nr."); hidden on the front page as decided.
5. **Headline:** "Sammenlign selskapet ditt med selskaper som faktisk ligner" and its lead do not say 62.100; coverage sits in a separate small line. The decision is one honest headline plus one sentence that says v1 covers 62.100. Step 1 body "Vi henter selskapets regnskap fra Brønnøysundregistrene" and loading "Henter regnskap …" suggest a live fetch.
6. The key-figure table omits EBITDA-margin, omsetning per årsverk, lønnskostnad per årsverk, leverandørgjeldsdager and kontantandel; the built table carries the full set (FR-21). The working-capital card omits payable days.
7. **Peer counts:** the list shows 23 active plus 2 excluded peers while the summary says 21 in the analysis and 23 in the standard group, and the phone view says "Vis alle 25". The spine's count is 23 in the default group; after UJ-1's two exclusions, 21.
8. "Lønnsnivå eller produktivitet?" is drawn closed with no content.
9. The about page frames the small-company limit as "small with small, larger with larger" rather than the memlog's state string, and its AI paragraph promises a runtime filter ("Teksten vises da ikke").
10. Not drawn: no-match, rate-limit, lookup error, FR-71, outside-seed, invalid-URL, empty-card, thin-group and recompute states.
11. Not shown by any mock: the "Ikke i demodataene" cell and its info popover; ✦ on the match basis and the flag; Source Serif 4 headings (every mock sets headings in Inter).
12. **Waterfall residual** is filled petrol because its value is positive; the spine draws it neutral `slate` whatever its sign. The legend has no residual entry, and "Vis tallene" omits start and end, row headers and a caption.
13. **Accessibility, mock-only:** live regions missing or injected already populated; fold-out headers and phone rows are `div`/`span`, not keyboard-operable, with no `aria-expanded`; segmented controls lack roving tabindex and use `disabled` + `title` for "Til medianen"; `.seg { overflow: hidden }` clips focus rings; excluded rows use `#6F7E90`; "Ekskluder" buttons lack the peer name; the benchmark table uses `colspan` cells that break header association; the about page puts `role="status"` on static text; card headings skip `h2`.
14. **Explanation in an adjusted group** is drawn with the text shown and a tag; v1 hides it.
15. **"Til medianen"** is labelled "Til medianen (n %)" and computed from a whole-number percent; the spine labels it "Til medianen for driftsmargin (n %)" and computes with the exact s. The mock's below-median example (42 %) is a separate invented case.
16. Midtre halvdel band drawn in `divider` on a `divider` track (invisible); the uncertain flag drawn in amber; the beeswarm is a keyboard stop with arrow-key stepping.
17. The capital card is labelled "Nest største gap"; the spine names it "Største kapitalgap".

**Message keys to regenerate** from this spine (do not ship these from `messages-v1.nb.json`): `front.title`, `front.lead`, `front.search.label`, `front.search.placeholder`, `shell.orgnr.label`, `shell.orgnr.placeholder`, `front.steps.1.title`, `front.steps.1.body`, `front.loading`, `front.notFound.title`, `front.notFound.body`, `about.limits.small.body`, `about.ai.p3`, `ov.hero.kick` (unchanged copy, new rule), `ov.expl.adjusted`, `ov.expl.adjustedHint`, `pe.widened.banner`, `ve.toMedianShare`, `ve.belowName`, `ve.belowMed`, `ve.amt.wcNa`, `ve.trace.s1`, `ve.trace.s2`, `ve.trace.s4`, `ov.c1.kick` ("Nest største gap" → "Største kapitalgap"); plus the missing `fig.*` keys in the key-figure table above and every drafted string in State Patterns.

## Open questions

Nothing else in either spine is open; drafted copy and the earlier proposals are adopted.

- **Demo companies A, B and C:** names, orgnrs and their real filed figures as the acceptance reference cases replacing Fjordkode (FR-73, README). Chosen when the seed is built; the not-found links need them.
- **Licence assessment** for committing fingerprint categories, recorded before the demo seed is published (FR-73). Gates the document-figure credit copy.
- **Recompute location**, for bmad-architecture: client- or server-side. The pending and failed states in [State Patterns](#state-patterns) hold either way.
- **Space-grouped numbers and screen readers:** test NVDA and VoiceOver in nb, then decide whether an sr-only ungrouped form is needed.
- **✦ on the funnel stage "Klassifisering"** (stage 5 is model output). Facilitator recommendation, not a decision: no — the stage name describes a step, not AI output; the classification's output is already marked through the match basis.
