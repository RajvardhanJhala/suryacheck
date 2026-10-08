"""End-to-end check against the deployed API.

    python scripts/e2e.py <api_url>

Creates a test site, uploads 5 weeks of SYNTHETIC readings (real Open-Meteo weather x
a soiling factor starting the day after the last real rain), runs an analysis and
asserts the verdict is SOILING. Also checks input validation and a 404.
"""
import json
import sys
import time
import urllib.error
import urllib.request

import numpy as np
import pandas as pd

sys.path.insert(0, "backend")
from physics.weather import fetch_hourly  # noqa: E402
from physics.yield_model import expected_daily  # noqa: E402

API = sys.argv[1].rstrip("/")
LAT, LON, KWP = 23.11, 72.58, 3.0


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def synthetic_readings():
    exp = expected_daily(fetch_hourly(LAT, LON, past_days=45), LAT, LON, KWP)
    exp = exp.loc[exp.index < pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize()]
    last_rain = exp.index[exp["rain_mm"] >= 5].max()
    rng = np.random.default_rng(42)
    days_dry = np.clip((exp.index - last_rain).days, 0, None)
    factor = 0.97 * (1 - 0.0075 * days_dry) * rng.normal(1, 0.02, len(exp))
    return last_rain, [{"date": d.strftime("%Y-%m-%d"), "kwh": round(float(k), 2)}
                       for d, k in zip(exp.index, exp["kwh_expected"] * factor)]


def main():
    checks = []
    s, b = call("POST", "/sites", {"lat": LAT, "lon": 200, "capacity_kwp": KWP})
    checks.append(("bad lon rejected", s == 400))
    s, b = call("GET", "/sites/doesnotexist")
    checks.append(("unknown site 404", s == 404))

    s, b = call("POST", "/sites", {"lat": LAT, "lon": LON, "capacity_kwp": KWP})
    assert s == 201, (s, b)
    site = b["siteId"]
    last_rain, rows = synthetic_readings()
    rows.append({"date": "2099-01-01", "kwh": 5})                      # future date must be rejected
    s, b = call("PUT", f"/sites/{site}/readings", {"rows": rows, "source": "manual"})
    checks.append(("readings saved, future rejected", s == 200 and len(b["rejected"]) == 1))

    s, b = call("POST", f"/sites/{site}/analyses", {})
    assert s == 202, (s, b)
    aid, t0 = b["analysisId"], time.time()
    while True:
        s, a = call("GET", f"/sites/{site}/analyses/{aid}")
        if a.get("status") != "PENDING" or time.time() - t0 > 120:
            break
        time.sleep(3)
    print(f"analysis in {time.time() - t0:.0f}s: status={a.get('status')} verdict={a.get('verdict')} "
          f"loss=Rs{a.get('monthly_loss_inr')}/month action={a.get('action')} error={a.get('error')}")
    print("evidence:", a.get("evidence"))
    checks.append((f"verdict SOILING since {last_rain:%b %d}", a.get("verdict") == "SOILING"))
    checks.append(("loss covers cleaning cost -> CLEAN_PANELS", a.get("action") == "CLEAN_PANELS"))

    for name, ok in checks:
        print(("PASS " if ok else "FAIL ") + name)
    print("site:", site)
    sys.exit(0 if all(ok for _, ok in checks) else 1)


if __name__ == "__main__":
    main()
