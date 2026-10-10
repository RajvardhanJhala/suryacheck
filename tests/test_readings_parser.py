from datetime import date

from shared.readings_parser import parse_lines

TODAY = date(2026, 10, 10)


def rows(lines, max_kwh=22.5):
    return {r["date"]: r["kwh"] for r in parse_lines(lines, TODAY, max_kwh)[0]}


def test_iso_list():
    assert rows(["Daily Generation Oct 2026", "2026-10-01 14.2 kWh", "2026-10-02 13.9 kWh"]) == \
        {"2026-10-01": 14.2, "2026-10-02": 13.9}


def test_indian_and_named_dates():
    assert rows(["05/10/2026   12.8", "6 Oct  12.1 kWh", "Oct 7, 2026 11.9kWh", "08-10-26 11.5"]) == \
        {"2026-10-05": 12.8, "2026-10-06": 12.1, "2026-10-07": 11.9, "2026-10-08": 11.5}


def test_value_on_next_line_and_wh():
    assert rows(["09/10", "11400 Wh"]) == {"2026-10-09": 11.4}


def test_today_and_total_on_inverter_display():
    out = rows(["Power 1.84 kW", "E-Today 12.4 kWh", "E-Total 4512.6 kWh"])
    assert out == {"2026-10-10": 12.4}                                   # total is not a day's energy


def test_impossible_values_are_warned_not_saved():
    r, warnings = parse_lines(["2026-10-01 145.0 kWh"], TODAY, 22.5)
    assert r == [] and "not possible" in warnings[0]


def test_december_seen_in_january():
    r, _ = parse_lines(["28 Dec 9.1"], date(2027, 1, 3), 22.5)
    assert r == [{"date": "2026-12-28", "kwh": 9.1}]


def test_heading_is_not_today():
    assert rows(["Daily Generation", "01/10/2026     13.0 kWh", "02/10/2026  12.9 kWh"]) ==         {"2026-10-01": 13.0, "2026-10-02": 12.9}


def test_today_value_on_next_line():
    assert rows(["E-Today", "12.4 kWh"]) == {"2026-10-10": 12.4}
