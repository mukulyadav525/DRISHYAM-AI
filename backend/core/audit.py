from sqlalchemy.orm import Session
from models.database import SystemAuditLog
import datetime
import logging

logger = logging.getLogger("drishyam.audit")

def log_audit(
    db: Session, 
    user_id: int, 
    action: str, 
    resource: str = None, 
    ip_address: str = None, 
    metadata: dict = None
):
    """
    [AC-M9-01] Production Compliance: Logs critical system actions to SystemAuditLog.
    """
    try:
        audit_entry = SystemAuditLog(
            user_id=user_id,
            action=action.upper(),
            resource=resource,
            ip_address=ip_address,
            metadata_json=metadata,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        logger.info(f"[AUDIT] {action} by User {user_id} on {resource}")
        return audit_entry
    except Exception as e:
        db.rollback()
        logger.error(f"[AUDIT_FAILED] Error logging action {action}: {e}")
        return None
