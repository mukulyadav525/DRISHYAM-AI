from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid

router = APIRouter()

@router.post("/drill/send")
async def send_drill(body: dict, db: Session = Depends(get_db)):
    return {
        "drill_id": f"DRL-{uuid.uuid4().hex[:6].upper()}",
        "message_sent": True,
        "clearly_labelled_as_drill": True,
        "response_tracking_active": True
    }

@router.post("/vulnerability/assess")
async def assess_vulnerability(body: dict, db: Session = Depends(get_db)):
    return {
        "top_scam_risks": ["KYC_SCAM", "LOTTERY_FRAUD"],
        "recommended_drills": ["Gift Card Inoculation"],
        "drill_format": "VOICE_IVR",
        "personalisation_score": 0.88
    }

@router.post("/corporate/enrol")
async def corporate_enrol(body: dict, db: Session = Depends(get_db)):
    return {
        "subscription_id": f"CORP-{uuid.uuid4().hex[:8].upper()}",
        "hr_dashboard_url": "https://sentinel.gov.in/corporate/dashboard",
        "team_vulnerability_score_enabled": True,
        "first_drill_scheduled": True
    }

@router.post("/diksha/publish-course")
async def diksha_publish_course(body: dict, db: Session = Depends(get_db)):
    return {
        "course_published": True,
        "diksha_course_url": "https://diksha.gov.in/cyber-safety-101",
        "states_onboarded": 28,
        "completion_certificate_enabled": True
    }

@router.post("/post-incident/enrol")
async def post_incident_enrol(body: dict, db: Session = Depends(get_db)):
    return {
        "series_id": f"PII-{uuid.uuid4().hex[:6].upper()}",
        "day1_drill_scheduled": True,
        "tailored_to_scam_type": True,
        "counselling_referral_offered": True
    }

@router.get("/scenarios")
async def get_inoculation_scenarios(db: Session = Depends(get_db)):
    return [
        {
            "id": "S-01",
            "title": "KYC Verification Trap",
            "description": "Scammer poses as bank official asking for KYC update via suspicious link.",
            "risk_level": "HIGH"
        },
        {
            "id": "S-02",
            "title": "Lottery Win Tax",
            "description": "Victim told they won a lottery but must pay 'processing tax' via UPI.",
            "risk_level": "MEDIUM"
        }
    ]
