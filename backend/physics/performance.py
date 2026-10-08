"""Performance metrics for one site, computed strictly from data on or before `as_of`.

Input `daily` is indexed by date (DatetimeIndex, one row per day) with columns
kwh_actual (may be NaN), kwh_expected, low_conf, rain_mm.
"""
from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd
from scipy.stats import theilslopes

BASELINE_LOOKBACK_DAYS = 90
BASELINE_WINDOW = 7
BASELINE_CLAMP = (0.70, 1.05)
RESET_RAIN_MM = 5.0
RESET_EVENT_TYPES = ("CLEANED", "REPAIR")
STEP_MIN_DROP = 0.15
STEP_RAMP_TOLERANCE = 0.07     # the day before a step must still look "before"
TRIP_RATIO = 0.10


@dataclass
class Performance:
    as_of: str
    hc_days: int
    baseline_pi: float
    baseline_conf: str
    segment_start: str
    segment_hc_days: int
    segment_slope: float | None
    segment_slope_high: float | None    # upper 95% bound; < 0 means the decline is real
    segment_decline: float | None
    med3_latest: float | None
    med7_latest: float | None
    med7_prior: float | None
    med14: float | None
    med14_abs_pi: float | None
    slope14: float | None
    steps: list = field(default_factory=list)       # [{date, delta, before, after, hc_days_after}]
    trip_days: list = field(default_factory=list)   # dates with actual <= 10% of expected
    recoveries: list = field(default_factory=list)  # [{date, jump}] after reset events
    window_loss_inr: float = 0.0
    monthly_loss_inr: float = 0.0
    mean_expected_kwh: float = 0.0
    pi_norm: dict = field(default_factory=dict)     # date -> value, high-confidence days only

    def to_dict(self):
        return asdict(self)


def _median(values):
    values = [v for v in values if v is not None and not np.isnan(v)]
    return float(np.median(values)) if values else None


def compute_baseline(daily, as_of):
    """Best rolling 7-high-confidence-day median of pi in the 90 days before as_of.
    Events never lower it; only better output can raise it."""
    start = as_of - pd.Timedelta(days=BASELINE_LOOKBACK_DAYS)
    d = daily.loc[(daily.index > start) & (daily.index <= as_of)]
    hc = d.loc[~d["low_conf"] & d["kwh_actual"].notna() & (d["kwh_expected"] > 0)]
    pi = (hc["kwh_actual"] / hc["kwh_expected"]).reset_index(drop=True)
    if len(pi) < BASELINE_WINDOW:
        return 1.0, "low"
    best = pi.rolling(BASELINE_WINDOW).median().max()
    return float(np.clip(best, *BASELINE_CLAMP)), "ok"


def reset_dates(daily, events, as_of):
    rain = set(daily.index[(daily["rain_mm"] >= RESET_RAIN_MM) & (daily.index <= as_of)])
    ev = {pd.Timestamp(e["date"]) for e in events
          if e.get("type") in RESET_EVENT_TYPES and pd.Timestamp(e["date"]) <= as_of}
    return sorted(rain | ev)


def find_steps(pi_norm):
    """Abrupt drops: median of the 7 days before minus median of the 3 days from d is
    at least STEP_MIN_DROP, while the day just before d still looked like 'before'."""
    vals = pi_norm.values
    dates = pi_norm.index
    steps = []
    i = 1
    while i <= len(vals) - 3:
        before = vals[max(0, i - 7):i]
        if len(before) >= 3:
            b, a = float(np.median(before)), float(np.median(vals[i:i + 3]))
            if b - a >= STEP_MIN_DROP and vals[i - 1] >= b - STEP_RAMP_TOLERANCE:
                steps.append({"date": dates[i].strftime("%Y-%m-%d"), "delta": round(a - b, 3),
                              "before": round(b, 3), "after": round(a, 3),
                              "hc_days_after": int(len(vals) - i)})
                i += 3
                continue
        i += 1
    return steps


