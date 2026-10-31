"""Step 1's configuration: ingest/config.toml, seed/coverage.json and the
environment. Reading only; nothing here touches the network or the database."""

from __future__ import annotations

import json
import os
import re
import tomllib
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

# ingest/src/peerless_ingest/config.py -> ingest/
INGEST_DIR = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = INGEST_DIR / "config.toml"
DEFAULT_COVERAGE = INGEST_DIR.parent / "seed" / "coverage.json"

ORGNR = re.compile(r"^\d{9}$")
# An SN2025 code as the register writes it, e.g. "NN.NNN". The shape alone
# does not tell SN2025 from SN2007; the register does, by returning nothing.
INDUSTRY_CODE = re.compile(r"^\d{2}\.\d{3}$")
# A non-negative decimal written as a string, e.g. "0.00001": parsed exactly
# as a Fraction, never through a float (AD-14).
DECIMAL_STRING = re.compile(r"^\d+(\.\d+)?$")


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class DemoCompany:
    orgnr: str
    navn: str


@dataclass(frozen=True)
class Config:
    base_url: str
    user_agent: str
    request_pause_seconds: float
    demo_company_c: DemoCompany
    # [reconciliation] (Story 2.2): the two rules, each with its own value,
    # never one shared value. Reasons in docs/data-sources-brreg.md.
    within_document_bound_kr: int
    between_sources_floor_kr: int
    between_sources_tolerance: Fraction
    # [withdrawal] (Story 2.4, D5): above this share of stored companies
    # absent from the bulk file, the withdrawal check is skipped.
    max_absent_share: Fraction


def load_config(path: Path = DEFAULT_CONFIG, env: dict[str, str] | None = None) -> Config:
    env = dict(os.environ) if env is None else env
    with path.open("rb") as handle:
        data = tomllib.load(handle)
    register = data.get("register", {})
    demo = data.get("demo_company_c", {})
    orgnr = str(demo.get("orgnr", ""))
    if not ORGNR.match(orgnr):
        raise ConfigError(f"{path}: demo_company_c.orgnr must be nine digits, got {orgnr!r}")
    base_url = env.get("BRREG_API_BASE_URL") or register.get("base_url")
    if not base_url:
        raise ConfigError(f"{path}: register.base_url is not set")
    pause = register.get("request_pause_seconds", 0.15)
    if not isinstance(pause, (int, float)) or isinstance(pause, bool) or pause < 0:
        raise ConfigError(f"{path}: register.request_pause_seconds must be a non-negative number")
    reconciliation = data.get("reconciliation")
    if not isinstance(reconciliation, dict):
        raise ConfigError(f"{path}: the [reconciliation] table is missing")
    withdrawal = data.get("withdrawal")
    if not isinstance(withdrawal, dict):
        raise ConfigError(f"{path}: the [withdrawal] table is missing")
    return Config(
        base_url=str(base_url).rstrip("/"),
        user_agent=str(register.get("user_agent", "Peerless")),
        # A pause in seconds, not money: a float is fine here.
        request_pause_seconds=float(pause),
        demo_company_c=DemoCompany(orgnr=orgnr, navn=str(demo.get("navn", ""))),
        within_document_bound_kr=_kroner(path, reconciliation, "within_document_bound_kr"),
        between_sources_floor_kr=_kroner(path, reconciliation, "between_sources_floor_kr"),
        between_sources_tolerance=_fraction(path, reconciliation, "between_sources_tolerance"),
        max_absent_share=_share(path, withdrawal, "max_absent_share"),
    )


def _share(path: Path, table: dict[str, object], key: str) -> Fraction:
    """A share from 0 to 1, written as a TOML number (0.01). Read exactly
    from its decimal text, so 0.01 is exactly 1/100. Required: no default."""
    value = table.get(key)
    if type(value) not in (int, float):
        raise ConfigError(f"{path}: withdrawal.{key} must be a number from 0 to 1, got {value!r}")
    share = Fraction(str(value))
    if not 0 <= share <= 1:
        raise ConfigError(f"{path}: withdrawal.{key} must be a number from 0 to 1, got {value!r}")
    return share


def _kroner(path: Path, table: dict[str, object], key: str) -> int:
    """A whole, non-negative number of kroner. Required: no default."""
    value = table.get(key)
    if type(value) is not int or value < 0:
        raise ConfigError(f"{path}: reconciliation.{key} must be a non-negative whole number of kroner, got {value!r}")
    return value


def _fraction(path: Path, table: dict[str, object], key: str) -> Fraction:
    """A non-negative decimal given as a string ("0.00001"), parsed exactly.
    A TOML float is refused: it would already have been rounded in binary."""
    value = table.get(key)
    if not isinstance(value, str) or not DECIMAL_STRING.match(value):
        raise ConfigError(f"{path}: reconciliation.{key} must be a decimal string such as \"0.00001\", got {value!r}")
    return Fraction(value)


def load_coverage(path: Path = DEFAULT_COVERAGE) -> list[str]:
    """The industry codes declared in seed/coverage.json, in file order.

    Only `code` matters to step 1. The full validation of the entry shape
    (`measured`, `report`, `sha256`) belongs to the loader (Story 1.3b)."""
    entries = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(entries, list) or not entries:
        raise ConfigError(f"{path}: expected a non-empty JSON list of entries")
    codes: list[str] = []
    for index, entry in enumerate(entries):
        code = entry.get("code") if isinstance(entry, dict) else None
        if not isinstance(code, str) or not INDUSTRY_CODE.match(code):
            raise ConfigError(f"{path}: entry {index} has no valid `code`")
        if code in codes:
            raise ConfigError(f"{path}: code {code} is declared twice")
        codes.append(code)
    return codes


def database_url(env: dict[str, str] | None = None) -> str:
    env = dict(os.environ) if env is None else env
    url = env.get("INGEST_DATABASE_URL", "")
    if not url:
        raise ConfigError("INGEST_DATABASE_URL is not set; run `pnpm db:roles` and use .env")
    return url
