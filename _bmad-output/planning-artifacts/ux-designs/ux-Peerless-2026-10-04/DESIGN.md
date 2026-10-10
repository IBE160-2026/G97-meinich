---
name: Peerless
description: Peer benchmarking from public Norwegian accounts, every gap in kroner. Tailwind + shadcn/ui on Next.js, Recharts for charts; this file specifies the brand layer and the chart grammar on top of shadcn defaults. Light mode only in v1.
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
colors:
  # Light mode — the only theme in v1.
  navy-900: '#0B2340'          # text; outline of the company marker
  navy-700: '#1F3A5F'          # primary: buttons, active tab, focus ring, funnel bars
  primary-foreground: '#FFFFFF'
  link: '#2F5D8C'
  signature: '#7399C6'         # company marker fill only, never text
  background: '#FFFFFF'        # app and card background
  surface: '#F5F7FA'           # group rows, state blocks, calc chips
  surface-foldout: '#FBFCFD'   # behind an open fold-out
  divider: '#D9E0E8'           # table dividers and plot tracks only, never an input boundary
  band: '#6C7F95'              # midtre halvdel band; 3.09:1 on the divider track
  input-border: '#7B8BA0'
  slate: '#5B6B7F'             # secondary text, excluded peer rows, beste fjerdedel outline, ✦, uncertain flag
  favourable: '#1F6F8B'
  unfavourable: '#B45309'
  median: '#6B7C91'            # median tick; waterfall start bar
  peer-dot: '#7B8BA0'          # beeswarm peer dots, = input-border
  gridline: '#E6EBF1'          # chart gridlines, decorative
  connector: '#B9C3CF'         # waterfall connectors, decorative
  disabled-text: '#6F7E90'     # disabled controls only (exempt inactive component); never content
  # STAGE 2 — dark mode, not used in v1. Kept with its known gaps (see Colors → Dark mode, stage 2).
  background-dark: '#0B1624'
  card-dark: '#13233A'
  text-dark: '#E6ECF3'
  muted-dark: '#9AAABD'
  primary-dark: '#8FB3DA'
  primary-foreground-dark: '#0B2340'
  link-dark: '#8FB3DA'
  signature-dark: '#8FB3DA'
  divider-dark: '#2A3D57'
  input-border-dark: '#6B819B'
  zebra-dark: '#102035'
  favourable-dark: '#5FB3CF'
  unfavourable-dark: '#F0A050'
  median-dark: '#7E8FA4'
typography:
  # Source Serif 4 for headings only; Inter for figures, labels and body, with tabular numerals wherever numbers sit in columns. Sizes are from the v1 mocks (drawn in Inter); -phone variants apply below the breakpoint.
  body:
    fontFamily: Inter
    fontSize: 14px
    lineHeight: '1.45'
  numeric:
    fontFamily: Inter
    fontVariantNumeric: tabular-nums
  display-front:
    fontFamily: Source Serif 4
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: -0.01em
  display-front-phone:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.15'
  heading-page:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  heading-page-phone:
    fontFamily: Source Serif 4
    fontSize: 23px
    fontWeight: '600'
    lineHeight: '1.2'
  heading-section:
    fontFamily: Source Serif 4
    fontSize: 19px
    fontWeight: '600'
    lineHeight: '1.25'
  heading-section-phone:
    fontFamily: Source Serif 4
    fontSize: 17px
    fontWeight: '600'
    lineHeight: '1.25'
  company-name:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  company-name-phone:
    fontFamily: Source Serif 4
    fontSize: 21px
    fontWeight: '600'
    lineHeight: '1.2'
  card-title:
    fontFamily: Source Serif 4
    fontSize: 15px
    fontWeight: '600'
  hero-amount:
    fontFamily: Inter
    fontSize: 52px
    fontWeight: '600'
    lineHeight: '1.05'
    letterSpacing: -0.01em
  hero-amount-phone:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.05'
  amount:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.1'
  amount-phone:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: '1.1'
  amount-small:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.1'
  figure-pair:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
  count:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
  search-input:
    fontFamily: Inter
    fontSize: 20px
  search-input-phone:
    fontFamily: Inter
    fontSize: 16px
  label-strong:
    fontFamily: Inter
    fontSize: 13.5px
    fontWeight: '600'
  kicker:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    letterSpacing: 0.06em
    textTransform: uppercase
  table-head:
    fontFamily: Inter
    fontSize: 10.5px
    fontWeight: '600'
    letterSpacing: 0.05em
    textTransform: uppercase
  table:
    fontFamily: Inter
    fontSize: 13px
  tag:
    fontFamily: Inter
    fontSize: 11.5px
    fontWeight: '600'
  caption:
    fontFamily: Inter
    fontSize: 12px
  source:
    fontFamily: Inter
    fontSize: 12.5px
