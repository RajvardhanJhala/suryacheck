"""Day-1 risk R1: which Bedrock models can we actually call from ap-south-1, with an image?

    python scripts/check_bedrock.py

Prints every Claude/Nova inference profile and foundation model, then tries one
multimodal Converse call per candidate (a tiny PNG with the number 11.6 drawn as text
is not needed: we only check that image input is accepted and text comes back).
"""
import struct
import sys
import zlib

import boto3
from botocore.exceptions import ClientError

REGION = "ap-south-1"


def tiny_png(w=64, h=32):
    raw = b"".join(b"\x00" + bytes([255, 200, 0] * w) for _ in range(h))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def main():
    br = boto3.client("bedrock", region_name=REGION)
    rt = boto3.client("bedrock-runtime", region_name=REGION)
    candidates = []
    for p in br.list_inference_profiles(maxResults=1000).get("inferenceProfileSummaries", []):
        pid = p["inferenceProfileId"]
        if any(k in pid for k in ("claude", "nova")):
            candidates.append(pid)
    for m in br.list_foundation_models(byInferenceType="ON_DEMAND")["modelSummaries"]:
        if "IMAGE" in m.get("inputModalities", []) and any(k in m["modelId"] for k in ("claude", "nova")):
            candidates.append(m["modelId"])
    print(f"{len(candidates)} candidates in {REGION}")
    ok = []
    for mid in candidates:
        try:
            r = rt.converse(modelId=mid, messages=[{"role": "user", "content": [
                {"image": {"format": "png", "source": {"bytes": tiny_png()}}},
                {"text": "What colour is this image? One word."}]}],
                inferenceConfig={"maxTokens": 10})
            text = r["output"]["message"]["content"][0]["text"].strip()
            print(f"  OK    {mid}  -> {text!r}")
            ok.append(mid)
        except ClientError as e:
            print(f"  FAIL  {mid}  {e.response['Error']['Code']}: {e.response['Error']['Message'][:90]}")
    if not ok:
        sys.exit("No multimodal model is callable. Check Bedrock model access in the console.")
    print("\nPick MODEL_VISION (cheapest OK) and MODEL_AGENT (strongest OK) from the list above.")


if __name__ == "__main__":
    main()
