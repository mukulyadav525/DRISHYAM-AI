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
    language: str = "hi"
    history: List[Dict[str, str]] = Field(default_factory=list)
    session_id: Optional[str] = None

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

class STTRequest(BaseModel):
    """Request body for speech-to-text."""
    audio_base64: str
    language: str = "hi"

# ------------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------------

def save_audio(audio_bytes: bytes, session_id: str, role: str) -> str:
    """Save audio bytes to disk and return the public URL path."""
    filename = f"{session_id}_{role}_{uuid.uuid4().hex[:6]}.webm"
    if role == "ai":
        filename = filename.replace(".webm", ".mp3") # Deepgram Aura is MP3
    
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
    Deepgram Voice Turn: STT -> AI -> TTS + Recording
    """
    if not request.audio_base64:
        raise HTTPException(status_code=400, detail="No audio provided")

    try:
        audio_str = request.audio_base64.split(",")[-1]
        audio_bytes = base64.b64decode(audio_str)

        # 1. Run Pipeline
        result = await deepgram_engine.voice_chat_turn(
            scammer_audio=audio_bytes,
            persona=request.persona,
            ai_generate_fn=honeypot_ai.generate_response,
            history=request.history,
        )

        scammer_audio_url = None
        ai_audio_url = None

        # 2. Persistence and Recording
        if request.session_id:
            db_session = db.query(HoneypotSession).filter(HoneypotSession.session_id == request.session_id).first()
            if db_session:
                # Save Scammer Audio
                scammer_audio_url = save_audio(audio_bytes, request.session_id, "scammer")
                
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
                    ai_audio_url = save_audio(ai_bytes, request.session_id, "ai")

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
        raise HTTPException(status_code=500, detail=f"Deepgram pipeline failed: {str(e)}")

@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using Deepgram Aura."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        return await deepgram_engine.synthesize_speech(text=request.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")

@router.post("/stt")
async def speech_to_text(request: STTRequest):
    """Convert speech to text using Deepgram Nova-2."""
    if not request.audio_base64:
        raise HTTPException(status_code=400, detail="No audio provided")
    try:
        audio_str = request.audio_base64.split(",")[-1]
        audio_bytes = base64.b64decode(audio_str)
        return await deepgram_engine.transcribe_audio(audio_bytes=audio_bytes, language=request.language)
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
