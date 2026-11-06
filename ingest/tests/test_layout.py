"""Layout tests: page 1's classification, digit groups, label matching.

Hand-built TSVs (`tsv_builder`) in the geometry of the recorded 979607008/2025
output. Each test names the spike error or OCR failure it pins down. No
Tesseract, no database, no network.
"""

from __future__ import annotations

import pytest

from conftest import BOUND_KR
from peerless_ingest import documents, layout
from tsv_builder import (
    CURRENT_RIGHT,
    GENERATED_TOP,
    PITCH,
    PRIOR_RIGHT,
    Placed,
    figure_words,
    label_words,
    misread_leading,
    page_lines,
    words,
)


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
    read = documents.read_words(top, [], BOUND_KR)
    assert (read.layout, read.current, read.prior, read.refusal) == ("paper", None, None, None)


def test_unknown_first_page() -> None:
    top = words([label_words("ÅRSREGNSKAP FOR REGNSKAPSÅRET 2025"), label_words("Noter til regnskapet")])
    assert layout.classify(top) == "unknown"
    read = documents.read_words(top, [], BOUND_KR)
    assert (read.layout, read.current, read.prior) == ("unknown", None, None)


# --- Figures -----------------------------------------------------------------------


def test_generated_digit_groups() -> None:
    assert figure("72 632 310") == 72_632_310
    assert figure("0") == 0
    assert figure("-969 111") == -969_111
    assert figure("- 969 111") == -969_111  # minus read as its own word


def test_distant_minus_is_absent() -> None:
    # The minus is part of the gap check: three spaces between it and the
    # first group is no figure, not a negative one and not a positive one.
    assert figure("-   969 111") is None


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


# --- The width rule (Story 2.5c, R1) -------------------------------------------------

# The probe's page pitch (analysis/output/cost-sum-probe.md: 38.8-39.5 px).
PROBE_PITCH = 39.0


def widths_figure(placed: list[Placed], mode: layout.Pass = "plain") -> int | None:
    return layout.parse_number(words([placed]), PROBE_PITCH, mode)


@pytest.mark.parametrize(
    ("printed", "leading", "width"),
    [
        ("2 375 956", "23", 28),  # read as 23 375 956; the probe's "23", 28 px
        ("12 847 287", "123", 58),  # read as 123 847 287; one and a half characters wide
        ("9 094 303", "94", 28),  # read as 94 094 303
    ],
)
def test_digit_read_as_two_refused(printed: str, leading: str, width: int) -> None:
    # Tesseract adds a digit to the leading group and both passes agree. The
    # token is far narrower than its digits at the page's pitch (0.34-0.50
    # of it), so the figure is refused, never repaired to the printed one.
    placed = misread_leading(printed, CURRENT_RIGHT, leading, width)
    assert widths_figure(placed) is None
    # The same digits at their printed width are read: only the width refuses.
    wide = figure_words(leading + printed[len(printed.split()[0]) :], CURRENT_RIGHT)
    assert widths_figure(wide) == int((leading + printed[len(printed.split()[0]) :]).replace(" ", ""))
    # The digits-only pass too: one token as narrow as the misread group.
    one = [(leading, CURRENT_RIGHT - 3 * PITCH, width)]
    assert widths_figure(one, "digits") is None
    assert layout.parse_number(words([[(leading, CURRENT_RIGHT - 3 * PITCH, int(len(leading) * PROBE_PITCH))]]), PROBE_PITCH, "digits") == int(leading)


def test_digit_read_as_two_bound() -> None:
    # The bound is 0.6 x digits x pitch: 46.8 px for two digits at 39 px.
    at = [("23", CURRENT_RIGHT - 2 * PITCH, 47)]
    below = [("23", CURRENT_RIGHT - 2 * PITCH, 46)]
    assert layout.MIN_DIGIT_WIDTH == 0.6
    assert widths_figure(at) == 23
    assert widths_figure(below) is None


def test_ones_not_refused() -> None:
    # A "1" counts as a full digit, and its box is narrow: the probe's lone
    # "1" is 0.76 of the pitch at the least, "11" and "111" one glyph less
    # than their characters. None of them is refused.
    right = CURRENT_RIGHT
    ones: list[Placed] = [
        ("11", right - 10 * PITCH, 68),  # (1 + 0.76) x 39
        ("111", right - 7 * PITCH, 107),  # (2 + 0.76) x 39
        ("111", right - 3 * PITCH, 107),
    ]
    assert widths_figure(ones) == 11_111_111
    lone: list[Placed] = [("1", right - 9 * PITCH, 30), ("111", right - 7 * PITCH, 107), ("111", right - 3 * PITCH, 107)]
    assert widths_figure(lone) == 1_111_111
    assert widths_figure([("11111111", right - 8 * PITCH, 302)], "digits") == 11_111_111  # (7 + 0.76) x 39
    # And through a page, at the tsv_builder widths.
    found = extract_one_page([("Lønnskostnad", "11 111 111", "1 111 111")])
    assert found["lonnskostnad"] == (11_111_111, 1_111_111)


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


