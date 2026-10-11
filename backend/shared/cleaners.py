"""CleaningProvider adapter: who can clean this roof, and how to ask them.

Today's provider is Amazon Location Service Places: real businesses only, never invented
names, ratings or prices. A partner booking API can replace it by implementing the same
`search` and `request_booking`.
"""
import json
import os
from datetime import datetime

import boto3

from shared import ddb

SOURCE = "Amazon Location Service"
QUERIES = ("solar panel cleaning", "solar system", "solar energy", "solar solutions", "rooftop solar", "solar power")
RADIUS_M = 30000
NOT_SOLAR_TRADE = ("Clothing", "Furniture", "Consumer Electronics", "Restaurant", "Jewelry", "Hotel")


class LocationPlaces:
    def __init__(self):
        self.places = boto3.client("geo-places")

    def locality(self, lat, lon):
        """'Mirzapur, Ahmedabad' for display; None if the lookup fails (never blocks a check)."""
        try:
            a = self.places.reverse_geocode(QueryPosition=[lon, lat], MaxResults=1)["ResultItems"][0].get("Address", {})
        except Exception:      # noqa: BLE001 - a missing place name must not fail site creation
            return None
        parts = [a.get("District"), a.get("Locality")]
        return ", ".join(dict.fromkeys(p for p in parts if p)) or None

    def geocode(self, q):
        items = self.places.geocode(QueryText=q, Filter={"IncludeCountries": ["IND"]}, MaxResults=1)["ResultItems"]
        if not items:
            return None
        lon, lat = items[0]["Position"]
        return {"lat": round(lat, 4), "lon": round(lon, 4), "label": items[0].get("Title")}

    def search(self, lat, lon, limit=5):
        found = {}
        for q in QUERIES:
            r = self.places.search_text(QueryText=q, Filter={"Circle": {"Center": [lon, lat], "Radius": RADIUS_M}},
                                        MaxResults=20, AdditionalFeatures=["Contact"])
            for it in r["ResultItems"]:
                cats = " ".join(c.get("Name", "") for c in it.get("Categories", []))
                if "solar" not in it.get("Title", "").lower() or any(x in cats for x in NOT_SOLAR_TRADE):
                    continue
                addr = it.get("Address") or {}
                found[it["PlaceId"]] = {
                    "id": it["PlaceId"], "name": it["Title"], "distance_km": round(it.get("Distance", 0) / 1000, 1),
                    "area": ", ".join(dict.fromkeys(p for p in (addr.get("District"), addr.get("Locality")) if p)) or None,
                    "phone": next((p["Value"] for p in (it.get("Contacts") or {}).get("Phones", [])), None),
                    "source": SOURCE,
                }
        # Reachable first (a phone number means Call/WhatsApp work), then nearest.
        return sorted(found.values(), key=lambda p: (p["phone"] is None, p["distance_km"]))[:limit]

    def request_booking(self, site_id, site, provider, analysis):
        """Log the request; email it to the ops inbox when one is configured (SES sandbox: verified only)."""
        now = datetime.utcnow().isoformat()
        ops = os.environ.get("OPS_EMAIL", "")
        item = {"PK": ddb.site_pk(site_id), "SK": f"BOOKING#{now}", "provider": provider, "status": "LOGGED",
                "verdict": analysis.get("verdict"), "monthly_loss_inr": analysis.get("monthly_loss_inr"),
                "capacity_kwp": site.get("capacity_kwp"), "locality": site.get("locality"), "created_at": now}
        if ops:
            body = {"site": site_id, "provider": provider, "capacity_kwp": site.get("capacity_kwp"),
                    "locality": site.get("locality"), "verdict": analysis.get("verdict"),
                    "monthly_loss_inr": analysis.get("monthly_loss_inr"), "requested_at": now}
            boto3.client("sesv2").send_email(
                FromEmailAddress=ops, Destination={"ToAddresses": [ops]},
                Content={"Simple": {"Subject": {"Data": f"Cleaning request: {provider.get('name')}"},
                                    "Body": {"Text": {"Data": json.dumps(body, indent=2, default=str)}}}})
            item["status"] = "EMAILED"
        ddb.put(item)
        return {"status": item["status"], "requested_at": now}


def provider():
    return LocationPlaces()
