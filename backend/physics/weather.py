"""Hourly weather from Open-Meteo (free, non-commercial, CC BY 4.0 — attribution in README)."""
import json
import urllib.parse
import urllib.request

import pandas as pd

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
TZ = "Asia/Kolkata"
_FIELDS = {
    "shortwave_radiation": "ghi",
    "direct_normal_irradiance": "dni",
    "diffuse_radiation": "dhi",
    "temperature_2m": "temp_air",
    "wind_speed_10m": "wind_speed",
    "cloud_cover": "cloud_cover",
    "precipitation": "precipitation",
}


def fetch_hourly(lat, lon, past_days=92, forecast_days=1, timeout=20):
    """Hourly frame indexed by tz-aware hour-ending timestamps in IST."""
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "hourly": ",".join(_FIELDS),
        "past_days": past_days,
        "forecast_days": forecast_days,
        "timezone": TZ,
        "wind_speed_unit": "ms",
    }
    url = FORECAST_URL + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        payload = json.load(resp)
    return parse_hourly(payload)


def parse_hourly(payload):
    h = payload["hourly"]
    idx = pd.DatetimeIndex(pd.to_datetime(h["time"])).tz_localize(TZ)
    frame = pd.DataFrame({ours: h[theirs] for theirs, ours in _FIELDS.items()}, index=idx)
    return frame.astype(float).fillna(0.0)
