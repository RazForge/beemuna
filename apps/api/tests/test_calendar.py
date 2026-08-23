import pytest
from datetime import date

from app.services.calendar_service import (
    CalendarService,
    EthiopianDate,
    to_geez,
    ethiopian_to_jdn,
    jdn_to_ethiopian,
    InvalidEthiopianDate,
)

svc = CalendarService()


@pytest.mark.parametrize(
    "num,expected",
    [
        (0, ""),
        (4, "፬"),
        (10, "፲"),
        (18, "፲፰"),
        (20, "፳"),
        (100, "፻"),
        (2018, "፳፻፲፰"),
        (2019, "፳፻፲፱"),
        (10000, "፼"),
        (20000, "፪፼"),
        (12, "፲፪"),
        (100000, "፲፼"),
    ],
)
def test_geez(num, expected):
    assert to_geez(num) == expected


def test_anchor_1900():
    # 1 Jan 1900 == 23 Tahsas 1892
    eth = svc.to_ethiopian(date(1900, 1, 1))
    assert eth == EthiopianDate(1892, 4, 23)
    assert svc.to_gregorian(eth) == date(1900, 1, 1)


def test_anchor_sept_1900():
    # 11 Sep 1900 == 1 Meskerem 1893
    eth = svc.to_ethiopian(date(1900, 9, 11))
    assert eth == EthiopianDate(1893, 1, 1)
    assert svc.to_gregorian(eth) == date(1900, 9, 11)


def test_leap_year_pagumen():
    # EC 1999 is a leap year: Pagumen has 6 days.
    assert svc.to_ethiopian(date(2007, 9, 6)) == EthiopianDate(1999, 13, 1)
    assert svc.to_ethiopian(date(2007, 9, 11)) == EthiopianDate(1999, 13, 6)
    assert svc.to_ethiopian(date(2007, 9, 12)) == EthiopianDate(2000, 1, 1)
    assert svc.to_gregorian(EthiopianDate(1999, 13, 6)) == date(2007, 9, 11)
    assert svc.to_gregorian(EthiopianDate(2000, 1, 1)) == date(2007, 9, 12)
    assert svc.to_ethiopian(date(2008, 8, 31)) == EthiopianDate(2000, 12, 25)


def test_pagumen_common_year():
    # EC 2001 is common: Pagumen has 5 days.
    assert svc.to_ethiopian(date(2009, 9, 5)) == EthiopianDate(2001, 12, 30)
    assert svc.to_ethiopian(date(2009, 9, 10)) == EthiopianDate(2001, 13, 5)
    assert svc.to_ethiopian(date(2009, 9, 11)) == EthiopianDate(2002, 1, 1)
    assert svc.to_gregorian(EthiopianDate(2002, 1, 1)) == date(2009, 9, 11)


def test_meskerem_2018_example():
    # Prompt example: August 10, 2026 Gregorian == Nehase 4, 2018
    eth = svc.to_ethiopian(date(2026, 8, 10))
    assert eth == EthiopianDate(2018, 12, 4)
    assert svc.to_gregorian(eth) == date(2026, 8, 10)


def test_roundtrip_range():
    from datetime import timedelta

    d = date(1900, 1, 1)
    end = date(2100, 1, 1)
    while d < end:
        eth = svc.to_ethiopian(d)
        assert svc.to_gregorian(eth) == d
        d += timedelta(days=1)


def test_year_boundaries():
    # New year 1999 (non-leap) is Sept 11, 2006; new year of a leap-preceded
    # year (2000) is Sept 12, 2007; new year 2001 (non-leap) is Sept 11, 2008.
    assert svc.to_ethiopian(date(2006, 9, 11)) == EthiopianDate(1999, 1, 1)
    assert svc.to_ethiopian(date(2007, 9, 12)) == EthiopianDate(2000, 1, 1)
    assert svc.to_ethiopian(date(2008, 9, 11)) == EthiopianDate(2001, 1, 1)


def test_invalid_dates():
    with pytest.raises(InvalidEthiopianDate):
        ethiopian_to_jdn(2018, 13, 6)  # 2018 is not leap
    with pytest.raises(InvalidEthiopianDate):
        ethiopian_to_jdn(2018, 12, 31)


def test_formatting():
    eth = EthiopianDate(2018, 12, 4)
    assert svc.format_ethiopian(eth, "en", "western") == "Nehase 4, 2018"
    assert svc.format_ethiopian(eth, "am", "western") == "ነሐሴ 4፣ 2018"
    am = svc.format_ethiopian(eth, "am", "both")
    assert "ነሐሴ" in am and "፬" in am and "፳፻፲፰" in am
    dual = svc.format_dual(date(2026, 8, 10), "en", "both")
    assert "August 10, 2026" in dual
    assert "Nehase" in dual and "፳፻፲፰" in dual
    assert svc.format_gregorian(date(2026, 8, 10), "geez") == "August ፲, ፳፻፳፮"


def test_parse():
    assert svc.parse_gregorian("2026-08-10") == date(2026, 8, 10)
    assert svc.parse_ethiopian("Nehase 4, 2018") == EthiopianDate(2018, 12, 4)
    assert svc.parse_ethiopian("ነሐሴ 4፣ 2018") == EthiopianDate(2018, 12, 4)
