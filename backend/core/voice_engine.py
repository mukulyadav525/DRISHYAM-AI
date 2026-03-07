"""
Sentinel 1930 – Sarvam AI Voice Engine.
Real-time Speech-to-Text (STT) and Text-to-Speech (TTS)
for the AI Honeypot system using Sarvam AI's Indian-language APIs.
Production only — no mocks.

Models:
  - STT: Saaras v2 (22 Indian languages + English)
  - TTS: Bulbul v2 (11 Indian languages, 7 speaker voices)
"""

import base64
import logging
import httpx
from typing import Dict, Any
from core.config import settings

logger = logging.getLogger("sentinel.voice")

SARVAM_BASE_URL = "https://api.sarvam.ai"


class SarvamVoiceEngine:
    """Real-time voice pipeline using Sarvam AI APIs."""

    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        if not self.api_key:
            logger.warning("VOICE ENGINE: SARVAM_API_KEY not set. Voice features will fail at runtime.")
        else:
            logger.info(f"VOICE ENGINE: Sarvam AI ready (key: {self.api_key[:8]}...).")

        self.default_voice = {
            "speaker": "karun",
            "language": "hi-IN",
            "model": "bulbul:v2",
            "pace": "0.9",
        }
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        """Close the persistent HTTP client."""
        await self.client.aclose()

    # ─── Speech-to-Text (STT) ────────────────────────────────────────
    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        language: str = "hi-IN",
        model: str = "saaras:v3",
    ) -> Dict[str, Any]:
        """Transcribe scammer's voice to text via Sarvam Saaras."""
        
        import asyncio
        import io
        
        logger.info(f"STT: Processing {len(audio_bytes)} bytes of audio")
        if len(audio_bytes) < 100:
            return {"transcript": "", "language_detected": language, "confidence": 0.0}

        wav_bytes = None
        audio_content_type = "audio/wav"
        audio_filename = "audio.wav"

        try:
            # Transcode WebM to WAV in-memory using ffmpeg and pipes
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-hide_banner", "-loglevel", "error", 
                "-i", "pipe:0", "-f", "wav", "-ar", "16000", "-ac", "1", "pipe:1",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate(input=audio_bytes)
            
            if process.returncode != 0:
                logger.error(f"STT: FFMPEG failed with rc {process.returncode}")
                if stderr: logger.error(f"FFMPEG stderr: {stderr.decode()}")
                wav_bytes = None  # Will use raw fallback
            else:
                wav_bytes = stdout
                logger.info(f"STT: Transcoded {len(audio_bytes)}b -> {len(wav_bytes)}b in-memory")
        except FileNotFoundError:
            logger.warning("STT: ffmpeg not found, sending raw audio to Sarvam")
            wav_bytes = None
        except Exception as e:
            logger.error(f"STT: In-memory conversion failed: {e}")
            wav_bytes = None

        # If ffmpeg transcoding failed, try raw webm
        if wav_bytes is None:
            wav_bytes = audio_bytes
            audio_content_type = "audio/webm"
            audio_filename = "audio.webm"
            logger.info("STT: Using raw webm audio as fallback")

        # Upload to Sarvam saaras using persistent client
        # NOTE: Speech endpoints are NOT under /v1/
        try:
            response = await self.client.post(
                f"{SARVAM_BASE_URL}/speech-to-text",
                headers={
                    "api-subscription-key": self.api_key,
                },
                files={
                    "file": (audio_filename, wav_bytes, audio_content_type)
                },
                data={
                    "language_code": language,
                    "model": model,
                },
            )
            if response.status_code != 200:
                logger.error(f"STT API Error ({response.status_code}): {response.text}")
                response.raise_for_status()
                
            data = response.json()

            transcript = data.get("transcript", "")
            lang = language
            logger.info(f"STT: Transcribed [{lang}]: {transcript[:60]}...")
            return {
                "transcript": transcript,
                "language_detected": lang,
                "confidence": 1.0,
            }
        except Exception as e:
            logger.error(f"STT: Transcription API failed: {e}")
            return {
                "transcript": "",
                "language_detected": language,
                "confidence": 0.0,
            }

    # ─── Text-to-Speech (TTS) ────────────────────────────────────────
    async def synthesize_speech(
        self,
        text: str,
        persona: str = "Elderly Uncle",
    ) -> Dict[str, Any]:
        """Convert AI response to natural Indian-language speech via Sarvam Bulbul."""
        voice_config = self.default_voice

        try:
            # NOTE: Speech endpoints are NOT under /v1/
            response = await self.client.post(
                f"{SARVAM_BASE_URL}/text-to-speech",
                headers={
                    "api-subscription-key": self.api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "inputs": [text],
                    "target_language_code": voice_config["language"],
                    "speaker": voice_config["speaker"],
                    "model": voice_config["model"],
                    "pitch": 0,
                    "pace": float(voice_config["pace"]),
                    "loudness": 1.5,
                    "enable_preprocessing": True,
                },
            )
            if response.status_code != 200:
                logger.error(f"TTS API Error ({response.status_code}): {response.text}")
                response.raise_for_status()
                
            data = response.json()

            audios = data.get("audios", [])
            audio_base64 = audios[0] if audios else ""
            logger.info(f"TTS: Synthesized {len(audio_base64)} chars for '{persona}'")

            return {
                "audio_base64": audio_base64,
                "format": "wav",
                "persona": persona,
                "language": voice_config["language"],
                "duration_ms": data.get("duration_ms", 0),
            }
        except Exception as e:
            logger.error(f"TTS Error: {e}")
            if hasattr(e, 'response'):
                logger.error(f"TTS Error Detail: {e.response.text}")
            
            # Return empty audio fallback instead of crashing
            return {
                "audio_base64": "",
                "format": "wav",
                "persona": persona,
                "language": voice_config["language"],
                "duration_ms": 0,
            }

    # ─── Full Voice Chat Pipeline ────────────────────────────────────
    async def voice_chat_turn(
        self,
        scammer_audio: bytes,
        persona: str,
        ai_generate_fn,
        history: list,
    ) -> Dict[str, Any]:
        """
        Complete voice chat turn:
        1. STT: Transcribe scammer audio → text
        2. AI: Generate honeypot response (Gemini)
        3. TTS: Convert AI response → speech
        """
        stt_result = await self.transcribe_audio(scammer_audio)
        scammer_text = stt_result["transcript"]
        logger.info(f"SCAMMER SAID: {scammer_text}")

        ai_response_text = await ai_generate_fn(persona, history, scammer_text)
        logger.info(f"AI RESPONDS: {ai_response_text[:80]}...")

        tts_result = await self.synthesize_speech(ai_response_text, persona)

        return {
            "scammer_transcript": scammer_text,
            "ai_response_text": ai_response_text,
            "ai_audio_base64": tts_result["audio_base64"],
            "audio_format": tts_result["format"],
            "language": stt_result["language_detected"],
            "persona": persona,
        }


voice_engine = SarvamVoiceEngine()
