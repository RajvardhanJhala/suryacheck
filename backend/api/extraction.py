"""Photo/screenshot -> numbers with Amazon Textract. Textract reads characters; deterministic
code (readings_parser) decides which are dates and kWh. The user confirms before anything is saved.

kinds:
  inverter_screenshot  app screenshot with a daily list  -> DetectDocumentText + parser
  inverter_photo       camera photo of the inverter      -> Queries: today's kWh (+ total)
  meter_photo          camera photo of a meter           -> Queries: generation total, import, export
"""
import io
from datetime import date, datetime, timedelta, timezone

import boto3
from PIL import Image

from shared.readings_parser import parse_lines

MAX_BYTES, MAX_SIDE = int(4.5 * 1024 * 1024), 9000
LOW_CONFIDENCE = 70

s3 = boto3.client("s3")
textract = boto3.client("textract")

QUERIES = {
    "inverter_photo": [("today_kwh", "What is today's energy generation in kWh?"),
                       ("total_kwh", "What is the total lifetime energy in kWh?")],
    "meter_photo": [("total_kwh", "What is the total solar generation reading in kWh?"),
                    ("import_kwh", "What is the import reading in kWh?"),
                    ("export_kwh", "What is the export reading in kWh?")],
}


def _today_ist():
    return datetime.now(timezone(timedelta(hours=5, minutes=30))).date()


def _prepare(body):
    """Textract accepts JPEG/PNG up to 5 MB; downscale anything bigger."""
    img = Image.open(io.BytesIO(body))
    if len(body) <= MAX_BYTES and img.format in ("JPEG", "PNG"):
        return body
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=85)
    return out.getvalue()


def _number(text):
    try:
        return float(text.replace(",", "").replace(" ", "").lower().removesuffix("kwh"))
    except (AttributeError, ValueError):
        return None


def extract_rows(bucket, keys, kind, max_kwh):
    images = [_prepare(s3.get_object(Bucket=bucket, Key=k)["Body"].read()) for k in keys]
    today = _today_ist()
    result = {"kind": kind, "rows": [], "values": {}, "warnings": [], "engine": "Amazon Textract"}

    if kind == "inverter_screenshot":
        lines, low = [], 0
        for img in images:
            blocks = textract.detect_document_text(Document={"Bytes": img})["Blocks"]
            for b in blocks:
                if b["BlockType"] == "LINE":
                    lines.append(b["Text"])
                    low += b["Confidence"] < LOW_CONFIDENCE
        result["rows"], result["warnings"] = parse_lines(lines, today, max_kwh)
        if low:
            result["warnings"].append(f"{low} line(s) were hard to read. Check those numbers against your screenshot.")
        if not result["rows"]:
            result["warnings"].append("No dated kWh values found. Try the monthly or daily list view of your inverter app.")
        return result

    queries = QUERIES[kind]
    r = textract.analyze_document(Document={"Bytes": images[0]}, FeatureTypes=["QUERIES"],
                                  QueriesConfig={"Queries": [{"Text": q, "Alias": a} for a, q in queries]})
    by_id = {b["Id"]: b for b in r["Blocks"]}
    for b in r["Blocks"]:
        if b["BlockType"] != "QUERY":
            continue
        ans = [by_id[i] for rel in b.get("Relationships", []) if rel["Type"] == "ANSWER" for i in rel["Ids"]]
        if ans and (v := _number(ans[0]["Text"])) is not None:
            result["values"][b["Query"]["Alias"]] = {"value": v, "confidence": round(ans[0]["Confidence"])}
    for alias, v in result["values"].items():
        if v["confidence"] < LOW_CONFIDENCE:
            result["warnings"].append(f"Not sure about the {alias.replace('_kwh', '').replace('_', ' ')} value — please check it.")
    if kind == "inverter_photo" and "today_kwh" in result["values"]:
        kwh = result["values"]["today_kwh"]["value"]
        if 0 <= kwh <= max_kwh:
            result["rows"] = [{"date": today.isoformat(), "kwh": round(kwh, 2)}]
        else:
            result["warnings"].append(f"{kwh:g} kWh is not possible for one day on this system — please type it in.")
    if not result["values"]:
        result["warnings"].append("Couldn't read the display. Take the photo straight on, without glare.")
    return result
