"""Configuration files: ingest/config.toml and seed/coverage.json."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from conftest import REPO_ROOT
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
    for content in ['{"code": "62.100"}', '[{"code": "62100"}]', '[{"code": "62.100"}, {"code": "62.100"}]']:
        path = tmp_path / "coverage.json"
        path.write_text(content, encoding="utf-8")
        with pytest.raises(config.ConfigError):
            config.load_coverage(path)


def test_database_url_is_required() -> None:
    with pytest.raises(config.ConfigError):
        config.database_url(env={})
