"""
API Router for Twilio Voice Calling.
Enables outbound AI-powered phone calls where the Sentinel AI agent
talks to the recipient in real-time.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from core.database import get_db
from core.auth import get_current_user
from core.twilio_engine import twilio_engine
from models.database import User, SystemAction, HoneypotSession
import uuid
import datetime

logger = logging.getLogger("sentinel.twilio_api")

router = APIRouter()


# ------------------------------------------------------------------
# REQUEST / RESPONSE MODELS
# ------------------------------------------------------------------

class InitiateCallRequest(BaseModel):
    """Request body for initiating an outbound call."""
    to_number: str = Field(..., description="Phone number to call (E.164 format, e.g. +919876543210)")
    persona: str = Field("Elderly Uncle", description="AI persona to use during the call")
    session_id: Optional[str] = Field(None, description="Optional honeypot session ID to link this call to")


class EndCallRequest(BaseModel):
    """Request body for ending a call."""
    stream_id: str = Field(..., description="Stream ID of the call to end")


# ------------------------------------------------------------------
# INITIATE OUTBOUND CALL
# ------------------------------------------------------------------

@router.post("/call")
async def initiate_call(
    req: InitiateCallRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Initiate an outbound AI-powered phone call.
    The Sentinel AI persona will talk to the recipient in real-time.
    Requires valid Twilio credentials in environment variables.
    """
    if not twilio_engine.client:
        raise HTTPException(
            status_code=503,
            detail="Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_WEBHOOK_BASE_URL in your .env file.",
        )

    try:
        # Create a honeypot session for this call
        session_id = req.session_id or str(uuid.uuid4())

        db_session = HoneypotSession(
            session_id=session_id,
            caller_num=req.to_number,
            persona=req.persona,
            status="active",
        )
        db.add(db_session)

        # Log the action
        action = SystemAction(
            user_id=current_user.id,
            action_type="TWILIO_OUTBOUND_CALL",
            target_id=req.to_number,
            metadata_json={
                "persona": req.persona,
                "session_id": session_id,
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

        logger.info(f"TWILIO API: Call initiated by {current_user.username} to {req.to_number}")

        return {
            "status": "success",
            "message": f"Call initiated to {req.to_number}",
            "call_sid": call_info["call_sid"],
            "stream_id": call_info["stream_id"],
            "persona": req.persona,
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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


@router.get("/health")
async def twilio_health():
    """Check if Twilio is configured and ready."""
    return {
        "configured": twilio_engine.client is not None,
        "phone_number": twilio_engine.phone_number or "NOT SET",
        "webhook_base_url": twilio_engine.webhook_base_url or "NOT SET",
        "active_calls": len(twilio_engine.active_calls),
    }
