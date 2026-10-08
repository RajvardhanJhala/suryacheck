"""HTTP API (Powertools router). Every route validates input; Bedrock-backed routes are capped."""
import json
import os
import re
import uuid
from datetime import date, datetime, timedelta

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver, Response
from aws_lambda_powertools.event_handler.exceptions import BadRequestError, NotFoundError

from shared import caps, ddb
from shared.geo import geohash

logger = Logger()
app = APIGatewayHttpResolver()
s3 = boto3.client("s3")
lam = boto3.client("lambda")

BUCKET = os.environ.get("BUCKET_NAME", "")
AGENT_FN = os.environ.get("AGENT_FUNCTION", "")
MAX_TILE_BYTES = int(3.75 * 1024 * 1024)
MAX_TILES = 8
SITE_ID_RE = re.compile(r"^[a-z0-9]{12}$")


def _body():
    try:
        return app.current_event.json_body or {}
    except (json.JSONDecodeError, TypeError):
        raise BadRequestError("Body must be JSON")


def _num(body, key, lo, hi, default=None):
    v = body.get(key, default)
    if v is None:
        raise BadRequestError(f"{key} is required")
    try:
        v = float(v)
    except (TypeError, ValueError):
        raise BadRequestError(f"{key} must be a number")
    if not lo <= v <= hi:
        raise BadRequestError(f"{key} must be between {lo} and {hi}")
    return v


def _site(site_id):
    if not SITE_ID_RE.match(site_id):
        raise NotFoundError("Unknown site")
    site = ddb.get(ddb.site_pk(site_id), "META")
    if not site:
        raise NotFoundError("Unknown site")
    return site


def _too_many(what):
    return Response(429, "application/json", json.dumps({"error": f"Daily limit reached for {what}. Try tomorrow."}))


def _today_ist():
    return date.fromisoformat(caps.today_ist())


@app.get("/health")
def health():
    return {"ok": True, "service": "suryacheck"}


@app.post("/sites")
def create_site():
    b = _body()
    lat, lon = _num(b, "lat", 6, 37), _num(b, "lon", 68, 98)          # India bounding box
    site = {
        "lat": lat, "lon": lon, "geohash5": geohash(lat, lon),
        "capacity_kwp": _num(b, "capacity_kwp", 0.5, 50),
        "tilt": _num(b, "tilt", 0, 60, 23), "azimuth": _num(b, "azimuth", 0, 360, 180),
        "tariff_inr": _num(b, "tariff_inr", 1, 20, 6), "cleaning_cost_inr": _num(b, "cleaning_cost_inr", 0, 5000, 200),
        "installer_phone": re.sub(r"[^\d+]", "", str(b.get("installer_phone", "")))[:15] or None,
        "simulated": False,
    }
    try:
        caps.take_global("sites_created")
    except caps.CapExceeded:
        return _too_many("new sites")
    site_id = uuid.uuid4().hex[:12]
    ddb.put({"PK": ddb.site_pk(site_id), "SK": "META", **site, "created_at": datetime.utcnow().isoformat(),
             "GSI1PK": f"GEO#{site['geohash5']}", "GSI1SK": ddb.site_pk(site_id)})
    return Response(201, "application/json", json.dumps({"siteId": site_id}))


@app.get("/sites/<site_id>")
def get_site(site_id):
    site = _site(site_id)
    since = (_today_ist() - timedelta(days=60)).isoformat()
    pk = ddb.site_pk(site_id)
    readings = [{"date": r["SK"][4:], "kwh": r["kwh_actual"], "source": r.get("source")}
                for r in ddb.query_prefix(pk, "DAY#", start=since)]
    events = [{"date": e["SK"][6:16], "type": e["type"]} for e in ddb.query_prefix(pk, "EVENT#")]
    actions = [{k: v for k, v in a.items() if k not in ("PK",)} for a in ddb.query_prefix(pk, "ACTION#")]
    analyses = sorted(ddb.query_prefix(pk, "ANALYSIS#"), key=lambda a: a["SK"], reverse=True)
    public = {k: v for k, v in site.items() if k not in ("PK", "SK", "GSI1PK", "GSI1SK", "pi_norm_series")}
    return {"siteId": site_id, "site": public, "readings": readings, "events": events, "actions": actions,
            "latestAnalysisId": analyses[0]["SK"][9:] if analyses else None}


@app.post("/sites/<site_id>/uploads")
def create_uploads(site_id):
    _site(site_id)
    b = _body()
    n = int(_num(b, "tiles", 1, MAX_TILES, 1))
    ctype = b.get("contentType", "image/jpeg")
    if ctype not in ("image/jpeg", "image/png"):
        raise BadRequestError("contentType must be image/jpeg or image/png")
    batch = uuid.uuid4().hex[:8]
    posts = []
    for i in range(n):
        key = f"uploads/{site_id}/{batch}/{i}.{'png' if ctype == 'image/png' else 'jpg'}"
        posts.append({"key": key, **s3.generate_presigned_post(
            BUCKET, key, Fields={"Content-Type": ctype},
            Conditions=[{"Content-Type": ctype}, ["content-length-range", 1, MAX_TILE_BYTES]], ExpiresIn=600)})
    return {"uploads": posts}


