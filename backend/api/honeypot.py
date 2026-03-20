from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.ai import honeypot_ai
from models.database import HoneypotSession, HoneypotMessage
import uuid
import datetime
from typing import Optional, List

router = APIRouter()

@router.post("/session/start")
@router.post("/sessions")
async def start_honeypot_session(body: dict, db: Session = Depends(get_db)):
    session_id = body.get("session_id", f"H-{uuid.uuid4().hex[:6].upper()}")
    persona = body.get("persona", "ELDERLY_UNCLE")
    caller_num = body.get("caller_num", "UNKNOWN")
    customer_id = body.get("customer_id")
    
    # Create session in DB
    new_session = HoneypotSession(
        session_id=session_id,
        caller_num=caller_num,
        customer_id=customer_id,
        persona=persona,
        status="active",
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_session)
    db.commit()
    
    return {
        "session_id": session_id,
        "persona_active": persona,
        "sip_transfer_complete": True,
        "scammer_notified": False
    }

@router.post("/turn")
async def honeypot_turn(body: dict, db: Session = Depends(get_db)):
    session_id = body.get("session_id")
    user_message = body.get("message", "")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    # Fetch session and history
    session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_id).first()
    if not session:
        # Create session on the fly if it doesn't exist (flexible for simulation)
        session = HoneypotSession(
            session_id=session_id,
            persona=body.get("persona", "Elderly Uncle"),
            status="active"
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Convert messages to history format for AI
    history = []
    messages = db.query(HoneypotMessage).filter(HoneypotMessage.session_id == session.id).order_by(HoneypotMessage.timestamp.asc()).all()
    for m in messages:
        history.append({"role": m.role, "content": m.content})

    # Generate real AI response
    ai_response = await honeypot_ai.generate_response(session.persona, history, user_message)
    
    # Log user message
    db.add(HoneypotMessage(session_id=session.id, role="user", content=user_message))
    # Log AI response
    db.add(HoneypotMessage(session_id=session.id, role="assistant", content=ai_response))
    db.commit()
            
    return {
        "ai_response": ai_response,
        "session_id": session_id,
        "persona": session.persona,
        "status": session.status
    }

@router.post("/direct-chat")
async def honeypot_direct_chat(body: dict, db: Session = Depends(get_db)):
    """Simulation App direct chat alias."""
    return await honeypot_turn(body, db)

@router.post("/session/end")
async def end_honeypot_session(body: dict, db: Session = Depends(get_db)):
    session_id = body.get("session_id")
    if session_id:
        session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_id).first()
        if session:
            session.status = "completed"
            db.commit()
    return {
        "session_id": session_id,
        "transcript_id": f"TX-{uuid.uuid4().hex[:6].upper()}",
        "scammer_profile_id": f"PROF-{uuid.uuid4().hex[:6].upper()}",
        "fir_packet_ready": True
    }

@router.post("/direct-conclude")
async def honeypot_direct_conclude(body: dict, db: Session = Depends(get_db)):
    """Simulation App direct conclude alias."""
    return await end_honeypot_session(body, db)

@router.post("/confession-trap/trigger")
async def trigger_confession_trap(body: dict, db: Session = Depends(get_db)):
    return {
        "trap_activated": True,
        "ai_response_trap_variant": "Aap sahi bol rahe hain, main abhi paise bhejta hoon.",
        "admission_probability_score": 0.92,
        "evidence_quality_rating": "STRONG"
    }

@router.post("/whatsapp/session/start")
async def whatsapp_honeypot_start(body: dict, db: Session = Depends(get_db)):
    return {
        "wa_session_id": f"WA-{uuid.uuid4().hex[:6].upper()}",
        "fake_account_created": True,
        "first_message_sent": True,
        "dossier_id": f"DOS-{uuid.uuid4().hex[:6].upper()}"
    }

@router.get("/session/{sid}/fatigue")
async def get_scammer_fatigue(sid: str, db: Session = Depends(get_db)):
    return {
        "minutes_engaged": 45,
        "estimated_calls_prevented": 12,
        "economic_damage_to_network_inr": 15000,
        "session_status": "COMPLETED"
    }

@router.post("/persona/switch-adversarial")
async def switch_persona_adversarial(body: dict, db: Session = Depends(get_db)):
    return {
        "persona_switched": True,
        "new_persona": "SKEPTICAL_YOUTH",
        "detection_risk_score_before": 0.75,
        "detection_risk_score_after": 0.12
    }

@router.get("/sessions")
async def list_honeypot_sessions(db: Session = Depends(get_db)):
    import datetime
    sessions = db.query(HoneypotSession).order_by(HoneypotSession.created_at.desc()).limit(50).all()
    now = datetime.datetime.now(datetime.timezone.utc)
    result = []
    for s in sessions:
        try:
            created = s.created_at
            if created and created.tzinfo is None:
                # Make naive datetime comparable by treating it as UTC
                created = created.replace(tzinfo=datetime.timezone.utc)
            age_sec = (now - created).total_seconds() if created else 0
        except Exception:
            age_sec = 0
        result.append({
            "id": s.session_id,
            "persona": s.persona,
            "caller_num": s.caller_num,
            "direction": s.direction,
            "duration": f"{int(age_sec // 60)}m",
            "status": s.status,
            "user_id": s.user_id,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return result

@router.get("/stats")
async def get_honeypot_stats(db: Session = Depends(get_db)):
    active = db.query(HoneypotSession).filter(HoneypotSession.status == "active").count()
    completed = db.query(HoneypotSession).filter(HoneypotSession.status == "completed").count()
    total = db.query(HoneypotSession).count()
    # Count sessions with auto-generated reports (completed + has analysis)
    analyzed = db.query(HoneypotSession).filter(
        HoneypotSession.recording_analysis_json.isnot(None)
    ).count()
    return {
        "active_sessions": active or 0,
        "completed_sessions": completed or 0,
        "total_sessions": total or 0,
        "scam_reports_generated": analyzed or 0,
    }
