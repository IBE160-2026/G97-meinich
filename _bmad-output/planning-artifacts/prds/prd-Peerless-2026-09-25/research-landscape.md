# Competitive & Product Landscape Research — Peerless

Date: 2026-09-25
Scope: Web-search-based desk research (no primary interviews, no paid trials taken). Conducted for the Peerless PRD (Norwegian SME benchmarking against public Brønnøysund accounts data).

**Method note on confidence.** Everything below is sourced from public marketing/documentation pages found via web search, fetched and read. Pricing especially is frequently not published — where a search failed to surface a number, that is stated explicitly rather than guessed. No vendor was contacted directly and no product was trialled, so claims about *exactly* how peer groups are algorithmically selected are necessarily shallow — marketing copy rarely documents matching logic in the depth an engineer needs.

---

## 1. Norwegian players using the same public data

| Player | What it actually sells | Buyer | Peer benchmarking or credit/risk only? | Pricing (public) |
|---|---|---|---|---|
| **Proff Forvalt** (forvalt.no, part of Bisnode/Proff group) | Credit checks, company monitoring, valuation (their own "RIV model"), and a "Bedriftssammenligning" (company comparison) feature that produces Excel exports of financial figures for manually selected companies, plus a "Bransjesammenligning" (industry comparison) feature showing a company's development vs. industry average on liquidity, capital turnover and profitability. | Credit managers, sales/procurement, accountants, auditors (named customers include EY, Mazars, Link Mobility). | Both — its dominant business is credit/risk (kredittsjekk, AAA-style scoring), but it explicitly offers industry-average and multi-company comparison as a distinct module. Peer selection for "bedriftssammenligning" is **manual**: the user picks which companies to compare, not an algorithmic peer group. The "bransjesammenligning" (industry-average) feature appears to use industry classification only, based on available marketing copy — no evidence of a more sophisticated matching layer. | Published tiers: **Forvalt Pluss 12,490 NOK/yr**, **Forvalt Premium 14,990 NOK/yr** ("most popular," adds payment remarks, court data, alerts), **Forvalt XL 24,990 NOK/yr** (higher volume/API export). A separate "Proff Premium API" for system integration exists but is quote-only. Elsewhere a lower entry point of "from 567 NOK/month" for basic bedriftsinformasjon was found. Sources: forvalt.no/Om/om-proff-forvalt/Priser, forvalt.no/ProffAPI |
| **Enin (Enin.ai)** | AI-based credit/fraud analytics platform: bankruptcy-probability scoring, fraud/AML/KYC signals, company monitoring, ownership structure. Also has a "Company Browser" that explicitly **generates a list of comparable companies**, filterable by financial figures, purpose (formål), geography, NACE code, and employee count. | Financial institutions and regulated businesses — named clients include Eika, BN Bank, Jæren Sparebank. Not an SME-facing self-serve product. | Enin is the closest Norwegian player to algorithmic peer-group construction found in this research: its Company Browser filters on more than industry code (adds size, geography, purpose text). But its stated use cases are credit risk, fraud, and portfolio monitoring — not performance benchmarking or kroner-denominated gap analysis for the subject company itself. No evidence it converts deviations into currency value or targets an SME owner looking at their own company. | Not published; "free 14-day trial," contact sales. Positioned as B2B/enterprise (bank-grade), not a low-cost self-serve SME tool. |
| **Bisnode / Dun & Bradstreet Norway** | Credit reports (D&B "Firmafakta"), AAA credit rating, "SmartCheck" portfolio monitoring with alerts on payment defaults and rating changes, industry analyses of clients. D&B acquired Bisnode in 2020 for ~$812M. | Credit/risk managers, B2B sales and procurement, compliance. | Overwhelmingly credit/risk. Positioning is explicitly non-benchmarking: "Se hvem som ikke betaler for seg – og hvem som har betalingsanmerkninger" (see who doesn't pay, and who has payment defaults), "Unngå tap på dårlige kunder" (avoid losses from bad customers), "Kalkulerte, objektive og raske risikobeslutninger." Key figures ARE reported (grouped into 5 categories: earnings, equity, liquidity, financing, efficiency) but framed as risk inputs, not as a "where do you lose money vs. peers" performance tool. | Not published. |
| **Experian Norge** | "CreditOnline" credit assessment tool, "Live Kredittscore" (a badge/certificate a company can publish on its own site, Delphi-score based). Also consumer/business data and marketing analytics. | Credit managers; SMEs seeking a public trust badge. | Credit/risk framing, not benchmarking. No evidence of peer-group comparison product. | Not published. |
| **Creditsafe Norge** | Credit reports including up to 5 years of annual accounts, key figures, and auditor remarks/graphs. Distinctive pricing model: flat-fee unlimited-lookup subscription ("like a phone plan") rather than per-report pricing. | Credit/risk, procurement, sales. | Credit/risk only, as far as public pages show. No dedicated peer-benchmarking or industry-comparison product surfaced. | Flat-fee subscription model confirmed in principle; exact NOK figures not published — "contact us." |
| **Purehelp.no** | Free company/financial-data lookup (accounts, roles, ownership) for Norwegian entities; positions itself as a broad, low-cost/free data source rather than an analytics product. | General business users, journalists, researchers, anyone doing due diligence. | Neither, really — it's closer to a raw-data lookup/search tool than an analysis or benchmarking product. No comparison or benchmarking feature found. | Largely free; monetization model (ads/premium) not detailed in what was found. |
| **Regnskapstall.no** | Individual company financial-data search, "advanced lists" across ~1.39M active Norwegian entities, bankruptcy prediction/credit rating, lien checks, business monitoring, industry lists/rankings. | Similar audience to Purehelp/Proff — credit and prospecting use cases. | Primarily credit/risk and list-building (e.g., "who are the most/least profitable restaurants in this municipality" style content), not a structured "benchmark my company" product for an SME owner. Freemium; explicit pricing not shown on the homepage. | Freemium, "prøv gratis" / "utvidet løsning" — no rates published. |
| **Tjek** | Could not confirm this as a distinct player in this space. Searches for "Tjek.no" did not surface a Norwegian accounts-benchmarking product; results returned unrelated accounting-software comparison content. **Unconfirmed — likely not a significant player in this specific category, or the name refers to something outside what search surfaced.** | — | — | — |
| **SSB (Statistics Norway) — strukturstatistikk** | Not a commercial vendor, but a relevant free public comparator: SSB publishes annual structural statistics (strukturstatistikk) per industry — industry, retail, business services, construction, etc. — built from accounting data, usable to build industry averages for national accounts and EU structural-statistics reporting purposes. Also serves custom industry/mining data on commission to businesses and trade associations. | Government, trade associations, researchers, businesses ordering custom cuts. | This is industry-average-only, published at aggregate/sector level with a reporting lag, not company-vs-peer-group benchmarking, and not orgnr-specific. It is a legitimate "free alternative" for a crude industry average, but not a substitute for Peerless's matched-peer, kroner-denominated approach. | Free (public statistics); custom commissioned cuts priced separately, not published. |

**Norwegian accounting-software vendors (24SevenOffice, Conta, Tripletex, Fiken):** all define/explain nøkkeltall (key figures) in their help content/glossaries, but none of the vendor pages surfaced in this research show a built-in "compare your company to peers" benchmarking feature inside the bookkeeping product itself. This looks like whitespace, though it was not exhaustively verified against every vendor's actual in-app feature set (only marketing/glossary pages were checked).

---

## 2. The benchmarking category specifically

Findings from part 1, isolated to the "compare my company to similar companies" sub-category:

- **Proff Forvalt "Bedriftssammenligning"**: Excel-report output, up to a manually-chosen set of companies (also available in a lighter public form at proff.no/bedriftssammenligning, "compare up to 10 businesses"). Peer selection is **manual, not algorithmic** — the user must already know who to compare against. This is a meaningful gap relative to Peerless's premise: nothing found automatically assembles a matched peer group for the user.
- **Proff Forvalt "Bransjesammenligning"**: shows a company's value development over time directly against the industry average, with liquidity/capital-turnover/profitability figures benchmarked to industry. This is the closest Norwegian analogue to "industry-average" benchmarking, but the granularity is industry-code-level averages, not a curated, comparable peer set, and there's no evidence it expresses deviations in kroner.
- **Enin Company Browser**: the most sophisticated *peer-group construction* logic found in the Norwegian market (filters beyond NACE code — size, geography, "formål"/purpose text) — but it is built for finding comparable companies for credit/fraud/portfolio analysis, not for showing a subject company how it over/underperforms its peers in currency terms.
- **No Norwegian product found** that (a) auto-assembles a peer group beyond industry code + manual selection, and (b) converts the resulting deviations into kroner values. This specific combination — the core of Peerless's pitch — does not appear to exist as a packaged self-serve product in the Norwegian market based on this research.
- The closest **form factor** matches are: an Excel export (Proff Forvalt), a report a credit/accounting firm produces as part of a paid engagement (see §3, ProfitCents), or a dashboard inside general-purpose FP&A software aimed at accountants managing multiple clients (Fathom/Syft — see §3), none of which are Norway-specific or use Brønnøysund data as their source.

---

## 3. International comparables (product concept, not Norwegian data)

| Product | Peer benchmarking approach | Positioning | Pricing |
|---|---|---|---|
| **Fathom** | "Visually compare & rank your companies, clients or franchisees" — built for accountants/advisers managing a multi-entity portfolio (their own clients or franchise network) rather than public-market peer matching. No evidence it benchmarks a company against *external* companies it doesn't already have the books for. | "All-in-one reporting, analysis & forecasting"; "measure what matters"; "in-depth insights into business performance." Performance framing, not credit-risk framing. | Not disclosed on the main site; third-party trackers reference per-company/per-month SaaS pricing (figures vary by source and were not independently confirmed here — treat as approximate). |
| **Syft Analytics** | "Benchmark" feature compares an entity's P&L, balance sheet and ratios against other entities on the platform at **sector / broad-industry / precise-industry** granularity, filtered by **country**, with a stated minimum of >5 entities in a group before data is shown (a real privacy/statistical-significance floor). Also supports franchise/internal-org comparisons. Output is tabular + chart, shows entity value vs. industry median, variance, and percentile bands (middle 50%, top/bottom 25%). | Performance/insight framing aimed at accountants and their SME clients. | Not confirmed in this research. |
| **Futrli** | Positioned for SMBs/advisory firms needing short-term financial analysis and granular cash-flow forecasting, particularly weekly-cycle or liquidity-sensitive businesses. Peer-benchmarking depth not confirmed from what was found — the tool's emphasis in search results was forecasting, not benchmarking. | Not deeply characterized in this pass — flagged as needing more research if this comparable matters to positioning. | Not confirmed. |
| **ProfitCents (Sageworks / Abrigo)** | Explicitly a peer-benchmarking product for accounting firms: converts a client's accounts into a report explaining financial health relative to the past **and to peers**, drawn from a proprietary database of **1,400 industries**, segmentable by geography and revenue range, built from real financial statements (not surveys or old tax data — this is their stated differentiator against competitors). Used by accounting firms both to retain clients and to sell additional advisory work (explicit "cross-sell" use case in their own marketing). | "Convert sets of accounts into customizable reports explaining the company's financial health relative to the past and to peers." This is squarely a **consultant-deliverable form factor** — a report produced by the accountant as part of a client relationship — not a self-serve SME dashboard. | Sold to accounting firms as part of a practice-management/valuation suite; no public self-serve consumer pricing found. |
| **Vena Solutions** | Full EPM/FP&A platform (budgeting, planning, consolidation) for larger finance teams; "peer group" language found in the research related to Vena's *own* position among analyst peer groups (BARC Planning Survey), not a feature for benchmarking SME clients against each other. Not a good product-concept comparable for Peerless — flagging that the initial hypothesis (Vena as an SME benchmarking peer) was not supported by what surfaced. | Enterprise FP&A positioning, not benchmarking-specific. | Not disclosed; "modular, customized" pricing per Vena's own materials — i.e., enterprise sales-assisted, not self-serve. |

**Read-across for Peerless:** ProfitCents is the closest conceptual match (accounts → peer-relative report), but it is sold through accountants as a practice tool, priced enterprise/B2B2B, and not Norway/Brønnøysund-specific. Syft is the closest *feature* match (explicit industry-median benchmarking with statistical floor) but again not Norway-specific and bundled inside a broader reporting suite rather than being the product itself. Nothing found combines ProfitCents' peer-relative reporting with Syft's transparent median/percentile mechanics **and** a low-cost, self-serve, single-orgnr entry point the way Peerless proposes.

---

## 4. Positioning language

Collected phrases, grouped by framing:

**Credit-risk framing ("will they pay")** — dominant across the Norwegian incumbents:
- D&B/Bisnode: *"Se hvem som ikke betaler for seg – og hvem som har betalingsanmerkninger"* ("see who doesn't pay — and who has payment remarks") — dnb.com/no/produkter/kredittsjekk.html
- D&B/Bisnode: *"Unngå tap på dårlige kunder"* ("avoid losses from bad customers") — same source
- D&B/Bisnode: *"Kalkulerte, objektive og raske risikobeslutninger"* ("calculated, objective, fast risk decisions") — same source
- D&B/Bisnode: *"Sannsynligheten for om et selskap kan gå konkurs de neste 12 månedene"* (bankruptcy probability, 12-month horizon) — same source
- Proff Forvalt: *"markedets mest presise rating- og scoringsmodeller"* ("the market's most precise rating/scoring models") — forvalt.no pricing page
- Enin's own summary blog title translates roughly to "the billions that are lost" (fraud framing) — enin.ai/blog

**Performance framing ("where are we losing money / how are we doing")** — mostly from the international SME-tooling category, not Norwegian credit bureaus:
- Fathom: *"In-depth insights into business performance"*; *"Measure what matters"* — fathomhq.com
- Fathom: *"Visually compare & rank your companies, clients or franchisees"* — fathomhq.com
- ProfitCents (Abrigo): converts accounts into reports *"explaining the company's financial health relative to the past and to peers"* — profitcents.com / abrigo.com blog
- Proff Forvalt (mixed — sits between the two framings): *"AI-baserte analyser som gir dypere innsikt"* ("AI-based analyses giving deeper insight"), *"mer treffsikre vurderinger"* ("more accurate assessments") — this is scoring-model language applied to a credit product, not a performance-improvement product.

**Observation:** the credit-risk vs. performance distinction in the brief is real and clearly visible in the language. Every Norwegian incumbent found leads with defensive/risk language (avoid loss, spot non-payers, assess creditworthiness of others). Not one leads with "see where your own company underperforms its peers, in kroner." The performance framing exists only in the international SME-tooling category (Fathom, ProfitCents), which is not Norway/Brønnøysund-specific and not priced or packaged for a single self-serve orgnr lookup.

---

## 5. Is the gap real?

**On the specific combination Peerless proposes — self-serve, single-orgnr, automatically-assembled comparable peer group, deviations expressed in kroner, aimed at the subject company itself (not at a credit analyst assessing someone else) — no existing Norwegian product matching that description was found in this research.** That is the headline finding, stated as plainly as the evidence supports.

What *does* exist, and why it doesn't close the gap:

1. **Proff Forvalt bransjesammenligning** gets closest on data (Brønnøysund-based, Norway-specific, does show a company against an industry average over time) but the peer group is the whole industry code bucket, not a matched comparable set, and there is no evidence it translates gaps into currency amounts. It's also bundled inside a credit/risk-first product (starting ~12,490 NOK/yr) rather than sold as a benchmarking product in its own right.
2. **Enin** has the most sophisticated peer-matching logic found (multi-factor: size, geography, purpose, NACE) but it's enterprise/bank-facing tooling for credit and fraud analysts assessing *other* companies, not a self-serve tool for a company to benchmark itself, and pricing is enterprise-sales-gated (no self-serve entry point found).
3. **ProfitCents** is conceptually the nearest match anywhere (peer-relative report from accounts) but it's a different country's data, sold through accounting firms as a practice tool, and delivered as a periodic report/consulting deliverable rather than a live self-serve product.
4. **SSB structural statistics** offer a free, legitimate industry-average alternative, but at sector-level aggregation with a publication lag and no company-level, matched-peer comparison — someone could triangulate a rough answer for free, slowly, with a spreadsheet, but not get the matched-peer, kroner-denominated output Peerless proposes.
5. **Nothing found is priced as cheap, instant, self-serve SME software.** The Norwegian incumbents are either credit-bureau subscriptions (12,490–24,990+ NOK/yr, or enterprise quote-only) aimed at people assessing *other* companies, or bundled inside broader accounting/audit engagements (hourly consultant rates of 900–2,000 NOK found for related advisory work). No evidence surfaced of an existing product offering "enter your orgnr, see your peer-relative gaps in kroner" for a low one-off or low monthly price aimed directly at an SME owner.

**Caveat on confidence:** this is desk research against public marketing pages, not a systematic audit of every module inside Proff Forvalt, Enin, or the accounting-software vendors' paid tiers (which sit behind logins/trials this research did not access). It is plausible a paid module inside Proff Forvalt or a Nordic entrant not surfaced by search does more of this than its public marketing shows. The claim above should be read as "no such product is marketed or discoverable as doing this," not as an exhaustive audit of every paid feature behind every login.

---

## 6. Regulatory / terms-of-use signal on commercial reuse of Brønnøysund data

This surfaced an important, concrete finding with direct implications for Peerless's data-access design:

- **Open data (organisation register etc.) is licensed under NLOD** (Norsk lisens for offentlige data — the Norwegian equivalent of a permissive open-government-data license). Brreg's own page states datasets "follow the provisions of the Norwegian Licence for Open Government Data (NLOD)" and no registration is required to use the data. — brreg.no/en/use-of-data-from-the-bronnoysund-register-centre/open-data/
- **The regnskapsregisteret (accounts register) API has a split scope, and this matters a lot for Peerless:**
  - The **open/free part** of the API provides **key figures from only the most recently submitted annual accounts** (i.e., one year per company) as open data. Per the API's own GitHub documentation: "Key values from annual accounts for the last accounting year as open data." It also does not break out some line items (e.g., inventory and customer receivables) at this open tier. — github.com/brreg/regnskapsregister-api, data.norge.no dataset page
  - A **closed part** of the API carries almost all figures from the **three most recent** annual accounts, including group accounts — but per what surfaced in this research, that closed tier is stated to be available **only to public authorities**, not to commercial actors. This specific claim (closed tier = public-authorities-only) came from a synthesized web-search answer rather than a directly quoted primary source, so treat it as **probable but not independently confirmed** — it should be verified directly against brreg's API documentation/Swagger before the architecture depends on it.
  - **Full bulk access to complete annual accounts (multi-year, XML, ~300,000 records/year) is a paid subscription**, not open data: brreg's own subscription page states current pricing at **NOK 480,000/year per subscriber at 5 subscribers**, dropping to **NOK 400,000/year at 6 subscribers** — i.e., the fee is set to yield a fixed total pool split across however many organisations subscribe. Access requires signing a framework agreement plus a sub-agreement. — brreg.no/en/use-of-data-from-the-bronnoysund-register-centre/subscription/subscription-to-annual-accounts/
- **Practical implication for Peerless's architecture:** if the product's peer-benchmarking model needs multiple years of accounts per peer company (which a credible "how does this company compare over time" story likely does), the free/open API alone — single latest year, some fields not broken out — may not be sufficient, and the realistic alternatives are (a) live per-orgnr API calls repeated over time to build up a self-collected time series, (b) the enterprise bulk subscription at ~400–480k NOK/year, clearly out of reach for a course project and probably for an early-stage product, or (c) some other data source/partner. This is a genuine build constraint the PRD and architecture should address explicitly, not an assumption to wave past.
- **No explicit statement on commercial reuse restrictions** (e.g., "you may/may not build a paid product on this data") was found in what was fetched; the NLOD license is generally permissive of commercial reuse for openly licensed data, but this specific claim about the *accounts* dataset (as opposed to the base organisation register) was not directly confirmed — the accounts data appears to be gated by the free/paid split above rather than by a reuse restriction in the license text itself. This should be verified directly against the NLOD license text and brreg's own accounts-specific terms before relying on it.

---

## Sources

- [Nøkkeltall | Proff® Forvalt](https://forvalt.no/Regnskap/Regnskap/Nokkeltall)
- [Verdivurdering av bedrift | Proff Forvalt](https://forvalt.no/Kredittsjekk/Analyser/Verdivurdering)
- [Kredittanalyser og bedriftssammenligning | Proff Forvalt](https://forvalt.no/kredittsjekk/analyser/)
- [Bedriftssammenlikning med kredittdata og økonomiske nøkkeltall | Proff Forvalt](https://forvalt.no/Kredittsjekk/Analyser/Bedriftssammenlikning)
- [Statistikk for bedrifter | Proff Forvalt](https://forvalt.no/Regnskap/Bedrifter/Statistikker)
- [Proff™ – Bedriftssammenligning](https://www.proff.no/bedriftssammenligning)
- [Priser og abonnementer | Proff Forvalt](https://forvalt.no/Om/om-proff-forvalt/Priser)
- [Bedriftsdata, kreditt og compliance via API | Proff Forvalt](https://forvalt.no/ProffAPI)
- [Guide til kredittvurdering av bedrifter — Enin](https://www.enin.ai/nb/blog/guide-til-kredittvurdering-av-bedrifter)
- [Enin — La oss få bedriftsdata til å jobbe for deg](https://www.enin.ai/nb)
- [Enin news/blog](https://www.enin.ai/blog)
- [Purehelp.no](https://www.purehelp.no/m/)
- [Regnskapstall.no](https://www.regnskapstall.no/)
- [Kredittsjekk for bedrifter — Dun & Bradstreet](https://www.dnb.com/no/produkter/kredittsjekk.html)
- [Bisnode — Wikipedia](https://en.wikipedia.org/wiki/Bisnode)
- [Kredittsjekk bedrifter og personer — Creditsafe](https://www.creditsafe.com/no/no/kreditt-risiko/kredittsjekk.html)
- [Kredittvurderingsverktøy — Experian Norge](https://www.experian.no/foretag/forbrukerinformasjon/kreditthandtering/credit-online)
- [Live Kredittscore — Experian Norge](https://www.experian.no/foretag/forbrukerinformasjon/kreditthandtering/live-kredittscore)
- [Fathom — Articles on Comparison](https://www.fathomhq.com/topic/comparison)
- [Fathom homepage](https://www.fathomhq.com/)
- [Syft Analytics — Benchmarks (Knowledge Center)](https://help.syftanalytics.com/en/articles/9083810-benchmarks)
- [ProfitCents — Industry Benchmarks](https://www.profitcents.com/cpa/cpa-industrybenchmarks.aspx)
- [Why accountants choose ProfitCents — Abrigo](https://www.abrigo.com/blog/why-accountants-choose-profitcents/)
- [How accountants get new clients using ProfitCents — Abrigo](https://www.abrigo.com/blog/how-accountants-get-new-clients-by-using-profitcents/)
- [Vena Solutions — Awards/peer group recognition](https://www.venasolutions.com/awards-reports)
- [Bruke data fra Brønnøysundregistrene](https://www.brreg.no/en/use-of-data-from-the-bronnoysund-register-centre/)
- [Datasets and API — Brønnøysund Register Centre](https://www.brreg.no/en/use-of-data-from-the-bronnoysund-register-centre/datasets-and-api/)
- [Open data — Brønnøysund Register Centre](https://www.brreg.no/en/use-of-data-from-the-bronnoysund-register-centre/open-data/)
- [Data about organisations — Brønnøysund Register Centre](https://www.brreg.no/en/use-of-data-from-the-bronnoysund-register-centre/datasets-and-api/data-about-organisations/)
- [Subscription to annual accounts — Brønnøysund Register Centre](https://www.brreg.no/en/use-of-data-from-the-bronnoysund-register-centre/subscription/subscription-to-annual-accounts/)
- [Regnskapsregisteret — data.norge.no dataset page](https://data.norge.no/en/datasets/7c87f169-2520-4e56-ba2a-b7a3cc7de2e9/regnskapsregisteret)
- [brreg/regnskapsregister-api — GitHub](https://github.com/brreg/regnskapsregister-api)
- [regnskapsregister-api/docs/for-devs.md — GitHub](https://github.com/brreg/regnskapsregister-api/blob/main/docs/for-devs.md)
- [CA Regnskapsregisteret API docs](https://brreg.github.io/ca_regnskapsregisteret_api/)
- [SSB — Strukturstatistikk for industri og bergverksdrift](https://www.ssb.no/energi-og-industri/statistikker/sti/aar-forelopige)
- [SSB — Varehandel, strukturstatistikk](https://www.ssb.no/varehandel-og-tjenesteyting/statistikker/stvareh/aar-forelopige)
- [SSB — Næringslivstjenester, strukturstatistikk](https://ssb.no/stefu)
- [Hva koster revisor — Revisorportalen](https://revisorportalen.no/revisor-pris)
- [24SevenOffice — Nøkkeltall (regnskapsordbok)](https://24sevenoffice.com/no/regnskapsordbok/nokkeltall)
- [Conta — Hva er nøkkeltall?](https://conta.no/regnskapsordbok/hva-er-nokkeltall/)

**Not independently confirmed / flagged as needing verification:**
- The claim that the "closed" tier of the regnskapsregisteret API (3 years, group accounts) is restricted to public authorities only — this came from a synthesized search answer, not a directly quoted primary source.
- Exact self-serve pricing for Fathom, Syft Analytics, Futrli, Creditsafe Norway, Enin, and Experian Norge — none publish rate cards; figures cited by third-party comparison sites were not treated as authoritative here.
- "Tjek" as a named Norwegian player could not be confirmed to exist in this category from search results.
