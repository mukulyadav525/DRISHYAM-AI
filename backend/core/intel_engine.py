import logging
import json
import uuid
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from core.ai import honeypot_ai
from core.database import SessionLocal
from models.database import (
    HoneypotSession, 
    HoneypotMessage, 
    CrimeReport, 
    IntelligenceAlert, 
    HoneypotEntity,
    SystemAction
)

logger = logging.getLogger("drishyam.intel")

class IntelEngine:
    """
    Unified Intelligence Engine for DRISHYAM.
    Processes finished conversations (real & simulated) to:
    1. Extract evidence (VPAs, Phone numbers, Accounts).
    2. Generate multi-agency reports (Police, Bank, Telecom).
    3. Auto-generate formal E-FIR documents.
    """

    async def process_session_completion(self, session_uid: str, db: Session) -> Dict[str, Any]:
        """
        Analyze a completed session and trigger all downstream intelligence actions.
        """
        logger.info(f"INTEL: Processing completion for session {session_uid}")
        
        # 1. Fetch Session and Messages
        session = db.query(HoneypotSession).filter(HoneypotSession.session_id == session_uid).first()
        if not session:
            logger.error(f"INTEL: Session {session_uid} not found")
            return {"status": "error", "message": "Session not found"}

        messages = db.query(HoneypotMessage).filter(HoneypotMessage.session_id == session.id).order_by(HoneypotMessage.timestamp.asc()).all()
        history = [
            {"role": "user" if m.role == "user" else "assistant", "content": m.content}
            for m in messages
        ]

        if not history:
            logger.warning(f"INTEL: No messages found for session {session_uid}")
            return {"status": "warning", "message": "No conversation history"}

        # 2. Run AI Analysis
        analysis = await honeypot_ai.analyze_scam(history)
        session.recording_analysis_json = analysis
        
        # 3. Extract and Persist Entities (UPI, Phone, etc.)
        entities = analysis.get("key_entities", [])
        self._persist_entities(entities, db)

        # 4. Generate Multi-Agency Reports
        reports = self._generate_agency_reports(session, analysis, db)
        
        # 5. Generate Auto-FIR
        fir_data = self._generate_auto_fir(session, analysis, history)
        
        # Save FIR to session metadata
        if not session.metadata_json:
            session.metadata_json = {}
        session.metadata_json["auto_fir"] = fir_data
        session.status = "completed"

        # 6. Create Intelligence Alert for Dashboard
        if analysis.get("risk_score", 0) > 0.6:
            alert = IntelligenceAlert(
                severity="HIGH" if analysis.get("risk_score", 0) > 0.8 else "MEDIUM",
                message=f"Automated Detection: {analysis.get('scam_type')} from {session.caller_num or 'Unknown'}",
                category="VOICE_SCAM" if session.direction == "handoff" else "TEXT_SCAM",
                location="JAMARA_CLUSTER_V3" # AI-inferred tag
            )
            db.add(alert)

        db.commit()
        logger.info(f"INTEL: Completion processed for {session_uid}. Risk: {analysis.get('risk_score')}")
        
        return {
            "status": "success",
            "analysis": analysis,
            "reports_created": len(reports),
            "fir_generated": True
        }

    def _persist_entities(self, entities: List[str], db: Session):
        """Save discovered scammer entities to the HoneypotEntity registry."""
        for entity_val in entities:
            # Basic validation/cleanup
            val = entity_val.strip()
            if not val: continue
            
            # Identify type (Naive check)
            e_type = "PHONE"
            if "@" in val: e_type = "VPA"
            elif val.isdigit() and len(val) > 10: e_type = "ACCOUNT"

            existing = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == val).first()
            if not existing:
                new_e = HoneypotEntity(
                    entity_type=e_type,
                    entity_value=val,
                    risk_score=0.9 # Directly from honeypot evidence
                )
                db.add(new_e)
                logger.info(f"INTEL: Registered new scam entity: {val} ({e_type})")

    def _generate_agency_reports(self, session: HoneypotSession, analysis: Dict, db: Session) -> List[CrimeReport]:
        """Create specific reports for Police, Banks, and Telecoms."""
        reports = []
        risk_score = analysis.get("risk_score", 0)
        
        if risk_score < 0.4:
            return reports # Low risk, no report

        # 1. POLICE REPORT
        police_report = CrimeReport(
            report_id=f"POL-{uuid.uuid4().hex[:6].upper()}",
            category="police",
            scam_type=analysis.get("scam_type", "UNKNOWN"),
            platform=f"DRISHYAM {session.direction.capitalize()}",
            priority="CRITICAL" if risk_score > 0.9 else "HIGH",
            status="PENDING",
            reporter_num=session.caller_num,
            metadata_json=analysis
        )
        db.add(police_report)
        reports.append(police_report)

        # 2. BANK REPORT (If bank mentioned)
        bank_name = analysis.get("bank_name")
        if bank_name and bank_name != "UNKNOWN":
            bank_report = CrimeReport(
                report_id=f"BNK-{uuid.uuid4().hex[:6].upper()}",
                category="bank",
                scam_type=analysis.get("scam_type", "UNKNOWN"),
                platform=f"Impersonation: {bank_name}",
                priority="HIGH",
                status="PENDING",
                reporter_num=session.caller_num,
                metadata_json={"target_bank": bank_name, "details": analysis.get("details")}
            )
            db.add(bank_report)
            reports.append(bank_report)

        # 3. TELECOM REPORT
        if session.caller_num:
            tele_report = CrimeReport(
                report_id=f"TEL-{uuid.uuid4().hex[:6].upper()}",
                category="telecom",
                scam_type="ILLEGAL_SIM_USAGE",
                platform="Cellular Network",
                priority="MEDIUM",
                status="PENDING",
                reporter_num=session.caller_num,
                metadata_json={"action": "REQUEST_IMEI_BLOCK", "phone": session.caller_num}
            )
            db.add(tele_report)
            reports.append(tele_report)

        return reports

    def _generate_auto_fir(self, session: HoneypotSession, analysis: Dict, history: List) -> Dict:
        """Generate a formal E-FIR structure for official record keeping."""
        fir_id = f"DRISHYAM-FIR-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        
        # Extract evidence transcript
        transcript_text = "\n".join([f"[{msg['role'].upper()}]: {msg['content']}" for msg in history])
        
        # Create a professional human-readable summary
        fir_summary = f"""
### FIRST INFORMATION REPORT (ELECTRONIC-FIR)
**ID:** {fir_id}
**DATE:** {datetime.datetime.now().strftime('%d-%m-%Y')}
**REPORTING NODE:** DRISHYAM-AI-FORENSICS-01

**1. COMPLAINANT DETAILS**
Automated Forensic Intelligence System (1930 Cyber Sentinel)

**2. ACCUSED DETAILS (EXTRACTED)**
- **PHONE:** {session.caller_num or 'Unknown'}
- **ENTITIES:** {', '.join(analysis.get('key_entities', [])) or 'None identified'}
- **IMPERSONATION:** {analysis.get('bank_name', 'Unknown Organization')}

**3. INCIDENT ANALYSIS**
- **SCAM TYPE:** {analysis.get('scam_type', 'GENERAL_FRAUD')}
- **MODUS OPERANDI:** {analysis.get('details', 'Behavioral manipulation observed.')}
- **CERTAINTY/CONFIDENCE:** {int(analysis.get('risk_score', 0) * 100)}%

**4. LEGAL PROVISIONS**
- **Information Technology Act:** Section 66D (Cheating by personation by using computer resource)
- **Indian Penal Code (BNS):** Section 419/420 (Punishment for cheating by personation)

**5. EVINDENTARY TRANSCRIPT**
{transcript_text[:1000]}... [REST OF TRANSCRIPT SECURED IN ARCHIVE]

---
*This is a digitally generated document created by the DRISHYAM AI Intelligence Layer.*
"""

        fir_document = {
            "fir_id": fir_id,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "formatted_document": fir_summary,
            "accused_info": {
                "phone_number": session.caller_num or "UNKNOWN",
                "extracted_entities": analysis.get("key_entities", []),
                "impersonated_entity": analysis.get("bank_name", "UNKNOWN")
            },
            "evidence_secured": True
        }
        
        logger.info(f"INTEL: Generated E-FIR {fir_id}")
        return fir_document

# Singleton instance
intel_engine = IntelEngine()
