"""Reconciliation of a read document (Story 2.2; FR-57, FR-58; AD-1, AD-15).

Two rules, each one function with one configured value, never combined:

- **Within a document** (`within_document_checks`): the four column checks
  c1-c4 of `documents.checks`, each holding when its two sides differ by at
  most `within_document_bound_kr` kroner. Absolute: the register prints whole
  kroner rounded from øre, so a stated sum can be a krone or two off its
  components; a misread figure is wrong by orders of magnitude.
- **Between sources** (`api_check`): each of the `SHARED_FIELDS` that both the
  column and the key-figures API filing of the column's stated year hold,
  non-NULL, agrees when |document - API| <= max(floor, tolerance x |API|).

`column_status` turns the results into a column's status, and a document's
status is its current column's status (`document_status`). A prior column is
accepted on c1-c4 alone; its comparison with the register is stored as
information and never changes a status (Meinich, 2026-10-21): the register
holds that year's own filing, and a prior column that differs from it is a
restated comparative, not an OCR error.

Every amount here is an int in øre and every comparison is exact (int and
`Fraction`); there is no float. NULL is never 0: a check or a comparison with
a NULL operand is not evaluable. No function takes an OCR confidence: the
flag comes only from these checks.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from fractions import Fraction
from typing import Literal

from .documents import CheckResult, checks

ApiCheck = Literal["pass", "fail", "not_evaluable"]
Status = Literal["reconciled", "failed_reconciliation"]
Role = Literal["current", "prior"]

# The figures the document and register.key_figures both hold, by the same
# name (document field = key_figures column without `_ore`). In this order
# in `api_fail_fields`.
SHARED_FIELDS: tuple[str, ...] = (
    "sum_driftsinntekter",
    "sum_driftskostnad",
    "driftsresultat",
    "netto_finans",
    "ordinaert_resultat_foer_skattekostnad",
    "aarsresultat",
    "sum_eiendeler",
    "sum_egenkapital",
    "sum_kortsiktig_gjeld",
    "sum_gjeld",
    "sum_egenkapital_gjeld",
)

ORE_PER_KRONE = 100


@dataclass(frozen=True)
class Rules:
    """The configured values ([reconciliation] in ingest/config.toml)."""

    within_document_bound_kr: int
    between_sources_floor_kr: int
    between_sources_tolerance: Fraction


@dataclass(frozen=True)
class ApiResult:
    check: ApiCheck
    fail_fields: tuple[str, ...]  # the SHARED_FIELDS that failed, empty unless `check` is fail


@dataclass(frozen=True)
class Reconciliation:
    """What is stored for one column."""

    c1: CheckResult
    c2: CheckResult
    c3: CheckResult
    c4: CheckResult
    api: ApiResult
    status: Status


# --- Rule 1: within a document ----------------------------------------------------


def within_document_checks(figures_ore: Mapping[str, int | None], bound_kr: int) -> dict[str, CheckResult]:
    """c1-c4 on a column's figures in øre, within `bound_kr` kroner."""
    if type(bound_kr) is not int or bound_kr < 0:
        raise ValueError(f"the within-document bound must be a non-negative int of kroner, got {bound_kr!r}")
    return checks(dict(figures_ore), bound_kr * ORE_PER_KRONE)


# --- Rule 2: between sources -------------------------------------------------------


def figure_agrees(document_ore: int, api_ore: int, floor_kr: int, tolerance: Fraction) -> bool:
    """|document - API| <= max(floor, tolerance x |API|), exactly."""
    deviation = abs(document_ore - api_ore)
    return deviation <= floor_kr * ORE_PER_KRONE or deviation <= tolerance * abs(api_ore)


def api_check(
    figures_ore: Mapping[str, int | None],
    api_ore: Mapping[str, int | None] | None,
    floor_kr: int,
    tolerance: Fraction,
) -> ApiResult:
    """The column against the API filing of its stated year (`api_ore`, keyed
    by field name; None when there is no such filing). `not_evaluable` when
    there is no filing or no field both hold non-NULL; `fail` naming every
    field that disagrees; `pass` otherwise."""
    if type(floor_kr) is not int or floor_kr < 0:
        raise ValueError(f"the between-sources floor must be a non-negative int of kroner, got {floor_kr!r}")
    if not isinstance(tolerance, Fraction) or tolerance < 0:
        raise ValueError(f"the between-sources tolerance must be a non-negative Fraction, got {tolerance!r}")
    if api_ore is None:
        return ApiResult("not_evaluable", ())
    compared = 0
    failed: list[str] = []
    for field in SHARED_FIELDS:
        document, api = figures_ore[field], api_ore[field]
        if document is None or api is None:
            continue
        compared += 1
        if not figure_agrees(document, api, floor_kr, tolerance):
            failed.append(field)
    if compared == 0:
        return ApiResult("not_evaluable", ())
    return ApiResult("fail", tuple(failed)) if failed else ApiResult("pass", ())


# --- Status ------------------------------------------------------------------------


def column_status(role: Role, c1: CheckResult, c2: CheckResult, c3: CheckResult, c4: CheckResult, api: ApiCheck) -> Status:
    """`reconciled` when no check fails and both core checks, c1 (income
    statement) and c3 (balance), were evaluable; for the current column the
    API comparison must not fail either. A prior column's API comparison is
    information only."""
    if "fail" in (c1, c2, c3, c4):
        return "failed_reconciliation"
    if c1 != "pass" or c3 != "pass":
        return "failed_reconciliation"
    if role == "current" and api == "fail":
        return "failed_reconciliation"
    return "reconciled"


def reconcile_column(
    role: Role,
    figures_ore: Mapping[str, int | None],
    api_ore: Mapping[str, int | None] | None,
    rules: Rules,
) -> Reconciliation:
    """Both rules on one column, and its status."""
    c = within_document_checks(figures_ore, rules.within_document_bound_kr)
    api = api_check(figures_ore, api_ore, rules.between_sources_floor_kr, rules.between_sources_tolerance)
    status = column_status(role, c["c1"], c["c2"], c["c3"], c["c4"], api.check)
    return Reconciliation(c["c1"], c["c2"], c["c3"], c["c4"], api, status)


def document_status(columns: Sequence[tuple[str, Reconciliation]]) -> Status:
    """A document's status is its current column's status; a failed prior
    column does not fail the filing."""
    current = [rec for role, rec in columns if role == "current"]
    if len(current) != 1:
        raise ValueError(f"a read document must have exactly one current column, got {len(current)}")
    return current[0].status
