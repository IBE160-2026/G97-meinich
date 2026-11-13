"""Does `layout.page_kind` explain R4's known gap? Story 2.5d's read-only probe.

R4 (Story 2.5c) reads `varer` from balance pages only. `page_kind` calls a
page an income-statement page when "resultatregnskap" appears anywhere in
its labels, before "balanse" is checked, so a page holding both statements,
or a balance page whose heading is misread, would give no `varer`
(review session, PR #48). After Story 2.5c's re-read one company-year's
stock is empty while the next filing year's document prints it as its
prior-year figure (`emptied_current_held_by_next_prior` = 1).

Reads every document whose recognised words the probes cached
(`analysis/.cache/ocr/probe/*.words.json`, gitignored) with
`documents.read_words`'s parsing and the working tree's `ingest/src`. No
OCR, no database, no network. Reports, as totals only (no orgnr):

- pages by what `page_kind` sees: both headings, a balance heading only, an
  income-statement heading only, neither; and pages whose rows match balance
  fields while the page is not a balance page (a balance without a readable
  heading, or a continuation that inherited the income statement's kind);
- the rows labelled as `varer` would match, by the kind of page they are on;
- `varer` per column under two other rules, against R4 as built:
  - "split at the heading": on a page with both headings, the rows below the
    line that starts "balanse" are balance rows; a page whose kind is not
    balance but whose rows match at least two balance fields and no
    income-statement field is a balance page;
  - "any page" (the rule before Story 2.5c);
  each difference classified by where the figure comes from (the income
  statement's inventory-change row, a balance row) and checked against the
  neighbouring filing year's document where it is cached (this year's
  current column is next year's prior column);
- the gap itself: columns whose `varer` is empty while the neighbouring
  year's document holds it, and why (no balance `varer` row, or its figure
  refused).

Writes `analysis/output/page-kind-probe.md` and `.json`; neither holds a
date, so the same cache and code give the same bytes.

Run (host, from the repository root):
    uv --directory ingest run --frozen python ../analysis/ocr/page_kind_probe.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from dataclasses import replace
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(REPO / "ingest" / "src"))

from peerless_ingest import documents, layout, ocr  # noqa: E402

CACHE = REPO / "analysis" / ".cache" / "ocr" / "probe"
OUT_MD = REPO / "analysis" / "output" / "page-kind-probe.md"
OUT_JSON = REPO / "analysis" / "output" / "page-kind-probe.json"

BALANCE_FIELDS = (
    "kundefordringer",
    "bankinnskudd",
    "sum_eiendeler",
    "sum_egenkapital",
    "leverandorgjeld",
    "sum_kortsiktig_gjeld",
    "sum_gjeld",
    "sum_egenkapital_gjeld",
    "sum_varige_driftsmidler",
)
INCOME_FIELDS = (
    "salgsinntekt",
    "sum_driftsinntekter",
    "varekostnad",
    "lonnskostnad",
    "annen_driftskostnad",
    "sum_driftskostnad",
    "driftsresultat",
    "aarsresultat",
)


def words(raw: list) -> list[ocr.Word]:
    return [ocr.Word(w[0], w[1], w[2], w[3], w[4], tuple(w[5])) for w in raw]


def load(path: Path) -> tuple[list[ocr.Word], list[ocr.PageWords]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return words(data["top"]), [ocr.PageWords(words(p["plain"]), words(p["digits"])) for p in data["pages"]]


def matches(label: str, fields: tuple[str, ...]) -> bool:
    folded = layout.fold(label)
    return any(folded.endswith(v) for f in fields for v in layout.TARGETS[f])


def is_varer_row(label: str) -> bool:
    return any(layout.fold(label).endswith(v) for v in layout.TARGETS["varer"])


def split_rule(pages: list[layout.Page]) -> list[layout.Page]:
    """The pages as the "split at the heading" rule would classify them."""
    out: list[layout.Page] = []
    for page in pages:
        if page.kind == "resultat":
            at = next((i for i, r in enumerate(page.rows) if layout.fold(r.label).startswith("balanse")), None)
            if at is not None and at > 0:
                out += [replace(page, rows=page.rows[:at]), replace(page, kind="balanse", rows=page.rows[at:])]
                continue
        if page.kind != "balanse":
            numbered = [r for r in page.rows if r.has_number]
            balance = {f for f in BALANCE_FIELDS for r in numbered if matches(r.label, (f,))}
            income = any(matches(r.label, INCOME_FIELDS) for r in numbered)
            if len(balance) >= 2 and not income:
                out.append(replace(page, kind="balanse"))
                continue
        out.append(page)
    return out


def varer_under(pages: list[layout.Page], rule: str) -> tuple[int | None, int | None]:
    if rule == "r4":
        return layout.extract(pages).get("varer", (None, None))
    if rule == "split":
        return layout.extract(split_rule(pages)).get("varer", (None, None))
    if rule == "any":
        return layout.extract([replace(p, kind="balanse") if p.kind == "resultat" else p for p in pages]).get(
            "varer", (None, None)
        )
    raise ValueError(rule)


def read_one(path: Path) -> dict | None:
    top, pages = load(path)
    if layout.classify(top) != "generated":
        return None
    plain = documents.parse_pages(pages, "plain")
    read = documents.read_words(top, pages, 5)
    if read.current is None or read.prior is None:
        return None
    page_counts: Counter[str] = Counter()
    varer_rows: Counter[str] = Counter()
    for pw, page in zip(pages, plain):
        text = layout.fold(" ".join(w.text for w in pw.plain))
        res, bal = "resultatregnskap" in text, "balanse" in text
        heading = {(True, True): "both headings", (False, True): "balance heading only", (True, False): "income-statement heading only"}.get(
            (res, bal), "neither heading"
        )
        page_counts[f"{heading}; kind {page.kind}"] += 1
        if res and bal and page.kind == "resultat":
            # "balanse" only inside "balanseført" (capitalised development
            # costs) is an income-statement row, not a balance heading.
            heading_line = any(
                layout.fold(r.label).startswith("balanse") and not layout.fold(r.label).startswith("balansefort")
                for r in page.rows
            )
            page_counts[f"both headings, kind resultat: {'a line starting \"balanse\"' if heading_line else '\"balanse\" only in \"balanseført\"'}"] += 1
        numbered = [r for r in page.rows if r.has_number]
        if page.kind != "balanse" and any(matches(r.label, BALANCE_FIELDS) for r in numbered):
            page_counts[f"balance rows on a page of kind {page.kind}"] += 1
        for r in numbered:
            if is_varer_row(r.label):
                varer_rows[f"kind {page.kind}"] += 1
    # The income-statement pages alone, relabelled so `varer` may match there.
    income_only = layout.extract([replace(p, kind="balanse") for p in plain if p.kind == "resultat"]).get("varer", (None, None))
    balance_only = layout.extract([p for p in plain if p.kind == "balanse"]).get("varer", (None, None))
    # The digits-only pass on the balance pages: `varer` is in no gate, so
    # this figure never reaches the stored column; it shows only what the
    # second pass read on the row the plain pass refused.
    digits = documents.parse_pages(pages, "digits")
    balance_digits = layout.extract([p for p in digits if p.kind == "balanse"]).get("varer", (None, None))
    balance_row = any(p.kind == "balanse" and any(r.has_number and is_varer_row(r.label) for r in p.rows) for p in plain)
    rules = {rule: varer_under(plain, rule) for rule in ("r4", "split", "any")}
    return {
        "years": (read.current.year, read.prior.year),
        "pages": page_counts,
        "varer_rows": varer_rows,
        "income_only": income_only,
        "balance_only": balance_only,
        "balance_digits": balance_digits,
        "balance_row": balance_row,
        "rules": rules,
    }


def main() -> None:
    reads: dict[tuple[str, int], dict] = {}
    skipped = 0
    for path in sorted(CACHE.glob("*.words.json")):
        orgnr, year = path.name.removesuffix(".words.json").split("-")
        one = read_one(path)
        if one is None:
            skipped += 1
            continue
        reads[(orgnr, int(year))] = one

    pages: Counter[str] = Counter()
    varer_rows: Counter[str] = Counter()
    diffs: Counter[str] = Counter()
    gap: Counter[str] = Counter()
    for (orgnr, year), one in reads.items():
        pages.update(one["pages"])
        varer_rows.update(one["varer_rows"])
        for index, role in ((0, "current"), (1, "prior")):
            # The same company-year read from the neighbouring document.
            neighbour = reads.get((orgnr, year + 1)) if role == "current" else reads.get((orgnr, year - 1))
            other = None if neighbour is None else neighbour["rules"]["r4"][1 - index]
            r4 = one["rules"]["r4"][index]
            if r4 is None and other is not None:
                row = "a balance `varer` row" if one["balance_row"] else "no balance `varer` row"
                plain_read = "plain figure read" if one["balance_only"][index] is not None else "plain figure refused or missing"
                second = one["balance_digits"][index]
                if second is None:
                    second_read = "digits pass reads none"
                elif second == other:
                    second_read = "digits pass equals the neighbour"
                else:
                    second_read = "digits pass differs from the neighbour"
                gap[f"{role}: empty, the neighbouring year holds it; {row}, {plain_read}, {second_read}"] += 1
            for rule in ("split", "any"):
                alt = one["rules"][rule][index]
                if alt == r4:
                    continue
                origin = (
                    "the income statement's row"
                    if alt is not None and alt == one["income_only"][index]
                    else ("none" if alt is None else "a balance row")
                )
                verdict = "no neighbour cached" if other is None else ("equals the neighbour" if alt == other else "differs from the neighbour")
                kind = "new" if r4 is None else ("lost" if alt is None else "changed")
                diffs[f"{rule}: {kind}, from {origin}, {verdict}"] += 1

    for rule in ("split", "any"):
        if not any(k.startswith(f"{rule}:") for k in diffs):
            diffs[f"{rule}: no column differs"] = 0
    report = {
        "documents_cached": len(reads) + skipped,
        "documents_read": len(reads),
        "documents_skipped_no_columns": skipped,
        "pages": dict(sorted(pages.items())),
        "varer_rows_by_page_kind": dict(sorted(varer_rows.items())),
        "varer_differences_against_r4": dict(sorted(diffs.items())),
        "gap_in_cache": dict(sorted(gap.items())),
    }
    OUT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    OUT_MD.write_text(render(report), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


def table(title: str, counts: dict[str, int]) -> list[str]:
    rows = [f"| {k} | {v} |" for k, v in counts.items()] or ["| (none) | 0 |"]
    return [f"| {title} | Count |", "|---|---|", *rows, ""]


def render(report: dict) -> str:
    return "\n".join(
        [
            "# Does `page_kind` explain R4's gap? Story 2.5d's probe",
            "",
            "Written by `analysis/ocr/page_kind_probe.py`: every document whose recognised words the probes cached, "
            "parsed with the working tree's `ingest/src`, on the host, no OCR. Totals only.",
            "",
            f"Documents cached {report['documents_cached']}; read with both columns {report['documents_read']}; "
            f"skipped (not generated, or no columns) {report['documents_skipped_no_columns']}.",
            "",
            "## Pages",
            "",
            *table("Headings in the labels; the page's kind", report["pages"]),
            "## Rows `varer` would match",
            "",
            *table("Page kind", report["varer_rows_by_page_kind"]),
            "## `varer` under another rule, against R4 as built",
            "",
            "Per column. \"Neighbour\": the same company-year read from the neighbouring filing year's document, where cached.",
            "",
            *table("Rule: difference, origin, check", report["varer_differences_against_r4"]),
            "## The gap in the cache",
            "",
            *table("Column", report["gap_in_cache"]),
        ]
    )


if __name__ == "__main__":
    main()
