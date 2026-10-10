"""Seed the clearly-labelled SIMULATED demo homes and verify the story end to end.

    python scripts/seed_demo.py

Weather is real (Open-Meteo for Chandkheda, Ahmedabad); only the performance factors
applied on top are synthetic. Every site is stored with simulated=true and a label.
Runs every analysis through the deployed agent Lambda and every action through the
deployed API (Cedar gate + EventBridge Scheduler), then fails loudly unless:
  - Hemant  -> SOILING with CLEAN_PANELS (loss >= cleaning cost)
  - Meera   -> FAULT with MESSAGE_INSTALLER
  - Replay  -> cleaning action rechecked as RECOVERED
"""
import json
import sys
import urllib.error
import urllib.request

import boto3
import numpy as np
import pandas as pd

sys.path.insert(0, "backend")
from physics.weather import fetch_hourly  # noqa: E402
from physics.yield_model import expected_daily  # noqa: E402
from shared.ddb import to_ddb  # noqa: E402
from shared.geo import geohash  # noqa: E402

REGION, STACK = "ap-south-1", "suryacheck"
LAT, LON, KWP = 23.1100, 72.5850, 3.0          # Chandkheda, Ahmedabad
RNG = np.random.default_rng(42)

cf = boto3.client("cloudformation", region_name=REGION)
outputs = {o["OutputKey"]: o["OutputValue"] for o in cf.describe_stacks(StackName=STACK)["Stacks"][0]["Outputs"]}
API, TABLE = outputs["ApiUrl"], boto3.resource("dynamodb", region_name=REGION).Table(outputs["TableName"])
lam = boto3.client("lambda", region_name=REGION)
DEMO_KEY = next(l.split("=", 1)[1].strip() for l in open(".env") if l.startswith("DEMO_KEY="))


