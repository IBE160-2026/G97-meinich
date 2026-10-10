# Validation Report — Peerless

- **DESIGN.md:** `C:\Dev\ibe160\_bmad-output\planning-artifacts\ux-designs\ux-Peerless-2026-10-04\DESIGN.md`
- **EXPERIENCE.md:** `C:\Dev\ibe160\_bmad-output\planning-artifacts\ux-designs\ux-Peerless-2026-10-04\EXPERIENCE.md`
- **Run at:** 2026-10-10T17:01:27Z

## Overall verdict

The pair is a rigorous contract. Every `{path.to.token}` reference resolves, the DESIGN.md sections follow the canonical order, the vocabulary is decided, and the flow arithmetic was re-checked and is exact (1 170 000; 1 752 531; 212 807; waterfall 267 429 = 83 571 → 351 000). A consumer still cannot extract it cleanly. Dark mode is half-specified: tokens exist, pairs are missing, and nothing says whether it ships. Two states on the primary surface and the URL-validation contract are missing. The declared copy source (`messages-v1.nb.json`) holds superseded strings, and PRD FR-73 contradicts the spine's outside-seed state. Fix these, and index the scattered load-bearing `[ASSUMPTION]`s, before story-dev starts.

The three extra reviewers shift the picture. The figures review recomputed 39 figures and confirms the arithmetic is exact, as the adversarial review also found; the weaknesses are elsewhere. First, demo-seed coverage: the state a sensor is most likely to reach — a real 62.100 orgnr outside the seed, or demo A with a widened size band — is undefined, and no flow uses demo A, B or C, so there are no runnable acceptance figures. Second, scope: v1 still carries four tabs, three chart grammars, three fold-outs, two segmented controls, name search and dark mode, with no first buildable slice named. Third, the rules around the numbers: "Til medianen" is not defined in `key-figures.md` and its rounded label does not multiply to its amount, the stored explanation's figures go stale after an adjustment while its source line still claims they are in the analysis, and several amounts with different references or closable shares sit side by side. Fourth, accessibility: the colour system is sound, but the beeswarm and midtre halvdel band lack text or contrast, dark mode has no component mapping (the focus ring disappears), a key caveat lives only in a tooltip, and status messages and focus management are unspecified.

## Category verdicts
- Flow coverage — adequate
- Token completeness — thin
- Component coverage — adequate
- State coverage — adequate
- Visual reference coverage — adequate
- Bloat & overspecification — adequate
- Inheritance discipline — adequate
- Shape fit — adequate

## Findings by severity

Deduplicated across the four reviewers. Where several reviewers raised the same issue, it appears once and names every reviewer that raised it.

### Critical (4)

**[Rubric · Token completeness + Accessibility + Adversarial]** — Dark mode half-specified: missing light/dark pairs and no per-component mapping (§ DESIGN frontmatter `colors`/`components`, Colors → Gaps; EXPERIENCE Accessibility Floor)  
`surface`, `peer-dot`, `gridline` and `disabled-text` have no dark value, and only two components have dark mappings. Read literally, the dark focus ring is 1.58:1 / 1.38:1, the waterfall end bar 1.38:1 and the beste fjerdedel triangle stroke 2.90:1 with an undefined fill; tooltip, fold-out background, connectors and band have no dark value. No requirement or mock asks for dark mode.  
Fix: Either declare dark mode out of v1 and move the dark tokens to Later stages, or define every missing `-dark` token and a `-dark` key on every component (focus ring and end bar → primary-dark; triangle → muted-dark on card-dark) and verify each pair.

**[Rubric · Inheritance discipline + Figures + Adversarial]** — Outside-seed 62.100 analysis undefined, and the spine contradicts PRD FR-73 (§ EXPERIENCE State Patterns "62.100 company outside the demo seed"; PRD FR-73)  
FR-73 says document cells read "For få sammenlignbare"; the spine says "Ikke i demodataene" (memlog decision of 2026-10-10), and the PRD was never edited. Beyond the string, neither document says what the Peers tab shows when stage 4 (fingerprint on OCR fields) cannot run — funnel counts, Forretningsmodell, Grunnlag for treff and Hvorfor med are undefined for roughly 95 % of reachable orgnrs.  
Fix: Edit FR-73 in place to the decided string. Specify an "API-only peer group" mode: stages 1–3 run, stages 4–5 shown as "Ikke kjørt – regnskapstall ikke i demodataene", every peer basis "Kun bransje og størrelse". Mock the state.

**[Adversarial]** — Widening the size band and excluding peers break in the demo seed (§ EXPERIENCE Size-band control, Peer list; FR-73 demo seed)  
Document figures are committed only for the peer groups of A and B. The 0,33–3× and 0,25–4× steps pull in candidates with none; every OCR row loses peers, the waterfall's common set can fall below 10, and the fingerprint cannot run on newcomers. A sensor who clicks "Utvidet" on demo A — the one control the brief calls "interrogate the peer group" — gets a degraded analysis nobody specified.  
Fix: Define the declared document set as the 0,25–4× candidate pool for A and B after stages 1–3; make the FR-73 seed check assert it; add an acceptance case that A widened to 0,25–4× still yields a waterfall.

**[Adversarial]** — Scope has crept back against the teacher's "enkel, fungerende analyseside … tidlig" (§ EXPERIENCE IA, Component Patterns; DESIGN Components)  
v1 still carries four tabs, three chart grammars (with separate desktop and phone waterfalls), three fold-outs where FR-26 names two, two segmented controls with sub-states, fuzzy name search where the brief's front page "holds one field", and a partly specified dark mode. Neither spine names a first buildable slice, so the epics will inherit everything at equal priority.  
Fix: Add a "Slice 0": one page at `/analyse/{orgnr}` for demo A — header, benchmark table with strips, kroner at full convergence, peer list with Hvorfor med, stored explanation. Slice 1 adds exclude/restore and URL state; slice 2 adds Verdi. Move the beeswarm, the "Lønnsnivå eller produktivitet?" fold-out, dark mode and fuzzy search to "if time allows".