rounded:
  sm: 3px      # tags
  md: 4px      # inputs, state blocks, calc chips, tooltip, waterfall data end
  lg: 6px      # cards, front-page search field, segmented controls
  full: 9999px # markers and dots
spacing:
  # Tailwind 4-based scale inherited. Named tokens from the v1 mocks.
  gutter-desktop: 32px
  gutter-phone: 16px
  card-padding: 24px
  card-padding-phone: 16px
  grid-gap: 24px
  grid-gap-phone: 16px
  front-hero-top: 112px
  front-hero-top-phone: 40px
  indent-group: 30px
  target-min: 24px
  target-phone: 44px
components:
  header:
    background: '{colors.background}'
    border-bottom: '1px {colors.divider}'
    wordmark: '{colors.navy-700}'
  search-field:
    border: '1px {colors.input-border}'
    radius: '{rounded.lg}'
    height: 60px              # front page; 56px at phone width; header variant compact
    typography: '{typography.search-input}'
    focus-ring: '2px {colors.navy-700} outline, 2px offset on {colors.background}'
    error-border: '2px {colors.unfavourable}'
  search-submit:
    background: '{colors.navy-700}'
    foreground: '{colors.primary-foreground}'
  card:
    background: '{colors.background}'
    border: '1px {colors.divider}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
  tag:
    border: '1px {colors.input-border}'
    radius: '{rounded.sm}'
    typography: '{typography.tag}'
  tab-active:
    foreground: '{colors.navy-900}'
    indicator: 'inset 2px bottom {colors.navy-700}'
  marker-company:
    fill: '{colors.signature}'
    stroke: '2px {colors.navy-900}'
    halo: '2px {colors.background}'
  marker-median:
    shape: vertical tick, 2px, full strip height
    stroke: '{colors.median}'
    halo: '1px {colors.background} where it crosses the band'
  marker-best-quartile:
    shape: hollow downward triangle, 10px
    stroke: '1.5px {colors.slate}'
    fill: '{colors.background}'
  marker-peer:
    fill: '{colors.peer-dot}'
    stroke: '2px {colors.background}'
  band-middle-half:
    fill: '{colors.band}'
    height: 6px
  segmented-control:
    border: '1px {colors.input-border}'
    radius: '{rounded.lg}'
    selected-background: '{colors.navy-700}'
    selected-foreground: '{colors.primary-foreground}'
    disabled-background: '{colors.surface}'
    disabled-foreground: '{colors.disabled-text}'
    focus-ring: 'inset 2px {colors.navy-700}'
  waterfall-bar:
    start: '{colors.median}'
    end: '{colors.navy-700}'
    favourable: '{colors.favourable}'      # petrol; step raises the margin vs samlet; always with sign and word
    unfavourable: '{colors.unfavourable}'  # amber; step lowers the margin vs samlet; always with sign and word
    residual: '{colors.slate}'             # 'Avskrivninger og øvrige poster', whatever its sign
    connector: '{colors.connector}'
    data-end-radius: '{rounded.md}'
  fold-out:
    background: '{colors.surface-foldout}'
    header: '{typography.label-strong}'
    indent: '{spacing.indent-group}'
  state-block:
    background: '{colors.surface}'
    border: '1px {colors.input-border}'
    accent: '4px left {colors.navy-700}'
    radius: '{rounded.md}'
  tooltip:
    background: '{colors.background}'
    border: '1px {colors.divider}'
    shadow: '0 2px 8px rgba(11,35,64,.14)'
    radius: '{rounded.md}'
  ai-marker:
    glyph: '✦'
    color: '{colors.slate}'
    size: 'at least the size of the label it precedes'
  uncertain-flag:
    color: '{colors.slate}'
    typography: '{typography.tag}'