def test_notes_page_after_the_balance_sheet_is_not_read() -> None:
    # Once SUM EGENKAPITAL OG GJELD has been read, a following page without
    # its own year header is the company's notes, even if it says "balanse".
    first = words(page_lines([("SUM EGENKAPITAL OG GJELD", "31 073 544", "35 615 025")], heading="BALANSE"))
    notes_lines = page_lines(
        [("Salg av varer", "1 000", "2 000")], heading="Klassifisering av balanseposter", years=None, unit_line=None
    )
    notes = words(notes_lines)
    previous = layout.parse_page(first, first, "plain")
    assert previous.balance_closed
    page = layout.parse_page(notes, notes, "plain", previous)
    assert (page.kind, page.edges, page.rows) == ("other", None, [])
    assert "varer" not in layout.extract([previous, page])



# --- The bold total row (Story 2.3b) -------------------------------------------------


def test_bold_sum_misread_matches_total() -> None:
    # Tesseract reads the bold "SUM" as "50M" (seven of seven documents probed
    # in Story 2.3). `fold` drops the digits and matches nothing; `fold_mixed`
    # reads them as letters inside the mixed word, and the length rule admits
    # "somegenkapitaloggjeld" for "sumegenkapitaloggjeld".
    label = "50M EGENKAPITAL OG GJELD"
    assert layout.fold(label) == "megenkapitaloggjeld"
    assert layout.fold_mixed(label) == "somegenkapitaloggjeld"
    found = extract_one_page([("SUM EIENDELER", "33 855 462", "30 112 004"), (label, "33 855 462", "30 112 004")])
    assert found["sum_egenkapital_gjeld"] == (33_855_462, 30_112_004)
    assert found["sum_eiendeler"] == (33_855_462, 30_112_004)


def test_bold_l_misread_as_one_matches() -> None:
    # A bold "l" read as "1" inside a label word: `fold_mixed` reads it back.
    # Without the mapping, "somegenkapitaoggjed" is three off the target and
    # `fold`'s "megenkapitaoggjed" further still, so only the mapping matches.
    assert layout.fold_mixed("5UM GJE1D") == "sumgjeld"
    label = "50M EGENKAPITA1 OG GJE1D"
    assert layout.fold_mixed(label) == "somegenkapitaloggjeld"
    found = extract_one_page([("SUM EIENDELER", "33 855 462", "30 112 004"), (label, "33 855 462", "30 112 004")])
    assert found["sum_egenkapital_gjeld"] == (33_855_462, 30_112_004)


def test_digit_dropping_fold_still_matches() -> None:
    # The old fuzzy case: `fold` gives "soomegenkapitaloggjeld", within one
    # character. `fold_mixed` gives "ssoom…", two too long, so only `fold`
    # matches it: the new fold is tried besides the old, never instead.
    label = "S5O0M EGENKAPITAL OG GJELD"
    assert layout.similar(layout.fold(label), "sumegenkapitaloggjeld")
    assert not layout.similar(layout.fold_mixed(label), "sumegenkapitaloggjeld")
    assert extract_one_page([(label, "31 073 544", "35 615 025")])["sum_egenkapital_gjeld"] == (31_073_544, 35_615_025)
    assert layout.ends_balance(label)


def test_bold_sum_closes_balance() -> None:
    # The "50M" row ends the balance sheet: a following page with no year
    # header of its own is the company's notes, kind "other" with no rows.
    first = words(page_lines([("50M EGENKAPITAL OG GJELD", "31 073 544", "35 615 025")], heading="BALANSE"))
    notes_lines = page_lines(
        [("Varer", "1 000", "2 000")], heading="Klassifisering av balanseposter", years=None, unit_line=None
    )
    notes = words(notes_lines)
    previous = layout.parse_page(first, first, "plain")
    assert previous.balance_closed
    page = layout.parse_page(notes, notes, "plain", previous)
    assert (page.kind, page.edges, page.rows) == ("other", None, [])
    assert "varer" not in layout.extract([previous, page])


