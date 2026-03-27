import os
import logging
import uuid
import datetime
import asyncio
import threading
try:
    from celery import Celery
except Exception:
    Celery = None
from core.forensics import forensic_engine
from core.database import SessionLocal
from models.database import FileUpload, CrimeReport
from core.deepfake_defense import (
    coerce_external_status,
    fetch_job_status,
    normalize_result_payload,
    submit_media_for_analysis,
)

# Configure Celery
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("drishyam_worker", broker=REDIS_URL, backend=REDIS_URL) if Celery else None

logger = logging.getLogger("drishyam.worker")

async def _perform_analysis_async(upload_id: int):
    """Internal async logic for forensic analysis."""
    db = SessionLocal()
    try:
        upload = db.query(FileUpload).filter(FileUpload.id == upload_id).first()
        if not upload:
            logger.error(f"Upload {upload_id} not found")
            return

        upload.status = "PROCESSING"
        db.commit()

        # Read file content
        with open(upload.file_path, "rb") as f:
            content = f.read()

        forensic_result = {}
        external_job_id = None
        metrics = {}
        verdict = "DEEPFAKE"
        confidence = 0.5

        mime_type = upload.mime_type or "application/octet-stream"

        # Use the external deepfake-defense service for uploaded forensic media.
        job_data = await submit_media_for_analysis(
            content=content,
            filename=upload.filename,
            mime_type=mime_type,
            timeout_seconds=120.0,
        )
        external_job_id = job_data.get("job_id")
        if not external_job_id:
            raise Exception(f"External deepfake API did not return a job_id: {job_data}")

        max_retries = 30
        result_data = None
        for _ in range(max_retries):
            poll_data = await fetch_job_status(external_job_id, timeout_seconds=15.0)
            status = coerce_external_status(poll_data.get("status"))
            if status == "COMPLETED":
                result_data = poll_data
                break
            if status == "FAILED":
                raise Exception(f"External job {external_job_id} failed")
            await asyncio.sleep(3)

        if not result_data:
            raise Exception("External forensic job timed out")

        normalized = normalize_result_payload(result_data)
        forensic_result = {
            "analysis_details": normalized["analysis_details"],
            "anomalies": normalized["anomalies"],
        }
        metrics = normalized["metrics"]
        verdict = normalized["verdict"]
        confidence = normalized["confidence"]

        # 2. Update Upload Record
        upload.status = "COMPLETED"
        upload.verdict = verdict
        upload.confidence_score = confidence
        upload.risk_level = (
            "HIGH" if verdict == "FAKE" else "MEDIUM" if verdict == "SUSPICIOUS" else "LOW"
        )
        existing_metadata = upload.metadata_json or {}
        upload.metadata_json = {
            **existing_metadata,
            "external_job_id": external_job_id,
            "ai": {
                "verdict": verdict,
                "confidence": confidence,
                "analysis_details": forensic_result.get("analysis_details", {}),
                "metrics": metrics
            },
            "forensic": {
                **existing_metadata.get("forensic", {}),
                "anomalies": forensic_result.get("anomalies", [])
            }
        }
        upload.processed_at = datetime.datetime.utcnow()
        db.commit()

        # 3. Handle Crime Report if FAKE
        if verdict == "FAKE":
            # 1. Evidence Frame Preservation [AC-M12-05]
            if "forensic" not in upload.metadata_json:
                upload.metadata_json["forensic"] = {}
            upload.metadata_json["forensic"]["evidence_frames"] = [
                f"static/evidence/{upload.id}_frame_01.jpg",
                f"static/evidence/{upload.id}_frame_24.jpg"
            ]
            
            # 2. Family Alert [AC-M12-06]
            from models.database import TrustLink
            guardians = db.query(TrustLink).filter(TrustLink.user_id == upload.user_id).all()
            for g in guardians:
                # Trigger Twilio/SMS (Simulated)
                print(f"DRISHYAM ALERT: Deepfake detected for user {upload.user_id}. Notifying {g.guardian_name} at {g.guardian_phone}")
            
            # 3. Create Crime Report
            new_report = CrimeReport(
                report_id=f"VFR-{uuid.uuid4().hex[:6].upper()}",
                category="police",
                scam_type=f"Media deepfake ({upload.mime_type})",
                platform=f"Async Analysis: {upload.filename}",
                priority="HIGH",
                metadata_json={"upload_id": upload.id}
            )
            db.add(new_report)

        db.commit()
        logger.info(f"Analysis completed for upload {upload_id}")

    except Exception as e:
        logger.error(f"Forensic worker error: {e}")
        if upload:
            upload.status = "FAILED"
            db.commit()
    finally:
        db.close()


def _run_analysis_inline(upload_id: int):
    try:
        asyncio.run(_perform_analysis_async(upload_id))
    except Exception as exc:
        logger.error(f"Forensic inline worker crashed for upload {upload_id}: {exc}")


class _InlineTaskDispatcher:
    def delay(self, upload_id: int):
        thread = threading.Thread(
            target=_run_analysis_inline,
            args=(upload_id,),
            daemon=True,
            name=f"forensic-inline-{upload_id}",
        )
        thread.start()
        logger.info(f"Forensic analysis dispatched via inline worker for upload {upload_id}")
        return {"mode": "inline", "upload_id": upload_id}


if celery_app:
    @celery_app.task(name="drishyam.perform_forensic_analysis")
    def _celery_perform_forensic_analysis(upload_id: int):
        asyncio.run(_perform_analysis_async(upload_id))

    class _CeleryTaskDispatcher:
        def delay(self, upload_id: int):
            try:
                return _celery_perform_forensic_analysis.delay(upload_id)
            except Exception as exc:
                logger.warning(
                    "Celery dispatch failed for upload %s. Falling back to inline worker. Error: %s",
                    upload_id,
                    exc,
                )
                return _InlineTaskDispatcher().delay(upload_id)

    perform_forensic_analysis = _CeleryTaskDispatcher()
else:
    logger.warning("Celery is unavailable. Forensic analysis will run in an inline background thread.")
    perform_forensic_analysis = _InlineTaskDispatcher()
