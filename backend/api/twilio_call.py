"""
API Router for Twilio Voice Calling.
Enables outbound AI-powered phone calls where the DRISHYAM AI agent
talks to the recipient in real-time.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from core.database import get_db
from core.auth import get_current_user, get_current_verified_user
from core.twilio_engine import twilio_engine
from models.database import User, SystemAction, HoneypotSession
import uuid
import datetime

logger = logging.getLogger("drishyam.twilio_api")

router = APIRouter()


# ------------------------------------------------------------------
# REQUEST / RESPONSE MODELS
# ------------------------------------------------------------------

class InitiateCallRequest(BaseModel):
    """Request body for initiating an outbound call."""
    to_number: str = Field(..., description="Phone number to call (E.164 format, e.g. +919876543210)")
    persona: Optional[str] = Field(None, description="AI persona to use during the call. If None, the AI will adapt dynamically.")
    session_id: Optional[str] = Field(None, description="Optional honeypot session ID to link this call to")
    customer_id: Optional[str] = Field(None, description="Citizen phone number or session identifier")


class HandoffCallRequest(BaseModel):
    """Request body for handing off an active call to the AI."""
    call_sid: str = Field(..., description="The Twilio CallSid to hand off")
    persona: Optional[str] = Field(None, description="Optional persona to start with")



class EndCallRequest(BaseModel):
    """Request body for ending a call."""
    stream_id: str = Field(..., description="Stream ID of the call to end")


class SendSMSRequest(BaseModel):
    """Request body for sending an SMS."""
    to_number: str = Field(..., description="Recipient phone number (E.164)")
    message: str = Field(..., description="Message text")


# ------------------------------------------------------------------
# INITIATE OUTBOUND CALL
# ------------------------------------------------------------------

@router.post("/call")
async def initiate_call(
    req: InitiateCallRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Initiate an outbound AI-powered phone call.
    The DRISHYAM AI persona will talk to the recipient in real-time.
    Authentication is optional to support the Simulation App demo.
    """
    # Try to get user if token exists, but don't fail if missing
    current_user = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from core.auth import get_current_user
            token = auth_header.split(" ")[1]
            current_user = await get_current_user(token, db)
        except:
            pass
    if not twilio_engine.client:
        raise HTTPException(
            status_code=503,
            detail="Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_WEBHOOK_BASE_URL in your .env file.",
        )

    try:
        # Create a honeypot session for this call
        session_id = req.session_id or str(uuid.uuid4())
        db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_id).first()
        if db_session:
            db_session.caller_num = req.to_number
            db_session.customer_id = req.customer_id or db_session.customer_id
            db_session.persona = req.persona or db_session.persona
            db_session.status = "active"
            db_session.direction = "outgoing"
            db_session.metadata_json = {
                **(db_session.metadata_json or {}),
                "live_phone_test": True,
                "twilio_requested_at": datetime.datetime.utcnow().isoformat(),
            }
        else:
            db_session = HoneypotSession(
                session_id=session_id,
                caller_num=req.to_number,
                customer_id=req.customer_id,
                persona=req.persona,
                status="active",
                direction="outgoing",
                metadata_json={
                    "live_phone_test": True,
                    "twilio_requested_at": datetime.datetime.utcnow().isoformat(),
                },
            )
            db.add(db_session)

        # Log the action
        user_id = current_user.id if current_user else None
        action = SystemAction(
            user_id=user_id,
            action_type="TWILIO_OUTBOUND_CALL",
            target_id=req.to_number,
            metadata_json={
                "persona": req.persona,
                "session_id": session_id,
                "customer_id": req.customer_id,
            },
            status="initiated",
        )
        db.add(action)
        db.commit()

        # Initiate the call via Twilio
        call_info = twilio_engine.initiate_call(
            to_number=req.to_number,
            persona=req.persona,
            session_id=session_id,
        )

        user_display = current_user.username if current_user else "Anonymous Simulation"
        logger.info(f"TWILIO API: Call initiated by {user_display} to {req.to_number}")

        return {
            "status": "success",
            "message": f"Call initiated to {req.to_number}",
            "call_sid": call_info["call_sid"],
            "stream_id": call_info["stream_id"],
            "persona": req.persona,
            "session_id": session_id,
        }

    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"TWILIO API: Failed to initiate call: {e}")
        raise HTTPException(status_code=500, detail=f"Call initiation failed: {str(e)}")


# ------------------------------------------------------------------
# TWILIO WEBHOOK (called by Twilio when call connects)
# ------------------------------------------------------------------

@router.post("/webhook")
async def twilio_webhook(request: Request):
    """
    Twilio webhook hit when the outbound call connects.
    Returns TwiML that starts a bidirectional WebSocket media stream.
    """
    params = request.query_params
    stream_id = params.get("stream_id", "unknown")
    persona = params.get("persona", "Elderly Uncle")

    logger.info(f"TWILIO WEBHOOK: Call connected (stream: {stream_id}, persona: {persona})")

    twiml = twilio_engine.generate_twiml_connect(stream_id, persona)
    return Response(content=twiml, media_type="application/xml")


