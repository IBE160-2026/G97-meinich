# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Why do the cost lines come out empty? The read-only probe of Story 2.5b.

Story 2.5b reads the cost lines that are printed but stored as NULL, and the
four parts of intangible assets. Before anything in `layout.py` or
`documents.py` changes, this probe runs step 1's own recognition and row
parsing (`documents.recognise`, `documents.parse_pages`, `layout.extract`) on
the documents behind the empty lines, and names, per empty line, why it is
empty, with the OCR words as evidence:

- `refused`: a row matched the line's label, but `layout.parse_number`
  refused its figure tokens in the plain pass (the tokens are shown). The
  digits-only pass's figure for the row is shown too: whether a gate could
  admit it is what Q3 (the cost-line sum gate) turns on.
- `no_number`: a row matched, but no figure token stood in its column.
- `unmatched`: no row matched the label. The rows whose own folded label is
  closest to the target are shown, with their figures.
- `read`: the probe reads a figure (the stored row came from an older
  reader version).

The documents:

- The OCR reference set (`analysis/ocr-reference/drawn.json`): every cell
  where `transcriptions.csv` holds a figure for a cost line or for
  `sum_immaterielle_eiendeler` and the committed seed
  (`seed/demo/document_column.csv`) holds NULL. Its PDFs are read from
  `.local/ocr-reference/` (gitignored), fetched only when missing.
- A seeded draw (seed 20261105, 20 documents) from the local 2.1b rows: the
  documents whose current column is reconciled and whose `lonnskostnad` is
  NULL, outside the reference set. Read from the local database with
  `psql` in `supabase_db_peerless`, SELECT only. Every empty cost line of the
  drawn columns is probed.
- For both, every balance row whose label names one of the four parts
  (forskning, konsesjoner, goodwill, utsatt skattefordel) is listed, so the
  new targets are written from the labels as Tesseract reads them.

Nothing is written to the database. No fingerprint or business type is
computed or shown. The recognised words of each document are cached in
`analysis/.cache/ocr/probe/` (gitignored), so a rerun does no OCR.

Writes `analysis/output/empty-lines-probe.md` and `.json`.

Run (host, from the repository root, after `docker build --tag peerless-ingest:local ingest`):
    uv run analysis/ocr/empty_lines.py
