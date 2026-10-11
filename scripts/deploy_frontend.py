"""Build-and-upload deploy of frontend/dist to AWS Amplify Hosting (no Git connection needed).

    cd frontend && npm run build && cd .. && python scripts/deploy_frontend.py
"""
import io
import os
import time
import urllib.request
import zipfile

import boto3

APP_NAME, BRANCH, REGION = "suryacheck", "main", "ap-south-1"
DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

amp = boto3.client("amplify", region_name=REGION)
# Single-page app: send unknown paths to index.html, never real static files (manifest, sitemap, icons).
RULES = [{"source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|webmanifest|xml|pdf)$)([^.]+$)/>",
          "target": "/index.html", "status": "200"}]
app = next((a for a in amp.list_apps()["apps"] if a["name"] == APP_NAME), None)
if app is None:
    app = amp.create_app(name=APP_NAME, platform="WEB", customRules=RULES)["app"]
HEADERS = """customHeaders:
  - pattern: '**/*.webmanifest'
    headers:
      - key: Content-Type
        value: application/manifest+json
"""
if app.get("customRules") != RULES or app.get("customHeaders") != HEADERS:
    app = amp.update_app(appId=app["appId"], customRules=RULES, customHeaders=HEADERS)["app"]
app_id = app["appId"]
if not any(b["branchName"] == BRANCH for b in amp.list_branches(appId=app_id)["branches"]):
    amp.create_branch(appId=app_id, branchName=BRANCH, stage="PRODUCTION")

buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(DIST):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, DIST).replace(os.sep, "/"))

dep = amp.create_deployment(appId=app_id, branchName=BRANCH)
req = urllib.request.Request(dep["zipUploadUrl"], data=buf.getvalue(), method="PUT",
                             headers={"Content-Type": "application/zip"})
urllib.request.urlopen(req).read()
job = amp.start_deployment(appId=app_id, branchName=BRANCH, jobId=dep["jobId"])["jobSummary"]
while True:
    status = amp.get_job(appId=app_id, branchName=BRANCH, jobId=job["jobId"])["job"]["summary"]["status"]
    if status not in ("PENDING", "PROVISIONING", "RUNNING"):
        break
    time.sleep(3)
print(status, f"https://{BRANCH}.{app['defaultDomain']}")