### High (20)

**[Rubric · Token completeness + Accessibility]** — Excluded peer rows use `disabled-text`, which fails AA (§ DESIGN Colors → Verified contrast; Components → Peer list)  
`#6F7E90` is 4.15:1 on white and 3.86:1 on `surface`. Excluded rows are still content read to decide on "Ta med igjen", so the disabled-control exemption does not apply, and the spec's "all text pairs pass AA" claim is wrong.  
Fix: Set excluded rows in `slate` with strikethrough and the "Ekskludert" tag; reserve `disabled-text` for disabled controls and add it to the "Never as text" column.

**[Rubric · State coverage + Figures + Adversarial]** — Oversikt hero is driftsmargin by construction, has no empty state, and "Nest største" mixes per-year and one-off amounts (§ EXPERIENCE Component Patterns → Hero card, Small card; DESIGN Hero card)  
Only key figure 1 has a per-year profit translation, so "largest kroner gap per year" is always driftsmargin. When driftsmargin is a strength or below floor, or only one gap exists, nothing is specified. "Nest største gap" ranks 412 000 kr (one-off) against 1 170 000 kr per year, inviting the reader to add them; "Største styrke" has no ranking rule.  
Fix: State that the hero is always driftsmargin ("Økt driftsresultat per år") and write its no-profit-gap state; rename the small card "Største kapitalgap" ranked only against capital; define a testable ranking rule for both small cards; keep "Ikke per år, og legges ikke til resultatet" mandatory.

**[Rubric · Visual reference coverage + Adversarial]** — `messages-v1.nb.json`, the declared copy source, holds superseded strings (§ EXPERIENCE Foundation → Language; Mock discrepancies 1, 2, 5, 6, 9)  
Front-page and shell strings are orgnr-only, loading copy implies a live fetch, `front.notFound.body` and `about.limits.small.body` are superseded, and about six key-figure names are missing. Because the file is code input rather than a mock, "spine wins on conflict" does not protect it — the wrong strings will ship.  
Fix: Correct the JSON now and declare it current, or list every key to replace with its new string in Mock discrepancies.

**[Rubric · Inheritance discipline + Adversarial]** — URL schema undecided and diverging from FR-69 and the technical note (§ EXPERIENCE Foundation → State; IA; Interaction Primitives)  
EXPERIENCE adds the size-band step and active tab to the URL; FR-69 and the technical note list only orgnr, excluded peers, closable share and multiple. Tab addressing (path or query), excluded-peer encoding and push vs replace are still open, and FR-69 is not testable until they are fixed.  
Fix: Write the schema once (e.g. `/analyse/{orgnr}/{tab}?ex=…&band=1&andel=50&mult=`, replace for share and multiple, push for exclusions and tab) and update FR-69 and the technical note to match.

**[Figures + Adversarial]** — "Til medianen" is undefined in key-figures.md, its rounded label does not multiply to its amount, and it applies driftsmargin's share to every amount (§ EXPERIENCE Closable-share control, Vocabulary, State Patterns, UJ-2.4; DESIGN Components; mock `profitAt`)  
`key-figures.md` says the median never enters the arithmetic, but the step's share s = (median − r)/(T − r) brings it in. 212 807 kr holds only with the exact s; at the displayed 12 % the amount is 210 304 kr. The share comes from driftsmargin but scales every card, so working capital and operating assets do not reach their own medians, and "Medianen gjelder driftsmargin" shows only in one state. Below-floor and at-median cases are undefined.  
Fix: Define the step in `key-figures.md` in the same commit: exact decimal s, never rounded; label "Driftsmargin til medianen (≈ 12 %)"; the driftsmargin note shown in every state; disabled when r ≥ median or below floor. Make the mock take a rational s, and add an engine test that uplift at s_median = (median − r) × revenue.

**[Figures + Adversarial]** — After an adjustment the stored explanation's figures go stale and its source line becomes false (§ EXPERIENCE Explanation card; State "Adjusted peer group"; AI marking)  
Once peers are excluded, −3,2 %, 9,1 %, 7,0 pp, 1 170 000 kr, 0,5 % and the samlet shares are no longer on screen, yet the figures still "link to their calculation" and "Hvert tall finnes i analysen" remains.  
Fix: In the adjusted state, collapse to the tag plus "Vis forklaringen for standard peer-gruppe", or label linked figures as default-group values; swap the source line; add a test that fails if an adjusted-state explanation links to a recomputed value.

**[Figures + Adversarial]** — Different peer references sit side by side under the margin and cost-share rows (§ EXPERIENCE Benchmark row, Fold-out, Flow 4.2; Margin waterfall)  
The 1 170 000 kr gap (against beste fjerdedel) sits above "Forskjellen på 1,6 pp er 267 429 kr" (against samlet). A cost share can read "▲ Styrke" against the median while the waterfall shows it in amber against samlet. Only a reference tag separates them, and nothing stops a reader adding the two amounts.  
Fix: Make "legges aldri til økt driftsresultat" a required element above the waterfall at both widths; repeat the samlet value in the row subline when the fold-out is open; write copy for median-vs-samlet disagreement and add Flow 4 figures that exercise it.

