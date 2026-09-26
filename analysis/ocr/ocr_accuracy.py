# /// script
# requires-python = ">=3.12"
# dependencies = ["pymupdf"]
# ///
"""How accurately can Tesseract read the Brreg-generated section, year by year?

For the companies in `filing-eras.md`, this OCRs the income statement and the
balance sheet of every generated filing in 2011-2016 and 2021-2025, parses the
two figure columns (this year and last year) by position, and checks the result
with the reconciliation rules from `docs/data-sources-brreg.md`:

  within a filing, a tight absolute bound of a few kroner -
  C1  sum inntekter - sum kostnader       = driftsresultat
  C2  driftsresultat + netto finans         = ordinært resultat før skattekostnad
  C3  sum eiendeler                         = sum egenkapital og gjeld
  C4  sum egenkapital + sum gjeld           = sum egenkapital og gjeld

and two independent comparisons -
  X   last year's column in year N's filing = this year's column in year N-1's
  API this year's column in the latest filing = the key figures API

There is no hand-transcribed truth yet, so this measures consistency, not
accuracy: a filing that passes every check is very unlikely to hold a wrong
figure, because recognition errors are wrong by orders of magnitude.

Each page is read twice: a plain pass for the labels, and a digits-only pass
(`tessedit_char_whitelist`) for the figures. The report shows both, so the
effect of that one piece of tuning is measured rather than assumed.

Run:  uv run analysis/ocr/ocr_accuracy.py   (after era_screening.py)
"""

from __future__ import annotations

import csv
import difflib
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CACHE = ROOT / ".cache" / "ocr"
OUTPUT = ROOT / "output"

KOPI = "https://data.brreg.no/regnskapsregisteret/regnskap/aarsregnskap/kopi"
API = "https://data.brreg.no/regnskapsregisteret/regnskap"
USER_AGENT = "Peerless student project (IBE160, Hogskolen i Molde)"

OLD_YEARS = list(range(2011, 2017))
RECENT_YEARS = list(range(2021, 2026))
PAGES = [1, 2, 3, 4]  # zero-based: the generated section follows the cover page
PARALLEL = 8
ZOOM = 2.5  # the embedded images are ~200 dpi, 1-bit; Tesseract reads better enlarged
TOLERANCE_KR = 5  # "a few kroner": the register rounds øre to whole kroner

DIGITS_CONFIG = "-c tessedit_char_whitelist=0123456789-"

# Target rows. A row matches when its label, joined with the label-only lines
# directly above it and normalised, ends with one of the variants.
TARGETS = {
    "inntekter": ["suminntekter", "sumdriftsinntekter"],
    "kostnader": ["sumkostnader", "sumdriftskostnader", "sumdriftskostnad"],
    "driftsresultat": ["driftsresultat"],
    "nettofinans": ["nettofinans", "nettofinansposter", "nettofinansresultat"],
    "resultatforskatt": ["ordinaertresultatforskattekostnad", "resultatforskattekostnad"],
    "eiendeler": ["sumeiendeler"],
    "egenkapital": ["sumegenkapital"],
    "gjeld": ["sumgjeld"],
    "ekoggjeld": ["sumegenkapitaloggjeld"],
}


# --- Fetching -----------------------------------------------------------------

def fetch(url: str, target: Path, accept: str | None = None) -> bool:
    if target.exists():
        return target.stat().st_size > 0
    headers = {"User-Agent": USER_AGENT}
    if accept:
        headers["Accept"] = accept
    request = urllib.request.Request(url, headers=headers)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                target.write_bytes(response.read())
            time.sleep(0.2)
            return True
        except urllib.error.HTTPError as error:
            if error.code == 404:
                target.write_bytes(b"")
                return False
            if attempt < 3:
                time.sleep(2**attempt)
                continue
            raise
    return False


# --- OCR ----------------------------------------------------------------------

def render(pdf: Path, page: int) -> Path | None:
    png = CACHE / f"{pdf.stem}.p{page + 1}.png"
    if not png.exists():
        doc = pymupdf.open(pdf)
        if page >= doc.page_count:
            return None
        doc[page].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM)).save(png)
    return png


