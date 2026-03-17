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
celery_app = Celery("sentinel_worker", broker=REDIS_URL, backend=REDIS_URL)

logger = logging.getLogger("sentinel.worker")

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

        # 1. Traditional Forensic Extraction
        forensic_data = forensic_engine.extract_metadata(content, upload.filename, upload.mime_type)
        
        # 2. AI Analysis (Multimodal Gemini) - Synchronous wrapper for Celery
        import asyncio
        ai_data = asyncio.run(vision_engine.analyze_multimodal_forensic(
            content, 
            mime_type=upload.mime_type, 
            filename=upload.filename
        ))
        
        # 3. Consolidate Results
        verdict = ai_data.get("verdict", "VERIFIED")
        final_verdict = "REAL" if verdict == "VERIFIED" else "FAKE"
        if len(forensic_data["anomalies"]) > 0 and final_verdict == "REAL":
            final_verdict = "SUSPICIOUS"

        confidence = ai_data.get("confidence", 0.90)
        risk_level = "LOW"
        if final_verdict == "FAKE": risk_level = "HIGH"
        elif final_verdict == "SUSPICIOUS": risk_level = "MEDIUM"

        anomalies = forensic_data["anomalies"]
        if "visual_artifacts" in ai_data.get("analysis_details", {}):
            anomalies.append(ai_data["analysis_details"]["visual_artifacts"])

        # 4. Update Database
        upload.verdict = final_verdict
        upload.confidence_score = confidence
        upload.risk_level = risk_level
        upload.metadata_json = {
            "forensic": forensic_data,
            "ai": ai_data
        }
        upload.status = "COMPLETED"

        # Create Crime Report if Fake
        if final_verdict == "FAKE":
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
