"""Native Ethiopian calendar service.

Implements correct Ethiopian <-> Gregorian conversion via Julian Day Numbers,
Ge'ez numeral conversion, Amharic + English month names, and dual formatting.

Reference points (verified):
- 1 Meskerem 1893 EC == 11 September 1900 Gregorian
- 23 Tahsas 1892 EC   ==  1 January 1900 Gregorian
- Ethiopian leap year rule: EC year % 4 == 0 (no century exception), unlike Gregorian.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import TypeVar

from dateutil import tz

ETHIOPIAN_MONTHS_EN = [
    "Meskerem",
    "Tikimt",
    "Hidar",
    "Tahsas",
    "Tir",
    "Yekatit",
    "Megabit",
    "Miyazya",
    "Ginbot",
    "Sene",
    "Hamle",
    "Nehase",
    "Pagumen",
]

ETHIOPIAN_MONTHS_AM = [
    "መስከረም",
    "ጥቅምት",
    "ኅዳር",
    "ታኅሣሥ",
    "ጥር",
    "የካቲት",
    "መጋቢት",
    "ሚያዝያ",
    "ግንቦት",
    "ሰኔ",
    "ሐምሌ",
    "ነሐሴ",
    "ጳጉሜን",
]

GREGORIAN_MONTHS_EN = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]

GEEZ_ONES = ["", "፩", "፪", "፫", "፬", "፭", "፮", "፯", "፰", "፱"]
GEEZ_TENS = ["", "፲", "፳", "፴", "፵", "፶", "፷", "፸", "፹", "፺"]
GEEZ_HUNDRED = "፻"
GEEZ_TEN_THOUSAND = "፼"

# Ethiopian epoch: 1 Meskerem 1 EC == JDN 1724221 (start of day).
_ETHIOPIAN_EPOCH_JDN = 1724221
_DAYS_PER_YEAR = 365
_MONTHS_REGULAR = 12
_DAYS_PER_MONTH = 30
_PAGUMEN_BASE = 5


@dataclass(frozen=True)
class EthiopianDate:
    year: int
    month: int  # 1..13 (13 = Pagumen)
    day: int


class InvalidEthiopianDate(ValueError):
    pass


class InvalidGregorianDate(ValueError):
    pass


def to_geez(num: int) -> str:
    """Convert a non-negative integer to Ge'ez numerals."""
    if num < 0:
        raise ValueError("Ge'ez numerals only support non-negative integers")
    if num == 0:
        return ""
    if num < 10:
        return GEEZ_ONES[num]
    if num < 100:
        return GEEZ_TENS[num // 10] + GEEZ_ONES[num % 10]
    if num < 10000:
        hundreds = num // 100
        remainder = num % 100
        out = GEEZ_HUNDRED if hundreds == 1 else to_geez(hundreds) + GEEZ_HUNDRED
        return out + to_geez(remainder)
    ten_thousands = num // 10000
    remainder = num % 10000
    out = GEEZ_TEN_THOUSAND if ten_thousands == 1 else to_geez(ten_thousands) + GEEZ_TEN_THOUSAND
    return out + to_geez(remainder)


def is_ethiopian_leap(year: int) -> bool:
    """Ethiopian leap years are those where (year + 1) % 4 == 0.

    Verified anchors:
    - 1 Meskerem 1893 == 11 Sep 1900
    - 1 Meskerem 1900 == 12 Sep 1907 (1899 was leap)
    - 1 Meskerem 2000 == 12 Sep 2007 (1999 was leap, Pagumen 6 == 11 Sep 2007)
    - 1 Meskerem 2001 == 11 Sep 2008
    - Nehase 4 2018      == 10 Aug 2026
    """
    return (year + 1) % 4 == 0


def ethiopian_to_jdn(year: int, month: int, day: int) -> int:
    if not (1 <= month <= 13):
        raise InvalidEthiopianDate(f"month {month} out of range")
    max_day = _DAYS_PER_MONTH if month <= 12 else _PAGUMEN_BASE + (1 if is_ethiopian_leap(year) else 0)
    if not (1 <= day <= max_day):
        raise InvalidEthiopianDate(f"day {day} out of range for year {year} month {month}")
    if year < 1:
        raise InvalidEthiopianDate("year must be >= 1")
    return (
        _ETHIOPIAN_EPOCH_JDN
        + _DAYS_PER_YEAR * (year - 1)
        + (year // 4)
        + _DAYS_PER_MONTH * (month - 1)
        + (day - 1)
    )


def jdn_to_ethiopian(jdn: int) -> EthiopianDate:
    r = jdn - _ETHIOPIAN_EPOCH_JDN
    if r < 0:
        raise InvalidEthiopianDate("date precedes Ethiopian epoch")
    lo, hi = 1, max(2, r // 364 + 2)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if _start_of_year_jdn(mid) <= jdn:
            lo = mid
        else:
            hi = mid - 1
    year = lo
    day_of_year = jdn - _start_of_year_jdn(year)
    if day_of_year >= _MONTHS_REGULAR * _DAYS_PER_MONTH:
        month = 13
        day = day_of_year - _MONTHS_REGULAR * _DAYS_PER_MONTH + 1
    else:
        month = day_of_year // _DAYS_PER_MONTH + 1
        day = day_of_year % _DAYS_PER_MONTH + 1
    return EthiopianDate(year=year, month=month, day=day)


def _start_of_year_jdn(year: int) -> int:
    return (
        _ETHIOPIAN_EPOCH_JDN
        + _DAYS_PER_YEAR * (year - 1)
        + (year // 4)
    )


def gregorian_to_jdn(year: int, month: int, day: int) -> int:
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    return day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045


def jdn_to_gregorian(jdn: int) -> tuple[int, int, int]:
    a = jdn + 32044
    b = (4 * a + 3) // 146097
    c = a - (146097 * b) // 4
    d = (4 * c + 3) // 1461
    e = c - (1461 * d) // 4
    m = (5 * e + 2) // 153
    day = e - (153 * m + 2) // 5 + 1
    month = m + 3 - 12 * (m // 10)
    year = 100 * b + d - 4800 + m // 10
    return year, month, day


class CalendarService:
    """Centralized calendar logic. UI components must use this service only."""

    def to_ethiopian(self, gregorian: date) -> EthiopianDate:
        return jdn_to_ethiopian(gregorian_to_jdn(gregorian.year, gregorian.month, gregorian.day))

    def to_gregorian(self, eth: EthiopianDate) -> date:
        jdn = ethiopian_to_jdn(eth.year, eth.month, eth.day)
        y, m, d = jdn_to_gregorian(jdn)
        return date(y, m, d)

    def to_ethiopian_datetime(self, dt: datetime) -> tuple[EthiopianDate, int, int]:
        local = dt.replace(tzinfo=None)
        eth = self.to_ethiopian(local.date())
        return eth, local.hour, local.minute

    def gregorian_today(self, tz_name: str = "UTC") -> date:
        return datetime.now(tz.gettz(tz_name) or tz.tzutc()).date()

    # ----- formatting -----

    def format_ethiopian(
        self,
        eth: EthiopianDate,
        language: str = "en",
        numeral_mode: str = "western",
    ) -> str:
        month_en = ETHIOPIAN_MONTHS_EN[eth.month - 1]
        month_am = ETHIOPIAN_MONTHS_AM[eth.month - 1]
        year = to_geez(eth.year) if numeral_mode in ("geez", "both") else str(eth.year)
        day = to_geez(eth.day) if numeral_mode in ("geez", "both") else str(eth.day)
        if language == "am":
            return f"{month_am} {day}፣ {year}"
        if language == "both":
            western_year = str(eth.year)
            western_day = str(eth.day)
            return (
                f"{month_en} {western_day}, {western_year}\n"
                f"{month_am} {to_geez(eth.day)}፣ {to_geez(eth.year)}"
            )
        return f"{month_en} {day}, {year}"

    def format_gregorian(self, g: date, numeral_mode: str = "western") -> str:
        use_geez = numeral_mode == "geez"
        day = to_geez(g.day) if use_geez else str(g.day)
        year = to_geez(g.year) if use_geez else str(g.year)
        return f"{GREGORIAN_MONTHS_EN[g.month - 1]} {day}, {year}"

    def format_dual(self, g: date, language: str = "en", numeral_mode: str = "western") -> str:
        eth = self.to_ethiopian(g)
        greg = self.format_gregorian(g, numeral_mode)
        et = self.format_ethiopian(eth, language, numeral_mode)
        if language == "both":
            return f"{greg}\n{et}"
        return f"{greg}\n{et}"

    # ----- parsing -----

    def parse_gregorian(self, value: str) -> date:
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%B %d, %Y", "%b %d, %Y", "%d %B %Y"):
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
        raise InvalidGregorianDate(f"unparseable Gregorian date: {value!r}")

    def parse_ethiopian(self, value: str) -> EthiopianDate:
        import re

        cleaned = re.sub(r"[፣,።]", " ", value)
        parts = [p for p in cleaned.strip().replace(",", " ").split() if p]
        if len(parts) < 3:
            raise InvalidEthiopianDate(f"expected 'Month day, year': {value!r}")
        month_name = " ".join(parts[:-2]).title()
        try:
            day = int(parts[-2])
            year = int(parts[-1])
        except ValueError:
            raise InvalidEthiopianDate(f"day/year must be numeric: {value!r}")
        month = self._month_index(month_name)
        eth = EthiopianDate(year=year, month=month, day=day)
        ethiopian_to_jdn(year, month, day)  # validate
        return eth

    def _month_index(self, name: str) -> int:
        for idx, m in enumerate(ETHIOPIAN_MONTHS_EN, start=1):
            if m.lower() == name.lower():
                return idx
        for idx, m in enumerate(ETHIOPIAN_MONTHS_AM, start=1):
            if m == name:
                return idx
        raise InvalidEthiopianDate(f"unknown month: {name!r}")

    def ethiopian_to_datetime(
        self, eth: EthiopianDate, hour: int = 0, minute: int = 0, tz_name: str = "UTC"
    ) -> datetime:
        g = self.to_gregorian(eth)
        dt = datetime(g.year, g.month, g.day, hour, minute, tzinfo=tz.gettz(tz_name) or tz.tzutc())
        return dt.astimezone(timezone.utc)

    def ethiopian_date_to_gregorian(self, eth: EthiopianDate, tz_name: str = "UTC") -> date:
        g = self.to_gregorian(eth)
        return g
