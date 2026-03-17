from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid

router = APIRouter()

@router.post("/impersonation/check")
async def whatsapp_impersonation_check(body: dict, db: Session = Depends(get_db)):
    return {
        "is_impersonator": True,
        "legitimate_brand": "HDFC Bank",
        "confidence": 0.98,
        "meta_report_submitted": True
    }

@router.post("/session/start")
async def whatsapp_session_start(body: dict, db: Session = Depends(get_db)):
    return {
        "wa_session_id": f"WHP-{uuid.uuid4().hex[:6].upper()}",
        "status": "active"
    }