**[Figures + Adversarial]** — Amounts at different closable shares are not labelled as such across tabs (§ EXPERIENCE Hero card, Small card, Closable-share control, Vocabulary)  
Oversikt shows 1 170 000 kr and 412 000 kr at full convergence; Verdi opens at 50 % with 585 000 kr and 206 000 kr under the same "per år" wording. Toggling tabs halves the headline. "Frigjort kapital" also fits "Frigjort arbeidskapital", a different amount.  
Fix: Start Verdi at 100 %, or show both figures on the hero; label every Oversikt card "ved full tilnærming"; rename the capital card "Frigjort kapital i driftseiendeler".

**[Rubric · Token completeness]** — Dark mode scope and mechanism uncommitted (§ DESIGN frontmatter; EXPERIENCE Foundation)  
No spine says whether v1 ships dark, or whether it follows `prefers-color-scheme` or a toggle. Only `marker-company` and `marker-median` have dark component mappings. Pair naming is irregular (`navy-900`↔`text-dark`, `navy-700`↔`primary-dark`, `slate`↔`muted-dark`), so a resolver cannot pair them mechanically.  
Fix: Make the call in EXPERIENCE Foundation. If dark ships, name pairs `x` / `x-dark` and add `-dark` keys to every component.

**[Rubric · State coverage]** — No treatment for invalid or stale URL state (§ EXPERIENCE Interaction Primitives → URL is state; State Patterns)  
The technical note requires every URL value to be validated on each request. Uncovered: an excluded orgnr not in the group, a closable share that is not a step, a multiple ≤ 0 or non-numeric, an out-of-range size step, an unknown tab. FR-69's "reproduces the same analysis" has no rule for a URL created before a batch refresh.  
Fix: Add a state row: invalid parameters fall back to their default and a tag says so; a newer filing year than the URL implies is shown with the header's data date.

**[Rubric · Shape fit]** — Load-bearing `[ASSUMPTION]`s scattered, not indexed (§ EXPERIENCE Open questions; Responsive & Platform; IA; Interaction Primitives)  
Open questions lists only the demo company names. Unindexed: breakpoint (`md` 768px), tab addressing in the URL, history push vs replace, search debounce and result cap, Slik fungerer Peerless route, fold-out default, beeswarm keyboard model, tap-target size, middle-half band, Uncertain flag colour, ✦ size. The first three shape routing and architecture.  
Fix: List every `[ASSUMPTION]` in Open questions with an owner. Decide breakpoint, tab addressing and push vs replace before architecture.

**[Accessibility]** — The beeswarm's peer values exist only in tooltips (§ EXPERIENCE Beeswarm; DESIGN Peer list; SC 1.1.1, 1.3.1)  
The Accessibility Floor promises "every charted value also exists as text", but no surface lists the 23 peers' driftsmargin. The compact list shows Selskap · Omsetning · Grunnlag; the Peers table has no margin column.  
Fix: Add "Vis tallene" under the beeswarm (Selskap · Driftsmargin · Omsetning, sorted, company row marked in text), or a Driftsmargin column on Peers. Give the chart a full `aria-label` summary.

**[Accessibility]** — The midtre halvdel band cannot be seen (§ DESIGN `band-middle-half`, Distribution strip; SC 1.4.11, 1.1.1)  
Drawn in `divider` on a `divider` track (1.00:1), 1.33:1 against white. `divider` is "decorative only", yet the band carries information — for no-direction rows it is the only distribution context, and Q1–Q3 appears nowhere as text.  
Fix: Give the band its own token at ≥ 3:1 against the card and distinct from the track. Put "Midtre halvdel lo–hi" in text for every row.

**[Accessibility]** — Chart semantics conflict with the keyboard model (§ EXPERIENCE Beeswarm, Distribution strip, Accessibility Floor; SC 4.1.2, 1.3.1, 2.4.3)  
Each chart is "one focusable element with an `aria-label`" stepped with arrow keys. With `role="img"` screen readers ignore children, swallow arrow keys in browse mode and never announce the tooltip; strips add a tab stop per row repeating cell values.  
Fix: Full-summary `aria-label`; arrow keys in value order starting at the company, Home/End; mirror focused text to a polite live region; strips in the table `aria-hidden` and out of the tab order.

**[Accessibility]** — "Ikke i demodataene" explanation exists only in a tooltip (§ EXPERIENCE Vocabulary, State Patterns; SC 2.1.1, 1.4.13, 1.3.1)  
Radix Tooltip does not open on touch, its trigger is a non-interactive cell, and the content is an essential caveat. DESIGN's own Brand & Style says a caveat is "never hidden in a tooltip".  
Fix: State the sentence once above the table; each cell uses `aria-describedby` to it. If a popup is kept, use `Popover` on a real button.

**[Accessibility]** — Mocks: no live regions where content changes (§ `v1-analysis.html` 1075–1085; `v1-front.html` 717–719; SC 4.1.3)  
Verdi step changes and the EV result update silently; front-page regions are injected already populated.  
Fix: Render persistent empty regions and write text into them.

**[Accessibility]** — Mocks: fold-outs cannot be operated by keyboard (§ `v1-analysis.html` 1016–1018, 1029, 1031; SC 2.1.1, 4.1.2)  
Fold-out headers are `div.fold-h`; phone benchmark rows are non-interactive `div`s; none has `aria-expanded`.  
Fix: Use `Collapsible` triggers (`button`) as the spec says.

**[Adversarial]** — AI claims without digits escape both ✦ granularity and the FR-53 test (§ AI marking; DESIGN AI marker; mock `about.ai.p3`)  
"Den største svakheten", "over medianen", "har vedvart" carry no digit, so a wrong direction or rank passes. "Persisted" gaps need multi-year data that is stage 2. The mock's "Teksten vises da ikke" promises a runtime guard, but in v1 the test runs in CI.  
Fix: Restrict the template to engine-provided slots for direction and rank and test direction words too; reword `about.ai.p3`; state that v1 explanations make no persistence claims.