def ocr_all(pngs: list[Path]) -> None:
    """Two passes per page in a single container run."""
    todo = [p.name for p in pngs
            if not p.with_suffix(".txt.tsv").exists() or not p.with_suffix(".dig.tsv").exists()]
    if not todo:
        return
    (CACHE / "ocr_todo.txt").write_text("\n".join(todo) + "\n", encoding="utf-8", newline="\n")
    one = ('b="${1%.png}"; '
           'tesseract "$1" "$b.txt" -l nor --psm 6 tsv >/dev/null 2>&1; '
           f'tesseract "$1" "$b.dig" -l nor --psm 6 {DIGITS_CONFIG} tsv >/dev/null 2>&1')
    # Pages in parallel; one Tesseract thread each, so the cores are not oversubscribed.
    script = f"export OMP_THREAD_LIMIT=1; xargs -P {PARALLEL} -I{{}} sh -c '{one}' _ {{}} < ocr_todo.txt"
    print(f"OCR: {len(todo)} pages, two passes each")
    subprocess.run(["docker", "run", "--rm", "-v", f"{CACHE}:/work", "--entrypoint", "sh",
                    "peerless-tesseract", "-c", script], check=True)


@dataclass
class Word:
    text: str
    left: int
    top: int
    width: int
    height: int
    line: tuple

    @property
    def right(self) -> int:
        return self.left + self.width

    @property
    def mid_y(self) -> float:
        return self.top + self.height / 2


def read_tsv(path: Path) -> list[Word]:
    words = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            text = (row.get("text") or "").strip()
            if row.get("level") != "5" or not text:
                continue
            words.append(Word(text, int(row["left"]), int(row["top"]), int(row["width"]),
                              int(row["height"]), (row["block_num"], row["par_num"], row["line_num"])))
    return words


# --- Parsing ------------------------------------------------------------------

def normalise(label: str) -> str:
    label = label.lower().replace("æ", "ae").replace("ø", "o").replace("å", "a")
    label = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", label)


YEAR = re.compile(r"^(19|20)\d\d$")


@dataclass
class Row:
    label: str
    y: float
    has_number: bool
    current: int | None = None
    prior: int | None = None


@dataclass
class Page:
    kind: str  # "resultat", "balanse" or "other"
    rows: list[Row] = field(default_factory=list)


def group_lines(words: list[Word]) -> list[list[Word]]:
    lines: dict[tuple, list[Word]] = {}
    for w in words:
        lines.setdefault(w.line, []).append(w)
    return sorted((sorted(ws, key=lambda w: w.left) for ws in lines.values()),
                  key=lambda ws: ws[0].top)


def column_edges(label_words: list[Word]) -> tuple[int, int, float] | None:
    """Right edges of the two figure columns, from the year header line."""
    for line in group_lines(label_words):
        years = [w for w in line if YEAR.match(w.text)]
        if len(years) >= 2:
            a, b = years[-2], years[-1]
            pitch = (a.width + b.width) / 8  # four characters each
            return a.right, b.right, pitch
    return None


def parse_number(tokens: list[Word], pitch: float) -> int | None:
    """Join digit groups into one figure, or refuse. Never guess."""
    if not tokens:
        return None
    # The digits-only pass drops the thousands spaces and returns one token.
    if len(tokens) == 1 and re.fullmatch(r"-?\d{1,10}", tokens[0].text):
        return int(tokens[0].text)
    text = [t.text for t in tokens]
    negative = False
    if text[0] == "-":
        negative, tokens, text = True, tokens[1:], text[1:]
    elif text[0].startswith("-"):
        negative, text = True, [text[0][1:]] + text[1:]
    if not text or not all(t.isdigit() for t in text):
        return None
    if not (1 <= len(text[0]) <= 3) or not all(len(t) == 3 for t in text[1:]):
        return None
    for a, b in zip(tokens, tokens[1:]):
        if b.left - a.right > 1.8 * pitch:  # more than one space between groups
            return None
    value = int("".join(text))
    return -value if negative else value


def parse_page(label_words: list[Word], number_words: list[Word],
               previous: tuple[str, tuple | None] = ("other", None)) -> tuple[Page, tuple | None]:
    """A continuation page has no heading or year header; it inherits both
    from the page before, since the generated layout is identical."""
    all_text = normalise(" ".join(w.text for w in label_words))
    kind = "resultat" if "resultatregnskap" in all_text else "balanse" if "balanse" in all_text else "other"
    edges = column_edges(label_words)
    if not edges and previous[1]:
        edges = previous[1]
        if kind == "other":
            kind = previous[0]
    page = Page(kind)
    if not edges:
        return page, None
    cur_right, prior_right, pitch = edges
    number_zone_left = cur_right - 13 * pitch  # widest figure: "-999 999 999"
    split = (cur_right + prior_right) / 2 - 4 * pitch

    for line in group_lines(label_words):
        label_part = [w for w in line if w.right < number_zone_left]
        label = " ".join(w.text for w in label_part)
        y = sum(w.mid_y for w in line) / len(line)
        near = [w for w in number_words
                if abs(w.mid_y - y) < 0.6 * line[0].height + 8 and w.left >= number_zone_left]
        near.sort(key=lambda w: w.left)
        cur = parse_number([w for w in near if w.right <= split], pitch)
        prior = parse_number([w for w in near if w.right > split], pitch)
        has_number = any(w.left >= number_zone_left for w in line)
        page.rows.append(Row(label, y, has_number, cur, prior))
    return page, edges


