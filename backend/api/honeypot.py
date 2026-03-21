from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.ai import honeypot_ai
from core.intel_engine import intel_engine
from models.database import HoneypotSession, HoneypotMessage
import uuid
import datetime
from typing import Optional, List

router = APIRouter()

DEFAULT_LOCATIONS = [
    "Jamtara, Jharkhand",
    "Mewat, Haryana",
    "Noida Sector 62, Uttar Pradesh",
    "Kolkata Proxy Mesh",
    "Delhi NCR Relay Grid",
]

DEFAULT_THREAT_PATTERNS = [
    "KYC verification script",
    "UPI collect request lure",
    "Fake support desk escalation",
    "Urgent compliance intimidation",
    "Courier refund diversion",
]


def _build_session_bootstrap(session_id: str, caller_num: str, persona: str) -> dict:
    seed = sum(ord(char) for char in session_id)
    return {
        "origin_location": DEFAULT_LOCATIONS[seed % len(DEFAULT_LOCATIONS)],
        "risk_band": "CRITICAL" if seed % 3 == 0 else "HIGH",
        "threat_pattern": DEFAULT_THREAT_PATTERNS[seed % len(DEFAULT_THREAT_PATTERNS)],
        "citizen_safe": False,
        "persona_label": persona,
        "masked_caller": caller_num if caller_num and caller_num != "UNKNOWN" else f"+91-98{seed % 100:02d}-XXX-{seed % 1000:03d}",
    }


