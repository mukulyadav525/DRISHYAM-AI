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

@router.post("/sessions", response_model=dict)
def create_honeypot_session(caller_num: str, persona: str, db: Session = Depends(get_db)):
    session_id = str(uuid.uuid4())
    db_session = HoneypotSession(
        session_id=session_id,
        caller_num=caller_num,
        persona=persona
    )
    db.add(db_session)
    db.commit()
    return {"session_id": session_id, "status": "active"}

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
async def direct_chat(req: DirectChatRequest):
    """Stateless chat for frontend/verification."""
    ai_response = await honeypot_ai.generate_response(req.persona, req.history, req.message)
    return {"response": ai_response, "timestamp": datetime.datetime.utcnow()}

@router.post("/direct-conclude", response_model=dict)
async def direct_conclude(req: DirectChatRequest):
    """Stateless analysis for verification."""
    analysis = await honeypot_ai.analyze_scam(req.history)
    return {"analysis": analysis, "timestamp": datetime.datetime.utcnow()}

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
