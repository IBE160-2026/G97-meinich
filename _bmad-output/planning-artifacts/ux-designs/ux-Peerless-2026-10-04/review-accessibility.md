# Accessibility review — Peerless v1 UX (WCAG 2.2 AA)

Reviewed 2026-10-10: `DESIGN.md`, `EXPERIENCE.md` and the mocks `mockups/v1-front.html`, `mockups/v1-analysis.html` and `mockups/v1-about.html`. I read the HTML source. I also ran the mocks' built-in `?qa` check in headless Chrome 154: the phone frames had no overflow and no element wider than the viewport. This is a review only, and no spec or mock was edited.

## Verdict

**Not yet AA-ready, but close on the hard parts.** The colour system is sound. Every contrast ratio the specs state is correct to rounding, and direction, company, median and beste fjerdedel are all carried by shape or by a word, not by colour alone. The gaps are in what the specs leave out:

- **The beeswarm has no text alternative.** Its 23 peer values exist only in tooltips.
- **Dark mode has no component mapping.** Read literally, the focus ring and the waterfall end bar become invisible in dark mode.
- **The midtre halvdel band has no contrast.** It is drawn in the same colour as its track.
- **A key caveat lives only in a tooltip.** "Ikke i demodataene" depends on a tooltip that does not open on touch.
- **Status messages and focus management are under-specified.** This covers exclude, recompute, rate limit, no-match and route change.

The mocks additionally fail on keyboard operation of fold-outs, live regions, and the contrast of excluded-row text.

Counts: **0 critical · 8 high · 17 medium · 13 low** (specs: 6 high, 11 medium, 8 low; mocks: 2 high, 6 medium, 5 low).

## Contrast recomputation

I computed every pair below with the WCAG relative-luminance formula from the hex values in the `DESIGN.md` frontmatter. ✔ means the stated ratio is correct. "Missing" means the pair is load-bearing but the spec never states it.

### Light mode

| Pair | Computed | Needed | Stated | Note |
|---|---|---|---|---|
| navy-900 text / white · surface · divider track | 15.81 · 14.73 · 11.87 | 4.5 / 3 | 15.8 · — · 11.9 ✔ | |
| white on navy-700 (submit, selected step) | 11.48 | 4.5 | missing | passes |
| link / white · surface · fold `#FBFCFD` | 6.85 · 6.38 · 6.67 | 4.5 | missing | passes |
| signature / white · surface | 2.96 · 2.76 | 3 | 2.96 · 2.76 ✔ | fails; the outline compensates |
| signature / divider track | **2.22** | 3 | missing | needs the navy-900 outline (11.87) — specified ✔ |
| `#6A8FBD` / track | 2.51 | — | 2.5 ✔ | |
| slate text / white · surface · fold | 5.45 · 5.08 · 5.30 | 4.5 | missing | passes |
| slate triangle stroke / track · band | 4.09 | 3 | missing | passes |
| favourable / white · surface | 5.67 · 5.28 | 4.5 | missing | passes |
| unfavourable / white · surface · fold | 5.02 · **4.68** · 4.89 | 4.5 | 4.68 "lowest text pair" ✔ | but see the disabled-text row below |
| median tick / white · surface · track | 4.27 · 3.98 · 3.21 | 3 | ✔ | never use as text: 4.27 < 4.5 |
| input-border / white · surface | 3.48 · 3.24 | 3 | 3.5 · 3.2 (rounded) ✔ | |
| peer-dot / white · gridline | 3.48 · 2.90 | 3 | missing | the gridline is decorative, so this is fine |
| **disabled-text `#6F7E90` / white · surface** | **4.15 · 3.86** | 4.5 | missing | fails as text in excluded peer rows; exempt only on the disabled step |
| divider / white · surface | 1.33 · 1.24 | — | 1.33 ✔ | decorative, but **also used for the midtre halvdel band** (see S3) |
| band (`divider`) / track (`divider`) | **1.00** | 3 | missing | the band is invisible on a divider track |
| focus ring navy-700 / white halo · surface | 11.48 · 10.70 | 3 | missing | passes |
| waterfall bars on white: start median · fav · unfav · residual slate · end navy-700 | 4.27 · 5.67 · 5.02 · 5.45 · 11.48 | 3 | "every bar ≥ 3:1" ✔ | |
| residual slate vs favourable petrol (adjacent hue) | 1.04 | — | — | the two differ in hue only; the words carry the meaning |
| connectors `#B9C3CF` / white | 1.78 | — | — | decorative, fine |
| ✦ in slate / white · surface | 5.45 · 5.08 | 4.5 | missing | passes at any size |
| "Usikker klassifisering" in unfavourable, 11.5px/600 | 5.02 · 4.68 | 4.5 | missing | passes, but see S17 |
| disabled step text / surface | 3.86 | exempt | missing | inactive component (SC 1.4.3 exception) |