def test_note_number_not_folded_into_label() -> None:
    # A word of digits only (a note number) is still dropped by `fold_mixed`;
    # only a word that also holds a letter has its digits read as letters.
    assert layout.fold_mixed("Sum eiendeler 5") == "sumeiendeler"
    assert extract_one_page([("Sum eiendeler 5", "31 073 544", "35 615 025")])["sum_eiendeler"] == (31_073_544, 35_615_025)
    # Bold and with a two-digit note: if the note's "15" were read as "ls",
    # the label would be two characters too long to match.
    assert layout.fold_mixed("50M EIENDELER 15") == "someiendeler"
    assert extract_one_page([("50M EIENDELER 15", "31 073 544", "35 615 025")])["sum_eiendeler"] == (31_073_544, 35_615_025)


# --- The cost lines and the parts of intangible assets (Story 2.5b) ------------------


def extract_pages(*pages: tuple[str, list[tuple[str, str, str]]]) -> dict[str, tuple[int | None, int | None]]:
    """The extract over several pages, each (heading, rows) with its own year header."""
    parsed: list[layout.Page] = []
    previous: layout.Page | None = None
    for heading, rows in pages:
        plain = words(page_lines(rows, heading=heading))
        previous = layout.parse_page(plain, plain, "plain", previous)
        parsed.append(previous)
    return layout.extract(parsed)


# The intangible assets of 979607008/2025 as printed (hand-checked), with the
# wrapped concessions row.
INTANGIBLE_ROWS = [
    ("Immaterielle eiendeler", "", ""),
    ("Utvikling 3", "6 986 262", "953 319"),
    ("Konsesjoner, patenter,", "", ""),
    ("lisenser, varemerker ol. 3", "36 250", "60 417"),
    ("Utsatt skattefordel 4, 5", "190 261", "100 560"),
    ("Goodwill 3", "9 000 472", "13 500 708"),
    ("Sun immaterielle eiendeler", "16 213 245", "14 615 003"),
]


def test_intangible_parts_read() -> None:
    # F2: each part is a field of its own; the sum is read as before.
    found = extract_pages(("BALANSE", INTANGIBLE_ROWS))
    assert found["forskning_og_utvikling"] == (6_986_262, 953_319)
    assert found["konsesjoner_patenter"] == (36_250, 60_417)
    assert found["utsatt_skattefordel"] == (190_261, 100_560)
    assert found["goodwill"] == (9_000_472, 13_500_708)
    assert found["sum_immaterielle_eiendeler"] == (16_213_245, 14_615_003)
    # The other wordings the probe found: "Forskning og utvikling", the
    # one-line "Konsesjoner, patenter o.l." (its bold "l" read as "l1"),
    # and the three-line form ending "og lignende rettigheter".
    found = extract_pages(
        (
            "BALANSE",
            [
                ("Forskning og utvikling", "333 000", "476 437"),
                ("Konsesjoner, patenter o.l1.", "19 636 331", "21 026 514"),
                ("Sum immaterielle eiendeler", "19 969 331", "21 502 951"),
            ],
        )
    )
    assert found["forskning_og_utvikling"] == (333_000, 476_437)
    assert found["konsesjoner_patenter"] == (19_636_331, 21_026_514)
    wrapped = [
        ("Konsesjoner, patenter,", "", ""),
        ("lisenser, varemerker og", "", ""),
        ("lignende rettigheter 4", "1 000", "2 000"),
    ]
    assert extract_pages(("BALANSE", wrapped))["konsesjoner_patenter"] == (1_000, 2_000)


def test_intangible_part_not_sum() -> None:
    # No part matches the sum row, and the sum matches no part: with only the
    # sum printed, every part is absent, and with only parts, the sum is.
    only_sum = extract_pages(
        ("BALANSE", [("Immaterielle eiendeler", "", ""), ("Sum immaterielle eiendeler", "500", "400")])
    )
    assert only_sum["sum_immaterielle_eiendeler"] == (500, 400)
    assert not set(layout.PARTS) & set(only_sum)
    only_parts = extract_pages(("BALANSE", INTANGIBLE_ROWS[:-1]))
    assert set(layout.PARTS) <= set(only_parts)
    assert "sum_immaterielle_eiendeler" not in only_parts
    # The bold sum with its 0 read as "Ö" (the probe's ten reference
    # cells): the row matches, and the figure is absent, never read as 0.
    found = extract_pages(("BALANSE", [("Goodwill", "0", "0"), ("Sun immaterielle eiendeler", "Ö", "Ö")]))
    assert found["sum_immaterielle_eiendeler"] == (None, None)
    assert found["goodwill"] == (0, 0)


