"""Parse tests: recorded responses in, rows out. No database, no network."""

from __future__ import annotations

import json
import urllib.request
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from conftest import BASE_URL, FixtureTransport, NetworkBlocked, enhet_url, recorded, regnskap_url
from peerless_ingest import fetch, parse

READ_AT = datetime(2026, 10, 11, 9, 0, tzinfo=UTC)

# Hand-checked against the recorded 2025 filing for 979607008 (Statement AS),
# each the whole-krone amount the register states, times 100. The same
# figures are in docs/data-sources-brreg.md (sumGjeld 23 309 355,
# sumKortsiktigGjeld 18 676 023, langsiktigGjeld empty).
CONTRACT_979607008_2025 = {
    "driftsresultat_ore": 12_200_300,
    "sum_driftsinntekter_ore": 7_263_231_000,
    "sum_driftskostnad_ore": 7_251_030_700,
    "netto_finans_ore": -82_651_100,
    "sum_finansinntekter_ore": 700_300,
    "sum_finanskostnad_ore": 83_351_400,
    "ordinaert_resultat_foer_skattekostnad_ore": -70_450_800,
    "aarsresultat_ore": -154_100_900,
    "totalresultat_ore": None,  # not in this response
    "sum_eiendeler_ore": 3_107_354_400,
    "sum_omloepsmidler_ore": 1_145_358_900,
    "sum_anleggsmidler_ore": 1_961_995_500,
    "sum_egenkapital_gjeld_ore": 3_107_354_400,
    "sum_egenkapital_ore": 776_418_900,
    "sum_opptjent_egenkapital_ore": 742_128_900,
    "sum_innskutt_egenkaptial_ore": 34_290_000,
    "sum_gjeld_ore": 2_330_935_500,
    "sum_kortsiktig_gjeld_ore": 1_867_602_300,
    "sum_langsiktig_gjeld_ore": None,  # `langsiktigGjeld: {}`, not zero
}


def only_filing(name: str) -> dict:
    [filing] = parse.load_filings_json(recorded(name))
    return filing


def test_contract_values_979607008_2025() -> None:
    filing = parse.parse_filing(only_filing("regnskap_979607008_2025.json"), "979607008", READ_AT)
    assert filing.key_figures == CONTRACT_979607008_2025
    assert set(filing.key_figures) == set(parse.KEY_FIGURE_COLUMNS)
    assert filing.brreg_id == 6984522
    assert filing.journalnr == "2026591255"
    assert filing.regnskapstype == "SELSKAP"
    assert filing.filing_year == 2025
    assert (filing.periode_fra.isoformat(), filing.periode_til.isoformat()) == ("2025-01-01", "2025-12-31")
    assert filing.valuta == "NOK"
    assert filing.avviklingsregnskap is False
    assert filing.oppstillingsplan == "store"
    assert filing.reporting_unit == "api_whole_units"
    assert filing.status == "not_extracted"
    assert filing.read_at == READ_AT


def test_misspelled_register_fields_are_read_as_spelled() -> None:
    raw = only_filing("regnskap_979607008_2025.json")
    assert "regnkapsprinsipper" in raw and "regnskapsprinsipper" not in raw
    filing = parse.parse_filing(raw, "979607008", READ_AT)
    assert filing.smaa_foretak is True
    assert filing.regnskapsregler == "regnskapslovenAlminneligRegler"
    assert filing.key_figures["sum_innskutt_egenkaptial_ore"] == 34_290_000


def test_year_trap_the_year_comes_from_the_returned_period() -> None:
    # The register ignores `år`: a request for 2023 returns the 2025 filing
    # with status 200. Serve exactly that and check what is stored.
    body = recorded("regnskap_979607008_2025.json")
    transport = FixtureTransport({regnskap_url("979607008"): body, f"{regnskap_url('979607008')}?år=2023": body})
    via_year = parse.load_filings_json(transport.get(f"{regnskap_url('979607008')}?år=2023", fetch.ACCEPT_JSON) or b"")
    [filing] = [parse.parse_filing(raw, "979607008", READ_AT) for raw in via_year]
    assert (filing.filing_year, filing.brreg_id) == (2025, 6984522)
    # And step 1 itself never asks for a year.
    fetch.fetch_filings(transport, BASE_URL, "979607008")
    assert transport.requested[-1] == regnskap_url("979607008")