### Dark mode

| Pair | Computed | Stated | Note |
|---|---|---|---|
| text-dark / bg · card · zebra | 15.29 · 13.28 · 13.79 | ✔ | |
| muted-dark / bg · card · zebra | 7.67 · 6.66 · 6.92 | "≥ 6.9 on zebra" ✔ | |
| navy-900 on primary-dark | 7.25 | 7.3 ✔ | |
| link-dark / bg · card · zebra | 8.34 · 7.24 · 7.52 | 7.24–8.34 ✔ | |
| signature-dark / track | 5.06 | 5.06 ✔ | |
| signature-dark vs median-dark | 1.52 | 1.52 ✔ | shape, not shade — correctly stated |
| fav-dark / bg · card · zebra | 7.65 · 6.65 · 6.90 | ✔ | |
| unfav-dark / bg · card · zebra | 8.53 · 7.41 · 7.69 | ✔ | |
| median-dark / track · card | 3.34 · 4.78 | 3.34 ✔ | |
| input-border-dark / bg · card | 4.54 · 3.94 | ✔ | |
| dividers | 1.43–1.65 | ✔ | decorative |
| muted-dark triangle / track | 4.65 | missing | passes, **if** the triangle is mapped to muted-dark |
| **focus ring navy-700 / bg-dark · card-dark** (as the spec words it) | **1.58 · 1.38** | missing | fails unless remapped to primary-dark (8.34 · 7.24) |
| **waterfall end bar navy-700 / card-dark** | **1.38** | missing | no dark token |
| **beste fjerdedel triangle, slate stroke / card-dark** | **2.90** | missing | fails 1.4.11 if not remapped; its fill `{colors.background}` is undefined in dark |
| residual muted-dark vs fav-dark | 1.00 | — | hue only; the words carry the meaning |
| light peer-dot / card-dark (if reused) | 4.55 | — | no dark peer-dot token |
| light disabled-text / card-dark (if reused) | 3.81 | — | no dark token |

## Findings — what the SPECS fail to specify

- **[high]** **The beeswarm's peer values exist only in tooltips.** EXPERIENCE.md's Accessibility Floor promises that "every charted value also exists as text", but no surface lists the 23 peers' driftsmargin. The compact list shows Selskap · Omsetning · Grunnlag, and the Peers table has no margin column. (EXPERIENCE.md Component Patterns › Beeswarm; DESIGN.md Peer list; SC 1.1.1, 1.3.1.) *Fix:* add "Vis tallene" under the beeswarm, a table of Selskap · Driftsmargin · Omsetning sorted by value with the company row marked in text. Alternatively, add a Driftsmargin column to the Peers list. Give the chart an `aria-label` summary along these lines: "Driftsmargin for 23 sammenlignbare. Fjordkode 2,1 %, median −3,2 %, beste fjerdedel 9,1 %, bedre enn 61 %."

- **[high]** **Dark mode has no per-component colour mapping.** The components block names only light tokens, and the Accessibility Floor says "2px `navy-700` ring". Taken literally in dark mode:
  - the focus ring is 1.58:1 on the background and 1.38:1 on cards;
  - the waterfall end bar is 1.38:1;
  - the beste fjerdedel triangle stroke is 2.90:1, and its white "background" fill is undefined;
  - peer-dot, gridline, surface, disabled-text, the tooltip background, the fold-out background `#FBFCFD`, the connectors and the band have no dark value at all.

  (DESIGN.md frontmatter `components`, Colors › Gaps; EXPERIENCE.md Accessibility Floor; SC 2.4.7, 1.4.11, 1.4.3.) *Fix:* add a `-dark` value to every component token. The focus ring becomes primary-dark (8.34 / 7.24) and the end bar primary-dark. The triangle gets a muted-dark stroke with a card-dark fill. Then verify every new pair at 3:1 or 4.5:1.