LABEL_SIMILARITY = 0.85  # tolerates OCR slips such as "Driftoreoultat" for "Driftsresultat"


def similar(label: str, variant: str) -> bool:
    """A row's own label is the variant with a few characters misread.
    Lengths must be close, so "Annen driftskostnad" never passes for
    "Sum driftskostnad" nor "Sum innskutt egenkapital" for "Sum egenkapital"."""
    if abs(len(label) - len(variant)) > 1:
        return False
    return difflib.SequenceMatcher(None, label, variant).ratio() >= LABEL_SIMILARITY


def extract(pages: list[Page]) -> dict[str, tuple[int | None, int | None]]:
    """Exact matches first, over every page; a fuzzy match only for a figure
    that no row matched exactly."""
    candidates: list[tuple[str, str, Row]] = []  # (joined label, own label, row)
    for page in pages:
        if page.kind == "other":
            continue
        rows = page.rows
        for i, row in enumerate(rows):
            if not row.has_number:
                continue
            own = normalise(row.label)
            joined = own
            j = i - 1
            while j >= 0 and not rows[j].has_number and i - j <= 3:
                joined = normalise(rows[j].label) + joined
                j -= 1
            candidates.append((joined, own, row))

    found: dict[str, tuple[int | None, int | None]] = {}
    for key, variants in TARGETS.items():
        for joined, _, row in candidates:
            if any(joined.endswith(v) for v in variants):
                found[key] = (row.current, row.prior)
                break
    for key, variants in TARGETS.items():
        if key in found:
            continue
        for _, own, row in candidates:
            if any(similar(own, v) for v in variants):
                found[key] = (row.current, row.prior)
                break
    return found


# --- Checks -------------------------------------------------------------------

def close(a: int | None, b: int | None) -> bool | None:
    if a is None or b is None:
        return None
    return abs(a - b) <= TOLERANCE_KR


def checks(fig: dict[str, tuple[int | None, int | None]], col: int) -> dict[str, bool | None]:
    v = {k: val[col] for k, val in fig.items()}
    g = v.get

    def diff(a, b):
        return None if a is None or b is None else a - b

    def add(a, b):
        return None if a is None or b is None else a + b

    return {
        "C1": close(diff(g("inntekter"), g("kostnader")), g("driftsresultat")),
        "C2": close(add(g("driftsresultat"), g("nettofinans")), g("resultatforskatt")),
        "C3": close(g("eiendeler"), g("ekoggjeld")),
        "C4": close(add(g("egenkapital"), g("gjeld")), g("ekoggjeld")),
    }


API_FIELDS = {
    "inntekter": ("resultatregnskapResultat", "driftsresultat", "driftsinntekter", "sumDriftsinntekter"),
    "driftsresultat": ("resultatregnskapResultat", "driftsresultat", "driftsresultat"),
    "eiendeler": ("eiendeler", "sumEiendeler"),
    "egenkapital": ("egenkapitalGjeld", "egenkapital", "sumEgenkapital"),
}


def api_figures(orgnr: str) -> tuple[str | None, dict[str, int]]:
    target = CACHE / f"{orgnr}-api.json"
    fetch(f"{API}/{orgnr}", target, accept="application/json")
    raw = target.read_bytes() if target.exists() else b""
    filings = [f for f in (json.loads(raw) if raw else []) if f.get("regnskapstype") == "SELSKAP"]
    if not filings:
        return None, {}
    f = filings[0]
    out = {}
    for key, path in API_FIELDS.items():
        node = f
        for step in path:
            node = (node or {}).get(step)
        if node is not None:
            out[key] = int(round(float(node)))
    return (f.get("regnskapsperiode") or {}).get("tilDato", "")[:4], out


# --- Main ---------------------------------------------------------------------

def era_of(pdf: Path) -> str:
    txt = pdf.with_suffix(".p1top.txt")
    if txt.exists():
        t = txt.read_text(encoding="utf-8", errors="replace").upper()
        return "generated" if "GENERELL INFORMASJON" in t else "paper" if "VEDLEGG TIL" in t else "unknown"
    return "unknown"