def call(method, path, body=None, headers=None):
    req = urllib.request.Request(API + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"content-type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def wipe(site_id):
    items = TABLE.query(KeyConditionExpression=boto3.dynamodb.conditions.Key("PK").eq(f"SITE#{site_id}"))["Items"]
    with TABLE.batch_writer() as w:
        for it in items:
            w.delete_item(Key={"PK": it["PK"], "SK": it["SK"]})


def put_site(site_id, label, lat, lon, readings, events=(), peer=True, **extra):
    wipe(site_id)
    cell = geohash(lat, lon)
    meta = {"PK": f"SITE#{site_id}", "SK": "META", "lat": lat, "lon": lon, "geohash5": cell, "capacity_kwp": KWP,
            "tilt": 23.0, "azimuth": 180.0, "tariff_inr": 6.0, "cleaning_cost_inr": 200, "installer_phone": None,
            "simulated": True, "label": label, **extra}
    if peer:
        meta.update({"GSI1PK": f"GEO#{cell}", "GSI1SK": f"SITE#{site_id}"})
    with TABLE.batch_writer() as w:
        w.put_item(Item=to_ddb(meta))
        for d, kwh in readings.items():
            w.put_item(Item=to_ddb({"PK": f"SITE#{site_id}", "SK": f"DAY#{d:%Y-%m-%d}", "kwh_actual": round(kwh, 2),
                                    "source": "seed"}))
        for d, t in events:
            w.put_item(Item=to_ddb({"PK": f"SITE#{site_id}", "SK": f"EVENT#{d:%Y-%m-%d}#{t}", "type": t,
                                    "source": "seed"}))
    return cell


def analyze(site_id, as_of=None):
    analysis_id = f"seed{pd.Timestamp.now():%Y%m%d%H%M%S}{site_id[-4:]}"
    resp = lam.invoke(FunctionName="suryacheck-agent", Payload=json.dumps(
        {"mode": "analyze", "site_id": site_id, "analysis_id": analysis_id,
         "as_of": None if as_of is None else f"{as_of:%Y-%m-%d}"}).encode())
    out = json.loads(resp["Payload"].read())
    if "error" in out:
        sys.exit(f"analysis failed for {site_id}: {out['error']}")
    item = TABLE.get_item(Key={"PK": f"SITE#{site_id}", "SK": f"ANALYSIS#{analysis_id}"})["Item"]
    return analysis_id, item


def series(exp, factor):
    return dict(zip(exp.index, exp["kwh_expected"].values * factor))


def main():
    exp = expected_daily(fetch_hourly(LAT, LON, past_days=60), LAT, LON, KWP)
    today = pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None).normalize()
    exp = exp.loc[exp.index < today]                                  # complete days only
    rain = exp.index[exp["rain_mm"] >= 5]
    last_rain = rain.max()
    days_dry = np.clip((exp.index - last_rain).days, 0, None)
    print(f"Real weather: last rain >= 5 mm on {last_rain:%b %d}; {len(exp)} days up to {exp.index.max():%b %d}")

    def soil(rate, resets):
        return np.array([max(0.6, 1 - rate * (d - max([r for r in resets if r <= d], default=exp.index[0])).days)
                         for d in exp.index])

    checks = []
    # 6 neighbours: mild, normal dust; reset by real rain.
    for i in range(6):
        sid = f"demonbr{i + 1:05d}"
        f = RNG.uniform(0.92, 1.0) * soil(RNG.uniform(0.001, 0.004), list(rain)) * RNG.normal(1, 0.03, len(exp))
        cell = put_site(sid, f"Neighbour {i + 1}", LAT + RNG.uniform(-0.01, 0.01),
                        LON + RNG.uniform(-0.01, 0.01), series(exp, f))
        analyze(sid)
    print(f"6 simulated neighbours seeded in cell {cell}")

    # Hemant: dust from the construction site next door, 0.75 %/day since the last rain.
    f = 0.97 * np.clip(1 - 0.0075 * days_dry, 0.6, 1) * RNG.normal(1, 0.02, len(exp))
    put_site("demohemant01", "Hemant Patel, Chandkheda", LAT, LON, series(exp, f))
    h_id, h = analyze("demohemant01")
    print(f"Hemant: {h['verdict']} Rs{h['monthly_loss_inr']}/month -> {h['action']} | {h['evidence']}")
    checks.append(("Hemant is SOILING", h["verdict"] == "SOILING"))
    checks.append(("Hemant's loss covers cleaning -> CLEAN_PANELS", h["action"] == "CLEAN_PANELS"))

    # Meera: a string fails 5 days ago (-28 %), neighbours flat.
    step = today - pd.Timedelta(days=5)
    f = 0.96 * np.where(exp.index >= step, 0.72, 1.0) * RNG.normal(1, 0.02, len(exp))
    put_site("demomeera001", "Meera Shah, Chandkheda", LAT + 0.004, LON - 0.003, series(exp, f))
    _, m = analyze("demomeera001")
    print(f"Meera:  {m['verdict']} Rs{m['monthly_loss_inr']}/month -> {m['action']}")
    checks.append(("Meera is FAULT", m["verdict"] == "FAULT"))
    checks.append(("Meera -> MESSAGE_INSTALLER", m["action"] == "MESSAGE_INSTALLER"))

    # Cedar must refuse to send Meera's fault to a cleaner.
    s, b = call("POST", "/sites/demomeera001/actions", {"analysisId": _latest(m), "action": "CLEAN_PANELS"})
    checks.append(("Cedar denies CLEAN_PANELS for a FAULT (403)", s == 403))

    # Replay: Hemant's roof on an earlier timeline, cleaned 3 days ago.
    clean_day = today - pd.Timedelta(days=3)   # leaves exactly 3 clear days to verify
    f = 0.97 * soil(0.009, list(rain) + [clean_day]) * RNG.normal(1, 0.015, len(exp))
    put_site("demoreplay01", "Hemant's roof: replay of a cleaning", LAT, LON, series(exp, f),
             peer=False, exclude_from_peers=True)
    before = clean_day - pd.Timedelta(days=1)
    r_id, r = analyze("demoreplay01", as_of=before)
    print(f"Replay (as of {before:%b %d}): {r['verdict']} Rs{r['monthly_loss_inr']}/month -> {r['action']}")
    s, act = call("POST", "/sites/demoreplay01/actions", {"analysisId": r_id, "action": "CLEAN_PANELS"})
    checks.append(("Cedar allows CLEAN_PANELS for SOILING (201)", s == 201))
    TABLE.put_item(Item=to_ddb({"PK": "SITE#demoreplay01", "SK": f"EVENT#{clean_day:%Y-%m-%d}#CLEANED",
                                "type": "CLEANED", "source": "seed"}))
    s2, again = call("POST", "/sites/demoreplay01/actions", {"analysisId": r_id, "action": "CLEAN_PANELS"})
    checks.append(("double tap returns the same action", s2 == 200 and again.get("actionId") == act.get("actionId")))
    s, rc = call("POST", f"/sites/demoreplay01/actions/{act.get('actionId')}/recheck", {}, {"x-demo-key": DEMO_KEY})
    res = (rc or {}).get("result") or {}
    print(f"Replay recheck: {rc.get('outcome')} pre={res.get('pre_pi_norm')} post={res.get('post_pi_norm')} "
          f"recovered Rs{res.get('recovered_inr_month')}/month")
    checks.append(("Replay recheck RECOVERED", rc.get("outcome") == "RECOVERED"))
    print(f"A real one-time schedule ({act.get('schedule_name')}) will also fire at {act.get('recheck_at')}.")

    for name, ok in checks:
        print(("PASS " if ok else "FAIL ") + name)
    if not all(ok for _, ok in checks):
        sys.exit("Seed checks failed - do not record the demo until they pass.")


def _latest(item):
    return item["SK"].split("#", 1)[1]


if __name__ == "__main__":
    main()