- **[high]** **The midtre halvdel band cannot be seen.** It is drawn in `divider` on a `divider` track (1.00:1) and sits at 1.33:1 against white. DESIGN.md calls `divider` "decorative only", yet the band carries information. For the no-direction rows it is the only distribution context. For directional rows, Q1–Q3 appears nowhere as text. (DESIGN.md `band-middle-half`, Distribution strip; SC 1.4.11, 1.1.1.) *Fix:* give the band its own token at ≥ 3:1 against the card, and visibly distinct from the track — for example a slate-tinted fill with the track kept at `divider`. Also put "Midtre halvdel lo–hi" in text for every row: in the strip's accessible name and in the phone expansion.

- **[high]** **Chart semantics conflict with the keyboard model.** The spec has each chart as "one focusable element with an `aria-label`", stepped through with arrow keys and showing a tooltip. With `role="img"`:
  - screen readers ignore the children and swallow the arrow keys in browse mode;
  - the tooltip is never announced;
  - the distribution strips add a tab stop per row while repeating values already in the cells.

  (EXPERIENCE.md Beeswarm, Distribution strip, Accessibility Floor; SC 4.1.2, 1.3.1, 2.4.3.) *Fix:* specify the following.
  - Every chart's `aria-label` is a full summary.
  - Arrow keys step in value order, focus starts on the company marker, and Home/End are supported.
  - The focused item's text is mirrored into a polite live region or an updated `aria-describedby`.
  - In the benchmark table, where the cells already carry the values, strips are `aria-hidden` and not in the tab order. Keep tooltip-on-focus for sighted keyboard users through a single focusable "Vis fordeling" control, or drop it.

- **[high]** **The "Ikke i demodataene" explanation exists only in a tooltip.** shadcn/Radix `Tooltip` does not open on touch. Its trigger here is a non-interactive table cell, and the content is an essential caveat. DESIGN.md's own Brand & Style says a caveat is "never hidden in a tooltip". (EXPERIENCE.md Vocabulary, State Patterns "62.100 company outside the demo seed"; SC 2.1.1, 1.4.13, 1.3.1.) *Fix:* state the sentence once above the table as a state block or note. Each cell reads "Ikke i demodataene" with `aria-describedby` pointing at that note. If an on-demand popup is kept, use `Popover` on a real `button` that toggles on tap or Enter, closes on Esc, and stays open while hovered.

- **[high]** **The excluded-row text colour fails contrast.** Excluded peer rows are set in `disabled-text` `#6F7E90`, which is 4.15:1 on white and 3.86:1 on surface. The row's name, revenue and reason are still content the user reads in order to decide on "Ta med igjen", so the inactive-component exemption does not apply. The spec's claim that the "lowest is unfavourable on surface, 4.68" is therefore wrong once mock tokens are counted. (DESIGN.md Colors › Verified contrast, Components › Peer list; SC 1.4.3.) *Fix:* set excluded rows in slate (5.45) with the strikethrough and the "Ekskludert" tag. Reserve `disabled-text` for disabled controls. Add `disabled-text` and `median`-as-text to the "Never" column.

- **[medium]** **The search results list has no combobox pattern.** The spec says "arrow keys move, Enter opens, Esc closes" but names no roles. It also never says that results only open on submit, not when the ninth digit is typed. (EXPERIENCE.md Search field, Search results; SC 4.1.2, 4.1.3, 3.2.2.) *Fix:* specify the ARIA 1.2 combobox pattern: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, and a `listbox` of `option`s. Add a polite count ("5 treff") and the no-match message in the same region. State explicitly that navigation happens only on Enter or submit, never on input.

- **[medium]** **The search fields have no visible label.** The specs give the hero and header fields a placeholder only. The mocks use `aria-label` plus a placeholder, and the header placeholder "Org.nr." will be wrong once name search lands. (DESIGN.md Search field; EXPERIENCE.md Search field; SC 3.3.2, 2.5.3.) *Fix:* add a visible label or a persistent hint ("Navn eller organisasjonsnummer"), and make sure the accessible name contains that visible text. Tie the error to the field with `aria-describedby` plus `aria-invalid`.

- **[medium]** **Status messages are incomplete.** The live-region list covers only search errors, loading and recomputed totals. It omits no-match, rate-limit refusal, lookup error, orgnr not found, exclude/restore, "Tilbakestill til standard", widen and narrow, the adjusted-explanation tag, and the multiple's result. It also never says what text is announced, or that live regions must exist empty in the DOM before they are filled. (EXPERIENCE.md Accessibility Floor, State Patterns; SC 4.1.3.) *Fix:* add an announcement table. Examples:
  - "Holmengrå Data AS er ekskludert. 21 sammenlignbare i analysen. Største gap: 1 170 000 kr per år."
  - Rate limit and lookup error use `role="alert"` or move focus to the state block's heading.
  - Loading sets `aria-busy` on main and announces once.

  Debounce so that one action gives one announcement.