**[Adversarial]** — "Trace any kroner amount" stops at half the formula (§ EXPERIENCE Provenance drill-down; mock `ve.trace.*`)  
The trace shows the subject's operands only; beste fjerdedel — the other operand of every amount — is not traced. For OCR figures "filed values" ends at a field name. "Datakvalitet: avstemt mot innsendt årsregnskap" is false for an outside-seed company. The hero trace includes "× andel som lukkes" though it is always 100 %.  
Fix: Add a target step ("Beste fjerdedel 9,1 % = øvre kvartil av 23 verdier, Vis verdiene"); make the data-quality line conditional with a "ikke avstemt" variant; fix the share to the opening context.

**[Adversarial]** — No acceptance figures exist for anything a sensor can run (§ Key Flows; Open questions "Demo companies A and B")  
Every flow figure belongs to fictional Fjordkode or Anders's prospect. Demo A, B and C are unnamed, so the funnel, 1 170 000 kr and 267 429 kr cannot be checked against the seed, and the not-found links cannot be written.  
Fix: Pick A, B and C now; re-run UJ-1 and Flow 4 on A with real filed figures as the hand-calculated reference case; keep Fjordkode only as marked illustration.

### Medium (41)

**[Rubric · Flow coverage + Figures]** — UJ-1 excludes peers, then quotes default-group figures (§ EXPERIENCE Key Flows intro; UJ-1 steps 3–5; Flow 4; Mock discrepancy 7)  
Step 3 excludes two peers (FR-19 recomputes everything) but step 5 and Flow 4 quote default-group values; the mock shows the opposite convention. An e2e fixture built from the flow gets contradictory state.  
Fix: Move the exclusion after the climax and start Flow 4 from "Tilbakestill til standard", or recompute the figures for the 21-peer group; fix the mock so the default 23 includes the 2 excluded.

**[Rubric · State coverage + Adversarial]** — Several states have no final copy, so stories cannot be accepted (§ EXPERIENCE State Patterns)  
No stored explanation, waterfall below floor, hero with no profit gap, working-capital card with only payables, Verdi for an outside-seed company; no-match, lookup error, rate limit, loading and FR-71 strings are still `[ASSUMPTION]`; empty search submit is untreated.  
Fix: Add one row per state with final bokmål copy (into messages-v1.nb.json), add the empty-submit case, and remove the `[ASSUMPTION]` tags or list them as story blockers.

**[Accessibility + Adversarial]** — Mirrored distribution strips have no readable value axis (§ DESIGN Distribution strip; mock `gap.col.dist`)  
On lower-is-better rows values decrease left to right and the dot sits right of the median while its cell is higher; only the column head says "Bedre →", which a screen reader reads as "Bedre høyrepil". No-direction and check-row orientation is unstated.  
Fix: Per-row micro-label or min/max at the strip ends; arrows `aria-hidden` with sr-only text; state that no-direction and check rows are unmirrored with no "bedre" label.

**[Rubric · Flow coverage]** — Surface closure table credits flows that do not exercise the surface (§ EXPERIENCE IA → Surface closure)  
"How it works, can I trust it" points to UJ-1, but no flow visits Slik fungerer Peerless. "Trace any kroner amount" points to Flow 4 and UJ-2, but only Flow 3 opens the provenance drill-down.  
Fix: Correct the journey column, or add a step to UJ-1 that opens Slik fungerer Peerless.

**[Rubric · Token completeness]** — Raw values sit outside the token set (§ DESIGN Elevation; Components → Fold-out; Shapes)  
Hex `#FBFCFD` (fold-out body) and `#B9C3CF` (waterfall connectors); off-scale tooltip radius `5px`, `waterfall-bar.data-end-radius: 4px`, tooltip shadow `rgba(11,35,64,.14)`. The peer dot's fixed white stroke fails in dark mode.  
Fix: Add `surface-foldout`, `connector` and their dark pairs, and map the radii and shadow to tokens.

**[Rubric · Token completeness]** — Typography ramp incomplete for build (§ DESIGN frontmatter `typography`; Typography; Components)  
Source Serif 4 is decided for page and section headings, but no token exists for either. Phone sizes live in YAML comments no resolver reads. Components carry raw sizes (search 20/16px, fold-out header 13.5px, 18px, 12.5px, 11.5px, 24px, 22px). "Heading sizes may need retuning" leaves the ramp open.  
Fix: Add `heading-page`, `heading-section` and `-phone` variants as tokens, and replace raw px values in Components with token references.

**[Rubric · Component coverage]** — "Banner" used but specified nowhere (§ DESIGN Components → State block; EXPERIENCE State Patterns → Widened size band)  
The widened-band state shows a "banner" with an action, and Colors and `rounded.md` style "banners", while State block claims "widened group" and allows at most one link. A developer cannot tell whether the widened notice is a State block.  
Fix: Define Banner in both spines, or state that the widened notice is a State block and its action is that block's one link.

**[Rubric · State coverage]** — Undefined own value has no row treatment (§ EXPERIENCE State Patterns; DESIGN Components → Benchmark row)  
FR-23/FR-24 (zero or negative denominator, underivable component) have no row treatment. The per-figure count of companies left out (FR-23) is ambiguous: the subline reads "direction · count".  
Fix: Add an "own value undefined" row with copy, and define the subline count as peers used and peers left out.

**[Rubric · State coverage]** — Verdi page misses two states (§ EXPERIENCE Component Patterns → Amount card, Multiple field)  
When driftsmargin is a strength, the profit amount card has no treatment. Invalid multiple input (0, negative, text, comma decimal) is untreated.  
Fix: Add both.

**[Rubric · State coverage]** — Recompute has no in-progress or failure state (§ EXPERIENCE Interaction Primitives → Immediate recompute)  
Exclude, restore, widen and step changes (FR-19) have no pending or failed treatment. Whether recompute is a server round trip is unstated.  
Fix: Commit to client-side or server-side recompute, and give the pending and failed treatment.

