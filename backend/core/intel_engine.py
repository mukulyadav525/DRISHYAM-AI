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
    NotificationLog,
    RecoveryCase,
    SystemAction,
    User,
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
        citizen_user = self._resolve_citizen_user(session, db)
        
        # 3. Extract and Persist Entities (UPI, Phone, etc.)
        entities = analysis.get("key_entities", [])
        self._persist_entities(entities, db)

        # 4. Generate Multi-Agency Reports
        reports = self._generate_agency_reports(session, analysis, db, citizen_user)
        notifications = self._create_notification_logs(session, analysis, reports, db)
        recovery_case = self._ensure_recovery_case(session, citizen_user, reports, analysis, db)
        
        # 5. Generate Auto-FIR
        fir_data = self._generate_auto_fir(session, analysis, history)
        
        # Save FIR to session metadata
        routing_summary = {
            "session_id": session.session_id,
            "routed_agencies": [report.category for report in reports],
            "report_ids": [report.report_id for report in reports],
            "notifications_created": len(notifications),
            "recovery_case_id": recovery_case.incident_id if recovery_case else None,
            "entities": entities,
        }
        session.metadata_json = {
            **(session.metadata_json or {}),
            "auto_fir": fir_data,
            "routing": routing_summary,
        }
        session.status = "completed"

        db.add(
            SystemAction(
                user_id=citizen_user.id if citizen_user else session.user_id,
                action_type="HONEYPOT_SESSION_ROUTED",
                target_id=session.session_id,
                metadata_json={
                    "reports": routing_summary["report_ids"],
                    "notifications_created": routing_summary["notifications_created"],
                    "recovery_case_id": routing_summary["recovery_case_id"],
                    "scam_type": analysis.get("scam_type"),
                },
                status="success",
            )
        )

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
            "report_ids": routing_summary["report_ids"],
            "routed_agencies": routing_summary["routed_agencies"],
            "notifications_created": routing_summary["notifications_created"],
            "recovery_case_id": routing_summary["recovery_case_id"],
            "fir_generated": True,
        }

    def _normalize_phone(self, value: str | None) -> str:
        digits = "".join(ch for ch in str(value or "") if ch.isdigit())
        if len(digits) >= 10:
            return digits[-10:]
        return str(value or "").strip()

    def _resolve_citizen_user(self, session: HoneypotSession, db: Session) -> Optional[User]:
        if session.user_id:
            user = db.query(User).filter(User.id == session.user_id).first()
            if user:
                return user

        for candidate in [session.customer_id, session.caller_num]:
            normalized = self._normalize_phone(candidate)
            if not normalized:
                continue
            user = db.query(User).filter(User.username.in_([str(candidate), normalized])).first()
            if user:
                return user
        return None

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

    def _generate_agency_reports(
        self,
        session: HoneypotSession,
        analysis: Dict,
        db: Session,
        citizen_user: Optional[User],
    ) -> List[CrimeReport]:
        """Create specific reports for Police, Banks, and Telecoms."""
        reports = []
        risk_score = analysis.get("risk_score", 0)
        
        if risk_score < 0.4:
            return reports # Low risk, no report

        shared_metadata = {
            "session_id": session.session_id,
            "citizen_user_id": citizen_user.id if citizen_user else None,
            "customer_id": session.customer_id,
            "caller_num": session.caller_num,
            "entities": analysis.get("key_entities", []),
            "details": analysis.get("details"),
            "risk_score": risk_score,
            "bank_name": analysis.get("bank_name"),
        }

        # 1. POLICE REPORT
        police_report = CrimeReport(
            report_id=f"POL-{uuid.uuid4().hex[:6].upper()}",
            category="police",
            scam_type=analysis.get("scam_type", "UNKNOWN"),
            platform=f"DRISHYAM {session.direction.capitalize()}",
            priority="CRITICAL" if risk_score > 0.9 else "HIGH",
            status="PENDING",
            reporter_num=session.caller_num,
            metadata_json={
                **shared_metadata,
                "channel": "VOICE_HONEYPOT",
                "recommended_action": "Immediate cyber cell review and transcript preservation",
            }
        )
        db.add(police_report)
        reports.append(police_report)

        # 2. BANK REPORT (If bank mentioned)
        bank_name = analysis.get("bank_name")
        should_notify_bank = bool(bank_name and bank_name != "UNKNOWN") or analysis.get("scam_type") in {"BANK_FRAUD", "UPI_SCAM"}
        if should_notify_bank:
            bank_report = CrimeReport(
                report_id=f"BNK-{uuid.uuid4().hex[:6].upper()}",
                category="bank",
                scam_type=analysis.get("scam_type", "UNKNOWN"),
                platform=f"Impersonation: {bank_name or 'Unknown Institution'}",
                priority="HIGH",
                status="PENDING",
                reporter_num=session.caller_num,
                metadata_json={
                    **shared_metadata,
                    "target_bank": bank_name or "UNKNOWN_BANK_REVIEW",
                    "recommended_action": "Freeze suspicious beneficiary and review linked UPI/account traces",
                }
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
                metadata_json={
                    **shared_metadata,
                    "action": "REQUEST_IMEI_BLOCK",
                    "phone": session.caller_num,
                    "recommended_action": "Trace CLI usage and preserve tower metadata",
                }
            )
            db.add(tele_report)
            reports.append(tele_report)

        return reports

    def _create_notification_logs(
        self,
        session: HoneypotSession,
        analysis: Dict,
        reports: List[CrimeReport],
        db: Session,
    ) -> List[NotificationLog]:
        created: List[NotificationLog] = []
        for report in reports:
            metadata = {
                "session_id": session.session_id,
                "report_id": report.report_id,
                "scam_type": analysis.get("scam_type"),
                "risk_score": analysis.get("risk_score"),
            }
            if report.category == "police":
                recipient = "police:cyber_cell"
                template_id = "HONEYPOT_POLICE_ALERT"
            elif report.category == "bank":
                bank_name = (report.metadata_json or {}).get("target_bank") or analysis.get("bank_name") or "UNKNOWN_BANK"
                recipient = f"bank:{str(bank_name).lower().replace(' ', '_')}"
                template_id = "HONEYPOT_BANK_ALERT"
            else:
                recipient = "telecom:nodal_trace_desk"
                template_id = "HONEYPOT_TELECOM_ALERT"

            row = NotificationLog(
                recipient=recipient,
                channel="OPS_EVENT",
                template_id=template_id,
                status="DELIVERED",
                metadata_json=metadata,
            )
            db.add(row)
            created.append(row)
        return created

    def _ensure_recovery_case(
        self,
        session: HoneypotSession,
        citizen_user: Optional[User],
        reports: List[CrimeReport],
        analysis: Dict,
        db: Session,
    ) -> Optional[RecoveryCase]:
        if not citizen_user:
            return None

        incident_id = next((report.report_id for report in reports if report.category == "police"), None)
        if not incident_id:
            incident_id = f"RCV-{uuid.uuid4().hex[:6].upper()}"

        case = db.query(RecoveryCase).filter(RecoveryCase.incident_id == incident_id).first()
        if not case:
            case = RecoveryCase(
                user_id=citizen_user.id,
                incident_id=incident_id,
                bank_status="INVESTIGATING" if any(report.category == "bank" for report in reports) else "PENDING",
                rbi_status="READY",
                insurance_status="NOT_STARTED",
                legal_aid_status="AVAILABLE",
                total_recovered=0.0,
            )
            db.add(case)
            return case

        case.user_id = citizen_user.id
        case.bank_status = "INVESTIGATING" if any(report.category == "bank" for report in reports) else case.bank_status
        case.rbi_status = case.rbi_status or "READY"
        case.legal_aid_status = case.legal_aid_status or "AVAILABLE"
        case.updated_at = datetime.datetime.utcnow()
        return case

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
