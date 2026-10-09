"""One-time EventBridge Scheduler schedules that invoke the agent Lambda for a recheck."""
import json
import os
from datetime import datetime, timedelta, timezone

import boto3

_scheduler = None


def _client():
    global _scheduler
    if _scheduler is None:
        _scheduler = boto3.client("scheduler")
    return _scheduler


def schedule_recheck(site_id, action_id, days, suffix=""):
    """Returns (schedule_name, run_at_iso). In demo mode the delay is minutes, not days.
    Idempotent: an existing schedule with the same name is kept."""
    demo_minutes = int(os.environ.get("RECHECK_DELAY_MINUTES", "0") or 0)
    now = datetime.now(timezone.utc)
    run_at = now + (timedelta(minutes=demo_minutes) if demo_minutes else timedelta(days=days))
    name = f"recheck-{site_id}-{action_id}{'-' + suffix if suffix else ''}"[:64]
    try:
        _create(name, run_at, site_id, action_id)
    except _client().exceptions.ConflictException:
        pass
    return name, run_at.isoformat()


def _create(name, run_at, site_id, action_id):
    _client().create_schedule(
        Name=name,
        ScheduleExpression=f"at({run_at.strftime('%Y-%m-%dT%H:%M:%S')})",
        ScheduleExpressionTimezone="UTC",
        FlexibleTimeWindow={"Mode": "OFF"},
        ActionAfterCompletion="DELETE",
        Target={"Arn": os.environ["AGENT_FUNCTION_ARN"], "RoleArn": os.environ["SCHEDULER_ROLE_ARN"],
                "Input": json.dumps({"mode": "recheck", "site_id": site_id, "action_id": action_id})},
    )
