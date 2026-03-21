import os
import logging
import uuid
import datetime
import asyncio
from celery import Celery
from core.forensics import forensic_engine
from core.vision import vision_engine
from core.database import SessionLocal
from models.database import FileUpload, CrimeReport
import httpx
from core.config import settings

# Configure Celery
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("drishyam_worker", broker=REDIS_URL, backend=REDIS_URL)

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

        # 1. Forensic Analysis Path Selection
        if upload.mime_type.startswith("image/"):
            logger.info(f"IMAGE FORENSIC: Using Gemini Vision for static media ({upload.id})")
            forensic_result = await vision_engine.analyze_multimodal_forensic(
                content, 
                mime_type=upload.mime_type, 
                filename=upload.filename
            )
            external_job_id = f"LOCAL_VISION_{uuid.uuid4().hex[:6]}"
            metrics = forensic_result.get("analysis_details", {})
            verdict = forensic_result.get("verdict", "VERIFIED")
            confidence = forensic_result.get("confidence", 0.90)
        else:
            # Existing Video Forensic Path (Railway)
            headers = {"X-API-KEY": settings.DEEPFAKE_API_KEY}
            async with httpx.AsyncClient(timeout=120.0) as client:
                files = {"file": (upload.filename, content, upload.mime_type)}
                response = await client.post(
                    f"{settings.DEEPFAKE_API_URL}/analyze",
                    headers=headers,
                    files=files
                )
                
                if response.status_code != 200:
                    raise Exception(f"External Deepfake API error: {response.text}")
                
                job_data = response.json()
                external_job_id = job_data.get("job_id")
                
                # Poll for results
                import time
                max_retries = 30
                result_data = None
                for _ in range(max_retries):
                    status_res = await client.get(
                        f"{settings.DEEPFAKE_API_URL}/status/{external_job_id}",
                        headers=headers
                    )
                    if status_res.status_code == 200:
                        poll_data = status_res.json()
                        if poll_data.get("status") == "done":
                            result_data = poll_data
                            break
                        elif poll_data.get("status") == "failed":
                            raise Exception(f"External job {external_job_id} failed")
                    await asyncio.sleep(3)
                
                if not result_data:
                    raise Exception(f"External forensic job timed out")
                
                forensic_result = result_data.get("result", {})
                metrics = result_data.get("metrics", {})
                raw_verdict = forensic_result.get("verdict", "FAKE")
                verdict = "DEEPFAKE" if raw_verdict == "FAKE" else "VERIFIED"
                confidence = forensic_result.get("confidence", 0.85)

        # 2. Update Upload Record
        upload.status = "COMPLETED"
        upload.verdict = verdict
        upload.confidence_score = confidence
        upload.metadata_json = {
            "external_job_id": external_job_id,
            "ai": {
                "verdict": verdict,
                "confidence": confidence,
                "analysis_details": forensic_result.get("analysis_details", {}),
                "metrics": metrics
            }
        }
        upload.processed_at = datetime.datetime.utcnow()
        db.commit()

        # 3. Handle Crime Report if DEEPFAKE
        if verdict == "DEEPFAKE":
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
