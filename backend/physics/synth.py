"""Synthetic performance series for tests and the demo seed.

Weather (`expected`) can be real (from yield_model) or synthetic; only the
performance factors applied on top are invented. Everything produced here is
flagged simulated by the caller.
"""
import numpy as np
import pandas as pd


def synthetic_expected(end, days=120, seed=0, rain_dates=(), low_conf_dates=(), mean_kwh=14.3):
    rng = np.random.default_rng(seed)
    idx = pd.date_range(end=pd.Timestamp(end), periods=days, freq="D")
    kwh = mean_kwh * (1 + rng.normal(0, 0.03, days))
    frame = pd.DataFrame({"kwh_expected": kwh, "rain_mm": 0.0, "low_conf": False}, index=idx)
    for d in rain_dates:
        frame.loc[pd.Timestamp(d), ["rain_mm", "low_conf"]] = [20.0, True]
    for d in low_conf_dates:
        frame.loc[pd.Timestamp(d), "low_conf"] = True
    return frame


def soiling_factor(index, reset_dates, rate_per_day, floor=0.6):
    resets = sorted(pd.Timestamp(d) for d in reset_dates)
    out = []
    for d in index:
        last = max((r for r in resets if r <= d), default=index[0])
        out.append(max(floor, 1 - rate_per_day * (d - last).days))
    return np.array(out)


def make_site(expected, seed=0, baseline=None, noise=0.03, soiling_rate=0.0, extra_resets=(),
              steps=(), trips=(), level=1.0):
    """steps: [(date, delta)] multiplicative drops; trips: dates with ~0 output."""
    rng = np.random.default_rng(seed)
    base = baseline if baseline is not None else rng.uniform(0.92, 1.0)
    f = np.full(len(expected), base * level)
    if soiling_rate:
        rain = expected.index[expected["rain_mm"] >= 5]
        f = f * soiling_factor(expected.index, list(rain) + list(extra_resets), soiling_rate)
    for date, delta in steps:
        f = np.where(expected.index >= pd.Timestamp(date), f * (1 + delta), f)
    f = f * rng.normal(1, noise, len(expected))
    site = expected.copy()
    site["kwh_actual"] = (site["kwh_expected"] * f).clip(lower=0)
    for d in trips:
        site.loc[pd.Timestamp(d), "kwh_actual"] = 0.0
    return site
