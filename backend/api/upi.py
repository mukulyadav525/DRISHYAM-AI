from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid

router = APIRouter()

@router.post("/verify")
async def upi_verify(body: dict, db: Session = Depends(get_db)):
    return {
        "is_flagged": True,
        "risk_level": "HIGH",
        "reason": "Mule account pattern detected",
        "npci_block_ref": f"NPCI-{uuid.uuid4().hex[:6].upper()}"
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
    return {
        "status": "FROZEN",
        "lock_id": f"LCK-{uuid.uuid4().hex[:6].upper()}",
        "value_protected": "₹1.2 Lakh",
        "timestamp": "2024-04-01T12:00:00Z"
    }

@router.post("/scan-message")
async def upi_scan_message(body: dict, db: Session = Depends(get_db)):
    return {
        "is_scam": True,
        "confidence": 0.98,
        "reason": "Deceptive intent: Urgent request for money with suspicious VPA",
        "scam_type": "UPI_COLLECT_FRAUD"
    }

@router.post("/scan-qr")
async def upi_scan_qr(body: dict, db: Session = Depends(get_db)):
    return {
        "is_fraudulent": True,
        "vpa": "scammer@ybl",
        "risk_score": 0.99,
        "warning": "QR Signature mismatch. Malicious overlay detected."
    }

@router.get("/stats")
async def get_upi_stats_module(db: Session = Depends(get_db)):
    return {
        "realtime_checks": 142000,
        "fraudulent_vpas_blocked": 1240,
        "saved_value_today": "₹2.4 Cr",
        "avg_verification_ms": 42
    }