# ------------------------------------------------------------------
# INCOMING CALL HANDLER
# ------------------------------------------------------------------

@router.post("/incoming")
async def twilio_incoming(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Twilio webhook hit when someone calls our Twilio number.
    Creates a session and returns TwiML to connect the call to the AI agent.
    """
    form_data = await request.form()
    from_number = form_data.get("From", "unknown")
    to_number = form_data.get("To", "unknown")
    call_sid = form_data.get("CallSid", "unknown")

    # Generate a unique stream ID for this incoming call
    stream_id = str(uuid.uuid4())
    persona = "Elderly Uncle" # Default persona for incoming calls

    logger.info(f"TWILIO INCOMING: Call from {from_number} to {to_number} (SID: {call_sid})")

    try:
        # Create a honeypot session for this incoming call
        db_session = HoneypotSession(
            session_id=stream_id,
            caller_num=from_number,
            persona=persona,
            status="active",
            direction="incoming",
            metadata_json={"call_sid": call_sid}
        )
        db.add(db_session)

        # Log the action (system-initiated as it's an incoming call)
        action = SystemAction(
            action_type="TWILIO_INCOMING_CALL",
            target_id=from_number,
            metadata_json={
                "persona": persona,
                "session_id": stream_id,
                "call_sid": call_sid,
            },
            status="accepted",
        )
        db.add(action)
        db.commit()

        # Register the call in the engine's active_calls map
        twilio_engine.active_calls[stream_id] = {
            "call_sid": call_sid,
            "stream_id": stream_id,
            "to": to_number,
            "from": from_number,
            "persona": persona,
            "status": "in-progress",
            "history": [],
            "direction": "incoming",
        }

        # Generate TwiML to connect to WebSocket
        twiml = twilio_engine.generate_twiml_connect(stream_id, persona)
        return Response(content=twiml, media_type="application/xml")

    except Exception as e:
        db.rollback()
        logger.error(f"TWILIO INCOMING: Failed to handle call: {e}")
        # Return a polite error message to the caller
        twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">Namaste. Hum abhi vyast hain. Kripya baad mein phone karein.</Say></Response>'
        return Response(content=twiml, media_type="application/xml")


# ------------------------------------------------------------------
# INCOMING SMS HANDLER
# ------------------------------------------------------------------

@router.post("/incoming-sms")
async def twilio_incoming_sms(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Twilio webhook hit when someone sends an SMS to our Twilio number.
    AI generates a response and sends it back via Twilio.
    """
    form_data = await request.form()
    from_number = form_data.get("From", "unknown")
    message_body = form_data.get("Body", "")

    logger.info(f"TWILIO SMS INCOMING: From {from_number}: {message_body}")

    try:
        from core.ai import honeypot_ai
        from core.twilio_engine import twilio_engine

        # AI processes the message
        # We use a default/adaptive persona for inbound texts
        ai_response = await honeypot_ai.generate_response("Elderly Uncle", [], message_body)
        
        # Send AI response back via Twilio
        twilio_engine.send_sms(from_number, ai_response)

        # Log the interaction in the DB
        action = SystemAction(
            action_type="TWILIO_INCOMING_SMS",
            target_id=from_number,
            metadata_json={"received": message_body, "responded": ai_response},
            status="success",
        )
        db.add(action)
        db.commit()

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"TWILIO SMS INCOMING: Failed: {e}")
        return {"status": "error", "detail": str(e)}


# ------------------------------------------------------------------
# CALL HANDOFF (Activate AI during an active call)
# ------------------------------------------------------------------

