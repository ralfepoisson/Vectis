import json
import os
from datetime import datetime, timezone
from urllib.parse import unquote_plus

import boto3


s3_client = boto3.client("s3")


def handler(event, _context):
    output_prefix = os.environ.get("OUTPUT_PREFIX", "processed/")
    source_prefix = os.environ.get("SOURCE_PREFIX", "raw/")
    processed = []

    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])

        if not key.startswith(source_prefix):
            continue

        metadata = s3_client.head_object(Bucket=bucket, Key=key)
        manifest_key = build_manifest_key(key, output_prefix)
        payload = {
            "bucket": bucket,
            "key": key,
            "size": metadata.get("ContentLength"),
            "contentType": metadata.get("ContentType"),
            "eTag": metadata.get("ETag"),
            "processedAt": datetime.now(timezone.utc).isoformat(),
        }

        s3_client.put_object(
            Bucket=bucket,
            Key=manifest_key,
            Body=json.dumps(payload).encode("utf-8"),
            ContentType="application/json",
        )

        processed.append(payload | {"manifestKey": manifest_key})

    return {"processed": processed}


def build_manifest_key(source_key: str, output_prefix: str) -> str:
    normalized_prefix = output_prefix if output_prefix.endswith("/") else f"{output_prefix}/"
    normalized_source = source_key.replace("/", "_")
    return f"{normalized_prefix}{normalized_source}.json"
