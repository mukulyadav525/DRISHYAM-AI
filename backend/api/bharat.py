from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import CrimeReport
import uuid
import logging
import datetime

logger = logging.getLogger("drishyam.bharat")

router = APIRouter()

MENU_LANGUAGES = {
    "hi": {
        "greeting": "DRISHYAM 1930 Helpline mein aapka swagat hai (Hindi).",
        "menu": "1. Scam report karein\n2. DRISHYAM Score jaanein",
        "report_success": "Aapki report darj kar li gayi hai. Case ID: {case_id}"
    },
    "en": {
        "greeting": "Welcome to DRISHYAM 1930 Helpline (English).",
        "menu": "1. Report Scam\n2. Check DRISHYAM Score",
        "report_success": "Your report has been logged. Case ID: {case_id}"
    },
    "ta": {
        "greeting": "DRISHYAM 1930 Helpline-ku ​​nalvaravu (Tamil).",
        "menu": "1. Mosadiyaip pugar ali\n2. DRISHYAM Score",
        "report_success": "Ungal pugar pathivu seyiyappattathu. Case ID: {case_id}"
    },
    "mr": {
        "greeting": "DRISHYAM 1930 हेल्पलाईनमध्ये आपले स्वागत आहे (Marathi).",
        "menu": "1. घोटाळ्याची तक्रार करा\n2. सेंटिनेल स्कोअर तपासा",
        "report_success": "तुमची तक्रार नोंदवली गेली आहे. केस आयडी: {case_id}"
    },
    "pa": {
        "greeting": "DRISHYAM 1930 ਹੈਲਪਲਾਈਨ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ (Punjabi).",
        "menu": "1. ਘੁਟਾਲੇ ਦੀ ਰਿਪੋਰਟ ਕਰੋ\n2. ਸੈਂਟੀਨਲ ਸਕੋਰ ਦੀ ਜਾਂਚ ਕਰੋ",
        "report_success": "ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਦਰਜ ਕੀਤੀ ਗਈ ਹੈ। ਕੇਸ ID: {case_id}"
    },
    "or": {
        "greeting": "DRISHYAM 1930 ହେଲ୍ପଲାଇନକୁ ସ୍ୱାଗତ (Odia).",
        "menu": "1. ସ୍କାମ୍ ରିପୋର୍ଟ କରନ୍ତୁ\n2. ସେଣ୍ଟିନେଲ୍ ସ୍କୋର୍ ଯାଞ୍ଚ କରନ୍ତୁ",
        "report_success": "ଆପଣଙ୍କର ରିପୋର୍ଟ ଦାଖଲ ହୋଇଛି | କେସ୍ ID: {case_id}"
    },
    "te": {
        "greeting": "DRISHYAM 1930 హెల్ప్‌లైన్‌కు స్వాగతం (Telugu).",
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
def report_scam_ussd(phone_number: str, scam_type: str = "General", lang: str = "hi", db: Session = Depends(get_db)):
    """T6 requirement: Report scam via USSD and receive SMS."""
    case_id = f"USS-{uuid.uuid4().hex[:6].upper()}"
    content = MENU_LANGUAGES.get(lang, MENU_LANGUAGES["hi"])
    
    # Save the report to the database so it shows up on the Agency Portal
    new_report = CrimeReport(
        report_id=case_id,
        category="police",
        scam_type=f"USSD: {scam_type}",
        platform="GSM_NETWORK",
        priority="MEDIUM",
        reporter_num=phone_number,
        status="PENDING",
        metadata_json={
            "channel": "USSD",
            "language": lang,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    )
    db.add(new_report)
    db.commit()
    
    # Simulate SMS delivery (T6 requirement)
    logger.info(f"SMS SENT: {phone_number} | {content['report_success'].format(case_id=case_id)}")
    
    return {
        "status": "success",
        "case_id": case_id,
        "message": content['report_success'].format(case_id=case_id)
    }

@router.post("/report/comprehensive", response_model=dict)
def report_scam_comprehensive(
    reporter_num: str,
    category: str,
    scam_type: str,
    amount: str = "0",
    platform: str = "Unknown",
    description: str = "",
    db: Session = Depends(get_db)
):
    """T6 requirement: Comprehensive scam reporting with detailed metadata."""
    case_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
    
    new_report = CrimeReport(
        report_id=case_id,
        category=category,
        scam_type=scam_type,
        amount=amount,
        platform=platform,
        priority="HIGH" if float(amount.replace(',', '')) > 50000 else "MEDIUM",
        reporter_num=reporter_num,
        status="PENDING",
        metadata_json={
            "description": description,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "source": "1930_HELPLINE_WIZARD",
            "section_65b_status": "GENERATED"
        }
    )
    db.add(new_report)
    db.commit()
    
    return {
        "status": "success",
        "case_id": case_id,
        "fir_copy_url": f"/api/bharat/fir/{case_id}",
        "message": f"Incident logged successfully. FIR {case_id} generated."
    }

@router.get("/fir/{case_id}", response_model=dict)
def get_digital_fir(case_id: str, db: Session = Depends(get_db)):
    """Simulate Section 65B Digital FIR retrieval."""
    report = db.query(CrimeReport).filter(CrimeReport.report_id == case_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Case not found")
        
    return {
        "case_id": report.report_id,
        "timestamp": report.created_at.isoformat(),
        "section_65b_certified": True,
        "digital_signature": "DRISHYAM-AI-SECURE-SIG-772",
        "details": {
            "category": report.category,
            "loss": report.amount,
            "platform": report.platform
        }
    }
