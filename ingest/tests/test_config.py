"""Configuration files: ingest/config.toml and seed/coverage.json."""

from __future__ import annotations

import json
from fractions import Fraction
from pathlib import Path

import pytest

from conftest import REPO_ROOT, RULES
from peerless_ingest import config


def test_demo_company_c_is_kantall() -> None:
    cfg = config.load_config(REPO_ROOT / "ingest" / "config.toml", env={})
    assert (cfg.demo_company_c.orgnr, cfg.demo_company_c.navn) == ("967534579", "KANTALL AS")
    # Never the developer's employer (Story 1.3a).
    assert cfg.demo_company_c.orgnr != "979607008"
    assert cfg.base_url == "https://data.brreg.no"


def test_base_url_from_environment() -> None:
    cfg = config.load_config(REPO_ROOT / "ingest" / "config.toml", env={"BRREG_API_BASE_URL": "http://127.0.0.1:9/"})
    assert cfg.base_url == "http://127.0.0.1:9"


def test_committed_coverage() -> None:
    assert json.loads((REPO_ROOT / "seed" / "coverage.json").read_text(encoding="utf-8")) == [
        {"code": "62.100", "measured": False}
    ]
    assert config.load_coverage() == ["62.100"]


def test_coverage_rejects_a_bad_entry(tmp_path: Path) -> None:
    for content in ["[]", '{"code": "62.100"}', '[{"code": "62100"}]', '[{"code": "62.100"}, {"code": "62.100"}]']:
        path = tmp_path / "coverage.json"
        path.write_text(content, encoding="utf-8")
        with pytest.raises(config.ConfigError):
            config.load_coverage(path)


def test_database_url_is_required() -> None:
    with pytest.raises(config.ConfigError):
        config.database_url(env={})


def test_committed_reconciliation_values() -> None:
    # Story 2.2 (Meinich, 2026-10-21): 5 kr within a document; between
    # sources max(5 kr, 0.001 %), parsed exactly. conftest's RULES mirror them.
    cfg = config.load_config(REPO_ROOT / "ingest" / "config.toml", env={})
    assert cfg.within_document_bound_kr == 5
    assert cfg.between_sources_floor_kr == 5
    assert cfg.between_sources_tolerance == Fraction(1, 100_000)
    assert type(cfg.between_sources_tolerance) is Fraction
    assert (cfg.within_document_bound_kr, cfg.between_sources_floor_kr, cfg.between_sources_tolerance) == (
        RULES.within_document_bound_kr,
        RULES.between_sources_floor_kr,
        RULES.between_sources_tolerance,
    )


VALID_RECONCILIATION = {
    "within_document_bound_kr": "5",
    "between_sources_floor_kr": "5",
    "between_sources_tolerance": '"0.00001"',
}


def _config_with(tmp_path: Path, reconciliation: dict[str, str] | None) -> Path:
    base = (REPO_ROOT / "ingest" / "config.toml").read_text(encoding="utf-8")
    base = base[: base.index("[reconciliation]")]
    if reconciliation is not None:
        base += "[reconciliation]\n" + "".join(f"{key} = {value}\n" for key, value in reconciliation.items())
    path = tmp_path / "config.toml"
    path.write_text(base, encoding="utf-8")
    return path


def test_reconciliation_config_validated(tmp_path: Path) -> None:
    assert config.load_config(_config_with(tmp_path, VALID_RECONCILIATION), env={}).between_sources_tolerance == Fraction(
        1, 100_000
    )
    bad: list[dict[str, str] | None] = [None]  # no [reconciliation] table
    for key in VALID_RECONCILIATION:
        bad.append({k: v for k, v in VALID_RECONCILIATION.items() if k != key})  # missing: no default
    for tolerance in ("0.00001", '"1e-5"', '"abc"', '"-0.00001"', '".00001"', '""', "1"):
        bad.append(VALID_RECONCILIATION | {"between_sources_tolerance": tolerance})  # a float, an exponent, ...
    for key in ("within_document_bound_kr", "between_sources_floor_kr"):
        for value in ("-1", "5.0", '"5"', "true"):
            bad.append(VALID_RECONCILIATION | {key: value})
    for reconciliation in bad:
        with pytest.raises(config.ConfigError):
            config.load_config(_config_with(tmp_path, reconciliation), env={})
