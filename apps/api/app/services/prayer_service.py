"""Prayer times calculation for Muslim users.

Uses the simplified method based on latitude/longitude.
"""

import math
from datetime import date, datetime, timezone, timedelta


def _rad(deg: float) -> float:
    return deg * math.pi / 180


def _deg(rad: float) -> float:
    return rad * 180 / math.pi


def _julian_date(d: date) -> float:
    y = d.year
    m = d.month
    d_ = d.day
    if m <= 2:
        y -= 1
        m += 12
    A = int(y / 100)
    B = 2 - A + int(A / 4)
    return int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + d_ + B - 1524.5


def _sun_declination(jd: float) -> float:
    D = jd - 2451545.0
    g = (357.529 + 0.98560028 * D) % 360
    q = (280.459 + 0.98564736 * D) % 360
    L = (q + 1.915 * math.sin(_rad(g)) + 0.020 * math.sin(_rad(2 * g))) % 360
    e = 23.439 - 0.00000036 * D
    return _deg(math.asin(math.sin(_rad(e)) * math.sin(_rad(L))))


def _equation_of_time(jd: float) -> float:
    D = jd - 2451545.0
    g = (357.529 + 0.98560028 * D) % 360
    q = (280.459 + 0.98564736 * D) % 360
    L = (q + 1.915 * math.sin(_rad(g)) + 0.020 * math.sin(_rad(2 * g))) % 360
    e = 23.439 - 0.00000036 * D
    RA = _deg(math.atan2(math.cos(_rad(e)) * math.sin(_rad(L)), math.cos(_rad(L)))) / 15
    RA = (RA + 360) % 360 / 15
    eqt = q / 15 - RA
    return eqt


def _hour_angle(lat: float, decl: float, angle: float, is_rising: bool) -> float:
    cos_ha = (math.cos(_rad(angle)) - math.sin(_rad(lat)) * math.sin(_rad(decl))) / (
        math.cos(_rad(lat)) * math.cos(_rad(decl))
    )
    cos_ha = max(-1, min(1, cos_ha))
    ha = _deg(math.acos(cos_ha))
    return ha if is_rising else -ha


def calculate_prayer_times(
    d: date,
    lat: float = 9.0192,
    lng: float = 38.7525,
    timezone_offset: int = 3,
    method: str = "umm_al_qura",
) -> dict:
    """Calculate prayer times for a given date and location.
    
    Default location: Addis Ababa, Ethiopia (9.0192°N, 38.7525°E)
    Default timezone: EAT (UTC+3)
    """
    jd = _julian_date(d)
    decl = _sun_declination(jd)
    eqt = _equation_of_time(jd)
    noon = 12 - eqt - lng / 15

    if method == "umm_al_qura":
        fajr_angle = 18.5
        isha_angle = 17
    elif method == "mwl":
        fajr_angle = 18
        isha_angle = 17
    else:
        fajr_angle = 15
        isha_angle = 15

    fajr_ha = _hour_angle(lat, decl, fajr_angle, True)
    sunrise_ha = _hour_angle(lat, decl, 0.833, True)
    maghrib_ha = _hour_angle(lat, decl, 0.833, False)
    isha_ha = _hour_angle(lat, decl, isha_angle, False)

    def _to_local(utc_hours: float) -> str:
        local = utc_hours + timezone_offset
        local = local % 24
        h = int(local)
        m = int((local - h) * 60)
        return f"{h:02d}:{m:02d}"

    fajr_utc = noon - fajr_ha / 15
    sunrise_utc = noon - sunrise_ha / 15
    dhuhr_utc = noon + 0.5 / 15
    asr_ha = _deg(math.atan(1 / (1 + abs(math.tan(_rad(lat - decl))))))
    asr_utc = noon + asr_ha / 15
    maghrib_utc = noon + maghrib_ha / 15
    isha_utc = noon + isha_ha / 15

    return {
        "date": d.isoformat(),
        "fajr": _to_local(fajr_utc),
        "sunrise": _to_local(sunrise_utc),
        "dhuhr": _to_local(dhuhr_utc),
        "asr": _to_local(asr_utc),
        "maghrib": _to_local(maghrib_utc),
        "isha": _to_local(isha_utc),
        "location": {"lat": lat, "lng": lng, "timezone_offset": timezone_offset},
        "method": method,
    }
