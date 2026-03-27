"""
DRISHYAM AI – Sarvam AI Voice Engine.
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
from core.deepgram_engine import deepgram_engine

logger = logging.getLogger("drishyam.voice")

SARVAM_BASE_URL = "https://api.sarvam.ai"


class SarvamVoiceEngine:
    """Real-time voice pipeline using Sarvam AI APIs."""

    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        print(f"[SARVAM_INIT] api_key_present={bool(self.api_key)}")
        print(f"[SARVAM_INIT] api_key_prefix={(self.api_key[:8] + '...') if self.api_key else 'NONE'}")
        if not self.api_key:
            logger.warning("VOICE ENGINE: SARVAM_API_KEY not set. Voice features will fail at runtime.")
        else:
            logger.info(f"VOICE ENGINE: Sarvam AI ready (key: {self.api_key[:8]}...).")

        # Persona → Sarvam voice mapping
        self.persona_voices = {
            "Elderly Uncle":   {"speaker": "karun",   "language": "hi-IN", "model": "bulbul:v2", "pace": "0.85"},
            "Rural Farmer":    {"speaker": "arvind",  "language": "hi-IN", "model": "bulbul:v2", "pace": "0.9"},
            "College Student": {"speaker": "kumar",   "language": "en-IN", "model": "bulbul:v2", "pace": "1.05"},
            "Housewife":       {"speaker": "meera",   "language": "hi-IN", "model": "bulbul:v2", "pace": "0.95"},
            "Busy Executive":  {"speaker": "pavithra","language": "en-IN", "model": "bulbul:v2", "pace": "1.0"},
        }
        self.default_voice = {"speaker": "karun", "language": "hi-IN", "model": "bulbul:v2", "pace": "0.9"}
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        """Close the persistent HTTP client."""
        await self.client.aclose()

    def _normalize_language(self, language: str | None) -> str:
        normalized = (language or "hi-IN").strip()
        language_map = {
            "hi": "hi-IN",
            "en": "en-IN",
            "en-US": "en-IN",
        }
        return language_map.get(normalized, normalized)

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
        
        language = self._normalize_language(language)
        print(f"[SARVAM_STT] input_bytes={len(audio_bytes)} language={language} model={model}")
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
        print(
            f"[SARVAM_STT] wav_bytes={(len(wav_bytes) if wav_bytes else 0)} "
            f"content_type={audio_content_type} filename={audio_filename}"
        )

        # Upload to Sarvam saaras using persistent client
        # NOTE: Speech endpoints are NOT under /v1/
        try:
            print(f"[SARVAM_STT] POST {SARVAM_BASE_URL}/speech-to-text")
            logger.info(f"STT: Sending {len(wav_bytes)}b to Sarvam API ({audio_content_type}, lang={language}, model={model})")
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
            print(f"[SARVAM_STT] status_code={response.status_code}")
            print(f"[SARVAM_STT] raw_response={response.text[:500]}")
            logger.info(f"STT: Sarvam API responded with status {response.status_code}")
            if response.status_code != 200:
                logger.error(f"STT API Error ({response.status_code}): {response.text}")
                response.raise_for_status()
                
            data = response.json()

            transcript = (data.get("transcript", "") or "").strip()
            lang = language
            print(f"[SARVAM_STT] transcript={transcript[:200]}")
            print(f"[SARVAM_STT] transcript_len={len(transcript)}")
            if not transcript:
                logger.warning("STT: Sarvam returned an empty transcript, attempting fallback engine.")
                return await self.transcribe_with_fallback(audio_bytes, language)
            logger.info(f"STT: Transcribed [{lang}]: {transcript[:60]}...")
            return {
                "transcript": transcript,
                "language_detected": lang,
                "confidence": 1.0,
            }
        except Exception as e:
            logger.error(f"STT: Sarvam transcription failed: {type(e).__name__}: {e}")
            print(f"[SARVAM_STT][ERROR] {type(e).__name__}: {e}")
            return await self.transcribe_with_fallback(audio_bytes, language)

    async def transcribe_with_fallback(self, audio_bytes: bytes, language: str) -> Dict[str, Any]:
        """Fallback to Deepgram first, then Gemini, when Sarvam STT fails or returns blank."""
        try:
            deepgram_result = await deepgram_engine.transcribe_audio(audio_bytes, language=language)
            transcript = (deepgram_result.get("transcript", "") or "").strip()
            if transcript:
                logger.info("STT: Deepgram fallback recovered transcript successfully.")
                return {
                    "transcript": transcript,
                    "language_detected": deepgram_result.get("language_detected", language),
                    "confidence": deepgram_result.get("confidence", 1.0),
                }
        except Exception as e:
            logger.error(f"STT: Deepgram fallback exception: {e}")

        return await self.transcribe_with_gemini(audio_bytes, language)

    async def transcribe_with_gemini(self, audio_bytes: bytes, language: str) -> Dict[str, Any]:
        """Fallback STT using Google Gemini 1.5 Flash."""
        if not settings.GEMINI_API_KEY:
            return {"transcript": "", "language_detected": language, "confidence": 0.0}
        
        logger.info("STT: Using Gemini Fallback...")
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.GEMINI_API_KEY}"
            
            # Encode audio to base64 for Gemini multimodal input
            audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
            
            response = await self.client.post(
                url,
                json={
                    "contents": [{
                        "parts": [
                            {"text": f"Transcribe this audio. The language is likely {language}."},
                            {"inline_data": {"mime_type": "audio/webm", "data": audio_b64}}
                        ]
                    }]
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                text = data['candidates'][0]['content']['parts'][0]['text']
                logger.info(f"STT (Gemini): {text[:60]}...")
                return {
                    "transcript": text.strip(),
                    "language_detected": language,
                    "confidence": 1.0,
                }
            
            logger.error(f"STT: Gemini fallback failed with status {response.status_code}")
            return {"transcript": "", "language_detected": language, "confidence": 0.0}
        except Exception as e:
            logger.error(f"STT: Gemini fallback exception: {e}")
            return {"transcript": "", "language_detected": language, "confidence": 0.0}

    # ─── Text-to-Speech (TTS) ────────────────────────────────────────
    async def synthesize_speech(
        self,
        text: str,
        persona: str = "Elderly Uncle",
    ) -> Dict[str, Any]:
        """Convert AI response to natural Indian-language speech via Sarvam Bulbul."""
        voice_config = self.persona_voices.get(persona, self.default_voice)
        print(f"[SARVAM_TTS] persona={persona} text_len={len(text)}")
        print(f"[SARVAM_TTS] voice_config={voice_config}")

        try:
            # NOTE: Speech endpoints are NOT under /v1/
            response = await self.client.post(
                f"{SARVAM_BASE_URL}/text-to-speech",
                headers={
                    "api-subscription-key": self.api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "target_language_code": voice_config["language"],
                    "speaker": voice_config["speaker"],
                    "model": voice_config["model"],
                    "pitch": 0,
                    "pace": float(voice_config["pace"]),
                    "loudness": 1.5,
                    "enable_preprocessing": True,
                },
            )
            print(f"[SARVAM_TTS] status_code={response.status_code}")
            print(f"[SARVAM_TTS] raw_response={response.text[:500]}")
            if response.status_code != 200:
                logger.error(f"TTS API Error ({response.status_code}): {response.text}")
                response.raise_for_status()
                
            data = response.json()

            # Handle both old 'audios' list and new 'audio' field
            audio_base64 = data.get("audio", "")
            if not audio_base64:
                audios = data.get("audios", [])
                audio_base64 = audios[0] if audios else ""
            print(f"[SARVAM_TTS] audio_base64_len={len(audio_base64)}")
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
            print(f"[SARVAM_TTS][ERROR] {type(e).__name__}: {e}")
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
        language: str = "hi-IN",
    ) -> Dict[str, Any]:
        """
        Complete voice chat turn:
        1. STT: Transcribe scammer audio → text
        2. AI: Generate honeypot response (Gemini)
        3. TTS: Convert AI response → speech
        """
        stt_result = await self.transcribe_audio(scammer_audio, language=language)
        scammer_text = stt_result["transcript"]
        
        # Prevent empty user prompts which crash the LLM (e.g. Sarvam-M alternation rules)
        if not scammer_text or scammer_text.isspace():
            scammer_text = "[Inaudible silence...]"
            
        logger.info(f"SCAMMER SAID: {scammer_text}")

        ai_response_text = await ai_generate_fn(persona, history, scammer_text)
        
        # Prevent empty text from crashing TTS
        if not ai_response_text or ai_response_text.isspace() or ai_response_text == "...":
            ai_response_text = "Namaste. Hello? Are you there?"
            
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
