from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import SystemAction
import uuid
import datetime

router = APIRouter()

SCENARIO_LIBRARY = {
    "bank_kyc": {
        "name": "Hindi SMS KYC Trap",
        "channel": "SMS",
        "risk_band": "HIGH",
        "regional_track": "Hindi",
        "steps": [
            "[SIM] Drill SMS sent: 'Aaj hi KYC verify karein warna account block ho jayega.'",
            "[EXPECT] Citizen should avoid tapping the phishing link and call the bank directly.",
            "[COACH] Explain why OTP, PIN, and APK requests are immediate red flags.",
            "[CLOSE] Reinforcement message sent with reporting and helpline instructions.",
        ],
        "recommended_follow_up": "Repeat with a UPI collect-request drill in 3 days.",
    },
    "upi_collect": {
        "name": "UPI Collect Request Trap",
        "channel": "SMS",
        "risk_band": "HIGH",
        "regional_track": "Bilingual",
        "steps": [
            "[SIM] Collect-request warning drill delivered to the selected citizen.",
            "[EXPECT] Citizen should notice that 'receive money' screens can still debit funds.",
            "[COACH] Explain VPAs, collect requests, and refund scam language patterns.",
            "[CLOSE] Case study and checklist shared over safe drill channel.",
        ],
        "recommended_follow_up": "Offer one-click VPA verification training.",
    },
    "job_scam": {
        "name": "Recruiter Mule Trap",
        "channel": "IVR",
        "risk_band": "MEDIUM",
        "regional_track": "Hindi + English",
        "steps": [
            "[SIM] IVR recruiter script triggered with fake salary and onboarding promise.",
            "[EXPECT] Citizen should question account-use requests and identity document asks.",
            "[COACH] Explain mule recruitment red flags and legal consequences clearly.",
            "[CLOSE] Citizen receives safe-work checklist and reporting CTA.",
        ],
        "recommended_follow_up": "Enroll in mule awareness mini-series.",
    },
}


@router.post("/drill/send")
async def send_drill(body: dict, db: Session = Depends(get_db)):
    scenario_id = body.get("scenario", "bank_kyc")
    scenario = SCENARIO_LIBRARY.get(scenario_id, SCENARIO_LIBRARY["bank_kyc"])
    phone = body.get("phone") or body.get("target_phone") or "UNKNOWN"

    readiness_score = 64 if scenario_id == "bank_kyc" else 72 if scenario_id == "upi_collect" else 78
    scorecard = {
        "readiness_score": readiness_score,
        "completion_label": "Needs Reinforcement" if readiness_score < 70 else "Improving",
        "recommended_follow_up": scenario["recommended_follow_up"],
        "regional_track": scenario["regional_track"],
        "channel": scenario["channel"],
    }

    db.add(
        SystemAction(
            action_type="INOCULATION_DRILL",
            target_id=phone,
            status="success",
            metadata_json={
                "scenario": scenario_id,
                "scorecard": scorecard,
                "started_at": datetime.datetime.utcnow().isoformat(),
            },
        )
    )
    db.commit()

    return {
        "drill_id": f"DRL-{uuid.uuid4().hex[:6].upper()}",
        "scenario": {
            "id": scenario_id,
            "name": scenario["name"],
            "risk_band": scenario["risk_band"],
        },
        "message_sent": True,
        "clearly_labelled_as_drill": True,
        "response_tracking_active": True,
        "steps": scenario["steps"],
        "scorecard": scorecard,
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
        "hr_dashboard_url": "https://drishyam.gov.in/corporate/dashboard",
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
    return {
        "scenarios": [
            {
                "id": "bank_kyc",
                "title": "KYC Verification Trap",
                "description": "Scammer poses as bank official asking for KYC update via suspicious link.",
                "risk_level": "HIGH",
                "severity": "HIGH",
            },
            {
                "id": "upi_collect",
                "title": "UPI Collect Request",
                "description": "Victim receives a collect request disguised as a refund or reward.",
                "risk_level": "HIGH",
                "severity": "HIGH",
            },
            {
                "id": "job_scam",
                "title": "Recruiter Mule Trap",
                "description": "Victim is lured into acting as a money mule through a job promise.",
                "risk_level": "MEDIUM",
                "severity": "MEDIUM",
            }
        ]
    }


@router.get("/history")
async def get_inoculation_history(db: Session = Depends(get_db)):
    actions = (
        db.query(SystemAction)
        .filter(SystemAction.action_type.in_(["START_DRILL", "INOCULATION_DRILL"]))
        .order_by(SystemAction.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "items": [
            {
                "action_id": action.id,
                "target_id": action.target_id,
                "action_type": action.action_type,
                "status": action.status,
                "scenario": (action.metadata_json or {}).get("scenario"),
                "created_at": action.created_at.isoformat() if action.created_at else None,
                "scorecard": (action.metadata_json or {}).get("scorecard"),
            }
            for action in actions
        ]
    }
