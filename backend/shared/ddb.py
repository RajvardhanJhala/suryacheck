"""Single-table DynamoDB access. Floats go in as Decimal and come out as float."""
import json
import os
import time
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

_table = None


def table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
    return _table


def _clean(obj):
    if isinstance(obj, float) and obj != obj:      # NaN is not storable in DynamoDB
        return None
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    return obj


def to_ddb(obj):
    return json.loads(json.dumps(_clean(obj)), parse_float=Decimal)


def from_ddb(obj):
    if isinstance(obj, list):
        return [from_ddb(v) for v in obj]
    if isinstance(obj, dict):
        return {k: from_ddb(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return obj


def site_pk(site_id):
    return f"SITE#{site_id}"


def put(item):
    table().put_item(Item=to_ddb(item))


def get(pk, sk):
    item = table().get_item(Key={"PK": pk, "SK": sk}).get("Item")
    return from_ddb(item) if item else None


def query_prefix(pk, sk_prefix, start=None, end=None):
    """All items under pk whose SK starts with sk_prefix (optionally an SK range)."""
    if start or end:
        cond = Key("PK").eq(pk) & Key("SK").between(f"{sk_prefix}{start or ''}", f"{sk_prefix}{end or '~'}")
    else:
        cond = Key("PK").eq(pk) & Key("SK").begins_with(sk_prefix)
    items, kwargs = [], {"KeyConditionExpression": cond}
    while True:
        resp = table().query(**kwargs)
        items += resp["Items"]
        if "LastEvaluatedKey" not in resp:
            return from_ddb(items)
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def query_gsi1(gsi1pk):
    resp = table().query(IndexName="GSI1", KeyConditionExpression=Key("GSI1PK").eq(gsi1pk))
    return from_ddb(resp["Items"])


def ttl_in(days):
    return int(time.time() + days * 86400)
