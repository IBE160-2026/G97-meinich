# Story 5.1: the labelled set

**Date:** 2026-10-30 to 2026-11-13
**Tool:** Claude Code (Opus 5.5, BMAD session), checked by Meinich's separate review session. The second round of the 720 pairs was filled in by a ChatGPT model (OpenAI, version not recorded).
**Story / issue:** #13, Story 5.1 (FR-70)
**Result:** branch `story/5.1-labelled-set`. PR: see the PR that links this file.

## Goal

Build the labelled set Story 5.2 measures peer selection against: 30 subjects in `62.100`, 30 candidates each drawn at random from the stages 1–3 pool, a blind subsample labelled from description and website only, and the counts reported as achieved. The rules and the rubric were committed before the draw and before Story 2.5 fixed the fingerprint's features.

## Commits

On `main` before the branch (the rules, the draw and the subjects):
- `737d089`: rules and rubric, 2026-10-30, before the draw and before Story 2.5.
- `2c21381`, `dbe2d0d`, `d631915`, `c0f10a0`: the draw script, its first step, the description scores and the second step. 30 subjects, 900 pairs.

On the branch:
- [`15e1010`](https://github.com/IBE160-2026/G97-meinich/commit/15e1010): the blind subsample, 180 of 180 pairs, labelled by Meinich (2026-11-01, before Story 2.5 started).
- [`7b0a54f`](https://github.com/IBE160-2026/G97-meinich/commit/7b0a54f): the 720 non-blind pairs, labelled by Meinich (first round).
- [`ead8f8a`](https://github.com/IBE160-2026/G97-meinich/commit/ead8f8a): the README records that the first round is stricter than the rubric.
- [`52794dd`](https://github.com/IBE160-2026/G97-meinich/commit/52794dd): the rubric stands; a second round, one revenue model per company, with the pair labels computed.
- [`c799ff1`](https://github.com/IBE160-2026/G97-meinich/commit/c799ff1): the second round, filled in by a ChatGPT model.
- [`3a7f322`](https://github.com/IBE160-2026/G97-meinich/commit/3a7f322), [`60ae244`](https://github.com/IBE160-2026/G97-meinich/commit/60ae244): the README says who filled in the second round, and that Meinich went through it before accepting it.
- [`e73a3c8`](https://github.com/IBE160-2026/G97-meinich/commit/e73a3c8): no second labeller or κ in v1, stated as a shortfall, with the counts achieved.
- [`fe34951`](https://github.com/IBE160-2026/G97-meinich/commit/fe34951), [`8a2a9b0`](https://github.com/IBE160-2026/G97-meinich/commit/8a2a9b0), [`f3cb055`](https://github.com/IBE160-2026/G97-meinich/commit/f3cb055): the PRD (FR-70, §10), `epics.md` (FR-70, Story 5.1) and the technical note say who labelled, and that κ is stage 2.

The counts are in [`analysis/labelled-set/README.md`](../../analysis/labelled-set/README.md), "Labelling record". In short: blind 180 pairs, 45 `ja`, 134 `nei`, 1 `usikker`; first round of the 720, 31 `ja`, 649 `nei`, 40 `usikker`; second round, 685 companies, 166 `ja`, 231 `nei`, 323 `usikker`.

## Prompts that mattered

- Meinich, for the PR (2026-11-13): "Merkingen er ferdig. De 180 blinde parene er merket av meg. De 720 andre har to runder: første runde merket av meg, strengere enn kriteriet, og beholdt som første runde. Andre runde er én forretningsmodell per selskap (685 selskaper), fylt ut av en ChatGPT-modell som jeg har gått gjennom og godtatt. Parene regnes ut."
- Meinich, on the second labeller: "Den andre merkeren og κ er ikke oppnådd i v1. Min beslutning: det tas i stage 2. Si det i README-en under \"Labelling record\" som en mangel, slik FR-70 krever."
- Meinich, on the label files: "Ikke åpne labels.csv, labels-blind.csv eller labels-revenue-model.csv. Det du trenger, står i README-en." This session took every count from the README and did not open the three files.

## What came back, and what was done with it

- **Found by the review session (2026-11-09), from the share of `ja`:** the first round of the 720 pairs gave 4.3 % `ja` (31 of 720) against 25 % (45 of 180) in the blind pairs; for informative subjects 31 of 90 blind against 10 of 360. An exact permutation test on `ja` per subject gave a one-sided p of about 0.0006, so the random assignment of blind subjects does not explain it. 12 of the 24 subjects had no `ja`, and `usikker` rose through the sheet (0, 8, 12, 20 per 180 rows).
- **Found by the review session, from the labeller's notes:** sector and wording were weighed. Where one description named a sector or a particular line of software and the other did not, the pair was `nei`, although the rubric says domain and technology do not count on their own.
- **Meinich's decisions:**
  - Keep the first round as it was labelled, in `labels.csv`, as the stricter reading. It is not the measure (`ead8f8a`).
  - Go back to the rubric: Meinich first decided to keep the specific labels as the measure, and changed that the same day. Sector is left out and the rubric stands, through a second round by revenue model per company (`52794dd`).
  - Accept the ChatGPT round. The review session had advised labelling by hand, because the set measures a Claude model's classification. It noticed the AI filling from the timing (685 rows in under 30 minutes) and the uniform notes, and Meinich confirmed it. Meinich went through the answers and accepted them on 2026-11-11, because of the time left and because the project is itself about using AI (`c799ff1`, `3a7f322`, `60ae244`). For the 720 pairs the measurement is therefore one AI's classification against another's; Story 5.2 states this.
  - No second labeller and no κ in v1; both are stage 2 (2026-11-13, `e73a3c8`).
- **Corrected by this session:** the README listed `kappa.csv` as a file, but it was never written; removed from the file list (`e73a3c8`). FR-70, Story 5.1, §10 of the PRD and the technical note said "hand-labelled" and promised κ; corrected in this PR.

## Links

- Issue [#13](https://github.com/IBE160-2026/G97-meinich/issues/13).
- Session log of the blind labelling: [`.logs/christian-meinich/997-2026-11-01-19-13-37-story-5-1-blindmerking.md`](../../.logs/christian-meinich/997-2026-11-01-19-13-37-story-5-1-blindmerking.md); the review session's log of the 720 pairs: [`.logs/christian-meinich/988-2026-11-13-20-08-13-story-2-6-review-og-fasitmerking.md`](../../.logs/christian-meinich/988-2026-11-13-20-08-13-story-2-6-review-og-fasitmerking.md).
- Planning documents: PRD FR-70 and §10, `.memlog.md`, `epics.md` (FR-70, Story 5.1), technical note ("What the measurement claims, and what it cannot").
