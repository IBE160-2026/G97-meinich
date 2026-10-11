"""Every Python dependency of step 1 is pinned exactly with `==`.

`pnpm check:pins` reads only package.json; this is its counterpart for
ingest/pyproject.toml. It covers [project].dependencies, every
[dependency-groups] list, every [project.optional-dependencies] list and
[build-system].requires, plus the uv version.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

PYPROJECT = Path(__file__).resolve().parents[1] / "pyproject.toml"
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "pins" / "unpinned-pyproject.toml"

# name, optional [extras], `==`, an exact X.Y.Z version (optionally more
# numeric parts), and nothing else: no marker, no wildcard, no range.
PINNED = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*(\[[A-Za-z0-9._,\s-]+\])?\s*==\s*\d+\.\d+\.\d+(\.\d+)*$")


def requirements(pyproject: dict) -> list[tuple[str, str]]:
    """(where, requirement) for every requirement in the four places."""
    found: list[tuple[str, str]] = []
    for requirement in pyproject.get("project", {}).get("dependencies", []):
        found.append(("project.dependencies", requirement))
    for group, items in pyproject.get("project", {}).get("optional-dependencies", {}).items():
        for requirement in items:
            found.append((f"project.optional-dependencies.{group}", requirement))
    for group, items in pyproject.get("dependency-groups", {}).items():
        for requirement in items:
            # {include-group = "..."} entries name a group, not a package.
            if isinstance(requirement, str):
                found.append((f"dependency-groups.{group}", requirement))
    for requirement in pyproject.get("build-system", {}).get("requires", []):
        found.append(("build-system.requires", requirement))
    return found


def unpinned(pyproject: dict) -> list[tuple[str, str]]:
    return [(where, req) for where, req in requirements(pyproject) if not PINNED.match(req.strip())]


def load(path: Path) -> dict:
    with path.open("rb") as handle:
        return tomllib.load(handle)


def test_the_real_pyproject_pins_everything_exactly() -> None:
    pyproject = load(PYPROJECT)
    assert requirements(pyproject), "no requirements found; the reader is broken"
    assert unpinned(pyproject) == []
    assert re.fullmatch(r"==\d+\.\d+\.\d+", pyproject["tool"]["uv"]["required-version"])


def test_a_range_fails_and_names_the_package() -> None:
    offenders = unpinned(load(FIXTURE))
    assert ("project.dependencies", "httpx>=0.27") in offenders
    names = [req for _, req in offenders]
    assert "pytest~=9.0" in names
    assert "rich" in names
    assert "hatchling" in names
    assert "psycopg[binary]==3.3" in names  # not X.Y.Z
    assert "orjson==3.10.*" in names
    # The one exact pin in the fixture passes.
    assert "anyio==4.6.0" not in names


def test_the_pattern() -> None:
    assert PINNED.match("psycopg[binary]==3.3.6")
    assert PINNED.match("uv_build==0.12.10")
    assert not PINNED.match("httpx>=0.27")
    assert not PINNED.match("x==1.2.3; python_version<'3.14'")
