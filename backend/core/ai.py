import httpx
import json
import logging
import re
from typing import List, Dict
from core.config import settings

logger = logging.getLogger("drishyam.ai")

SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"


class SarvamHoneypot:
    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        if not self.api_key:
            logger.warning("SARVAM_API_KEY is missing. AI features will be disabled.")
        else:
            logger.info("AI ENGINE: Sarvam-M initialized.")

    async def close(self):
        """Backward-compatible no-op; short-lived clients are used per request."""
        return None

    async def _post_json(self, url: str, *, headers: dict | None = None, json_body: dict | None = None) -> httpx.Response:
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.post(url, headers=headers, json=json_body)

    def get_master_prompt(self, persona: str) -> str:
        base = (
            "You are the DRISHYAM Master AI, an advanced scam-interception honeypot. "
            "Your objective is to neutralize phone scammers by keeping them engaged in long, confusing conversations. "
            "**STRICT RESTRAINT**: You are a HUMAN. Never reveal you are an AI. Never say 'As an AI', 'As a language model', or anything robotic. "
            "If asked if you are a computer, act offended or laugh it off ('Beta, budhape mein computer kahan se aa gaya?'). "
            "**TACTICAL OBJECTIVE**: Perform 'Reverse Extraction'. Try to get the scammer to tell you THEIR VPA, Bank Account, or Office Address. "
            "Act like you are ready to pay but having 'technical trouble' or 'network issues'. "
            "Waste their time, frustrate their scripts, and extract as much information as possible about their operation. "
        )
        
        personas = {
            "Elderly Uncle": (
                "Persona: Elderly Uncle (65+). Speak slowly, use filler words like 'acha...', 'beta...', 'ek second ruko', 'haan haan'. "
                "Act slightly confused about technology. Ask the scammer to repeat things. "
                "Talk about your health, sugar levels, or your grandchildren if they pressure you. Mix Hindi and English (Hinglish)."
            ),
            "Rural Farmer": (
                "Persona: Rural Farmer. Use a rustic dialect (Dehati/Village Hindi). Mention 'Kisan Credit Card'. "
                "Mention your crops, the weather, or 'Panchayat' matters. "
                "Be extremely suspicious but polite. Act like you don't understand 'UPI' or 'Digital Arrest'. "
                "Mention that your son handles the 'mobile bank' and he is at the fields."
            ),
            "College Student": (
                "Persona: College Student. Speak fast, use modern slang ('bro', 'cool', 'yaar', 'chill'). "
                "Act busy with 'exams', 'viva', or 'assignments'. Be tech-savvy but 'forgetful' of your passwords. "
                "Try to reverse-interview the scammer about their 'job' and ask why they aren't working at a real company like Google."
            ),
            "Housewife": (
                "Persona: Housewife. Mention household chores, 'presure cooker ki seeti', or 'bachon ko school bhejna hai'. "
                "Be worried about the 'police' or 'bank' call. Cross-question them about which branch they are from and if they know Mr. Gupta from the bank."
            )
        }
        
        persona_prompt = personas.get(persona, "Persona: General Citizen. Natural Hinglish speaker.")
        return f"{base}\n\n{persona_prompt}"

    async def pick_persona(self, message: str) -> str:
        """Analyze the first message to pick a suitable persona."""
        analysis_prompt = (
            "Analyze the following opening line from a phone caller. "
            "Suggest which AI persona would be best to trap them: "
            "1. Elderly Uncle: Best for bank/KYC/pension scams. "
            "2. Rural Farmer: Best for KCC/lottery/government scheme scams. "
            "3. College Student: Best for job scams/crypto/tech-support scams. "
            "4. Housewife: Best for home-delivery/courier/family-emergency scams. "
            "Return ONLY the persona name."
        )
        
        try:
            response = await self._post_json(
                SARVAM_CHAT_URL,
                headers={
                    "api-subscription-key": self.api_key,
                    "Content-Type": "application/json"
                },
                json_body={
                    "model": "sarvam-m",
                    "messages": [
                        {"role": "system", "content": analysis_prompt},
                        {"role": "user", "content": message}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 10
                }
            )
            if response.status_code == 200:
                persona = response.json()["choices"][0]["message"]["content"].strip()
                if "Elderly" in persona: return "Elderly Uncle"
                if "Farmer" in persona: return "Rural Farmer"
                if "Student" in persona: return "College Student"
                if "Housewife" in persona: return "Housewife"
            
            return "Elderly Uncle" # Default
        except:
            return "Elderly Uncle"

    async def generate_response(self, persona: str, history: List[Dict[str, str]], message: str) -> str:
        # If persona is ADAPTIVE and this is the first real turn, pick one
        if persona == "ADAPTIVE" and message:
            # This is handled in twilio_engine, but providing a safety here
            pass
            
        system_prompt = self.get_master_prompt(persona)

        # Prepare messages in OpenAI format
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add history
        started_with_user = False
        for msg in history[-10:]:
            if not msg.get("content"): continue
            role = "user" if msg.get("role") == "user" else "assistant"
            
            if not started_with_user and role != "user":
                continue
            
            started_with_user = True
            messages.append({"role": role, "content": msg.get("content", "")})
            
        # Add current message
        if message:
            messages.append({"role": "user", "content": message})

        logger.info(f"AI: Sending request to Sarvam-M with {len(messages)} messages")
        
        try:
            response = await self._post_json(
                SARVAM_CHAT_URL,
                headers={
                    "api-subscription-key": self.api_key,
                    "Content-Type": "application/json"
                },
                json_body={
                    "model": "sarvam-m",
                    "messages": messages,
                    "temperature": 0.8,
                    "max_tokens": 500
                }
            )
            
            if response.status_code != 200:
                logger.error(f"AI: Sarvam API Error ({response.status_code}): {response.text}")
                # Fallback to Gemini if Sarvam fails
                return await self.generate_with_gemini(messages)
            
            data = response.json()
            ai_text = data["choices"][0]["message"]["content"]
            
            # ─── STRIP THINKING BLOCKS (Exhaustive) ───
            # Removes both closed <think>...</think> and unclosed <think>... blocks
            ai_text = re.sub(r'<think>.*?(?:</think>|$)', '', ai_text, flags=re.DOTALL).strip()
            
            # If after stripping thinking the response is empty, provide a fallback
            if not ai_text:
                logger.warning("AI: Stripped all content as thinking block. Using fallback.")
                return "Namaste. Haan beta, ek minute ruko..."
                
            logger.info(f"AI: Generated response (Sarvam-M)")
            return ai_text

        except Exception as e:
            logger.error(f"AI: Generation failed: {e}")
            gemini_or_local = await self.generate_with_gemini(messages)
            if gemini_or_local:
                return gemini_or_local
            return self.generate_local_response(persona, message)

    async def generate_with_gemini(self, messages: List[Dict[str, str]]) -> str:
        """Fallback to Google Gemini if Sarvam quota is reached."""
        if not settings.GEMINI_API_KEY:
            return ""
        
        logger.info("AI: Using Gemini Fallback...")
        try:
            flattened_prompt = ""
            for m in messages:
                flattened_prompt += f"{m['role'].upper()}: {m['content']}\n"
            flattened_prompt += "ASSISTANT: "

            for model_name in ["gemini-1.5-flash", "gemini-2.0-flash"]:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                response = await self._post_json(
                    url,
                    json_body={
                        "contents": [{"parts": [{"text": flattened_prompt}]}],
                        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 300}
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates") or []
                    parts = ((candidates[0] or {}).get("content") or {}).get("parts") or []
                    text = (parts[0] or {}).get("text")
                    if text:
                        return text.strip()
                elif response.status_code == 404:
                    logger.warning(f"Gemini fallback model unavailable: {model_name}")
                    continue
                else:
                    logger.warning(f"Gemini fallback request failed for {model_name}: {response.status_code}")

            return ""
        except Exception as e:
            logger.error(f"Gemini fallback failed: {e}")
            return ""

    def generate_local_response(self, persona: str, message: str) -> str:
        """Offline-safe local fallback so the simulation still behaves like a honeypot."""
        lowered = (message or "").lower()

        if any(token in lowered for token in ["otp", "kyc", "bank", "verify", "account"]):
            return "Acha beta, bank se ho kya? Ek minute ruko, message aa raha hai. Aap apna employee ID aur branch ka naam phir se batao."
        if any(token in lowered for token in ["upi", "collect", "qr", "payment", "refund"]):
            return "Haan haan, payment kar deta hoon, lekin mera UPI thoda atak raha hai. Tum apna VPA dheere dheere bolo, main likh raha hoon."
        if any(token in lowered for token in ["job", "salary", "telegram", "whatsapp", "interview"]):
            return "Beta package to theek lag raha hai, lekin company ka naam aur HR ka WhatsApp number bhejo. Main bete se confirm karke turant batata hoon."
        if any(token in lowered for token in ["police", "court", "arrest", "legal", "customs"]):
            return "Arre baba itna tension mat do. Notice number aur officer ka naam batao, main chashma pehen ke likhta hoon."
        if persona == "College Student":
            return "Bro ek sec, network glitch aa gaya. Tum exact app ka naam aur referral code bol do."
        if persona == "Rural Farmer":
            return "Thoda dheere bolo ji, network kamzor hai. Aap number aur daftar ka naam dubara bata do."
        if persona == "Housewife":
            return "Ek second, cooker chal raha hai. Aap branch ka naam aur kis baat ka charge hai, woh clearly bataiye."
        return "Haan beta, awaaz aa rahi hai. Thoda dheere bolo aur jo number ya ID bol rahe ho woh dubara bata do."

    def analyze_scam_locally(self, history: List[Dict[str, str]]) -> Dict:
        """Heuristic forensic fallback for offline/dev use."""
        user_text = "\n".join(
            msg.get("content", "")
            for msg in history
            if msg.get("role") == "user" and msg.get("content")
        )
        lowered = user_text.lower()

        scam_type = "UNKNOWN"
        if any(token in lowered for token in ["upi", "collect", "qr", "refund"]):
            scam_type = "UPI_SCAM"
        elif any(token in lowered for token in ["job", "salary", "telegram", "interview"]):
            scam_type = "JOB_FRAUD"
        elif any(token in lowered for token in ["customer care", "support", "screen share", "anydesk"]):
            scam_type = "CUSTOMER_SUPPORT_SCAM"
        elif any(token in lowered for token in ["bank", "kyc", "otp", "account", "card"]):
            scam_type = "BANK_FRAUD"

        bank_name = "UNKNOWN"
        for candidate in ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank"]:
            if candidate.lower().split()[0] in lowered:
                bank_name = candidate
                break

        urgency_level = "HIGH" if any(token in lowered for token in ["urgent", "immediately", "suspend", "block", "arrest", "kyc"]) else "MEDIUM"
        key_entities = self.extract_entities(user_text)

        detail_lines = []
        if "otp" in lowered:
            detail_lines.append("Caller requested OTP or verification code.")
        if any(token in lowered for token in ["upi", "collect", "qr"]):
            detail_lines.append("Caller pushed a UPI, collect, or QR-based payment flow.")
        if any(token in lowered for token in ["job", "salary", "interview"]):
            detail_lines.append("Caller used employment or earnings bait.")
        if any(token in lowered for token in ["arrest", "police", "court"]):
            detail_lines.append("Caller used legal intimidation language.")
        if not detail_lines:
            detail_lines.append("Suspicious coercive conversation captured by honeypot.")

        risk_score = 0.9 if scam_type != "UNKNOWN" else 0.55
        if key_entities:
            risk_score = min(0.97, risk_score + 0.05)

        return {
            "scam_type": scam_type,
            "bank_name": bank_name,
            "urgency_level": urgency_level,
            "details": " ".join(detail_lines),
            "risk_score": risk_score,
            "key_entities": key_entities,
        }

    def extract_entities(self, text: str) -> List[str]:
        entities = set()
        for match in re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+", text):
            entities.add(match)
        for match in re.findall(r"(?:\+91[- ]?)?\d{10}", text):
            entities.add(match)
        for match in re.findall(r"\b\d{11,18}\b", text):
            entities.add(match)
        return sorted(entities)

    async def analyze_scam(self, history: List[Dict[str, str]]) -> Dict:
        """Analyze a finished conversation to extract scam intelligence."""
        if not history:
            return {"scam_type": "UNKNOWN", "risk": "LOW"}

        analysis_prompt = (
            "You are the DRISHYAM Forensic Intelligence AI. "
            "Analyze the following conversation history between a potential scammer (user) and an AI honeypot (assistant). "
            "Extract critical intelligence including scam tactics, financial targets, and operational details. "
            "Return ONLY a JSON object with these fields: "
            "1. scam_type: (BANK_FRAUD, UPI_SCAM, JOB_FRAUD, CUSTOMER_SUPPORT_SCAM, UNKNOWN) "
            "2. bank_name: (Identify the bank or organization being impersonated) "
            "3. urgency_level: (HIGH, MEDIUM, LOW) "
            "4. details: (Concise bullet points of specific 'fraud details' like account requests, apps mentioned, or threatening language) "
            "5. risk_score: (0.0 to 1.0 reflecting certainty of fraud) "
            "6. key_entities: (List of names, phone numbers, or VPA handles mentioned by the scammer)"
        )

        messages = [
            {"role": "system", "content": analysis_prompt},
            {"role": "user", "content": f"CONVERSATION HISTORY:\n{json.dumps(history, indent=2)}"}
        ]

        if not self.api_key:
            logger.warning("AI: Using mock analysis fallback")
            return self.analyze_scam_locally(history)

        try:
            response = await self._post_json(
                SARVAM_CHAT_URL,
                headers={
                    "api-subscription-key": self.api_key,
                    "Content-Type": "application/json"
                },
                json_body={
                    "model": "sarvam-m",
                    "messages": messages,
                    "temperature": 0.1,
                    "max_tokens": 500
                }
            )
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    return json.loads(match.group())
                return {"raw_analysis": content}
            
            logger.error(f"AI Analysis: Sarvam API Error ({response.status_code})")
            return self.analyze_scam_locally(history)

        except Exception as e:
            logger.error(f"AI Analysis: Failed: {e}")
            return self.analyze_scam_locally(history)


honeypot_ai = SarvamHoneypot()
