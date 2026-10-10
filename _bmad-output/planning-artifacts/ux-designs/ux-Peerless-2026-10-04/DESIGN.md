---
name: Peerless
description: Peer benchmarking from public Norwegian accounts, every gap in kroner. Tailwind + shadcn/ui on Next.js, Recharts for charts; this file specifies the brand layer and the chart grammar on top of shadcn defaults.
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
colors:
  # Light. Every value from .memlog.md unless marked (mock).
  navy-900: '#0B2340'          # text; outline of the company marker
  navy-700: '#1F3A5F'          # primary: buttons, active tab, focus ring, funnel bars
  primary-foreground: '#FFFFFF'
  link: '#2F5D8C'
  signature: '#7399C6'         # company marker fill only, never text
  background: '#FFFFFF'        # (mock) app background; shadcn default
  surface: '#F5F7FA'           # group rows, banners, state blocks, calc chips
  divider: '#D9E0E8'           # table dividers and plot tracks only, never an input boundary
  input-border: '#7B8BA0'
  slate: '#5B6B7F'             # secondary text, beste fjerdedel outline
  favourable: '#1F6F8B'
  unfavourable: '#B45309'
  median: '#6B7C91'            # median tick; waterfall start bar (mock)
  peer-dot: '#7B8BA0'          # (mock) beeswarm peer dots, = input-border
  gridline: '#E6EBF1'          # (mock) chart gridlines
  disabled-text: '#6F7E90'     # (mock) disabled step, excluded peer row
  # Dark. Every value from .memlog.md.
  background-dark: '#0B1624'
  card-dark: '#13233A'
  text-dark: '#E6ECF3'
  muted-dark: '#9AAABD'
  primary-dark: '#8FB3DA'
  primary-foreground-dark: '#0B2340'
  link-dark: '#8FB3DA'
  signature-dark: '#8FB3DA'
  divider-dark: '#2A3D57'      # also the plot track
  input-border-dark: '#6B819B'
  zebra-dark: '#102035'
  favourable-dark: '#5FB3CF'
  unfavourable-dark: '#F0A050'
  median-dark: '#7E8FA4'
typography:
  # Inter everywhere, tabular numerals wherever numbers sit in columns. Sizes are from the v1 mocks.
  body:
    fontFamily: Inter
    fontSize: 14px
    lineHeight: '1.45'
  numeric:
    fontFamily: Inter
    note: 'font-variant-numeric: tabular-nums'
  display-front:
    fontFamily: Inter
    fontSize: 40px            # 28px at 375
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: -0.01em
  hero-amount:
    fontFamily: Inter
    fontSize: 52px            # 40px at 375
    fontWeight: '600'
    lineHeight: '1.05'
    letterSpacing: -0.01em
  amount:
    fontFamily: Inter
    fontSize: 30px            # 26px at 375; small cards 22px
    fontWeight: '600'
    lineHeight: '1.1'
  company-name:
    fontFamily: Inter
    fontSize: 24px            # 21px at 375
    fontWeight: '600'
    lineHeight: '1.2'
  card-title:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
  kicker:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    letterSpacing: 0.06em     # uppercase
  table-head:
    fontFamily: Inter
    fontSize: 10.5px
    fontWeight: '600'
    letterSpacing: 0.05em     # uppercase
  table:
    fontFamily: Inter
    fontSize: 13px
  caption:
    fontFamily: Inter
    fontSize: 12px
  heading-serif:
    fontFamily: Source Serif 4
    note: 'Optional per memlog; not used in any v1 mock. Unresolved.'
rounded:
  sm: 3px      # tags
  md: 4px      # inputs, banners, calc chips
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
  front-hero-top: 112px       # 40px at 375
