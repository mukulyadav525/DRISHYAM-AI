from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import SystemAction, SystemStat
from pydantic import BaseModel
import uuid
import logging
import datetime

logger = logging.getLogger("sentinel.upi")

router = APIRouter()

class UPIRequest(BaseModel):
    vpa: str

# T5 requirement: Simulated NPCI Blocklist
BLOCKLIST_VPAS = ["scammer@okaxis", "badactor@ybl", "mule@paytm", "fraud@icici"]

@router.post("/verify", response_model=dict)
async def verify_upi(req: UPIRequest, db: Session = Depends(get_db)):
    """
    T5 requirement: Check VPA against National Blocklist.
    """
    vpa = req.vpa.lower()
    is_blocked = vpa in BLOCKLIST_VPAS
    
    # Log the verification action
    new_action = SystemAction(
        action_type="UPI_VERIFY",
        target_id=vpa,
        metadata_json={"is_blocked": is_blocked},
        status="success"
    )
    db.add(new_action)
    db.commit()
    
    logger.info(f"UPI VERIFY: {vpa} | Blocked: {is_blocked}")
    
    return {
        "vpa": vpa,
        "is_flagged": is_blocked,
        "risk_level": "CRITICAL" if is_blocked else "SAFE",
        "timestamp": datetime.datetime.utcnow()
    }

@router.post("/freeze", response_model=dict)
async def request_upi_freeze(req: UPIRequest, db: Session = Depends(get_db)):
    """
    T5 requirement: Immediate account freezing request.
    """
    vpa = req.vpa.lower()
    # Simulate API call to NPCI/Bank
    logger.info(f"UPI FREEZE: Request sent to NPCI for {vpa}")
    
    # Update Stats
    stat = db.query(SystemStat).filter(SystemStat.category == "upi", SystemStat.key == "frozen_accounts").first()
    if stat:
        stat.value = str(int(stat.value) + 1)
    else:
        db.add(SystemStat(category="upi", key="frozen_accounts", value="1"))
    
    db.commit()
    
    return {
        "status": "FREEZE_INITIATED",
        "case_id": f"UPI-FRZ-{uuid.uuid4().hex[:6].upper()}",
        "vpa": vpa,
        "eta": "Immediate (Real-time)"
    }