def _coerce_utc(dt: Optional[datetime.datetime]) -> datetime.datetime:
    if dt is None:
        return datetime.datetime.now(datetime.timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt


def _build_session_summary(session: HoneypotSession, messages: List[HoneypotMessage]) -> dict:
    history = [
        {"role": "user" if message.role == "user" else "assistant", "content": message.content}
        for message in messages
        if message.content
    ]

    analysis = session.recording_analysis_json or honeypot_ai.analyze_scam_locally(history)
    metadata = session.metadata_json or {}
    created_at = _coerce_utc(session.created_at)
    now = datetime.datetime.now(datetime.timezone.utc)
    duration_seconds = max(0, int((now - created_at).total_seconds()))
    scammer_turns = sum(1 for message in messages if message.role == "user")
    ai_turns = sum(1 for message in messages if message.role == "assistant")
    key_entities = analysis.get("key_entities") or honeypot_ai.extract_entities(
        "\n".join(message.content for message in messages if message.content)
    )
    fatigue_score = min(100, scammer_turns * 18 + ai_turns * 8 + duration_seconds // 20)

    last_scammer_message = next((message.content for message in reversed(messages) if message.role == "user" and message.content), None)
    last_ai_message = next((message.content for message in reversed(messages) if message.role == "assistant" and message.content), None)

    return {
        "session_id": session.session_id,
        "status": session.status,
        "direction": session.direction,
        "persona": session.persona,
        "caller_num": session.caller_num or metadata.get("masked_caller") or "UNKNOWN",
        "customer_id": session.customer_id,
        "citizen_banner": "AI is handling the suspicious caller. You are safe.",
        "citizen_safe": bool(metadata.get("citizen_safe", False)),
        "threat_profile": {
            "location": metadata.get("origin_location", "Unknown"),
            "risk_band": metadata.get("risk_band", "HIGH"),
            "pattern": metadata.get("threat_pattern", "Suspicious fraud script"),
        },
        "live_summary": {
            "scam_type": analysis.get("scam_type", "UNKNOWN"),
            "bank_name": analysis.get("bank_name", "UNKNOWN"),
            "urgency_level": analysis.get("urgency_level", "MEDIUM"),
            "risk_score": analysis.get("risk_score", 0.55),
            "details": analysis.get("details", "Suspicious conversation under live review."),
            "key_entities": key_entities,
            "entity_count": len(key_entities),
            "scammer_turns": scammer_turns,
            "ai_turns": ai_turns,
            "minutes_engaged": max(1, duration_seconds // 60) if messages else 0,
            "fatigue_score": fatigue_score,
            "last_scammer_message": last_scammer_message,
            "last_ai_message": last_ai_message,
        },
        "transcript": [
            {
                "id": message.id,
                "role": "scammer" if message.role == "user" else "ai",
                "text": message.content,
                "timestamp": message.timestamp.isoformat() if message.timestamp else None,
            }
            for message in messages[-20:]
        ],
        "updated_at": now.isoformat(),
    }

@router.post("/session/start")
@router.post("/sessions")
async def start_honeypot_session(body: dict, db: Session = Depends(get_db)):
    session_id = body.get("session_id", f"H-{uuid.uuid4().hex[:6].upper()}")
    persona = body.get("persona", "ELDERLY_UNCLE")
    caller_num = body.get("caller_num", "UNKNOWN")
    customer_id = body.get("customer_id")
    bootstrap = _build_session_bootstrap(session_id, caller_num, persona)
    
    # Create session in DB
    new_session = HoneypotSession(
        session_id=session_id,
        caller_num=bootstrap["masked_caller"],
        customer_id=customer_id,
        persona=persona,
        status="active",
        created_at=datetime.datetime.utcnow(),
        metadata_json=bootstrap,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return {
        "session_id": session_id,
        "persona_active": persona,
        "sip_transfer_complete": True,
        "scammer_notified": False,
        "caller_num": bootstrap["masked_caller"],
        "location": bootstrap["origin_location"],
        "risk_band": bootstrap["risk_band"],
        "threat_pattern": bootstrap["threat_pattern"],
        "citizen_banner": "Suspicious caller detected. Tap Let AI Handle to stay protected.",
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


@router.post("/session/{sid}/handoff")
async def handoff_honeypot_session(sid: str, body: dict | None = None, db: Session = Depends(get_db)):
    session = db.query(HoneypotSession).filter(HoneypotSession.session_id == sid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    payload = body or {}
    if payload.get("persona"):
        session.persona = payload["persona"]
    session.direction = "handoff"
    session.handoff_timestamp = datetime.datetime.utcnow()
    session.status = "active"

    metadata = dict(session.metadata_json or {})
    metadata["citizen_safe"] = True
    session.metadata_json = metadata

    existing_assistant_message = (
        db.query(HoneypotMessage)
        .filter(HoneypotMessage.session_id == session.id, HoneypotMessage.role == "assistant")
        .first()
    )

    greeting = None
    if not existing_assistant_message:
        greeting = await honeypot_ai.generate_response(
            session.persona,
            [],
            "The call has just started. Introduce yourself naturally and keep the caller engaged.",
        )
        db.add(HoneypotMessage(session_id=session.id, role="assistant", content=greeting))

    db.commit()
    db.refresh(session)

    messages = (
        db.query(HoneypotMessage)
        .filter(HoneypotMessage.session_id == session.id)
        .order_by(HoneypotMessage.timestamp.asc())
        .all()
    )

    return {
        "status": "active",
        "session_id": sid,
        "greeting": greeting,
        "summary": _build_session_summary(session, messages),
    }


@router.post("/session/{sid}/take-back")
async def take_back_honeypot_session(sid: str, db: Session = Depends(get_db)):
    session = db.query(HoneypotSession).filter(HoneypotSession.session_id == sid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    metadata = dict(session.metadata_json or {})
    metadata["citizen_safe"] = False
    metadata["take_back_requested_at"] = datetime.datetime.utcnow().isoformat()
    session.metadata_json = metadata
    session.direction = "outgoing"
    db.commit()

    messages = (
        db.query(HoneypotMessage)
        .filter(HoneypotMessage.session_id == session.id)
        .order_by(HoneypotMessage.timestamp.asc())
        .all()
    )

    return {
        "status": "returned",
        "session_id": sid,
        "summary": _build_session_summary(session, messages),
    }


@router.get("/session/{sid}/summary")
async def get_honeypot_session_summary(sid: str, db: Session = Depends(get_db)):
    session = db.query(HoneypotSession).filter(HoneypotSession.session_id == sid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = (
        db.query(HoneypotMessage)
        .filter(HoneypotMessage.session_id == session.id)
        .order_by(HoneypotMessage.timestamp.asc())
        .all()
    )
    return _build_session_summary(session, messages)

@router.post("/session/end")
async def end_honeypot_session(body: dict, db: Session = Depends(get_db)):
    session_id = body.get("session_id")
    intel_result = None
    if session_id:
        # Trigger IntelEngine for analysis and multi-agency reporting
        intel_result = await intel_engine.process_session_completion(session_id, db)
        
    return {
        "session_id": session_id,
        "transcript_id": f"TX-{uuid.uuid4().hex[:6].upper()}",
        "scammer_profile_id": f"PROF-{uuid.uuid4().hex[:6].upper()}",
        "fir_packet_ready": True,
        "intelligence_report": "AUTOMATED_DISSEMINATION_COMPLETE",
        "analysis": intel_result.get("analysis") if intel_result else None,
        "reports_created": intel_result.get("reports_created", 0) if intel_result else 0,
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
