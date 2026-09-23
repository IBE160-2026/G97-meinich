# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Industry screening for Peerless: which industry should be covered first?

Answers five questions per candidate industry code, using only open Brreg APIs:

1. Population   - how many active AS with employees, per size band.
2. Descriptions - how many business descriptions actually say something.
3. Heterogeneity - how many different kinds of business share one code.
4. Comparability - what share of a sample passes the comparability filter.
5. OCR volume   - how many filings and pages the batch job would face.

Everything is deterministic: descriptions are scored with word lists, not a
model. The scores are a proxy. The CSV files written next to the report have
empty `manual_*` columns for a human to fill in, and that hand scoring is the
real measurement.

Run:  uv run analysis/industry_screening.py
      uv run analysis/industry_screening.py 62.100 69.202
"""

from __future__ import annotations

import csv
import hashlib
import json
import random
import re
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path

# --- Configuration ----------------------------------------------------------

INDUSTRIES = {
    "62.100": "Dataprogrammeringstjenester",
    "69.202": "Regnskapsføring og bokføring",
    "43.210": "Elektrisk installasjonsarbeid",
}

MIN_EMPLOYEES = 5
SAMPLE_SIZE = 100
SEED = 160  # fixed, so a rerun samples the same companies
# Placeholder until the brief decides the minimum group size.
MIN_GROUP_SIZE = 10
# Years of history the product would show; each filing carries a prior-year
# column, so this many years needs roughly half as many documents.
TREND_YEARS = 5
GENERATED_PAGES_PER_FILING = 3

SIZE_BANDS = [(5, 9), (10, 19), (20, 49), (50, 99), (100, None)]

BASE = "https://data.brreg.no"
USER_AGENT = "Peerless student project (IBE160, Hogskolen i Molde)"
REQUEST_PAUSE_SECONDS = 0.15

HERE = Path(__file__).resolve().parent
CACHE_DIR = HERE / ".cache"
OUTPUT_DIR = HERE / "output"

# --- Description scoring word lists ------------------------------------------

# Legal boilerplate that appears in statements of purpose regardless of what
# the company does. Removed before counting content words.
BOILERPLATE = [
    r"og alt som (herved|hermed|dermed|dette)? ?(står|staar) i forbindelse( med dette| hermed| dermed)?",
    r"og (annen|anna) (virksomhet|verksemd) som (står|har) (i forbindelse|sammenheng) med (dette|dette)?",
    r"samt (annen|all) (virksomhet|verksemd) (som )?(naturlig )?(står i forbindelse|hører sammen) med dette",
    r"herunder (ved )?(deltakelse|deltagelse|å delta) i andre (selskaper|foretak)( med tilsvarende formål)?",
    r"(kjøp|erverv) (og salg )?av aksjer( og andeler)?( i andre selskaper)?",
    r"(forvaltning|plassering) av (kapital|midler)",
    r"kjøp og salg av fast eiendom",
    r"m\.?\s?m\.?",
]

STOPWORDS = set(
    """
    og i av til for med på som er en et ei den det de å samt eller innen
    innenfor under ved fra om mot alt all alle andre annen annet dette dermed
    herved hermed herunder også slik mv mm etc selskapets selskapet selskap
    formål formålet virksomhet virksomheten virksomheter drive drift drifte
    driver tilknyttet tilknytning forbindelse sammenheng naturlig står hører
    både hvor hva kan skal vil blant nevnte lignende tilsvarende relatert
    relaterte type typer ulike ulik diverse generelt generell hovedsakelig
    """.split()
)

# Words that describe almost any business and so distinguish nothing.
GENERIC_BUSINESS = set(
    """
    salg selge kjøp handel tjenester tjenesteyting tjeneste konsulent
    konsulentvirksomhet konsulenttjenester rådgivning rådgiving bistand
    utvikling utvikle utvikler produksjon produsere levere leveranse
    leveranser markedsføring service vedlikehold import eksport investering
    investeringer eiendom eiendommer aksjer andeler kapital utleie
    prosjekter prosjekt løsninger løsning produkter produkt norge norsk
    kunder kunde næringsdrivende bedrifter bedrift private offentlige
    """.split()
)

# Words that restate the industry code itself, so they carry no signal
# for telling companies within that code apart.
INDUSTRY_GENERIC = {
    "62.100": set(
        """
        programvare programvarer programvareutvikling dataprogrammer
        dataprogram programmering programmeringstjenester edb data it ikt
        system systemer datasystemer informasjonsteknologi teknologi
        edb-tjenester it-tjenester it-løsninger software
        """.split()
    ),
    "69.202": set(
        """
        regnskap regnskaper regnskapsføring regnskapstjenester regnskapskontor
        regnskapsbyrå bokføring økonomi økonomisk økonomiske regnskapsfaglig
        regnskapsførsel føring skatt skattemessige
        """.split()
    ),
    "43.210": set(
        """
        elektro elektriske elektrisk elektroinstallasjon elektroinstallasjoner
        elektrikerarbeid elektriker installasjon installasjoner
        installasjonsarbeid anlegg elektroentreprenør entreprenør
        """.split()
    ),
}

# Business types that plausibly share one code but not one cost structure.
# A description can match several; the count of themes in use is the proxy
# for heterogeneity.
THEMES = {
    "62.100": {
        "product/SaaS": r"\b(saas|plattform\w*|lisens\w*|abonnement\w*|sky\w*|cloud|app|apper|applikasjon\w*|egen(utviklede)? (programvare|produkter))\b",
        "consulting/staffing": r"\b(konsulent\w*|bemanning\w*|utleie av (personell|konsulenter)|rådgiv\w*)\b",
        "hardware/electronics": r"\b(maskinvare|hardware|elektronikk|utstyr|sensor\w*|instrument\w*)\b",
        "games/media": r"\b(spill\w*|gaming|media|video|animasjon\w*)\b",
        "operations/hosting": r"\b(drift av|hosting|nettverk\w*|datasenter\w*|forvaltning av it)\b",
        "real estate/investment": r"\b(eiendom\w*|investering\w*|aksjer)\b",
    },
    "69.202": {
        "bookkeeping core": r"\b(regnskap\w*|bokføring\w*)\b",
        "payroll": r"\b(lønn\w*)\b",
        "advisory": r"\b(rådgiv\w*|konsulent\w*|bedriftsrådgiv\w*)\b",
        "audit/tax": r"\b(revisjon\w*|skatt\w*)\b",
        "IT/data services": r"\b(data\w*|it|edb|programvare)\b",
        "unrelated trade": r"\b(bygg\w*|tømrer\w*|eiendom\w*|handel|transport\w*)\b",
    },
    "43.210": {
        "installation": r"\b(installasjon\w*|elektroinstallasjon\w*)\b",
        "solar/energy": r"\b(sol\w*|energi\w*|batteri\w*|varmepumpe\w*)\b",
        "EV charging": r"\b(lade\w*|elbil\w*)\b",
        "automation/industrial": r"\b(automasjon\w*|automatisering\w*|styring\w*|industri\w*)\b",
        "security/telecom": r"\b(alarm\w*|sikkerhet\w*|adgangskontroll|tele\w*|fiber|svakstrøm\w*)\b",
        "trade/retail": r"\b(butikk\w*|handel|salg av elektrisk\w*|forhandler\w*)\b",
    },
}

WORD = re.compile(r"[a-zæøåéü][a-zæøåéü\-]+")


# --- HTTP with a disk cache ---------------------------------------------------


def fetch_json(url: str) -> object | None:
    """GET a Brreg URL as JSON. Returns None on 404. Cached on disk, so a
    rerun costs no API calls and does not hammer the register."""
    CACHE_DIR.mkdir(exist_ok=True)
    key = hashlib.sha256(url.encode()).hexdigest()[:32]
    cached = CACHE_DIR / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))

    request = urllib.request.Request(
        url, headers={"Accept": "application/json", "User-Agent": USER_AGENT}
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as error:
            if error.code == 404:
                data = None
                break
            if error.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(2**attempt)
                continue
            raise
        except urllib.error.URLError:
            if attempt < 4:
                time.sleep(2**attempt)
                continue
            raise
    time.sleep(REQUEST_PAUSE_SECONDS)
    cached.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def count_units(code: str, min_employees: int | None) -> int:
    params = {
        "naeringskode": code,
        "organisasjonsform": "AS",
        "konkurs": "false",
        "underAvvikling": "false",
        "underTvangsavviklingEllerTvangsopplosning": "false",
        "size": "1",
    }
    if min_employees is not None:
        params["fraAntallAnsatte"] = str(min_employees)
    data = fetch_json(f"{BASE}/enhetsregisteret/api/enheter?{urllib.parse.urlencode(params)}")
    return int(data["page"]["totalElements"])


def fetch_population(code: str) -> tuple[list[dict], int]:
    """All active AS with at least MIN_EMPLOYEES whose *primary* code is `code`.
    The API filter also matches secondary codes, so those are dropped here and
    counted, because the industry-code baseline uses the primary code."""
    units: list[dict] = []
    page = 0
    while True:
        params = {
            "naeringskode": code,
            "organisasjonsform": "AS",
            "konkurs": "false",
            "underAvvikling": "false",
            "underTvangsavviklingEllerTvangsopplosning": "false",
            "fraAntallAnsatte": str(MIN_EMPLOYEES),
            "size": "100",
            "page": str(page),
        }
        data = fetch_json(f"{BASE}/enhetsregisteret/api/enheter?{urllib.parse.urlencode(params)}")
        units.extend(data.get("_embedded", {}).get("enheter", []))
        page += 1
        if page >= data["page"]["totalPages"]:
            break
    primary = [u for u in units if (u.get("naeringskode1") or {}).get("kode") == code]
    return primary, len(units) - len(primary)


# --- Description scoring ------------------------------------------------------


def description_of(unit: dict) -> str:
    parts = unit.get("aktivitet") or unit.get("vedtektsfestetFormaal") or []
    return " ".join(parts).strip()


@dataclass
class DescriptionScore:
    category: str  # "missing", "boilerplate", "generic", "specific"
    specific_words: list[str]
    themes: list[str]


def score_description(code: str, text: str) -> DescriptionScore:
    if not text:
        return DescriptionScore("missing", [], [])
    lowered = text.lower()
    stripped = lowered
    for pattern in BOILERPLATE:
        stripped = re.sub(pattern, " ", stripped)
    words = WORD.findall(stripped)
    ignore = STOPWORDS | GENERIC_BUSINESS | INDUSTRY_GENERIC.get(code, set())
    specific = sorted({w for w in words if w not in ignore and len(w) > 2})
    themes = [name for name, pattern in THEMES.get(code, {}).items() if re.search(pattern, lowered)]

    if not words:
        category = "boilerplate"
    elif len(specific) == 0:
        category = "boilerplate"
    elif len(specific) <= 2:
        category = "generic"
    else:
        category = "specific"
    return DescriptionScore(category, specific, themes)


# --- Financial sample ---------------------------------------------------------


@dataclass
class FilingCheck:
    orgnr: str
    has_filing: bool = False
    valuta: str | None = None
    regnskapsregler: str | None = None
    smaa_foretak: bool | None = None
    avviklingsregnskap: bool | None = None
    calendar_year: bool | None = None
    period_end: str | None = None
    # Whole kroner as integers. The API returns these as JSON numbers with
    # a trailing .0; they are converted straight to int, never kept as float.
    sum_driftsinntekter: int | None = None
    driftsresultat: int | None = None
    sum_eiendeler: int | None = None
    years_available: list[str] = field(default_factory=list)

    @property
    def comparable(self) -> bool:
        return (
            self.has_filing
            and self.valuta == "NOK"
            and self.regnskapsregler == "regnskapslovenAlminneligRegler"
            and self.avviklingsregnskap is False
            and self.calendar_year is True
        )


def to_int(value: object) -> int | None:
    if value is None:
        return None
    return int(Decimal(str(value)))


def check_filing(orgnr: str) -> FilingCheck:
    check = FilingCheck(orgnr)
    filings = fetch_json(f"{BASE}/regnskapsregisteret/regnskap/{orgnr}")
    selskap = [f for f in (filings or []) if f.get("regnskapstype") == "SELSKAP"]
    if selskap:
        filing = selskap[0]
        check.has_filing = True
        check.valuta = filing.get("valuta")
        # Note: the API spells this object "regnkapsprinsipper". Do not correct it.
        principles = filing.get("regnkapsprinsipper") or {}
        check.regnskapsregler = principles.get("regnskapsregler")
        check.smaa_foretak = principles.get("smaaForetak")
        check.avviklingsregnskap = filing.get("avviklingsregnskap")
        period = filing.get("regnskapsperiode") or {}
        start, end = period.get("fraDato", ""), period.get("tilDato", "")
        check.period_end = end
        check.calendar_year = start[5:] == "01-01" and end[5:] == "12-31" and start[:4] == end[:4]
        result = filing.get("resultatregnskapResultat") or {}
        operating = result.get("driftsresultat") or {}
        check.driftsresultat = to_int(operating.get("driftsresultat"))
        check.sum_driftsinntekter = to_int((operating.get("driftsinntekter") or {}).get("sumDriftsinntekter"))
        check.sum_eiendeler = to_int((filing.get("eiendeler") or {}).get("sumEiendeler"))
    years = fetch_json(f"{BASE}/regnskapsregisteret/regnskap/aarsregnskap/kopi/{orgnr}/aar")
    check.years_available = sorted(years) if isinstance(years, list) else []
    return check


def quartiles(values: list[Decimal]) -> tuple[Decimal, Decimal, Decimal] | None:
    if len(values) < 4:
        return None
    q1, q2, q3 = statistics.quantiles(values, n=4)
    return q1, q2, q3


# --- Report -------------------------------------------------------------------


def band_of(employees: int) -> str:
    for low, high in SIZE_BANDS:
        if employees >= low and (high is None or employees <= high):
            return f"{low}–{high}" if high else f"{low}+"
    return "<5"


def pct(part: int, whole: int) -> str:
    return "–" if whole == 0 else f"{round(100 * part / whole)} %"


def fmt_ratio(value: Decimal) -> str:
    return f"{(value * 100).quantize(Decimal('0.1'))} %"


def fmt_nok(value: Decimal) -> str:
    return f"{int(value):,}".replace(",", " ") + " kr"


def screen(code: str, name: str) -> tuple[str, dict]:
    print(f"\n== {code} {name}")
    total_as = count_units(code, None)
    at_least_20 = count_units(code, 20)
    population, secondary_only = fetch_population(code)
    print(f"   population: {len(population)} with ≥{MIN_EMPLOYEES} employees (primary code)")

    # Descriptions, scored over the whole population
    scored = []
    for unit in population:
        text = description_of(unit)
        scored.append((unit, text, score_description(code, text)))
    categories = {c: 0 for c in ("missing", "boilerplate", "generic", "specific")}
    theme_counts: dict[str, int] = {t: 0 for t in THEMES.get(code, {})}
    multi_theme = 0
    for _, _, s in scored:
        categories[s.category] += 1
        for t in s.themes:
            theme_counts[t] += 1
        if len(s.themes) >= 2:
            multi_theme += 1
    with_secondary = sum(1 for u in population if u.get("naeringskode2"))
    has_website = sum(1 for u in population if u.get("hjemmeside"))

    # Sample for the accounts checks
    rng = random.Random(SEED)
    sample = rng.sample(population, min(SAMPLE_SIZE, len(population)))
    checks = []
    for i, unit in enumerate(sample, 1):
        checks.append(check_filing(unit["organisasjonsnummer"]))
        if i % 25 == 0:
            print(f"   accounts sample: {i}/{len(sample)}")
    filed = [c for c in checks if c.has_filing]
    comparable = [c for c in checks if c.comparable]
    comparable_share = Decimal(len(comparable)) / Decimal(len(checks)) if checks else Decimal(0)

    employees_by_orgnr = {u["organisasjonsnummer"]: u.get("antallAnsatte") or 0 for u in population}
    margins = [
        Decimal(c.driftsresultat) / Decimal(c.sum_driftsinntekter)
        for c in comparable
        if c.sum_driftsinntekter and c.sum_driftsinntekter > 0 and c.driftsresultat is not None
    ]
    revenue_per_employee = [
        Decimal(c.sum_driftsinntekter) / Decimal(employees_by_orgnr[c.orgnr])
        for c in comparable
        if c.sum_driftsinntekter and employees_by_orgnr.get(c.orgnr)
    ]
    years_counts = [len(c.years_available) for c in checks]

    # Size bands, scaled by the comparable share from the sample
    bands: dict[str, int] = {}
    for unit in population:
        b = band_of(unit.get("antallAnsatte") or 0)
        bands[b] = bands.get(b, 0) + 1

    # OCR volume for the comparable population
    est_comparable = int(Decimal(len(population)) * comparable_share)
    documents_per_company = (TREND_YEARS + 1) // 2
    documents = est_comparable * documents_per_company
    pages = documents * GENERATED_PAGES_PER_FILING

    write_csvs(code, scored, checks, population)

    n = len(population)
    lines = [
        f"## {code} — {name}",
        "",
        "### 1. Population",
        "",
        f"- Active AS, any size: **{total_as}**",
        f"- With ≥ {MIN_EMPLOYEES} employees, code as *primary* industry: **{n}** "
        f"({secondary_only} more have it only as a secondary code and are excluded)",
        f"- With ≥ 20 employees: **{at_least_20}** (API count, primary or secondary code)",
        "",
        "| Employees | Companies | Est. comparable | Enough for a group of "
        f"{MIN_GROUP_SIZE}? |",
        "|---|---|---|---|",
    ]
    for low, high in SIZE_BANDS:
        label = f"{low}–{high}" if high else f"{low}+"
        count = bands.get(label, 0)
        est = int(Decimal(count) * comparable_share)
        lines.append(f"| {label} | {count} | {est} | {'yes' if est >= MIN_GROUP_SIZE else '**no**'} |")
    lines += [
        "",
        "### 2. Description quality (whole population, word-list proxy)",
        "",
        f"- Missing: {categories['missing']} ({pct(categories['missing'], n)})",
        f"- Boilerplate only: {categories['boilerplate']} ({pct(categories['boilerplate'], n)})",
        f"- Generic (1–2 distinguishing words): {categories['generic']} ({pct(categories['generic'], n)})",
        f"- **Specific (3+ distinguishing words): {categories['specific']} ({pct(categories['specific'], n)})**",
        f"- Has a website registered: {has_website} ({pct(has_website, n)})",
        "",
        "Examples:",
        "",
    ]
    for category in ("boilerplate", "generic", "specific"):
        examples = [t for _, t, s in scored if s.category == category][:3]
        for text in examples:
            lines.append(f"- *{category}*: “{text[:160]}”")
    lines += [
        "",
        "### 3. Heterogeneity (whole population, keyword proxy)",
        "",
        f"- Registered with a secondary industry code: {with_secondary} ({pct(with_secondary, n)})",
        f"- Description matches two or more business types: {multi_theme} ({pct(multi_theme, n)})",
        "",
        "| Business type | Companies | Share |",
        "|---|---|---|",
    ]
    for theme, count in sorted(theme_counts.items(), key=lambda kv: -kv[1]):
        lines.append(f"| {theme} | {count} | {pct(count, n)} |")

    lines += ["", f"### 4. Comparability (random sample of {len(checks)}, seed {SEED})", ""]
    lines += [
        f"- Has a filing in the key figures API: {len(filed)} ({pct(len(filed), len(checks))})",
        f"- Of those, reporting in NOK: {sum(1 for c in filed if c.valuta == 'NOK')}",
        f"- Ordinary accounting rules: {sum(1 for c in filed if c.regnskapsregler == 'regnskapslovenAlminneligRegler')}",
        f"- Calendar-year period: {sum(1 for c in filed if c.calendar_year)}",
        f"- Liquidation accounts: {sum(1 for c in filed if c.avviklingsregnskap)}",
        f"- `smaaForetak` true: {sum(1 for c in filed if c.smaa_foretak)} "
        "(not an exclusion — must match the subject)",
        f"- **Passes the comparability filter: {len(comparable)} ({pct(len(comparable), len(checks))})**",
        "",
    ]
    mq = quartiles(margins)
    rq = quartiles(revenue_per_employee)
    if mq:
        lines.append(
            f"- Operating margin (driftsresultat / sumDriftsinntekter): "
            f"Q1 {fmt_ratio(mq[0])} · median {fmt_ratio(mq[1])} · Q3 {fmt_ratio(mq[2])} "
            f"— spread Q3−Q1 {fmt_ratio(mq[2] - mq[0])}"
        )
    if rq:
        lines.append(
            f"- Revenue per employee: Q1 {fmt_nok(rq[0])} · median {fmt_nok(rq[1])} · Q3 {fmt_nok(rq[2])}"
            " (employees are today's count, revenue the latest filing — indicative only)"
        )
    lines += [
        "",
        "### 5. OCR volume (comparable population)",
        "",
        f"- Years of document copies available: median {statistics.median(years_counts) if years_counts else 0}, "
        f"min {min(years_counts, default=0)}, max {max(years_counts, default=0)}",
        f"- Estimated comparable companies: **{est_comparable}**",
        f"- For {TREND_YEARS} years of trend: {documents_per_company} documents each → "
        f"**{documents} filings, {pages} generated pages**",
        "",
    ]
    summary = {
        "code": code,
        "name": name,
        "population": n,
        "specific_share": pct(categories["specific"], n),
        "comparable_share": pct(len(comparable), len(checks)),
        "est_comparable": est_comparable,
        "themes_in_use": sum(1 for c in theme_counts.values() if n and c / n >= 0.05),
        "margin_spread": fmt_ratio(mq[2] - mq[0]) if mq else "–",
        "pages": pages,
    }
    return "\n".join(lines), summary


def write_csvs(code: str, scored: list, checks: list[FilingCheck], population: list[dict]) -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    slug = code.replace(".", "")
    names = {u["organisasjonsnummer"]: u.get("navn", "") for u in population}
    employees = {u["organisasjonsnummer"]: u.get("antallAnsatte") for u in population}

    with open(OUTPUT_DIR / f"descriptions-{slug}.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(
            ["orgnr", "navn", "ansatte", "hjemmeside", "beskrivelse", "auto_kategori",
             "auto_ord", "auto_typer", "manual_informativ (ja/nei)", "manual_forretningstype"]
        )
        for unit, text, s in scored:
            writer.writerow([
                unit["organisasjonsnummer"], unit.get("navn", ""), unit.get("antallAnsatte"),
                unit.get("hjemmeside", ""), text, s.category, " ".join(s.specific_words),
                ", ".join(s.themes), "", "",
            ])

    with open(OUTPUT_DIR / f"sample-accounts-{slug}.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(
            ["orgnr", "navn", "ansatte", "har_regnskap", "valuta", "regnskapsregler", "smaaForetak",
             "avviklingsregnskap", "kalenderaar", "periode_slutt", "sumDriftsinntekter",
             "driftsresultat", "sumEiendeler", "aar_tilgjengelig", "sammenlignbar"]
        )
        for c in checks:
            writer.writerow([
                c.orgnr, names.get(c.orgnr, ""), employees.get(c.orgnr), c.has_filing, c.valuta,
                c.regnskapsregler, c.smaa_foretak, c.avviklingsregnskap, c.calendar_year,
                c.period_end, c.sum_driftsinntekter, c.driftsresultat, c.sum_eiendeler,
                len(c.years_available), c.comparable,
            ])


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    codes = sys.argv[1:] or list(INDUSTRIES)
    unknown = [c for c in codes if c not in INDUSTRIES]
    if unknown:
        sys.exit(f"No word lists for {', '.join(unknown)}. Add them to INDUSTRIES, "
                 "INDUSTRY_GENERIC and THEMES first.")

    sections, summaries = [], []
    for code in codes:
        section, summary = screen(code, INDUSTRIES[code])
        sections.append(section)
        summaries.append(summary)

    header = [
        "# Industry screening",
        "",
        f"Generated {date.today().isoformat()} by `analysis/industry_screening.py` from the open "
        "Brreg APIs (Enhetsregisteret and Regnskapsregisteret). Industry codes are SN2025.",
        "",
        f"Population: active AS (not bankrupt, not in liquidation) with at least {MIN_EMPLOYEES} "
        f"employees and the code as primary industry. Minimum group size {MIN_GROUP_SIZE} is a "
        "placeholder until the brief decides it.",
        "",
        "**Sections 2 and 3 are word-list proxies, not measurements.** The CSV files in "
        "`analysis/output/` carry empty `manual_*` columns; scoring a sample of those by hand is "
        "what turns the proxy into a result.",
        "",
        "## Summary",
        "",
        "| Code | Industry | Companies ≥5 emp. | Specific descriptions | Comparable (sample) "
        "| Est. comparable | Business types ≥5 % | Margin spread Q3−Q1 | OCR pages (5 yrs) |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for s in summaries:
        header.append(
            f"| {s['code']} | {s['name']} | {s['population']} | {s['specific_share']} | "
            f"{s['comparable_share']} | {s['est_comparable']} | {s['themes_in_use']} | "
            f"{s['margin_spread']} | {s['pages']} |"
        )
    report = "\n".join(header) + "\n\n" + "\n\n".join(sections) + "\n"
    OUTPUT_DIR.mkdir(exist_ok=True)
    out = OUTPUT_DIR / "industry-screening.md"
    out.write_text(report, encoding="utf-8")
    print(f"\nReport written to {out.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
