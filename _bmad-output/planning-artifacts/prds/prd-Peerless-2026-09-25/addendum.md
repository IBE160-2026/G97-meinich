# Addendum — Peerless PRD

Depth that came up during PRD discovery and belongs downstream rather than in the PRD. **Per `AGENTS.md`, the four hand-written documents are authoritative — so this file points into them and does not restate them.** If something here contradicts one of those documents, that document wins.

## For architecture (already decided, recorded elsewhere)

Everything architectural surfaced in discovery is already in `technical-note-architecture.md`. Rather than copy it:

| Topic | Where it lives |
|---|---|
| Five-stage funnel, stage by stage | Technical note, "Peer group" |
| Fingerprint feature list and banding | Technical note, funnel stage 4 |
| Reconciliation rules and their rationale | Technical note, "Document extraction"; `docs/data-sources-brreg.md` |
| Access model, RLS, the `is_anonymous` trap | Technical note, "Access control"; `docs/ai-log.md` 2026-09-23 |
| Thirteen-week schedule | Technical note, "Schedule" |
| Every key figure formula and kroner translation | `docs/key-figures.md` |
| Industry screening evidence and dispersion | `analysis/output/industry-screening.md` |

## For UX (`bmad-ux` should start here)

Design problems the PRD states as requirements but does not solve:

- **The empty row.** A key figure below the 10-peer floor (FR-22) must say something useful rather than showing a gap. Copy and layout undecided — and it will happen often, because 12 of the 15 formulas depend on OCR.
- **Subordinating cost shares to operating margin.** FR-30 forbids summing them. The layout has to make that visually obvious enough that nobody reaches for a calculator and adds them anyway.
- **Funnel counts at phone width.** Five stage counts plus a peer list plus a four-column ratio table plus a distribution plot, at 375px (FR-55, FR-56).
- **Three match-basis tiers** (FR-16) need a visual hierarchy that reads as confidence without implying a score.
- **Unaudited labelling** (FR-33) has to survive PDF export and stay legible without dominating.
- **The closable-share control** drives three outputs at once (FR-31). What updates, and how visibly, is a design decision.

## Rejected alternatives worth remembering

- **Lazy on-demand document extraction** — the original design. Not viable once extraction means OCR, at seconds to tens of seconds per filing. Pre-warming per industry replaced it, and that is what bounds coverage to a few industries rather than the register.
- **The paid multi-year bulk accounts subscription** (around NOK 480 000/year) — ruled out on cost. Multi-year history therefore comes from OCR of filed documents. This is why the OCR pipeline exists at all.
- **Three fixed roles** (owner / adviser / viewer) — replaced by workspaces with owner/viewer membership. An adviser became a user with many workspaces, which removed a role without removing a capability.
- **Closed access, login on every route** — replaced by anonymous sign-in with the account wall at persistence. `docs/ai-log.md` records what this cost: the `is_anonymous` policy requirement and rate limiting.
- **Difference-attack protection** — dropped deliberately, not overlooked. It protected nothing: aggregates come only from public filings, peers are shown by name, and anonymous access makes per-user query tracking impossible. Reasoning in `docs/ai-log.md`, 2026-09-23. The 10-peer floor survives as a quality threshold.
- **Employee count from Enhetsregisteret** for `aarsverk` — rejected because it is today's figure, not the accounting year's. FTEs come from the notes instead, accepting OCR dependency to get the right period.
- **EBITDA as the valuation basis** — rejected for EBIT, because `driftsresultat` is API-sourced for every company while EBITDA needs OCR'd depreciation. Keeps the headline valuation figure OCR-free.

## Landscape research

`research-landscape.md` in this folder. Two findings bear on positioning:

- No Norwegian product found assembles a matched peer group *and* converts deviations to kroner, self-serve, for the company itself. Incumbents (D&B/Bisnode, Experian, Creditsafe, Proff Forvalt) all lead with credit-risk framing; Proff Forvalt's comparison uses manual selection or industry-code averages. Enin has the most sophisticated matching found, but it is enterprise, sales-gated, and aimed at credit and fraud analysts.
- **Treat the pricing figures in that report as unverified.** They came from web research, not from your own testing. The NOK 480 000/year subscription figure is corroborated by `docs/data-sources-brreg.md`; the rest is not, and none of it should reach a graded document without checking.

## Course-context note

Resolved 2026-09-26: the course requires no fixed user roles and nothing before coding, only that BMAD requirements are met. The product brief is due 2026-09-27. The workspace owner/viewer model stands.
