import asyncio
import os
import sys
import logging

# Add current directory to path
sys.path.append(os.path.join(os.getcwd()))

from core.deepgram_engine import deepgram_engine
from core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_deepgram")

async def test_stt():
    logger.info("Testing Deepgram STT...")
    # Mock audio (silence or small wav)
    mock_audio = bytes([0] * 1000) 
    transcript = await deepgram_engine.transcribe_audio(mock_audio)
    logger.info(f"STT Transcript: '{transcript}'")

async def test_tts():
    logger.info("Testing Deepgram TTS (Aura)...")
    text = "Hello, this is a test of the DRISHYAM AI Voice Agent."
    result = await deepgram_engine.synthesize_speech(text)
    audio_b64 = result.get("audio_base64", "")
    if audio_b64:
        logger.info(f"TTS Success: Generated {len(audio_b64)} bytes of audio data.")
    else:
        logger.error("TTS Failed: No audio generated.")

async def main():
    if not settings.DEEPGRAM_API_KEY:
        logger.error("DEEPGRAM_API_KEY NOT SET!")
        return
    
    await test_stt()
    await test_tts()

if __name__ == "__main__":
    asyncio.run(main())
