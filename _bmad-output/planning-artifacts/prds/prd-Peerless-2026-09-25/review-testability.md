---
title: PRD testability and consistency review
target: prd-Peerless-2026-09-25/prd.md
reviewed: 2026-09-29
reviewer: audit pass (read-only)
verdict: not yet safe to break into stories — 2 blockers, 6 high
---

# Review: can FR-1..FR-67 be built and tested from?

Read-only audit of `prd.md` (958 lines, 67 FRs). Nothing in the PRD or any other
project file was changed. Findings are ordered by severity, then by area.
Severity means consequence: **Blocker** = a story written from this will be built
twice or built wrong; **High** = a test cannot be written, or the arithmetic/money
or authorisation model is at risk; **Medium** = a story can be closed on a
reading the author did not intend; **Low** = traceability or editorial.

Counts: **2 Blocker · 6 High · 17 Medium · 12 Low = 37 findings.**

---

## 1. Contradictions between requirements

### F1 — Blocker — An anonymous session must both persist work and be forbidden from writing it
**FRs:** FR-40, FR-47, FR-42, FR-17/FR-18/FR-5, §3 glossary, UJ-1, UJ-2

FR-40's only consequence:

> "An analysis built anonymously is still reachable after registration, without being rebuilt."

UJ-1 makes this concrete: Kari, with no account, *excludes two peers* (FR-17) and
then "signs in with a magic link and **keeps the analysis she already built**".
UJ-2 is the same shape. But FR-47 says:

> "Every policy on saved or user-entered data requires `is_anonymous` to be false in the JWT"

and its consequence asserts a test in which "an anonymous attacker attempting to
read and to **write** saved data" is rejected. FR-42 puts "saved analyses and
history" behind the account wall. The glossary is stricter still: an anonymous
session "**May read public figures and nothing else.**" FR-5 reinforces the
posture — "For an anonymous session the description is used for that analysis and
**not stored**".

A peer exclusion is user-entered data. So either:
- it is stored server-side for an anonymous `auth.uid()` — and FR-47's test, as
  worded, fails; or
