"""Daily usage caps enforced with a conditional atomic counter, so a script hammering
the public URL cannot drain the AWS credit."""
import os
from datetime import datetime, timedelta, timezone

from botocore.exceptions import ClientError

from shared.ddb import table, ttl_in

IST = timezone(timedelta(hours=5, minutes=30))

GLOBAL_LIMITS = {
    "agent_runs": int(os.environ.get("CAP_AGENT_RUNS", 100)),
    "extractions": int(os.environ.get("CAP_EXTRACTIONS", 150)),
    "sites_created": int(os.environ.get("CAP_SITES", 50)),
    "rechecks_manual": int(os.environ.get("CAP_RECHECKS", 20)),
}
PER_SITE_BEDROCK = int(os.environ.get("CAP_SITE_BEDROCK", 20))


class CapExceeded(Exception):
    pass


def today_ist():
    return datetime.now(IST).strftime("%Y-%m-%d")


def _take(pk, field, limit):
    try:
        table().update_item(
            Key={"PK": pk, "SK": "CAP"},
            UpdateExpression="ADD #f :one SET #t = if_not_exists(#t, :ttl)",
            ConditionExpression="attribute_not_exists(#f) OR #f < :limit",
            ExpressionAttributeNames={"#f": field, "#t": "ttl"},
            ExpressionAttributeValues={":one": 1, ":limit": limit, ":ttl": ttl_in(2)},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise CapExceeded(field) from e
        raise


def take_global(field):
    _take(f"CAP#GLOBAL#{today_ist()}", field, GLOBAL_LIMITS[field])


def take_site_bedrock(site_id):
    _take(f"CAP#{site_id}#{today_ist()}", "bedrock_calls", PER_SITE_BEDROCK)