def test_several_years_each_stored_under_its_own_period() -> None:
    filings = [
        parse.parse_filing(raw, "979607008", READ_AT)
        for raw in parse.load_filings_json(recorded("regnskap_979607008.json"))
    ]
    assert sorted((f.filing_year, f.brreg_id) for f in filings) == [
        (2023, 5032743),
        (2024, 6013555),
        (2025, 6984522),
    ]
    latest = next(f for f in filings if f.filing_year == 2025)
    assert latest.key_figures == CONTRACT_979607008_2025


@pytest.mark.parametrize(
    "langsiktig",
    [{}, {"sumLangsiktigGjeld": None}, None, "absent"],
    ids=["empty-object", "null-value", "null-object", "missing-key"],
)
def test_empty_element_is_null_and_stated_total_is_kept(langsiktig: object) -> None:
    raw = only_filing("regnskap_979607008_2025.json")
    oversikt = raw["egenkapitalGjeld"]["gjeldOversikt"]
    if langsiktig == "absent":
        del oversikt["langsiktigGjeld"]
    else:
        oversikt["langsiktigGjeld"] = langsiktig
    filing = parse.parse_filing(raw, "979607008", READ_AT)
    assert filing.key_figures["sum_langsiktig_gjeld_ore"] is None
    # Stored as filed: not derived from sumGjeld - sumKortsiktigGjeld.
    assert filing.key_figures["sum_gjeld_ore"] == 2_330_935_500
    assert filing.key_figures["sum_kortsiktig_gjeld_ore"] == 1_867_602_300


def test_float_free_amount_with_trailing_zero() -> None:
    [raw] = parse.load_filings_json(recorded("regnskap_979607008_2025.json"))
    value = raw["resultatregnskapResultat"]["driftsresultat"]["driftsinntekter"]["sumDriftsinntekter"]
    assert isinstance(value, Decimal) and str(value) == "72632310.0"
    assert parse.amount_to_ore(value, "979607008", "sumDriftsinntekter") == 7_263_231_000
    assert parse.amount_to_ore(Decimal("7.2632310E+7"), "979607008", "x") == 7_263_231_000
    assert parse.amount_to_ore(-1541009, "979607008", "x") == -154_100_900


def test_a_float_is_never_accepted_as_an_amount() -> None:
    with pytest.raises(parse.RejectedFiling):
        parse.amount_to_ore(72632310.0, "979607008", "sumDriftsinntekter")
    with pytest.raises(parse.RejectedFiling):
        parse.amount_to_ore(True, "979607008", "sumDriftsinntekter")


def test_beyond_float_precision_survives() -> None:
    # 2^53 + 1 is not representable as a float; it must survive exactly.
    big = 2**53 + 1
    [raw] = parse.load_filings_json(f'[{{"x": {big}.0}}]')
    assert parse.amount_to_ore(raw["x"], "979607008", "x") == big * 100


def test_non_whole_amount_rejects_the_filing_naming_orgnr_and_field() -> None:
    text = recorded("regnskap_979607008_2025.json").decode("utf-8").replace("7003.0", "1234.5")
    [raw] = parse.load_filings_json(text)
    with pytest.raises(parse.RejectedFiling) as rejected:
        parse.parse_filing(raw, "979607008", READ_AT)
    assert rejected.value.orgnr == "979607008"
    assert rejected.value.field == "resultatregnskapResultat.finansresultat.finansinntekt.sumFinansinntekter"


def test_reporting_unit_millions_reporter_stored_in_whole_units() -> None:
    # 923609016 reports in USD millions; the API returns whole units, and
    # step 1 stores them times 100 without guessing a unit.
    raws = parse.load_filings_json(recorded("regnskap_923609016.json"))
    filings = [parse.parse_filing(raw, "923609016", READ_AT) for raw in raws]
    assert {f.reporting_unit for f in filings} == {"api_whole_units"}
    assert {f.valuta for f in filings} == {"USD"}
    for raw, filing in zip(raws, filings, strict=True):
        stated = raw["eiendeler"]["sumEiendeler"]
        assert filing.key_figures["sum_eiendeler_ore"] == int(stated) * 100
    selskap_2025 = next(f for f in filings if f.regnskapstype == "SELSKAP" and f.filing_year == 2025)
    assert selskap_2025.key_figures["sum_eiendeler_ore"] % 100 == 0


