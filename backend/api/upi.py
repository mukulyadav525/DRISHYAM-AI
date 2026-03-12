from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import SystemAction, SystemStat
from pydantic import BaseModel
import uuid
import logging
import datetime
import re
import json
import io

logger = logging.getLogger("sentinel.upi")

router = APIRouter()

class UPIRequest(BaseModel):
    vpa: str

class MessageScanRequest(BaseModel):
    message: str

# T5 requirement: Simulated NPCI Blocklist
BLOCKLIST_VPAS = ["scammer@okaxis", "badactor@ybl", "mule@paytm", "fraud@icici"]

@router.post("/verify", response_model=dict)
async def verify_upi(req: UPIRequest, db: Session = Depends(get_db)):
    """
    T5 requirement: Check VPA against National Blocklist.
    """
    vpa = req.vpa.lower()
    is_blocked = vpa in BLOCKLIST_VPAS
    
    # Log the verification action
    new_action = SystemAction(
        action_type="UPI_VERIFY",
        target_id=vpa,
        metadata_json={"is_blocked": is_blocked},
        status="success"
    )
    db.add(new_action)
    db.commit()
    
    logger.info(f"UPI VERIFY: {vpa} | Blocked: {is_blocked}")
    
    return {
        "vpa": vpa,
        "is_flagged": is_blocked,
        "risk_level": "CRITICAL" if is_blocked else "SAFE",
        "timestamp": datetime.datetime.utcnow()
    }

@router.post("/freeze", response_model=dict)
async def request_upi_freeze(req: UPIRequest, db: Session = Depends(get_db)):
    """
    T5 requirement: Immediate account freezing request.
    """
    vpa = req.vpa.lower()
    # Simulate API call to NPCI/Bank
    logger.info(f"UPI FREEZE: Request sent to NPCI for {vpa}")
    
    # Update Stats
    stat = db.query(SystemStat).filter(SystemStat.category == "upi", SystemStat.key == "frozen_accounts").first()
    if stat:
        stat.value = str(int(stat.value) + 1)
    else:
        db.add(SystemStat(category="upi", key="frozen_accounts", value="1"))
    
    db.commit()
    
    return {
        "status": "FREEZE_INITIATED",
        "case_id": f"UPI-FRZ-{uuid.uuid4().hex[:6].upper()}",
        "vpa": vpa,
        "eta": "Immediate (Real-time)"
    }


@router.post("/scan-message", response_model=dict)
async def scan_whatsapp_message(req: MessageScanRequest, db: Session = Depends(get_db)):
    """
    Analyzes a pasted message for phishing patterns and extracts VPAs.
    """
    message_text = req.message
    
    # 1. Regex to extract UP VPAs
    # Looks for shapes like name@bank, phone@upi
    vpa_pattern = r'[a-zA-Z0-9.\-_]+@[a-zA-Z]+'
    found_vpas = list(set(re.findall(vpa_pattern, message_text)))
    
    # 2. Check reputation of extracted VPAs
    vpa_analysis = []
    has_blocked_vpa = False
    for v in found_vpas:
        vl = v.lower()
        is_blocked = vl in BLOCKLIST_VPAS
        if is_blocked:
            has_blocked_vpa = True
        vpa_analysis.append({
            "vpa": v,
            "status": "PHISHING" if is_blocked else "SAFE",
            "risk": "CRITICAL" if is_blocked else "LOW"
        })
        
    # 3. AI Contextual Analysis
    from core.ai import honeypot_ai, SARVAM_CHAT_URL
    import httpx
    
    analysis_prompt = (
        "You are a cybersecurity expert analyzing a suspected phishing message. "
        "Determine if the message is a scam. Respond ONLY with a valid JSON object in this exact format: "
        '{"verdict": "RISK" or "SAFE", "confidence": float between 0-100, "pattern_detected": "Short description of the scam pattern or normal message"}'
    )
    
    try:
        response = await honeypot_ai.client.post(
            SARVAM_CHAT_URL,
            headers={"api-subscription-key": honeypot_ai.api_key, "Content-Type": "application/json"},
            json={
                "model": "sarvam-m",
                "messages": [
                    {"role": "system", "content": analysis_prompt},
                    {"role": "user", "content": message_text}
                ],
                "temperature": 0.1,
                "max_tokens": 150
            }
        )
        data = response.json()
        ai_content = data["choices"][0]["message"]["content"]
        
        # safely parse JSON from the response text
        match = re.search(r'\{.*\}', ai_content, re.DOTALL)
        if match:
            ai_result = json.loads(match.group())
        else:
            ai_result = {"verdict": "RISK", "confidence": 85.0, "pattern_detected": "Suspicious formatting detected (AI Parse Error)"}
            
    except Exception as e:
        logger.error(f"Message Scan AI Error: {e}")
        # Fallback if SARVAM fails but we found a blocked VPA
        if has_blocked_vpa:
             ai_result = {"verdict": "RISK", "confidence": 99.9, "pattern_detected": "Known malicious UPI Collector address detected"}
        else:
            # Basic keyword heuristic fallback
            risk_words = ['lottery', 'prize', 'urgent', 'kyc', 'block', 'win']
            is_risk = any(w in message_text.lower() for w in risk_words)
            ai_result = {
                "verdict": "RISK" if is_risk else "SAFE",
                "confidence": 80.0 if is_risk else 90.0,
                "pattern_detected": "Heuristic Keyword Match" if is_risk else "Standard Communication"
            }
            
    # Force RISK if a known blocked VPA is present, overriding AI if it hallucinated SAFE
    if has_blocked_vpa:
        ai_result["verdict"] = "RISK"
        ai_result["confidence"] = max(ai_result.get("confidence", 0), 99.0)

    # Log action
    new_action = SystemAction(
        action_type="SCAN_MESSAGE",
        metadata_json={
            "verdict": ai_result.get("verdict"),
            "msg_length": len(message_text),
            "vpas_found": len(found_vpas)
        },
        status="success"
    )
    db.add(new_action)
    
    # T9 requirement: Automated Crime Reporting
    if ai_result.get("verdict") == "RISK":
        from models.database import CrimeReport
        new_report = CrimeReport(
            report_id=f"CYB-{uuid.uuid4().hex[:6].upper()}",
            category="police",
            scam_type=ai_result.get("pattern_detected", "WhatsApp Phishing"),
            platform="WhatsApp/SMS",
            priority="HIGH" if ai_result.get("confidence", 0) > 90 else "MEDIUM",
            metadata_json={
                "message_sample": message_text[:200],
                "vpas_found": found_vpas,
                "confidence": ai_result.get("confidence")
            }
        )
        db.add(new_report)

    db.commit()

    return {
        "verdict": ai_result.get("verdict", "SAFE"),
        "confidence": ai_result.get("confidence", 0),
        "pattern_detected": ai_result.get("pattern_detected", ""),
        "extracted_vpas": vpa_analysis
    }