- **[medium]** **Focus management is unspecified.** The specs never say where focus goes after any of these:
  - exclude/restore — focus should stay on the same button while its label changes;
  - "Tilbakestill til standard";
  - search → analysis route change — focus to `h1`, plus a per-route `<title>`;
  - switching tab links;
  - opening and closing provenance with "Lukk" or Esc — focus should return to the trigger;
  - the "Se forklaring av marginen" jump — open the fold-out and move focus to its heading.

  (EXPERIENCE.md Interaction Primitives; SC 2.4.3, 2.4.2.) *Fix:* add a focus rule to each of these.

- **[medium]** **The 375 benchmark rows lack disclosure semantics.** "Tap expands the row" names no control, `aria-expanded` or `aria-controls`. The three-column phone layout also loses the header relationships unless it is built as a table or each value is labelled. (EXPERIENCE.md Benchmark row; DESIGN.md Benchmark row; SC 4.1.2, 1.3.1.) *Fix:* make the row name a `button` with `aria-expanded`. Build the phone rows as a real three-column table, or a `dl` per row with visible or sr-only labels.

- **[medium]** **Benchmark-table header associations are not defined.** Four problems:
  - The group row "Forklarer marginavviket – summeres ikke" is not tied to the indented rows.
  - In the "Ingen retning" rows, "midtre halvdel" spans the Beste fjerdedel and Plassering columns, so it is announced under the wrong header.
  - The below-floor merged cell is announced as "Median".
  - The check row's "—" has no meaning.

  (DESIGN.md Benchmark row; EXPERIENCE.md Benchmark row; SC 1.3.1.) *Fix:* put the cost-share rows in their own `tbody` with `<th scope="rowgroup">` carrying the group label, or add sr-only text to each sub-row name. Give midtre halvdel its own column, or prefix it with "Midtre halvdel:" and mark the inapplicable cells "ikke relevant – ingen retning" in sr-only text. Use `headers` on the merged floor cell, and sr-only "ikke relevant" for "—".

- **[medium]** **Horizontal scroll containers are not keyboard-operable or labelled.** The spec requires `overflow-x: auto` but not `tabindex="0"`, `role="region"`, an `aria-label` (for example "Nøkkeltall, rull sideveis"), a visible focus style or a scroll affordance. Safari does not make scrollers focusable on its own. 2D tables are exempt from 1.4.10 but must still be operable. (DESIGN.md Layout; EXPERIENCE.md Accessibility Floor › Reflow; SC 2.1.1, 1.3.1.) *Fix:* specify these for every scroll container that can actually overflow.

- **[medium]** **The reflow target is 375px; WCAG requires 320 CSS px** (that is, 1280px at 400% zoom). (EXPERIENCE.md Foundation, Responsive; SC 1.4.10.) *Fix:* design and test down to 320. The fixed 64px + 104px phone columns and the 92px header link are the likely breakers.

- **[medium]** **The segmented controls' disabled step and focus ring are unspecified.**
  - "Til medianen" disabled: the spec does not say whether it uses `disabled` (removed from tab order, skipped by arrow keys) or `aria-disabled` (focusable, reason via `aria-describedby`).
  - Nothing says the focus ring must be inset or unclipped inside the bordered group.

  (EXPERIENCE.md Closable-share control; DESIGN.md segmented-control; SC 4.1.2, 2.4.7.) *Fix:* use a `radiogroup` with roving tabindex. The disabled step gets `aria-disabled="true"` plus `aria-describedby` → "ligger allerede over medianen". Specify an inset ring, or `overflow: visible`.

- **[medium]** **✦ has no visible key, and the announcement policy is open.** Sighted users are never told what ✦ means. The spec says screen readers hear "KI-generert" but does not settle repetition: in the Peers table, around 15 "Beskrivelse og regnskap" cells plus the flags would each say it. The glyph size is also unset. (DESIGN.md AI marker; EXPERIENCE.md AI marking; SC 1.3.1, 1.1.1.) *Fix:*
  - Add a visible key "✦ KI-generert" in the Peers list caption and in the explanation card's source line.
  - Announce once per cell; when basis and flag share a cell, announce once for both.
  - Fix the glyph size at ≥ the label size.
  - Verify Inter renders U+2726; if not, use an `aria-hidden` inline SVG.

