from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import HoneypotSession, HoneypotMessage
import uuid
import datetime
from typing import Optional

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
    
    # Simple Mock AI Response
    ai_response = "Ji beta, main samajh gaya. Bataiye kya karna hai?"
    if "account" in user_message.lower() or "bank" in user_message.lower():
        ai_response = "Theek hai beta, main abhi apni bank details check karke batata hoon."
    
    # Log messages if session exists
    if session_id:
        session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_id).first()
        if session:
            # Log user message
            db.add(HoneypotMessage(session_id=session.id, role="user", content=user_message))
            # Log AI response
            db.add(HoneypotMessage(session_id=session.id, role="assistant", content=ai_response))
            db.commit()
            
    return {
        "ai_response": ai_response,
        "psychological_exploitation_index": 0.85,
        "entities_extracted": {"upi": "scammer@upi", "phone": "9876543210"}
    }

@router.post("/direct-chat")
async def honeypot_direct_chat(body: dict, db: Session = Depends(get_db)):
    """Simulation App direct chat alias."""
    return await honeypot_turn(body, db)

@router.post("/session/end")
async def end_honeypot_session(body: dict, db: Session = Depends(get_db)):
    return {
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
    return [
        {
            "id": "H-124",
            "persona": "ELDERLY_UNCLE",
            "duration": "12m",
            "status": "active",
            "threat_level": "high"
        },
        {
            "id": "H-125",
            "persona": "HELPLESS_GRANDMA",
            "duration": "4m",
            "status": "active",
            "threat_level": "medium"
        }
    ]

@router.get("/stats")
async def get_honeypot_stats(db: Session = Depends(get_db)):
    return {
        "active_sessions": 124,
        "total_engagement_hours": 1450,
        "scammers_attributed": 420,
        "successful_traps": 892
    }
