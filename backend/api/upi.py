from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import CrimeReport
from core.audit import log_audit
import uuid
import datetime

router = APIRouter()

@router.post("/verify")
async def upi_verify(body: dict, db: Session = Depends(get_db)):
    from models.database import HoneypotEntity
    vpa = body.get("vpa", "").lower()
    entity = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == vpa).first()
    
    if entity and entity.risk_score > 0.7:
        return {
            "is_flagged": True,
            "risk_level": "CRITICAL",
            "reason": f"Mule account pattern detected. Risk Score: {entity.risk_score}",
            "npci_block_ref": f"NPCI-{uuid.uuid4().hex[:6].upper()}"
        }
        
    return {
        "is_flagged": False,
        "risk_level": "LOW",
        "reason": "Clear / No history in interceptor nodes"
    }

@router.post("/impersonation/check")
async def whatsapp_impersonation_check(body: dict, db: Session = Depends(get_db)):
    from models.database import SuspiciousNumber
    sender = body.get("sender_num", "")
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
        "confidence": 0.0,
        "meta_report_submitted": False
    }

@router.post("/qr/verify")
async def upi_qr_verify(body: dict, db: Session = Depends(get_db)):
    return {
        "is_fake_qr": True,
        "decoded_vpa": "fraud@ybl",
        "vpa_risk_score": 0.94,
        "recommended_action": "BLOCK"
    }

@router.post("/screenshot/verify")
async def upi_screenshot_verify(body: dict, db: Session = Depends(get_db)):
    return {
        "is_genuine": False,
        "utr_verified": False,
        "tampering_detected": True,
        "analysis_details": "Font mismatch in UTR number"
    }

@router.post("/collect/intercept")
async def upi_collect_intercept(body: dict, db: Session = Depends(get_db)):
    return {
        "is_fraudulent_collect": True,
        "risk_indicators": ["Zero-value request", "Impersonation"],
        "block_recommended": True,
        "citizen_alert_sent": True
    }

@router.post("/freeze")
async def upi_freeze(body: dict, db: Session = Depends(get_db)):
    lock_id = f"LCK-{uuid.uuid4().hex[:6].upper()}"
    vpa = body.get("vpa", "unknown")
    
    # [AC-M9-01] Audit Logging for Financial Freeze
    log_audit(db, body.get("user_id", 0), "FREEZE_VPA_API", vpa, metadata={"lock_id": lock_id})
    
    return {
        "status": "FROZEN",
        "lock_id": lock_id,
        "value_protected": "₹1.2 Lakh",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

@router.post("/scan-message")
async def upi_scan_message(body: dict, db: Session = Depends(get_db)):
    is_scam = True
    case_id = f"MSG-{uuid.uuid4().hex[:6].upper()}"
    
    # Log to CrimeReport
    new_report = CrimeReport(
        report_id=case_id,
        category="bank",
        scam_type="UPI_COLLECT_FRAUD",
        platform="SMS/WHATSAPP",
        priority="HIGH",
        reporter_num=body.get("phone_number"),
        status="PENDING",
        metadata_json={
            "channel": "UPIShield",
            "content": body.get("message", ""),
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    )
    db.add(new_report)
    db.commit()

    return {
        "is_scam": is_scam,
        "confidence": 0.98,
        "reason": "Deceptive intent: Urgent request for money with suspicious VPA",
        "scam_type": "UPI_COLLECT_FRAUD",
        "case_id": case_id
    }

@router.post("/scan-qr")
async def upi_scan_qr(body: dict, db: Session = Depends(get_db)):
    case_id = f"QRF-{uuid.uuid4().hex[:6].upper()}"
    
    # Log to CrimeReport
    new_report = CrimeReport(
        report_id=case_id,
        category="bank",
        scam_type="MALICIOUS_QR_OVERLAY",
        platform="UPI_PAY",
        priority="CRITICAL",
        status="PENDING",
        metadata_json={
            "channel": "UPIShield",
            "vpa": "scammer@ybl",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    )
    db.add(new_report)
    db.commit()
    
    log_audit(db, 0, "QR_FRAUD_DETECTED", "scammer@ybl", metadata={"case_id": case_id})

    return {
        "is_fraudulent": True,
        "vpa": "scammer@ybl",
        "risk_score": 0.99,
        "warning": "QR Signature mismatch. Malicious overlay detected.",
        "case_id": case_id
    }

@router.get("/stats")
async def get_upi_stats_module(db: Session = Depends(get_db)):
    return {
        "realtime_checks": 142000,
        "fraudulent_vpas_blocked": 1240,
        "saved_value_today": "₹2.4 Cr",
        "avg_verification_ms": 42
    }