- **[medium]** **The waterfall's text alternative is incomplete.** "Vis tallene" is specified, but not its content. Start (83 571 kr) and end (351 000 kr) need rows, and so do the ▲/▼ words. The chart's `aria-label` is only the title. (EXPERIENCE.md Margin waterfall; SC 1.1.1, 1.3.1.) *Fix:* the table has a caption and `th scope="row"` names, and runs start → four parts with sign and word → end, with the reference stated. The chart label summarises "Fra 83 571 kr (peer-gruppen samlet) til 351 000 kr, fire poster, sum +267 429 kr".

- **[low]** **The uncertain flag borrows the unfavourable colour.** Setting "Usikker klassifisering" in amber gives a direction colour a non-direction meaning — already flagged `[ASSUMPTION]` in DESIGN.md. Contrast passes (5.02 / 4.68). (DESIGN.md Uncertain flag; SC 1.4.1, comprehension.) *Fix:* use text colour or slate, carried by ✦ plus the word.

- **[low]** **The mirrored "Bedre →" axis is hard to read.** On lower-is-better strips, values decrease left to right, and only the column head and the "↓ Lavere er bedre" subline say so. A screen reader reads "Bedre høyrepil". (DESIGN.md Distribution strip; SC 1.3.3, 1.4.1.) *Fix:* label the end values on the phone expansion and in the tooltip ("lavere = bedre"). Mark arrows `aria-hidden` and give them sr-only text ("bedre mot høyre"). The same applies to ▲ ▼ ↑ ↓ in copy.

- **[low]** **English "peer" in Norwegian copy.** The tab "Peers" and "peer-gruppe" will be read with Norwegian phonetics. This is an acceptable loanword under the SC 3.1.2 vernacular exception. (EXPERIENCE.md Vocabulary; SC 3.1.2.) *Fix:* optionally add `lang="en"` on the standalone tab label "Peers". `lang="nb"` is correctly present on all three mocks.

- **[low]** **Reduced motion is only partly specified.** Recharts animates by default, and the spinner rotates. (EXPERIENCE.md Accessibility Floor › Reduced motion; SC 2.3.3, advisory at AA.) *Fix:* set `isAnimationActive={false}` under `prefers-reduced-motion` (arguably always on recompute), and use a static "Henter analysen …" instead of a spinner.

- **[low]** **Screen readers may misread space-grouped numbers.** Thousands grouped with spaces (`1 170 000`) can be read as separate numbers by NVDA and VoiceOver in nb. (EXPERIENCE.md Number formatting; SC 1.3.1, advisory.) *Fix:* test with NVDA and VoiceOver in nb. If they split the number, give the hero amount and the table amounts an sr-only ungrouped form.

- **[low]** **Page titles, headings and tab semantics are unspecified.** There is no `<title>` pattern per route or tab, no heading hierarchy, and nothing saying the tabs are links with `aria-current="page"` rather than ARIA tabs. (EXPERIENCE.md Information Architecture; SC 2.4.2, 1.3.1, 2.4.6.) *Fix:* use "{Selskap} – {Fane} – Peerless". `h1` is the company, `h2` the tab panel and `h3` the cards. State the link-tab pattern.

- **[low]** **The target-size rule cites the wrong bar.** "≥ 44px" is an `[ASSUMPTION]`, while AA requires 24×24 (SC 2.5.8). The inline text buttons — "Ekskluder", "Ta med igjen", "Les mer", "Lukk" — are about 19px tall. (EXPERIENCE.md Accessibility Floor; SC 2.5.8.) *Fix:* give text buttons a hit area of at least 24px through padding, and keep 44px as the phone goal.

- **[low]** **Forced colours are not considered.** A focus ring drawn with box-shadow disappears, and SVG fills may be overridden. (DESIGN.md Elevation › focus; SC 2.4.7, advisory.) *Fix:* draw focus with `outline`, using a transparent outline as a fallback, and test markers under `forced-colors: active`.

## Findings — what only the MOCKS get wrong

(Mock discrepancies already listed in EXPERIENCE.md, such as the missing ✦ and the missing states, are not repeated here.)

- **[high]** **No live regions where content changes.** `v1-analysis.html` has none, so a Verdi step change silently rewrites the amounts (lines 1075–1085), and the EV result updates silently. In `v1-front.html` (lines 717–719) the `aria-live` regions are injected already populated, which most screen readers do not announce. (SC 4.1.3.) *Fix:* render persistent empty regions and write text into them.

