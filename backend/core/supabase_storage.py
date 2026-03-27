import datetime
import logging
import os
from typing import Any

import httpx

from core.config import settings

logger = logging.getLogger("drishyam.supabase_storage")


def _supabase_token() -> str | None:
    return settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY


def storage_enabled() -> bool:
    return bool(settings.SUPABASE_URL and _supabase_token())


async def upload_forensic_asset(
    *,
    content: bytes,
    filename: str,
    mime_type: str,
    user_id: int | None = None,
    folder: str = "uploads",
) -> dict[str, Any] | None:
    if not storage_enabled():
        logger.warning("Supabase storage upload skipped because storage credentials are not configured.")
        return None

    token = _supabase_token()
    extension = os.path.splitext(filename or "")[1]
    stamp = datetime.datetime.utcnow().strftime("%Y/%m/%d")
    safe_name = os.path.basename(filename or "forensic_asset")
    object_name = f"{folder}/{stamp}/user_{user_id or 'anonymous'}_{datetime.datetime.utcnow().strftime('%H%M%S_%f')}{extension or ''}"
    object_path = object_name if extension else f"{object_name}_{safe_name}"
    url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{settings.FORENSIC_STORAGE_BUCKET}/{object_path}"

    headers = {
        "apikey": token,
        "Authorization": f"Bearer {token}",
        "Content-Type": mime_type or "application/octet-stream",
        "x-upsert": "true",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, content=content)

    if response.status_code not in {200, 201}:
        raise RuntimeError(f"Supabase storage upload failed: {response.status_code} - {response.text}")

    return {
        "bucket": settings.FORENSIC_STORAGE_BUCKET,
        "object_path": object_path,
        "filename": safe_name,
        "mime_type": mime_type,
        "uploaded_at": datetime.datetime.utcnow().isoformat(),
    }

