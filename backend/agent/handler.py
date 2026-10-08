"""Agent Lambda entry point. Phase 1: `mode=expected` proves the physics stack runs in
the cloud; analysis and recheck modes are added in Phases 3 and 4."""
from aws_lambda_powertools import Logger

from physics.weather import fetch_hourly
from physics.yield_model import expected_daily

logger = Logger()


def _expected(event):
    lat, lon, kwp = event.get("lat", 23.09), event.get("lon", 72.58), event.get("capacity_kwp", 3.0)
    daily = expected_daily(fetch_hourly(lat, lon, past_days=event.get("past_days", 14)), lat, lon, kwp,
                           event.get("tilt", 23.0), event.get("azimuth", 180.0))
    return [{"date": d.strftime("%Y-%m-%d"), "kwh_expected": round(r.kwh_expected, 2),
             "rain_mm": round(r.rain_mm, 1), "low_conf": bool(r.low_conf)} for d, r in daily.iterrows()]


@logger.inject_lambda_context
def handler(event, context):
    mode = event.get("mode", "expected")
    if mode == "expected":
        import pvlib
        import strands
        import cedarpy  # noqa: F401  (packaging check)
        return {"pvlib": pvlib.__version__, "strands": getattr(strands, "__version__", "ok"),
                "days": _expected(event)}
    raise ValueError(f"unknown mode {mode}")
