from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
import uuid
import logging
import datetime

logger = logging.getLogger("sentinel.bharat")

router = APIRouter()

MENU_LANGUAGES = {
    "hi": {
        "greeting": "Sentinel 1930 Helpline mein aapka swagat hai (Hindi).",
        "menu": "1. Scam report karein\n2. Sentinel Score jaanein",
        "report_success": "Aapki report darj kar li gayi hai. Case ID: {case_id}"
    },
    "en": {
        "greeting": "Welcome to Sentinel 1930 Helpline (English).",
        "menu": "1. Report Scam\n2. Check Sentinel Score",
        "report_success": "Your report has been logged. Case ID: {case_id}"
    },
    "ta": {
        "greeting": "Sentinel 1930 Helpline-ku ​​nalvaravu (Tamil).",
        "menu": "1. Mosadiyaip pugar ali\n2. Sentinel Score",
        "report_success": "Ungal pugar pathivu seyiyappattathu. Case ID: {case_id}"
    }
}

@router.get("/ussd/menu", response_model=dict)
def get_ussd_menu(lang: str = "hi"):
    """T6 requirement: USSD menu in regional languages."""
    content = MENU_LANGUAGES.get(lang, MENU_LANGUAGES["en"])
    return {"text": f"{content['greeting']}\n{content['menu']}"}

@router.post("/ussd/report", response_model=dict)
def report_scam_ussd(phone_number: str, lang: str = "hi"):
    """T6 requirement: Report scam via USSD and receive SMS."""
    case_id = f"USS-{uuid.uuid4().hex[:6].upper()}"
    content = MENU_LANGUAGES.get(lang, MENU_LANGUAGES["hi"])
    
    # Simulate SMS delivery (T6 requirement)
    logger.info(f"SMS SENT: {phone_number} | {content['report_success'].format(case_id=case_id)}")
    
    return {
        "status": "success",
        "case_id": case_id,
        "message": content['report_success'].format(case_id=case_id)
    }

@router.post("/ivr/call", response_model=dict)
def handle_ivr_call(caller_num: str, state_code: str = "TN"):
    """T6 requirement: IVR Lang based on state code."""
    lang = "hi"
    if state_code == "TN": lang = "ta"
    
    content = MENU_LANGUAGES.get(lang, MENU_LANGUAGES["hi"])
    return {
        "audio_url": f"/static/audio/ivr_greeting_{lang}.mp3",
        "transcript": content["greeting"],
        "options": [1, 2, 3],
        "call_id": str(uuid.uuid4())
    }
