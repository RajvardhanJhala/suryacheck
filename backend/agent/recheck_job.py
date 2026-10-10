"""Scheduled (or demo-triggered) recheck of an action against the baseline stored at action time."""
from datetime import datetime, timedelta, timezone

import pandas as pd

from agent.pipeline import site_daily, today_ist
from physics.recheck import NOT_RECOVERED, WAITING, evaluate_recheck
from shared import ddb, scheduling

IST = timezone(timedelta(hours=5, minutes=30))


def run_recheck(site_id, action_id):
    pk = ddb.site_pk(site_id)
    action = ddb.get(pk, f"ACTION#{action_id}")
    if not action or action.get("outcome") not in ("PENDING", WAITING):
        return action
    site = ddb.get(pk, "META")
    daily = site_daily(site, site_id)

    # Measure from the cleaning/repair the user logged after the action, else from the action date.
    # A cleaning logged on day D happens in the morning, so day D already counts as "after".
    events = [e for e in ddb.query_prefix(pk, "EVENT#") if e["SK"][6:16] >= action["as_of"]]
    start = action["as_of"]
    if events:
        start = (pd.Timestamp(max(e["SK"][6:16] for e in events)) - pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    latest = daily.index[daily["kwh_actual"].notna()].max()
    as_of = min(latest, pd.Timestamp(today_ist())) if pd.notna(latest) else pd.Timestamp(today_ist())

    res = evaluate_recheck(daily, start, action["baseline_at_action"], action["pre_pi_norm"], as_of,
                           tariff_inr=site.get("tariff_inr", 6.0), monthly_loss_inr=action.get("monthly_loss_inr"))
    # Two weeks before the action to today, for the before/after chart on the recheck card.
    base = action["baseline_at_action"]
    win = daily.loc[(daily.index >= pd.Timestamp(action["as_of"]) - pd.Timedelta(days=14)) & (daily.index <= as_of)]
    res["series"] = [{"date": d.strftime("%Y-%m-%d"),
                      "actual": None if pd.isna(r.kwh_actual) else round(float(r.kwh_actual), 2),
                      "expected": round(float(r.kwh_expected) * base, 2)} for d, r in win.iterrows()]
    res["cleaned_on"] = max((e["SK"][6:16] for e in events), default=None)
    update = {"outcome": res["outcome"], "recheck_result": res, "measured_from": start,
              "rechecked_at": datetime.now(IST).isoformat()}
    if res["outcome"] == WAITING and not action.get("rearmed"):
        update["rearmed"] = True
        update["schedule_name"], update["recheck_at"] = scheduling.schedule_recheck(site_id, action_id, days=3,
                                                                                    suffix="r")
    if res["outcome"] == NOT_RECOVERED and action["type"] == "CLEAN_PANELS":
        update["next_step"] = "MESSAGE_INSTALLER"   # dust ruled out -> escalate to fault
    ddb.table().update_item(
        Key={"PK": pk, "SK": f"ACTION#{action_id}"},
        UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in update),
        ExpressionAttributeNames={f"#{k}": k for k in update},
        ExpressionAttributeValues={f":{k}": v for k, v in ddb.to_ddb(update).items()})
    return {**action, **update}
