"""Deterministic analysis: every number and the verdict come from here, never from the model."""
import gzip
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pandas as pd

from physics import rules
from physics.explain import explain
from physics.performance import compute_performance, peer_compare
from physics.weather import fetch_payload, parse_hourly
from physics.yield_model import expected_daily
from shared import ddb

IST = timezone(timedelta(hours=5, minutes=30))
HISTORY_DAYS = 92
PEER_SERIES_DAYS = 60


def today_ist():
    return datetime.now(IST).date()


def hourly_weather(site):
    """Open-Meteo hourly weather, cached per neighbourhood cell per day (one call per cell per day)."""
    pk, sk = f"WX#{site['geohash5']}", f"FETCH#{today_ist().isoformat()}"
    cached = ddb.table().get_item(Key={"PK": pk, "SK": sk}).get("Item")
    if cached:
        payload = json.loads(gzip.decompress(bytes(cached["payload"].value)))
    else:
        payload = fetch_payload(site["lat"], site["lon"], past_days=HISTORY_DAYS)
        ddb.table().put_item(Item={"PK": pk, "SK": sk, "payload": gzip.compress(json.dumps(payload).encode()),
                                   "ttl": ddb.ttl_in(2)})
    return parse_hourly(payload)


def site_daily(site, site_id):
    """Expected (physics) joined with actual (user) per day, up to yesterday or today."""
    exp = expected_daily(hourly_weather(site), site["lat"], site["lon"], site["capacity_kwp"],
                         site.get("tilt", 23.0), site.get("azimuth", 180.0))
    exp = exp.loc[exp.index <= pd.Timestamp(today_ist())]
    readings = ddb.query_prefix(ddb.site_pk(site_id), "DAY#")
    actual = pd.Series({pd.Timestamp(r["SK"][4:]): r["kwh_actual"] for r in readings}, dtype=float)
    exp["kwh_actual"] = actual.reindex(exp.index)
    return exp


def peers_for(site, site_id):
    out = []
    for item in ddb.query_gsi1(f"GEO#{site['geohash5']}"):
        if item["PK"] != ddb.site_pk(site_id) and item.get("pi_norm_series"):
            out.append(SimpleNamespace(pi_norm=item["pi_norm_series"], simulated=item.get("simulated", False)))
    return out


def run_analysis(site_id, analysis_id, as_of=None, window_days=45):
    site = ddb.get(ddb.site_pk(site_id), "META")
    daily = site_daily(site, site_id)
    events = [{"date": e["SK"][6:16], "type": e["type"]} for e in ddb.query_prefix(ddb.site_pk(site_id), "EVENT#")]
    has_actual = daily.index[daily["kwh_actual"].notna()]
    if as_of is None:
        as_of = has_actual.max() if len(has_actual) else pd.Timestamp(today_ist())
    as_of = pd.Timestamp(as_of)

    tariff, cost = site.get("tariff_inr", 6.0), site.get("cleaning_cost_inr", 200)
    perf = compute_performance(daily, as_of, events=events, window_days=window_days, tariff_inr=tariff)
    peer_objs = peers_for(site, site_id)
    peers = peer_compare(perf, peer_objs, as_of)
    result = rules.score_causes(perf, peers, cleaning_cost_inr=cost)

    win = daily.loc[(daily.index > as_of - pd.Timedelta(days=window_days)) & (daily.index <= as_of)]
    series = [{
        "date": d.strftime("%Y-%m-%d"),
        "actual": None if pd.isna(r.kwh_actual) else round(r.kwh_actual, 2),
        "expected": round(r.kwh_expected * perf.baseline_pi, 2),
        "low_conf": bool(r.low_conf),
        "rain_mm": round(r.rain_mm, 1),
        "pi_norm": perf.pi_norm.get(d.strftime("%Y-%m-%d")),
        "peer_pi_norm": peers["peer_median_by_day"].get(d.strftime("%Y-%m-%d")),
    } for d, r in win.iterrows()]

    verdict = result["verdict_code"]
    candidates = result["tie_candidates"] or [verdict]
    action = result["allowed_actions"][candidates[0]][0]
    analysis = {
        "PK": ddb.site_pk(site_id), "SK": f"ANALYSIS#{analysis_id}",
        "status": "DONE", "as_of": perf.as_of, "window_days": window_days,
        "verdict": verdict, "verdict_source": "code",
        "tie_candidates": result["tie_candidates"],
        "allowed_actions": result["allowed_actions"],
        "action": action,
        "explanation": explain(verdict, action, result["monthly_loss_inr"], result["evidence"]),
        "explanation_source": "template",
        "recheck_days": result["recheck_days"],
        "scores": result["scores"], "evidence": result["evidence"],
        "monthly_loss_inr": result["monthly_loss_inr"], "window_loss_inr": result["window_loss_inr"],
        "performance": {k: v for k, v in perf.to_dict().items() if k != "pi_norm"},
        "peers": {k: v for k, v in peers.items() if k != "peer_median_by_day"},
        "peers_simulated": any(p.simulated for p in peer_objs),
        "series": series, "narrative": None, "finished_at": datetime.now(IST).isoformat(),
    }
    ddb.put(analysis)

    # Publish this site's recent normalised performance for its neighbours.
    recent = dict(list(perf.pi_norm.items())[-PEER_SERIES_DAYS:])
    ddb.table().update_item(Key={"PK": ddb.site_pk(site_id), "SK": "META"},
                            UpdateExpression="SET pi_norm_series = :s",
                            ExpressionAttributeValues={":s": ddb.to_ddb(recent)})
    return analysis
