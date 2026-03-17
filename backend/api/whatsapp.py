from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid

router = APIRouter()

@router.post("/impersonation/check")
async def whatsapp_impersonation_check(body: dict, db: Session = Depends(get_db)):
    from models.database import SuspiciousNumber
    sender = body.get("sender_num", body.get("phone_number", ""))
    entry = db.query(SuspiciousNumber).filter(SuspiciousNumber.phone_number == sender).first()
    
    if entry:
        return {
            "is_impersonator": True,
            "legitimate_brand": body.get("target_brand", "Unknown"),
            "confidence": entry.reputation_score,
            "meta_report_submitted": True,
            "category": entry.category
        }
        
    return {
        "is_impersonator": False,
        "confidence": 0.1, # Base noise
        "meta_report_submitted": False
    }

@router.post("/session/start")
async def whatsapp_session_start(body: dict, db: Session = Depends(get_db)):
    return {
        "wa_session_id": f"WHP-{uuid.uuid4().hex[:6].upper()}",
        "status": "active"
    }