# The wordings of the depreciation row the probe found (17 of 17 reference
# cells unmatched), and "Ordinære avskrivninger" from its 2.1b draw.
@pytest.mark.parametrize(
    "rows",
    [
        [("Avskrivning av", "", ""), ("driftsmidler og", "", ""), ("immaterielle eiendeler 5", "5 429 357", "5 512 071")],
        [("Avskrivning på", "", ""), ("driftsmidler og", "", ""), ("immaterielle eiendeler 4", "5 429 357", "5 512 071")],
        [("Avskrivning på varige", "", ""), ("driftsmidler 3", "5 429 357", "5 512 071")],
        [("Avskrivning av driftsmidler 2", "5 429 357", "5 512 071")],
        [("Avskrivning 3", "5 429 357", "5 512 071")],
        [("Ordinære avskrivninger 4", "5 429 357", "5 512 071")],
    ],
)
def test_depreciation_wordings(rows: list[tuple[str, str, str]]) -> None:
    found = extract_pages(("RESULTATREGNSKAP", [("Lønnskostnad", "55 582 660", "52 967 147"), *rows]))
    assert found["avskrivninger"] == (5_429_357, 5_512_071)
    assert "sum_immaterielle_eiendeler" not in found
    assert not set(layout.PARTS) & set(found)


def test_depreciation_row_never_intangibles() -> None:
    # F1's condition. The wrapped depreciation row ends in "immaterielle
    # eiendeler"; each row is read only as itself, on its own kind of page.
    found = extract_pages(
        (
            "RESULTATREGNSKAP",
            [("Avskrivning av", "", ""), ("driftsmidler og", "", ""), ("immaterielle eiendeler 2", "5 429 357", "5 512 071")],
        ),
        ("BALANSE", INTANGIBLE_ROWS),
    )
    assert found["avskrivninger"] == (5_429_357, 5_512_071)
    assert found["sum_immaterielle_eiendeler"] == (16_213_245, 14_615_003)
    assert found["forskning_og_utvikling"] == (6_986_262, 953_319)
    # A part's label on the income statement is not a part.
    found = extract_pages(
        ("RESULTATREGNSKAP", [("Goodwill", "1 000", "2 000"), ("Utsatt skattefordel", "3 000", "4 000")])
    )
    assert not set(layout.PARTS) & set(found)


def test_balance_row_never_depreciation() -> None:
    # F1's condition, the other way: the later depreciation variants match on
    # an income-statement page only, so the same label on a balance page is
    # not depreciation.
    found = extract_pages(("BALANSE", [("Avskrivning 3", "5 429 357", "5 512 071"), *INTANGIBLE_ROWS]))
    assert "avskrivninger" not in found
    assert found["sum_immaterielle_eiendeler"] == (16_213_245, 14_615_003)


# The inventory-change row of an income statement, as printed (the probe's
# 815244672/2023 wording), and the balance's stock.
INVENTORY_CHANGE_ROWS = [
    ("Endring i beholdning av", "", ""),
    ("varer under tilvirkning", "", ""),
    ("og ferdig tilvirkede varer", "-12 650 783", "3 104 220"),
    ("Varekostnad 2", "16 634 458", "13 004 112"),
]


def test_varer_balance_only() -> None:
    # R4 (Story 2.5c): `varer` is the balance's stock. The income
    # statement's inventory-change row ends in "varer" too and was stored as
    # the stock, negative or positive; it is never read as `varer` now.
    found = extract_pages(("RESULTATREGNSKAP", INVENTORY_CHANGE_ROWS), ("BALANSE", [("Varer", "5 120 400", "4 860 118")]))
    assert found["varer"] == (5_120_400, 4_860_118)
    assert found["varekostnad"] == (16_634_458, 13_004_112)
    # With no stock row on the balance, `varer` is not read at all.
    found = extract_pages(("RESULTATREGNSKAP", INVENTORY_CHANGE_ROWS), ("BALANSE", [("Sum eiendeler", "31 073 544", "35 615 025")]))
    assert "varer" not in found
    assert layout.TARGET_PAGES["varer"] == "balanse"


