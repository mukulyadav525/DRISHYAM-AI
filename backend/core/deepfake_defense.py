import os
from typing import Any

import httpx

from core.config import settings


def _auth_headers() -> dict[str, str]:
    return {"X-API-KEY": settings.DEEPFAKE_API_KEY}


def normalize_verdict(raw_verdict: str | None) -> str:
    verdict = (raw_verdict or "").strip().upper()
    if verdict in {"FAKE", "DEEPFAKE", "SPOOFED", "TAMPERED"}:
        return "FAKE"
    if verdict in {"REAL", "VERIFIED", "AUTHENTIC", "CLEAN"}:
        return "REAL"
    if verdict == "SUSPICIOUS":
        return "SUSPICIOUS"
    return "SUSPICIOUS"


def infer_risk_level(verdict: str) -> str:
    if verdict == "FAKE":
        return "HIGH"
    if verdict == "SUSPICIOUS":
        return "MEDIUM"
    return "LOW"


def coerce_external_status(raw_status: str | None) -> str:
    status = (raw_status or "").strip().lower()
    if status in {"done", "completed", "complete", "success"}:
        return "COMPLETED"
    if status in {"failed", "error"}:
        return "FAILED"
    if status in {"processing", "running", "in_progress"}:
        return "PROCESSING"
    return "PENDING"


async def submit_media_for_analysis(
    *,
    content: bytes,
    filename: str,
    mime_type: str,
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(
            f"{settings.DEEPFAKE_API_URL}/analyze",
            headers=_auth_headers(),
            files={"file": (os.path.basename(filename), content, mime_type)},
        )

    if response.status_code != 200:
        raise RuntimeError(f"Deepfake API error: {response.status_code} - {response.text}")
    return response.json()


async def fetch_job_status(job_id: str, timeout_seconds: float = 10.0) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.get(
            f"{settings.DEEPFAKE_API_URL}/status/{job_id}",
            headers=_auth_headers(),
        )

    if response.status_code != 200:
        raise RuntimeError(f"Deepfake API status error: {response.status_code} - {response.text}")
    return response.json()


def normalize_result_payload(payload: dict[str, Any]) -> dict[str, Any]:
    raw_result = payload.get("result") if isinstance(payload.get("result"), dict) else payload
    verdict = normalize_verdict(raw_result.get("verdict"))
    confidence = raw_result.get("confidence", payload.get("confidence", 0.0))
    analysis_details = raw_result.get("analysis_details", {})
    anomalies = raw_result.get("anomalies") or payload.get("anomalies") or []

    return {
        "verdict": verdict,
        "confidence": confidence,
        "risk_level": raw_result.get("risk_level") or infer_risk_level(verdict),
        "analysis_details": analysis_details,
        "anomalies": anomalies,
        "metrics": payload.get("metrics", {}),
    }

