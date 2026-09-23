# Industry screening

Generated 2026-09-23 by `analysis/industry_screening.py` from the open Brreg APIs (Enhetsregisteret and Regnskapsregisteret). Industry codes are SN2025.

Population: active AS (not bankrupt, not in liquidation) with at least 5 employees and the code as primary industry. Minimum group size 10 is a placeholder until the brief decides it.

**Sections 2 and 3 are word-list proxies, not measurements.** The CSV files in `analysis/output/` carry empty `manual_*` columns; scoring a sample of those by hand is what turns the proxy into a result.

## Summary

| Code | Industry | Companies ≥5 emp. | Specific descriptions | Comparable (sample) | Est. comparable | Business types ≥5 % | Margin spread Q3−Q1 | OCR pages (5 yrs) |
|---|---|---|---|---|---|---|---|---|
| 62.100 | Dataprogrammeringstjenester | 1003 | 56 % | 94 % | 942 | 5 | 54.8 % | 8478 |
| 69.202 | Regnskapsføring og bokføring | 797 | 38 % | 99 % | 789 | 4 | 12.4 % | 7101 |
| 43.210 | Elektrisk installasjonsarbeid | 1325 | 50 % | 98 % | 1298 | 4 | 9.7 % | 11682 |

## 62.100 — Dataprogrammeringstjenester

### 1. Population

- Active AS, any size: **9959**
- With ≥ 5 employees, code as *primary* industry: **1003** (60 more have it only as a secondary code and are excluded)
- With ≥ 20 employees: **306** (API count, primary or secondary code)

| Employees | Companies | Est. comparable | Enough for a group of 10? |
|---|---|---|---|
| 5–9 | 457 | 429 | yes |
| 10–19 | 285 | 267 | yes |
| 20–49 | 173 | 162 | yes |
| 50–99 | 56 | 52 | yes |
| 100+ | 32 | 30 | yes |

### 2. Description quality (whole population, word-list proxy)

- Missing: 0 (0 %)
- Boilerplate only: 99 (10 %)
- Generic (1–2 distinguishing words): 338 (34 %)
- **Specific (3+ distinguishing words): 566 (56 %)**
- Has a website registered: 350 (35 %)

Examples:

- *boilerplate*: “Programvareutvikling.”
- *boilerplate*: “Salg av IT løsninger. Konsulentvirksomhet tilknyttet informasjonsteknologi.”
- *boilerplate*: “Programvareutvikling.”
- *generic*: “Konsulenttjenester innenfor elektronikk og programvare. Egenutvikling av produkter innenfor elektronikk og programvare.”
- *generic*: “Utvikling og konsulentvirksomhet innen elektronisk databehandling, samt hva dermed står i forbindelse, herunder å delta i andre selskaper med lignende virksomhe”
- *generic*: “Programmeringstjenester.”
- *specific*: “Selge tjenester og varer innen WEB PORTALER og annet som naturlig sammenfaller med dette, samt deltakelse i andre selskaper, investeringer og nærliggende virkso”
- *specific*: “Utvikle produkter og tjenester innen IKT, infrastruktur, fiskeri og råvarer.”
- *specific*: “Utvikling av internettløysningar for bedrifter og offentleg. Også rådsgivning, konsulenttjenester, salg, markedsføring og prosjektstyring samt anna virksomhet t”

### 3. Heterogeneity (whole population, keyword proxy)

- Registered with a secondary industry code: 32 (3 %)
- Description matches two or more business types: 110 (11 %)

| Business type | Companies | Share |
|---|---|---|
| consulting/staffing | 259 | 26 % |
| real estate/investment | 112 | 11 % |
| product/SaaS | 77 | 8 % |
| operations/hosting | 66 | 7 % |
| hardware/electronics | 60 | 6 % |
| games/media | 20 | 2 % |

### 4. Comparability (random sample of 100, seed 160)

- Has a filing in the key figures API: 100 (100 %)
- Of those, reporting in NOK: 100
- Ordinary accounting rules: 97
- Calendar-year period: 97
- Liquidation accounts: 1
- `smaaForetak` true: 89 (not an exclusion — must match the subject)
- **Passes the comparability filter: 94 (94 %)**

