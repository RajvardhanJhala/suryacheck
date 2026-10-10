"""Vision Lambda: {bucket, key} -> CLIP classification of one photo. Invoked by the api Lambda,
which owns validation, Rekognition corroboration and storage."""
import boto3

from vision.clip import classify_bytes

s3 = boto3.client("s3")


def handler(event, context):
    data = s3.get_object(Bucket=event["bucket"], Key=event["key"])["Body"].read()
    return classify_bytes(data)