@router.post("/scan-qr", response_model=dict)
async def scan_qr_forensic(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Decodes an uploaded QR Image, extracts the payload, and performs forensic mapping.
    """
    try:
        # Lazy import to prevent crash if libzbar is not installed
        try:
            from PIL import Image
            from pyzbar.pyzbar import decode
        except ImportError:
            logger.error("QR scanning libraries not available (libzbar missing)")
            return {
                "success": False,
                "error": "QR scanning is not available on this server (missing libzbar system library).",
                "is_safe": False,
                "payload": "UNAVAILABLE",
                "risk_factors": ["Server Configuration: libzbar not installed"]
            }
        
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Decode the QR Code
        decoded_objects = decode(image)
        
        if not decoded_objects:
            return {
                "success": False,
                "error": "No QR Code detected in the image.",
                "is_safe": False,
                "payload": "UNREADABLE",
                "risk_factors": ["Payload Read Failure"]
            }
            
        # Extract payload from first QR found
        raw_payload = decoded_objects[0].data.decode('utf-8')
        
        is_safe = True
        risk_factors = []
        merchant_vpa = None
        
        # Threat Modeling: 1. Is it a UPI redirect trap?
        if "upi://pay" in raw_payload.lower():
            # Extract the payee address
            match = re.search(r'pa=([^&]+)', raw_payload)
            if match:
                merchant_vpa = match.group(1)
                
                # Check blocklist
                if merchant_vpa.lower() in BLOCKLIST_VPAS:
                    is_safe = False
                    risk_factors.append(f"CRITICAL: Destination VPA ({merchant_vpa}) is on the National Blocklist.")
                    
                # Threat Modeling: 2. Merchant Mismatch / Destination Overlay
                name_match = re.search(r'pn=([^&]+)', raw_payload)
                if name_match:
                    payee_name = name_match.group(1).replace("%20", " ").lower()
                    
                    # Example Heuristic anomaly: Claims to be PM Cares but uses a random generic email domain
                    if "pm" in payee_name and "cares" in payee_name and "sbi" not in merchant_vpa.lower():
                         is_safe = False
                         risk_factors.append("HIGH: Merchant Name (PM Cares) does not align with routing Domain (Destination Overlay Detected).")
                         
        elif raw_payload.startswith("http"):
            # It's an HTTP URI, not a UPI command.
            if not raw_payload.startswith("https"):
                is_safe = False
                risk_factors.append("MEDIUM: Link executes over insecure HTTP protocol.")
                
            # Simulate checking for known phishing domains
            if "win" in raw_payload or "free" in raw_payload or "claim" in raw_payload:
                 is_safe = False
                 risk_factors.append("HIGH: Payload URL matches known malicious redirection signature.")
        else:
            # Random text
            risk_factors.append("UNKNOWN: Payload is standard text, executing no action.")
            
            
        # Build Checklist Results
        payload_validation = True if len(raw_payload) > 0 else False
        tls_validation = True if not "http://" in raw_payload.lower() else False
        merchant_mapping = True if is_safe and merchant_vpa else (False if merchant_vpa and not is_safe else True)
        
        
        # Log Action
        new_action = SystemAction(
            action_type="SCAN_QR",
            metadata_json={
                "payload": raw_payload[:50],
                "is_safe": is_safe,
                "found_vpa": merchant_vpa
            },
            status="success"
        )
        db.add(new_action)

        if not is_safe:
            from models.database import CrimeReport
            new_report = CrimeReport(
                report_id=f"UPI-{uuid.uuid4().hex[:6].upper()}",
                category="bank" if "upi://" in raw_payload.lower() else "police",
                scam_type="Malicious QR Overlay" if "upi://" in raw_payload.lower() else "Phishing QR Redirection",
                amount="₹0 (Pre-emptive)",
                platform="Physical QR/Image",
                priority="CRITICAL",
                metadata_json={
                    "vpa": merchant_vpa,
                    "payload": raw_payload,
                    "risk_factors": risk_factors
                }
            )
            db.add(new_report)

        db.commit()
        
        return {
            "success": True,
            "is_safe": is_safe,
            "payload": raw_payload,
            "merchant_vpa": merchant_vpa,
            "risk_factors": risk_factors,
            "checks": {
                "payload": payload_validation,
                "tls": tls_validation,
                "merchant": merchant_mapping
            }
        }
    except Exception as e:
        logger.error(f"QR Decode Error: {e}")
        return {
            "success": False,
            "error": "Failed to process the QR image file format.",
            "is_safe": False,
            "payload": "CORRUPT_PAYLOAD",
            "risk_factors": ["File Corruption"]
        }