@router.post("/handoff")
async def call_handoff(
    req: HandoffCallRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """
    User clicks "Let AI Handle" during an active call.
    Redirects the call to our media stream setup.
    """
    if not twilio_engine.client:
        raise HTTPException(status_code=503, detail="Twilio not configured")

    try:
        # Generate a unique stream ID for this handoff
        stream_id = str(uuid.uuid4())
        persona = req.persona or "ADAPTIVE" # Set to adaptive if not specified

        # Get call details from Twilio
        call = twilio_engine.client.calls(req.call_sid).fetch()
        
        # Create a honeypot session for this handoff
        db_session = HoneypotSession(
            session_id=stream_id,
            user_id=current_user.id,
            caller_num=call.from_,
            persona=persona,
            status="active",
            direction="handoff",
            metadata_json={"call_sid": req.call_sid}
        )
        db.add(db_session)

        # Log the action
        action = SystemAction(
            user_id=current_user.id,
            action_type="TWILIO_CALL_HANDOFF",
            target_id=call.from_,
            metadata_json={
                "persona": persona,
                "session_id": stream_id,
                "call_sid": req.call_sid,
            },
            status="success",
        )
        db.add(action)
        db.commit()

        # Register the call in the engine's active_calls map
        twilio_engine.active_calls[stream_id] = {
            "call_sid": req.call_sid,
            "stream_id": stream_id,
            "to": call.to,
            "from": call.from_,
            "persona": persona,
            "status": "in-progress",
            "history": [],
            "direction": "handoff",
            "user_id": current_user.id
        }

        # Redirect the call to our webhook which returns TwiML Connect
        # The webhook expects stream_id and persona in query params
        webhook_url = f"{twilio_engine.webhook_base_url}/api/v1/twilio/webhook?stream_id={stream_id}&persona={persona}"
        
        twilio_engine.client.calls(req.call_sid).update(url=webhook_url, method="POST")

        logger.info(f"TWILIO HANDOFF: Call {req.call_sid} handed off to AI by {current_user.username}")

        return {
            "status": "success",
            "message": "Call handed off to AI agent",
            "stream_id": stream_id,
            "persona": persona
        }

    except Exception as e:
        db.rollback()
        logger.error(f"TWILIO HANDOFF: Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Handoff failed: {str(e)}")




# ------------------------------------------------------------------
# TWILIO CALL STATUS CALLBACK
# ------------------------------------------------------------------

@router.post("/call-status")
async def call_status_callback(request: Request):
    """
    Twilio status callback for call lifecycle events.
    Updates internal call tracking.
    """
    form_data = await request.form()
    call_sid = form_data.get("CallSid", "")
    call_status = form_data.get("CallStatus", "")
    stream_id = request.query_params.get("stream_id", "")

    logger.info(f"TWILIO STATUS: {call_status} (SID: {call_sid}, Stream: {stream_id})")

    # Update our internal tracking
    if stream_id and stream_id in twilio_engine.active_calls:
        twilio_engine.active_calls[stream_id]["status"] = call_status

    return {"status": "ok"}


# ------------------------------------------------------------------
# WEBSOCKET MEDIA STREAM (Twilio streams call audio here)
# ------------------------------------------------------------------

@router.websocket("/media-stream")
async def media_stream_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for Twilio Media Streams.
    Receives real-time audio from the phone call, processes it through
    the AI pipeline (STT → AI → TTS), and sends audio back.
    """
    await websocket.accept()
    logger.info("TWILIO WS: Media stream WebSocket accepted")

    try:
        await twilio_engine.handle_media_stream(websocket)
    except WebSocketDisconnect:
        logger.info("TWILIO WS: Media stream disconnected")
    except Exception as e:
        logger.error(f"TWILIO WS: Unexpected error: {e}")
    finally:
        logger.info("TWILIO WS: Media stream session ended")


# ------------------------------------------------------------------
# CALL MANAGEMENT ENDPOINTS
# ------------------------------------------------------------------

@router.get("/status")
async def get_call_status(
    stream_id: Optional[str] = None,
    current_user: User = Depends(get_current_verified_user),
):
    """
    Get status of active and recent calls.
    If stream_id is provided, returns status for that specific call.
    Otherwise, returns all tracked calls.
    """
    if stream_id:
        call_info = twilio_engine.get_call_status(stream_id)
        if not call_info:
            raise HTTPException(status_code=404, detail="Call not found")
        return call_info

    return {
        "active_calls": twilio_engine.get_all_calls(),
        "total": len(twilio_engine.active_calls),
    }


@router.post("/end")
async def end_call(
    req: EndCallRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Terminate an active call."""
    success = twilio_engine.end_call(req.stream_id)
    if not success:
        raise HTTPException(status_code=404, detail="Call not found or already ended")

    # Log the action
    action = SystemAction(
        user_id=current_user.id,
        action_type="TWILIO_END_CALL",
        target_id=req.stream_id,
        status="success",
    )
    db.add(action)
    db.commit()

    return {"status": "success", "message": f"Call {req.stream_id} terminated"}


@router.post("/sms")
async def send_sms(
    req: SendSMSRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Send a manual SMS via Twilio."""
    success = twilio_engine.send_sms(req.to_number, req.message)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send SMS")

    # Log the action
    action = SystemAction(
        user_id=current_user.id,
        action_type="TWILIO_SEND_SMS",
        target_id=req.to_number,
        metadata_json={"message": req.message},
        status="success",
    )
    db.add(action)
    db.commit()

    return {"status": "success", "message": f"SMS sent to {req.to_number}"}


@router.get("/health")
async def twilio_health():
    """Check if Twilio is configured and ready."""
    return {
        "configured": twilio_engine.client is not None,
        "phone_number": twilio_engine.phone_number or "NOT SET",
        "webhook_base_url": twilio_engine.webhook_base_url or "NOT SET",
        "active_calls": len(twilio_engine.active_calls),
    }