components:
  header:
    background: '{colors.background}'
    border-bottom: '1px {colors.divider}'
    wordmark: '{colors.navy-700}'
  search-field:
    border: '1px {colors.input-border}'
    radius: '{rounded.lg}'
    height: 60px              # front page; 56px at 375; header variant compact
    focus-ring: '2px {colors.background} + 2px {colors.navy-700}'
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
    fontSize: 11.5px
  tab-active:
    foreground: '{colors.navy-900}'
    indicator: 'inset 2px bottom {colors.navy-700}'
  marker-company:
    fill: '{colors.signature}'
    stroke: '2px {colors.navy-900}'
    halo: '2px {colors.background}'
    fill-dark: '{colors.signature-dark}'
    stroke-dark: none
  marker-median:
    shape: vertical tick, 2px
    stroke: '{colors.median}'
    stroke-dark: '{colors.median-dark}'
  marker-best-quartile:
    shape: hollow downward triangle, 10px
    stroke: '1.5px {colors.slate}'
    fill: '{colors.background}'
  band-middle-half:
    fill: '{colors.divider}'
    height: 6px
  segmented-control:
    border: '1px {colors.input-border}'
    radius: '{rounded.lg}'
    selected-background: '{colors.navy-700}'
    selected-foreground: '{colors.primary-foreground}'
    disabled-background: '{colors.surface}'
    disabled-foreground: '{colors.disabled-text}'
  waterfall-bar:
    start: '{colors.median}'
    end: '{colors.navy-700}'
    lower-than-peers: '{colors.favourable}'
    higher-than-peers: '{colors.unfavourable}'
    data-end-radius: 4px
  state-block:
    background: '{colors.surface}'
    border: '1px {colors.input-border}'
    accent: '4px left {colors.navy-700}'
    radius: '{rounded.md}'
  tooltip:
    background: '{colors.background}'
    border: '1px {colors.divider}'
    shadow: '0 2px 8px rgba(11,35,64,.14)'
    radius: 5px
  ai-marker:
    glyph: '✦'
    color: '{colors.slate}'
---

## Brand & Style

Peerless is a calm, competent analyst. The register is the institutional research report of an investment bank: restrained, dense where density helps, never decorated. It is not a database dump and not a widget dashboard. Trust comes before polish. The product earns attention through structure and data, not ornament: generous white space, one clear hierarchy per screen, numbers that line up.

No hype, no gamification, no brand copy borrowed from the reference genre. Honesty about uncertainty (unaudited figures, too few peers, the age of the data) is part of the look: a caveat is set as plainly as a result, never hidden in a tooltip.

Peerless inherits shadcn/ui on Tailwind. This file specifies only the brand layer (palette, markers, chart grammar, a few product components). Unlisted shadcn tokens and components (`Button` variants, `Popover`, `Command`, `Tabs`, `Collapsible`, `Tooltip`) keep their defaults.

Visual references: [.working/v1-front.html](.working/v1-front.html), [.working/v1-analysis.html](.working/v1-analysis.html), [.working/v1-about.html](.working/v1-about.html), all light mode only. **This spine wins on conflict with any mock.** Mock discrepancies are listed in EXPERIENCE.md.

## Colors

Navy carries the brand; one blue marks the company; two muted hues carry direction. No red, no green, anywhere.

| Token | Light / dark | Use | Never |
|---|---|---|---|
| `navy-900` / `text-dark` | `#0B2340` / `#E6ECF3` | All body text; the company marker's outline | |
| `navy-700` / `primary-dark` | `#1F3A5F` / `#8FB3DA` | Primary fill (submit, selected step, active tab), focus ring, funnel bars. Dark primary fill carries `navy-900` text (7.3:1) | Decoration |
| `link` / `link-dark` | `#2F5D8C` / `#8FB3DA` | Links, the "Hvordan er dette regnet?" drill-down | |
| `signature` / `signature-dark` | `#7399C6` / `#8FB3DA` | **The company marker only** | Text, fills, chrome |
| `surface` | `#F5F7FA` | Group rows, banners, state blocks, calculation chips | |
| `divider` / `divider-dark` | `#D9E0E8` / `#2A3D57` | Table dividers, plot tracks, middle-half band | Input boundaries |
| `input-border` / `input-border-dark` | `#7B8BA0` / `#6B819B` | Input and segmented-control boundaries; peer dots (mock) | |
| `slate` / `muted-dark` | `#5B6B7F` / `#9AAABD` | Secondary text, axis labels, beste fjerdedel outline, ✦ | |
| `favourable` / `favourable-dark` | `#1F6F8B` / `#5FB3CF` | Direction words and arrows pointing the good way; "lavere enn samlet" waterfall bars | Alone, without arrow or word |
| `unfavourable` / `unfavourable-dark` | `#B45309` / `#F0A050` | The bad direction; malformed-input border | Alone, without arrow or word |
| `median` / `median-dark` | `#6B7C91` / `#7E8FA4` | Median tick; waterfall start bar | |
| `zebra-dark` | `#102035` | Alternate table rows, dark only | |
| `card-dark`, `background-dark` | `#13233A`, `#0B1624` | Dark surfaces | |

