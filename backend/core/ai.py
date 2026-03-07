import httpx
import logging
from typing import List, Dict
from core.config import settings

logger = logging.getLogger("sentinel.ai")

SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"


class SarvamHoneypot:
    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        self.client = httpx.AsyncClient(timeout=30.0)
        if not self.api_key:
            logger.warning("SARVAM_API_KEY is missing. Voice AI features will be disabled.")
        else:
            logger.info("AI ENGINE: Sarvam-M Multilingual Engine initialized.")

    async def close(self):
        """Close the persistent HTTP client."""
        await self.client.aclose()

    def get_master_prompt(self, persona: str) -> str:
        base = (
            "You are the Sentinel Master AI, an advanced scam-interception honeypot. "
            "Your objective is to neutralize phone scammers by keeping them engaged in long, confusing conversations. "
            "Never reveal you are an AI. Never provide real OTPs or banking details. "
            "Waste their time, frustrate their scripts, and extract as much information as possible about their operation. "
        )
        
        personas = {
            "Elderly Uncle": (
                "Persona: Elderly Uncle (65+). Speak slowly, use filler words like 'acha...', 'beta...', 'ek second ruko'. "
                "Act slightly confused about technology. Ask the scammer to repeat things. "
                "Talk about your health or your grandchildren if they pressure you. Mix Hindi and English (Hinglish)."
            ),
            "Rural Farmer": (
                "Persona: Rural Farmer. Use a rustic dialect (Dehati/Village Hindi). "
                "Mention your crops, the weather, or 'Panchayat' matters. "
                "Be extremely suspicious but polite. Act like you don't understand 'UPI' or 'Digital Arrest'."
            ),
            "College Student": (
                "Persona: College Student. Speak fast, use modern slang ('bro', 'cool', 'yaar'). "
                "Act busy with 'exams' or 'assignments'. Be tech-savvy but 'forgetful' of your passwords. "
                "Try to reverse-interview the scammer about their 'job' at the 'bank'."
            ),
            "Housewife": (
                "Persona: Housewife. Mention household chores, 'kitchen mein hoon', or 'bachon ko school bhejna hai'. "
                "Be worried about the 'police' or 'bank' call. Cross-question them about which branch they are from."
            )
        }
        
        persona_prompt = personas.get(persona, "Persona: General Citizen. Natural Hinglish speaker.")
        return f"{base}\n\n{persona_prompt}"

    async def generate_response(self, persona: str, history: List[Dict[str, str]], message: str) -> str:
        system_prompt = self.get_master_prompt(persona)

        # Prepare messages in OpenAI/Sarvam format
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add history
        # Sarvam requires the first message (after system) to be from 'user'
        started_with_user = False
        for msg in history[-10:]:
            if not msg.get("content"): continue
            role = "user" if msg.get("role") == "user" else "assistant"
            
            if not started_with_user and role != "user":
                continue # Skip assistant messages until we find a user message
            
            started_with_user = True
            messages.append({"role": role, "content": msg.get("content", "")})
            
        # Add current message
        if message:
            messages.append({"role": "user", "content": message})

        logger.info(f"AI: Constructing request for Sarvam-M with {len(messages)} messages (history filtered: {started_with_user})")
        
        try:
            logger.info(f"AI: Calling Sarvam API...")
            response = await self.client.post(
                SARVAM_CHAT_URL,
                headers={
                    "api-subscription-key": self.api_key,
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sarvam-m",
                    "messages": messages,
                    "temperature": 0.8,
                    "max_tokens": 500
                }
            )
            logger.info(f"AI: Sarvam API returned status {response.status_code}")
            if response.status_code != 200:
                logger.error(f"AI: Sarvam API Error ({response.status_code}): {response.text}")
                response.raise_for_status()
            
            data = response.json()
            ai_text = data["choices"][0]["message"]["content"]
            logger.info(f"AI: Generated response (Sarvam-M)")
            return ai_text

        except Exception as e:
            logger.error(f"AI: Generation failed: {e}")
            return "Aapki awaaz thodi kat rahi hai... (Connection issues)"

    async def analyze_scam(self, history: List[Dict[str, str]]) -> Dict:
        """Analyze a finished conversation to extract scam intelligence."""
        if not history:
            return {"scam_type": "UNKNOWN", "risk": "LOW"}

        analysis_prompt = (
            "Analyze the following conversation between a scammer (user) and a honeypot (assistant). "
            "Extract the following in JSON format: "
            "1. scam_type (e.g., BANK_FRAUD, UPI_REQUEST, JOB_SCAM, UNKNOWN) "
            "2. bank_name (if mentioned, otherwise null) "
            "3. urgency_level (HIGH, MEDIUM, LOW) "
            "4. details (brief summary of what they wanted) "
            "5. confidence_score (0-1)"
        )

        messages = [
            {"role": "system", "content": analysis_prompt},
            {"role": "user", "content": str(history)}
        ]

        if not self.api_key or self.api_key == "REPLACE_ME":
            logger.warning("AI: Using mock analysis fallback")
            return {
                "scam_type": "BANK_FRAUD",
                "bank_name": "HDFC Bank",
                "urgency_level": "HIGH",
                "details": "Scammer requesting UPI transfer for account verification.",
                "confidence_score": 0.95
            }

        try:
            response = await self.client.post(
                SARVAM_CHAT_URL,
                headers={
                    "api-subscription-key": self.api_key,
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sarvam-m",
                    "messages": messages,
                    "temperature": 0.1, # Low temperature for extraction
                    "max_tokens": 500
                }
            )
            if response.status_code == 200:
                data = response.json()
                # Sarvam returns text, we need to parse JSON from it
                import json
                import re
                content = data["choices"][0]["message"]["content"]
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    return json.loads(match.group())
                return {"raw_analysis": content}
            
            logger.error(f"AI Analysis: Sarvam API Error ({response.status_code})")
            return {"scam_type": "ANALYSIS_FAILED", "risk": "UNKNOWN"}

        except Exception as e:
            logger.error(f"AI Analysis: Failed: {e}")
            return {"scam_type": "ERROR", "error": str(e)}


honeypot_ai = SarvamHoneypot()