---

## Brand & Style

Peerless is a calm, competent analyst. The register is the institutional research report of an investment bank: restrained, dense where density helps, never decorated. It is not a database dump and not a widget dashboard. Trust comes before polish. The product earns attention through structure and data, not ornament: generous white space, one clear hierarchy per screen, numbers that line up.

No hype, no gamification, no brand copy borrowed from the reference genre. Honesty about uncertainty (unaudited figures, too few peers, the age of the data) is part of the look: a caveat is set as plainly as a result, never hidden in a tooltip.

Peerless inherits shadcn/ui on Tailwind. This file specifies only the brand layer (palette, markers, chart grammar, a few product components). Unlisted shadcn tokens and components (`Button` variants, `Popover`, `Command`, `Tabs`, `Collapsible`, `Tooltip`) keep their defaults. **v1 is light mode only**; the dark tokens are stage 2.

Visual references: [mockups/v1-front.html](mockups/v1-front.html), [mockups/v1-analysis.html](mockups/v1-analysis.html), [mockups/v1-about.html](mockups/v1-about.html). On conflict the spines win (EXPERIENCE.md, Foundation); discrepancies are listed in EXPERIENCE.md, Mock discrepancies.

## Colors

Navy carries the brand; one blue marks the company; two muted hues carry direction. No red, no green, anywhere.

| Token | Value | Use | Never |
|---|---|---|---|
| `navy-900` | `#0B2340` | All body text; the company marker's outline | |
| `navy-700` | `#1F3A5F` | Primary fill (submit, selected step, active tab), focus ring, funnel bars, waterfall end bar | Decoration |
| `link` | `#2F5D8C` | Links, the "Hvordan er dette regnet?" drill-down | |
| `signature` | `#7399C6` | **The company marker only** | Text, fills, chrome |
| `background` | `#FFFFFF` | App and card background | |
| `surface` | `#F5F7FA` | Group rows, state blocks, calculation chips | |
| `surface-foldout` | `#FBFCFD` | Behind an open fold-out | |
| `divider` | `#D9E0E8` | Table dividers, plot tracks | Input boundaries; anything that carries information |
| `band` | `#6C7F95` | The midtre halvdel band on a strip | Text |
| `input-border` | `#7B8BA0` | Input and segmented-control boundaries | |
| `peer-dot` | `#7B8BA0` | Beeswarm peer dots | |
| `slate` | `#5B6B7F` | Secondary text, axis labels, excluded peer rows, beste fjerdedel outline, ✦, the uncertain flag, the residual waterfall bar | |
| `favourable` | `#1F6F8B` | Direction words and arrows pointing the good way; favourable waterfall bars (petrol) | Alone, without arrow or word |
| `unfavourable` | `#B45309` | The bad direction; unfavourable waterfall bars (amber); malformed-input border | Alone, without arrow or word; any meaning other than direction |
| `median` | `#6B7C91` | Median tick; waterfall start bar | Text (4.27:1 on white) |
| `gridline`, `connector` | `#E6EBF1`, `#B9C3CF` | Chart gridlines; waterfall connectors. Decorative | Anything that carries information |
| `disabled-text` | `#6F7E90` | Disabled controls only (the disabled closable-share step) | Content, including excluded peer rows |

