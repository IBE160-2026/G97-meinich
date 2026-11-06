"""The reader before and after a change, on recognised words already cached: Story 2.5c's regression check.

Reads every document whose recognised words the probes cached
(`analysis/.cache/ocr/probe/*.words.json`, gitignored, written by
`analysis/ocr/empty_lines.py` and `analysis/ocr/cost_sum.py`) twice with
`documents.read_words`: once with `ingest/src` as it stood at an older
commit (`--old`, extracted with `git archive`), once with the working tree's
`ingest/src`. No OCR, no database, no network. Each reader runs in its own
Python process, so the two versions never share a module.

Reports, as totals only (no orgnr):

- per figure field, the figures that differ, by kind: refused (a figure
  before, none after), new, changed;
- the columns whose c1-c4 differ;
- for `varer` (R4, read from balance pages only since Story 2.5c), where the
  old figure came from: the income statement's row, a balance row, both, or
  neither, found by running the old reader's `layout.extract` on its
  income-statement pages alone and on its balance pages alone. A changed
  `varer` whose old figure came from a balance row is a real stock the new
  reader lost;
- each count for the Story 2.5c probe's 344 documents by set (the probe's
  list, `analysis/.cache/ocr/probe/todo-2.5c.json`: reference 20,
  not_summing 44, ordering 180, draw 100), and for every cached document.

Writes `analysis/output/reader-regression-2.5c.md` and `.json`; neither
holds a date, so the same cache and commits give the same bytes. The cache
is local data (gitignored), so this reruns only where the probes ran.

Run (host, from the repository root):
    uv --directory ingest run --frozen python ../analysis/ocr/reader_regression.py --old e87f166
"""

from __future__ import annotations

import argparse
import io
import json
import subprocess
import sys
import tarfile
import tempfile
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
CACHE = REPO / "analysis" / ".cache" / "ocr" / "probe"
TODO = CACHE / "todo-2.5c.json"
OUT_MD = REPO / "analysis" / "output" / "reader-regression-2.5c.md"
OUT_JSON = REPO / "analysis" / "output" / "reader-regression-2.5c.json"
BOUND_KR = 5  # within_document_bound_kr in ingest/config.toml


# --- Worker: one reader version ----------------------------------------------------


