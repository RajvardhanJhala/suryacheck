"""Agent Lambda entry point (invoked asynchronously by the api Lambda).

mode=analyze : deterministic analysis -> DynamoDB (the model narrative is added in Phase 3)
mode=expected: physics smoke test
"""
import traceback

from aws_lambda_powertools import Logger

from agent.pipeline import run_analysis
from shared import ddb

logger = Logger()


def _expected(event):
    from physics.weather import fetch_hourly
    from physics.yield_model import expected_daily
    lat, lon, kwp = event.get("lat", 23.09), event.get("lon", 72.58), event.get("capacity_kwp", 3.0)
    daily = expected_daily(fetch_hourly(lat, lon, past_days=event.get("past_days", 14)), lat, lon, kwp)
    return [{"date": d.strftime("%Y-%m-%d"), "kwh_expected": round(r.kwh_expected, 2)} for d, r in daily.iterrows()]


@logger.inject_lambda_context
def handler(event, context):
    mode = event.get("mode", "expected")
    if mode == "expected":
        return {"days": _expected(event)}
    if mode == "analyze":
        site_id, analysis_id = event["site_id"], event["analysis_id"]
        try:
            a = run_analysis(site_id, analysis_id, as_of=event.get("as_of"), window_days=event.get("window_days", 45))
            logger.info("analysis done", extra={"site_id": site_id, "verdict": a["verdict"],
                                                "monthly_loss_inr": a["monthly_loss_inr"]})
            return {"verdict": a["verdict"]}
        except Exception as e:
            logger.exception("analysis failed")
            ddb.table().update_item(
                Key={"PK": ddb.site_pk(site_id), "SK": f"ANALYSIS#{analysis_id}"},
                UpdateExpression="SET #s = :f, #e = :e",
                ExpressionAttributeNames={"#s": "status", "#e": "error"},
                ExpressionAttributeValues={":f": "FAILED", ":e": f"{type(e).__name__}: {e}"[:500]})
            return {"error": traceback.format_exc()[-500:]}
    raise ValueError(f"unknown mode {mode}")
