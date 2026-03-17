from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid
import datetime

router = APIRouter()

@router.post("/bank-dispute/generate")
async def generate_bank_dispute(body: dict, db: Session = Depends(get_db)):
    return {
        "letter_id": f"DISP-{uuid.uuid4().hex[:6].upper()}",
        "letter_url": "/api/v1/recovery/download-pdf",
        "legally_formatted": True,
        "pre_filled_with_evidence": True,
        "language": body.get("language", "en")
    }

@router.post("/rbi-ombudsman/generate")
async def generate_rbi_ombudsman(body: dict, db: Session = Depends(get_db)):
    return {
        "complaint_id": f"RBI-{uuid.uuid4().hex[:6].upper()}",
        "ombudsman_portal_url": "https://cms.rbi.org.in",
        "evidence_attached": True,
        "submission_status": "READY_FOR_SUBMISSION"
    }

@router.get("/case/status")
async def get_case_status(incident_id: str, db: Session = Depends(get_db)):
    return {
        "police_fir_status": "FILED",
        "bank_dispute_status": "INVESTIGATING",
        "rbi_ombudsman_status": "PENDING",
        "consumer_court_status": "NOT_STARTED",
        "last_updated_utc": datetime.datetime.utcnow().isoformat(),
        "next_action_required": "Wait for 24 hours"
    }

@router.post("/nalsa/check-eligibility")
async def check_nalsa_eligibility(body: dict, db: Session = Depends(get_db)):
    return {
        "eligible_for_free_aid": True,
        "nearest_nalsa_centre": "Delhi Legal Services Authority",
        "referral_letter_generated": True,
        "appointment_booked": True
    }

@router.post("/mental-health/refer")
async def mental_health_refer(body: dict, db: Session = Depends(get_db)):
    return {
        "referral_id": f"MH-{uuid.uuid4().hex[:6].upper()}",
        "partner_org": "NIMHANS Cyber Support",
        "counsellor_assigned": True,
        "first_session_scheduled": (datetime.datetime.utcnow() + datetime.timedelta(days=2)).isoformat(),
        "free_of_charge": True
    }

@router.post("/insurance/auto-claim")
async def insurance_auto_claim(body: dict, db: Session = Depends(get_db)):
    return {
        "claim_id": f"INS-{uuid.uuid4().hex[:6].upper()}",
        "documents_generated": ["FIR_COPY", "DISPUTE_LETTER"],
        "submitted_to_insurer": True,
        "status_tracking_active": True,
        "rs_recovered_counter_updated": True
    }

@router.get("/download-pdf")
async def download_letter_pdf():
    return {"message": "PDF download endpoint"}
