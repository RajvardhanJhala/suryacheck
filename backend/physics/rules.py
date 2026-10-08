"""Deterministic cause scoring. Code decides the verdict; the model may only choose
between `tie_candidates` when the top two scores are within TIE_BAND."""

TIE_BAND = 0.10
MIN_SCORE = 0.5
MIN_HC_DAYS = 7
HEALTHY_MED3 = 0.92

TRIP, FAULT, SOILING, WEATHER, PERSISTENT_LOW, STEADY_LOSS = (
    "INVERTER_TRIP", "FAULT", "SOILING", "WEATHER", "PERSISTENT_LOW", "STEADY_LOSS")
HEALTHY, UNEXPLAINED, INSUFFICIENT = "HEALTHY", "UNEXPLAINED", "INSUFFICIENT_DATA"
PRECEDENCE = [TRIP, FAULT, SOILING, WEATHER, PERSISTENT_LOW, STEADY_LOSS]

# Mirrors backend/policies/actions.cedar; tests/test_authz.py checks they agree.
ACTIONS = {
    SOILING: ["CLEAN_PANELS", "WAIT"],
    FAULT: ["MESSAGE_INSTALLER"],
    TRIP: ["CHECK_INVERTER_DISPLAY", "MESSAGE_INSTALLER"],
    PERSISTENT_LOW: ["INSPECT_SHADING", "VERIFY_CAPACITY"],
    STEADY_LOSS: ["CLEAN_PANELS", "INSPECT_SHADING"],
    UNEXPLAINED: ["INSPECT_SHADING"],
    WEATHER: ["NONE"],
    HEALTHY: ["NONE"],
    INSUFFICIENT: ["ADD_DATA"],
}
RECHECK_DAYS = {SOILING: 5, FAULT: 7, TRIP: 2, STEADY_LOSS: 5, UNEXPLAINED: 7}


def allowed_actions(verdict, monthly_loss_inr, cleaning_cost_inr):
    acts = list(ACTIONS[verdict])
    if "CLEAN_PANELS" in acts and monthly_loss_inr < cleaning_cost_inr:
        acts.remove("CLEAN_PANELS")
    if verdict == SOILING and "CLEAN_PANELS" in acts:
        acts.remove("WAIT")
    return acts


def _recent_fault_step(perf):
    """The most recent step that has held for at least 3 high-confidence days."""
    held = [s for s in perf.steps if s["hc_days_after"] >= 3 and s["hc_days_after"] <= 10]
    if not held or perf.med3_latest is None:
        return None
    s = held[-1]
    return s if s["before"] - perf.med3_latest >= 0.15 else None


def score_causes(perf, peers, cleaning_cost_inr=200.0):
    scores, evidence = {}, []
    n_peers = peers.get("n_peers", 0)

    if perf.hc_days < MIN_HC_DAYS:
        return _result(INSUFFICIENT, {}, [], [f"Only {perf.hc_days} clear days of data (need {MIN_HC_DAYS})."],
                       perf, cleaning_cost_inr)

    if perf.trip_days:
        grid = set(perf.trip_days) & set(peers.get("peer_trip_like_days", []))
        scores[TRIP] = 0.6 if grid else 0.95
        evidence.append(f"Near-zero output on {', '.join(perf.trip_days)}"
                        + (" (neighbours too: likely grid outage)" if grid else "") + ".")

    step = _recent_fault_step(perf)
    if step:
        pd_ = peers.get("peer_delta_recent")
        peers_flat = pd_ is None or pd_ > -0.05
        if peers_flat:
            scores[FAULT] = 0.9 if n_peers >= 3 else 0.7
            evidence.append(f"Output stepped down {abs(step['delta']):.0%} on {step['date']} and stayed down"
                            + (" while neighbours held steady." if n_peers >= 3 else "."))

    if (FAULT not in scores and perf.segment_hc_days >= 7 and perf.segment_slope is not None
            and perf.segment_slope <= -0.002 and (perf.segment_slope_high or 0) < 0 and 0.05 <= (perf.segment_decline or 0) <= 0.30):
        s = 0.7
        if perf.recoveries:
            s += 0.15
        psd = peers.get("peer_segment_decline")
        if psd is not None and psd < perf.segment_decline / 2:
            s += 0.05
        scores[SOILING] = min(s, 0.9)
        evidence.append(f"Since {perf.segment_start} (last rain or cleaning) output slid "
                        f"{perf.segment_decline:.0%} at {abs(perf.segment_slope):.2%}/day.")

    p7, you7 = peers.get("peer_pi_norm_med7"), perf.med7_latest
    if n_peers >= 3 and p7 is not None and you7 is not None and p7 <= 0.85 and abs(you7 - p7) <= 0.08:
        scores[WEATHER] = 0.9
        evidence.append(f"Neighbours dipped too ({p7:.0%} of normal vs you {you7:.0%}).")

    no_step = not perf.steps
    flat = perf.slope14 is not None and abs(perf.slope14) < 0.001
    if perf.med14_abs_pi is not None and perf.med14_abs_pi <= 0.80 and flat and no_step:
        scores[PERSISTENT_LOW] = 0.7
        evidence.append(f"Output has been a steady {perf.med14_abs_pi:.0%} of the physics estimate.")

    if (PERSISTENT_LOW not in scores and perf.med14 is not None and perf.med14 <= 0.90 and no_step
            and perf.slope14 is not None and abs(perf.slope14) < 0.002):
        scores[STEADY_LOSS] = 0.6
        evidence.append(f"Output is a steady {1 - perf.med14:.0%} below your own best week.")

    ranked = sorted((c for c, s in scores.items() if s >= MIN_SCORE),
                    key=lambda c: (-scores[c], PRECEDENCE.index(c)))
    if not ranked:
        verdict = HEALTHY if (perf.med3_latest or 0) >= HEALTHY_MED3 else UNEXPLAINED
        return _result(verdict, scores, [], evidence, perf, cleaning_cost_inr)
    ties = ranked[:2] if len(ranked) > 1 and scores[ranked[0]] - scores[ranked[1]] <= TIE_BAND else []
    return _result(ranked[0], scores, ties, evidence, perf, cleaning_cost_inr)


def _result(verdict, scores, ties, evidence, perf, cleaning_cost_inr):
    candidates = ties or [verdict]
    return {
        "verdict_code": verdict,
        "scores": {k: round(v, 2) for k, v in scores.items()},
        "tie_candidates": ties,
        "allowed_actions": {v: allowed_actions(v, perf.monthly_loss_inr, cleaning_cost_inr) for v in candidates},
        "recheck_days": RECHECK_DAYS.get(verdict),
        "monthly_loss_inr": perf.monthly_loss_inr,
        "window_loss_inr": perf.window_loss_inr,
        "evidence": evidence,
    }