- **[high]** **Fold-outs cannot be operated by keyboard.** Fold-out headers are `div.fold-h` with a caret `span` (lines 1016–1018, 1031), and the phone benchmark rows are non-interactive `div`s (line 1029). None can be reached or operated by keyboard, and none has `aria-expanded`. (SC 2.1.1, 4.1.2.) *Fix:* use `Collapsible` triggers (`button`) as the spec says.

- **[medium]** **The tooltip fails hover, announcement and ordering.** It has `pointer-events: none` and hides when the pointer leaves the SVG, so it is not hoverable (line 252, 618–620). The `role="tooltip"` is never referenced through `aria-describedby`, so arrow-key stepping is silent to screen readers. Arrow order starts at the worst peer and puts the company, median and best quartile last (line 788). A scroll hides it. (SC 1.4.13, 4.1.2, 2.4.3.) *Fix:* follow S4.

- **[medium]** **The segmented controls are not proper radio groups.** They use `role="radio"` buttons with no roving tabindex and no arrow-key handling (lines 943, 1044). The disabled "Til medianen" uses `disabled` plus a `title` that is unreachable by touch and keyboard, and is moved to the first position. `.seg { overflow: hidden }` (line 140) clips the inner focus outlines. (SC 2.1.1, 4.1.2, 2.4.7.)

- **[medium]** **Excluded rows fail contrast, and the action buttons lack context.** Excluded rows use `#6F7E90` (4.15:1) with a `#B5C0CC` strikethrough (lines 119–120, 157–158). The "Ekskluder" / "Ta med igjen" buttons repeat with no peer name (lines 952, 955). (SC 1.4.3, 2.4.6.) *Fix:* use slate text, and give each button an accessible name like `aria-label="Ekskluder Holmengrå Data AS"`.

- **[medium]** **Focus styles do not match the spec.** Only the charts have a custom ring, and it is in `--link`, not navy-700 (line 114). The front field uses `outline: none` with a box-shadow ring (front lines 268–270), which vanishes in forced colours. `.app { overflow: hidden }` and `.scroll` clip outline offsets at the edges. (SC 2.4.7.)

- **[medium]** **The key table markup breaks header associations.** The group row is a `<td colspan="7">`. Midtre halvdel spans `colspan="2"` under the wrong headers. The floor row is `colspan="4"`. The check row is a bare "—". The strip's `aria-label` is only the key-figure name (lines 805, 1007–1015). The phone table is a `div` grid with `span` headers (line 1025). (SC 1.3.1.)

- **[medium]** **The waterfall residual is drawn in the wrong colour.** It is filled petrol `#1F6F8B` because its value is positive (line 845), where the spec says neutral slate. This is not in the Mock discrepancies list. The legend has no residual entry (line 869), and the "Vis tallene" table omits start and end, has no row `th` and no caption (line 883). (SC 1.1.1, 1.3.1.) *Fix:* add this to the Mock discrepancies list.

- **[low]** **The search fields use a placeholder as their only visible label** (front line 720; header line 596). (SC 3.3.2.)

- **[low]** **The "?" glyph is read aloud.** The flag shows "? Usikker klassifisering" in amber, and the "?" is not `aria-hidden` (lines 914, 939, 949). (SC 1.3.1.)

- **[low]** **Direction glyphs are not hidden from screen readers.** ▲ ▼ ↑ ↓ → sit inside text with no `aria-hidden` and no sr-only wording (messages `dir.*`, `better`, `strength`, `under`). (SC 1.3.1, advisory.)

- **[low]** **The about page announces static text.** It sets `role="status"` on the static "Målingen pågår" paragraph (about line 680), which some screen readers announce on load. (SC 4.1.3, misuse.) *Fix:* use a plain paragraph.

- **[low]** **The analysis heading levels skip a step.** Card titles are `h3` directly under the `h1` company name, with no `h2` for the tab panel (lines 897, 926). (SC 1.3.1.)

*Positive notes:*
- All three mocks set `lang="nb"`.
- The tabs are links with `aria-current="page"`, the correct pattern.
- The decorative legend SVGs are `aria-hidden`.
- The front-page error uses `aria-invalid` plus an error glyph plus text, not colour alone.
- At phone width the body never scrolls sideways, and the QA check found no overflow outside the scroll containers.
