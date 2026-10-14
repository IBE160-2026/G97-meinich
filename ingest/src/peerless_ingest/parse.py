"""Pure functions from register responses to the rows step 1 writes.

No network, no database, no clock: the read time is passed in. Amounts are
parsed with `Decimal` (never `float`), must be whole numbers, and are stored
as øre: the whole currency unit times 100. Nothing here derives a figure the
register did not state (AD-1, AD-15): an empty element stays NULL.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

ORGNR = re.compile(r"^\d{9}$")
NUMBER_CHARS = frozenset("0123456789.eE+-")

# The fixed reporting-unit label of every key-figures API filing. The API
# returns whole currency units and has no unit field, so step 1 never infers
# a unit (AD-14).
REPORTING_UNIT = "api_whole_units"
# A key-figures API filing has no document figures yet (AD-15).
STATUS_NOT_EXTRACTED = "not_extracted"

# One row per key figure: the JSON path in the key-figures response, and the
# register.key_figures column, named after the register field in snake_case
# with the suffix _ore. The field names are the register's own, including
# its misspelling `sumInnskuttEgenkaptial`; do not correct it.
KEY_FIGURES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("resultatregnskapResultat", "driftsresultat", "driftsresultat"), "driftsresultat_ore"),
    (
        ("resultatregnskapResultat", "driftsresultat", "driftsinntekter", "sumDriftsinntekter"),
        "sum_driftsinntekter_ore",
    ),
    (
        ("resultatregnskapResultat", "driftsresultat", "driftskostnad", "sumDriftskostnad"),
        "sum_driftskostnad_ore",
    ),
    (("resultatregnskapResultat", "finansresultat", "nettoFinans"), "netto_finans_ore"),
    (
        ("resultatregnskapResultat", "finansresultat", "finansinntekt", "sumFinansinntekter"),
        "sum_finansinntekter_ore",
    ),
    (
        ("resultatregnskapResultat", "finansresultat", "finanskostnad", "sumFinanskostnad"),
        "sum_finanskostnad_ore",
    ),
    (
        ("resultatregnskapResultat", "ordinaertResultatFoerSkattekostnad"),
        "ordinaert_resultat_foer_skattekostnad_ore",
    ),
    (("resultatregnskapResultat", "aarsresultat"), "aarsresultat_ore"),
    (("resultatregnskapResultat", "totalresultat"), "totalresultat_ore"),
    (("eiendeler", "sumEiendeler"), "sum_eiendeler_ore"),
    (("eiendeler", "omloepsmidler", "sumOmloepsmidler"), "sum_omloepsmidler_ore"),
    (("eiendeler", "anleggsmidler", "sumAnleggsmidler"), "sum_anleggsmidler_ore"),
    (("egenkapitalGjeld", "sumEgenkapitalGjeld"), "sum_egenkapital_gjeld_ore"),
    (("egenkapitalGjeld", "egenkapital", "sumEgenkapital"), "sum_egenkapital_ore"),
    (
        ("egenkapitalGjeld", "egenkapital", "opptjentEgenkapital", "sumOpptjentEgenkapital"),
        "sum_opptjent_egenkapital_ore",
    ),
    (
        ("egenkapitalGjeld", "egenkapital", "innskuttEgenkapital", "sumInnskuttEgenkaptial"),
        "sum_innskutt_egenkaptial_ore",
    ),
    (("egenkapitalGjeld", "gjeldOversikt", "sumGjeld"), "sum_gjeld_ore"),
    (
        ("egenkapitalGjeld", "gjeldOversikt", "kortsiktigGjeld", "sumKortsiktigGjeld"),
        "sum_kortsiktig_gjeld_ore",
    ),
    (
        ("egenkapitalGjeld", "gjeldOversikt", "langsiktigGjeld", "sumLangsiktigGjeld"),
        "sum_langsiktig_gjeld_ore",
    ),
)

KEY_FIGURE_COLUMNS: tuple[str, ...] = tuple(column for _, column in KEY_FIGURES)


class RejectedFiling(Exception):
    """A filing step 1 does not write. `field` names what was wrong."""

    def __init__(self, orgnr: str, field: str, reason: str) -> None:
        super().__init__(f"{orgnr}: {field}: {reason}")
        self.orgnr = orgnr
        self.field = field
        self.reason = reason


@dataclass(frozen=True)
class Company:
    orgnr: str
    navn: str | None
    organisasjonsform: str | None
    naeringskode1: str | None
    naeringskode2: str | None
    naeringskode3: str | None
    konkurs: bool | None
    under_avvikling: bool | None
    under_tvangsavvikling: bool | None
    read_at: datetime
    # What search shows (Story 1.5a), as the register delivers them. NULL
    # when the unit has no forretningsadresse or the field is absent; never
    # an empty string and never taken from postadresse.
    forretningsadresse_kommunenummer: str | None
    forretningsadresse_kommune: str | None
    naeringskode1_beskrivelse: str | None
    # When the three fields above were read. A normal run reads them with the
    # rest of the unit, so parse_company sets it to read_at.
    search_fields_read_at: datetime


@dataclass(frozen=True)
class Filing:
    brreg_id: int
    orgnr: str
    journalnr: str | None
    regnskapstype: str
    filing_year: int
    periode_fra: date
    periode_til: date
    valuta: str | None
    regnskapsregler: str | None
    smaa_foretak: bool | None
    avviklingsregnskap: bool | None
    oppstillingsplan: str | None
    read_at: datetime
    # Column name -> øre, or None for an empty element. Every column in
    # KEY_FIGURE_COLUMNS is present.
    key_figures: dict[str, int | None]
    reporting_unit: str = REPORTING_UNIT
    status: str = STATUS_NOT_EXTRACTED


# --- Enhetsregisteret ----------------------------------------------------------


def _nested_text(unit: dict, key: str, field: str) -> str | None:
    """`unit[key][field]` when it is a string, else None. An absent object,
    an absent field or a non-string value is None."""
    value = unit.get(key)
    if isinstance(value, dict):
        text = value.get(field)
        return text if isinstance(text, str) else None
    return None


def _code(unit: dict, key: str) -> str | None:
    return _nested_text(unit, key, "kode")


def _search_field(unit: dict, key: str, field: str) -> str | None:
    """A field search shows, as delivered. An empty string carries no value
    and is stored as NULL, like an absent field."""
    text = _nested_text(unit, key, field)
    return text if text else None


def _bool(value: object) -> bool | None:
    return value if isinstance(value, bool) else None


def primary_code(unit: dict) -> str | None:
    """The unit's primary industry, `naeringskode1.kode`. The register's
    search filter also matches naeringskode2 and naeringskode3; step 1
    selects on the primary code only."""
    return _code(unit, "naeringskode1")


def select_covered(units: Iterable[dict], codes: Iterable[str]) -> Iterator[tuple[str, dict]]:
    """(code, unit) for every unit whose primary code is one of `codes`."""
    wanted = frozenset(codes)
    for unit in units:
        code = primary_code(unit)
        if code is not None and code in wanted:
            yield code, unit


def parse_company(unit: dict, read_at: datetime) -> Company:
    orgnr = unit.get("organisasjonsnummer")
    if not isinstance(orgnr, str) or not ORGNR.match(orgnr):
        raise ValueError(f"unit has no valid organisasjonsnummer: {orgnr!r}")
    navn = unit.get("navn")
    return Company(
        orgnr=orgnr,
        navn=navn if isinstance(navn, str) else None,
        organisasjonsform=_code(unit, "organisasjonsform"),
        naeringskode1=_code(unit, "naeringskode1"),
        naeringskode2=_code(unit, "naeringskode2"),
        naeringskode3=_code(unit, "naeringskode3"),
        konkurs=_bool(unit.get("konkurs")),
        under_avvikling=_bool(unit.get("underAvvikling")),
        under_tvangsavvikling=_bool(unit.get("underTvangsavviklingEllerTvangsopplosning")),
        read_at=read_at,
        forretningsadresse_kommunenummer=_search_field(unit, "forretningsadresse", "kommunenummer"),
        forretningsadresse_kommune=_search_field(unit, "forretningsadresse", "kommune"),
        naeringskode1_beskrivelse=_search_field(unit, "naeringskode1", "beskrivelse"),
        search_fields_read_at=read_at,
    )


def iter_json_array(chunks: Iterable[str]) -> Iterator[object]:
    """Yields the elements of one JSON array that arrives as text chunks,
    without holding the whole array in memory (the bulk download is about
    210 MB gzipped). Raises ValueError on anything but a single array."""
    decoder = json.JSONDecoder()
    buffer = ""
    position = 0
    state = "start"  # start -> first -> (element <-> separator) -> done
    exhausted = False
    iterator = iter(chunks)

    def refill() -> bool:
        nonlocal buffer, position, exhausted
        try:
            chunk = next(iterator)
        except StopIteration:
            exhausted = True
            return False
        buffer = buffer[position:] + chunk
        position = 0
        return True

    while True:
        while position < len(buffer) and buffer[position] in " \t\r\n":
            position += 1
        if position >= len(buffer):
            if refill():
                continue
            if state == "done":
                return
            raise ValueError("JSON array ended early")
        char = buffer[position]
        if state == "done":
            raise ValueError("unexpected data after the JSON array")
        if state == "start":
            if char != "[":
                raise ValueError("expected a JSON array")
            position += 1
            state = "first"
            continue
        if char == "]" and state in ("first", "separator"):
            position += 1
            state = "done"
            continue
        if state == "separator":
            if char != ",":
                raise ValueError(f"expected ',' or ']' at {char!r}")
            position += 1
            state = "element"
            continue
        # state is "first" or "element": decode one value. A value cut off
        # at the end of the buffer fails to decode; read more and retry.
        try:
            value, end = decoder.raw_decode(buffer, position)
        except json.JSONDecodeError:
            if not exhausted and refill():
                continue
            raise
        if isinstance(value, (int, float)) and not isinstance(value, bool) and not exhausted:
            # A number is the one value that does not delimit itself: one
            # cut at a chunk boundary ("-6" of "-6.5e3") decodes. Read on
            # until a character that cannot continue it is in the buffer.
            if (end >= len(buffer) or buffer[end] in NUMBER_CHARS) and refill():
                continue
        position = end
        state = "separator"
        yield value


# --- Regnskapsregisteret -------------------------------------------------------


def load_filings_json(body: bytes | str) -> list[dict]:
    """The key-figures response as a list of filings. Decimals are parsed as
    `Decimal`, never `float`."""
    data = json.loads(body, parse_float=Decimal)
    if isinstance(data, dict):
        # Defensive: a single filing rather than an array.
        data = [data]
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        raise ValueError("expected a JSON array of filings")
    return data


def _lookup(filing: dict, path: tuple[str, ...]) -> object:
    node: object = filing
    for key in path:
        if not isinstance(node, dict):
            return None
        node = node.get(key)
    return node


def amount_to_ore(value: object, orgnr: str, field: str) -> int | None:
    """Whole currency units to øre. `None` (an empty element, a null or a
    missing key) stays `None`: it is not zero. A non-whole amount, or
    anything that is not a number, rejects the filing."""
    if value is None:
        return None
    if isinstance(value, bool):
        raise RejectedFiling(orgnr, field, f"not a number: {value!r}")
    if isinstance(value, int):
        return value * 100
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise RejectedFiling(orgnr, field, f"not a finite number: {value}")
        if value != value.to_integral_value():
            raise RejectedFiling(orgnr, field, f"not a whole amount: {value}")
        return int(value) * 100
    # A float would mean the caller parsed without parse_float=Decimal.
    raise RejectedFiling(orgnr, field, f"not a number: {value!r}")


def _date(value: object, orgnr: str, field: str) -> date:
    if not isinstance(value, str):
        raise RejectedFiling(orgnr, field, "missing")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise RejectedFiling(orgnr, field, f"not a date: {value!r}") from None


def _text(value: object) -> str | None:
    return value if isinstance(value, str) else None


def parse_filing(filing: dict, orgnr: str, read_at: datetime) -> Filing:
    """One key-figures filing for `orgnr`. The filing year is taken from the
    returned `regnskapsperiode`, never from a requested year: the register
    ignores the year parameter."""
    brreg_id = filing.get("id")
    if not isinstance(brreg_id, int) or isinstance(brreg_id, bool):
        raise RejectedFiling(orgnr, "id", f"not an integer: {brreg_id!r}")

    returned_orgnr = _lookup(filing, ("virksomhet", "organisasjonsnummer"))
    if returned_orgnr is not None and returned_orgnr != orgnr:
        raise RejectedFiling(orgnr, "virksomhet.organisasjonsnummer", f"is {returned_orgnr!r}")

    regnskapstype = filing.get("regnskapstype")
    if not isinstance(regnskapstype, str) or not regnskapstype:
        raise RejectedFiling(orgnr, "regnskapstype", "missing")

    periode_fra = _date(_lookup(filing, ("regnskapsperiode", "fraDato")), orgnr, "regnskapsperiode.fraDato")
    periode_til = _date(_lookup(filing, ("regnskapsperiode", "tilDato")), orgnr, "regnskapsperiode.tilDato")

    journalnr = filing.get("journalnr")
    # The API spells this object `regnkapsprinsipper`. Do not correct it.
    principles = filing.get("regnkapsprinsipper")
    principles = principles if isinstance(principles, dict) else {}

    key_figures = {
        column: amount_to_ore(_lookup(filing, path), orgnr, ".".join(path))
        for path, column in KEY_FIGURES
    }

    return Filing(
        brreg_id=brreg_id,
        orgnr=orgnr,
        journalnr=str(journalnr) if isinstance(journalnr, (str, int)) and not isinstance(journalnr, bool) else None,
        regnskapstype=regnskapstype,
        filing_year=periode_til.year,
        periode_fra=periode_fra,
        periode_til=periode_til,
        valuta=_text(filing.get("valuta")),
        regnskapsregler=_text(principles.get("regnskapsregler")),
        smaa_foretak=_bool(principles.get("smaaForetak")),
        avviklingsregnskap=_bool(filing.get("avviklingsregnskap")),
        oppstillingsplan=_text(filing.get("oppstillingsplan")),
        read_at=read_at,
        key_figures=key_figures,
    )
