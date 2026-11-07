# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Cost lines that do not sum, and digit tokens too narrow for their digits: the read-only probe of Story 2.5c.

Story 2.5c refuses a figure token narrower than its digit count at the
page's character pitch, and considers a rule that keeps a column whose cost
lines do not sum out of the fingerprint. Before anything in `ingest/` or
`src/engine` changes, this probe runs step 1's own recognition, row parsing
and combined read (`documents.recognise`, `layout.parse_page`,
`documents.read_words`) on stored documents and reports, as totals:

(a) For each column whose four main cost lines are read and that sums under
    `sum_driftskostnad` by more than 5 kr, the cause, with the income
    statement's rows and OCR words as evidence. The columns over the total
    are probed the same way, as a control for (b).
(b) The width rule, measured on the recognised words before it is built:
    per digit token, its width against its digit count times
    `Edges.pitch`; per candidate threshold, the tokens it refuses and the
    figures the combined read then loses or changes. On the OCR reference
    set the figures are compared with the transcription, so a correct
    figure refused is counted as a cost.
(c) The four lines no within-document check covers (`salgsinntekt`,
    `kundefordringer`, `bankinnskudd`, `leverandorgjeld`): their classes on
    the reference set, and whether an ordering check against a total that
    is read today, or a printed sub-total row, would have caught an error.

The documents:

- the OCR reference set (`analysis/ocr-reference/drawn.json`), its PDFs
  from `.local/ocr-reference/` (gitignored);
- every 2.1b document with a reconciled column whose `avskrivninger` was
  NULL before Story 2.5b's re-read (`.local/document-run-2.4/`), whose four
  main cost lines are read, and whose lines miss `sum_driftskostnad` by
  more than 5 kr (the 48 columns of `deferred-work.md`, `3d1a03d`);
- every 2.1b document with a reconciled column where an unguarded line
  exceeds a total it is part of, by more than 5 kr (`salgsinntekt` over
  `sum_driftsinntekter`, `leverandorgjeld` over `sum_kortsiktig_gjeld`,
  `kundefordringer` or `bankinnskudd` over the key-figures API's
  `sum_omloepsmidler` of the filing), for (c);
- a seeded draw (seed 20261106, 100 documents) of the other 2.1b
  documents, for the rate at which the rule refuses tokens.