def test_selskap_and_konsern_for_the_same_period_are_two_filings() -> None:
    filings = [
        parse.parse_filing(raw, "923609016", READ_AT)
        for raw in parse.load_filings_json(recorded("regnskap_923609016.json"))
    ]
    for_2025 = [f for f in filings if f.filing_year == 2025]
    assert sorted(f.regnskapstype for f in for_2025) == ["KONSERN", "SELSKAP"]
    assert len({f.brreg_id for f in for_2025}) == 2
    assert len({(f.periode_fra, f.periode_til) for f in for_2025}) == 1


def test_a_filing_for_another_orgnr_is_rejected() -> None:
    raw = only_filing("regnskap_979607008_2025.json")
    with pytest.raises(parse.RejectedFiling) as rejected:
        parse.parse_filing(raw, "967534579", READ_AT)
    assert rejected.value.field == "virksomhet.organisasjonsnummer"


def test_a_filing_without_a_period_is_rejected() -> None:
    raw = only_filing("regnskap_979607008_2025.json")
    del raw["regnskapsperiode"]
    with pytest.raises(parse.RejectedFiling) as rejected:
        parse.parse_filing(raw, "979607008", READ_AT)
    assert rejected.value.field == "regnskapsperiode.fraDato"


# --- Enhetsregisteret ------------------------------------------------------------


def bulk_units() -> list[dict]:
    units = json.loads(recorded("enheter_lastned.json"))
    assert isinstance(units, list)
    return units


def test_secondary_code_is_not_selected() -> None:
    units = bulk_units()
    keypro = next(u for u in units if u["organisasjonsnummer"] == "990051232")
    assert keypro["naeringskode2"]["kode"] == "62.100"  # the fixture's premise
    selected = [(code, u["organisasjonsnummer"]) for code, u in parse.select_covered(units, ["62.100"])]
    assert selected == [("62.100", "919951834")]


def test_sn2007_code_selects_nothing() -> None:
    assert list(parse.select_covered(bulk_units(), ["62.010"])) == []


def test_parse_company_fields() -> None:
    unit = json.loads(recorded("enhet_967534579.json"))
    company = parse.parse_company(unit, READ_AT)
    assert company.orgnr == "967534579"
    assert company.navn == "KANTALL AS"
    assert company.organisasjonsform == "AS"
    assert company.naeringskode1 == "69.202"
    assert (company.naeringskode2, company.naeringskode3) == (None, None)
    assert (company.konkurs, company.under_avvikling, company.under_tvangsavvikling) == (False, False, False)


def test_bulk_download_streams_through_gzip() -> None:
    transport = FixtureTransport({}, bulk=recorded("enheter_lastned.json"))
    orgnrs = [unit["organisasjonsnummer"] for unit in fetch.iter_bulk_units(transport, BASE_URL)]
    assert orgnrs == ["919951834", "990051232", "979607008", "967534579"]
    assert transport.requested == [f"{BASE_URL}/enhetsregisteret/api/enheter/lastned"]


def test_unit_not_in_register() -> None:
    transport = FixtureTransport({enhet_url("000000000"): None})
    assert fetch.fetch_unit(transport, BASE_URL, "000000000") is None


@pytest.mark.parametrize("size", [1, 2, 7, 64, 1 << 20])
def test_iter_json_array_across_chunk_boundaries(size: int) -> None:
    text = '[ {"a": [1, 2, {"b": "x]y,"}]}, 12345, "s", [], {} , -6.5e3 ]'
    chunks = [text[i : i + size] for i in range(0, len(text), size)]
    assert list(parse.iter_json_array(chunks)) == [{"a": [1, 2, {"b": "x]y,"}]}, 12345, "s", [], {}, -6500.0]


def test_iter_json_array_empty_and_malformed() -> None:
    assert list(parse.iter_json_array(["[", " ", "]"])) == []
    with pytest.raises(ValueError):
        list(parse.iter_json_array(['{"a": 1}']))
    with pytest.raises(ValueError):
        list(parse.iter_json_array(["[1, 2"]))
    with pytest.raises(ValueError):
        list(parse.iter_json_array(["[1 2]"]))
    with pytest.raises(ValueError):
        list(parse.iter_json_array(["[1] [2]"]))


# --- No network -------------------------------------------------------------------


def test_outbound_network_is_blocked() -> None:
    with pytest.raises(NetworkBlocked):
        urllib.request.urlopen("https://data.brreg.no/enhetsregisteret/api/enheter/967534579", timeout=5)
