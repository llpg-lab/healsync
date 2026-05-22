import os
import re
from typing import Optional

import requests


def storage_enabled() -> bool:
    return bool(
        os.getenv("SUPABASE_URL")
        and os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        and os.getenv("SUPABASE_STORAGE_BUCKET")
    )


def _safe_path_part(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("_") or "file"


def upload_image_to_supabase(
    *,
    user_id: str,
    request_id: str,
    filename: str,
    content: bytes,
    content_type: str,
) -> Optional[str]:
    if not storage_enabled():
        return None

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "")
    object_path = "/".join(
        [
            _safe_path_part(user_id),
            _safe_path_part(request_id),
            _safe_path_part(filename),
        ]
    )
    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"

    response = requests.post(
        upload_url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=content,
        timeout=30,
    )
    response.raise_for_status()

    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"
