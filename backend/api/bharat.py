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
    },
    "mr": {
        "greeting": "Sentinel 1930 हेल्पलाईनमध्ये आपले स्वागत आहे (Marathi).",
        "menu": "1. घोटाळ्याची तक्रार करा\n2. सेंटिनेल स्कोअर तपासा",
        "report_success": "तुमची तक्रार नोंदवली गेली आहे. केस आयडी: {case_id}"
    },
    "pa": {
        "greeting": "Sentinel 1930 ਹੈਲਪਲਾਈਨ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ (Punjabi).",
        "menu": "1. ਘੁਟਾਲੇ ਦੀ ਰਿਪੋਰਟ ਕਰੋ\n2. ਸੈਂਟੀਨਲ ਸਕੋਰ ਦੀ ਜਾਂਚ ਕਰੋ",
        "report_success": "ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਦਰਜ ਕੀਤੀ ਗਈ ਹੈ। ਕੇਸ ID: {case_id}"
    },
    "or": {
        "greeting": "Sentinel 1930 ହେଲ୍ପଲାଇନକୁ ସ୍ୱାଗତ (Odia).",
        "menu": "1. ସ୍କାମ୍ ରିପୋର୍ଟ କରନ୍ତୁ\n2. ସେଣ୍ଟିନେଲ୍ ସ୍କୋର୍ ଯାଞ୍ଚ କରନ୍ତୁ",
        "report_success": "ଆପଣଙ୍କର ରିପୋର୍ଟ ଦାଖଲ ହୋଇଛି | କେସ୍ ID: {case_id}"
    },
    "te": {
        "greeting": "Sentinel 1930 హెల్ప్‌లైన్‌కు స్వాగతం (Telugu).",
        "menu": "1. స్కామ్ రిపోర్ట్ చేయండి\n2. సెంటినెల్ స్కోర్ తనిఖీ చేయండి",
        "report_success": "మీ నివేదిక నమోదైంది. కేస్ ID: {case_id}"
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
