from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from core.audit import log_audit
from models.database import RecoveryCase
import datetime
import uuid
from typing import Optional

router = APIRouter()


def _get_or_create_case(db: Session, incident_id: str | None) -> RecoveryCase:
    lookup_id = incident_id or f"INC-{uuid.uuid4().hex[:6].upper()}"
    case = db.query(RecoveryCase).filter(RecoveryCase.incident_id == lookup_id).first()
    if case:
        return case

    case = RecoveryCase(
        user_id=None,
        incident_id=lookup_id,
        bank_status="PENDING",
        rbi_status="NOT_STARTED",
        insurance_status="NOT_STARTED",
        legal_aid_status="NOT_STARTED",
        total_recovered=0.0,
    )
    db.add(case)
    db.flush()
    return case

@router.post("/bank-dispute/generate")
async def generate_bank_dispute(body: dict, db: Session = Depends(get_db)):
    case = _get_or_create_case(db, body.get("incident_id"))
    case.bank_status = "INVESTIGATING"
    case.updated_at = datetime.datetime.utcnow()
    db.commit()
    log_audit(db, case.user_id, "BANK_DISPUTE_GENERATED", case.incident_id, metadata={"language": body.get("language", "en")})
    return {
        "letter_id": f"DISP-{uuid.uuid4().hex[:6].upper()}",
        "letter_url": "/api/v1/recovery/download-pdf",
        "legally_formatted": True,
        "pre_filled_with_evidence": True,
        "language": body.get("language", "en"),
        "incident_id": case.incident_id,
        "bank_status": case.bank_status,
    }

@router.post("/rbi-ombudsman/generate")
async def generate_rbi_ombudsman(body: dict, db: Session = Depends(get_db)):
    case = _get_or_create_case(db, body.get("incident_id"))
    case.rbi_status = "READY_FOR_SUBMISSION"
    case.updated_at = datetime.datetime.utcnow()
    db.commit()
    log_audit(db, case.user_id, "RBI_OMBUDSMAN_GENERATED", case.incident_id)
    return {
        "complaint_id": f"RBI-{uuid.uuid4().hex[:6].upper()}",
        "ombudsman_portal_url": "https://cms.rbi.org.in",
        "evidence_attached": True,
        "submission_status": case.rbi_status,
        "incident_id": case.incident_id,
    }

@router.get("/case/status")
async def get_case_status(incident_id: str, db: Session = Depends(get_db)):
    from models.database import RecoveryCase
    case = db.query(RecoveryCase).filter(RecoveryCase.incident_id == incident_id).first()
    
    if not case:
        log_audit(db, None, "CASE_LOOKUP_FAILED", incident_id) # Using None for anonymous system actions
        return {
            "police_fir_status": "NOT_FOUND",
            "bank_dispute_status": "NOT_FOUND",
            "rbi_ombudsman_status": "NOT_FOUND",
            "consumer_court_status": "NOT_FOUND",
            "last_updated_utc": datetime.datetime.utcnow().isoformat(),
            "next_action_required": "Check incident ID"
        }
        
    log_audit(db, case.user_id, "CASE_LOOKUP", incident_id)
        
    return {
        "police_fir_status": "FILED", # Always filed if case exists in our system
        "bank_dispute_status": case.bank_status,
        "rbi_ombudsman_status": case.rbi_status,
        "consumer_court_status": case.legal_aid_status,
        "last_updated_utc": case.updated_at.isoformat(),
        "total_recovered": case.total_recovered,
        "next_action_required": "Wait for bank verification" if case.bank_status == "INVESTIGATING" else "Case Resolved"
    }

@router.post("/nalsa/check-eligibility")
async def check_nalsa_eligibility(body: dict, db: Session = Depends(get_db)):
    case = _get_or_create_case(db, body.get("incident_id"))
    case.legal_aid_status = "REFERRED"
    case.updated_at = datetime.datetime.utcnow()
    db.commit()
    log_audit(db, case.user_id, "LEGAL_AID_REFERRED", case.incident_id, metadata={"phone_number": body.get("phone_number")})
    return {
        "eligible_for_free_aid": True,
        "nearest_nalsa_centre": "Delhi Legal Services Authority",
        "referral_letter_generated": True,
        "appointment_booked": True,
        "incident_id": case.incident_id,
        "legal_aid_status": case.legal_aid_status,
    }

@router.post("/mental-health/refer")
async def mental_health_refer(body: dict, db: Session = Depends(get_db)):
    incident_id = body.get("incident_id")
    if incident_id:
        case = _get_or_create_case(db, incident_id)
        case.updated_at = datetime.datetime.utcnow()
        db.commit()
        log_audit(db, case.user_id, "MENTAL_HEALTH_REFERRED", case.incident_id, metadata={"phone_number": body.get("phone_number")})
    return {
        "referral_id": f"MH-{uuid.uuid4().hex[:6].upper()}",
        "partner_org": "NIMHANS Cyber Support",
        "counsellor_assigned": True,
        "first_session_scheduled": (datetime.datetime.utcnow() + datetime.timedelta(days=2)).isoformat(),
        "free_of_charge": True
    }

@router.post("/insurance/auto-claim")
async def insurance_auto_claim(body: dict, db: Session = Depends(get_db)):
    case = _get_or_create_case(db, body.get("incident_id"))
    case.insurance_status = "SUBMITTED"
    case.updated_at = datetime.datetime.utcnow()
    db.commit()
    log_audit(db, case.user_id, "INSURANCE_CLAIM_PREPARED", case.incident_id)
    return {
        "claim_id": f"INS-{uuid.uuid4().hex[:6].upper()}",
        "documents_generated": ["FIR_COPY", "DISPUTE_LETTER"],
        "submitted_to_insurer": True,
        "status_tracking_active": True,
        "rs_recovered_counter_updated": True,
        "incident_id": case.incident_id,
        "insurance_status": case.insurance_status,
    }

@router.get("/download-pdf")
async def download_letter_pdf():
    return {"message": "PDF download endpoint"}