**Rules.**
- **Direction is always an arrow or a word**, never colour alone: `↑ Høyere er bedre`, `▼ 7,0 pp under`, `▲ Styrke`, `lavere enn samlet`.
- **`signature` is for markers only.** It is 2.96:1 on white and 2.76:1 on `surface`, below WCAG 1.4.11's 3:1, so the marker always carries a 2px `navy-900` outline (15.8:1 on white, 11.9:1 on the `divider` track). The hue is not darkened: `#6A8FBD` reaches only 2.5:1 on the track.
- **Marker identity is by shape, not shade.**
- **`unfavourable` means direction only.** The uncertain flag is `slate`, carried by ✦ and its words.
- `divider` (1.33:1) is decorative only. Input boundaries use `input-border` (3.5:1 white, 3.2:1 surface).
- **The middle-half band is perceivable.** `band` `#6C7F95` is `slate`'s hue darkened to reach 3:1 against the `divider` track: **3.09:1** on the track (4.11:1 on white, 3.83:1 on `surface`), computed with the WCAG relative-luminance formula. It is almost the median's tone (1.04:1), so the median is told apart by shape: a 2px tick spanning the full 30px strip height above and below the 6px band, with a 1px `background` halo where it crosses the band. Q1–Q3 is also given as text in every row that draws the band (EXPERIENCE.md).

**Verified contrast** (WCAG formula, light mode). Text: `navy-900` 15.8:1 on white, 14.7 on `surface`; `slate` 5.45 white, 5.08 `surface`, 5.30 `surface-foldout`; `link` 6.85 / 6.38; `favourable` 5.67 / 5.28; `unfavourable` 5.02 / 4.68 (the lowest text pair); white on `navy-700` 11.5. Non-text: focus ring `navy-700` 11.5 on white, 10.7 on `surface`; median 4.27 white, 3.98 `surface`, 3.21 track; `input-border` 3.48 / 3.24; `band` 3.09 on track; `slate` triangle stroke 4.09 on track; peer dot 3.48 on white; waterfall bars on white: start 4.27, favourable 5.67, unfavourable 5.02, residual 5.45, end 11.5. `disabled-text` is 4.15 white, 3.86 `surface`, which is why it is limited to disabled controls (SC 1.4.3 inactive-component exception). The residual (`slate`) and favourable (petrol) bars differ by hue only (1.04:1); their words carry the meaning. The waterfall palette was flagged by the dataviz validator for lightness and chroma; CVD separation passes (worst adjacent ΔE 15,5) ([review-notes-v1.md](mockups/review-notes-v1.md)).

### Dark mode (stage 2)

The dark tokens in the frontmatter are kept for stage 2 and are **not used in v1**; no component specifies dark behaviour. Known gaps to close before dark mode ships:

- **Missing values:** no dark `surface`, `surface-foldout`, `band`, `peer-dot`, `gridline`, `connector`, `disabled-text`, tooltip background or triangle fill.
- **Failing pairs if light tokens are reused:** the focus ring in `navy-700` is 1.58:1 on `background-dark` and 1.38:1 on `card-dark`; the waterfall end bar in `navy-700` is 1.38:1 on `card-dark`; the beste fjerdedel triangle's `slate` stroke is 2.90:1 on `card-dark`. Likely remaps: focus ring and end bar to `primary-dark` (8.34 / 7.24), triangle stroke to `muted-dark` with a `card-dark` fill — to be verified.
- **Irregular pairing:** `navy-900`↔`text-dark`, `navy-700`↔`primary-dark`, `slate`↔`muted-dark`; stage 2 should rename to `x` / `x-dark`.
- Verified so far: dark text and link pairs pass AA (lowest `muted-dark` 6.66 on card); signature-dark 5.06 on the dark track, needing no outline; dark signature against dark median is 1.52:1, so marker identity stays by shape.

## Typography

**Source Serif 4 for headings only**; **Inter** for figures, amounts, tables, labels and body, with **tabular numerals** (`{typography.numeric}`) wherever numbers sit in columns, axes, tooltips, amounts and inputs. The ramp is in the frontmatter; `-phone` tokens apply below the breakpoint (Tailwind `md`, 768px).

