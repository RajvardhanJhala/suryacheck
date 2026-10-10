"""End-to-end check of the signed-in flow against the deployed stack.

    python scripts/e2e_auth.py

Creates (or reuses) a Cognito test user, saves a site via /me/site, checks that another
caller cannot see it, reads a generated inverter screenshot with Textract, saves the rows,
and runs an analysis. Deletes nothing; the test user is e2e+suryacheck@example.com.
"""
import io
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

import boto3
from PIL import Image, ImageDraw, ImageFont

REGION = "ap-south-1"
EMAIL, PASSWORD = "e2e+suryacheck@example.com", "e2e-test-pass1"

out = {o["OutputKey"]: o["OutputValue"] for o in
       boto3.client("cloudformation", region_name=REGION).describe_stacks(StackName="suryacheck")["Stacks"][0]["Outputs"]}
API, POOL, CLIENT = out["ApiUrl"], out["UserPoolId"], out["UserPoolClientId"]
idp = boto3.client("cognito-idp", region_name=REGION)


def call(method, path, body=None, token=None, raw=None, headers=None):
    h = {"content-type": "application/json", **(headers or {})}
    if token:
        h["authorization"] = f"Bearer {token}"
    req = urllib.request.Request(raw or API + path, method=method, headers=h,
                                 data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def token():
    try:
        idp.admin_create_user(UserPoolId=POOL, Username=EMAIL, MessageAction="SUPPRESS",
                              UserAttributes=[{"Name": "email", "Value": EMAIL}, {"Name": "email_verified", "Value": "true"}])
    except idp.exceptions.UsernameExistsException:
        pass
    idp.admin_set_user_password(UserPoolId=POOL, Username=EMAIL, Password=PASSWORD, Permanent=True)
    r = idp.admin_initiate_auth(UserPoolId=POOL, ClientId=CLIENT, AuthFlow="ADMIN_USER_PASSWORD_AUTH",
                                AuthParameters={"USERNAME": EMAIL, "PASSWORD": PASSWORD})
    return r["AuthenticationResult"]["AccessToken"]


def screenshot(days):
    img = Image.new("RGB", (720, 80 + 60 * len(days)), "white")
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype("arial.ttf", 28)
    d.text((24, 20), "Daily Generation", fill="black", font=f)
    for i, (day, kwh) in enumerate(days):
        d.text((24, 80 + i * 60), f"{day:%d/%m/%Y}     {kwh:.1f} kWh", fill="black", font=f)
    buf = io.BytesIO(); img.save(buf, "PNG")
    return buf.getvalue()


def main():
    checks = []
    tok = token()
    s, b = call("GET", "/me")
    checks.append(("/me without token is 401", s == 401))
    s, b = call("PUT", "/me/site", {"lat": 23.03, "lon": 72.58, "capacity_kwp": 3, "label": "E2E roof"}, tok)
    site = b.get("siteId")
    checks.append(("/me/site saves a site", s in (200, 201) and site))
    s, b = call("GET", "/me", token=tok)
    checks.append(("/me returns the same site", b.get("siteId") == site))
    s, _ = call("GET", f"/sites/{site}")
    checks.append(("owned site hidden without token (404)", s == 404))
    s, _ = call("GET", f"/sites/{site}", token=tok)
    checks.append(("owned site visible to owner", s == 200))

    today = date.today()
    days = [(today - timedelta(days=i), 14.0 - 0.1 * i) for i in range(10, 0, -1)]
    s, up = call("POST", f"/sites/{site}/uploads", {"tiles": 1, "contentType": "image/png", "kind": "inverter_screenshot"}, tok)
    u = up["uploads"][0]
    boundary = "----e2e"
    body = b"".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in u["fields"].items())
    body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="s.png"\r\nContent-Type: image/png\r\n\r\n'.encode()
    body += screenshot(days) + f"\r\n--{boundary}--\r\n".encode()
    urllib.request.urlopen(urllib.request.Request(u["url"], data=body, method="POST",
                                                  headers={"content-type": f"multipart/form-data; boundary={boundary}"}))
    s, ex = call("POST", f"/sites/{site}/extractions", {"keys": [u["key"]], "kind": "inverter_screenshot"}, tok)
    print("extraction:", s, ex.get("engine"), len(ex.get("rows", [])), "rows", ex.get("warnings"))
    checks.append(("Textract read all 10 days", s == 200 and len(ex.get("rows", [])) == 10))
    s, b = call("PUT", f"/sites/{site}/readings", {"rows": ex.get("rows", []), "source": "screenshot"}, tok)
    s, b = call("POST", f"/sites/{site}/analyses", {}, tok)
    aid, t0 = b.get("analysisId"), time.time()
    while time.time() - t0 < 120:
        s, a = call("GET", f"/sites/{site}/analyses/{aid}", token=tok)
        if a.get("status") != "PENDING":
            break
        time.sleep(3)
    print("analysis:", a.get("status"), a.get("verdict"), a.get("error"))
    checks.append(("analysis finished", a.get("status") == "DONE"))
    s, h = call("GET", f"/sites/{site}/analyses", token=tok)
    checks.append(("history lists it", s == 200 and any(x["analysisId"] == aid for x in h["analyses"])))

    for name, ok in checks:
        print(("PASS " if ok else "FAIL ") + name)
    sys.exit(0 if all(ok for _, ok in checks) else 1)


if __name__ == "__main__":
    main()