The 2.1b rows are read from the local database with `psql` in
`supabase_db_peerless`, in a read-only transaction. Nothing is written to
the database. No fingerprint or business type is computed or shown. The
recognised words are cached in `analysis/.cache/ocr/probe/` (gitignored,
shared with Story 2.5b's probe), so a rerun does no OCR.

Writes `analysis/output/cost-sum-probe.md` and `.json`.

Run (host, from the repository root, after `docker build --tag peerless-ingest:local ingest`):
    uv run analysis/ocr/cost_sum.py
It runs itself inside the image with `--in-image`; that mode is not for
direct use.
"""

from __future__ import annotations

import csv
import json
import random
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ANALYSIS = HERE.parent
REPO = ANALYSIS.parent
REFERENCE_PDFS = REPO / ".local" / "ocr-reference"
BEFORE_2_5B = REPO / ".local" / "document-run-2.4" / "document_column.csv"
RUN_2_5B = REPO / ".local" / "document-run-2.5b" / "document.csv"
CACHE = ANALYSIS / ".cache" / "ocr" / "probe"
OUT_MD = ANALYSIS / "output" / "cost-sum-probe.md"
OUT_JSON = ANALYSIS / "output" / "cost-sum-probe.json"

KOPI = "https://data.brreg.no/regnskapsregisteret/regnskap/aarsregnskap/kopi"
USER_AGENT = "Peerless student project (IBE160, Hogskolen i Molde)"
IMAGE = "peerless-ingest:local"
DB_CONTAINER = "supabase_db_peerless"
SEED = 20261106
DRAW = 100
TODO = "todo-2.5c.json"
BOUND_ORE = 500  # 5 kr, the within-document bound of ingest/config.toml, in øre

MAIN_LINES = ("varekostnad", "lonnskostnad", "avskrivninger", "annen_driftskostnad")
COST_LINES = ("varekostnad", "lonnskostnad", "avskrivninger", "nedskrivninger", "annen_driftskostnad")
UNGUARDED = ("salgsinntekt", "kundefordringer", "bankinnskudd", "leverandorgjeld")
# Candidate rules (b): a digit token is refused when its width is below
# k x (its digits, a "1" counted as `one`) x pitch.
THRESHOLDS = (0.5, 0.6, 0.7, 0.8)
ONE_WEIGHTS = (1.0, 0.5)
# Printed sub-total rows a check for (c) could use, as folded label endings.
SUBTOTALS = {
    "sum_fordringer": ("sumfordringer",),
    "sum_omlopsmidler": ("sumomlopsmidler",),
    "sum_anleggsmidler": ("sumanleggsmidler",),
    "annen_driftsinntekt": ("annendriftsinntekt", "andredriftsinntekter"),
    "sum_bankinnskudd": ("sumbankinnskuddkontanteroglignende",),
}


# --- Host ------------------------------------------------------------------------


def fetch(url: str, target: Path) -> None:
    """The document at `url` into `target`, unless present. The register
    refuses `Accept: application/pdf` (406); it serves octet-stream."""
    if target.exists() and target.stat().st_size > 0:
        return
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/octet-stream"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                target.write_bytes(response.read())
            time.sleep(0.2)
            return
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def read_csv(path: Path, delimiter: str) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter=delimiter))


def psql(sql: str) -> list[list[str]]:
    out = subprocess.run(
        ["docker", "exec", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-F", "\t",
         "-v", "ON_ERROR_STOP=1", "-c", f"begin read only; {sql}; commit;"],
        check=True, capture_output=True, text=True, encoding="utf-8",
    )  # fmt: skip
    return [line.split("\t") for line in out.stdout.splitlines() if "\t" in line]


FIGURE_COLUMNS = (
    "salgsinntekt", "sum_driftsinntekter", "varekostnad", "lonnskostnad", "avskrivninger", "nedskrivninger",
    "annen_driftskostnad", "sum_driftskostnad", "driftsresultat", "sum_immaterielle_eiendeler",
    "sum_varige_driftsmidler", "varer", "kundefordringer", "bankinnskudd", "sum_eiendeler", "leverandorgjeld",
    "sum_kortsiktig_gjeld",
)  # fmt: skip


def stored_2_1b() -> list[dict[str, object]]:
    """Every stored column of a 2.1b document (the orgnrs of the 2.5b dump),
    from the local database."""
    orgnrs = {r["orgnr"] for r in read_csv(RUN_2_5B, ",")}
    cols = ", ".join(f"{f}_ore" for f in FIGURE_COLUMNS)
    rows = psql(f"select orgnr, filing_year, role, coalesce(status, ''), {cols} from register.document_column order by 1, 2, 3")
    out = []
    for r in rows:
        if r[0] not in orgnrs:
            continue
        figures = {f: (int(v) if v != "" else None) for f, v in zip(FIGURE_COLUMNS, r[4:], strict=True)}
        out.append({"orgnr": r[0], "year": int(r[1]), "role": r[2], "status": r[3], "figures": figures})
    return out


def lines_minus_total(f: dict[str, int | None]) -> int | None:
    """The five cost lines (nedskrivninger 0 when absent) minus
    sum_driftskostnad, in øre; None unless the four main lines and the
    total are read."""
    if f["sum_driftskostnad"] is None or any(f[k] is None for k in MAIN_LINES):
        return None
    return sum(f[k] for k in MAIN_LINES) + (f["nedskrivninger"] or 0) - f["sum_driftskostnad"]  # type: ignore[operator]


def not_summing(columns: list[dict[str, object]]) -> list[dict[str, object]]:
    """The 48 columns of `3d1a03d`: reconciled, `avskrivninger` new since
    the 2.4 dump, the four main lines read, more than 5 kr off the total."""
    before = {(r["orgnr"], int(r["filing_year"]), r["role"]): r for r in read_csv(BEFORE_2_5B, ",")}
    out = []
    for c in columns:
        old = before.get((c["orgnr"], c["year"], c["role"]))
        f = c["figures"]
        if old is None or c["status"] != "reconciled" or old["avskrivninger_ore"] != "" or f["avskrivninger"] is None:
            continue
        d = lines_minus_total(f)
        if d is not None and abs(d) > BOUND_ORE:
            out.append({**c, "diff_ore": d})
    return out


ORDERING_SQL = (
    "select dc.orgnr, dc.filing_year, dc.role, x.check_name, x.line_ore, x.total_ore"
    " from register.document_column dc"
    " join register.document d using (orgnr, filing_year)"
    " left join register.key_figures k on k.brreg_id = d.brreg_id and dc.role = 'current'"
    " cross join lateral (values"
    " ('salgsinntekt>sum_driftsinntekter', dc.salgsinntekt_ore, dc.sum_driftsinntekter_ore),"
    " ('leverandorgjeld>sum_kortsiktig_gjeld', dc.leverandorgjeld_ore, dc.sum_kortsiktig_gjeld_ore),"
    " ('kundefordringer>api_sum_omloepsmidler', dc.kundefordringer_ore, k.sum_omloepsmidler_ore),"
    " ('bankinnskudd>api_sum_omloepsmidler', dc.bankinnskudd_ore, k.sum_omloepsmidler_ore)"
    " ) as x(check_name, line_ore, total_ore)"
    " where dc.status = 'reconciled' and x.line_ore > x.total_ore + 500"
    " order by 1, 2, 3, 4"
)


def ordering_fails(orgnrs: set[str]) -> list[dict[str, object]]:
    """Every reconciled 2.1b column where an unguarded line exceeds a total
    it is part of by more than 5 kr."""
    return [
        {"orgnr": r[0], "year": int(r[1]), "role": r[2], "check": r[3], "line_kr": int(r[4]) // 100, "total_kr": int(r[5]) // 100}
        for r in psql(ORDERING_SQL)
        if r[0] in orgnrs
    ]


def host() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    drawn = json.loads((REPO / "analysis" / "ocr-reference" / "drawn.json").read_text(encoding="utf-8"))
    ref_docs = sorted({(str(d["orgnr"]), int(d["year"])) for d in drawn["cells"]})
    columns = stored_2_1b()
    off = not_summing(columns)
    off_docs = sorted({(c["orgnr"], c["year"]) for c in off})
    ordering = ordering_fails({str(c["orgnr"]) for c in columns})
    ordering_docs = sorted({(o["orgnr"], o["year"]) for o in ordering} - set(off_docs))
    population = sorted({(c["orgnr"], c["year"]) for c in columns} - set(off_docs) - set(ordering_docs))
    draw_docs = sorted(random.Random(SEED).sample(population, min(DRAW, len(population))))
    print(f"reference {len(ref_docs)}, not summing {len(off)} columns in {len(off_docs)} documents, "
          f"draw {len(draw_docs)} of {len(population)}", file=sys.stderr)  # fmt: skip

    todo = []
    for orgnr, year in ref_docs:
        target = CACHE / f"{orgnr}-{year}.pdf"
        source = REFERENCE_PDFS / f"{orgnr}-{year}.pdf"
        if not target.exists():
            if source.exists():
                target.write_bytes(source.read_bytes())
            else:
                fetch(f"{KOPI}/{orgnr}/{year}", target)
        todo.append({"orgnr": orgnr, "year": year, "set": "reference"})
    for group, docs in (("not_summing", off_docs), ("ordering", ordering_docs), ("draw", draw_docs)):
        for orgnr, year in docs:
            fetch(f"{KOPI}/{orgnr}/{year}", CACHE / f"{orgnr}-{year}.pdf")
            todo.append({"orgnr": orgnr, "year": year, "set": group})
    (CACHE / TODO).write_text(json.dumps(todo) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(todo)} documents; reading them in {IMAGE}", file=sys.stderr)
    result = subprocess.run(
        [
            "docker", "run", "--rm",
            "--mount", f"type=bind,source={CACHE},target=/work",
            "--mount", f"type=bind,source={HERE},target=/scripts,readonly",
            "--entrypoint", "/app/.venv/bin/python",
            IMAGE, "/scripts/cost_sum.py", "--in-image", f"/work/{TODO}",
        ],
        check=True,
        stdout=subprocess.PIPE,
    )  # fmt: skip
    docs = json.loads(result.stdout)
    transcribed = {
        (r["orgnr"], int(r["filing_year"]), r["column"]): r
        for r in read_csv(REPO / "analysis" / "ocr-reference" / "transcriptions.csv", ";")
    }
    seeded = {
        (r["orgnr"], int(r["filing_year"]), r["role"]): r for r in read_csv(REPO / "seed" / "demo" / "document_column.csv", ",")
    }
    report = analyse(docs, off, columns, transcribed, seeded)
    report["ordering_fails"] = ordering_evidence(ordering, docs)
    report["generated"] = date.today().isoformat()
    report["sets"] = {"reference": len(ref_docs), "not_summing_columns": len(off), "not_summing_documents": len(off_docs),
                      "ordering_columns": len(ordering), "ordering_documents": len(ordering_docs),
                      "draw": len(draw_docs), "draw_population": len(population), "seed": SEED}  # fmt: skip
    OUT_JSON.write_text(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    OUT_MD.write_text(markdown(report), encoding="utf-8", newline="\n")
    print(f"wrote {OUT_MD.relative_to(REPO)} and {OUT_JSON.relative_to(REPO)}", file=sys.stderr)


# --- Host: analysis of the image's output ------------------------------------------


def ordering_evidence(ordering: list[dict[str, object]], docs: dict) -> list[dict[str, object]]:
    """Each ordering failure with the field's row tokens and widths as read,
    and what each candidate width rule makes of the figure."""
    by_doc = {(d["orgnr"], d["year"]): d for d in docs["documents"]}
    out = []
    for o in ordering:
        d = by_doc.get((o["orgnr"], o["year"]))
        field = str(o["check"]).split(">")[0]
        entry = dict(o)
        if d is None or d["read"].get(o["role"]) is None:
            out.append(entry | {"probed": False})
            continue
        idx = 0 if o["role"] == "current" else 1
        tokens = d["field_tokens"].get(field, {}).get(o["role"])
        entry |= {
            "probed": True,
            "field": field,
            "read_kr": d["read"][o["role"]]["figures"][field],
            "tokens": tokens,
            "widths": d["field_widths"].get(field, {}).get(o["role"]),
            "pitch": d["field_pitch"].get(field),
            "rules": {name: (r.get(o["role"]) or {}).get("figures", {}).get(field) for name, r in d["rules"].items()},
        }
        entry |= classify_ordering(entry, d, idx)
        out.append(entry)
    return out


def figure_in(row: dict | None, idx: int) -> int | None:
    if row is None:
        return None
    return row["plain"][idx] if row["plain"][idx] is not None else row["digits"][idx]


def one_digit_less(tokens: list[str] | None) -> list[int]:
    """The figures the tokens give with one digit of the leading group
    dropped: the misread "2" -> "23" undone. Only the leading group can
    lose a digit and keep the layout's grouping."""
    if not tokens:
        return []
    negative = tokens[0].startswith("-")
    lead = tokens[0].lstrip("-")
    if len(lead) < 2 or not all(t.isdigit() for t in [lead, *tokens[1:]]):
        return []
    out = set()
    for i in range(len(lead)):
        value = int(lead[:i] + lead[i + 1 :] + "".join(tokens[1:]))
        out.add(-value if negative else value)
    return sorted(out)


def classify_ordering(o: dict, d: dict, idx: int) -> dict[str, object]:
    """Genuine, a digit read as two, or another misread, from the document's
    own rows (whole kroner, 5 kr):

    - salgsinntekt: genuine when the read revenue rows other than the sales
      row (for example a negative "Annen driftsinntekt") and the sales figure
      sum to sum_driftsinntekter; a digit read as two when one digit less in
      the leading group makes them sum (confirmed), or at least brings the
      line under the total (plausible);
    - kundefordringer, bankinnskudd against the API's sum_omloepsmidler:
      genuine when the line is within the document's own printed "Sum
      omløpsmidler" (the API and the document disagree, not the line); a
      digit read as two when one digit less brings it under both.
    Otherwise another misread, or unexplained when nothing can tell."""
    line = o["read_kr"]
    total = o["total_kr"]
    candidates = one_digit_less(o["tokens"])
    if o["field"] == "salgsinntekt":
        # Revenue rows only: the block above sum_driftsinntekter also holds
        # the heading and the year header line.
        revenue_rows = [r for r in d["revenue_block"] if r["has_number"] and "inntekt" in r["label"].lower()]
        others = [figure_in(r, idx) for r in revenue_rows if r["field"] != "salgsinntekt"]
        others_sum = sum(v for v in others if v is not None)
        annen = figure_in(d["named"].get("annen_driftsinntekt"), idx)
        evidence = {"revenue_rows": [(r["label"], figure_in(r, idx)) for r in revenue_rows],
                    "annen_driftsinntekt": annen}  # fmt: skip
        if line is not None and abs(line + others_sum - total) <= 5 and others_sum < 0:
            return {"cause": "genuine", "evidence": evidence}
        for c in candidates:
            if abs(c + others_sum - total) <= 5:
                return {"cause": "digit_as_two", "confirmed": True, "corrected_kr": c, "evidence": evidence}
        for c in candidates:
            if c <= total + 5:
                return {"cause": "digit_as_two", "confirmed": False, "corrected_kr": c, "evidence": evidence}
        return {"cause": "other_misread" if line is not None else "unexplained", "evidence": evidence}
    printed = figure_in(d["named"].get("sum_omlopsmidler"), idx)
    fordringer = figure_in(d["named"].get("sum_fordringer"), idx)
    evidence = {"printed_sum_omlopsmidler": printed, "printed_sum_fordringer": fordringer}
    if line is not None and printed is not None and line <= printed + 5:
        return {"cause": "genuine", "evidence": evidence}
    bound = total if printed is None else min(total, printed)
    for c in candidates:
        if c <= bound + 5:
            return {"cause": "digit_as_two", "confirmed": printed is not None, "corrected_kr": c, "evidence": evidence}
    return {"cause": "other_misread" if printed is not None else "unexplained", "evidence": evidence}


def kr_of(value: str) -> int | None:
    value = value.strip()
    return None if value == "" else int(value)


def figure_class(read: int | None, truth: int | None) -> str:
    """The SM-2 classes (scripts/ocr-sm2-compare.ts), on whole kroner."""
    if truth is None:
        return "blank" if read is None else "phantom"
    if read is None:
        return "not_read"
    return "correct" if read == truth else "misread"


def cause_of(column: dict, doc: dict) -> dict[str, object]:
    """The cause of a column off its total, from the probe's rows (whole
    kroner). A row in the cost block that no field took, and whose figure
    closes the difference, is a line not read as a cost line; a matched
    cost line whose digits-pass or plain figure differs and closes it is a
    misread; otherwise the rows are shown for a reading by hand."""
    idx = 0 if column["role"] == "current" else 1
    diff_kr = column["diff_ore"] / 100
    block = doc["cost_block"]
    stored = {k: (None if column["figures"][k] is None else column["figures"][k] / 100) for k in COST_LINES + ("sum_driftskostnad",)}
    read = doc["read"]["current" if idx == 0 else "prior"]
    same = read is not None and all(
        (read["figures"].get(k) is None and stored[k] is None) or read["figures"].get(k) == stored[k] for k in stored
    )
    hint = "unexplained"
    evidence: list[dict] = []
    for row in block:
        fig = row["plain"][idx] if row["plain"][idx] is not None else row["digits"][idx]
        if row["field"] is None and fig is not None and abs(abs(fig) - abs(diff_kr)) <= 5:
            hint, evidence = "unmatched_cost_row", [row]
            break
    if hint == "unexplained":
        for row in block:
            if row["field"] in COST_LINES and row["digits"][idx] is not None and row["plain"][idx] is not None:
                delta = row["digits"][idx] - row["plain"][idx]
                if delta != 0 and abs(delta + diff_kr) <= 5:
                    hint, evidence = "plain_misread_digits_right", [row]
                    break
    return {"hint": hint, "evidence": evidence, "block": block, "read_equals_stored": same}


def analyse(docs: dict, off: list, columns: list, transcribed: dict, seeded: dict) -> dict[str, object]:
    by_doc = {(d["orgnr"], d["year"]): d for d in docs["documents"]}
    # (a) and the control.
    off_out = []
    for c in off:
        doc = by_doc[(c["orgnr"], c["year"])]
        off_out.append({"orgnr": c["orgnr"], "year": c["year"], "role": c["role"], "diff_kr": c["diff_ore"] / 100,
                        "side": "under" if c["diff_ore"] < 0 else "over", **cause_of(c, doc),
                        "rule_effect": doc["rules"]})  # fmt: skip

    # (b) tokens and figures per rule, per set.
    widths = {"reference": [], "not_summing": [], "ordering": [], "draw": []}
    rule_tokens: dict[str, dict[str, list[int]]] = {}
    for d in docs["documents"]:
        widths[d["set"]].extend(d["tokens"])
    for k in THRESHOLDS:
        for one in ONE_WEIGHTS:
            name = f"k={k} one={one}"
            rule_tokens[name] = {}
            for group, toks in widths.items():
                refused = [t for t in toks if t["width"] < k * weight(t["text"], one) * t["pitch"]]
                rule_tokens[name][group] = [len(toks), len(refused)]

    # Figures lost or changed by each rule, against the transcription on the
    # reference set.
    figure_effect: dict[str, dict[str, dict[str, int]]] = {}
    examples: dict[str, list[dict]] = {}
    for name in rule_tokens:
        per: dict[str, dict[str, int]] = {}
        ex: list[dict] = []
        for d in docs["documents"]:
            g = per.setdefault(d["set"], {"figures_changed": 0, "correct_lost": 0, "wrong_lost": 0, "wrong_fixed": 0,
                                          "unknown_lost": 0, "check_changed": 0, "columns": 0})  # fmt: skip
            for role in ("current", "prior"):
                base, new = d["read"].get(role), d["rules"][name].get(role)
                if base is None or new is None:
                    continue
                g["columns"] += 1
                if any(base[c] != new[c] for c in ("c1", "c2", "c3", "c4")):
                    g["check_changed"] += 1
                t = transcribed.get((d["orgnr"], d["year"], role)) if d["set"] == "reference" else None
                for field, before in base["figures"].items():
                    after = new["figures"][field]
                    if before == after:
                        continue
                    g["figures_changed"] += 1
                    truth = kr_of(t[field]) if t is not None and field in t else None
                    was, now = figure_class(before, truth), figure_class(after, truth)
                    if t is None:
                        g["unknown_lost"] += 1
                    elif was == "correct":
                        g["correct_lost"] += 1
                    elif now == "correct":
                        g["wrong_fixed"] += 1
                    else:
                        g["wrong_lost"] += 1
                    if len(ex) < 400:
                        ex.append({"set": d["set"], "orgnr": d["orgnr"], "year": d["year"], "role": role, "field": field,
                                   "before": before, "after": after, "transcribed": truth,
                                   "tokens": d["field_tokens"].get(field, {}).get(role)})  # fmt: skip
        figure_effect[name] = per
        examples[name] = ex

    ratio_summary = {}
    for group, toks in widths.items():
        by_len: dict[int, list[float]] = {}
        for t in toks:
            n = len(t["text"].lstrip("-"))
            by_len.setdefault(n, []).append(t["width"] / (n * t["pitch"]))
        ratio_summary[group] = {
            str(n): {"n": len(v), "min": round(min(v), 3), "p01": round(quantile(v, 0.01), 3),
                     "median": round(statistics.median(v), 3), "max": round(max(v), 3)}
            for n, v in sorted(by_len.items())
        }  # fmt: skip
    ones = {group: summary_of([t["width"] / t["pitch"] for t in toks if t["text"].lstrip("-") == "1"]) for group, toks in widths.items()}
    narrowest = sorted(
        ({"set": d["set"], "orgnr": d["orgnr"], "year": d["year"], **t} for d in docs["documents"] for t in d["tokens"]
         if len(t["text"].lstrip("-")) >= 2),
        key=lambda t: t["width"] / (len(t["text"].lstrip("-")) * t["pitch"]),
    )[:25]  # fmt: skip

    # Sanity: the probe's read of each column equals what is stored.
    stored_2_1b = {(c["orgnr"], c["year"], c["role"]): c for c in columns}
    mismatched = 0
    compared = 0
    for d in docs["documents"]:
        for role in ("current", "prior"):
            r = d["read"].get(role)
            if r is None:
                continue
            if d["set"] == "reference":
                s = seeded.get((d["orgnr"], d["year"], role))
                if s is None:
                    continue
                stored = {f: (None if s[f"{f}_ore"] == "" else int(s[f"{f}_ore"]) // 100) for f in FIGURE_COLUMNS}
            else:
                c = stored_2_1b.get((d["orgnr"], d["year"], role))
                if c is None:
                    continue
                stored = {f: (None if v is None else v // 100) for f, v in c["figures"].items()}
            compared += 1
            if any(r["figures"][f] != stored[f] for f in FIGURE_COLUMNS):
                mismatched += 1

    # (c) the unguarded lines on the reference set.
    unguarded = {f: {"correct": 0, "not_read": 0, "misread": 0, "phantom": 0, "blank": 0} for f in UNGUARDED}
    for (orgnr, year, role), t in transcribed.items():
        s = seeded.get((orgnr, year, role))
        if s is None or s.get("status") != "reconciled":
            continue
        for f in UNGUARDED:
            read = None if s[f"{f}_ore"] == "" else int(s[f"{f}_ore"]) // 100
            unguarded[f][figure_class(read, kr_of(t[f]))] += 1
    ordering = ordering_checks(transcribed, seeded, columns)
    subtotal_rows = {k: sum(1 for d in docs["documents"] if d["set"] == "reference" and k in d["subtotals"]) for k in SUBTOTALS}

    return {
        "tesseract": docs["documents"][0]["tesseract"] if docs["documents"] else None,
        "off": off_out,
        "tokens": rule_tokens,
        "figures": figure_effect,
        "examples": examples,
        "ratios": ratio_summary,
        "ones": ones,
        "narrowest": narrowest,
        "sanity": {"compared": compared, "mismatched": mismatched},
        "unguarded": unguarded,
        "ordering": ordering,
        "subtotal_rows": subtotal_rows,
    }


def weight(text: str, one: float) -> float:
    return sum(one if ch == "1" else 1.0 for ch in text.lstrip("-"))


def quantile(values: list[float], q: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(q * len(s)))]


def summary_of(values: list[float]) -> dict[str, float | int]:
    if not values:
        return {"n": 0}
    return {"n": len(values), "min": round(min(values), 3), "median": round(statistics.median(values), 3), "max": round(max(values), 3)}


def ordering_checks(transcribed: dict, seeded: dict, columns: list) -> dict[str, dict[str, int]]:
    """Ordering checks against totals read today, each within 5 kr: a line
    can never exceed the total it is part of. Counted on the reference set's
    transcriptions (a true figure must pass), its stored reconciled figures,
    and the 2.1b reconciled columns."""
    def fails(f: dict[str, int | None], scale: int) -> dict[str, bool | None]:
        b = 5 * scale

        def le(a: int | None, total: int | None) -> bool | None:
            return None if a is None or total is None else a > total + b

        current = None
        if f["sum_eiendeler"] is not None:
            fixed = (f["sum_varige_driftsmidler"] or 0) + (f["sum_immaterielle_eiendeler"] or 0)
            parts = [f[k] for k in ("varer", "kundefordringer", "bankinnskudd") if f[k] is not None]
            current = None if not parts else sum(parts) + fixed > f["sum_eiendeler"] + b
        return {
            "salgsinntekt<=sum_driftsinntekter": le(f["salgsinntekt"], f["sum_driftsinntekter"]),
            "leverandorgjeld<=sum_kortsiktig_gjeld": le(f["leverandorgjeld"], f["sum_kortsiktig_gjeld"]),
            "varer+kundefordringer+bankinnskudd+anlegg<=sum_eiendeler": current,
        }

    out: dict[str, dict[str, int]] = {}

    def add(group: str, result: dict[str, bool | None]) -> None:
        for name, failed in result.items():
            g = out.setdefault(f"{group}: {name}", {"evaluable": 0, "fails": 0})
            if failed is not None:
                g["evaluable"] += 1
                g["fails"] += int(failed)

    for key, t in transcribed.items():
        add("reference, transcribed", fails({f: kr_of(t[f]) if f in t else None for f in FIGURE_COLUMNS}, 1))
        s = seeded.get(key)
        if s is not None and s.get("status") == "reconciled":
            add("reference, stored", fails({f: (None if s[f"{f}_ore"] == "" else int(s[f"{f}_ore"])) for f in FIGURE_COLUMNS}, 100))
    for c in columns:
        if c["status"] == "reconciled":
            add("2.1b, stored", fails(c["figures"], 100))
    return out


def kr(value: float | int | None) -> str:
    if value is None:
        return "–"
    return f"{int(value):,}".replace(",", " ")


def markdown(report: dict) -> str:
    sets = report["sets"]
    lines = [
        "# Cost lines that do not sum, and narrow digit tokens (Story 2.5c probe)",
        "",
        f"Generated {report['generated']} by `analysis/ocr/cost_sum.py`, read-only, in step 1's image "
        f"({report['tesseract']}). Step 1's own recognition, row parsing and combined read; nothing written to the "
        "database; no fingerprint or business type computed. Figures are whole kroner.",
        "",
        f"Documents: the OCR reference set ({sets['reference']}); the {sets['not_summing_columns']} reconciled 2.1b "
        f"columns, in {sets['not_summing_documents']} documents, whose new `avskrivninger` and the other three main cost "
        "lines are read and miss `sum_driftskostnad` by more than 5 kr; and a seeded draw "
        f"(seed {sets['seed']}) of {sets['draw']} of the other {sets['draw_population']} 2.1b documents; and the "
        f"{sets['ordering_columns']} reconciled 2.1b columns where an unguarded line exceeds a total it is part of "
        f"({sets['ordering_documents']} further documents).",
        "",
        f"Sanity: the probe's read equals the stored figures in {report['sanity']['compared'] - report['sanity']['mismatched']} "
        f"of {report['sanity']['compared']} columns.",
        "",
        "## (a) Columns off their total, by cause",
        "",
        "| Side | Role | Cause | Columns |",
        "|---|---|---|---|",
    ]
    counts: dict[tuple[str, str, str], int] = {}
    for c in report["off"]:
        key = (c["side"], c["role"], c["hint"])
        counts[key] = counts.get(key, 0) + 1
    for (side, role, hint), n in sorted(counts.items()):
        lines.append(f"| {side} | {role} | {hint} | {n} |")
    lines += ["", "### Evidence, column by column", "",
              "Each column's cost block as read (label as OCR read it; plain / digits-pass figure in the column; the "
              "field the read gave the row).", ""]  # fmt: skip
    for c in report["off"]:
        idx = 0 if c["role"] == "current" else 1
        lines.append(f"- **{c['orgnr']} {c['year']} {c['role']}**, {c['side']} by {kr(abs(c['diff_kr']))} kr, "
                     f"hint `{c['hint']}`, read equals stored: {c['read_equals_stored']}")  # fmt: skip
        for row in c["block"]:
            toks = " ".join(row["tokens"][idx])
            lines.append(f"  - `{row['label']}` → {row['field'] or '—'}: {kr(row['plain'][idx])} / {kr(row['digits'][idx])} `{toks}`")
    lines += [
        "",
        "## (b) The width rule, measured",
        "",
        "Width ratio: a token's width over (its digits × `Edges.pitch`).",
        "",
        "| Set | Digits | Tokens | Min | 1st percentile | Median | Max |",
        "|---|---|---|---|---|---|---|",
    ]
    for group, by_len in report["ratios"].items():
        for n, s in by_len.items():
            lines.append(f"| {group} | {n} | {s['n']} | {s['min']} | {s['p01']} | {s['median']} | {s['max']} |")
    lines += ["", "A lone \"1\", width over pitch: " + "; ".join(f"{g} {s}" for g, s in report["ones"].items()), "",
              "### Tokens refused, per candidate rule", "",
              "Refused when width < k × digits × pitch, a \"1\" counted as `one` of a digit.", "",
              "| Rule | Reference: tokens, refused | Not summing | Ordering | Draw |", "|---|---|---|---|---|"]  # fmt: skip
    for name, groups in report["tokens"].items():
        lines.append(f"| {name} | " + " | ".join(f"{groups[g][0]}, {groups[g][1]}" for g in ("reference", "not_summing", "ordering", "draw")) + " |")
    lines += ["", "### Figures the combined read changes, per candidate rule", "",
              "Against the transcription on the reference set: correct lost (a cost), wrong lost or fixed (a gain).", "",
              "| Rule | Set | Columns | Figures changed | Correct lost | Wrong lost | Wrong fixed | Unknown (2.1b) | Columns with a check changed |",
              "|---|---|---|---|---|---|---|---|---|"]  # fmt: skip
    for name, per in report["figures"].items():
        for group, g in per.items():
            lines.append(f"| {name} | {group} | {g['columns']} | {g['figures_changed']} | {g['correct_lost']} | {g['wrong_lost']} | "
                         f"{g['wrong_fixed']} | {g['unknown_lost']} | {g['check_changed']} |")  # fmt: skip
    lines += ["", "### The narrowest tokens of two or more digits", "", "| Set | Orgnr | Year | Token | Width | Pitch | Ratio |", "|---|---|---|---|---|---|---|"]
    for t in report["narrowest"]:
        n = len(t["text"].lstrip("-"))
        lines.append(f"| {t['set']} | {t['orgnr']} | {t['year']} | `{t['text']}` | {t['width']} | {t['pitch']:.1f} | {t['width'] / (n * t['pitch']):.2f} |")
    lines += ["", "## (c) Lines no within-document check covers", "",
              "Reference set, reconciled columns, stored against transcribed:", "",
              "| Field | correct | not read | misread | phantom | blank |", "|---|---|---|---|---|---|"]  # fmt: skip
    for f, g in report["unguarded"].items():
        lines.append(f"| {f} | {g['correct']} | {g['not_read']} | {g['misread']} | {g['phantom']} | {g['blank']} |")
    lines += ["", "Ordering checks against totals read today (5 kr):", "", "| Set: check | Evaluable | Fails |", "|---|---|---|"]
    for name, g in report["ordering"].items():
        lines.append(f"| {name} | {g['evaluable']} | {g['fails']} |")
    names = list(report["tokens"])
    fails = [o for o in report["ordering_fails"] if o.get("probed")]
    lines += ["", "### The 2.1b ordering failures, by cause", "",
              "Cause from the document's own rows (`classify_ordering`). \"Width rule\" counts the failures whose figure "
              "the candidate rule refuses or changes. A part-against-total check in `src/engine` on stored figures "
              "(no re-read) flags every row here by construction; a genuine one it flags is a cost.", "",
              "| Check | Role | Cause | Columns | Companies | " + " | ".join(f"Width rule {n}" for n in names) + " |",
              "|---|---|---|---|---|" + "---|" * len(names)]  # fmt: skip
    groups: dict[tuple[str, str, str], list[dict]] = {}
    for o in fails:
        cause = o["cause"] + ("" if o["cause"] != "digit_as_two" else (" (confirmed)" if o.get("confirmed") else " (plausible)"))
        groups.setdefault((o["check"], o["role"], cause), []).append(o)
    for (check, role, cause), sel in sorted(groups.items()):
        caught = [sum(1 for o in sel if o["rules"][n] != o["read_kr"]) for n in names]
        lines.append(f"| {check} | {role} | {cause} | {len(sel)} | {len({o['orgnr'] for o in sel})} | " + " | ".join(map(str, caught)) + " |")
    unprobed = [o for o in report["ordering_fails"] if not o.get("probed")]
    lines += ["", f"Not probed (document not read by the probe): {len(unprobed)}.", ""]
    lines += ["### Evidence, a sample per cause", ""]
    for (check, role, cause), sel in sorted(groups.items()):
        for o in sel[:3]:
            toks = " ".join(o["tokens"] or [])
            lines.append(f"- {check}, {role}, {cause}: {o['orgnr']} {o['year']}: line {kr(o['line_kr'])}, total {kr(o['total_kr'])}, "
                         f"tokens `{toks}`, one digit less {kr(o.get('corrected_kr'))}; {json.dumps(o['evidence'], ensure_ascii=False)}")  # fmt: skip
    lines += ["", "### The 2.1b ordering failures, column by column", "",
              "Stored line and total, the row's plain tokens with their widths and the page pitch, and the figure under "
              "each candidate rule (– is refused).", "",
              "| Orgnr | Year | Role | Check | Line | Total | Tokens (width) | Pitch | " + " | ".join(names) + " |",
              "|---|---|---|---|---|---|---|---|" + "---|" * len(names)]  # fmt: skip
    for o in report["ordering_fails"]:
        if not o.get("probed"):
            lines.append(f"| {o['orgnr']} | {o['year']} | {o['role']} | {o['check']} | {kr(o['line_kr'])} | {kr(o['total_kr'])} | not probed |")
            continue
        toks = " ".join(f"{t}({w})" for t, w in zip(o["tokens"] or [], o["widths"] or [], strict=False))
        rules = " | ".join(kr(o["rules"][n]) for n in names)
        pitch = "–" if o["pitch"] is None else f"{o['pitch']:.1f}"
        lines.append(f"| {o['orgnr']} | {o['year']} | {o['role']} | {o['check']} | {kr(o['line_kr'])} | {kr(o['total_kr'])} | `{toks}` | {pitch} | {rules} |")
    lines += ["", "Printed sub-total rows found in the reference documents (documents with the row):", ""]
    lines += [f"- {k}: {n} of {report['sets']['reference']}" for k, n in report["subtotal_rows"].items()]
    return "\n".join(lines) + "\n"


# --- In the image --------------------------------------------------------------------


def in_image(todo_file: str) -> None:
    import os

    from peerless_ingest import config, documents, layout, ocr
    from peerless_ingest.run import rules_of

    cfg = config.load_config(Path(os.environ.get("PEERLESS_INGEST_CONFIG", config.DEFAULT_CONFIG)))
    bound = rules_of(cfg).within_document_bound_kr
    tesseract = subprocess.run(["tesseract", "--version"], capture_output=True, text=True, check=True)
    work = Path(todo_file).parent
    todo = json.loads(Path(todo_file).read_text(encoding="utf-8"))
    original = layout.parse_number

    def words(cache: Path, pdf: Path):  # type: ignore[no-untyped-def]
        if cache.exists():
            data = json.loads(cache.read_text(encoding="utf-8"))
            mk = lambda ws: [ocr.Word(w[0], w[1], w[2], w[3], w[4], tuple(w[5])) for w in ws]  # noqa: E731
            return mk(data["top"]), [ocr.PageWords(mk(p["plain"]), mk(p["digits"])) for p in data["pages"]]
        top, pages = documents.recognise(pdf.read_bytes())
        dump = lambda ws: [[w.text, w.left, w.top, w.width, w.height, list(w.line)] for w in ws]  # noqa: E731
        cache.write_text(json.dumps({"top": dump(top), "pages": [{"plain": dump(p.plain), "digits": dump(p.digits)} for p in pages]}),
                         encoding="utf-8")  # fmt: skip
        return top, pages

    def column_json(c):  # type: ignore[no-untyped-def]
        if c is None:
            return None
        return {"figures": dict(c.figures), "c1": c.c1, "c2": c.c2, "c3": c.c3, "c4": c.c4, "digits": list(c.digits_pass_fields)}

    def read_with(rule, top, pages):  # type: ignore[no-untyped-def]
        layout.parse_number = rule
        try:
            r = documents.read_words(top, pages, bound)
        finally:
            layout.parse_number = original
        return {"current": column_json(r.current), "prior": column_json(r.prior)}

    def narrow_rule(k: float, one: float):  # type: ignore[no-untyped-def]
        def rule(tokens, pitch, mode):  # type: ignore[no-untyped-def]
            for t in tokens:
                digits = t.text.lstrip("-")
                if digits and digits.isascii() and digits.isdigit() and t.width < k * weight(digits, one) * pitch:
                    return None
            return original(tokens, pitch, mode)

        return rule

    def recorded_extract(pages):  # type: ignore[no-untyped-def]
        """layout.extract, recording the row each field took (by identity)."""

        class Found(dict):  # type: ignore[type-arg]
            last: str | None = None

            def __setitem__(self, key, value):  # type: ignore[no-untyped-def]
                Found.last = key
                super().__setitem__(key, value)

        rows_of: dict[str, int] = {}

        class Taken(set):  # type: ignore[type-arg]
            def add(self, item):  # type: ignore[no-untyped-def]
                rows_of[Found.last] = item  # type: ignore[index]
                super().add(item)

        found, taken = Found(), Taken()
        later = {key: layout.TARGETS[key] + v for key, v in layout.LATER_VARIANTS.items()}
        layout._match(layout._candidates(pages, layout.fold), found, layout.TARGETS, layout.TARGET_PAGES, taken)
        layout._match(layout._candidates(pages, layout.fold_mixed), found, layout.TARGETS, layout.TARGET_PAGES, taken)
        layout._match(layout._candidates(pages, layout.fold), found, later, layout.LATER_PAGES, taken)
        layout._match(layout._candidates(pages, layout.fold_mixed), found, later, layout.LATER_PAGES, taken)
        layout._match(layout._candidates(pages, layout.fold_notes), found, layout.TARGETS | later,
                      layout.TARGET_PAGES | layout.LATER_PAGES, taken)  # fmt: skip
        assert dict(found) == layout.extract(pages), "recorded_extract drifted from layout.extract"
        return {row_id: key for key, row_id in rows_of.items()}

    calls: list[tuple[list, float]] = []

    def recording(tokens, pitch, mode):  # type: ignore[no-untyped-def]
        calls.append((list(tokens), pitch))
        return original(tokens, pitch, mode)

    def parsed(pages, mode):  # type: ignore[no-untyped-def]
        out = []
        previous = None
        layout.parse_number = recording
        try:
            for page in pages:
                calls.clear()
                numbers = page.plain if mode == "plain" else page.digits
                previous = layout.parse_page(page.plain, numbers, mode, previous)
                toks = [(calls[2 * i], calls[2 * i + 1]) for i in range(len(calls) // 2)]
                out.append((previous, toks if len(toks) == len(previous.rows) else [(([], 0.0), ([], 0.0))] * len(previous.rows)))
        finally:
            layout.parse_number = original
        return out

    rules = {f"k={k} one={one}": narrow_rule(k, one) for k in THRESHOLDS for one in ONE_WEIGHTS}
    result = []
    for index, item in enumerate(todo, start=1):
        orgnr, year = item["orgnr"], item["year"]
        top, pages = words(work / f"{orgnr}-{year}.words.json", work / f"{orgnr}-{year}.pdf")
        base = documents.read_words(top, pages, bound)
        doc: dict[str, object] = {**item, "tesseract": (tesseract.stdout or tesseract.stderr).splitlines()[0],
                                  "read": {"current": column_json(base.current), "prior": column_json(base.prior)},
                                  "tokens": [], "cost_block": [], "field_tokens": {}, "field_widths": {}, "field_pitch": {},
                                  "subtotals": [], "named": {}, "revenue_block": [],
                                  "rules": {}}  # fmt: skip
        if base.current is None:
            result.append(doc | {"rules": {name: {"current": None, "prior": None} for name in rules}})
            continue
        doc["rules"] = {name: read_with(rule, top, pages) for name, rule in rules.items()}
        plain = parsed(pages, "plain")
        digits = parsed(pages, "digits")
        field_of = recorded_extract([p for p, _ in plain])
        tokens_out = []
        seen_revenue = False
        for (page, toks), (dpage, _) in zip(plain, digits, strict=True):
            if page.kind == "other":
                continue
            in_block = False
            for i, row in enumerate(page.rows):
                (cur_toks, pitch), (pri_toks, _) = toks[i]
                for t in cur_toks + pri_toks:
                    d = t.text.lstrip("-")
                    if d and d.isascii() and d.isdigit():
                        tokens_out.append({"text": t.text, "width": t.width, "pitch": pitch})
                field = field_of.get(id(row))
                if field is not None:
                    doc["field_tokens"][field] = {"current": [t.text for t in cur_toks], "prior": [t.text for t in pri_toks]}  # type: ignore[index]
                    doc["field_widths"][field] = {"current": [t.width for t in cur_toks], "prior": [t.width for t in pri_toks]}  # type: ignore[index]
                    doc["field_pitch"][field] = pitch  # type: ignore[index]
                folded = layout.fold(row.label)
                drow = dpage.rows[i] if i < len(dpage.rows) else None
                entry = {
                    "label": row.label, "has_number": row.has_number, "field": field,
                    "plain": [row.current, row.prior],
                    "digits": [drow.current, drow.prior] if drow else [None, None],
                    "tokens": [[t.text for t in cur_toks], [t.text for t in pri_toks]],
                    "widths": [[t.width for t in cur_toks], [t.width for t in pri_toks]],
                    "pitch": pitch,
                }  # fmt: skip
                for name, variants in SUBTOTALS.items():
                    if row.has_number and any(folded.endswith(v) for v in variants) and name not in doc["subtotals"]:  # type: ignore[operator]
                        doc["subtotals"].append(name)  # type: ignore[union-attr]
                        doc["named"][name] = entry  # type: ignore[index]
                if page.kind == "resultat":
                    if field == "sum_driftsinntekter":
                        in_block = True
                        seen_revenue = True
                        continue
                    if not seen_revenue:
                        doc["revenue_block"].append(entry)  # type: ignore[union-attr]
                    if in_block:
                        drow = dpage.rows[i] if i < len(dpage.rows) else None
                        doc["cost_block"].append({  # type: ignore[union-attr]
                            "label": row.label, "has_number": row.has_number, "field": field,
                            "plain": [row.current, row.prior],
                            "digits": [drow.current, drow.prior] if drow else [None, None],
                            "tokens": [[t.text for t in cur_toks], [t.text for t in pri_toks]],
                            "widths": [[t.width for t in cur_toks], [t.width for t in pri_toks]],
                            "pitch": pitch,
                        })  # fmt: skip
                    if field == "sum_driftskostnad":
                        in_block = False
        doc["tokens"] = tokens_out
        result.append(doc)
        print(f"{index}/{len(todo)} {orgnr}/{year}", file=sys.stderr, flush=True)
    json.dump({"documents": result}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--in-image":
        in_image(sys.argv[2])
    elif len(sys.argv) == 1:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
        host()
    else:
        raise SystemExit("usage: uv run analysis/ocr/cost_sum.py")