- Operating margin (driftsresultat / sumDriftsinntekter): Q1 -45.7 % · median -3.2 % · Q3 9.1 % — spread Q3−Q1 54.8 %
- Revenue per employee: Q1 630 014 kr · median 1 390 898 kr · Q3 2 125 447 kr (employees are today's count, revenue the latest filing — indicative only)

### 5. OCR volume (comparable population)

- Years of document copies available: median 9.0, min 1, max 15
- Estimated comparable companies: **942**
- For 5 years of trend: 3 documents each → **2826 filings, 8478 generated pages**


## 69.202 — Regnskapsføring og bokføring

### 1. Population

- Active AS, any size: **3124**
- With ≥ 5 employees, code as *primary* industry: **797** (14 more have it only as a secondary code and are excluded)
- With ≥ 20 employees: **133** (API count, primary or secondary code)

| Employees | Companies | Est. comparable | Enough for a group of 10? |
|---|---|---|---|
| 5–9 | 450 | 445 | yes |
| 10–19 | 220 | 217 | yes |
| 20–49 | 94 | 93 | yes |
| 50–99 | 17 | 16 | yes |
| 100+ | 16 | 15 | yes |

### 2. Description quality (whole population, word-list proxy)

- Missing: 0 (0 %)
- Boilerplate only: 240 (30 %)
- Generic (1–2 distinguishing words): 256 (32 %)
- **Specific (3+ distinguishing words): 301 (38 %)**
- Has a website registered: 284 (36 %)

Examples:

- *boilerplate*: “Regnskapsføring for andre”
- *boilerplate*: “Regnskapstjenester og økonomisk rådgivning.”
- *boilerplate*: “Regnskapstjenester og økonomisk rådgivning.”
- *generic*: “Yte regnskapstjenester, økonomisk rådgivning og hva hermed står i forbindelse.”
- *generic*: “Regnskapsvirksomhet, regnskapsføring for andre, økonomisk rådgivning og annen tjenesteytende virksomhet, samt hva hermed står i forbindelse, herunder å delta i ”
- *generic*: “Regnskap og bokføring og tilhørende virksomhet.”
- *specific*: “Føre regnskap for andre. Selskapets virksomhet er også å utføre forretningsførsel, økonomisk- og administrativ rådgivning, konsulenttjenester og annen tilknytte”
- *specific*: “Føring av rekneskap, rådgjeving og konsulenttenester innan økonomi.”
- *specific*: “Regnskapsføring, økonomisk bistadn, kjøp/salg av aksjer, deltakelse i andre selskaper og alt som faller herunder.”

### 3. Heterogeneity (whole population, keyword proxy)

- Registered with a secondary industry code: 5 (1 %)
- Description matches two or more business types: 445 (56 %)

| Business type | Companies | Share |
|---|---|---|
| bookkeeping core | 738 | 93 % |
| advisory | 425 | 53 % |
| unrelated trade | 57 | 7 % |
| IT/data services | 41 | 5 % |
| audit/tax | 28 | 4 % |
| payroll | 27 | 3 % |

### 4. Comparability (random sample of 100, seed 160)

- Has a filing in the key figures API: 100 (100 %)
- Of those, reporting in NOK: 100
- Ordinary accounting rules: 100
- Calendar-year period: 99
- Liquidation accounts: 0
- `smaaForetak` true: 99 (not an exclusion — must match the subject)
- **Passes the comparability filter: 99 (99 %)**

- Operating margin (driftsresultat / sumDriftsinntekter): Q1 2.9 % · median 9.7 % · Q3 15.3 % — spread Q3−Q1 12.4 %
- Revenue per employee: Q1 881 589 kr · median 1 159 406 kr · Q3 1 443 366 kr (employees are today's count, revenue the latest filing — indicative only)

### 5. OCR volume (comparable population)

- Years of document copies available: median 15.0, min 1, max 15
- Estimated comparable companies: **789**
- For 5 years of trend: 3 documents each → **2367 filings, 7101 generated pages**


## 43.210 — Elektrisk installasjonsarbeid

### 1. Population

- Active AS, any size: **3447**
- With ≥ 5 employees, code as *primary* industry: **1325** (36 more have it only as a secondary code and are excluded)
- With ≥ 20 employees: **510** (API count, primary or secondary code)

| Employees | Companies | Est. comparable | Enough for a group of 10? |
|---|---|---|---|
| 5–9 | 432 | 423 | yes |
| 10–19 | 416 | 407 | yes |
| 20–49 | 344 | 337 | yes |
| 50–99 | 76 | 74 | yes |
| 100+ | 57 | 55 | yes |

### 2. Description quality (whole population, word-list proxy)

- Missing: 1 (0 %)
- Boilerplate only: 205 (15 %)
- Generic (1–2 distinguishing words): 453 (34 %)
- **Specific (3+ distinguishing words): 666 (50 %)**
- Has a website registered: 349 (26 %)

Examples:

- *boilerplate*: “Elektrisk installasjon og annet i den forbindelse.”
- *boilerplate*: “Elektriske installasjoner.”
- *boilerplate*: “Elektro, ny installasjon, service og vedlikehold.”
- *generic*: “Elektrikertjenester.”
- *generic*: “Elektrikertjenester.”
- *generic*: “El.installasjon, handel,import og hva dermed står i forbindelse, herunder også deltagelse i andre selskaper.”
- *specific*: “Elektrisk installasjonsarbeid. Generelle bygg- og oppussingstjenester. Rehabilitering av bygninger ute og innvendig. Annen spesialisert bygge- og anleggsvirksom”
- *specific*: “Drive produksjon av elektrotavler, installasjonsverksemd og vareomsetning.”
- *specific*: “Drift av elektroinstallasjonsbedrift. Salg av elektromateriell og annen tilhørende virksomhet. Deltakelse i andre selskaper med økonomisk formål.”

### 3. Heterogeneity (whole population, keyword proxy)

- Registered with a secondary industry code: 25 (2 %)
- Description matches two or more business types: 329 (25 %)

| Business type | Companies | Share |
|---|---|---|
| installation | 861 | 65 % |
| trade/retail | 269 | 20 % |
| security/telecom | 126 | 10 % |
| automation/industrial | 84 | 6 % |
| solar/energy | 17 | 1 % |
| EV charging | 0 | 0 % |

### 4. Comparability (random sample of 100, seed 160)

- Has a filing in the key figures API: 100 (100 %)
- Of those, reporting in NOK: 100
- Ordinary accounting rules: 100
- Calendar-year period: 98
- Liquidation accounts: 0
- `smaaForetak` true: 91 (not an exclusion — must match the subject)
- **Passes the comparability filter: 98 (98 %)**

- Operating margin (driftsresultat / sumDriftsinntekter): Q1 1.1 % · median 4.6 % · Q3 10.8 % — spread Q3−Q1 9.7 %
- Revenue per employee: Q1 1 322 513 kr · median 1 530 497 kr · Q3 1 919 396 kr (employees are today's count, revenue the latest filing — indicative only)

### 5. OCR volume (comparable population)

- Years of document copies available: median 15.0, min 1, max 15
- Estimated comparable companies: **1298**
- For 5 years of trend: 3 documents each → **3894 filings, 11682 generated pages**

