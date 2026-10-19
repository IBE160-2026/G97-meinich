"""Layout tests: page 1's classification, digit groups, label matching.

Hand-built TSVs (`tsv_builder`) in the geometry of the recorded 979607008/2025
output. Each test names the spike error or OCR failure it pins down. No
Tesseract, no database, no network.
"""

from __future__ import annotations

import pytest

from peerless_ingest import layout
from tsv_builder import CURRENT_RIGHT, PITCH, GENERATED_TOP, figure_words, label_words, page_lines, words


def extract_one_page(rows: list[tuple[str, str, str]], **page: object) -> dict[str, tuple[int | None, int | None]]:
    plain = words(page_lines(rows, **page))  # type: ignore[arg-type]
    return layout.extract([layout.parse_page(plain, plain, "plain")])


def figure(text: str, mode: layout.Pass = "plain") -> int | None:
    """A printed figure in this year's column, through the TSV reader."""
    tokens = words([figure_words(text, CURRENT_RIGHT)])
    return layout.parse_number(tokens, PITCH, mode)


# --- Page 1 ----------------------------------------------------------------------


def test_generated_first_page() -> None:
    assert layout.classify(words(GENERATED_TOP)) == "generated"


def test_paper_cover_with_regnskapsaaret() -> None:
    # Spike error 1: the paper cover form says "regnskapsåret" too.
    top = words(
        [
            label_words("VEDLEGG TIL ÅRSREGNSKAPET"),
            label_words("Har det vært endringer dette regnskapsåret?"),
            label_words("ÅRSREGNSKAP FOR REGNSKAPSÅRET 2012"),
        ]
    )
    assert layout.classify(top) == "paper"


def test_unknown_first_page() -> None:
    top = words([label_words("ÅRSREGNSKAP FOR REGNSKAPSÅRET 2025"), label_words("Noter til regnskapet")])
    assert layout.classify(top) == "unknown"


# --- Figures -----------------------------------------------------------------------


def test_generated_digit_groups() -> None:
    assert figure("72 632 310") == 72_632_310
    assert figure("0") == 0
    assert figure("-969 111") == -969_111
    assert figure("- 969 111") == -969_111  # minus read as its own word


@pytest.mark.parametrize(
    "printed",
    ["1 327 42이", "1 327 4o5", "l 001 605", "l0 170 865", "1 O01 605", "7 0O3", "1 327 425²", "١ 327 425"],
)
def test_non_digit_token_is_absent(printed: str) -> None:
    # A look-alike is never repaired into a digit: `이`, `o`/`O` for 0, `l`
    # for 1, a superscript or another script's digit. The figure is absent.
    assert figure(printed) is None
    assert figure(printed.replace(" ", ""), "digits") is None


@pytest.mark.parametrize(
    "printed",
    [
        "12 34 567",  # a middle group of two
        "1234 567",  # a leading group of four
        "1 327 4250",  # a trailing group of four
        "1 327  425",  # two spaces between groups
        "1327425",  # one ungrouped token, from the plain pass
    ],
)
def test_only_generated_digit_groups(printed: str) -> None:
    assert figure(printed) is None


def test_one_token_only_from_the_digits_pass() -> None:
    # The digits-only pass drops the thousands spaces; `documents` decides
    # whether such a figure is kept.
    assert figure("1327425", "digits") == 1_327_425
    assert figure("-969111", "digits") == -969_111


# --- Labels ------------------------------------------------------------------------