**[Rubric · State coverage]** — Peers surface has no whole-group-thin state (§ EXPERIENCE State Patterns; Component Patterns → Funnel, Size-band control)  
No treatment when fewer than 10 peers remain after stage 5, still too few at 0,25–4×, or zero peers. Only row-level handling exists.  
Fix: Add a surface-level State block above the funnel with the widen action.

**[Rubric · Visual reference coverage]** — Mocks linked as a block, not where they apply (§ DESIGN Brand & Style; EXPERIENCE Foundation)  
No Components, IA, state row or Key Flow points to the frame that draws it, though `review-notes-v1.md` lists which states each file holds.  
Fix: Add "→ `v1-analysis.html` (Peers, widened)" style pointers at the relevant rows.

**[Rubric · Bloat & overspecification]** — The ✦ placement rule is restated in about nine places (§ DESIGN Components, Do's; EXPERIENCE Vocabulary, Component Patterns, AI marking)  
The rule has already changed once ("Hvorfor med" withdrawn), and the next change will drift.  
Fix: Keep the rule in EXPERIENCE AI marking only, and make the other places link to it.

**[Rubric · Inheritance discipline]** — No vocabulary entry for the 15 key-figure UI names (§ EXPERIENCE Vocabulary; Mock discrepancies 6)  
The glossary bans synonyms, yet names are used ad hoc (Driftsmargin, Totalkapitalrentabilitet, Kundefordringsdager, "omløpshastighet driftseiendeler", lower-case "EBITDA-margin"). The messages file holds only nine.  
Fix: Add a table of key-figure number → UI label → message key.

**[Accessibility]** — Search results have no combobox pattern (§ EXPERIENCE Search field, Search results; SC 4.1.2, 4.1.3, 3.2.2)  
"Arrow keys move, Enter opens, Esc closes" names no roles, and never says results open only on submit.  
Fix: Specify the ARIA 1.2 combobox pattern with a listbox, a polite count ("5 treff") and no-match in the same region; navigate only on Enter/submit.

**[Accessibility]** — Search fields have no visible label (§ DESIGN/EXPERIENCE Search field; SC 3.3.2, 2.5.3)  
Placeholder only; the header placeholder "Org.nr." will be wrong once name search lands.  
Fix: Add a visible label or persistent hint ("Navn eller organisasjonsnummer") contained in the accessible name; tie errors with `aria-describedby` + `aria-invalid`.

**[Accessibility]** — Status messages are incomplete (§ EXPERIENCE Accessibility Floor, State Patterns; SC 4.1.3)  
Live regions cover only search errors, loading and recomputed totals. Omitted: no-match, rate limit, lookup error, not found, exclude/restore, reset, widen/narrow, adjusted tag, multiple result. Nothing says what is announced or that regions must exist empty first.  
Fix: Add an announcement table; rate limit and lookup error use `role="alert"` or move focus; loading sets `aria-busy`; debounce to one announcement per action.

**[Accessibility]** — Focus management is unspecified (§ EXPERIENCE Interaction Primitives; SC 2.4.3, 2.4.2)  
No rule for exclude/restore, reset, search → analysis route change, tab switch, provenance open/close, or the "Se forklaring av marginen" jump.  
Fix: Add a focus rule to each (e.g. route change → `h1` plus per-route `<title>`; close → return to trigger).

**[Accessibility]** — The 375 benchmark rows lack disclosure semantics (§ EXPERIENCE/DESIGN Benchmark row; SC 4.1.2, 1.3.1)  
"Tap expands the row" names no control or `aria-expanded`; the three-column phone layout loses header relationships.  
Fix: Make the row name a `button` with `aria-expanded`; build phone rows as a real table or a labelled `dl`.

**[Accessibility]** — Benchmark-table header associations are not defined (§ DESIGN/EXPERIENCE Benchmark row; SC 1.3.1)  
The group row is not tied to its indented rows; "midtre halvdel" spans the wrong headers; the below-floor merged cell is announced as "Median"; the check row's "—" has no meaning.  
Fix: Cost-share rows in their own `tbody` with `th scope="rowgroup"`; sr-only labels for inapplicable cells; `headers` on the merged floor cell.

**[Accessibility]** — Horizontal scroll containers not keyboard-operable or labelled (§ DESIGN Layout; EXPERIENCE Accessibility Floor › Reflow; SC 2.1.1, 1.3.1)  
`overflow-x: auto` is required, but not `tabindex="0"`, `role="region"`, an `aria-label` or a focus style. Safari does not make scrollers focusable.  
Fix: Specify these for every scroll container that can overflow.

**[Accessibility]** — Reflow target is 375px; WCAG requires 320 CSS px (§ EXPERIENCE Foundation, Responsive; SC 1.4.10)  
1280px at 400% zoom is 320px. The fixed 64px + 104px phone columns and the 92px header link are the likely breakers.  
Fix: Design and test down to 320.

**[Accessibility]** — Segmented controls: disabled step and focus ring unspecified (§ EXPERIENCE Closable-share control; DESIGN segmented-control; SC 4.1.2, 2.4.7)  
"Til medianen" disabled: `disabled` or `aria-disabled` is undecided. Nothing says the focus ring must be inset or unclipped.  
Fix: Use a `radiogroup` with roving tabindex; disabled step gets `aria-disabled` + `aria-describedby`; inset ring or `overflow: visible`.

**[Accessibility]** — ✦ has no visible key, and the announcement policy is open (§ DESIGN AI marker; EXPERIENCE AI marking; SC 1.3.1, 1.1.1)  
Sighted users are never told what ✦ means; screen readers may hear "KI-generert" ~15 times in the Peers table; the glyph size is unset.  
Fix: Add a visible key "✦ KI-generert"; announce once per cell; fix the glyph size; verify Inter renders U+2726 or use an inline SVG.

**[Accessibility]** — The waterfall's text alternative is incomplete (§ EXPERIENCE Margin waterfall; SC 1.1.1, 1.3.1)  
"Vis tallene" content is unspecified; start (83 571 kr), end (351 000 kr) and ▲/▼ words need rows; the chart label is only the title.  
Fix: Caption, row `th`s, start → four parts → end; label summarises "Fra 83 571 kr … til 351 000 kr, fire poster, sum +267 429 kr".

**[Accessibility]** — Mocks: tooltip fails hover, announcement and ordering (§ `v1-analysis.html` 252, 618–620, 788; SC 1.4.13, 4.1.2, 2.4.3)  
`pointer-events: none`; `role="tooltip"` never referenced; arrow order starts at the worst peer with company, median and best quartile last.  
Fix: Follow the chart-semantics fix above.

**[Accessibility]** — Mocks: segmented controls are not proper radio groups (§ `v1-analysis.html` 140, 943, 1044; SC 2.1.1, 4.1.2, 2.4.7)  
No roving tabindex or arrow keys; disabled "Til medianen" uses `disabled` + unreachable `title`; `.seg { overflow: hidden }` clips focus outlines.  
Fix: Implement the radiogroup pattern from the spec fix.

**[Accessibility]** — Mocks: excluded rows fail contrast; action buttons lack context (§ `v1-analysis.html` 119–120, 157–158, 952, 955; SC 1.4.3, 2.4.6)  
`#6F7E90` (4.15:1) with `#B5C0CC` strikethrough; "Ekskluder" / "Ta med igjen" repeat with no peer name.  
Fix: Slate text; `aria-label="Ekskluder Holmengrå Data AS"`.

**[Accessibility]** — Mocks: focus styles do not match the spec (§ `v1-analysis.html` 114; `v1-front.html` 268–270; SC 2.4.7)  
Chart ring in `--link`, not navy-700; front field uses `outline: none` + box-shadow; `.app`/`.scroll` clip outline offsets.  
Fix: Match the spec ring and use `outline`.

**[Accessibility]** — Mocks: key table markup breaks header associations (§ `v1-analysis.html` 805, 1007–1015, 1025; SC 1.3.1)  
Group row `td colspan=7`; midtre halvdel `colspan=2`; floor row `colspan=4`; bare "—"; strip label is only the figure name; phone table is a `div` grid.  
Fix: Follow the header-association fix above.

**[Accessibility]** — Mocks: waterfall residual drawn in the wrong colour (§ `v1-analysis.html` 845, 869, 883; SC 1.1.1, 1.3.1)  
Residual filled petrol because positive, where the spec says neutral slate; not in Mock discrepancies. Legend has no residual entry; "Vis tallene" omits start/end, row `th` and caption.  
Fix: Add this to the Mock discrepancies list.

**[Figures]** — Working capital released undefined when only one of (9)/(10) has a target (§ EXPERIENCE Amount card; mock 1056)  
The mock withholds the whole card when receivable days are below floor, hiding a valid payable-days amount; showing (10) alone as the total presents a partial sum.  
Fix: Decide in `key-figures.md`: show parts as separate lines, total only when both exist, name the missing part.

**[Figures]** — The two-bar subtotal 1 069 714 kr has no source on screen (§ EXPERIENCE Flow 4.4)  
Lønn plus andre is not a bar, not the total and not in "Vis tallene". If any copy states it, FR-53's containment test fails or must be loosened.  
Fix: Remove the number from the flow, or make it an engine output shown in "Vis tallene".

**[Figures]** — Decomposition factors have no stated floor or count (§ EXPERIENCE Factor pair, Flow 4.5–4.6; mock `DIST.turn`)  
Totalkapitalens omløpshastighet is not a numbered key figure; the FTE pair depends on OCR `aarsverk`. Nothing gates each factor by FR-22 or shows its count.  
Fix: Gate each factor on its own, show its count and "For få sammenlignbare (n av 10)"; add `sumDriftsinntekter / sumEiendeler` to `key-figures.md`.

**[Adversarial]** — FR-4 uncovered state reachable for one company only; not-found copy contradicts coverage (§ State "Orgnr not in the database"; FR-73 seed)  
Any other 69.202 or 43.210 orgnr gets "not in database"; so does a 62.100 company under five employees, which is then told Peerless covers its own industry. Demo links omit C.  
Fix: Split the copy ("Ikke i Peerless' datasett …") and link A, B and C.

**[Adversarial]** — The data-quality flag is hidden in a drill-down, against the spine's own rule (§ EXPERIENCE Provenance; DESIGN Brand)  
FR-57's per-filing flag, including a peer's, is visible only after opening a kroner trace — while the spine says a caveat is never hidden.  
Fix: Add an inline slate subline in the company header and peer row when a filing is not fully reconciled.

**[Adversarial]** — Licence and credit for document figures not specified (§ State "Source attribution"; mock `about.sources.p2`)  
The register states no licence for filed documents. The spine promises a separate credit and gives no string; the footer covers both sources without distinguishing them.  
Fix: Write the document-figure paragraph, including the declared sample and why; link it from the "Ikke i demodataene" note.

**[Adversarial]** — AI influence on inclusion is unmarked (§ AI marking; Funnel)  
Whether a peer is in the group depended on stage-5 classification, and the "Klassifisering" count is model output without ✦. Companies the model removed are invisible.  
Fix: ✦ on the "Klassifisering" stage; an "n tatt ut av KI-klassifiseringen – vis" disclosure.

**[Adversarial]** — The phone flow is partly decorative (§ Flow 3 `[ASSUMPTION]`; Beeswarm; Benchmark row at 375)  
Twenty-three dots in ~340px cannot meet the spine's own 44px tap target. The tap-expanded row must hold the waterfall, two factor pairs and the drill-down inside a table row — not mocked. The share control wraps six steps onto two rows.  
Fix: At 375 replace dot tapping with the compact list sorted by value; open fold-outs full-width below the row group; mock one phone fold-out.

**[Adversarial]** — The about page can contradict v1's own gate (§ State "Measurement pending"; PRD §6.1)  
If v1 ships with "Målingen pågår", the industry is offered before its measurement, against the PRD.  
Fix: Make published measurement a v1 acceptance criterion, or reword §6.1 and say so on the about page.

**[Adversarial]** — "A large residual is a data-quality signal" has no threshold (§ Margin waterfall)  
Untestable, and the user gets no cue. Is Flow 4's 317 572 kr (1,9 pp) large?  
Fix: Define a threshold (e.g. |residual| > 2 pp or > 50 % of |total|) with a slate note, or drop the claim.

### Low (29)

**[Accessibility + Adversarial]** — Uncertain flag uses the `unfavourable` direction colour (§ DESIGN Uncertain flag `[ASSUMPTION]`)  
Amber gives a direction colour a non-direction meaning. Contrast passes.  
Fix: Use slate (or text colour) carried by ✦ plus the word; decide and drop the tag.

**[Figures + Adversarial + Rubric mechanical notes]** — Peer counts disagree (21 / 23 / 25) (§ EXPERIENCE IA, Responsive table, Peer list; Mock discrepancy 7)  
"Se alle 23" on Oversikt, "Vis alle 25" on phone, 21 in the analysis.  
Fix: Use one example throughout: 25 candidates, 2 excluded, 23 in the standard group, 21 in the analysis.

**[Figures + Rubric mechanical notes]** — "42 %" example appears unqualified (§ EXPERIENCE Vocabulary, State Patterns)  
"Til medianen (42 %)" uses invented inputs that match no flow subject; UJ-2 gives 12 % for the same concept.  
Fix: Use UJ-2's 12 % throughout, or state the example inputs wherever 42 % appears.

**[Rubric · Flow coverage]** — UJ-3 and UJ-4 never named as deliberately absent (§ EXPERIENCE Later stages)  
Later stages lists their features but not their ids.  
Fix: Add one line: "UJ-3 and UJ-4 are stage 2; no v1 flow."

**[Rubric · Component coverage]** — Header has no Component Patterns row (§ EXPERIENCE Component Patterns)  
Header behaviour (search hidden on the front page, link target) lives only in IA bullets.  
Fix: Add a Header row.

**[Rubric · Component coverage]** — Several sub-parts mentioned but never specified (§ DESIGN Components; EXPERIENCE Component Patterns)  
Compact peer list under the beeswarm, beeswarm legend, "Vis tallene" table, waterfall reference tag, data-quality flag inside provenance, "Slik fungerer det" steps, About table of contents.  
Fix: Give each one line inside its parent's row.

**[Rubric · Visual reference coverage]** — "Spine wins on conflict" stated three times (§ DESIGN Brand & Style; EXPERIENCE Foundation; Mock discrepancies)  
The same precedence rule is repeated in three places.  
Fix: State it once, in EXPERIENCE Foundation, and refer to it elsewhere.

**[Rubric · Bloat & overspecification]** — "Numbers and their context" repeats State Patterns rows (§ EXPERIENCE)  
Below floor, outside seed and uncovered are restated in different words, making two places to keep in step.  
Fix: Keep it as an index that links to the state rows.

**[Rubric · Bloat & overspecification]** — Process provenance mixed into the contract (§ DESIGN Colors → Gaps)  
"(decided)", "(memlog)", "Accepted by the user" and validator history. Consumers need the rule, not its history.  
Fix: Leave history to `.memlog.md`, and keep only `[ASSUMPTION]` markers.

**[Rubric · Inheritance discipline]** — Component names vary between frontmatter and prose (§ DESIGN frontmatter, Shapes, Components)  
`ai-marker` vs "AI marker (✦)", `segmented-control` vs Size-band and Closable-share control, `marker-best-quartile` vs "Beste fjerdedel", `band-middle-half` vs "Middle half" vs "Midtre halvdel".  
Fix: Use one name per component everywhere, and note which product components use the `segmented-control` tokens.

**[Accessibility]** — English "peer" in Norwegian copy (§ EXPERIENCE Vocabulary; SC 3.1.2)  
Acceptable loanword under the vernacular exception.  
Fix: Optionally `lang="en"` on the standalone tab label "Peers".

**[Accessibility]** — Reduced motion only partly specified (§ EXPERIENCE Accessibility Floor › Reduced motion; SC 2.3.3)  
Recharts animates by default; the spinner rotates.  
Fix: `isAnimationActive={false}` under `prefers-reduced-motion`; static "Henter analysen …" instead of a spinner.

**[Accessibility]** — Screen readers may misread space-grouped numbers (§ EXPERIENCE Number formatting; SC 1.3.1)  
`1 170 000` can be read as separate numbers by NVDA and VoiceOver in nb.  
Fix: Test; if split, give hero and table amounts an sr-only ungrouped form.

**[Accessibility]** — Page titles, headings and tab semantics unspecified (§ EXPERIENCE IA; SC 2.4.2, 1.3.1, 2.4.6)  
No `<title>` pattern, no heading hierarchy, nothing saying tabs are links with `aria-current`.  
Fix: "{Selskap} – {Fane} – Peerless"; `h1` company, `h2` panel, `h3` cards; state the link-tab pattern.

**[Accessibility]** — Target-size rule cites the wrong bar (§ EXPERIENCE Accessibility Floor; SC 2.5.8)  
"≥ 44px" is `[ASSUMPTION]`; AA requires 24×24. Inline text buttons are about 19px tall.  
Fix: Give text buttons ≥ 24px hit area via padding; keep 44px as the phone goal.

**[Accessibility]** — Forced colours not considered (§ DESIGN Elevation › focus; SC 2.4.7)  
A box-shadow focus ring disappears; SVG fills may be overridden.  
Fix: Draw focus with `outline` and test markers under `forced-colors: active`.

**[Accessibility]** — Mocks: placeholder as only visible label (§ front 720; header 596; SC 3.3.2)  
Search fields rely on placeholder text.  
Fix: See the spec fix for visible labels.

**[Accessibility]** — Mocks: the "?" glyph is read aloud (§ `v1-analysis.html` 914, 939, 949; SC 1.3.1)  
"? Usikker klassifisering" with the "?" not `aria-hidden`.  
Fix: Hide the glyph.

**[Accessibility]** — Mocks: direction glyphs not hidden from screen readers (§ messages `dir.*`, `better`, `strength`, `under`; SC 1.3.1)  
▲ ▼ ↑ ↓ → sit inside text with no `aria-hidden` or sr-only wording.  
Fix: Hide glyphs and add sr-only words.

**[Accessibility]** — Mocks: about page announces static text (§ `v1-about.html` 680; SC 4.1.3)  
`role="status"` on the static "Målingen pågår" paragraph.  
Fix: Use a plain paragraph.

**[Accessibility]** — Mocks: analysis heading levels skip a step (§ `v1-analysis.html` 897, 926; SC 1.3.1)  
Card titles are `h3` directly under the `h1`.  
Fix: Add an `h2` for the tab panel.

**[Figures]** — L1 Percentile rounded to whole percent against the one-decimal rule (§ EXPERIENCE Vocabulary, UJ-1.5; `key-figures.md` Arithmetic)  
"bedre enn 61 %" is exactly 60,87 %.  
Fix: Show "60,9 %" or add an explicit exception for Plassering.

**[Figures]** — L3 Amounts phrased as computed on rounded inputs (§ UJ-2.3, UJ-2.4, Flow 4.3)  
Values match only because the invented inputs sit on round shares; UJ-2 never gives a `driftsresultat`.  
Fix: Give UJ-2's `driftsresultat` (−613 386 kr) and phrase checks as (T − driftsresultat/revenue) × revenue.

**[Figures]** — L5 Samlet margin does not reconcile with listed peer rows (§ review-notes)  
Revenue-weighting the 22 displayed margins gives 0,471 %, which would make the start bar 78 741 kr rather than 83 571.  
Fix: Make the invented sums consistent, or state in "Vis tallene" that the aggregate comes from unrounded filings.

**[Figures]** — L6 Waterfall start bar and signed rounding not defined (§ EXPERIENCE Number formatting; `key-figures.md` Rounding)  
The mock sets start = driftsresultat − displayed total; with half-away ties it can differ by 1 kr. Largest remainder is undefined for negative bars.  
Fix: In `key-figures.md`, define start := `driftsresultat` − displayed total, and floor toward −∞ before distributing remainders.

**[Figures]** — L7 Visible EV product may not multiply out (§ EXPERIENCE Multiple field; mock `ve.ev.calc`)  
EV is rounded from the exact uplift but the product shows the rounded uplift; at 6,5 it can be a few kroner off. Decimal input is unspecified.  
Fix: Specify which is shown ("≈" or product from exact uplift) and the accepted precision of the multiple.

**[Figures]** — L8 The context rule does not cover every number (§ EXPERIENCE Numbers and their context)  
Funnel counts, peer revenues, size-band range, EV, multiple, "Til medianen" share, waterfall start and end bars are missing.  
Fix: Add rows for each.

**[Figures]** — L9 "48 dager" cannot be checked (§ UJ-1.6; review-notes)  
`kundefordringer` and `salgsinntekt` are not given.  
Fix: Add them to the inputs table.

**[Figures]** — L11 PRD journeys put the gap in % rather than pp (§ PRD UJ-1, UJ-2)  
"7.0 % × 16.7 m" and "14.0 % × 12.5 m" use % and rounded revenue; the spine correctly uses pp and exact revenue.  
Fix: Change the PRD to "7,0 pp × 16 714 286 kr" and "14,0 pp × 12 518 082 kr".

## Mechanical notes (rubric)

- DESIGN Colors → Gaps says `background` has no dark pair, but `background-dark` (`#0B1624`) is defined.
- "Til medianen (42 %)" and "Median nås ved 42 %" match no flow subject (also a figures-review finding).
- Peer counts conflict: "Se alle 23", "Vis alle 25", and 21/23/25 in Mock discrepancy 7 (also a figures and adversarial finding).
- In-file anchors resolve under GitHub slugging; `#ai-marking-` depends on how the renderer handles ✦.
- Frontmatter: DESIGN carries non-spec keys (`status`, `updated`, `sources`), harmless. EXPERIENCE has no `description`. Both are `status: draft`.
- `typography.numeric` and `typography.heading-serif` are note-only, with no size; some component values are prose, not tokens.
- No Mermaid in either file.
- Arithmetic re-checked and correct: 7,0 pp × 16 714 286 = 1 170 000; 14,0 pp × 12 518 082 = 1 752 531; 1,7 pp × 12 518 082 = 212 807; waterfall 267 429, 83 571 + 267 429 = 351 000; Lønn + Andre = 1 069 714.

## Reviewer files
- `review-rubric.md`
- `review-accessibility.md`
- `review-figures.md`
- `review-adversarial.md`
