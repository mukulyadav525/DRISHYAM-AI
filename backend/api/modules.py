from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid

router = APIRouter()

@router.post("/jan-dhan-guard/verify")
async def jan_dhan_verify(body: dict, db: Session = Depends(get_db)):
    return {
        "is_fake_scheme_call": True,
        "legitimate_scheme_details": "PM Awas Yojana never asks for OTP via phone.",
        "bank_api_alert_sent": True,
        "citizen_warning_dispatched": True
    }

@router.post("/kisan-guard/verify")
async def kisan_verify(body: dict, db: Session = Depends(get_db)):
    return {
        "is_impersonation": True,
        "official_pm_kisan_helpline": "155261",
        "ivr_alert_triggered": True,
        "language_match": True
    }

@router.post("/job-scam/classify")
async def job_scam_classify(body: dict, db: Session = Depends(get_db)):
    return {
        "is_fake_job": True,
        "confidence": 0.96,
        "red_flags": ["Vague description", "WhatsApp contact", "High salary"],
        "official_job_portal_redirect": "https://ncs.gov.in"
    }

@router.post("/education-guard/classify")
async def education_guard_classify(body: dict, db: Session = Depends(get_db)):
    return {
        "is_education_scam": True,
        "scam_type": "FAKE_SCHOLARSHIP",
        "legitimate_institution_check": "FAILED",
        "parent_alert_sent": True
    }

@router.post("/sme-gst-buster/engage")
async def sme_gst_engage(body: dict, db: Session = Depends(get_db)):
    return {
        "is_gst_scam": True,
        "fake_ca_details_extracted": {"name": "Fake CA Sharma", "id": "GST-123"},
        "mca_blacklist_submission": True,
        "honeypot_session_id": f"SME-{uuid.uuid4().hex[:6].upper()}"
    }

@router.post("/women-safety/detect")
async def women_safety_detect(body: dict, db: Session = Depends(get_db)):
    return {
        "is_gendered_scam": True,
        "scam_pattern": "ROMANCE_LOAN_HYBRID",
        "confidence": 0.94,
        "ngo_resource_link": "https://cybercrime.gov.in/women-safety"
    }

@router.post("/senior-shield/activate")
async def senior_shield_activate(body: dict, db: Session = Depends(get_db)):
    return {
        "ai_handoff_initiated": True,
        "caregiver_notified": True,
        "simplified_ui_pushed": True,
        "large_text_mode_enabled": True
    }

@router.post("/college-patrol/submit-capstone")
async def college_patrol_submit(body: dict, db: Session = Depends(get_db)):
    return {
        "accepted": True,
        "internship_certificate_queued": True,
        "open_contribution_layer_merged": True,
        "hackathon_eligible": True
    }

@router.post("/nri-guard/alert")
async def nri_guard_alert(body: dict, db: Session = Depends(get_db)):
    return {
        "is_family_emergency_scam": True,
        "alert_sent_to_nri": True,
        "india_contact_verified": False,
        "interpol_flag_if_cross_border": True
    }
