import base64
import os
import uuid
import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from core.deepgram_engine import deepgram_engine
from core.voice_engine import voice_engine as sarvam_engine
from core.ai import honeypot_ai
from core.database import get_db
from models.database import HoneypotPersona, HoneypotSession, HoneypotMessage

logger = logging.getLogger("drishyam.voice")
router = APIRouter(tags=["Voice Chat"])

RECORDINGS_DIR = "static/recordings"
# Get the absolute path to the backend directory
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECORDINGS_PATH = os.path.join(BACKEND_DIR, RECORDINGS_DIR)
os.makedirs(RECORDINGS_PATH, exist_ok=True)

PERSONA_CACHE_TTL_SECONDS = 60
_persona_cache: dict[str, object] = {"expires_at": None, "payload": None}

# ------------------------------------------------------------------
# REQUEST / RESPONSE MODELS
# ------------------------------------------------------------------

class VoiceChatRequest(BaseModel):
    """Request body for a voice chat turn."""
    audio_base64: str
    persona: str = "Elderly Uncle"
    language: str = "hi-IN"
    scammer_transcript: Optional[str] = None
    history: List[Dict[str, str]] = Field(default_factory=list)
    session_id: Optional[str] = None
    engine: str = "deepgram"  # "deepgram" or "sarvam"

class VoiceChatResponse(BaseModel):
    """Response body containing AI's voice reply."""
    scammer_transcript: str
    ai_response_text: str
    ai_audio_base64: str
    audio_format: str
    language: str
    persona: str
    scammer_audio_url: Optional[str] = None
    ai_audio_url: Optional[str] = None

class TTSRequest(BaseModel):
    """Request body for text-to-speech."""
    text: str
    persona: str = "Elderly Uncle"
    engine: str = "deepgram"

class STTRequest(BaseModel):
    """Request body for speech-to-text."""
    audio_base64: str
    language: str = "hi-IN"
    engine: str = "deepgram"

# ------------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------------

def save_audio(audio_bytes: bytes, session_id: str, role: str, audio_format: str = "webm") -> str:
    """Save audio bytes to disk and return the public URL path."""
    extension = (audio_format or "webm").lower().lstrip(".")
    filename = f"{session_id}_{role}_{uuid.uuid4().hex[:6]}.{extension}"
    
    filepath = os.path.join(RECORDINGS_PATH, filename)
    try:
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        logger.info(f"Saved {role} audio level recording to {filepath}")
        return f"/{RECORDINGS_DIR}/{filename}"
    except Exception as e:
        logger.error(f"Failed to save audio recording: {e}")
        return None

# ------------------------------------------------------------------
# VOICE CHAT ENDPOINT
# ------------------------------------------------------------------