- Headings: `display-front` (front page), `heading-page` (about page title), `company-name` (the analysis `h1`), `heading-section` (tab panel and page section `h2`), `card-title` (`h3`).
- `hero-amount` is reserved for the hero card's driftsmargin amount on Oversikt.
- `amount` is for Verdi amount cards; `amount-small` for small cards; `figure-pair` for "own vs beste fjerdedel" in the hero.
- `kicker` and `table-head` are uppercase labels, slate; they name, they never carry a number.
- Units sit in body weight beside the figure ("per år", "(engangsbeløp)").
- A number is never set in the serif, even inside a heading. The v1 mocks are drawn all in Inter; the serif sizes above are first values, to be checked when it is applied.

## Layout & Spacing

White space is the main structural device. Tailwind's 4-based scale is inherited; the named tokens are in the frontmatter.

- **Oversikt is a 12-column card grid**: hero card (5 columns) beside the peer plot with its compact list (7), three small cards (4 each), explanation full width (12). One column at phone width.
- **Peers, Nøkkeltall og gap, Verdi** are full-width cards and tables.
- **No side rail anywhere**, no persistent summary bar.
- **Front page**: one centred column, max ~720px, the search field as hero (`{spacing.front-hero-top}` above), "Slik fungerer det" as three numbered steps in three columns below, each with a 1px `navy-900` top rule, title in `label-strong` and one body sentence; left-aligned and single column on the phone.
- **About page**: a readable long page with a short table of contents (one link per section, `body`, slate numbers), sticky beside the text on desktop, a bordered box at the top on the phone ([mockups/v1-about.html](mockups/v1-about.html)).
- **Width:** designed at 1200 and 375, no breakage down to 320 CSS px. No fixed column widths in phone tables that cannot shrink.
- Tables and charts sit in their own scroll container (EXPERIENCE.md, Scroll container). The page body never scrolls sideways.
- **Targets:** at least `{spacing.target-min}` × `{spacing.target-min}`; `{spacing.target-phone}` recommended on the phone. Inline text buttons are padded to reach the minimum.

## Elevation & Depth

Flat. Cards are separated by a 1px `divider` border and white space, not shadow. The only shadow is the tooltip's (`{components.tooltip.shadow}`); the info popover uses shadcn `Popover`'s default. Tonal layering is limited to `surface` for group rows and state blocks, and `surface-foldout` behind open fold-outs. Focus is a 2px `navy-700` `outline` with a 2px offset, so it survives forced-colours mode; inside segmented controls it is drawn inset.

## Shapes

Corners are small and sober: `{rounded.sm}` tags, `{rounded.md}` inputs, state blocks and tooltips, `{rounded.lg}` cards. Nothing is pill-shaped except markers.

**Chart markers, by shape:**

| Marker | Shape |
|---|---|
| Company | Filled circle, `signature`, 2px `navy-900` outline, 2px `background` halo |
| Median | Vertical tick, 2px, `median`, full strip height; 1px `background` halo across the band |
| Beste fjerdedel | Hollow downward triangle, `slate` 1.5px outline, `background` fill |
| Midtre halvdel | 6px band in `band` on the `divider` track |
| Peer | Circle, `peer-dot`, 2px `background` stroke |

## Components

shadcn components used as-is: `Button`, `Input`, `Tabs`, `Collapsible`, `Popover`, `Command`, `Tooltip`, `Table`. Brand-layer and product components (behaviour in EXPERIENCE.md, Component Patterns):