def test_plural_cost_lines() -> None:
    # "Lønnskostnader", "Andre driftskostnader" (the probe's 2.1b draw).
    found = extract_pages(
        (
            "RESULTATREGNSKAP",
            [("Lønnskostnader 3", "15 309 770", "12 736 165"), ("Andre driftskostnader", "3 625 900", "3 297 237")],
        )
    )
    assert found["lonnskostnad"] == (15_309_770, 12_736_165)
    assert found["annen_driftskostnad"] == (3_625_900, 3_297_237)
    # Not on a balance page.
    found = extract_pages(("BALANSE", [("Andre driftskostnader", "3 625 900", "3 297 237")]))
    assert "annen_driftskostnad" not in found


def test_note_reference_fold() -> None:
    # F1: "Lønnskostnad ll, 2, 3" folds to "lonnskostnadll" under `fold` and
    # `fold_mixed`, two characters past the target; `fold_notes` drops the
    # trailing note references, so it matches.
    label = "Lønnskostnad ll, 2, 3"
    assert layout.fold(label) == "lonnskostnadll"
    assert layout.fold_mixed(label) == "lonnskostnadll"
    assert not layout.similar(layout.fold(label), "lonnskostnad")
    assert layout.fold_notes(label) == "lonnskostnad"
    found = extract_pages(("RESULTATREGNSKAP", [(label, "3 673 524", "3 231 782")]))
    assert found["lonnskostnad"] == (3_673_524, 3_231_782)
    # That label is also within one character of the plural "lonnskostnader"
    # (stage 3). A line with no plural variant needs `fold_notes` alone.
    other = "Varekostnad ll, 3"
    assert not layout.similar(layout.fold(other), "varekostnad")
    found = extract_pages(("RESULTATREGNSKAP", [(other, "1 327 425", "744 327")]))
    assert found["varekostnad"] == (1_327_425, 744_327)
    # Only trailing words of digits, "l" and commas go, and never the first word.
    assert layout.fold_notes("Utsatt skattefordel 6, 7") == "utsattskattefordel"
    assert layout.fold_notes("Sum varige driftsmidler 6") == "sumvarigedriftsmidler"
    assert layout.fold_notes("Konsesjoner, patenter o.l1.") == "konsesjonerpatenterol"
    assert layout.fold_notes("ll") == "ll"


def test_earlier_match_stands() -> None:
    # Story 2.5b's stages fill only a field no earlier stage matched: an old
    # variant's row wins over a later variant's row, wherever it stands.
    found = extract_pages(
        (
            "RESULTATREGNSKAP",
            [
                ("Avskrivning 3", "1 000", "2 000"),
                ("Avskrivning på varige", "", ""),
                ("driftsmidler og", "", ""),
                ("immaterielle eiendeler", "5 429 357", "5 512 071"),
                ("Lønnskostnader", "7 000", "8 000"),
                ("Lønnskostnad l, 2", "55 582 660", "52 967 147"),
            ],
        )
    )
    assert found["avskrivninger"] == (5_429_357, 5_512_071)
    # "lonnskostnadl" is within one character of the target: stage 1's fuzzy
    # match wins over stage 3's plural.
    assert found["lonnskostnad"] == (55_582_660, 52_967_147)


@pytest.mark.parametrize(
    ("label", "field", "other"),
    [
        ("Avskrivning av driftsmidler og immaterielle eiendeler", "avskrivninger", "nedskrivninger"),
        ("Avskrivning på varige driftsmidler og immaterielle eiendeler", "avskrivninger", "nedskrivninger"),
        ("Nedskrivning av varige driftsmidler og immaterielle eiendeler", "nedskrivninger", "avskrivninger"),
    ],
)
def test_a_matched_row_is_no_other_fields_fuzzy_match(label: str, field: str, other: str) -> None:
    # Story 2.5b review: the depreciation and write-down labels on one line
    # are within the similarity bound of each other's variants. With only
    # one of the two rows printed, the other field stays absent rather than
    # copying its figure.
    assert any(layout.similar(layout.fold(label), v) for v in layout.TARGETS[other] + layout.LATER_VARIANTS.get(other, ()))
    # The whole label on one line: started further left than the builder's
    # labels, so it ends before the figure zone (a narrower print).
    lines = [
        *page_lines([]),
        label_words(label, 0) + figure_words("5 429 357", CURRENT_RIGHT) + figure_words("5 512 071", PRIOR_RIGHT),
    ]
    plain = words(lines)
    page = layout.parse_page(plain, plain, "plain")
    assert [r.label for r in page.rows if r.has_number][-1] == label
    found = layout.extract([page])
    assert found[field] == (5_429_357, 5_512_071)
    assert other not in found
