import numpy as np
import pandas as pd
import pvlib

from physics.yield_model import expected_daily

LAT, LON = 23.09, 72.58


def clear_sky_hourly(start="2026-10-01", days=5):
    # Hour-ending timestamps, like Open-Meteo, starting at 00:00 so day one is partial.
    idx = pd.date_range(start, periods=24 * days, freq="h", tz="Asia/Kolkata")
    cs = pvlib.location.Location(LAT, LON, tz="Asia/Kolkata").get_clearsky(idx - pd.Timedelta(minutes=30))
    return pd.DataFrame({"ghi": cs["ghi"].values, "dni": cs["dni"].values, "dhi": cs["dhi"].values,
                         "temp_air": 32.0, "wind_speed": 2.0, "cloud_cover": 0.0, "precipitation": 0.0},
                        index=idx)


def test_clear_october_day_3kwp_ahmedabad():
    daily = expected_daily(clear_sky_hourly(), LAT, LON, 3.0)
    assert np.all((daily["kwh_expected"] > 13) & (daily["kwh_expected"] < 17)), daily
    assert not daily["low_conf"].any()


def test_partial_edge_days_are_dropped():
    daily = expected_daily(clear_sky_hourly(), LAT, LON, 3.0)
    assert daily.index.min() > pd.Timestamp("2026-09-30")
    assert (daily["kwh_expected"] > 1).all()
