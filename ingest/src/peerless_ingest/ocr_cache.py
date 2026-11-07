"""The local OCR word cache (Story 2.5d).

Tesseract's words for a filed document are the same on every read as long as
everything that determines them is the same. The cache keeps them, so a
re-read after a fix that comes after OCR (`layout`, `documents`, `reconcile`)
does not run Tesseract again.

**The key** is everything that determines the words:

- `pdf_sha256`: the sha256 of the PDF as fetched (a re-read still fetches,
  so a refiled document has another sha256 and misses);
- `tesseract`: the first line of `tesseract --version`, read at run time;
- `traineddata_sha256`: the sha256 of `nor.traineddata`, read from the file
  at run time;
- `render`: the render settings in `ocr` (`ZOOM`, `FIGURE_PAGES`, `TOP_DPI`,
  `TOP_FRACTION`) and PyMuPDF's version, which renders the pages;
- `plain_args` and `digits_args`: both passes' Tesseract options.

Only an exact match of every part uses the stored words. A key that differs
in any part is a miss: full OCR runs, the entry is replaced, and the parts
that differed are counted. Nothing is repaired.

**An entry** is `<directory>/<pdf sha256>.json.gz`, gzipped JSON holding
`{"key", "top", "pages"}`, each word as the probes store it:
`[text, left, top, width, height, [page, block, par, line]]`, and each page
as `{"plain": [...], "digits": [...]}`. A paper filing has `pages == []`.
Entries are written atomically (a temporary file in the same directory, then
a rename), so an interrupted write leaves no half entry. An entry that
cannot be read (a truncated gzip, bad JSON, a shape that is not the one
above) is a miss with its reason.

The cache is local and gitignored (`.local/ocr-cache/`, mounted by
`pnpm ingest`), never in the image, the seed, an export or a committed file,
until the licence assessment in Story 5.4.

No word is interpreted here: `documents.read_words` reads stored words
exactly as it reads Tesseract's.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import tempfile
import zlib
from collections import Counter
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

from . import ocr
from .ocr import PageWords, Word

Recognised = tuple[list[Word], list[PageWords]]

# The parts of the key, in the order they are named in the counts.
KEY_PARTS = ("pdf_sha256", "tesseract", "traineddata_sha256", "render", "plain_args", "digits_args")

SUFFIX = ".json.gz"


class KeyUnavailable(RuntimeError):
    """A part of the run's key could not be read (no Tesseract, no model
    file): the cache is not used, and the run says so."""


@dataclass(frozen=True)
class Settings:
    """The parts of the key that are the same for every document of a run,
    as plain JSON values."""

    tesseract: str
    traineddata_sha256: str
    render: Mapping[str, object]
    plain_args: tuple[str, ...]
    digits_args: tuple[str, ...]


def render_settings() -> dict[str, object]:
    """The render settings that determine the page images, PyMuPDF's
    version among them."""
    return {
        "zoom": ocr.ZOOM,
        "figure_pages": list(ocr.FIGURE_PAGES),
        "top_dpi": ocr.TOP_DPI,
        "top_fraction": ocr.TOP_FRACTION,
        "pymupdf": pymupdf.__version__,
    }


def current_settings() -> Settings:
    """The run's settings, read at run time: `tesseract --version` and the
    sha256 of the traineddata file, never copied from constants. Raises
    KeyUnavailable when either cannot be read."""
    version = ocr.tesseract_version()
    model = ocr.model_sha256()
    if not version:
        raise KeyUnavailable("tesseract --version gave nothing")
    if not model:
        raise KeyUnavailable("nor.traineddata not found under TESSDATA_PREFIX")
    return Settings(version, model, render_settings(), tuple(ocr.PLAIN_ARGS), tuple(ocr.DIGITS_ARGS))


@dataclass(frozen=True)
class Key:
    """The full key of one document: the PDF's sha256 and the run's settings."""

    pdf_sha256: str
    settings: Settings

    @staticmethod
    def of(pdf: bytes, settings: Settings) -> Key:
        return Key(hashlib.sha256(pdf).hexdigest(), settings)

    def as_json(self) -> dict[str, object]:
        """The key as the entry stores it: plain JSON values, so a stored key
        and a computed one compare part by part."""
        s = self.settings
        raw: dict[str, object] = {
            "pdf_sha256": self.pdf_sha256,
            "tesseract": s.tesseract,
            "traineddata_sha256": s.traineddata_sha256,
            "render": dict(s.render),
            "plain_args": list(s.plain_args),
            "digits_args": list(s.digits_args),
        }
        # Through JSON once, so tuples become lists exactly as when loaded.
        loaded: dict[str, object] = json.loads(json.dumps(raw))
        return loaded


@dataclass(frozen=True)
class Hit:
    top: list[Word]
    pages: list[PageWords]


@dataclass(frozen=True)
class Miss:
    """Why the stored words were not used: `absent` (no entry), `key` (an
    entry whose key differs; `parts` names each differing part) or
    `unreadable` (`reason` says why)."""

    kind: str
    parts: tuple[str, ...] = ()
    reason: str = ""


def entry_path(directory: Path, pdf_sha256: str) -> Path:
    return directory / f"{pdf_sha256}{SUFFIX}"


def _words_json(words: list[Word]) -> list[list[object]]:
    return [[w.text, w.left, w.top, w.width, w.height, list(w.line)] for w in words]


class Unreadable(ValueError):
    pass


def _int(value: object) -> int:
    # bool is an int in Python; a stored true is not a coordinate.
    if not isinstance(value, int) or isinstance(value, bool):
        raise Unreadable(f"not an integer: {value!r}")
    return value


def _words(value: object) -> list[Word]:
    if not isinstance(value, list):
        raise Unreadable("words are not a list")
    out: list[Word] = []
    for item in value:
        if not isinstance(item, list) or len(item) != 6:
            raise Unreadable("a word is not [text, left, top, width, height, line]")
        text, left, top, width, height, line = item
        if not isinstance(text, str) or not isinstance(line, list) or len(line) != 4:
            raise Unreadable("a word's text or line is malformed")
        a, b, c, d = (_int(n) for n in line)
        out.append(Word(text, _int(left), _int(top), _int(width), _int(height), (a, b, c, d)))
    return out


def _pages(value: object) -> list[PageWords]:
    if not isinstance(value, list):
        raise Unreadable("pages are not a list")
    out: list[PageWords] = []
    for page in value:
        if not isinstance(page, dict) or set(page) != {"plain", "digits"}:
            raise Unreadable("a page is not {plain, digits}")
        out.append(PageWords(_words(page["plain"]), _words(page["digits"])))
    return out


def lookup(directory: Path, key: Key) -> Hit | Miss:
    """The stored words of `key`'s PDF when the entry's key equals `key` in
    every part; otherwise why not."""
    path = entry_path(directory, key.pdf_sha256)
    if not path.is_file():
        return Miss("absent")
    try:
        data = json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))
        if not isinstance(data, dict) or set(data) != {"key", "top", "pages"} or not isinstance(data["key"], dict):
            raise Unreadable("the entry is not {key, top, pages}")
        stored_key = data["key"]
        want = key.as_json()
        differing = tuple(part for part in KEY_PARTS if stored_key.get(part) != want[part])
        if set(stored_key) != set(KEY_PARTS):
            differing = differing or ("parts",)
        if differing:
            return Miss("key", parts=differing)
        return Hit(_words(data["top"]), _pages(data["pages"]))
    except (OSError, EOFError, zlib.error, gzip.BadGzipFile, UnicodeDecodeError, ValueError) as error:
        # json.JSONDecodeError and Unreadable are ValueErrors.
        return Miss("unreadable", reason=f"{error.__class__.__name__}: {error}")


def store(directory: Path, key: Key, top: list[Word], pages: list[PageWords]) -> None:
    """Writes the entry of `key` atomically: a temporary file in the same
    directory, then a rename over any older entry. Raises OSError when it
    cannot be written."""
    body = {
        "key": key.as_json(),
        "top": _words_json(top),
        "pages": [{"plain": _words_json(p.plain), "digits": _words_json(p.digits)} for p in pages],
    }
    data = gzip.compress(json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), mtime=0)
    directory.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{key.pdf_sha256}.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.replace(tmp, entry_path(directory, key.pdf_sha256))
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


@dataclass
class CacheCounts:
    """Hits and misses of one run, for run.step1.counts."""

    hit: int = 0
    miss_absent: int = 0
    miss_key: int = 0
    # Per key part, the misses in which it differed.
    miss_key_parts: Counter[str] = field(default_factory=Counter)
    miss_unreadable: int = 0
    # Entries that could not be written (the read itself went on).
    write_failed: int = 0

    def record(self) -> dict[str, object]:
        return {
            "ocr_cache": "on",
            "ocr_cache_hit": self.hit,
            "ocr_cache_miss_absent": self.miss_absent,
            "ocr_cache_miss_key": self.miss_key,
            "ocr_cache_miss_key_parts": {part: self.miss_key_parts[part] for part in sorted(self.miss_key_parts)},
            "ocr_cache_miss_unreadable": self.miss_unreadable,
            "ocr_cache_write_failed": self.write_failed,
        }


OFF: dict[str, object] = {"ocr_cache": "off"}


def record_of(cache: Cache | None) -> dict[str, object]:
    """The cache's counts for run.step1, or `ocr_cache: off` when the run
    has none."""
    return dict(OFF) if cache is None else cache.counts.record()


@dataclass
class Cache:
    """The cache one run uses: where it lives, the run's settings and the
    counts. `notify` hears each unreadable entry and failed write."""

    directory: Path
    settings: Settings
    counts: CacheCounts = field(default_factory=CacheCounts)
    notify: Callable[[str], None] = lambda _message: None

    def recognise(self, pdf: bytes, recognise: Callable[[bytes], Recognised]) -> Recognised:
        """The words of `pdf`: the stored ones on an exact key match, and
        otherwise `recognise(pdf)`'s, which are then stored. Every outcome is
        counted."""
        key = Key.of(pdf, self.settings)
        found = lookup(self.directory, key)
        if isinstance(found, Hit):
            self.counts.hit += 1
            return found.top, found.pages
        if found.kind == "absent":
            self.counts.miss_absent += 1
        elif found.kind == "key":
            self.counts.miss_key += 1
            self.counts.miss_key_parts.update(found.parts)
        else:
            self.counts.miss_unreadable += 1
            self.notify(f"OCR cache entry {key.pdf_sha256} unreadable, read by OCR: {found.reason}")
        top, pages = recognise(pdf)
        try:
            store(self.directory, key, top, pages)
        except OSError as error:
            self.counts.write_failed += 1
            self.notify(f"OCR cache entry {key.pdf_sha256} not written: {error.__class__.__name__}: {error}")
        return top, pages


CACHE_ENV = "PEERLESS_OCR_CACHE"


def from_env(env: Mapping[str, str], notify: Callable[[str], None]) -> Cache | None:
    """The cache in PEERLESS_OCR_CACHE, or None when it is unset (the run
    then reads every document by OCR and records `ocr_cache: off`). Raises
    KeyUnavailable when it is set but the key cannot be read."""
    directory = env.get(CACHE_ENV)
    if directory is None or directory == "":
        return None
    return Cache(Path(directory), current_settings(), notify=notify)
