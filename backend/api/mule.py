from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.auth import get_current_user
from models.database import User, SystemAction
from pydantic import BaseModel
from typing import List, Optional
import datetime
import uuid
import logging

logger = logging.getLogger("sentinel.mule")

router = APIRouter()

class MuleAdRequest(BaseModel):
    ad_text: str
    source: str = "Telegram"
    lang: str = "en"

MULE_KEYWORDS = {
    "en": ["receive money", "transfer money", "bank account", "part-time", "earn lakhs", "no experience"],
    "hi": ["paisa prapt karein", "transfer karein", "bank khaata", "part-time kaam", "lakhon kamayein"],
    "ta": ["panam petravum", "parimatravum", "vangi kanaku", "part-time velai"]
}

@router.post("/analyze")
async def analyze_mule_ad(
    req: MuleAdRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    T8 requirement: Detect mule recruitment ads with multilingual support.
    """
    score = 0.1
    detected_keywords = []
    
    clean_text = req.ad_text.lower()
    # Check specified lang and English fallback
    langs_to_check = [req.lang, "en"] if req.lang != "en" else ["en"]
    
    for lang in langs_to_check:
        keywords = MULE_KEYWORDS.get(lang, [])
        for kw in keywords:
            if kw in clean_text:
                score += 0.25
                detected_keywords.append(kw)
    
    # Platform risk
    if req.source.lower() in ["telegram", "whatsapp"]:
        score += 0.15
        
    final_score = min(1.0, score)
    verdict = "SAFE"
    if final_score > 0.85:
        verdict = "CRITICAL_MULE_AD"
    elif final_score > 0.5:
        verdict = "SUSPICIOUS_MULE_AD"

    # Log the action (T9 requirement)
    new_action = SystemAction(
        user_id=current_user.id,
        action_type="MULE_AD_INTERCEPT",
        target_id=req.source,
        metadata_json={
            "keywords": list(set(detected_keywords)),
            "score": final_score,
            "verdict": verdict
        },
        status="success"
    )
    db.add(new_action)
    
    if final_score > 0.5:
        from models.database import CrimeReport
        new_report = CrimeReport(
            report_id=f"MLE-{uuid.uuid4().hex[:6].upper()}",
            category="police",
            scam_type="Money Mule Recruitment",
            platform=req.source,
            priority="HIGH" if final_score > 0.8 else "MEDIUM",
            metadata_json={
                "score": final_score,
                "keywords": detected_keywords,
                "ad_sample": req.ad_text[:200]
            }
        )
        db.add(new_report)

    db.commit()
    
    logger.info(f"MULE ANALYZE: Score={final_score} | Keywords={detected_keywords}")
    
    return {
        "is_mule_recruitment": final_score > 0.5,
        "mule_risk_score": final_score,
        "verdict": verdict,
        "detected_keywords": list(set(detected_keywords)),
        "timestamp": datetime.datetime.utcnow()
    }