def test_exact_first_no_sum_confusion() -> None:
    # Spike error 3. With no sum row on the page, neither the fuzzy nor the
    # exact rule lets a neighbour stand in for it. "Egenkapital" and
    # "Kortsiktig gjeld" are within the similarity bound of their sums
    # (0.88, 0.91); only the length rule keeps them out.
    found = extract_one_page(
        [
            ("Annen driftskostnad", "10 170 865", "10 468 045"),
            ("Sum innskutt egenkapital", "342 900", "342 900"),
            ("Egenkapital", "7 421 289", "8 962 298"),
            ("Kortsiktig gjeld", "7 977 693", "9 910 344"),
        ]
    )
    assert "sum_driftskostnad" not in found
    assert "sum_egenkapital" not in found
    assert "sum_kortsiktig_gjeld" not in found
    assert found["annen_driftskostnad"] == (10_170_865, 10_468_045)
    # A fuzzy candidate for a sum row does not win over the exact row.
    found = extract_one_page(
        [
            ("Sun kostnader", "1 000", "1 000"),
            ("Sum driftskostnad", "72 510 307", "70 020 117"),
            ("Sum innskutt egenkapital", "342 900", "342 900"),
            ("Sum egenkapital", "7 764 189", "9 305 198"),
        ]
    )
    assert found["sum_driftskostnad"] == (72_510_307, 70_020_117)
    assert found["sum_egenkapital"] == (7_764_189, 9_305_198)
    assert not layout.similar(layout.fold("Annen driftskostnad"), "sumdriftskostnad")
    assert not layout.similar(layout.fold("Sum innskutt egenkapital"), "sumegenkapital")


def test_s_to_o_fuzzy() -> None:
    # The older generated font: Tesseract reads "s" as "o".
    found = extract_one_page([("Driftoreoultat", "122 003", "-969 111")])
    assert found["driftsresultat"] == (122_003, -969_111)


def test_lookalike_heading_and_diacritics() -> None:
    # A Cyrillic Р (U+0420) at the end of RESULTATREGNSKAP. Without folding,
    # the page is not recognised and none of its rows is read.
    heading = "RESULTATREGNSKAР"
    assert layout.fold(heading) == "resultatregnskap"
    rows = [("Lonnskostnad", "55 582 660", "52 967 147"), ("Arsresultat", "-1 541 009", "-2 611 560")]
    plain = words(page_lines(rows, heading=heading))
    assert layout.page_kind(plain) == "resultat"
    found = layout.extract([layout.parse_page(plain, plain, "plain")])
    assert found["lonnskostnad"] == (55_582_660, 52_967_147)
    assert found["aarsresultat"] == (-1_541_009, -2_611_560)
    # With the diacritics, the same fields.
    found = extract_one_page([("Lønnskostnad", "55 582 660", "52 967 147"), ("Årsresultat", "-1 541 009", "-2 611 560")])
    assert set(found) >= {"lonnskostnad", "aarsresultat"}


def test_fold_maps_lookalikes_only_in_labels() -> None:
    assert layout.fold("SUM ЕIENDELER") == "sumeiendeler"  # Cyrillic Е
    assert layout.fold("Βeløp i:") == "belopi"  # Greek Β
    assert layout.fold("Sum 5O0") == "sumo"  # digits leave a label; never the reverse


def test_wrapped_label_joins_rows() -> None:
    found = extract_one_page(
        [
            ("Avskrivning på varige", "", ""),
            ("driftsmidler og", "", ""),
            ("immaterielle eiendeler", "5 429 357", "5 512 071"),
            ("Nedskrivning av varige", "", ""),
            ("driftsmidler og", "", ""),
            ("immaterielle eiendeler", "0", "328 527"),
        ]
    )
    assert found["avskrivninger"] == (5_429_357, 5_512_071)
    assert found["nedskrivninger"] == (0, 328_527)
    assert "sum_immaterielle_eiendeler" not in found


def test_year_header_gives_columns_and_years() -> None:
    plain = words(page_lines([("Driftsresultat", "122 003", "-969 111")]))
    edges = layout.column_edges(plain)
    assert edges is not None
    assert (edges.current_year, edges.prior_year) == (2025, 2024)
    assert layout.unit_text(plain) == "NOK"


def test_continuation_page_inherits_columns() -> None:
    first = words(page_lines([("Driftsresultat", "122 003", "-969 111")], heading="BALANSE"))
    lines = page_lines([("Sum gjeld", "23 309 355", "26 309 827")], heading="Sum omløpsmidler", years=None, unit_line=None)
    second = words(lines)
    previous = layout.parse_page(first, first, "plain")
    page = layout.parse_page(second, second, "plain", previous)
    assert page.edges == previous.edges
    assert page.kind == "balanse"
    assert layout.extract([previous, page])["sum_gjeld"] == (23_309_355, 26_309_827)
