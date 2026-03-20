from typing import Dict, Any, Optional, List
import base64
import logging
from core.config import settings

logger = logging.getLogger("drishyam.deepgram")

class DeepgramEngine:
    def __init__(self):
        self.api_key = settings.DEEPGRAM_API_KEY
        if not self.api_key:
            logger.warning("DEEPGRAM_API_KEY is missing. Deepgram features will be disabled.")
            self.client = None
        else:
            # V6 uses direct initialization with keyword arguments
            from deepgram import DeepgramClient
            self.client = DeepgramClient(api_key=self.api_key)
            logger.info("DEEPGRAM ENGINE: Initialized (SDK v6).")

    async def transcribe_audio(self, audio_bytes: bytes, language: str = "en") -> Dict[str, Any]:
        """Single-turn transcription for small audio buffers."""
        if not self.client:
            return {"transcript": "", "confidence": 0.0}
        
        try:
            # V6 pattern: listen.v1.media.transcribe_file
            response = self.client.listen.v1.media.transcribe_file(
                request=audio_bytes,
                model="nova-2",
                smart_format=True,
                language=language,
            )
            # MediaTranscribeResponse has 'results'
            transcript = response.results.channels[0].alternatives[0].transcript
            confidence = response.results.channels[0].alternatives[0].confidence
            return {
                "transcript": transcript,
                "confidence": confidence,
                "language_detected": language
            }
        except Exception as e:
            logger.error(f"DEEPGRAM STT: Transcription failed (lang={language}): {e}")
            return {"transcript": "", "confidence": 0.0}

    async def synthesize_speech(self, text: str) -> Dict[str, Any]:
        """Convert text to speech using Deepgram Aura."""
        if not self.client:
            return {"audio_base64": ""}
        
        try:
            # V6 pattern: speak.v1.audio.generate
            audio_iterator = self.client.speak.v1.audio.generate(
                text=text,
                model="aura-helios-en", 
                encoding="mulaw",
                container="none", # Raw mulaw for Twilio
                sample_rate=8000,
            )
            
            # Collect all bytes from the iterator
            audio_bytes = b"".join(list(audio_iterator))
            
            # Return base64 encoded string in a dict for consistency
            return {
                "audio_base64": base64.b64encode(audio_bytes).decode('utf-8'),
                "status": "success"
            }
        except Exception as e:
            logger.error(f"DEEPGRAM TTS: Synthesis failed: {e}")
            return {"audio_base64": "", "error": str(e)}

    async def analyze_recording(self, audio_bytes: bytes) -> Dict[str, Any]:
        """Deep forensic analysis of a call recording."""
        if not self.client:
            return {}
        
        try:
            # V6 pattern: same as transcribe but with forensics enabled
            response = self.client.listen.v1.media.transcribe_file(
                request=audio_bytes,
                model="nova-2",
                smart_format=True,
                diarize=True,
                sentiment=True,
                summarize="v2",
                topics=True,
                intents=True,
            )
            
            # Extract forensic metadata from the typed response
            results = response.results
            metadata = {
                "transcript": results.channels[0].alternatives[0].transcript if results.channels else "",
            }

            if hasattr(results, 'summary') and results.summary:
                metadata["summary"] = results.summary.short if hasattr(results.summary, 'short') else None

            if hasattr(results, 'sentiments') and results.sentiments and results.sentiments.average:
                metadata["sentiment"] = results.sentiments.average.sentiment
                metadata["sentiment_score"] = results.sentiments.average.sentiment_score

            if hasattr(results, 'topics') and results.topics and results.topics.segments:
                metadata["topics"] = [t.topic for t in results.topics.segments[0].topics] if results.topics.segments[0].topics else []

            if hasattr(results, 'intents') and results.intents and results.intents.segments:
                metadata["intents"] = [i.intent for i in results.intents.segments[0].intents] if results.intents.segments[0].intents else []

            logger.info("DEEPGRAM FORENSICS: Analysis complete.")
            return metadata
        except Exception as e:
            logger.error(f"DEEPGRAM FORENSICS: Analysis failed: {e}")
            return {}

    async def voice_chat_turn(
        self, 
        scammer_audio: bytes, 
        persona: str, 
        ai_generate_fn, 
        history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Unified loop for Simulation App voice turn:
        1. STT (Deepgram Nova-2)
        2. AI (Sarvam-M via provided function)
        3. TTS (Deepgram Aura)
        """
        if not self.client:
            return {
                "scammer_transcript": "[Deepgram Disabled]",
                "ai_response_text": "System: Voice engine not configured.",
                "ai_audio_base64": "",
                "audio_format": "mp3"
            }

        try:
            # 1. STT: Transcribe scammer audio
            stt_res = await self.transcribe_audio(scammer_audio)
            transcript = stt_res.get("transcript", "")
            
            # 2. AI: Generate response via Sarvam
            # Note: ai_generate_fn is expected to be honeypot_ai.generate_response
            ai_text = await ai_generate_fn(persona, history, transcript)
            
            # 3. TTS: Synthesize AI response
            # Note: For simulation app, we use container=mp3/wav, 
            # while for Twilio we use raw mulaw. 
            # We'll use the default Aura mp3/wav for the frontend.
            tts_res = await self.synthesize_speech_v2(ai_text)
            
            return {
                "scammer_transcript": transcript,
                "ai_response_text": ai_text,
                "ai_audio_base64": tts_res.get("audio_base64", ""),
                "audio_format": "mp3"
            }
        except Exception as e:
            logger.error(f"DEEPGRAM VOICE TURN FAILED: {e}")
            return {
                "scammer_transcript": "[Error]",
                "ai_response_text": f"Error: {str(e)}",
                "ai_audio_base64": "",
                "audio_format": "mp3"
            }

    async def synthesize_speech_v2(self, text: str) -> Dict[str, Any]:
        """Standard MP3 synthesis for frontend playback (differs from mulaw/twilio)."""
        if not self.client: return {"audio_base64": ""}
        try:
            # V6 pattern with standard MP3 container
            audio_iterator = self.client.speak.v1.audio.generate(
                text=text,
                model="aura-helios-en",
                encoding="mp3", 
                # Deepgram v6: mp3 encoding implies mp3 container
            )
            audio_bytes = b"".join(list(audio_iterator))
            return {
                "audio_base64": base64.b64encode(audio_bytes).decode('utf-8'),
                "status": "success"
            }
        except Exception as e:
            logger.error(f"DEEPGRAM TTS V2: {e}")
            return {"audio_base64": ""}

deepgram_engine = DeepgramEngine()
