"""
DRISHYAM 1930 – Twilio Voice Call Engine.
Enables outbound AI-powered phone calls using Twilio Media Streams.
The AI honeypot persona talks to the target in real-time via:
  Twilio Audio → STT (Sarvam) → AI Response (Sarvam-M) → TTS (Sarvam) → Twilio Audio
"""

import base64
import json
import logging
import asyncio
import uuid
from typing import Dict, Any, Optional

from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Connect
import urllib.parse

from core.config import settings
from core.voice_engine import voice_engine
from core.deepgram_engine import deepgram_engine
from core.ai import honeypot_ai

logger = logging.getLogger("drishyam.twilio")


class TwilioEngine:
    """Manages Twilio services (Voice & SMS) with AI-powered interaction."""

    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.phone_number = settings.TWILIO_PHONE_NUMBER
        self.webhook_base_url = settings.TWILIO_WEBHOOK_BASE_URL

        self.client: Optional[TwilioClient] = None
        self.active_calls: Dict[str, Dict[str, Any]] = {}  # call_sid -> call info

        if self.account_sid and self.auth_token:
            try:
                self.client = TwilioClient(self.account_sid, self.auth_token)
                logger.info(f"TWILIO ENGINE: Initialized (SID: {self.account_sid[:8]}...)")
            except Exception as e:
                logger.error(f"TWILIO ENGINE: Failed to initialize client: {e}")
                self.client = None
        else:
            logger.warning("TWILIO ENGINE: Missing credentials. Twilio calling disabled.")

    def initiate_call(
        self,
        to_number: str,
        persona: str = "Elderly Uncle",
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Place an outbound call via Twilio.
        When the call connects, Twilio hits our webhook which starts a WebSocket media stream.
        """
        if not self.client:
            raise RuntimeError("Twilio client not initialized. Check your credentials.")

        if not self.webhook_base_url:
            raise RuntimeError("TWILIO_WEBHOOK_BASE_URL not set. Twilio needs a public URL for callbacks.")

        if not self.phone_number:
            raise RuntimeError("TWILIO_PHONE_NUMBER not set.")

        # Generate a unique stream ID to track this call
        stream_id = session_id or str(uuid.uuid4())
        
        # Properly encode query parameters
        encoded_persona = urllib.parse.quote(persona)

        # Webhook URL Twilio will call when the recipient picks up
        webhook_url = f"{self.webhook_base_url}/api/v1/twilio/webhook?stream_id={stream_id}&persona={encoded_persona}"
        status_url = f"{self.webhook_base_url}/api/v1/twilio/call-status?stream_id={stream_id}"

        try:
            call = self.client.calls.create(
                to=to_number,
                from_=self.phone_number,
                url=webhook_url,
                status_callback=status_url,
                status_callback_event=["initiated", "ringing", "answered", "completed"],
                status_callback_method="POST",
                record=False,
                machine_detection="Enable",
            )

            call_info = {
                "call_sid": call.sid,
                "stream_id": stream_id,
                "to": to_number,
                "from": self.phone_number,
                "persona": persona,
                "status": "initiated",
                "history": [],
            }
            self.active_calls[stream_id] = call_info

            logger.info(f"TWILIO: Call initiated → {to_number} (SID: {call.sid}, Stream: {stream_id})")
            return call_info

        except Exception as e:
            logger.error(f"TWILIO: Failed to initiate call to {to_number}: {e}")
            raise

    def generate_twiml_connect(self, stream_id: str, persona: str) -> str:
        """
        Generate TwiML XML that starts a bidirectional WebSocket media stream.
        Twilio will connect to our WebSocket endpoint to stream call audio.
        """
        response = VoiceResponse()

        # Initial greeting before the stream kicks in
        response.say(
            "Connecting you now. Please hold.",
            voice="Polly.Aditi",
            language="hi-IN",
        )
        response.pause(length=1)

        # WebSocket media stream URL
        ws_scheme = "wss" if self.webhook_base_url.startswith("https") else "ws"
        ws_base = self.webhook_base_url.replace("https://", "").replace("http://", "")
        ws_url = f"{ws_scheme}://{ws_base}/api/v1/twilio/media-stream"

        connect = Connect()
        stream = connect.stream(url=ws_url, name=f"drishyam-{stream_id}")
        stream.parameter(name="stream_id", value=stream_id)
        stream.parameter(name="persona", value=persona)
        response.append(connect)

        twiml = str(response)
        logger.info(f"TWILIO: Generated TwiML for stream {stream_id}")
        return twiml

    async def handle_media_stream(self, websocket) -> None:
        """
        Handle the Twilio Media Stream WebSocket connection.
        Receives audio from the call, runs it through the AI pipeline,
        and sends AI-generated audio back.
        """
        stream_sid = None
        stream_id = None
        persona = "Elderly Uncle"
        call_history = []
        audio_buffer = bytearray()
        
        # Twilio sends 8kHz µ-law audio in 20ms chunks
        # We accumulate ~2 seconds of audio before processing
        BUFFER_THRESHOLD = 16000  # ~2s of 8kHz audio

        try:
            async for message in websocket.iter_text():
                data = json.loads(message)
                event = data.get("event")

                if event == "connected":
                    logger.info("TWILIO STREAM: WebSocket connected")

                elif event == "start":
                    start_data = data.get("start", {})
                    stream_sid = start_data.get("streamSid")
                    custom_params = start_data.get("customParameters", {})
                    stream_id = custom_params.get("stream_id", "unknown")
                    persona = custom_params.get("persona", "Elderly Uncle")

                    logger.info(f"TWILIO STREAM: Started (StreamSID: {stream_sid}, ID: {stream_id}, Persona: {persona})")
                    
                    if stream_id not in self.active_calls:
                        self.active_calls[stream_id] = {
                            "sid": stream_sid,
                            "persona": persona,
                            "status": "in-progress",
                            "start_time": asyncio.get_event_loop().time(),
                            "history": [],
                            "full_audio": bytearray() # Accumulate audio for forensics
                        }

                    # If persona is ADAPTIVE, we wait for the first user message before picking one.
                    # Initial greeting for ADAPTIVE mode.
                    if persona == "ADAPTIVE":
                        greeting = "Hello? Namaste? Koun bol raha hai?" # Generic opening
                        call_history.append({"role": "assistant", "content": greeting})
                        # Use Deepgram for near-zero latency greeting
                        tts_result = await deepgram_engine.synthesize_speech(greeting)
                        if tts_result.get("audio_base64"):
                            await self._send_audio_to_stream(websocket, stream_sid, tts_result["audio_base64"])
                    else:
                        # Send initial AI greeting
                        greeting = await honeypot_ai.generate_response(
                            persona, [], "The call has just started. Introduce yourself naturally as the persona and engage with the other person."
                        )
                        logger.info(f"TWILIO STREAM: AI Greeting: {greeting[:80]}...")

                        # Use Deepgram for near-zero latency response
                        tts_result = await deepgram_engine.synthesize_speech(greeting)
                        if tts_result.get("audio_base64"):
                            await self._send_audio_to_stream(
                                websocket, stream_sid, tts_result["audio_base64"]
                            )
                            call_history.append({"role": "assistant", "content": greeting})


                elif event == "media":
                    # Accumulate incoming audio
                    if not stream_sid:
                        continue # Skip media if start event hasn't happened
                        
                    payload = data.get("media", {}).get("payload", "")
                    if payload:
                        audio_chunk = base64.b64decode(payload)
                        audio_buffer.extend(audio_chunk)

                        # Process once we have enough audio
                        if len(audio_buffer) >= 2000: # Threshold for processing
                            # Store in full audio for post-call forensics
                            if stream_id in self.active_calls:
                                self.active_calls[stream_id]["full_audio"].extend(audio_buffer)
                                
                            await self._process_audio_chunk(
                                websocket,
                                stream_sid, 
                                bytes(audio_buffer),
                                persona,
                                call_history,
                            )
                            audio_buffer.clear()

                elif event == "stop":
                    logger.info(f"TWILIO STREAM: Stopped (StreamSID: {stream_sid})")

                    # Process any remaining buffered audio
                    if stream_sid and len(audio_buffer) > 500:
                        await self._process_audio_chunk(
                            websocket,
                            stream_sid,
                            bytes(audio_buffer),
                            persona,
                            call_history,
                        )
                        audio_buffer.clear()

                    # Update call record
                    if stream_id and stream_id in self.active_calls:
                        self.active_calls[stream_id]["status"] = "completed"
                        self.active_calls[stream_id]["history"] = call_history
                        
                        # Trigger automated post-call analysis
                        full_audio = bytes(self.active_calls[stream_id].get("full_audio", b""))
                        asyncio.create_task(self._analyze_and_report(stream_id, call_history, full_audio))

                    break


        except Exception as e:
            logger.error(f"TWILIO STREAM: Error: {e}")
            import traceback
            traceback.print_exc()

    async def _process_audio_chunk(
        self,
        websocket,
        stream_sid: str,
        audio_bytes: bytes,
        persona: str,
        history: list,
    ) -> None:
        """Process accumulated audio: STT → AI → TTS → send back."""
        try:
            # 1. STT: Transcribe the caller's audio
            stt_result = await voice_engine.transcribe_audio(audio_bytes)
            caller_text = stt_result.get("transcript", "").strip()

            if not caller_text:
                logger.debug("TWILIO STREAM: Empty transcription, skipping")
                return

            logger.info(f"TWILIO STREAM: Caller said: {caller_text}")
            history.append({"role": "user", "content": caller_text})

            # If ADAPTIVE, pick a persona now based on first user message
            if persona == "ADAPTIVE":
                persona = await honeypot_ai.pick_persona(caller_text)
                logger.info(f"TWILIO STREAM: ADAPTIVE picked persona: {persona}")
                # Update the stream state
                # Note: This is an internal variable for this function call
                # In a real system, we'd update self.active_calls[stream_id]

            # 2. AI: Generate response

            ai_response = await honeypot_ai.generate_response(persona, history, caller_text)
            logger.info(f"TWILIO STREAM: AI responds: {ai_response[:80]}...")
            history.append({"role": "assistant", "content": ai_response})

            # 3. TTS: Convert response to speech
            tts_result = await voice_engine.synthesize_speech(ai_response, persona)

            # 4. Send audio back through the media stream
            if tts_result.get("audio_base64"):
                await self._send_audio_to_stream(
                    websocket, stream_sid, tts_result["audio_base64"]
                )

        except Exception as e:
            logger.error(f"TWILIO STREAM: Audio processing error: {e}")

    async def _analyze_and_report(self, stream_id: str, history: list, full_audio: bytes = None) -> None:
        """Analyze the call after it ends and generate a crime report."""
        try:
            from core.database import SessionLocal
            from models.database import HoneypotSession, CrimeReport, IntelligenceAlert
            import json

            # 1. AI Analysis
            analysis = await honeypot_ai.analyze_scam(history)
            
            # 1a. Enhanced Deepgram Forensics if audio is available
            if full_audio and len(full_audio) > 1000:
                logger.info(f"TWILIO ANALYSIS: Running Deepgram Forensics for {stream_id}")
                dg_forensics = await deepgram_engine.analyze_recording(full_audio)
                if dg_forensics:
                    analysis["vocal_intelligence"] = dg_forensics
                    # Combine summaries or insights
                    if dg_forensics.get("summary"):
                        analysis["details"] = f"{analysis.get('details', '')}\n\nAI Summary: {dg_forensics['summary']}"
            
            logger.info(f"TWILIO ANALYSIS: Results for {stream_id}: {analysis.get('scam_type')}")

            # Use explicit session open/close (SessionLocal is not a context manager)
            db = SessionLocal()
            try:
                session = db.query(HoneypotSession).filter(HoneypotSession.session_id == stream_id).first()
                if session:
                    session.status = "completed"
                    session.recording_analysis_json = analysis
                    
                    # 2. Generate Crime Report if risk is high
                    if analysis.get("risk_score", 0) > 0.7 or (analysis.get("scam_type", "UNKNOWN") not in ["UNKNOWN", "ERROR"]):
                        report_id = f"AUTO-{uuid.uuid4().hex[:6].upper()}"
                        new_report = CrimeReport(
                            report_id=report_id,
                            category="police",
                            scam_type=analysis.get("scam_type", "UNKNOWN"),
                            platform="Voice Call",
                            priority="HIGH" if analysis.get("risk_score", 0) > 0.8 else "MEDIUM",
                            status="PENDING",
                            reporter_num=session.caller_num,
                            metadata_json=analysis
                        )
                        db.add(new_report)
                        
                        # 3. Add to live Intelligence Alerts for Dashboard
                        alert = IntelligenceAlert(
                            severity="HIGH",
                            message=f"Automated detection: {analysis.get('scam_type')} attempt from {session.caller_num}",
                            category="VOICE_SCAM",
                        )
                        db.add(alert)
                        
                    db.commit()
                    logger.info(f"TWILIO REPORT: Created report for session {stream_id}")
            finally:
                db.close()

        except Exception as e:
            logger.error(f"TWILIO ANALYSIS: Failed: {e}")

    async def _send_audio_to_stream(

        self, websocket, stream_sid: str, audio_base64: str
    ) -> None:
        """Send audio payload back to Twilio through the WebSocket media stream."""
        if not audio_base64 or not stream_sid:
            return

        try:
            # Twilio expects base64-encoded µ-law 8kHz mono audio
            # Sarvam returns WAV — we send as-is and let Twilio handle the format
            # For production, you'd transcode WAV → µ-law here
            media_message = {
                "event": "media",
                "streamSid": stream_sid,
                "media": {"payload": audio_base64},
            }
            await websocket.send_text(json.dumps(media_message))
            logger.debug(f"TWILIO STREAM: Sent {len(audio_base64)} chars of audio")

        except Exception as e:
            logger.error(f"TWILIO STREAM: Failed to send audio: {e}")

    def get_call_status(self, stream_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of a call by its stream ID."""
        return self.active_calls.get(stream_id)

    def get_all_calls(self) -> list:
        """Get list of all tracked calls."""
        return list(self.active_calls.values())

    def end_call(self, stream_id: str) -> bool:
        """Terminate an active call."""
        call_info = self.active_calls.get(stream_id)
        if not call_info or not self.client:
            return False

        try:
            self.client.calls(call_info["call_sid"]).update(status="completed")
            call_info["status"] = "terminated"
            logger.info(f"TWILIO: Call {stream_id} terminated")
            return True
        except Exception as e:
            logger.error(f"TWILIO: Failed to end call {stream_id}: {e}")
            return False

    def send_sms(self, to_number: str, message: str) -> bool:
        """
        Send an SMS message via Twilio.
        """
        if not self.client:
            logger.warning("TWILIO: Cannot send SMS. Client not initialized.")
            return False

        if not self.phone_number:
            logger.warning("TWILIO: Cannot send SMS. TWILIO_PHONE_NUMBER not set.")
            return False

        try:
            msg = self.client.messages.create(
                body=message,
                from_=self.phone_number,
                to=to_number
            )
            logger.info(f"TWILIO SMS: Sent to {to_number} (SID: {msg.sid})")
            return True
        except Exception as e:
            logger.error(f"TWILIO SMS: Failed to send to {to_number}: {e}")
            return False


# Singleton instance
twilio_engine = TwilioEngine()
