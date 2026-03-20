import uuid
import datetime
from sqlalchemy.orm import Session
from models.database import NPCILog, HoneypotEntity
import logging

logger = logging.getLogger("drishyam.npci")

class NPCIGateway:
    """
    Simulated NPCI Gateway for VPA verification and blocking.
    Mimics official NPCI Common Library (CL) and Dispute Management System (DMS) behavior.
    """

    @staticmethod
    async def verify_vpa(db: Session, vpa: str) -> dict:
        """
        Simulate VPA verification against NPCI Central Registry.
        """
        vpa_clean = vpa.strip().lower()
        ref_id = f"NPCI-VRF-{str(uuid.uuid4().hex)[:8].upper()}"
        
        # Internal check first (simulating NPCI linked intelligence)
        is_known_scammer = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == vpa_clean).first()
        
        status_code = "00" # Active / Success
        message = "VPA is active and linked to a verified bank account."
        
        if is_known_scammer and is_known_scammer.risk_score > 0.8:
            status_code = "92" # Restricted / Fraud Flagged
            message = "NPCI Common Library Warning: This ID has been flagged for suspicious velocity."
        elif "@" not in vpa_clean:
            status_code = "ZM" # Invalid VPA format
            message = "Invalid VPA handle format."

        # Log to NPCI Gateway logs
        new_log = NPCILog(
            vpa=vpa_clean,
            action="VERIFY",
            status_code=status_code,
            message=message,
            reference_id=ref_id,
            metadata_json={"sim_source": "NPCI_CL_V3"}
        )
        db.add(new_log)
        db.commit()

        return {
            "status_code": status_code,
            "status": "ACTIVE" if status_code == "00" else ("RESTRICTED" if status_code == "92" else "INVALID"),
            "message": message,
            "npci_ref": ref_id,
            "bank_name": "Axis Bank" if "axis" in vpa_clean else "State Bank of India",
            "is_verified_merchant": ".merchant" in vpa_clean
        }

    @staticmethod
    async def execute_hard_block(db: Session, vpa: str, reason: str, case_id: str) -> dict:
        """
        Simulate a Direct Blocking Signal to NPCI.
        """
        vpa_clean = vpa.strip().lower()
        ref_id = f"NPCI-BLK-{str(uuid.uuid4().hex)[:8].upper()}"
        
        status_code = "00" # Block Accepted
        
        # Log the block action
        new_log = NPCILog(
            vpa=vpa_clean,
            action="BLOCK",
            status_code=status_code,
            message=f"Hard Block enforced by DRISHYAM LE-Node. Case: {case_id}",
            reference_id=ref_id,
            metadata_json={
                "reason": reason,
                "origin_case": case_id,
                "protocol": "NPCI_DMS_DIRECT"
            }
        )
        db.add(new_log)
        db.commit()

        return {
            "status": "SUCCESS",
            "npci_ref": ref_id,
            "blocked_at": datetime.datetime.utcnow().isoformat(),
            "propagation_status": "COMPLETED_ALL_PSPS" # Signal sent to PhonePe, GooglePay, etc.
        }

npci_gateway = NPCIGateway()
