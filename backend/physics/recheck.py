"""Closed-loop verification: after an action, did output recover against the SAME
baseline that was used when the action was taken?"""
import numpy as np
import pandas as pd

RECOVERY_MARGIN = 0.05
MIN_DAYS_AFTER = 3

RECOVERED, NOT_RECOVERED, WAITING = "RECOVERED", "NOT_RECOVERED", "WAITING_FOR_DATA"


def evaluate_recheck(daily, action_date, baseline_at_action, pre_pi_norm, as_of, tariff_inr=6.0,
                     monthly_loss_inr=None):
    """If `monthly_loss_inr` (the loss shown at action time) is given, the money recovered is
    that loss times the share of the gap closed, so it can never exceed what was lost."""
    as_of = pd.Timestamp(as_of).normalize()
    after = daily.loc[(daily.index > pd.Timestamp(action_date)) & (daily.index <= as_of)
                      & ~daily["low_conf"] & daily["kwh_actual"].notna() & (daily["kwh_expected"] > 0)]
    if len(after) < MIN_DAYS_AFTER:
        return {"outcome": WAITING, "hc_days_after": int(len(after))}
    last3 = after.iloc[-3:]
    post = float(np.median(last3["kwh_actual"] / last3["kwh_expected"])) / baseline_at_action
    outcome = RECOVERED if post >= pre_pi_norm + RECOVERY_MARGIN else NOT_RECOVERED
    # Cap at the baseline: noise above the best week is not money "recovered".
    closed = max(0.0, min(post, 1.0) - pre_pi_norm)
    if monthly_loss_inr is not None and pre_pi_norm < 1.0:
        recovered = monthly_loss_inr * min(1.0, closed / (1.0 - pre_pi_norm))
    else:
        recovered = closed * float(last3["kwh_expected"].mean()) * baseline_at_action * 30 * tariff_inr
    return {
        "outcome": outcome,
        "hc_days_after": int(len(after)),
        "pre_pi_norm": round(pre_pi_norm, 3),
        "post_pi_norm": round(post, 3),
        "recovered_inr_month": round(recovered, 0) if outcome == RECOVERED else 0.0,
        "escalate_to": "FAULT" if outcome == NOT_RECOVERED else None,
    }