def companies_from_era_report() -> list[str]:
    text = (OUTPUT / "filing-eras.md").read_text(encoding="utf-8")
    return sorted(set(re.findall(r"^\| \d{5} \| (\d{9}) \|", text, re.M)))


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    orgnrs = companies_from_era_report()
    if len(sys.argv) > 1:  # a quick trial on the first N companies
        orgnrs = orgnrs[: int(sys.argv[1])]
    filings: list[tuple[str, int, Path]] = []
    for orgnr in orgnrs:
        years_file = CACHE / f"{orgnr}-aar.json"
        years = set(json.loads(years_file.read_bytes() or b"[]")) if years_file.exists() else set()
        for y in OLD_YEARS + RECENT_YEARS:
            if str(y) not in years:
                continue
            pdf = CACHE / f"{orgnr}-{y}.pdf"
            if fetch(f"{KOPI}/{orgnr}/{y}", pdf):
                filings.append((orgnr, y, pdf))

    # Era for the recent years: OCR the top of page 1 the same way as era_screening.
    missing = [pdf for _, _, pdf in filings if not pdf.with_suffix(".p1top.txt").exists()]
    if missing:
        tops = []
        for pdf in missing:
            doc = pymupdf.open(pdf)
            p = doc[0]
            png = pdf.with_suffix(".p1top.png")
            p.get_pixmap(dpi=150, clip=pymupdf.Rect(0, 0, p.rect.width, p.rect.height * 0.3)).save(png)
            tops.append(png.name)
        (CACHE / "top_todo.txt").write_text("\n".join(tops) + "\n", encoding="utf-8", newline="\n")
        subprocess.run(["docker", "run", "--rm", "-v", f"{CACHE}:/work", "--entrypoint", "sh",
                        "peerless-tesseract", "-c",
                        'while read f; do tesseract "$f" "${f%.png}" -l nor --psm 6 >/dev/null 2>&1; done < top_todo.txt'],
                       check=True)

    generated = [(o, y, p) for o, y, p in filings if era_of(p) == "generated"]
    print(f"{len(filings)} filings, {len(generated)} generated, {len(orgnrs)} companies")

    pngs: dict[tuple[str, int], list[Path]] = {}
    for orgnr, y, pdf in generated:
        pngs[(orgnr, y)] = [png for page in PAGES if (png := render(pdf, page))]
    ocr_all([p for ps in pngs.values() for p in ps])

    results = {}
    for (orgnr, y), ps in pngs.items():
        for mode in ("plain", "digits"):
            pages = []
            previous: tuple[str, tuple | None] = ("other", None)
            for png in ps:
                label_words = read_tsv(png.with_suffix(".txt.tsv"))
                number_words = label_words if mode == "plain" else read_tsv(png.with_suffix(".dig.tsv"))
                page, edges = parse_page(label_words, number_words, previous)
                previous = (page.kind, edges)
                pages.append(page)
            results[(orgnr, y, mode)] = extract(pages)
        # Combined: the plain read where its digit grouping is valid, the
        # digits-only read only where the plain read gave nothing.
        plain, digits = results[(orgnr, y, "plain")], results[(orgnr, y, "digits")]
        combined = {}
        for k in set(plain) | set(digits):
            a, b = plain.get(k, (None, None)), digits.get(k, (None, None))
            combined[k] = (a[0] if a[0] is not None else b[0], a[1] if a[1] is not None else b[1])
        results[(orgnr, y, "combined")] = combined

    write_report(orgnrs, filings, generated, results)


def summarise(keys, results, mode):
    n = 0
    fields_found = fields_total = 0
    passed_all = evaluable = 0
    check_pass = {c: [0, 0] for c in ("C1", "C2", "C3", "C4")}
    for orgnr, y in keys:
        fig = results[(orgnr, y, mode)]
        n += 1
        for col in (0, 1):
            fields_total += len(TARGETS)
            fields_found += sum(1 for k in TARGETS if fig.get(k, (None, None))[col] is not None)
            c = checks(fig, col)
            for name, ok in c.items():
                if ok is not None:
                    check_pass[name][1] += 1
                    check_pass[name][0] += ok
            core = [c["C1"], c["C3"]]
            if all(x is not None for x in core):
                evaluable += 1
                passed_all += all(x for x in c.values() if x is not None)
    return n, fields_found, fields_total, passed_all, evaluable, check_pass


