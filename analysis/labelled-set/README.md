# The labelled set

Hand-labelled truth for measuring peer selection (SM-1, FR-70, Story 5.1). Issue [#13](https://github.com/IBE160-2026/G97-meinich/issues/13). Story 5.2 measures each funnel layer against it.

The rules and the rubric below were committed **before** the draw was run and before any pair was labelled. The commit dates show that the rubric was written before Story 2.5 fixed the fingerprint's feature list.

## Sampling frame

**Subjects.** The population is every company in the committed demo seed that meets all of these:
- `naeringskode1` 62.100 and legal form AS;
- a newest `SELSKAP` filing that runs 1 January – 31 December, with `sumDriftsinntekter` > 0.

That filing is the subject's benchmark filing, as in the product (`src/engine/peers.ts`).

**Candidates.** A subject's candidates are its pool from funnel stages 1–3 at the Standard size band (0.5–2 × the subject's revenue): the same pool the product reads through `assemblePeerGroup`.
- Stages 1–3 are rules that every layer shares. A company they exclude can never be in a peer group, so labelling it would measure nothing.
- The pool is not funnel output in the sense that matters. Stages 4 and 5, the fingerprint and the classification, are what is measured, and they have not touched it. A genuine peer that stage 4 or 5 drops then counts against recall.
- **30 candidates are drawn at random from the pool.** A subject whose pool has fewer than 30 is skipped. The skip is recorded, as it would make that subject's recall rest on a partial pool. A rough count from the seed puts about 120 of 4 650 eligible subjects below 30, so the skip mostly touches the very smallest and the very largest companies, and the report says so.

## Description quality (the two strata)

The subjects are stratified by whether their description is informative. The description is the register's `aktivitet`, falling back to `vedtektsfestetFormaal`, as in `analysis/industry_screening.py`.

**The rule, written before labelling.** A description is **informative** when it says what the company sells or makes, precisely enough to tell it apart from another 62.100 company. One example is "Utvikler og selger skybasert lønnssystem til små bedrifter". It is **uninformative** when it only restates the industry, lists generic activities or is legal boilerplate. Examples are "Programvareutvikling." and "Konsulentvirksomhet innen IT samt det som naturlig hører til".

The word-list proxy in `analysis/industry_screening.py` is not used. It is generous: Nynorsk words, misspellings and boilerplate pass as distinguishing words.

**How the strata are filled.** `draw.ts` shuffles the eligible subjects once (seed below) and writes the first 150 with a pool of at least 30 to `subject-descriptions.csv`, in that order. The file holds the orgnr and the description text only: no name, no website, no figures and no candidates. The labeller scores them in that order, `ja` or `nei`, and stops when both strata are full. The first 15 scored `ja` and the first 15 scored `nei` become the subjects. A subject is scored before any of its candidates is seen, so the stratum cannot be fitted to the labels.

## The draw

`draw.ts`, seed `SEED = 20261030`, run against the committed demo seed:
1. `draw.ts descriptions` shuffles the eligible subjects (above) and walks them in that order. It skips a subject whose pool has fewer than 30 companies and records why. For each of the first 150 others, it draws 30 candidates at random from the stages 1–3 pool. Each subject has its own seeded stream (the seed plus its orgnr), so its draw does not depend on the subjects before it. The step writes `subjects.json` (the counts, the order, the skips and the candidates) and `subject-descriptions.csv`. The candidates are fixed here, before scoring, so a later change to the local database (a step-1 run, for example) cannot move them.
2. Once the descriptions are scored, `draw.ts pairs` picks the 30 subjects in shuffled order, as above. It fetches each company's name, description and registered website (`hjemmeside`) from Enhetsregisteret.
3. It writes `drawn.json` (the 30 subjects, their stratum, whether they are blind, and their candidates) and the labelling sheets.

**Blind subsample.** 6 subjects, the first 3 of each stratum in shuffled order, about 180 pairs, are labelled **first**, from description and website only. Their sheet, `labels-blind.csv`, has no figures, and the labeller does not open accounts for those companies before the blind pairs are done. The pairs are marked `blind` in the data.

**Second labeller.** 50 pairs are drawn at random (seed `SEED + 1`) from the 24 non-blind subjects' pairs, after the first labeller is done. A second person labels them with the same rubric and the same information, without seeing the first labels. Cohen's κ is reported with the 50 pairs listed.

## The rubric

**The question for each pair:** *Would it be fair to compare this candidate's operating margin, capital tied up and cost structure with the subject's, because the two earn their money the same way?*

Judge the **revenue model**: what the customer pays for. Domain (health, finance, the public sector) and technology do not count on their own. The revenue models in 62.100:

| Model | What the customer pays for |
|---|---|
| Product | The company's own software, as a licence or a subscription (SaaS) |
| Project and consulting | Hours or fixed-price development, advice and integration, done by its own employees |
| Staffing | Hire of people who work under the customer's direction |
| Resale | Hardware, licences or services made by others, possibly with installation |
| Operations | Running, hosting or managing customers' systems over time |
| Not operating | Holding, investment or no visible activity |

**Labels:**
- `ja`: the same main revenue model. A company that mixes two models is comparable when its main one is the same as the subject's main one.
- `nei`: a different main revenue model, or either company is "not operating".
- `usikker`: the information does not let you decide. Use it sparingly, and write in `notes` what was missing.

**What you may use.** For the blind pairs, only the description and the website. For the other pairs, also the company's public accounts (for example the register's or Proff's). The accounts are a clue to the revenue model, such as goods for resale or a high share of personnel costs. They are not a criterion of their own: never label `nei` because margin or size differs. The size band is already given.

**How usikker counts.** Story 5.2 reports precision and recall with `usikker` left out, and states the count. As a sensitivity check it also reports them with `usikker` counted as `ja` and as `nei`.

**What this rubric cannot avoid.** The revenue model is partly visible in the accounts (cost composition, inventory), which is also what the fingerprint encodes. So the fingerprint is judged partly on its own terms. The blind subsample is the one part of the set where that does not hold (technical note, "What the measurement claims, and what it cannot").

## Fallback

If a stratum ends below 15 subjects, or the labelling ends below about 900 pairs, the counts actually achieved are reported. If either stratum has fewer than 10 subjects, the strata are pooled and the result is stated as one figure for 62.100, a smaller claim (technical note).

## Files

- `README.md`: these rules.
- `draw.ts`, `draw-compute.ts`: the draw. The second file reads the database through the analysis page's own reads and funnel.
- `subjects.json`: the first step's result: the counts, the shuffled order, the skips and each subject's 30 candidates.
- `subject-descriptions.csv`: the shuffled subjects' descriptions, then their `ja`/`nei` scores.
- `drawn.json`: the 30 subjects and their candidates.
- `labels-blind.csv`, `labels.csv`: the labelling sheets, then the labels (`subject_orgnr`, `candidate_orgnr`, `label`, `labelled_by`, `labelled_on`, `notes`).
- `kappa.csv`: the 50 pairs of the second labeller.

The sheets are semicolon-separated UTF-8, so they open column by column in a Norwegian Excel, like the OCR reference set.
