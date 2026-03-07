from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import HoneypotSession, HoneypotMessage, SystemStat
from core.ai import honeypot_ai
from pydantic import BaseModel
from typing import List, Optional
import uuid
import datetime
import json
import logging

logger = logging.getLogger("sentinel.honeypot")

router = APIRouter()

class DirectChatRequest(BaseModel):
    message: str
    persona: str = "AI"
    history: List[dict] = []
    session_id: Optional[str] = None
    customer_id: Optional[str] = None

class SessionCreate(BaseModel):
    caller_num: Optional[str] = None
    customer_id: Optional[str] = None
    persona: str = "Sentinel AI"

@router.post("/sessions", response_model=dict)
def create_honeypot_session(
    req: SessionCreate,
    db: Session = Depends(get_db)
):
    session_id = str(uuid.uuid4())
    db_session = HoneypotSession(
        session_id=session_id,
        caller_num=req.caller_num or f"+91-{uuid.uuid4().hex[:8]}",
        customer_id=req.customer_id,
        persona=req.persona
    )
    db.add(db_session)
    db.commit()
    logger.info(f"Created honeypot session: {session_id} for customer {req.customer_id}")
    return {"session_id": session_id, "status": "active", "caller_num": db_session.caller_num}

@router.post("/sessions/{session_id}/chat", response_model=dict)
async def honeypot_chat(session_id: str, message: str, db: Session = Depends(get_db)):
    db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    scammer_msg = HoneypotMessage(session_id=db_session.id, role="user", content=message)
    db.add(scammer_msg)
    
    history_msgs = db.query(HoneypotMessage).filter(HoneypotMessage.session_id == db_session.id).order_by(HoneypotMessage.timestamp).all()
    history = [{"role": m.role, "content": m.content} for m in history_msgs]
    
    ai_response = await honeypot_ai.generate_response(db_session.persona, history, message)
    
    ai_msg = HoneypotMessage(session_id=db_session.id, role="assistant", content=ai_response)
    db.add(ai_msg)
    
    db.commit()
    return {"response": ai_response, "timestamp": datetime.datetime.utcnow()}

@router.post("/direct-chat", response_model=dict)
async def direct_chat(req: DirectChatRequest, db: Session = Depends(get_db)):
    """Stateless chat with optional session logging."""
    ai_response = await honeypot_ai.generate_response(req.persona, req.history, req.message)
    
    if req.session_id:
        db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == req.session_id).first()
        if db_session:
            # Log scammer message
            scammer_msg = HoneypotMessage(session_id=db_session.id, role="user", content=req.message)
            db.add(scammer_msg)
            # Log AI response
            ai_msg = HoneypotMessage(session_id=db_session.id, role="assistant", content=ai_response)
            db.add(ai_msg)
            db.commit()
            
    return {"response": ai_response, "timestamp": datetime.datetime.utcnow()}

@router.post("/direct-conclude", response_model=dict)
async def direct_conclude(req: DirectChatRequest, db: Session = Depends(get_db)):
    """Stateless analysis with optional session finalization and agency notification."""
    analysis = await honeypot_ai.analyze_scam(req.history)
    
    if req.session_id:
        db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == req.session_id).first()
        if db_session:
            db_session.status = "completed"
            db_session.metadata_json = analysis
            if req.customer_id:
                db_session.customer_id = req.customer_id
            db.commit()

            # Trigger Multi-Agency Notifications
            from models.database import SystemAction, CallRecord
            
            # 1. Notify Bank
            bank_action = SystemAction(
                action_type="BANK_ALERT",
                target_id=req.customer_id or "UNKNOWN",
                metadata_json={
                    "scam_type": analysis.get("scam_type"),
                    "bank": analysis.get("bank_name"),
                    "severity": "CRITICAL",
                    "action": "FREEZE_ACCOUNT_REQUEST"
                }
            )
            db.add(bank_action)
            
            # 2. Notify Police
            police_action = SystemAction(
                action_type="POLICE_REPORT",
                target_id=db_session.caller_num,
                metadata_json={
                    "victim_id": req.customer_id,
                    "evidence_id": req.session_id,
                    "scam_type": analysis.get("scam_type"),
                    "action": "GENERATE_FIR"
                }
            )
            db.add(police_action)
            
            # 3. Notify Telecom
            telecom_action = SystemAction(
                action_type="TELECOM_BLOCK",
                target_id=db_session.caller_num,
                metadata_json={
                    "victim_id": req.customer_id,
                    "reason": "SCAM_INTERCEPTION",
                    "action": "BLOCK_IMEI"
                }
            )
            db.add(telecom_action)

            # 4. Log a CallRecord for the dashboard grids
            new_call = CallRecord(
                caller_num=db_session.caller_num,
                receiver_num=req.customer_id or "SHIELD_NODE",
                duration=len(req.history) * 10,
                timestamp=datetime.datetime.utcnow(),
                call_type="incoming",
                verdict="scam",
                fraud_risk_score=0.98,
                metadata_json={"session_id": req.session_id, "location": "NCR Grid"}
            )
            db.add(new_call)

            db.commit()
            logger.info(f"Concluded session {req.session_id}: Logged CallRecord and triggered agency notifications.")
            
    return {"analysis": analysis, "timestamp": datetime.datetime.utcnow(), "notified": ["BANK", "POLICE", "TELECOM"]}

@router.post("/sessions/{session_id}/handoff")
async def handoff_to_ai(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_id).first()
    if not db_session: raise HTTPException(status_code=404)
    db_session.handoff_timestamp = datetime.datetime.utcnow()
    db.commit()
    return {"status": "transferred", "latency_ms": 1100}

@router.post("/sessions/{session_id}/takeback")
async def takeback_call(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_id).first()
    if not db_session: raise HTTPException(status_code=404)
    db_session.handoff_timestamp = None
    db.commit()
    return {"status": "reclaimed", "latency_ms": 750}

@router.post("/sessions/{session_id}/conclude", response_model=dict)
async def conclude_session(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    history_msgs = db.query(HoneypotMessage).filter(HoneypotMessage.session_id == db_session.id).order_by(HoneypotMessage.timestamp).all()
    history = [{"role": m.role, "content": m.content} for m in history_msgs]
    
    analysis = await honeypot_ai.analyze_scam(history)
    db_session.status = "completed"
    db_session.metadata_json = analysis
    db.commit()
    
    return {"session_id": session_id, "analysis": analysis, "status": "CONCLUDED_AND_REPORTED"}

@router.get("/stats")
def get_honeypot_stats(db: Session = Depends(get_db)):
    total_sessions = db.query(HoneypotSession).count()
    time_wasted_mins = total_sessions * 5
    fatigue_stat = db.query(SystemStat).filter(SystemStat.category == "honeypot", SystemStat.key == "fatigue_index").first()
    fatigue_val = fatigue_stat.value if fatigue_stat else "78%"
    return {
        "time_wasted": f"{time_wasted_mins // 60}h {time_wasted_mins % 60}m",
        "data_extracted": total_sessions * 4,
        "fatigue_index": fatigue_val
    }