def pct(a, b):
    return "–" if not b else f"{round(100 * a / b)} %"


def write_report(orgnrs, filings, generated, results) -> None:
    buckets = {"2011–2013": range(2011, 2014), "2014–2016": range(2014, 2017),
               "2021–2025": range(2021, 2026)}
    keys = [(o, y) for o, y, _ in generated]
    lines = [
        "# OCR consistency of the generated section, by era",
        "",
        f"Generated {date.today().isoformat()} by `analysis/ocr/ocr_accuracy.py`. "
        f"{len(orgnrs)} companies from `filing-eras.md`; {len(filings)} filings in "
        f"{OLD_YEARS[0]}–{OLD_YEARS[-1]} and {RECENT_YEARS[0]}–{RECENT_YEARS[-1]}, of which "
        f"{len(generated)} are generated. Tesseract 5, Norwegian model, untuned apart from the "
        "digits-only pass. Each filing gives two columns (this year, last year).",
        "",
        "**This measures consistency, not accuracy.** No hand-transcribed truth exists yet. "
        f"A column passes when every evaluable check holds within {TOLERANCE_KR} kroner and both "
        "core checks (C1 income statement, C3 balance) could be evaluated.",
        "",
    ]
    for mode, title in (("plain", "Plain pass (labels and figures from one read)"),
                        ("digits", "Digits-only pass for the figures"),
                        ("combined", "Combined: plain where well-formed, digits-only as fallback")):
        lines += [f"## {title}", "", "| Years | Filings | Figures recovered | Columns passing | C1 | C2 | C3 | C4 |",
                  "|---|---|---|---|---|---|---|---|"]
        for name, years in list(buckets.items()) + [("All", range(0, 3000))]:
            ks = [k for k in keys if k[1] in years]
            n, ff, ft, pa, ev, cp = summarise(ks, results, mode)
            cells = " | ".join(pct(*cp[c]) for c in ("C1", "C2", "C3", "C4"))
            lines.append(f"| {name} | {n} | {pct(ff, ft)} | {pct(pa, ev)} of {ev} | {cells} |")
        lines.append("")

    # Cross-filing agreement and API agreement, digits mode
    agree = total = 0
    for orgnr, y in keys:
        prev = results.get((orgnr, y - 1, "combined"))
        cur = results[(orgnr, y, "combined")]
        if not prev:
            continue
        for k in TARGETS:
            a = cur.get(k, (None, None))[1]
            b = prev.get(k, (None, None))[0]
            if a is not None and b is not None:
                total += 1
                agree += abs(a - b) <= TOLERANCE_KR
    api_agree = api_total = 0
    api_rows = []
    for orgnr in orgnrs:
        year, fig = api_figures(orgnr)
        if not year or not year.isdigit():
            continue
        doc = results.get((orgnr, int(year), "combined"))
        if not doc:
            continue
        for k, v in fig.items():
            got = doc.get(k, (None, None))[0]
            if got is None:
                continue
            api_total += 1
            ok = abs(got - v) <= TOLERANCE_KR
            api_agree += ok
            if not ok:
                api_rows.append(f"| {orgnr} | {year} | {k} | {v:,} | {got:,} |".replace(",", " "))
    lines += [
        "## Independent comparisons (combined)",
        "",
        f"- **Last year's column against the previous filing's own figure:** {agree} of {total} agree ({pct(agree, total)}). "
        "Two readings of the same figure from two different documents.",
        f"- **Latest filing against the key figures API:** {api_agree} of {api_total} agree ({pct(api_agree, api_total)}).",
        "",
    ]
    if api_rows:
        lines += ["Disagreements with the API:", "", "| Orgnr | Year | Figure | API | OCR |", "|---|---|---|---|---|", *api_rows, ""]

    # Failing columns, for inspection
    fails = []
    for orgnr, y in keys:
        fig = results[(orgnr, y, "combined")]
        for col, colname in ((0, "this year"), (1, "last year")):
            c = checks(fig, col)
            bad = [n for n, ok in c.items() if ok is False]
            if bad:
                fails.append(f"| {orgnr} | {y} | {colname} | {', '.join(bad)} |")
    lines += ["## Failing columns (combined)", "", "| Orgnr | Year | Column | Failed |", "|---|---|---|---|", *fails, ""]

    out = OUTPUT / "ocr-consistency.md"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Report written to {out.relative_to(ROOT.parent)}")
    print("\n".join(l for l in lines if l.startswith("| 20") or l.startswith("| All") or l.startswith("- **")))


if __name__ == "__main__":
    main()