@router.post("/chat", response_model=VoiceChatResponse)
async def voice_chat_turn(request: VoiceChatRequest, db: Session = Depends(get_db)):
    """
    Voice Turn: STT -> AI -> TTS + Recording
    Supports engine='deepgram' (default) or engine='sarvam' (Indian languages).
    """
    if not request.audio_base64:
        raise HTTPException(status_code=400, detail="No audio provided")

    engine = sarvam_engine if request.engine == "sarvam" else deepgram_engine
    print(
        f"[VOICE_CHAT] engine={request.engine} persona={request.persona} "
        f"language={request.language} session_id={request.session_id}"
    )
    print(
        f"[VOICE_CHAT] audio_base64_prefix="
        f"{request.audio_base64[:40] if request.audio_base64 else 'NONE'}"
    )
    print(
        f"[VOICE_CHAT] transcript_override_present="
        f"{bool((request.scammer_transcript or '').strip())}"
    )

    try:
        audio_str = request.audio_base64.split(",")[-1]
        audio_bytes = base64.b64decode(audio_str)
        print(f"[VOICE_CHAT] decoded_audio_bytes={len(audio_bytes)}")

        # 1. Run Pipeline
        transcript_override = (request.scammer_transcript or "").strip()
        if transcript_override:
            print(f"[VOICE_CHAT] using browser transcript override={transcript_override[:120]}")
            ai_response_text = await honeypot_ai.generate_response(
                request.persona,
                request.history,
                transcript_override,
            )
            print(f"[VOICE_CHAT] ai_response_text={ai_response_text[:200]}")
            tts_result = await engine.synthesize_speech(ai_response_text, request.persona)
            print(f"[VOICE_CHAT] tts_result_keys={list(tts_result.keys())}")
            print(f"[VOICE_CHAT] tts_audio_length={len(tts_result.get('audio_base64', ''))}")
            print(f"[VOICE_CHAT] tts_format={tts_result.get('format')}")
            result = {
                "scammer_transcript": transcript_override,
                "ai_response_text": ai_response_text,
                "ai_audio_base64": tts_result.get("audio_base64", ""),
                "audio_format": tts_result.get("format", "mp3"),
                "language": request.language,
                "persona": request.persona,
            }
        else:
            result = await engine.voice_chat_turn(
                scammer_audio=audio_bytes,
                persona=request.persona,
                language=request.language,
                ai_generate_fn=honeypot_ai.generate_response,
                history=request.history,
            )
            print(f"[VOICE_CHAT] engine_result_keys={list(result.keys())}")
            print(f"[VOICE_CHAT] scammer_transcript={result.get('scammer_transcript', '')[:200]}")
            print(f"[VOICE_CHAT] ai_response_text={result.get('ai_response_text', '')[:200]}")
            print(f"[VOICE_CHAT] ai_audio_length={len(result.get('ai_audio_base64', ''))}")
            print(f"[VOICE_CHAT] audio_format={result.get('audio_format')}")

        scammer_audio_url = None
        ai_audio_url = None

        # 2. Persistence and Recording
        if request.session_id:
            db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == request.session_id).first()
            if db_session:
                # Save Scammer Audio
                scammer_audio_url = save_audio(audio_bytes, request.session_id, "scammer", "webm")
                
                if result["scammer_transcript"]:
                    scammer_msg = HoneypotMessage(
                        session_id=db_session.id,
                        role="user",
                        content=result["scammer_transcript"],
                        audio_url=scammer_audio_url
                    )
                    db.add(scammer_msg)

                # Save AI Audio
                if result["ai_audio_base64"]:
                    ai_bytes = base64.b64decode(result["ai_audio_base64"])
                    ai_audio_url = save_audio(ai_bytes, request.session_id, "ai", result.get("audio_format", "mp3"))

                ai_msg = HoneypotMessage(
                    session_id=db_session.id,
                    role="assistant",
                    content=result["ai_response_text"],
                    audio_url=ai_audio_url
                )
                db.add(ai_msg)
                db.commit()

        return VoiceChatResponse(
            scammer_transcript=result["scammer_transcript"],
            ai_response_text=result["ai_response_text"],
            ai_audio_base64=result["ai_audio_base64"],
            audio_format=result["audio_format"],
            language=request.language,
            persona=request.persona,
            scammer_audio_url=scammer_audio_url,
            ai_audio_url=ai_audio_url
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[VOICE_CHAT][ERROR] engine={request.engine} error={repr(e)}")
        raise HTTPException(status_code=500, detail=f"Voice pipeline failed ({request.engine}): {str(e)}")

@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech. Supports engine='deepgram' (default) or 'sarvam'."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    engine = sarvam_engine if request.engine == "sarvam" else deepgram_engine
    try:
        return await engine.synthesize_speech(text=request.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")

@router.post("/stt")
async def speech_to_text(request: STTRequest):
    """Convert speech to text. Supports engine='deepgram' (default) or 'sarvam'."""
    if not request.audio_base64:
        raise HTTPException(status_code=400, detail="No audio provided")
    engine = sarvam_engine if request.engine == "sarvam" else deepgram_engine
    try:
        audio_str = request.audio_base64.split(",")[-1]
        audio_bytes = base64.b64decode(audio_str)
        return await engine.transcribe_audio(audio_bytes=audio_bytes, language=request.language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT error: {str(e)}")

@router.get("/personas")
async def list_personas(db: Session = Depends(get_db)):
    cached_payload = _persona_cache.get("payload")
    cached_expires_at = _persona_cache.get("expires_at")
    now = datetime.datetime.utcnow()
    if isinstance(cached_expires_at, datetime.datetime) and cached_payload and cached_expires_at > now:
        return cached_payload

    start_time = datetime.datetime.now()
    personas = db.query(HoneypotPersona).all()
    duration = (datetime.datetime.now() - start_time).total_seconds()
    logger.info(f"[PERF] Personas DB query took {duration:.4f}s")
    if not personas:
        payload = {
            "personas": [
                {"name": "Elderly Uncle", "language": "hi-IN", "speaker": "Male", "pace": 0.85},
                {"name": "Rural Farmer", "language": "hi-IN", "speaker": "Male", "pace": 0.9},
                {"name": "College Student", "language": "en-IN", "speaker": "Male", "pace": 1.05},
                {"name": "Housewife", "language": "hi-IN", "speaker": "Female", "pace": 0.95},
                {"name": "Busy Executive", "language": "en-IN", "speaker": "Female", "pace": 1.0},
            ]
        }
    else:
        payload = {"personas": [{"name": p.name, "language": p.language, "speaker": p.speaker, "pace": p.pace} for p in personas]}

    _persona_cache["payload"] = payload
    _persona_cache["expires_at"] = now + datetime.timedelta(seconds=PERSONA_CACHE_TTL_SECONDS)
    return payload
