from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid

router = APIRouter()

@router.post("/voice-stress/analyse")
async def analyse_voice_stress(body: dict, db: Session = Depends(get_db)):
    return {
        "stress_score": 12,
        "script_reading_fatigue": 0.05,
        "shift_change_detected": False,
        "operator_consistency": "SAME_OPERATOR"
    }

@router.post("/career-graph/build")
async def build_career_graph(body: dict, db: Session = Depends(get_db)):
    return {
        "profile_id": f"PROF-{uuid.uuid4().hex[:6].upper()}",
        "career_timeline": [{"date": "2024-01-01", "role": "FOOT_SOLDIER"}],
        "hierarchy_level": "TEAM_LEAD",
        "promotion_detected": True,
        "total_attempts_estimated": 1240
    }

@router.post("/prosecution/score")
async def get_prosecution_score(body: dict, db: Session = Depends(get_db)):
    return {
        "readiness_score": 85,
        "court_ready": True,
        "gaps": ["Missing cross-border bank logs"],
        "economic_damage_inr": 450000,
        "sentencing_recommendation": "Section 420 IPC + IT Act Sec 66D"
    }

@router.get("/clusters")
async def get_profiling_clusters(db: Session = Depends(get_db)):
    return [
        {
            "id": "C-01",
            "name": "Mewat-Sighting",
            "size": 142,
            "risk": 0.92,
            "center": [77.2090, 28.1472]
        },
        {
            "id": "C-02",
            "name": "Jamtara-Cyber",
            "size": 89,
            "risk": 0.98,
            "center": [86.6384, 23.9554]
        }
    ]