def worker(src: str, out: str) -> None:
    sys.path.insert(0, src)
    from peerless_ingest import documents, layout, ocr  # noqa: PLC0415

    result: dict[str, object] = {}
    for f in sorted(CACHE.glob("*.words.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        mk = lambda ws: [ocr.Word(w[0], w[1], w[2], w[3], w[4], tuple(w[5])) for w in ws]  # noqa: E731
        top = mk(data["top"])
        pages = [ocr.PageWords(mk(p["plain"]), mk(p["digits"])) for p in data["pages"]]
        read = documents.read_words(top, pages, BOUND_KR)
        columns = {}
        for role, column in (("current", read.current), ("prior", read.prior)):
            if column is not None:
                columns[role] = {"figures": dict(column.figures), "checks": [column.c1, column.c2, column.c3, column.c4]}
        # Where `varer` would come from on each page kind alone (plain pass:
        # `varer` is in no check and no gate, so the digits pass never fills it).
        source = {}
        if read.current is not None:
            parsed = documents.parse_pages(pages, "plain")
            for kind in ("resultat", "balanse"):
                found = layout.extract([p for p in parsed if p.kind == kind]).get("varer", (None, None))
                source[kind] = list(found)
        result[f.name.removesuffix(".words.json")] = {"columns": columns, "varer_alone": source}
    Path(out).write_text(json.dumps(result), encoding="utf-8")


# --- Host ------------------------------------------------------------------------


def run_reader(src: Path, out: Path) -> dict:
    subprocess.run([sys.executable, "-I", __file__, "--worker", str(src), str(out)], check=True)
    return json.loads(out.read_text(encoding="utf-8"))


def commit_of(ref: str) -> str:
    return subprocess.run(["git", "rev-parse", ref], cwd=REPO, check=True, capture_output=True, text=True).stdout.strip()


def ingest_commit() -> str:
    """The last commit that changed ingest/ (what `reader_commit` records); refuses uncommitted changes there."""
    dirty = subprocess.run(["git", "status", "--porcelain", "--", "ingest"], cwd=REPO, check=True, capture_output=True, text=True).stdout
    if dirty.strip():
        raise SystemExit("ingest/ has uncommitted changes; commit them first")
    return subprocess.run(["git", "log", "-1", "--format=%H", "--", "ingest"], cwd=REPO, check=True, capture_output=True, text=True).stdout.strip()


def compare(old: dict, new: dict, keys: list[str]) -> dict:
    figures: Counter[str] = Counter()
    columns = 0
    checks_changed = 0
    varer: Counter[str] = Counter()
    for key in keys:
        o, n = old[key], new[key]
        for role, oc in o["columns"].items():
            nc = n["columns"].get(role)
            columns += 1
            if nc is None:
                figures["column lost"] += 1
                continue
            if oc["checks"] != nc["checks"]:
                checks_changed += 1
            for field, before in oc["figures"].items():
                after = nc["figures"].get(field)
                if before == after:
                    continue
                kind = "refused" if after is None else ("new" if before is None else "changed")
                figures[f"{field}: {kind}"] += 1
                if field == "varer":
                    if before is None:
                        varer["not read before"] += 1
                        continue
                    i = 0 if role == "current" else 1
                    alone = o["varer_alone"]
                    from_is = alone.get("resultat", [None, None])[i] == before
                    from_bal = alone.get("balanse", [None, None])[i] == before
                    origin = {(True, False): "income statement row", (False, True): "balance row", (True, True): "both"}.get(
                        (from_is, from_bal), "neither"
                    )
                    varer[f"old figure from {origin}" + (" (negative)" if before < 0 else "")] += 1
    return {
        "documents": len(keys),
        "columns": columns,
        "columns_with_c1_c4_changed": checks_changed,
        "figures": dict(sorted(figures.items())),
        "figures_refused_not_varer": sum(v for k, v in figures.items() if k.endswith(": refused") and not k.startswith("varer")),
        "varer": dict(sorted(varer.items())),
    }


def render(report: dict) -> str:
    lines = [
        "# The reader before and after Story 2.5c, on cached words",
        "",
        f"Written by `analysis/ocr/reader_regression.py`: every document whose recognised words the probes cached, read with `ingest/src` at `{report['old'][:7]}` and at `{report['new'][:7]}` (the last commit to `ingest/`), on the host, no OCR. Totals only.",
        "",
        "`varer` origin: where the old figure came from, found by running the old reader's `layout.extract` on its income-statement pages alone and on its balance pages alone. A changed `varer` whose old figure came from a balance row is a real stock the new reader lost.",
        "",
    ]
    for name, part in report["scopes"].items():
        lines += [
            f"## {name}",
            "",
            f"Documents {part['documents']}, columns {part['columns']}; columns with c1–c4 changed: {part['columns_with_c1_c4_changed']}; figures refused, `varer` aside: {part['figures_refused_not_varer']}.",
            "",
            "| Field: kind | Figures |",
            "|---|---|",
            *[f"| {k} | {v} |" for k, v in part["figures"].items()],
            "",
            "| `varer` changed: origin of the old figure | Columns |",
            "|---|---|",
            *[f"| {k} | {v} |" for k, v in part["varer"].items()],
            "",
        ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--old", help="the commit whose ingest/src is the old reader")
    parser.add_argument("--worker", nargs=2, metavar=("SRC", "OUT"), help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        worker(*args.worker)
        return
    if not args.old:
        parser.error("--old is required")
    old_commit, new_commit = commit_of(args.old), ingest_commit()
    with tempfile.TemporaryDirectory() as tmp:
        archive = subprocess.run(["git", "archive", old_commit, "ingest/src"], cwd=REPO, check=True, capture_output=True).stdout
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(tmp, filter="data")
        old = run_reader(Path(tmp) / "ingest" / "src", Path(tmp) / "old.json")
        new = run_reader(REPO / "ingest" / "src", Path(tmp) / "new.json")
    todo = json.loads(TODO.read_text(encoding="utf-8"))
    by_set: dict[str, list[str]] = {}
    for d in todo:
        key = f"{d['orgnr']}-{d['year']}"
        if key in old:
            by_set.setdefault(d["set"], []).append(key)
    probe = sorted(k for keys in by_set.values() for k in keys)
    scopes = {f"The Story 2.5c probe's documents, set {s}": compare(old, new, sorted(keys)) for s, keys in sorted(by_set.items())}
    scopes[f"The Story 2.5c probe's {len(probe)} documents"] = compare(old, new, probe)
    scopes[f"Every cached document ({len(old)})"] = compare(old, new, sorted(old))
    report = {"old": old_commit, "new": new_commit, "scopes": scopes}
    OUT_JSON.write_text(json.dumps(report, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    OUT_MD.write_text(render(report) + "\n", encoding="utf-8")
    print(f"wrote {OUT_MD.relative_to(REPO)} and {OUT_JSON.name}")


if __name__ == "__main__":
    main()
