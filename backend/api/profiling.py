from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import CrimeReport, ScamCluster
import uuid

router = APIRouter()

@router.post("/voice-stress/analyse")
async def analyse_voice_stress(body: dict, db: Session = Depends(get_db)):
    cluster_id = body.get("cluster_id", "CLUSTER")
    seed = sum(ord(char) for char in cluster_id)
    return {
        "stress_score": 20 + seed % 55,
        "script_reading_fatigue": round(((seed % 40) + 5) / 100, 2),
        "shift_change_detected": seed % 2 == 0,
        "operator_consistency": "SAME_OPERATOR"
    }

@router.post("/career-graph/build")
async def build_career_graph(body: dict, db: Session = Depends(get_db)):
    cluster_id = body.get("cluster_id", "CLUSTER")
    seed = sum(ord(char) for char in cluster_id)
    return {
        "profile_id": f"PROF-{uuid.uuid4().hex[:6].upper()}",
        "career_timeline": [
            {"date": "2024-01-01", "role": "FOOT_SOLDIER"},
            {"date": "2024-08-12", "role": "RUNNER"},
            {"date": "2025-03-28", "role": "TEAM_LEAD" if seed % 2 == 0 else "HANDLER"},
        ],
        "hierarchy_level": "TEAM_LEAD" if seed % 2 == 0 else "HANDLER",
        "promotion_detected": True,
        "total_attempts_estimated": 400 + seed % 1600
    }

@router.post("/prosecution/score")
async def get_prosecution_score(body: dict, db: Session = Depends(get_db)):
    cluster_id = body.get("cluster_id", "CLUSTER")
    seed = sum(ord(char) for char in cluster_id)
    return {
        "readiness_score": 60 + seed % 35,
        "court_ready": seed % 5 != 0,
        "gaps": ["Missing cross-border bank logs"] if seed % 5 == 0 else ["Need one more verified victim statement"],
        "economic_damage_inr": 150000 + (seed % 10) * 50000,
        "sentencing_recommendation": "Section 420 IPC + IT Act Sec 66D"
    }

@router.get("/clusters")
async def get_profiling_clusters(db: Session = Depends(get_db)):
    clusters = db.query(ScamCluster).order_by(ScamCluster.honeypot_hits.desc(), ScamCluster.created_at.desc()).limit(8).all()
    if not clusters:
        return [
            {
                "id": "C-01",
                "name": "Mewat-Sighting",
                "size": 142,
                "risk": "CRITICAL",
                "location": "Mewat",
                "linkedVPAs": 142,
                "calls": 48,
                "center": [77.2090, 28.1472],
            },
            {
                "id": "C-02",
                "name": "Jamtara-Cyber",
                "size": 89,
                "risk": "CRITICAL",
                "location": "Jamtara",
                "linkedVPAs": 89,
                "calls": 36,
                "center": [86.6384, 23.9554],
            }
        ]

    return [
        {
            "id": cluster.cluster_id,
            "name": cluster.location or cluster.cluster_id,
            "size": cluster.linked_vpas or 0,
            "risk": cluster.risk_level or "MEDIUM",
            "location": cluster.location or "Unknown",
            "linkedVPAs": cluster.linked_vpas or 0,
            "calls": cluster.honeypot_hits or 0,
            "center": [cluster.lng or 0.0, cluster.lat or 0.0],
        }
        for cluster in clusters
    ]
