"""
Sentinel 1930 – Twilio Voice Call Engine.
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

from core.config import settings
from core.voice_engine import voice_engine
from core.ai import honeypot_ai

logger = logging.getLogger("sentinel.twilio")


class TwilioCallEngine:
    """Manages outbound Twilio calls with AI-powered voice interaction."""

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

        # Webhook URL Twilio will call when the recipient picks up
        webhook_url = f"{self.webhook_base_url}/api/v1/twilio/webhook?stream_id={stream_id}&persona={persona}"
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
        stream = connect.stream(url=ws_url, name=f"sentinel-{stream_id}")
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

                    # Send initial AI greeting
                    greeting = await honeypot_ai.generate_response(
                        persona, [], "The person has picked up the phone. Introduce yourself naturally."
                    )
                    logger.info(f"TWILIO STREAM: AI Greeting: {greeting[:80]}...")

                    tts_result = await voice_engine.synthesize_speech(greeting, persona)
                    if tts_result.get("audio_base64"):
                        await self._send_audio_to_stream(
                            websocket, stream_sid, tts_result["audio_base64"]
                        )
                        call_history.append({"role": "assistant", "content": greeting})

                elif event == "media":
                    # Accumulate incoming audio
                    payload = data.get("media", {}).get("payload", "")
                    if payload:
                        audio_chunk = base64.b64decode(payload)
                        audio_buffer.extend(audio_chunk)

                        # Process once we have enough audio
                        if len(audio_buffer) >= BUFFER_THRESHOLD:
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
                    if len(audio_buffer) > 500:
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


# Singleton instance
twilio_engine = TwilioCallEngine()