It runs itself inside the image with `--in-image`; that mode is not for
direct use.
"""

from __future__ import annotations

import csv
import json
import random
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
CACHE = ANALYSIS / ".cache" / "ocr" / "probe"
OUT_MD = ANALYSIS / "output" / "empty-lines-probe.md"
OUT_JSON = ANALYSIS / "output" / "empty-lines-probe.json"

KOPI = "https://data.brreg.no/regnskapsregisteret/regnskap/aarsregnskap/kopi"
USER_AGENT = "Peerless student project (IBE160, Hogskolen i Molde)"
IMAGE = "peerless-ingest:local"
DB_CONTAINER = "supabase_db_peerless"
SEED = 20261105
DRAW = 20
TODO = "todo.json"

COST_LINES = ("varekostnad", "lonnskostnad", "avskrivninger", "nedskrivninger", "annen_driftskostnad")
PROBED = (*COST_LINES, "sum_immaterielle_eiendeler")
PART_WORDS = ("forskning", "konsesjon", "patent", "goodwill", "skattefordel")


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


def reference_cells() -> tuple[list[dict[str, object]], list[tuple[str, int]]]:
    """(cells, documents) of the reference set: a cell is a probed line the
    transcription holds and the seed stores as NULL."""
    drawn = json.loads((REPO / "analysis" / "ocr-reference" / "drawn.json").read_text(encoding="utf-8"))
    pairs = sorted({(str(d["orgnr"]), int(d["year"])) for d in drawn["cells"]})
    transcribed = {
        (r["orgnr"], int(r["filing_year"]), r["column"]): r
        for r in read_csv(REPO / "analysis" / "ocr-reference" / "transcriptions.csv", ";")
    }
    stored = {
        (r["orgnr"], int(r["filing_year"]), r["role"]): r
        for r in read_csv(REPO / "seed" / "demo" / "document_column.csv", ",")
    }
    cells: list[dict[str, object]] = []
    for orgnr, year in pairs:
        for role in ("current", "prior"):
            t = transcribed.get((orgnr, year, role))
            s = stored.get((orgnr, year, role))
            if t is None or s is None:
                continue
            for field in PROBED:
                if t[field].strip() != "" and s[f"{field}_ore"] == "":
                    cells.append({"set": "reference", "orgnr": orgnr, "year": year, "role": role, "field": field,
                                  "transcribed_kr": int(t[field])})  # fmt: skip
    return cells, pairs


def psql(sql: str) -> list[list[str]]:
    out = subprocess.run(
        ["docker", "exec", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-F", "\t",
         "-v", "ON_ERROR_STOP=1", "-c", f"begin read only; {sql}; commit;"],
        check=True, capture_output=True, text=True, encoding="utf-8",
    )  # fmt: skip
    return [line.split("\t") for line in out.stdout.splitlines() if "\t" in line]


def drawn_cells(reference: set[str]) -> tuple[list[dict[str, object]], list[tuple[str, int]]]:
    """The seeded draw from the local 2.1b rows, and every empty cost line of
    the drawn current columns."""
    lines = ", ".join(f"{f}_ore is null" for f in COST_LINES)
    rows = psql(
        "select orgnr, filing_year, " + lines + " from register.document_column"
        " where role = 'current' and status = 'reconciled' and lonnskostnad_ore is null"
        " order by orgnr, filing_year"
    )
    population = [r for r in rows if r[0] not in reference]
    picked = sorted(random.Random(SEED).sample(population, min(DRAW, len(population))))
    cells: list[dict[str, object]] = []
    for r in picked:
        for field, empty in zip(COST_LINES, r[2:], strict=True):
            if empty == "t":
                cells.append({"set": "2.1b", "orgnr": r[0], "year": int(r[1]), "role": "current", "field": field,
                              "transcribed_kr": None})  # fmt: skip
    print(f"2.1b draw: {len(picked)} of {len(population)} documents", file=sys.stderr)
    return cells, [(r[0], int(r[1])) for r in picked]


def host() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    ref_cells, ref_docs = reference_cells()
    draw_cells, draw_docs = drawn_cells({o for o, _ in ref_docs})
    todo = []
    for orgnr, year in ref_docs:
        target = CACHE / f"{orgnr}-{year}.pdf"
        source = REFERENCE_PDFS / f"{orgnr}-{year}.pdf"
        if source.exists():
            target.write_bytes(source.read_bytes())
        else:
            fetch(f"{KOPI}/{orgnr}/{year}", target)
        todo.append({"orgnr": orgnr, "year": year})
    for orgnr, year in draw_docs:
        fetch(f"{KOPI}/{orgnr}/{year}", CACHE / f"{orgnr}-{year}.pdf")
        todo.append({"orgnr": orgnr, "year": year})
    (CACHE / TODO).write_text(json.dumps(todo) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(todo)} documents; reading them in {IMAGE}", file=sys.stderr)
    result = subprocess.run(
        [
            "docker", "run", "--rm",
            "--mount", f"type=bind,source={CACHE},target=/work",
            "--mount", f"type=bind,source={HERE},target=/scripts,readonly",
            "--entrypoint", "/app/.venv/bin/python",
            IMAGE, "/scripts/empty_lines.py", "--in-image", f"/work/{TODO}",
        ],
        check=True,
        stdout=subprocess.PIPE,
    )  # fmt: skip
    docs = {(d["orgnr"], d["year"]): d for d in json.loads(result.stdout)["documents"]}
    report = classify(ref_cells + draw_cells, docs)
    report["generated"] = date.today().isoformat()
    report["draw"] = {"seed": SEED, "documents": len(draw_docs)}
    OUT_JSON.write_text(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    OUT_MD.write_text(markdown(report), encoding="utf-8", newline="\n")
    print(f"wrote {OUT_MD.relative_to(REPO)} and {OUT_JSON.relative_to(REPO)}", file=sys.stderr)


def classify(cells: list[dict[str, object]], docs: dict[tuple[str, int], dict]) -> dict[str, object]:
    out = []
    for cell in cells:
        doc = docs[(cell["orgnr"], cell["year"])]
        column = 0 if cell["role"] == "current" else 1
        probe = doc["fields"][cell["field"]]
        entry = dict(cell)
        if doc.get("refusal"):
            entry |= {"cause": "document_refused", "evidence": doc["refusal"]}
        elif probe["matched"] is None:
            entry |= {"cause": "unmatched", "nearest": probe["nearest"]}
        else:
            row = probe["matched"]
            tokens = row["tokens"][column]
            plain = row["plain"][column]
            digits = row["digits"][column]
            if plain is not None:
                cause = "read"
            elif tokens:
                cause = "refused"
            else:
                cause = "no_number"
            entry |= {"cause": cause, "label": row["label"], "tokens": tokens, "plain": plain, "digits": digits,
                      "fold": row["fold"]}  # fmt: skip
        out.append(entry)
    parts = [{"orgnr": d["orgnr"], "year": d["year"], **p} for d in docs.values() for p in d["parts"]]
    return {"cells": out, "parts": parts, "tesseract": next(iter(docs.values()))["tesseract"] if docs else None}


def kr(ore_or_kr: int | None) -> str:
    return "–" if ore_or_kr is None else f"{ore_or_kr:,}".replace(",", " ")


def markdown(report: dict) -> str:
    cells = report["cells"]
    lines = [
        "# Why the cost lines come out empty (Story 2.5b probe)",
        "",
        f"Generated {report['generated']} by `analysis/ocr/empty_lines.py`, read-only, in step 1's image "
        f"({report['tesseract']}). Step 1's own recognition and row parsing; nothing written to the database; "
        "no fingerprint computed. Figures are whole kroner as the OCR words read them.",
        "",
        "Documents: the OCR reference set's cells where the transcription holds a figure and the seed stores NULL, "
        f"and a seeded draw (seed {report['draw']['seed']}) of {report['draw']['documents']} 2.1b documents with a "
        "reconciled current column and an empty `lonnskostnad`, every empty cost line in them.",
        "",
        "## Causes",
        "",
        "| Set | Field | refused | no_number | unmatched | read | document_refused |",
        "|---|---|---|---|---|---|---|",
    ]
    causes = ("refused", "no_number", "unmatched", "read", "document_refused")
    for group in ("reference", "2.1b"):
        for field in PROBED:
            sel = [c for c in cells if c["set"] == group and c["field"] == field]
            if sel:
                lines.append(f"| {group} | {field} | " + " | ".join(str(sum(c["cause"] == k for c in sel)) for k in causes) + " |")
    lines.append("")
    refused = [c for c in cells if c["cause"] == "refused"]
    lines += [
        "## Refused figure tokens (Q3)",
        "",
        f"{len(refused)} empty lines had a matching row whose plain-pass tokens `parse_number` refused. "
        "\"Digits pass\" is the digits-only pass's figure for the same row: a gate could admit it only when a sum check confirms it.",
        "",
        "| Set | Orgnr | Year | Column | Field | Label (OCR) | Tokens (plain) | Digits pass | Transcribed |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for c in refused:
        lines.append(
            f"| {c['set']} | {c['orgnr']} | {c['year']} | {c['role']} | {c['field']} | {c['label']} | "
            f"`{' '.join(c['tokens'])}` | {kr(c['digits'])} | {kr(c['transcribed_kr'])} |"
        )
    lines += ["", "## Unmatched labels", "", "The rows whose own folded label is closest to the target (ratio, label as read, plain figures).", ""]
    lines += ["| Set | Orgnr | Year | Column | Field | Nearest rows |", "|---|---|---|---|---|---|"]
    for c in cells:
        if c["cause"] == "unmatched":
            near = "; ".join(f"{n['ratio']:.2f} \"{n['label']}\" ({kr(n['plain'][0])} / {kr(n['plain'][1])})" for n in c["nearest"])
            lines.append(f"| {c['set']} | {c['orgnr']} | {c['year']} | {c['role']} | {c['field']} | {near} |")
    lines += ["", "## Other causes", "", "| Set | Orgnr | Year | Column | Field | Cause | Label (OCR) | Tokens |", "|---|---|---|---|---|---|---|---|"]
    for c in cells:
        if c["cause"] in ("no_number", "read", "document_refused"):
            label = c.get("label", c.get("evidence", ""))
            lines.append(f"| {c['set']} | {c['orgnr']} | {c['year']} | {c['role']} | {c['field']} | {c['cause']} | {label} | `{' '.join(c.get('tokens', []))}` |")
    lines += [
        "",
        "## Labels of the intangible parts",
        "",
        "Every balance row whose folded label names a part, as Tesseract reads it.",
        "",
        "| Orgnr | Year | Label (OCR) | Folded | Plain this year / last year | Tokens |",
        "|---|---|---|---|---|---|",
    ]
    for p in report["parts"]:
        lines.append(
            f"| {p['orgnr']} | {p['year']} | {p['label']} | `{p['fold']}` | {kr(p['plain'][0])} / {kr(p['plain'][1])} | "
            f"`{' '.join(p['tokens'][0])}` / `{' '.join(p['tokens'][1])}` |"
        )
    return "\n".join(lines) + "\n"


# --- In the image --------------------------------------------------------------------


def in_image(todo_file: str) -> None:
    import difflib
    import os

    from peerless_ingest import config, documents, layout, ocr
    from peerless_ingest.run import rules_of

    cfg = config.load_config(Path(os.environ.get("PEERLESS_INGEST_CONFIG", config.DEFAULT_CONFIG)))
    rules = rules_of(cfg)
    tesseract = subprocess.run(["tesseract", "--version"], capture_output=True, text=True, check=True)
    work = Path(todo_file).parent
    todo = json.loads(Path(todo_file).read_text(encoding="utf-8"))

    # Record the tokens of every parse_number call, in call order: parse_page
    # calls it twice per line (this year, last year), in line order.
    calls: list[list[str]] = []
    original = layout.parse_number

    def recording(tokens, pitch, mode):  # type: ignore[no-untyped-def]
        calls.append([t.text for t in tokens])
        return original(tokens, pitch, mode)

    layout.parse_number = recording  # type: ignore[assignment]

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

    def parsed(pages, mode):  # type: ignore[no-untyped-def]
        """Pages and, per row, the tokens of its two columns."""
        out = []
        previous = None
        for page in pages:
            calls.clear()
            numbers = page.plain if mode == "plain" else page.digits
            previous = layout.parse_page(page.plain, numbers, mode, previous)
            tokens = [(calls[2 * i], calls[2 * i + 1]) for i in range(len(calls) // 2)]
            out.append((previous, tokens if len(tokens) == len(previous.rows) else [([], [])] * len(previous.rows)))
        return out

    result = []
    for index, item in enumerate(todo, start=1):
        orgnr, year = item["orgnr"], item["year"]
        top, pages = words(work / f"{orgnr}-{year}.words.json", work / f"{orgnr}-{year}.pdf")
        doc: dict[str, object] = {"orgnr": orgnr, "year": year, "fields": {}, "parts": [],
                                  "tesseract": (tesseract.stdout or tesseract.stderr).splitlines()[0]}  # fmt: skip
        read = documents.read_words(top, pages, rules.within_document_bound_kr)
        if read.refusal or read.layout != "generated":
            doc["refusal"] = read.refusal or read.layout
            doc["fields"] = {f: {"matched": None, "nearest": []} for f in PROBED}
            result.append(doc)
            continue
        plain = parsed(pages, "plain")
        digits = parsed(pages, "digits")
        # Statement rows with a number, with their joined labels, as
        # layout._candidates builds them, under both folds.
        rows = []
        for (page, toks), (dpage, _) in zip(plain, digits, strict=True):
            if page.kind == "other":
                continue
            for i, row in enumerate(page.rows):
                drow = dpage.rows[i] if i < len(dpage.rows) else None
                entry = {"label": row.label, "has_number": row.has_number, "plain": [row.current, row.prior],
                         "digits": [drow.current, drow.prior] if drow else [None, None], "tokens": [toks[i][0], toks[i][1]],
                         "kind": page.kind}  # fmt: skip
                for name, fold in (("fold", layout.fold), ("fold_mixed", layout.fold_mixed)):
                    own = fold(row.label)
                    joined = own
                    j = i - 1
                    while j >= 0 and not page.rows[j].has_number and i - j <= layout.JOIN_LINES:
                        joined = fold(page.rows[j].label) + joined
                        j -= 1
                    entry[name] = (joined, own)
                rows.append(entry)
                folded = layout.fold(row.label)
                if page.kind == "balanse" and any(w in folded for w in PART_WORDS):
                    doc["parts"].append({k: entry[k] for k in ("label", "plain", "digits", "tokens")} | {"fold": folded})
        for field in PROBED:
            variants = layout.TARGETS[field]
            matched = None
            for name in ("fold", "fold_mixed"):
                for r in rows:
                    if r["has_number"] and any(r[name][0].endswith(v) for v in variants):
                        matched = r | {"fold": r[name][0]}
                        break
                if matched is None:
                    for r in rows:
                        if r["has_number"] and any(layout.similar(r[name][1], v) for v in variants):
                            matched = r | {"fold": r[name][1]}
                            break
                if matched is not None:
                    break
            nearest = sorted(
                ({"ratio": max(difflib.SequenceMatcher(None, r["fold"][1], v).ratio() for v in variants),
                  "label": r["label"], "plain": r["plain"], "has_number": r["has_number"]} for r in rows),
                key=lambda n: -n["ratio"],
            )[:3]  # fmt: skip
            clean = None if matched is None else {k: matched[k] for k in ("label", "plain", "digits", "tokens", "fold")}
            doc["fields"][field] = {"matched": clean, "nearest": nearest}
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
        raise SystemExit("usage: uv run analysis/ocr/empty_lines.py")