**Rules.**
- **Direction is always an arrow or a word**, never colour alone: `↑ Høyere er bedre`, `▼ 7,0 pp under`, `▲ Styrke`, `lavere enn samlet`.
- **`signature` is for markers only.** It is 2.96:1 on white and 2.76:1 on `surface`, below WCAG 1.4.11's 3:1, so in light mode the marker always carries a 2px `navy-900` outline (15.8:1 on white, 11.9:1 on the `divider` track). The hue is not darkened: `#6A8FBD` reaches only 2.5:1 on the track. In dark mode the marker needs no outline (5.06:1 on the track).
- **Marker identity is by shape, not shade.** Dark signature against dark median is only 1.52:1.
- `divider` (1.33:1) is decorative only. Input boundaries use `input-border` (3.5:1 white, 3.2:1 surface; dark 4.54:1 bg, 3.94:1 card).

**Verified contrast** (memlog): all light and dark text pairs pass AA; the lowest is `unfavourable` on `surface`, 4.68:1. Light median 4.27 white, 3.98 surface, 3.21 track. Dark link 7.24–8.34 on bg/card/zebra; all dark text on zebra ≥ 6.9; dark median 3.34 vs track. Dark dividers 1.43–1.65, decorative.

**Gaps.** Mock-only colours (`peer-dot`, `gridline`, `disabled-text`, `background`) have no dark pair; dark `surface`, dark `gridline` and dark `peer-dot` are undefined. The waterfall palette was flagged by the dataviz validator for lightness and chroma; CVD separation passes (worst adjacent ΔE 15,5) and every bar passes 3:1 — `[ASSUMPTION]` still to be confirmed by the user ([review-notes-v1.md](.working/review-notes-v1.md)).

## Typography

**Inter** for everything, with **tabular numerals** (`font-variant-numeric: tabular-nums`) wherever numbers sit in columns, axes, tooltips, amounts and inputs. The ramp in the frontmatter is lifted from the v1 mocks.

- `hero-amount` is reserved for the single largest kroner gap on Oversikt.
- `amount` is for Verdi amount cards and small cards.
- `kicker` and `table-head` are uppercase labels, slate; they name, they never carry a number.
- Units sit in body weight beside the figure ("per år", "(engangsbeløp)").

`[ASSUMPTION]` **Source Serif 4 for headings is unresolved.** The memlog calls it optional; it was shown only in the rejected round-1 direction A ([.working/directions-analysis-1.html](.working/directions-analysis-1.html)) and appears in no v1 mock. Until the user rules, headings are Inter.

## Layout & Spacing

White space is the main structural device. Tailwind's 4-based scale is inherited; the named tokens are `{spacing.gutter-desktop}` / `{spacing.gutter-phone}`, `{spacing.card-padding}`, `{spacing.grid-gap}`.

- **Oversikt is a 12-column card grid**: hero card (5 columns) beside the peer plot with its compact list (7), three small cards (4 each), explanation full width (12). One column at phone width.
- **Peers, Nøkkeltall og gap, Verdi** are full-width cards and tables.
- **No side rail anywhere**, no persistent summary bar.
- **Front page**: one centred column, max ~720px, the search field as hero (`{spacing.front-hero-top}` above), "Slik fungerer det" as three columns below with a 1px `navy-900` top rule per step; left-aligned and single column at 375.
- **About page**: a readable long page with a short table of contents, sticky beside the text on desktop, a box at the top on the phone ([.working/v1-about.html](.working/v1-about.html)).
- Tables and charts sit in their own `overflow-x: auto` container. The page body never scrolls sideways.

## Elevation & Depth