- **Header** — wordmark "Peerless" (bold, `navy-700`), compact search field, link "Slik fungerer Peerless" right-aligned; 1px `divider` bottom border. On the phone the link wraps to two lines (max ~92px). On the front page the header holds no search field.
- **Search field** — front-page hero: 60px tall (56px on the phone), `{typography.search-input}`, `input-border`, joined to a `navy-700` submit button; stacked full-width on the phone (button 52px). Visible label or persistent hint "Navn eller organisasjonsnummer" above the field in `caption`, slate. States: focus ring; error = 2px `unfavourable` border plus an error glyph, message in text colour; loading = `surface` fill, slate text, a 14px ring spinner where motion is allowed, button disabled (copy and behaviour in EXPERIENCE.md).
- **Search results** — not mocked. A shadcn `Command`-style list under the field: company name (600), then orgnr (tabular) · industry · municipality in slate, one row each; the active option in `surface`.
- **Company header** — name in `company-name`; meta line in slate, items separated by a `·` in `input-border`: orgnr · industry · Omsetning 16,7 mill. kr · Regnskapsår 2025 · hentet 3. okt. 2026. A data-quality subline in slate when the filing is not fully reconciled.
- **Tabs** — text tabs, slate; active is `navy-900`, 600, with a 2px `navy-700` underline.
- **Hero card** — kicker "Største gap i kroner", key-figure name (Driftsmargin) with direction tag, the amount in `hero-amount`, "per år ved full tilnærming til beste fjerdedel", own vs beste fjerdedel in `figure-pair`, context line in slate, two links. No-gap state: "▲ Styrke" in place of the amount, same layout.
- **Small card** — kicker, key-figure name, value in `amount-small` with its unit label, one or two slate lines; the capital card ("Største kapitalgap") always carries "Ikke per år, og legges ikke til resultatet." Empty state: one slate sentence in place of the value.
- **Explanation card** — full-width card; kicker "Forklaring" preceded by the AI marker; text clamped to two lines with "Les mer"; a slate source line under it with the key "✦ KI-generert". Adjusted group: the text is replaced by one sentence and a "Tilbakestill" link-button, same card.
- **Beeswarm** — horizontal axis (percent), `gridline`s, peer dots packed vertically, company marker labelled with its name above (600, white text halo), median tick spanning the plot, beste fjerdedel triangle on the axis, "Bedre →" top right. Legend above: each marker with its value. Beneath: the compact list (five rows: name, driftsmargin, revenue, basis; `table`) and a "Vis tallene" link-button opening the full table in a scroll container.
- **Distribution strip** — 30px tall track in `divider`, the band, median tick, triangle, company marker. Lower-is-better rows are drawn mirrored so better is always to the right, labelled "Bedre →" and with the column head "Fordeling · bedre →"; no-direction and check rows unmirrored with no "Bedre" label. Under the strip, the midtre halvdel as text in `caption`, slate.
- **Benchmark row** — table row: key-figure name (600) with a slate subline "direction · n brukt · k utelatt"; own value; median; beste fjerdedel; Plassering; distribution strip; gap in kroner (600, slate subline for unit or under-amount). Cost-share rows indented `{spacing.indent-group}` under a `surface` group row "Forklarer marginavviket – summeres ikke", with a 2px `divider` rule on the left. Check row and no-direction rows in slate. Below-floor, undefined and "Ikke i demodataene" rows: the comparison cells merged into one italic slate cell, own value kept where it exists. On the phone: three-column row (name · own value · gap in kroner) with a caret on the name button.
- **Fold-out** — `Collapsible` under its row; header in `label-strong` with ▸/▾ caret (`aria-hidden`); body on `surface-foldout`, indented `{spacing.indent-group}`; full width on the phone.
- **Margin waterfall** — desktop: six columns from "Peer-gruppen samlet" (`median` fill) through four steps to the company (`navy-700`); step bars `favourable` (petrol) where the step is favourable, `unfavourable` (amber) where it is unfavourable, the residual "Avskrivninger og øvrige poster" in `slate` whatever its sign (a remainder, not a cost category); each labelled with signed kroner above, name, ▲/▼ plus word, and "own mot samlet" shares below, with "Mot peer-gruppen samlet, ikke medianen" added where the row and the bar disagree; thin connectors in `connector`. Rounded data end (`{rounded.md}`), square start. Legend names all three bar kinds, the residual included. On the phone: one row per step, name and signed value on one line, subline, a 10px floating bar on a shared kroner scale. The reference tag "Mot peer-gruppen samlet: 0,5 %, ikke beste fjerdedel" leads, then the never-added sentence in body text; "Vis tallene" opens a table.
- **Factor pair** — two bordered boxes side by side (stacked on the phone), each with factor name, "Fjordkode x · median y", its count, and its own distribution strip.
- **Funnel** — five columns with stage name, count in `count` (tabular) and an 8px bar in `navy-700` proportional to stage 1; dividers between. On the phone a vertical list: name left, count right, bar beneath. A "✦ n med usikker klassifisering" line under it.
- **Size-band control** — segmented control, three buttons "0,5–2× / Standard", "0,33–3× / Utvidet", "0,25–4× / Utvidet"; selected in `navy-700`. Full-width three-column grid on the phone.
- **Peer list** — desktop table: Selskap · Omsetning · Driftsmargin · Hvorfor med · Grunnlag for treff · action link; caption carries "✦ KI-generert". ✦ placement per EXPERIENCE.md, AI marking. Excluded rows in `slate` text, name struck through, tag "Ekskludert". On the phone: one card per peer (name, revenue and driftsmargin; reason; basis + flag + action).
- **Closable-share control** — segmented control 0 / 25 / 50 / 75 / 100 % plus "Til medianen for driftsmargin (n %)" in its ordered place; disabled step on `surface` in `disabled-text`. A median line under it with a 2×12px median tick and "Medianen gjelder driftsmargin."
- **Amount card** — kicker, value in `amount`, slate per-line ("585 000 kr av 1 170 000 kr per år, ved 50 % av gapet" / "engangsbeløp, …"), its own median-tick line, a separation note where needed. Working capital lists its two parts as `table`-size lines, above the total when there is one.
- **Multiple field** — 90px numeric input with label "EV/EBIT-multippel"; empty by default; error state as the search field's.
- **Provenance drill-down** — opens inline under its amount: numbered steps, each calculation in a `surface` chip (tabular), register field names in monospace slate; the beste fjerdedel step names its rule and count with a "Vis fordelingen" link; the data-quality line is the last step, in body text.
- **State block** — `surface` box, 4px `navy-700` left accent, kicker plus one or two sentences, at most one link or action. Used for uncovered industry, not found, the widened notice, the outside-seed note, thin group, rate limit and errors. There is no separate banner component.
- **Info button** — a 24px minimum `button` with a visible ⓘ in `link`, opening a shadcn `Popover` with the caveat's long text in `body`.
- **Tag** — `{typography.tag}`, `input-border` outline; soft variant with `divider` outline and slate text.
- **Uncertain flag** — "✦ Usikker klassifisering", `{typography.tag}`, `slate`.
- **AI marker (✦)** — the glyph ✦ in `slate`, at least the size of its label, before the label of AI-produced content; never on a number. Placement rule: EXPERIENCE.md, AI marking. If Inter lacks U+2726, an `aria-hidden` inline SVG.
- **Tooltip** — `background`, 1px `divider`, shadow, `{rounded.md}`; value (13px/600, tabular), name, slate subline. On the phone it opens above the plot with a leader line so it never covers the company marker.
- **Source line** — footer, `{typography.source}`, slate: "Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens".

## Do's and Don'ts

| Do | Don't |
|---|---|
| Show every number with its context — median, beste fjerdedel or peer-gruppen samlet — or say why it has none | Show a bare figure with neither context nor a reason |
| Separate company, median and beste fjerdedel by shape | Rely on shade |
| Give direction an arrow or a word | Use colour alone, or any red or green; use amber for anything but direction |
| Keep `signature` for the company marker, always outlined | Set text, fills or chrome in `signature` |
| Use `input-border` for anything the user types into | Use `divider` as an input boundary or for the band |
| Inter with tabular numerals in every column | Proportional digits in tables, axes or amounts |
| Put tables and charts in their own labelled scroll container | Let the body scroll sideways at 320 or above |
| Draw the waterfall from peer-gruppen samlet, bars summing exactly | Scale the waterfall by the closable share or add it to profit uplift |
| Draw a gap in the data as a gap | Interpolate or estimate a missing value |
| Set a caveat's key text inline | Put a caveat only in a tooltip |
| Mark AI-produced content with ✦ per EXPERIENCE.md, AI marking | Put ✦ on an engine figure |
| Let structure and data make it interesting | Decoration, gradients, celebratory animation, scores, badges |