@app.post("/sites/<site_id>/extractions")
def extract(site_id):
    from api.extraction import extract_rows   # imported lazily: needs Pillow + Bedrock
    _site(site_id)
    keys = _body().get("keys") or []
    if not keys or len(keys) > MAX_TILES or not all(str(k).startswith(f"uploads/{site_id}/") for k in keys):
        raise BadRequestError(f"keys must be 1-{MAX_TILES} upload keys for this site")
    try:
        caps.take_global("extractions")
        caps.take_site_bedrock(site_id)
    except caps.CapExceeded:
        return _too_many("screenshot reading (please type the numbers in)")
    return extract_rows(BUCKET, keys)


@app.put("/sites/<site_id>/readings")
def put_readings(site_id):
    site = _site(site_id)
    b = _body()
    rows, source = b.get("rows") or [], b.get("source", "manual")
    if source not in ("screenshot", "csv", "manual"):
        raise BadRequestError("source must be screenshot, csv or manual")
    if not isinstance(rows, list) or not 1 <= len(rows) <= 120:
        raise BadRequestError("rows must be a list of 1-120 {date, kwh}")
    max_kwh, today = site["capacity_kwp"] * 7.5, _today_ist()
    clean, rejected = {}, []
    for r in rows:
        try:
            d = date.fromisoformat(str(r.get("date")))
            kwh = float(r.get("kwh"))
        except (TypeError, ValueError):
            rejected.append({"row": r, "reason": "bad date or kwh"})
            continue
        if d > today:
            rejected.append({"date": d.isoformat(), "reason": "date is in the future"})
        elif d < today - timedelta(days=120):
            rejected.append({"date": d.isoformat(), "reason": "older than 120 days"})
        elif not 0 <= kwh <= max_kwh:
            rejected.append({"date": d.isoformat(), "reason": f"kWh must be between 0 and {max_kwh:g}"})
        else:
            clean[d.isoformat()] = kwh                                # last value for a date wins
    with ddb.table().batch_writer() as w:
        for d, kwh in clean.items():
            w.put_item(Item=ddb.to_ddb({"PK": ddb.site_pk(site_id), "SK": f"DAY#{d}", "kwh_actual": kwh,
                                        "source": source}))
    return {"saved": len(clean), "rejected": rejected}


@app.post("/sites/<site_id>/events")
def add_event(site_id):
    _site(site_id)
    b = _body()
    etype = b.get("type")
    if etype not in ("CLEANED", "REPAIR"):
        raise BadRequestError("type must be CLEANED or REPAIR")
    try:
        d = date.fromisoformat(str(b.get("date")))
    except ValueError:
        raise BadRequestError("date must be YYYY-MM-DD")
    if d > _today_ist():
        raise BadRequestError("date is in the future")
    ddb.put({"PK": ddb.site_pk(site_id), "SK": f"EVENT#{d.isoformat()}#{etype}", "type": etype, "source": "user"})
    return {"ok": True}


@app.post("/sites/<site_id>/analyses")
def start_analysis(site_id):
    _site(site_id)
    b = _body()
    as_of = b.get("as_of")
    if as_of is not None:
        try:
            d = date.fromisoformat(str(as_of))
        except ValueError:
            raise BadRequestError("as_of must be YYYY-MM-DD")
        if not _today_ist() - timedelta(days=90) <= d <= _today_ist():
            raise BadRequestError("as_of must be within the last 90 days")
    try:
        caps.take_global("agent_runs")
    except caps.CapExceeded:
        return _too_many("analyses")
    analysis_id = datetime.utcnow().strftime("%Y%m%d%H%M%S") + uuid.uuid4().hex[:6]
    ddb.put({"PK": ddb.site_pk(site_id), "SK": f"ANALYSIS#{analysis_id}", "status": "PENDING",
             "note": str(b.get("note", ""))[:500]})
    lam.invoke(FunctionName=AGENT_FN, InvocationType="Event", Payload=json.dumps({
        "mode": "analyze", "site_id": site_id, "analysis_id": analysis_id, "as_of": as_of,
        "window_days": int(_num(b, "window_days", 14, 60, 45))}).encode())
    return Response(202, "application/json", json.dumps({"analysisId": analysis_id}))


@app.get("/sites/<site_id>/analyses/<analysis_id>")
def get_analysis(site_id, analysis_id):
    _site(site_id)
    a = ddb.get(ddb.site_pk(site_id), f"ANALYSIS#{analysis_id}")
    if not a:
        raise NotFoundError("Unknown analysis")
    return {k: v for k, v in a.items() if k not in ("PK", "SK")}


@logger.inject_lambda_context
def handler(event, context):
    return app.resolve(event, context)
