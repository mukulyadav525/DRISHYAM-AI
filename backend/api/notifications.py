from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
import uuid
import datetime

router = APIRouter()

@router.post("/citizen/push-alert")
async def citizen_push_alert(body: dict, db: Session = Depends(get_db)):
    return {
        "alert_id": f"ALT-{uuid.uuid4().hex[:6].upper()}",
        "citizens_notified": 45000,
        "channels_dispatched": ["PUSH", "SMS"],
        "delivery_rate_percent": 98.5
    }

@router.post("/family-trust-circle/alert")
async def family_trust_alert(body: dict, db: Session = Depends(get_db)):
    return {
        "members_notified": 3,
        "notification_ids": [f"NOT-{uuid.uuid4().hex[:4].upper()}" for _ in range(3)],
        "elder_call_intercepted": True,
        "ai_handoff_offered": True,
        "real_family_member_contacted": True,
        "call_blocked": True
    }

@router.post("/sarpanch-network/broadcast")
async def sarpanch_broadcast(body: dict, db: Session = Depends(get_db)):
    return {
        "broadcast_id": f"SAR-{uuid.uuid4().hex[:6].upper()}",
        "sarpanchs_reached": 842,
        "delivery_rate_percent": 99.2,
        "gram_panchayat_pa_triggered": True
    }

@router.post("/citizen/hyper-local-alert")
async def hyper_local_alert(body: dict, db: Session = Depends(get_db)):
    return {
        "alert_id": f"HYP-{uuid.uuid4().hex[:6].upper()}",
        "area_label": "Sector 14, Gurugram",
        "density_map_url": "https://maps.sentinel.gov.in/density/gurugram-s14",
        "incidents_anonymised": True
    }

@router.post("/police/dispatch")
async def police_dispatch(body: dict, db: Session = Depends(get_db)):
    return {
        "notification_id": f"POL-{uuid.uuid4().hex[:6].upper()}",
        "dashboard_updated": True,
        "officer_notified": "PCR-VAN-42"
    }

@router.post("/bank/freeze-alert")
async def bank_freeze_alert(body: dict, db: Session = Depends(get_db)):
    return {
        "freeze_request_id": f"BNK-FRZ-{uuid.uuid4().hex[:6].upper()}",
        "bank_acknowledged": True,
        "npci_notified": True,
        "total_inr_frozen": 45000.0,
        "rupees_saved_this_incident": 45000.0
    }
@router.get("/bank/freeze-status/{incident_id}")
async def get_bank_freeze_status(incident_id: str, db: Session = Depends(get_db)):
    return {
        "total_inr_frozen": 45000.0,
        "rupees_saved_this_incident": 45000.0,
        "status": "frozen",
        "bank_ref": "BNK-648894"
    }

@router.post("/npci/pre-activation-alert")
async def npci_pre_activation_alert(body: dict, db: Session = Depends(get_db)):
    return {
        "npci_alert_id": f"NPCI-{uuid.uuid4().hex[:6].upper()}",
        "bank_notified": True,
        "monitoring_enhanced": True,
        "freeze_triggered_if_first_txn_suspicious": True
    }

@router.post("/jobseeker/mule-warning")
async def jobseeker_mule_warning(body: dict, db: Session = Depends(get_db)):
    return {
        "notification_sent": True,
        "message_preview": "CAUTION: This job involves handling payments for 3rd parties. This is a Mule Scam.",
        "safe_job_portal_redirect": "https://ncs.gov.in",
        "nalsa_legal_info_attached": True
    }
