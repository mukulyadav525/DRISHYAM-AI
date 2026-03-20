from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid
import datetime

router = APIRouter()

@router.post("/drishyam-score/compute")
async def compute_drishyam_score(body: dict, db: Session = Depends(get_db)):
    return {
        "score": 88,
        "decile_band": 9,
        "computed_locally": True,
        "central_storage": False,
        "badge": "GOLD_SHIELD"
    }

@router.post("/habit-breaker/enrol")
async def habit_breaker_enrol(body: dict, db: Session = Depends(get_db)):
    return {
        "enrolment_id": f"HAB-{uuid.uuid4().hex[:6].upper()}",
        "day1_message_scheduled": True,
        "gamification_score_initialised": True,
        "npci_reward_linked": True
    }

@router.post("/profile")
async def get_citizen_profile(body: dict, db: Session = Depends(get_db)):
    return {
        "citizen_id": body.get("citizen_id", "ANON"),
        "risk_level": "LOW",
        "last_drill_completed": datetime.datetime.utcnow().isoformat()
    }
