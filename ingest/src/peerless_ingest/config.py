"""Step 1's configuration: ingest/config.toml, seed/coverage.json and the
environment. Reading only; nothing here touches the network or the database."""

from __future__ import annotations

import json
import os
import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

# ingest/src/peerless_ingest/config.py -> ingest/
INGEST_DIR = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = INGEST_DIR / "config.toml"
DEFAULT_COVERAGE = INGEST_DIR.parent / "seed" / "coverage.json"

ORGNR = re.compile(r"^\d{9}$")
# An SN2025 code as the register writes it, e.g. "NN.NNN". The shape alone
# does not tell SN2025 from SN2007; the register does, by returning nothing.
INDUSTRY_CODE = re.compile(r"^\d{2}\.\d{3}$")


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
    return Config(
        base_url=str(base_url).rstrip("/"),
        user_agent=str(register.get("user_agent", "Peerless")),
        # A pause in seconds, not money: a float is fine here.
        request_pause_seconds=float(pause),
        demo_company_c=DemoCompany(orgnr=orgnr, navn=str(demo.get("navn", ""))),
    )


def load_coverage(path: Path = DEFAULT_COVERAGE) -> list[str]:
    """The industry codes declared in seed/coverage.json, in file order.

    Only `code` matters to step 1. The full validation of the entry shape
    (`measured`, `report`, `sha256`) belongs to the loader (Story 1.3b)."""
    entries = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(entries, list):
        raise ConfigError(f"{path}: expected a JSON list of entries")
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
