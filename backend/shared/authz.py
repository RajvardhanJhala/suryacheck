"""Cedar gate in front of every action. The agent may *propose* an action; this decides."""
import os

import cedarpy

_POLICY_PATH = os.path.join(os.path.dirname(__file__), "..", "policies", "actions.cedar")
with open(_POLICY_PATH, encoding="utf-8") as fh:
    POLICIES = fh.read()


def is_action_allowed(action, analysis, site, principal="anonymous"):
    """analysis: dict with id, verdict, monthly_loss_inr. site: dict with
    cleaning_cost_inr, simulated, installer_phone. Returns (allowed, reasons)."""
    entities = [{
        "uid": {"__entity": {"type": "Analysis", "id": analysis["id"]}},
        "attrs": {
            "verdict": analysis["verdict"],
            "monthly_loss_inr": int(round(analysis.get("monthly_loss_inr") or 0)),
            "cleaning_cost_inr": int(round(site.get("cleaning_cost_inr") or 200)),
            "simulated": bool(site.get("simulated", False)),
            "has_real_contact": bool(site.get("installer_phone")),
        },
        "parents": [],
    }]
    request = {
        "principal": f'User::"{principal}"',
        "action": f'Action::"{action}"',
        "resource": f'Analysis::"{analysis["id"]}"',
        "context": {},
    }
    result = cedarpy.is_authorized(request, POLICIES, entities)
    return result.allowed, list(result.diagnostics.reasons)