def compute_performance(daily, as_of, events=(), window_days=45, tariff_inr=6.0):
    as_of = pd.Timestamp(as_of).normalize()
    daily = daily.sort_index()
    baseline, baseline_conf = compute_baseline(daily, as_of)

    win = daily.loc[(daily.index > as_of - pd.Timedelta(days=window_days)) & (daily.index <= as_of)].copy()
    win["pi"] = win["kwh_actual"] / win["kwh_expected"].where(win["kwh_expected"] > 0)
    win["pi_norm"] = win["pi"] / baseline
    hc = win.loc[~win["low_conf"] & win["pi"].notna()]
    pn = hc["pi_norm"]

    resets = reset_dates(daily, list(events), as_of)
    last_reset = max((r for r in resets if r <= as_of), default=None)
    seg_start = (last_reset + pd.Timedelta(days=1)) if last_reset is not None else win.index.min()
    seg = pn.loc[pn.index >= seg_start]
    seg_slope = seg_slope_high = seg_decline = None
    med3 = _median(pn.iloc[-3:]) if len(pn) else None
    if len(seg) >= 7:
        x = (seg.index - seg_start).days.values.astype(float)
        slope, _, _, high = theilslopes(seg.values, x)
        # Decline along the fitted trend, so one noisy recent day cannot fake it.
        seg_slope, seg_slope_high, seg_decline = float(slope), float(high), float(-slope * x[-1])

    last14 = pn.iloc[-14:]
    slope14 = None
    if len(last14) >= 7:
        x = (last14.index - last14.index[0]).days.values.astype(float)
        slope14 = float(theilslopes(last14.values, x)[0])

    trips = win.loc[~win["low_conf"] & (win.index > as_of - pd.Timedelta(days=7))
                    & (win["kwh_actual"] <= TRIP_RATIO * win["kwh_expected"])]

    recoveries = []
    for r in resets:
        if r < as_of - pd.Timedelta(days=60):
            continue
        before = pn.loc[pn.index <= r].iloc[-3:]
        after = pn.loc[(pn.index > r) & (pn.index <= r + pd.Timedelta(days=3))]
        if len(before) and len(after):
            jump = float(after.max() - np.median(before))
            if jump >= 0.05:
                recoveries.append({"date": r.strftime("%Y-%m-%d"), "jump": round(jump, 3)})

    loss_kwh = (win["kwh_expected"] * baseline - win["kwh_actual"]).clip(lower=0.0)
    hc_loss = loss_kwh.loc[hc.index].iloc[-7:]
    return Performance(
        as_of=as_of.strftime("%Y-%m-%d"),
        hc_days=int(len(pn)),
        baseline_pi=round(baseline, 3),
        baseline_conf=baseline_conf,
        segment_start=seg_start.strftime("%Y-%m-%d"),
        segment_hc_days=int(len(seg)),
        segment_slope=None if seg_slope is None else round(seg_slope, 5),
        segment_slope_high=None if seg_slope_high is None else round(seg_slope_high, 5),
        segment_decline=None if seg_decline is None else round(seg_decline, 3),
        med3_latest=med3,
        med7_latest=_median(pn.iloc[-7:]),
        med7_prior=_median(pn.iloc[-10:-3]),
        med14=_median(last14),
        med14_abs_pi=_median(hc["pi"].iloc[-14:]),
        slope14=None if slope14 is None else round(slope14, 5),
        steps=find_steps(pn),
        trip_days=[d.strftime("%Y-%m-%d") for d in trips.index],
        recoveries=recoveries,
        window_loss_inr=round(float(loss_kwh.sum()) * tariff_inr, 0),
        monthly_loss_inr=round(float(hc_loss.mean()) * 30 * tariff_inr, 0) if len(hc_loss) else 0.0,
        mean_expected_kwh=round(float(hc["kwh_expected"].iloc[-7:].mean()), 2) if len(hc) else 0.0,
        pi_norm={d.strftime("%Y-%m-%d"): round(float(v), 4) for d, v in pn.items()},
    )


def peer_compare(you, peers, as_of):
    """`you` is a Performance; `peers` a list of Performance (each against its own baseline)."""
    peers = [p for p in peers if p.pi_norm]
    out = {"n_peers": len(peers), "peer_pi_norm_med7": None, "you_minus_peer_pi_norm_7d": None,
           "peer_segment_decline": None, "peer_median_by_day": {}, "peer_delta_recent": None}
    if not peers:
        return out
    frame = pd.DataFrame({i: pd.Series(p.pi_norm) for i, p in enumerate(peers)})
    frame.index = pd.to_datetime(frame.index)
    med = frame.median(axis=1).sort_index()
    med = med.loc[med.index <= pd.Timestamp(as_of)]
    out["peer_median_by_day"] = {d.strftime("%Y-%m-%d"): round(float(v), 4) for d, v in med.items()}
    out["peer_pi_norm_med7"] = _median(med.iloc[-7:])
    if out["peer_pi_norm_med7"] is not None and you.med7_latest is not None:
        out["you_minus_peer_pi_norm_7d"] = round(you.med7_latest - out["peer_pi_norm_med7"], 3)
    seg = med.loc[med.index >= pd.Timestamp(you.segment_start)]
    if len(seg) >= 7:
        x = (seg.index - seg.index[0]).days.values.astype(float)
        slope = theilslopes(seg.values, x)[0]
        out["peer_segment_decline"] = round(float(-slope * x[-1]), 3)
    if len(med) >= 10:
        out["peer_delta_recent"] = round(_median(med.iloc[-3:]) - _median(med.iloc[-10:-3]), 3)
    out["peer_trip_like_days"] = [d.strftime("%Y-%m-%d") for d, v in med.items() if v <= 0.2]
    return out
