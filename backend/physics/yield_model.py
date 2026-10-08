"""Expected daily AC energy for a rooftop PV system from hourly weather.

Chain: solar position -> Hay-Davies POA transposition -> Faiman cell temperature
-> PVWatts DC -> fixed system losses -> PVWatts inverter, summed per local day.
"""
import pandas as pd
import pvlib

GAMMA_PDC = -0.0037          # 1/°C, typical mono-PERC
SYSTEM_LOSS = 0.14           # soiling-free losses: wiring, mismatch, LID, availability
INV_EFF = 0.96

# A day is low-confidence when the weather model is least trustworthy.
LOW_CONF_CLOUD_PCT = 60.0
LOW_CONF_POA_KWH_M2 = 2.5
LOW_CONF_RAIN_MM = 10.0

HOURLY_COLUMNS = ("ghi", "dni", "dhi", "temp_air", "wind_speed", "cloud_cover", "precipitation")


def expected_hourly_ac_w(hourly, lat, lon, capacity_kwp, tilt=23.0, azimuth=180.0):
    """AC power (W) per hour. `hourly` is indexed by tz-aware hour-ending timestamps
    (Open-Meteo convention: values are means over the preceding hour)."""
    mid = hourly.index - pd.Timedelta(minutes=30)
    solpos = pvlib.solarposition.get_solarposition(mid, lat, lon)
    dni_extra = pvlib.irradiance.get_extra_radiation(mid)
    poa = pvlib.irradiance.get_total_irradiance(
        tilt, azimuth,
        solpos["apparent_zenith"].values, solpos["azimuth"].values,
        hourly["dni"].values, hourly["ghi"].values, hourly["dhi"].values,
        dni_extra=dni_extra.values, model="haydavies",
    )
    poa_global = pd.Series(poa["poa_global"], index=hourly.index).fillna(0.0).clip(lower=0.0)
    t_cell = pvlib.temperature.faiman(poa_global, hourly["temp_air"], hourly["wind_speed"])
    pac0 = capacity_kwp * 1000.0
    pdc = pvlib.pvsystem.pvwatts_dc(poa_global, t_cell, pac0, GAMMA_PDC) * (1.0 - SYSTEM_LOSS)
    pac = pvlib.inverter.pvwatts(pdc, pac0 / INV_EFF, eta_inv_nom=INV_EFF).clip(lower=0.0)
    return pd.DataFrame({"poa_w_m2": poa_global, "pac_w": pac})


def expected_daily(hourly, lat, lon, capacity_kwp, tilt=23.0, azimuth=180.0):
    """One row per local day: kwh_expected, poa_kwh_m2, cloud_pct, rain_mm, low_conf."""
    h = expected_hourly_ac_w(hourly, lat, lon, capacity_kwp, tilt, azimuth)
    # Attribute each hour-ending value to the day its midpoint falls in.
    day = (hourly.index - pd.Timedelta(minutes=30)).date
    daylight = h["poa_w_m2"] > 10
    daily = pd.DataFrame({
        "kwh_expected": h["pac_w"].groupby(day).sum() / 1000.0,
        "poa_kwh_m2": h["poa_w_m2"].groupby(day).sum() / 1000.0,
        "cloud_pct": hourly["cloud_cover"][daylight].groupby(day[daylight.values]).mean(),
        "rain_mm": hourly["precipitation"].groupby(day).sum(),
    })
    daily.index = pd.to_datetime(daily.index)
    daily["cloud_pct"] = daily["cloud_pct"].fillna(100.0)
    daily["low_conf"] = (
        (daily["cloud_pct"] > LOW_CONF_CLOUD_PCT)
        | (daily["poa_kwh_m2"] < LOW_CONF_POA_KWH_M2)
        | (daily["rain_mm"] > LOW_CONF_RAIN_MM)
    )
    return daily
