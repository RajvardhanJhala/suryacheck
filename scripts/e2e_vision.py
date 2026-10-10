"""Live check of the photo classifier: upload real photos to a fresh test site and classify them.

    python scripts/e2e_vision.py ml/data/eval/panel_clean/00.jpg ml/data/eval/meter/05.jpg ...
"""
import json
import sys
import time
import urllib.error
import urllib.request

import boto3

API = {o["OutputKey"]: o["OutputValue"] for o in boto3.client("cloudformation", region_name="ap-south-1")
       .describe_stacks(StackName="suryacheck")["Stacks"][0]["Outputs"]}["ApiUrl"]


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def upload(site, path):
    s, up = call("POST", f"/sites/{site}/uploads", {"tiles": 1, "contentType": "image/jpeg", "kind": "camera"})
    u = up["uploads"][0]
    b = "----v"
    body = b"".join(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in u["fields"].items())
    body += f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="p.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode()
    body += open(path, "rb").read() + f"\r\n--{b}--\r\n".encode()
    urllib.request.urlopen(urllib.request.Request(u["url"], data=body, method="POST",
                                                  headers={"content-type": f"multipart/form-data; boundary={b}"}))
    return u["key"]


def main():
    s, b = call("POST", "/sites", {"lat": 23.03, "lon": 72.58, "capacity_kwp": 3})
    site = b["siteId"]
    for path in sys.argv[1:]:
        t0 = time.time()
        s, r = call("POST", f"/sites/{site}/photos/classify", {"key": upload(site, path)})
        if s != 200:
            print(path, "FAILED", s, r); continue
        cond = f" condition={r['condition']} ({r['condition_probs'][r['condition']]:.2f})" if r.get("condition") else ""
        print(f"{path:38} {time.time() - t0:4.1f}s kind={r['kind']} ({r['kind_probs'][r['kind']]:.2f}){cond} "
              f"| Rekognition solar={r['rekognition']['solar_panels']} labels={r['rekognition']['labels'][:4]}")


if __name__ == "__main__":
    main()
