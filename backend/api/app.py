"""HTTP API entry point. Phase 0: health only; routes are added in Phase 2."""
import json


def handler(event, context):
    return {"statusCode": 200, "headers": {"content-type": "application/json"},
            "body": json.dumps({"ok": True, "service": "suryacheck"})}