Flat. Cards are separated by a 1px `divider` border and white space, not shadow. The only shadow is the tooltip's (`{components.tooltip.shadow}`). Tonal layering is limited to `surface` for group rows, banners and state blocks, and `#FBFCFD` behind open fold-outs (mock). Focus is shown by a 2px `navy-700` ring outside a 2px background halo.

## Shapes

Corners are small and sober: `{rounded.sm}` tags, `{rounded.md}` inputs and banners, `{rounded.lg}` cards. Nothing is pill-shaped except markers.

**Chart markers, by shape in both modes** (decided):

| Marker | Shape | Status |
|---|---|---|
| Company | Filled circle, `signature`, 2px `navy-900` outline, 2px background halo (light); no outline (dark) | Decided |
| Median | Vertical tick, 2px, `median` | Decided |
| Beste fjerdedel | Hollow downward triangle, `slate` 1.5px outline, white fill | `[ASSUMPTION]` renderer proposal from round 1, used in every later mock, never explicitly confirmed |
| Middle half (interquartile range) | 6px band in `divider` on the track | `[ASSUMPTION]` as above |
| Peer | Circle, `peer-dot`, 2px white stroke | From mocks |

## Components

shadcn components used as-is: `Button`, `Input`, `Tabs`, `Collapsible`, `Popover`, `Command`, `Tooltip`, `Table`. Brand-layer and product components:

- **Header** — wordmark "Peerless" (bold, `navy-700`), compact search field, link "Slik fungerer Peerless" right-aligned; 1px `divider` bottom border. At 375 the link wraps to two lines (max ~92px). On the front page the header holds no search field.
- **Search field** — front-page hero: 60px tall (56px at 375), `{typography.body}` at 20px (16px at 375), `input-border`, joined to a `navy-700` submit button; stacked full-width at 375 (button 52px). States: focus ring; error = 2px `unfavourable` border plus an error glyph, message in text colour; loading = `surface` fill, slate text, a 14px ring spinner, button disabled.
- **Search results** — `[ASSUMPTION]` not mocked. A shadcn `Command`-style list under the field: company name (600), then orgnr (tabular) · industry · municipality in slate, one row each; keyboard-highlighted row in `surface`.
- **Company header** — name in `company-name`; meta line in slate, items separated by a `·` in `input-border`: orgnr · industry · Omsetning 16,7 mill. kr · Regnskapsår 2025 · hentet 3. okt. 2026.
- **Tabs** — text tabs, slate; active is `navy-900`, 600, with a 2px `navy-700` underline.
- **Hero card** — kicker "Største gap i kroner", key-figure name with direction tag, the amount in `hero-amount`, "per år ved full tilnærming til beste fjerdedel", own vs beste fjerdedel at 18px, context line in slate, two links.
- **Small card** — kicker, key-figure name, value in `amount` (22px) with unit label, one or two slate lines.
- **Explanation card** — full-width card; kicker "Forklaring" preceded by the AI marker; text clamped to two lines with "Les mer"; a slate source line under it.
- **Beeswarm** — horizontal axis (percent), gridlines, peer dots packed vertically, company marker labelled with its name above (600, white text halo), median tick spanning the plot, beste fjerdedel triangle on the axis, "Bedre →" top right. Legend above: each marker with its value.
- **Distribution strip** — 30px tall track in `divider`, middle-half band, median tick, triangle, company marker. Mirrored for lower-is-better figures so better is always to the right; the column head reads "Fordeling · bedre →". `[ASSUMPTION]` mirroring is a renderer proposal not confirmed in the memlog.
- **Benchmark row** — table row: key-figure name (600) with a slate subline "direction · count"; own value; median; beste fjerdedel; Plassering; distribution strip; gap in kroner (600, slate subline for unit or under-amount). Cost-share rows indented 30px under a `surface` group row "Forklarer marginavviket – summeres ikke", with a 2px `divider` rule on the left. Check row and no-direction rows in slate. Below-floor rows: the four comparison cells merged into one italic cell. At 375: three-column row (name · own value · gap in kroner) with a caret.
- **Fold-out** — `Collapsible` under its row; header 13.5px/600 with ▸/▾ caret; body on `#FBFCFD` (mock), indented 30px.
- **Margin waterfall** — desktop: six columns from "Peer-gruppen samlet" (`median` fill) through four steps to the company (`navy-700`); step bars `favourable` when lower than samlet, `unfavourable` when higher, each labelled with signed kroner above, name, ▲/▼ plus word, and "own mot samlet" shares below; thin connectors in `#B9C3CF` (mock). Rounded data end, square start. At 375: one row per step, name and signed value on one line, subline, a 10px floating bar on a shared kroner scale. A reference tag "Mot peer-gruppen samlet: 0,5 %, ikke beste fjerdedel" leads; "Vis tallene" opens a table.
- **Factor pair** — two bordered boxes side by side (stacked at 375), each with factor name, "Fjordkode x · median y" and its own distribution strip.
- **Funnel** — five columns with stage name, count (24px, 600, tabular) and a 8px bar in `navy-700` proportional to stage 1; dividers between. At 375 a vertical list: name left, count right, bar beneath. A "? n med usikker klassifisering" line under it.
- **Size-band control** — segmented control, three buttons "0,5–2× / Standard", "0,33–3× / Utvidet", "0,25–4× / Utvidet"; selected in `navy-700`. Full-width three-column grid at 375.
- **Peer list** — desktop table: Selskap · Omsetning · Hvorfor med · Grunnlag for treff · action link. Excluded rows in `disabled-text`, name struck through, tag "Ekskludert". At 375: one card per peer (name and revenue, reason, basis + flag + action).
- **Closable-share control** — segmented control 0 / 25 / 50 / 75 / 100 % plus "Til medianen (n %)" in its ordered place; disabled step on `surface`. A median line under it with a 2×12px median tick.
- **Amount card** — kicker, value in `amount`, slate per-line ("per år, ved 50 % av gapet" / "engangsbeløp, …"), its own median-tick line, a separation note where needed.
- **Multiple field** — 90px numeric input with label "EV/EBIT-multippel"; empty by default.
- **Provenance drill-down** — opens inline under its amount: numbered steps, each calculation in a `surface` chip (tabular), register field names in monospace slate.
- **State block** — `surface` box, 4px `navy-700` left accent, kicker plus one or two sentences. Used for uncovered industry, not found, adjusted or widened group, rate limit.
- **Tag** — 11.5px, `input-border` outline; soft variant with `divider` outline and slate text.
- **Uncertain flag** — "? Usikker klassifisering", 11.5px/600. The mocks set it in `unfavourable`; `[ASSUMPTION]` this gives the direction colour a non-direction meaning and is unconfirmed.
- **AI marker (✦)** — the glyph ✦ in `slate` before the label of AI-produced content, never on a number. `[ASSUMPTION]` size and placement: not mocked.
- **Tooltip** — white, 1px `divider`, shadow, 5px radius; value (13px/600, tabular), name, slate subline. On the phone it opens above the plot with a leader line so it never covers the company marker.
- **Source line** — footer, 12.5px slate: "Data fra Brønnøysundregistrene, bearbeidet av Peerless · Kilder og lisens".

## Do's and Don'ts

| Do | Don't |
|---|---|
| Show every number with its context — median, beste fjerdedel or peer-gruppen samlet — or say why it has none | Show a bare figure with neither context nor a reason |
| Separate company, median and beste fjerdedel by shape | Rely on shade; dark signature vs median is 1.52:1 |
| Give direction an arrow or a word | Use colour alone, or any red or green |
| Keep `signature` for the company marker, outlined in light mode | Set text, fills or chrome in `signature` |
| Use `input-border` for anything the user types into | Use `divider` as an input boundary |
| Inter with tabular numerals in every column | Proportional digits in tables, axes or amounts |
| Put tables and charts in their own scroll container | Let the body scroll sideways at 375 |
| Draw the waterfall from peer-gruppen samlet, bars summing exactly | Scale the waterfall by the closable share or add it to profit uplift |
| Draw a gap in the data as a gap | Interpolate or estimate a missing value |
| Mark AI-written content with ✦ | Put ✦ on an engine figure |
| Let structure and data make it interesting | Decoration, gradients, celebratory animation, scores, badges |
