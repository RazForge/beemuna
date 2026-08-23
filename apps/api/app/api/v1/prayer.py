"""Prayer times API endpoint."""

from datetime import date

from fastapi import APIRouter, Query

from app.services.prayer_service import calculate_prayer_times

router = APIRouter(prefix="/prayer", tags=["prayer"])


@router.get("/times")
def get_prayer_times(
    d: str | None = Query(default=None, description="Date in YYYY-MM-DD format"),
    lat: float = Query(default=9.0192, description="Latitude"),
    lng: float = Query(default=38.7525, description="Longitude"),
    tz: int = Query(default=3, description="Timezone offset from UTC"),
    method: str = Query(default="umm_al_qura", description="Calculation method"),
) -> dict:
    """Get prayer times for a given date and location.
    
    Default: Addis Ababa, Ethiopia (UTC+3)
    Methods: umm_al_qura, mwl, isna
    """
    if d:
        try:
            target_date = date.fromisoformat(d)
        except ValueError:
            target_date = date.today()
    else:
        target_date = date.today()

    return calculate_prayer_times(target_date, lat, lng, tz, method)
