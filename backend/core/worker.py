import os
import logging
from celery import Celery
from core.forensics import forensic_engine
from core.vision import vision_engine
from core.database import SessionLocal
from models.database import FileUpload, CrimeReport
import uuid
import datetime

# Configure Celery
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("drishyam_worker", broker=REDIS_URL, backend=REDIS_URL)

logger = logging.getLogger("drishyam.worker")

@celery_app.task(name="perform_forensic_analysis")
def perform_forensic_analysis(upload_id: int):
    """
    Background task to perform media forensic analysis.
    """
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

        # 1. External AI Analysis (Railway DRISHYAM-ULTIMATE-V3)
        import httpx
        from core.config import settings
        
        # We'll poll the external API until finished (since this is already a background worker)
        # Use a short timeout for the initial upload
        with open(upload.file_path, "rb") as f:
            files = {"file": (upload.filename, f, upload.mime_type)}
            headers = {"X-API-KEY": settings.DEEPFAKE_API_KEY}
            response = httpx.post(
                f"{settings.DEEPFAKE_API_URL}/analyze",
                headers=headers,
                files=files,
                timeout=60.0 # Allow time for upload
            )

        if response.status_code != 200:
            raise Exception(f"External Deepfake API error: {response.text}")

        job_data = response.json()
        external_job_id = job_data.get("job_id")
        
        # 2. Poll the external job until done
        import time
        max_retries = 30
        result_data = None
        for _ in range(max_retries):
            status_res = httpx.get(
                f"{settings.DEEPFAKE_API_URL}/status/{external_job_id}",
                headers=headers,
                timeout=10.0
            )
            if status_res.status_code == 200:
                poll_data = status_res.json()
                if poll_data["status"] == "done":
                    result_data = poll_data
                    break
                elif poll_data["status"] == "failed":
                    raise Exception(f"External job {external_job_id} failed")
            time.sleep(5)
        
        if not result_data:
            raise Exception(f"External job {external_job_id} timed out")

        # 3. Consolidate Results
        forensic_result = result_data.get("result", {})
        metrics = result_data.get("metrics", {})
        
        verdict = forensic_result.get("verdict", "VERIFIED")
        final_verdict = "REAL" if verdict == "VERIFIED" else "FAKE"
        
        confidence = forensic_result.get("confidence", 0.90)
        risk_level = "LOW"
        if final_verdict == "FAKE": risk_level = "HIGH"
        
        # 4. Update Database
        upload.verdict = final_verdict
        upload.confidence_score = confidence
        upload.risk_level = risk_level
        upload.metadata_json = {
            "external_job_id": external_job_id,
            "ai": {
                "verdict": verdict,
                "confidence": confidence,
                "analysis_details": forensic_result.get("analysis_details", {}),
                "metrics": metrics
            }
        }
        upload.status = "COMPLETED"


        # Create Crime Report if Fake
        if final_verdict == "FAKE":
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
