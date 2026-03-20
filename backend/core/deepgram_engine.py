"""
DRISHYAM AI – Deepgram Voice Engine.
Real-time STT (Nova-2) and TTS (Aura) integration for the AI Honeypot.
Includes support for conversation recording and analysis.
"""

import logging
import base64
import httpx
import json
import asyncio
from typing import Dict, Any, List, Optional
from core.config import settings

logger = logging.getLogger("drishyam.deepgram")

DEEPGRAM_STT_URL = "https://api.deepgram.com/v1/listen"
DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"

class DeepgramVoiceEngine:
    """Voice pipeline using Deepgram APIs for STT and TTS."""

    def __init__(self):
        self.api_key = settings.DEEPGRAM_API_KEY
        if not self.api_key or self.api_key == "mock-key":
            logger.warning("DEEPGRAM ENGINE: API Key missing or mock. Realistic voice features will fail.")
        else:
            logger.info("DEEPGRAM ENGINE: Deepgram SDK ready.")

        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        """Close the persistent HTTP client."""
        await self.client.aclose()

    # ─── Speech-to-Text (STT) ────────────────────────────────────────
    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        language: str = "hi",
        model: str = "nova-2",
    ) -> Dict[str, Any]:
        """Transcribe audio using Deepgram Nova-2."""
        if not self.api_key or self.api_key == "mock-key":
            logger.warning("STT: Using Mock Transcription (No API Key)")
            return {"transcript": "[Mock Transcription: Scammer asking for money]", "confidence": 0.9, "metadata": {}}

        try:
            params = {
                "model": model,
                "smart_format": "true",
                "language": language,
                "diarize": "true",
                "filler_words": "true",
                "sentiment": "true",
                "topics": "true"
            }
            
            headers = {
                "Authorization": f"Token {self.api_key}",
                "Content-Type": "audio/webm" # Simulation app sends webm
            }

            response = await self.client.post(
                DEEPGRAM_STT_URL,
                params=params,
                headers=headers,
                data=audio_bytes
            )

            if response.status_code != 200:
                logger.error(f"STT API Error: {response.text}")
                response.raise_for_status()

            data = response.json()
            results = data.get("results", {})
            channels = results.get("channels", [{}])
            alternatives = channels[0].get("alternatives", [{}])
            transcript = alternatives[0].get("transcript", "")
            
            logger.info(f"STT: Transcribed: {transcript[:60]}...")
            
            return {
                "transcript": transcript,
                "confidence": alternatives[0].get("confidence", 0),
                "metadata": data.get("metadata", {}),
                "sentiment": alternatives[0].get("sentiment", "neutral"),
                "topics": alternatives[0].get("topics", [])
            }

        except Exception as e:
            logger.error(f"STT: Deepgram transcription failed: {e}")
            return {"transcript": "", "confidence": 0, "error": str(e)}

    # ─── Text-to-Speech (TTS) ────────────────────────────────────────
    async def synthesize_speech(
        self,
        text: str,
        voice: str = "aura-asteria-en", # Natural sounding female voice
    ) -> Dict[str, Any]:
        """Convert text to speech using Deepgram Aura."""
        if not self.api_key or self.api_key == "mock-key":
            logger.warning("TTS: Using Mock Synthesis (No API Key)")
            return {"audio_base64": "", "format": "mp3"}

        try:
            params = {"model": voice}
            headers = {
                "Authorization": f"Token {self.api_key}",
                "Content-Type": "application/json"
            }

            response = await self.client.post(
                DEEPGRAM_TTS_URL,
                params=params,
                headers=headers,
                json={"text": text}
            )

            if response.status_code != 200:
                logger.error(f"TTS API Error: {response.text}")
                response.raise_for_status()

            audio_content = response.content
            audio_base64 = base64.b64encode(audio_content).decode("utf-8")
            
            logger.info(f"TTS: Synthesized {len(audio_base64)} chars for response")

            return {
                "audio_base64": audio_base64,
                "format": "mp3",
                "voice": voice
            }

        except Exception as e:
            logger.error(f"TTS: Deepgram synthesis failed: {e}")
            return {"audio_base64": "", "error": str(e)}

    # ─── Full Voice Chat Turn ────────────────────────────────────────
    async def voice_chat_turn(
        self,
        scammer_audio: bytes,
        persona: str,
        ai_generate_fn,
        history: List[dict],
    ) -> Dict[str, Any]:
        """
        Complete Deepgram voice turn:
        1. STT: Deepgram Nova-2
        2. AI: Generate Honeypot response
        3. TTS: Deepgram Aura
        """
        # 1. Transcribe Scammer
        stt_result = await self.transcribe_audio(scammer_audio)
        scammer_text = stt_result["transcript"]
        
        # 2. Generate AI reply
        ai_response_text = await ai_generate_fn(persona, history, scammer_text)
        
        # 3. Synthesize Speech
        # Choose voice based on persona if possible, else default
        voice_map = {
            "Elderly Uncle": "aura-stella-en", # Calmer, older feel
            "Rural Farmer": "aura-stella-en",
            "College Student": "aura-asteria-en",
            "Housewife": "aura-asteria-en"
        }
        voice = voice_map.get(persona, "aura-asteria-en")
        
        tts_result = await self.synthesize_speech(ai_response_text, voice)
        
        return {
            "scammer_transcript": scammer_text,
            "ai_response_text": ai_response_text,
            "ai_audio_base64": tts_result.get("audio_base64", ""),
            "audio_format": tts_result.get("format", "mp3"),
            "stt_metadata": stt_result,
            "persona": persona
        }

deepgram_engine = DeepgramVoiceEngine()