- it is not stored — and FR-40 and UJ-1's resolution are unimplementable; or
- it lives in the browser — forbidden by `AGENTS.md` ("Do not use browser storage
  for anything that matters") and unrecoverable after a magic-link round trip,
  which lands the user in a new tab from their mail client.

**Why it blocks:** two stories ("anonymous adjustments survive registration" and
"anonymous session cannot write saved data") cannot both pass. This is an
authorisation boundary, so guessing here is the expensive kind of guess.
**What the PRD has to decide:** name a third data class — *session-scoped
analysis state*, writable by an anonymous `auth.uid()`, keyed to it, never
readable by another uid, distinct from "saved data" — and restate FR-47 as
applying to workspace-scoped rows only. Then FR-47's test becomes assertable
("an anonymous uid cannot read or write any row in `workspaces`, `workspace_members`,
`saved_analyses`, `unfiled_figures`") and FR-40's becomes assertable ("the
session-state row's uid is unchanged after conversion").

### F2 — Blocker — Explanatory text forces a request-time model call the PRD says cannot exist
**FRs:** FR-52, FR-19, FR-20, FR-5, §7, §8, UJ-1

FR-52: "Text is cached per company **and peer group** rather than generated per
visit." FR-17/FR-18/FR-19 let the user change the peer group, and FR-19 requires
that "any change ... recomputes every key figure, aggregate, percentile and
kroner amount immediately". UJ-1 walks exactly this: exclude two resellers, then
"reads the written explanation of them (FR-52)".

A user-adjusted peer group is a fresh cache key, so the text must be generated
inside that request. But FR-20 states absolutely:

> "The only request-time model call is classifying a user-entered subject description (FR-5)."

FR-5 says the same from the other side: "This is the **one** model call a user
request can trigger." §7 repeats it verbatim as an NFR, and §8 rests the cost
guardrail on it ("explanation text is cached per company and peer group rather
than generated per visit").

Worse, UJ-1 does this **anonymously**: an open-route, uncached model generation
is the precise cost and abuse vector FR-6 exists to close.

Note also that FR-19's recompute list **omits generated text**, so the literal
reading is that the explanation goes stale beside recomputed numbers — which
would put figures in the text that are no longer in the engine's current output
and trip FR-53/SM-4.

**Why it blocks:** the latency NFR, the cost guardrail, the open-route abuse
guardrail and the UJ-1 happy path cannot all be satisfied by one design.
**Decide:** either (a) explanation is generated only for the *system-proposed*
group and an adjusted group shows numbers with no text (say so in FR-19 and
FR-52, and fix UJ-1's path); or (b) explanation is account-gated and generated
asynchronously, which means adding it to FR-42's gated list and giving FR-52 a
"not yet ready" state; or (c) FR-20/FR-5/§7 admit a second request-time model
call with its own latency and rate-limit budget.

### F3 — High — Subject classification cannot be both inside assembly and outside the latency budget
**FRs:** FR-5, FR-11, FR-20

FR-5 lets a user supply a description that "takes precedence over the register's
own **for classification of the subject**". Stage 5 (FR-11) judges "whether a
candidate is the same type of business" — i.e. the same type as the subject, so
the subject's category is a necessary input to assembly. Yet FR-20's consequences
say "Assembly reads stored key figures and profiles **only**" and the whole FR is
"Peer group assembly returns in under one second".

A model call sits inside the assembly path on first use of a new description, and
no model call has a guaranteed sub-second latency. SM-5 asserts the second.

**Assertion needed:** state whether the description-driven reclassification
re-runs the funnel (then FR-20's budget must exclude the cold-cache case and say
what the user sees while it runs) or only annotates the subject (then FR-5's
"takes precedence for classification" is misleading and stage 5 does not see it).

### F4 — High — Below the minimum group size, FR-24 hides the row FR-22 requires to persist
**FRs:** FR-22, FR-24, §11 Q8

FR-24: "A key figure **is shown only if** it can be computed for the subject and
for at least the minimum group size of peers from the same source."
FR-22: "Below the floor **the row persists and still shows the subject's own
value**; where the median, favourable quartile and percentile would be, the
figure states how many comparable values exist against the ten required."

These are opposite user-visible behaviours for the same state. §11 Q8 records the
FR-22 behaviour as the *resolved* decision, so FR-24 is the stale text — but a
story writer reading §4.3 top-to-bottom hits FR-24 second and will implement it.
UJ-1's edge case depends on FR-22's reading.

**Fix direction:** FR-24 is about *source parity*, not about the floor. Restate it
as "a figure's aggregate is computed only from peers whose value comes from the
same source as the subject's" and delete the "is shown only if" framing, which
duplicates FR-22 badly.

### F5 — High — FR-24 also makes every unfiled figure incomparable
**FRs:** FR-24, FR-35, FR-38, FR-67, UJ-4

FR-24 requires subject and peers to be "**from the same source**", and the
glossary fixes three sources: API-sourced, OCR-sourced and unfiled/user-entered
("never merged with filed figures"). A user-entered operating margin is therefore
never "the same source" as a peer's API-sourced one, and under FR-24 nothing in
UJ-4 may be displayed against a peer aggregate — yet FR-35 requires exactly that
("compared against the peers' latest filed year"), FR-67 shows "the peers' latest
full year ... as context", and UJ-4's climax prints a peer median.

**Assertion needed:** FR-24 must say it governs filed sources only, and FR-33/
FR-67's labelling is what handles the unfiled case.

### F6 — High — "Working capital released" double counts receivables, and FR-30's test cannot catch it
**FRs:** FR-30, FR-29, FR-31, §3 glossary; `docs/key-figures.md` §"From gap to kroner"

The glossary defines working capital released as "the kroner value of the
**receivable-days, payable-days and operating-asset-turnover** gaps", and FR-31
treats it as one recomputing total. From `docs/key-figures.md`:

- Receivable days (9): `(r − T) / 365 × salgsinntekt × s`
- Operating asset turnover (11): `((sumEiendeler − bankinnskudd) − sumDriftsinntekter / T) × s`

`sumEiendeler − bankinnskudd` **contains `kundefordringer`**. Summing (9) and (11)
counts the receivables opportunity twice — the same error FR-30 was written to
prevent, one cluster over. FR-30's automated test is scoped to the profit cluster
only:

> "no total presented to the user, or contained in an export, sums more than one of
> {operating margin, cost of goods share, personnel cost share, other operating cost share}"

so it passes while the working-capital total is wrong. `docs/key-figures.md` has
the same hole: its no-adding rule is stated for cost shares (3–5) only.

**Why it is High:** money correctness is the graded artefact, and this error is
invisible — it makes the headline number bigger, which is the direction nobody
questions. Per `AGENTS.md`, a change here belongs in `docs/key-figures.md` and the
PRD in the same commit.
**Assertion needed:** FR-30 extended to a second forbidden set — either
{receivable days, operating asset turnover} never summed, or (11) redefined on a
receivables-excluded asset base — plus a test on the *working capital released*
total specifically, not only on the profit total.

### F7 — High — FR-18 (loosen a criterion) contradicts FR-8's hard exclusion and has no consequences
**FRs:** FR-18, FR-8, §11 Q13

FR-18 is one sentence: "The user can widen a criterion when the group is too
small." It has no consequences at all. FR-8's consequences are absolute:

> "A candidate failing any comparability field cannot appear in the peer group **by any later stage**."
> "Only calendar-year filings pass."

If a "criterion" includes any comparability field, FR-18 and FR-8 cannot both
hold. If it does not, FR-18 never says what *is* loosenable (size band?
geography? the fingerprint bucket? the stage-5 category?), which makes it
unimplementable and untestable — and §11 Q13 ("which comparability criteria are
hard exclusions rather than flags") is still listed **open**, so the PRD asserts
in FR-8 a decision it records as unmade.

**Assertion needed:** an enumerated list of loosenable criteria with their widened
values, plus a consequence that loosening never re-admits a candidate excluded by
FR-8, and that the funnel counts (FR-15) and match basis (FR-16) both update.

### F8 — High — A covered-industry company with a non-calendar year is promised an analysis it cannot get
**FRs:** FR-1, FR-8, FR-3, FR-4, §7

FR-1: "A valid organisation number for a company in a covered industry returns a
**complete analysis**." FR-8: "Only calendar-year filings pass" — and the
glossary's comparability filter requires subject and candidate to match on
"financial period", which is subject-relative, not calendar-absolute. The two
statements are not the same rule.

A subject in `62.100` with a 1 July–30 June year therefore gets zero peers, and no
FR states what it is shown: FR-4 covers *uncovered industries* only. §7 meanwhile
requires the engine to be tested on "non-calendar financial years", so the case is
known to exist. This is the same class of honesty boundary FR-4 was written for,
and it has no requirement.

**Assertion needed:** either FR-8 drops "only calendar-year filings pass" in favour
of "the candidate's financial period must equal the subject's", or a new FR gives
the non-calendar subject the FR-4 treatment (own figures plus a plain statement).

### F9 — Medium-High — Size banding implicitly bands a benchmarked productivity measure
**FRs:** FR-13, FR-7, FR-9, §6.1, §11 Q12

FR-13's first consequence: "Selection uses **no** margin, return or productivity
measure at all", with cost of goods share and personnel cost share named as the
only two banded exceptions. But FR-7 selects on a "size band", FR-9 segments by
"size", and §6.1 scopes each industry to "companies with five or more employees".
Revenue per FTE (key figure 7) is a **benchmarked productivity measure**; banding
revenue and constraining FTE together constrains it. FR-9 has no consequences at
all, so "size" is never defined as revenue, assets, FTE or a pair.

**Why it matters:** SM-1 is the project's central result. If selection quietly
compresses key figure 7, the reported gap on it is an artefact, and FR-13's own
spread test would not look at it because 7 is not on the banded list.
**Assertion needed:** define the size measure in FR-9's consequences; if it is
revenue *and* FTE, add revenue per FTE to FR-13's banded list so it gets the
within-band spread test.

### F10 — Medium — FR-35 is the pre-FR-67 requirement and now contradicts it
**FRs:** FR-35, FR-67, UJ-4

FR-35 (no consequences): "Unfiled current-year figures **are compared against the
peers' latest filed year**, with the difference in periods stated." FR-67 demotes
that to context: "**The primary comparison is the company against its own same
period last year**" and the peers' full year is "shown as context only, labelled
*hele år, ikke samme periode*". Where the prior-year period is missing, FR-67
requires "**no primary comparison**" — which FR-35 would fill with the peer year.

A story written from FR-35 builds the thing FR-67 forbids. Either fold FR-35 into
FR-67 or restate it as the context-only rule.

### F11 — Medium — FR-38 guarantees two ratios that FR-67 cannot honestly produce
**FRs:** FR-38, FR-67, FR-23

FR-38: "The four required components **guarantee** a provisional position on
operating margin, return on assets and equity ratio." For a seven-month entry
(FR-67), return on assets is a seven-month `driftsresultat` over a point-in-time
`sumEiendeler` — meaningful only if annualised, which FR-67 forbids outright
("**Nothing is annualised or scaled to a full year**"). Equity ratio is a balance
ratio and is fine. UJ-4's climax shows operating margin only, quietly agreeing
with this critique.

**Assertion needed:** FR-38 must say which of the three are shown for a
part-period entry, and FR-67 must state that flow-over-stock ratios are withheld
for partial periods rather than computed on mismatched bases.

### F12 — Medium — Two definitions of "front page", in a document that fixes vocabulary
**FRs:** FR-61, FR-63, FR-42, §3, §4.11, §6.2

§3 promises vocabulary is "used verbatim everywhere after", then defines
**Front page** as "the entry page: a description, the organisation-number field,
and industry overviews (FR-61)" and **Portfolio** as "a signed-in user's front
page (FR-63)". FR-61 says "**The** front page describes Peerless, holds the
organisation-number field..."; §4.11 says a signed-in adviser "lands on their own
portfolio rather than an empty search field".

Unanswered, and each answer is a different story: at `/`, does a signed-in user
see the org-number field and the industry overviews at all? FR-42 lists "the front
page and industry overviews" as open to anyone, and SM-8 asserts an analysis needs
nothing but an organisation number — which implies the field is always present.
§6.2's cut order removes FR-63 then FR-61, so both may be gone.

**Assertion needed:** one route, one name, and an explicit statement of whether the
portfolio replaces or precedes the lookup field.

### F13 — Medium — FR-42's account wall omits the explanatory text, and FR-62's tabs omit the decomposition views
**FRs:** FR-42, FR-52, FR-26, FR-62

FR-42 reads as two exhaustive lists ("Open to anyone: ... An account is required
for: ..."). Generated explanation (FR-52) appears in neither, yet UJ-1 reads it
while anonymous — which is also what makes F2 a cost problem. Separately, FR-62
enumerates the tabs as "overview, peers, key figures and gaps, development over
time, and value": the decomposition views (FR-26) have no home in that structure,
though FR-26 exists and is account-gated, and FR-62's consequence is precisely
about gated tabs being visible-but-closed.

### F14 — Medium — Two FRs decide questions §11 still lists as open
**FRs:** FR-13 vs §11 Q12; FR-8 vs §11 Q13

Q12: "whether personnel cost share enters selection at all, in bands, or not"
is listed under *Gated on measurement*, while FR-13 already requires it to enter
in bands **and** requires a test on the result. Q13 is the FR-8 case in F7. A
downstream epic cannot tell whether it is implementing a decision or pre-empting
one. Either the questions move to *Answered* with the FR as the answer, or the FRs
are marked provisional.

### F15 — Medium — FR-11 never says what happens when the model says "no"
**FRs:** FR-11, FR-12, FR-14, FR-16, §11 Q13

FR-11's consequences constrain only the model's output *format* ("answers only
with a fixed category", "performs no arithmetic"). Nothing states the effect of a
negative classification: is the candidate excluded, or flagged and kept at match
basis *accounts alone* (FR-16)? FR-12 keeps *unclassified* companies eligible and
FR-14 flags *disagreements*, which together imply a classified-negative is
dropped — but that is inference, and it is the single highest-leverage behaviour in
the funnel for SM-1. §11 Q13 asks the same thing and leaves it open.

---

## 2. Untestable "Consequences (testable)"

Each quote is a bullet sitting under a heading that promises testability.

| # | FR | Quote | Why no test can assert it | Assertion it would have to become | Sev |
|---|---|---|---|---|---|
| F16 | FR-13 | "the within-band spread of a banded figure is **non-trivial** — i.e. the gap has not been driven to zero by construction" | "non-trivial" has no value. Any spread > 0 passes; that is not the intent. | A numeric floor, e.g. "within-band interquartile range of cost of goods share ≥ X percentage points on the labelled set", or "≥ Y % of the unbanded population spread". | High |
| F17 | FR-3 | "An industry is offered only once its filings are extracted and reconciled **and** its peer selection has been measured against a labelled set for that industry" | Nothing machine-readable records "has been measured". A test cannot read an intention. | A coverage registry row per industry with `extraction_complete`, `reconciliation_pass_rate`, `measurement_artifact_ref`, and an assertion that the lookup route refuses any industry whose row is incomplete. | High |
| F18 | FR-59 | "A covered industry is **fully pre-warmed** before it is offered" | "fully" undefined — every company? every year? every figure? | "For every company in the covered industry's candidate set, a stored filing exists for the benchmark year with a data quality flag set (FR-57)"; same registry gate as F17. | Medium |
| F19 | FR-22 | "Synthetic cohorts **at and below 10** assert that no aggregate escapes" | Off by one against the FR itself: "at least 10 peers" means at exactly 10 the aggregate **must** appear. The stated test would fail correct behaviour. | "Cohorts of 9 show no aggregate; cohorts of 10 and 11 show one." | Medium |
| F20 | FR-27 | "Percentile is `(peers worse + 0.5 × peers equal) / peers × 100`" | `peers` is ambiguous: all peers, or peers with a defined value for that figure? FR-23 excludes undefined ones from the distribution, so the two readings give different numbers. | Denominator stated as "peers with a defined value for that figure", matching FR-22's per-figure count. | Medium |
| F21 | FR-21 | "a formula changes in the document and in the code in the same commit" | A process rule about commits, not a property of the system. | A CI check: a manifest of formula definitions derived from `docs/key-figures.md` compared against the engine's registry; the build fails on divergence. | Medium |
| F22 | FR-19 | "no **stale value anywhere on screen**" | Unbounded scope; no test can enumerate "anywhere". | An enumerated set of recomputed outputs (per-figure subject value, median, quartile, percentile, excluded count, each kroner amount, each total) asserted against a fresh engine run after an exclusion — and an explicit decision about the explanation text (F2). | Medium |
| F23 | FR-45 | "no endpoint's safety depends on remembering a `where` clause" | A claim about code style, not behaviour. | "For every table in the user-scoped schema: RLS enabled, at least one policy, and the authorisation suite runs through the anon/authenticated key with no service-role credential available." | Medium |
| F24 | FR-30 | "presented as a subordinate breakdown of the operating margin amount, never as independent opportunities that could be added up" | Presentation intent. The sibling bullet is testable; this one is not. | A structural assertion: cost-share amounts render only within the operating-margin group's container, and no sum/total element exists over them. | Medium |
| F25 | FR-55 | "**Checked at phone width during development, not at the end.**" | A working practice. Nothing to assert. | Delete, or convert into the CI gate that backs SM-7 (viewport 375/768/1280, assert `document.scrollingElement.scrollWidth <= clientWidth`) so the check runs per commit. | Medium |
| F26 | FR-53 | "Once that test exists **it is never weakened**." | Meta-rule about future edits. | Either drop it (it belongs in `AGENTS.md`, where it already is) or make it a CI rule: the test file's assertion count/skip list is itself asserted. | Low |
| F27 | FR-65 | "it is **reachable from every page and is not hidden**" | "Not hidden" is unassertable; "reachable from every page" is. | "A link to the credit is present in the footer of every route, including the export"; drop "not hidden" or define it (visible without interaction, contrast ratio ≥ X). | Low |
| F28 | FR-64 | "The product **makes no freshness guarantee**." | An absence cannot be asserted. | Keep as rationale prose, outside the testable list; the two bullets above it are the real tests. | Low |
| F29 | FR-10 | "A reseller, a product company and a consultancy separate here even when all three describe themselves as 'Programvareutvikling'" | Testable only against named fixtures, which do not exist yet. | "For the labelled fixture set F (n ≥ 3 per archetype), no two archetypes share a fingerprint bucket." Needs the fixture set to be a named deliverable. | Medium |
| F30 | FR-16 | "the product says so **rather than presenting a guess as a judgement**" | Second half is rhetoric. | "Where `match_basis = 'industry and size alone'`, the rendered row contains the corresponding fixed string and no inclusion-reason sentence referencing description fields." | Low |
| F31 | FR-37 | "Aggregate queries read only tables holding filed accounts, **so leaking ... would require changing the query rather than forgetting a filter**" | The clause after "so" is a rationale. | "The aggregate query's FROM/JOIN list contains no table that can hold unfiled figures" — schema-level assertion, plus a fixture where an unfiled row exists and the median is unchanged. | Low |

---

## 3. Requirements with no consequences at all

Twelve FRs have no "Consequences (testable)" block: **FR-9, FR-14, FR-17, FR-18,
FR-35, FR-36, FR-39, FR-46, FR-49, FR-50, FR-54, FR-56.** Four are harmless
(FR-39 and FR-56 are single assertions already, FR-49 is one sentence with an
obvious test, FR-17 likewise). The rest are consequential:

| # | FR | Why it needs consequences | Sev |
|---|---|---|---|
| F32 | FR-9 | "Candidates are segmented by size, legal form, and geography **where the industry calls for it**." Three undefined terms: what measure is size (see F9), which legal forms are admissible (AS only?), and what "where the industry calls for it" resolves to for `62.100` and `69.202`. Nothing is buildable from this, and it feeds SM-1's per-layer ablation. | High |
| F33 | FR-14 | "Where the text and the fingerprint disagree ... the candidate is **flagged** rather than resolved by either signal." Unstated: is a flagged candidate in the group or out, what match basis does it carry (FR-16 has only three tiers and none of them is "conflicted"), and is the flag shown to the user? | Medium |
| F34 | FR-46 | "Removing a member revokes access **immediately**, because every policy goes through membership." Two gaps: no FR provides the *remove a member* action (FR-44 provides invite only — see F44), and with Supabase JWTs "immediately" is exactly the thing that is not free: a live access token keeps its claims until refresh. Needs a bound ("the next request after removal is rejected" vs "within the token TTL") and a test in the SM-3 suite. | High |
| F35 | FR-50 | "A saved analysis accumulates history." Undefined: what constitutes a history entry, when one is written (per save? per new filing? per recompute?), what it stores, and how it interacts with FR-64 ("a saved analysis shows the read date it was computed from, never today's") and FR-36 (unfiled entries "kept only as history" — the same word for a different thing). | Medium |
| F36 | FR-54 | "Generated text describes what the figures show and **does not prescribe action**." This is a model-safety requirement with no enforcement mechanism at all, in a PRD that enforces its sibling rule (FR-53) by test. | Medium |
| F37 | FR-36 | "When the filing for the same year arrives it takes precedence." Silent on the trigger (ingestion job, per FR-66's pattern?), on whether a stored analysis recomputes or is marked superseded, and on whether the owner is told. FR-19-style recompute is not stated. | Medium |

---

## 4. Journey references (UJ tags)

Section 2.3 holds UJ-1 (Kari, anonymous, laptop, 62.100), UJ-2 (Anders, adviser,
prospect, 69.202), UJ-3 (Solveig, invited viewer), UJ-4 (Tore, signed-in owner,
year-to-date). 26 `Realises` tags exist. The renumbering left visible damage.

### Tags pointing at a journey that never touches the requirement

| # | FR | Tag | Why it is wrong | Sev |
|---|---|---|---|---|
| F38 | FR-26 (and §4.3 by inheritance) | "Realises UJ-1" | UJ-1 never opens a decomposition view — her path is funnel counts → inclusion reasons → exclusions → largest kroner gaps → explanation → export. Worse, FR-26's own consequence is "**Both decomposition views need an account (FR-42)**", and UJ-1 is anonymous until the final beat, after the analysis is done. The tag points at the one journey that structurally cannot reach it. Candidate correct home: a signed-in journey; none of the four walks it, so this is also an orphan (F45). | Medium |
| F39 | FR-34 | "Realises UJ-4 (edge)" | UJ-4's stated edge case is "He has no figures for the same period last year" — that is FR-67, which is correctly tagged. FR-34 is about *who may read* unfiled figures (owner writes, viewers read, anonymous never). UJ-4 has no viewer and no anonymous session in it. The content belongs to UJ-3 (the viewer journey) — this looks exactly like an off-by-one from the renumbering. | Medium |
| F40 | FR-55 and §4.9 | "Realises UJ-1" | UJ-1's entry state says "No account, **laptop**, arrived from a search". No journey in §2.3 is on a phone, so the responsive requirement — a stated course requirement with its own metric (SM-7) — has no journey behind it. Either UJ-3's entry ("An email invitation") is made explicitly mobile, or the tag goes. | Medium |
| F41 | FR-17, FR-19 | "Realises UJ-1 (**edge**)" | Both sit on UJ-1's **main path**: "she excludes them (FR-16, FR-17, FR-19)" is in the Path line. UJ-1's edge case is FR-22. Mis-tiering matters because downstream epics deprioritise edge work; peer adjustment is the feature §4.2 calls "the feature the product lives or dies on". | Medium |
| F42 | FR-15 | "Realises UJ-1, UJ-2" | Correct for UJ-1 ("she reads the funnel counts"). For UJ-2 the path says only "reads the peer group and judges it himself" — counts are never mentioned. Either weaken the tag or add the counts to UJ-2's path. | Low |

### Requirements a journey clearly depends on but does not cite, or whose tag is missing

| # | FR | Journey that depends on it | Sev |
|---|---|---|---|
| F43 | **FR-51** | UJ-1's resolution is literally "She wants it as a **PDF** for the board" — yet it cites FR-40, FR-42, FR-49 and **not FR-51**, and FR-51 carries no `Realises` tag. The one journey that motivates PDF export does not reference the export requirement. | Medium |
| F44 | FR-16 | Cited by name in UJ-1's path, but FR-16 itself carries no tag. It is also the whole basis of UJ-2's "judges it himself", uncited there. | Medium |
| F45 | FR-60 | UJ-3's climax: "can trace any kroner amount back to the filed accounts (FR-60)". FR-60 has no tag. | Low |
| F46 | FR-41 | UJ-1 and UJ-3 both "sign in with a magic link"; FR-41 has no tag. | Low |
| F47 | FR-43, FR-44 | UJ-2's resolution cites both; FR-43 has no tag and FR-44 is tagged UJ-3 only. | Low |
| F48 | FR-49, FR-52 | Both cited in UJ-1; neither carries a tag. | Low |
| F49 | FR-2, FR-3 | UJ-1 and UJ-2 both begin "the company is identified"; UJ-2's edge depends on the FR-3 gate while only FR-4 is tagged. | Low |
| F50 | FR-38 | UJ-4 is entirely about entering figures; FR-38 has no tag (FR-67 does). | Low |

---

## 5. Orphans and gaps

### Capabilities the journeys or §6 assume that no FR provides

| # | Gap | Evidence | Sev |
|---|---|---|---|
| F51 | **No FR creates a workspace.** | Only the glossary mentions it ("Owner — **creates a workspace**"). FR-43 describes what a workspace *is*, FR-44 invites into one, FR-49 saves into one. UJ-1 and UJ-2 both need one to exist the moment they sign in, and FR-40 promises the anonymous analysis survives — into what? No FR says a workspace is created on registration, or on first save, or names the default. | High |
| F52 | **No FR defines "following" or "favourites".** | FR-42 gates "**favourites**"; FR-63 lists "every company they **follow**"; §3 defines Portfolio the same way. Two words for one undefined mechanism, and FR-63's consequence "nothing is computed for companies the user does not follow" cannot be tested without it. | Medium |
| F53 | **No FR removes a workspace member.** | FR-46 asserts the *consequence* of removal; nothing grants the action, sets who may perform it (owner only?), or covers a viewer leaving. SM-3's suite does not include revocation either (F58). | Medium |
| F54 | **No FR requires the Norwegian interface.** | §6.1 ("a responsive, **Norwegian-language** interface"), §11 Q2 (answered: bokmål) and `AGENTS.md` all require it; §4.9 has FR-55 and FR-56 and no language requirement. Nothing testable, and it is a course-visible property. | Medium |
| F55 | **Embeddings appear in the metrics with no FR behind them.** | SM-1 reports "**per funnel layer** — industry code and size alone, then adding the fingerprint, then **embeddings**, then model classification", and §10 says "If embeddings do not measurably beat model classification, classification stays." The funnel in §4.2 has five stages and none is embeddings. Either SM-1 over-specifies a layer that does not exist, or a stage is missing from §4.2 — and SM-1 is the project's primary result, so this must not be ambiguous. | Medium |
| F56 | **No mechanism marks an industry covered.** | The other half of F17: FR-3 gates on a state nothing produces. | Medium |
| F57 | **No FR states what a company outside the ordinary accounting layout sees.** | §2.2 names "Banks, insurers and entities outside the ordinary accounting layout" as non-users. FR-4 covers uncovered *industries*; FR-58 withholds *figures*. The combination of FR-1's "complete analysis" promise and FR-58's withholding leaves the user-visible outcome unstated. Related to F8. | Low |

### FRs nothing references and no journey needs

FR-5 is the most notable: it carries no journey tag, **no journey walks it** (no
protagonist types a description), and it is absent from §6.1's in-scope list —
yet it is the single request-time model call the whole latency and cost argument
in §7 and §8 is built around (F3, F2). Either a journey gains the beat, or FR-5
should be reconsidered: it buys one contested model call on the open route for a
capability no journey wants. **F58 — Medium.**

Uncited anywhere in the document (no journey, no SM, no sibling FR): **FR-2,
FR-18, FR-24, FR-25, FR-30, FR-35, FR-39, FR-41, FR-46, FR-48, FR-50, FR-51,
FR-54, FR-62, FR-66.** Most are fine as leaf requirements; FR-18, FR-24, FR-30
and FR-35 are covered above as contradictions, and FR-51/FR-46/FR-50/FR-54 above
as gaps. **F59 — Low** for the remainder.

### Success-metric coverage gaps

| # | Gap | Sev |
|---|---|---|
| F60 | **No metric covers the money arithmetic beyond two identities.** SM-6 validates FR-21 and FR-23. Nothing validates FR-29, FR-30, FR-31 or FR-32 — the double-counting rule that §4.4 calls the place "where a double-counting error would be most damaging and least visible" has no success metric, which is how F6 survived. | High |
| F61 | **SM-3 omits FR-44 and FR-46.** The suite text in §7 covers "an invited viewer reaching a workspace they were not invited to" (FR-44) but SM-3's Validates list is FR-34, FR-45, FR-47 only, and revocation (FR-46) appears in neither. | Medium |
| F62 | **SM-1 over-claims.** "Validates FR-7 to FR-16" sweeps in FR-15 (visible funnel counts) and FR-16 (inclusion reason wording), neither of which precision and recall measure. | Low |
| F63 | No metric covers FR-6 (rate limiting), FR-48 (audit log), FR-64/FR-65 (disclosure and licence) or FR-66 (withdrawal). All are testable as written; only the metric mapping is missing. | Low |

---

## 6. Numbering integrity

**Verified mechanically:** 67 `#### FR-n:` headings, **no duplicates, none missing
from 1–67**. FR-67 sits at the end of §4.5 rather than in numeric sequence, which
is exactly what §0's rule requires ("a requirement added later sits at the end of
its section out of numeric order"). §4.10's FR-64/65/66 before §4.11's FR-61/62/63
is the same pattern and is fine.

| # | Finding | Sev |
|---|---|---|
| F64 | **§4's opening line is stale.** Line 174: "Requirements are numbered globally **FR-1 to FR-63**." §0 correctly says FR-1 to FR-67. A reader who trusts §4 will treat FR-64–FR-67 as out-of-band. | Medium |

No other range statement is wrong: §3's "14 numbered measures ... plus the
unnumbered cash share" matches `docs/key-figures.md` (1–14 plus cash share), and
§8's "twelve of the fifteen key figures are recovered from those documents by OCR"
reconciles with FR-21's "three of the 14 are API-only" (15 − 3 = 12).

---

## 7. Recommended order of repair

1. **F1** and **F2** first — both are design decisions, not wording, and every
   epic in §4.6 and §4.8 depends on the answer.
2. **F6** with `docs/key-figures.md` in the same commit (`AGENTS.md` rule), plus
   **F60** so a metric exists that would have caught it.
3. **F4/F5** — rewrite FR-24 as a source-parity rule; it currently contradicts two
   resolved decisions.
4. **F7/F8/F9/F32** — the funnel's three under-specified rules (FR-9, FR-18, and
   FR-8's calendar clause). These block the SM-1 ablation, which is the graded
   result.
5. **F14/F15** — reconcile FR-8/FR-11/FR-13 against §11 Q12 and Q13 so it is clear
   which decisions are made.
6. **F38–F41** journey tags, **F51–F55** missing capabilities, then the rest.

Nothing above changes what the product does. Every finding is either a statement
the PRD makes twice in incompatible ways, a bullet that cannot be turned into an
assertion, or a capability the document uses without defining.
