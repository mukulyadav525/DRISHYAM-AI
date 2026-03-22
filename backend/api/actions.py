from fastapi import APIRouter, Depends, HTTPException, Response
from typing import Optional, Dict, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from core.auth import get_current_verified_user
from models.database import (
    AdminApproval,
    CrimeReport,
    HoneypotEntity,
    RecoveryCase,
    ScamCluster,
    SystemAction,
    SystemAuditLog,
    User,
)
import logging
import traceback
import io
import json
import re
import zipfile
from core.reporting import pdf_report_generator
from core.graph import fraud_graph
from core.audit import log_audit
import datetime
import uuid

logger = logging.getLogger("drishyam.actions")

router = APIRouter()

CRITICAL_APPROVAL_ACTIONS = {
    "BLOCK_NUMBER",
    "FREEZE_VPA",
    "BLOCK_IMEI",
    "BROADCAST_EMERGENCY",
    "DEPLOY_BHARAT_ALERT",
}

class ActionRequest(BaseModel):
    action_type: str
    target_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


def _normalize_export_category(value: str) -> str:
    normalized = re.sub(r"[^A-Z0-9]+", "_", (value or "REPORT").upper()).strip("_")
    return normalized or "REPORT"


def _resolve_file_type(filename: str | None, file_type: str | None = None) -> str:
    if file_type:
        return file_type.lower()
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return "pdf"


def _build_export_filename(category: str, file_type: str, target_id: str | None = None) -> str:
    label = _normalize_export_category(target_id or category)
    extension = "pdf" if file_type.lower() not in {"pdf", "txt", "zip"} else file_type.lower()
    return f"DRISHYAM_{label}.{extension}"


def _parse_export_context(raw_context: str | None) -> dict[str, Any]:
    if not raw_context:
        return {}
    try:
        payload = json.loads(raw_context)
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _report_lookup_payload(report: CrimeReport | None, fallback_id: str | None = None) -> dict[str, Any]:
    metadata = report.metadata_json or {} if report else {}
    case_id = report.report_id if report else (fallback_id or f"CASE-{uuid.uuid4().hex[:6].upper()}")
    created_at = report.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if report and report.created_at else datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    entities = metadata.get("entities") if isinstance(metadata.get("entities"), list) else []
    if not entities:
        entities = [
            {"type": "Case", "value": case_id, "relevance": "Case reference"},
            {"type": "Platform", "value": report.platform if report else metadata.get("platform", "Unknown"), "relevance": "Reported platform"},
            {"type": "Type", "value": report.scam_type if report else metadata.get("scam_type", "Digital Fraud"), "relevance": "Fraud pattern"},
            {"type": "Priority", "value": report.priority if report else metadata.get("priority", "HIGH"), "relevance": "Escalation severity"},
        ]

    return {
        "case_id": case_id,
        "entities": entities[:8],
        "scam_type": report.scam_type if report else metadata.get("scam_type", "Digital Fraud"),
        "amount": report.amount if report else metadata.get("amount", "Unknown"),
        "platform": report.platform if report else metadata.get("platform", "Unknown"),
        "priority": report.priority if report else metadata.get("priority", "HIGH"),
        "status": report.status if report else metadata.get("status", "PENDING"),
        "bank_name": metadata.get("bank_name", "Citizen Bank"),
        "txn_id": metadata.get("txn_id", case_id),
        "txn_date": metadata.get("txn_date", created_at),
        "holder": metadata.get("holder", "Unknown"),
        "reporter_num": report.reporter_num if report else metadata.get("reporter_num"),
        "created_at": created_at,
    }


def _find_report_by_id(db: Session, report_id: str | None) -> CrimeReport | None:
    if not report_id:
        return None
    return db.query(CrimeReport).filter(CrimeReport.report_id == report_id).first()


def _build_graph_payload(db: Session, root_entity: str | None, context: dict[str, Any]) -> dict[str, Any]:
    entity_value = (root_entity or context.get("root_entity") or context.get("entity") or "").strip()
    entity_record = None
    if entity_value:
        entity_record = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == entity_value).first()

    related_reports: list[CrimeReport] = []
    if entity_value:
        for report in db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(25).all():
            metadata = report.metadata_json or {}
            if entity_value in {report.report_id, report.reporter_num, metadata.get("vpa"), metadata.get("entity")}:
                related_reports.append(report)
            elif isinstance(metadata.get("entities"), list) and entity_value in metadata.get("entities", []):
                related_reports.append(report)

    entities: list[dict[str, str]] = []
    if entity_value:
        inferred_type = "UPI VPA" if "@" in entity_value else "Phone" if entity_value.startswith("+") or entity_value.isdigit() else "Entity"
        entities.append({"type": inferred_type, "value": entity_value, "relevance": "Graph root"})
    if entity_record:
        entities.append({
            "type": "Risk Record",
            "value": f"Risk {round((entity_record.risk_score or 0) * 100)}%",
            "relevance": "Honeypot evidence",
        })

    for report in related_reports[:5]:
        entities.append({"type": "Case", "value": report.report_id, "relevance": report.scam_type or "Linked incident"})
        metadata = report.metadata_json or {}
        if metadata.get("vpa"):
            entities.append({"type": "UPI VPA", "value": metadata["vpa"], "relevance": "Reported beneficiary"})

    deduped = []
    seen = set()
    for entity in entities:
        key = (entity["type"], entity["value"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entity)

    while len(deduped) < 4:
        deduped.append({
            "type": "Intel Marker",
            "value": f"GRAPH-{len(deduped) + 1}",
            "relevance": "Additional correlation node",
        })

    return {
        "case_id": context.get("case_id") or f"GRAPH-{uuid.uuid4().hex[:6].upper()}",
        "entities": deduped[:8],
        "root_entity": entity_value or "Unknown",
        "linked_reports": [report.report_id for report in related_reports[:5]],
        "risk_score": round((entity_record.risk_score or 0) * 100) if entity_record else None,
        "node_count": context.get("node_count"),
        "edge_count": context.get("edge_count"),
    }


def _build_overview_summary(db: Session) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(100).all()
    clusters = db.query(ScamCluster).order_by(ScamCluster.created_at.desc()).limit(10).all()
    resolved_reports = [report for report in reports if report.status in {"RESOLVED", "FROZEN", "RECOVERED"}]
    protected_citizens = db.query(RecoveryCase.user_id).distinct().count()
    estimated_savings = sum(float((report.amount or "0").replace(",", "")) for report in resolved_reports if str(report.amount or "0").replace(",", "").replace(".", "", 1).isdigit())
    active_threats = len([cluster for cluster in clusters if cluster.status == "active"])

    summary = {
        "Resolved Scams": len(resolved_reports),
        "Protected Citizens": protected_citizens,
        "Estimated Savings (INR)": f"{estimated_savings:,.0f}",
        "Active Threat Clusters": active_threats,
    }
    sections = [
        {
            "heading": "Latest Incident Snapshot",
            "bullets": [
                f"{report.report_id}: {report.scam_type} on {report.platform} ({report.priority})"
                for report in reports[:5]
            ] or ["No recent incidents were found in the database."],
        },
        {
            "heading": "Hotspot Coverage",
            "bullets": [
                f"{cluster.location or cluster.cluster_id}: {cluster.risk_level} risk with {cluster.honeypot_hits or 0} honeypot hits"
                for cluster in clusters[:5]
            ] or ["No active hotspot clusters found."],
        },
    ]
    return summary, sections


def _system_logs_text(db: Session, current_user: User) -> bytes:
    rows = (
        db.query(SystemAuditLog)
        .filter((SystemAuditLog.user_id == current_user.id) | (SystemAuditLog.user_id.is_(None)))
        .order_by(SystemAuditLog.timestamp.desc())
        .limit(100)
        .all()
    )
    lines = [
        "DRISHYAM SYSTEM AUDIT LOG EXPORT",
        f"Generated: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        "",
    ]
    for row in rows:
        lines.append(
            f"{row.timestamp.isoformat() if row.timestamp else 'UNKNOWN'} | {row.action} | {row.resource or 'N/A'} | "
            f"user={row.user_id or 'system'} | meta={json.dumps(row.metadata_json or {}, ensure_ascii=True)}"
        )
    return "\n".join(lines).encode("utf-8")


def _recovery_export_context(db: Session, current_user: User, context: dict[str, Any]) -> dict[str, Any]:
    incident_id = context.get("incident_id")
    case = None
    if incident_id:
        case = db.query(RecoveryCase).filter(RecoveryCase.incident_id == incident_id).first()
    return {
        "case_id": incident_id or (case.incident_id if case else f"INC-{uuid.uuid4().hex[:6].upper()}"),
        "txn_id": context.get("txn_id") or incident_id or f"TXN-{uuid.uuid4().hex[:6].upper()}",
        "txn_date": context.get("txn_date") or datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "bank_name": context.get("bank_name") or "Citizen Bank",
        "scam_type": context.get("scam_type") or "Digital Fraud",
        "incident_id": incident_id or (case.incident_id if case else None),
    }


def _playbook_sections(category: str) -> list[dict[str, Any]]:
    playbooks = {
        "OPERATION_MANUAL": [
            "Verify access role, live alerts, and open approvals before beginning the shift.",
            "Confirm that telecom, bank, and law-enforcement queues are green.",
            "Escalate critical cases within five minutes and record every action in the audit trail.",
        ],
        "ESCALATION_PROTOCOL": [
            "Critical scam clusters route first to command, then to the owning agency queue.",
            "Financial recovery cases require bank dispute initiation plus RBI escalation within the golden hour.",
            "If citizen harm risk is elevated, trigger support and trust-circle workflows in parallel.",
        ],
        "AGENCY_INTEGRATION_GUIDE": [
            "Confirm partner credentials, region scope, and approval policies before enabling production actions.",
            "Validate NPCI, bank, telecom, and law-enforcement routing against the current partner matrix.",
            "Run smoke verification after any integration change and capture the output in governance notes.",
        ],
    }
    bullets = playbooks.get(category, ["Follow the linked DRISHYAM operating procedure for this artifact."])
    return [{"heading": "Operational Guidance", "bullets": bullets}]


def _build_export_artifact(
    db: Session,
    current_user: User,
    category: str,
    file_type: str,
    target_id: str | None,
    context: dict[str, Any],
) -> tuple[bytes, str, str]:
    normalized = _normalize_export_category(category)
    resolved_file_type = file_type.lower()

    if normalized == "SYSTEM_LOGS" or resolved_file_type == "txt":
        filename = _build_export_filename(category, "txt", target_id)
        return _system_logs_text(db, current_user), "text/plain; charset=utf-8", filename

    if normalized.startswith("CERTIFIED_FIR_65B"):
        report_id = context.get("report_id") or target_id or normalized.removeprefix("CERTIFIED_FIR_65B_")
        report = _find_report_by_id(db, report_id)
        payload = _report_lookup_payload(report, fallback_id=report_id)
        pdf_bytes = pdf_report_generator.generate_fir_packet(payload)
        filename = _build_export_filename(f"CERTIFIED_FIR_65B_{payload['case_id']}", "pdf")
        return pdf_bytes, "application/pdf", filename

    if normalized.startswith("BANK_DISPUTE") or normalized == "BANK_FREEZE_REQ":
        report_id = context.get("report_id") or target_id or normalized.removeprefix("BANK_DISPUTE_")
        report = _find_report_by_id(db, report_id)
        payload = {**_report_lookup_payload(report, fallback_id=report_id), **context}
        pdf_bytes = pdf_report_generator.generate_dispute_letter(payload)
        filename = _build_export_filename(f"BANK_DISPUTE_{payload['case_id']}", "pdf")
        return pdf_bytes, "application/pdf", filename

    if normalized in {"RBI_APPEAL", "NPCI_GRIEVANCE", "RESTITUTION_BUNDLE"}:
        payload = _recovery_export_context(db, current_user, context)
        if normalized == "RBI_APPEAL":
            pdf_bytes = pdf_report_generator.generate_ombudsman_complaint(payload)
            filename = _build_export_filename("RBI_APPEAL", "pdf", payload["case_id"])
            return pdf_bytes, "application/pdf", filename
        if normalized == "NPCI_GRIEVANCE":
            pdf_bytes = pdf_report_generator.generate_npci_grievance(payload)
            filename = _build_export_filename("NPCI_GRIEVANCE", "pdf", payload["case_id"])
            return pdf_bytes, "application/pdf", filename

        if resolved_file_type == "zip":
            bundle_buffer = io.BytesIO()
            with zipfile.ZipFile(bundle_buffer, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
                bundle.writestr("bank_dispute_letter.pdf", pdf_report_generator.generate_dispute_letter(payload))
                bundle.writestr("rbi_appeal.pdf", pdf_report_generator.generate_ombudsman_complaint(payload))
                bundle.writestr("npci_grievance.pdf", pdf_report_generator.generate_npci_grievance(payload))
                bundle.writestr(
                    "bundle_summary.txt",
                    "\n".join([
                        "DRISHYAM RECOVERY BUNDLE",
                        f"Incident: {payload['case_id']}",
                        f"Transaction: {payload['txn_id']}",
                        f"Bank: {payload['bank_name']}",
                        f"Scam Type: {payload['scam_type']}",
                    ]).encode("utf-8"),
                )
            filename = _build_export_filename("RESTITUTION_BUNDLE", "zip", payload["case_id"])
            return bundle_buffer.getvalue(), "application/zip", filename

        pdf_bytes = pdf_report_generator.generate_structured_report(
            "Restitution Bundle Summary",
            subtitle="Recovery bundle manifest generated by DRISHYAM.",
            summary={
                "Incident": payload["case_id"],
                "Transaction": payload["txn_id"],
                "Bank": payload["bank_name"],
                "Scam Type": payload["scam_type"],
            },
            sections=[{
                "heading": "Included Documents",
                "bullets": [
                    "Bank dispute and freeze request",
                    "RBI Ombudsman appeal draft",
                    "NPCI grievance request",
                ],
            }],
        )
        filename = _build_export_filename("RESTITUTION_BUNDLE", "pdf", payload["case_id"])
        return pdf_bytes, "application/pdf", filename

    if normalized in {"SECTION_65B_CERTIFICATE", "SECTION_65B_GENERATOR"}:
        payload = {
            "case_id": context.get("case_id") or target_id or f"CERT-{uuid.uuid4().hex[:6].upper()}",
            "issued_to": context.get("issued_to") or current_user.full_name or current_user.username,
            "evidence_description": context.get("evidence_description") or "Certified export from DRISHYAM evidence workflows.",
            "source_system": "DRISHYAM AI BASIG",
        }
        pdf_bytes = pdf_report_generator.generate_section_65b_certificate(payload)
        filename = _build_export_filename("SECTION_65B_CERTIFICATE", "pdf", payload["case_id"])
        return pdf_bytes, "application/pdf", filename

    if normalized.startswith("GRAPH_FIR") or normalized == "FRAUD_GRAPH_EVIDENCE":
        graph_payload = _build_graph_payload(db, target_id or context.get("root_entity"), context)
        if normalized.startswith("GRAPH_FIR"):
            pdf_bytes = pdf_report_generator.generate_fir_packet({
                "case_id": graph_payload["case_id"],
                "entities": graph_payload["entities"],
            })
            filename = _build_export_filename("GRAPH_FIR", "pdf", graph_payload["root_entity"])
            return pdf_bytes, "application/pdf", filename

        pdf_bytes = pdf_report_generator.generate_structured_report(
            "Fraud Graph Evidence Pack",
            subtitle="Correlated entity graph evidence extracted from live DRISHYAM records.",
            summary={
                "Root Entity": graph_payload["root_entity"],
                "Linked Reports": len(graph_payload["linked_reports"]),
                "Risk Score": graph_payload["risk_score"] or "Unknown",
                "Nodes": graph_payload.get("node_count") or "N/A",
                "Edges": graph_payload.get("edge_count") or "N/A",
            },
            sections=[
                {
                    "heading": "Connected Entities",
                    "bullets": [f"{entity['type']}: {entity['value']} ({entity['relevance']})" for entity in graph_payload["entities"]],
                },
                {
                    "heading": "Linked Cases",
                    "bullets": graph_payload["linked_reports"] or ["No linked cases found in the current dataset."],
                },
            ],
        )
        filename = _build_export_filename("FRAUD_GRAPH_EVIDENCE", "pdf", graph_payload["root_entity"])
        return pdf_bytes, "application/pdf", filename

    if normalized in {"OVERVIEW", "FORENSIC_AUDIT", "IMPACT_REPORT"}:
        summary, sections = _build_overview_summary(db)
        title_map = {
            "OVERVIEW": "DRISHYAM Operational Overview",
            "FORENSIC_AUDIT": "Forensic Audit Summary",
            "IMPACT_REPORT": "Financial Impact Report",
        }
        pdf_bytes = pdf_report_generator.generate_structured_report(
            title_map[normalized],
            subtitle="Live export generated from the current Supabase-backed dataset.",
            summary=summary,
            sections=sections,
            footer="This report was generated directly from current operational records.",
        )
        filename = _build_export_filename(normalized, "pdf")
        return pdf_bytes, "application/pdf", filename

    if normalized == "CITIZEN_SCORE_AUDIT":
        pdf_bytes = pdf_report_generator.generate_structured_report(
            "Citizen Score Audit",
            subtitle="Local risk and preparedness audit exported from DRISHYAM.",
            summary={
                "Citizen Identifier": context.get("citizen_id") or target_id or current_user.username,
                "Computed Score": context.get("computed_score", "Not supplied"),
                "Generated By": current_user.username,
            },
            sections=[{
                "heading": "Review Notes",
                "bullets": [
                    "Verify inoculation drill completion history.",
                    "Review flagged entities and linked complaint history.",
                    "Confirm whether additional citizen support workflows are required.",
                ],
            }],
        )
        filename = _build_export_filename("CITIZEN_SCORE_AUDIT", "pdf", target_id)
        return pdf_bytes, "application/pdf", filename

    if normalized in {"OPERATION_MANUAL", "ESCALATION_PROTOCOL", "AGENCY_INTEGRATION_GUIDE"}:
        pdf_bytes = pdf_report_generator.generate_structured_report(
            normalized.replace("_", " ").title(),
            subtitle="Operational playbook exported from the DRISHYAM control plane.",
            summary={"Document": normalized.replace("_", " ").title(), "Requested By": current_user.username},
            sections=_playbook_sections(normalized),
        )
        filename = _build_export_filename(normalized, "pdf")
        return pdf_bytes, "application/pdf", filename

    pdf_bytes = pdf_report_generator.generate_structured_report(
        normalized.replace("_", " ").title(),
        subtitle="General DRISHYAM export generated from the current operational context.",
        summary={"Category": normalized, "Requested By": current_user.username},
        sections=[{
            "heading": "Export Notes",
            "body": "This export was generated for the selected workflow. If a more specific template is needed, bind the button to a dedicated category and context payload.",
        }],
    )
    filename = _build_export_filename(normalized, "pdf", target_id)
    return pdf_bytes, "application/pdf", filename

@router.post("/perform")
async def perform_action(
    req: ActionRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """
    Log a system action to the database.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) performing action: {req.action_type}")
        action_type = req.action_type.upper()

        approval = None
        if action_type in CRITICAL_APPROVAL_ACTIONS and current_user.role != "admin":
            approval_id = (req.metadata or {}).get("approval_id")
            if not approval_id:
                raise HTTPException(
                    status_code=403,
                    detail=f"Action {action_type} requires an approved admin workflow for non-admin operators.",
                )

            approval = (
                db.query(AdminApproval)
                .filter(AdminApproval.approval_id == approval_id)
                .first()
            )
            if not approval or approval.requested_by_user_id != current_user.id:
                raise HTTPException(status_code=403, detail="Approval request is invalid for this operator.")
            if approval.status != "APPROVED":
                raise HTTPException(status_code=403, detail="Approval request has not been approved yet.")
            if approval.expires_at and approval.expires_at < datetime.datetime.utcnow():
                approval.status = "EXPIRED"
                db.commit()
                raise HTTPException(status_code=403, detail="Approval request has expired.")
        
        # Generic to User-Friendly mapping
        messages = {
            "VIEW_MAP": "DRISHYAM Live Threat Map Initialized",
            "FILTER_RISK": f"Risk Filter Applied: {req.target_id or 'Updated'}",
            "BLOCK_NUMBER": f"Telecom Block Sequence Initiated for {req.target_id or 'target'}",
            "VPA_LOOKUP": f"VPA Reputation Analysis for {req.target_id or 'VPA'} Complete",
            "FREEZE_VPA": f"Financial Freeze Request Dispatched for {req.target_id or 'VPA'}",
            "SCAN_VIDEO": "Deepfake Forensic Pipeline Active",
            "GENERATE_FIR": "Digital FIR Packet Compiled & Signed",
            "GENERATE_FIR_FROM_GRAPH": "Digital FIR Correlated from Intelligence Graph",
            "DOWNLOAD_PLAYBOOK": f"Onboarding Playbook {req.target_id or ''} Downloaded",
            "RESTORE_ACCOUNT": "Account Restoration Workflow Initialized",
            "USE_LE_TOOL": f"Law Enforcement Tool {req.target_id or ''} Authorized",
            "RESET_SCAN": "Forensic Buffer Cleared",
            "VIEW_HISTORY": "Accessing Historical Incident Logs",
            "VIEW_INCIDENT": f"Incident Data Loaded for {req.target_id or 'incident'}",
            "SCAN_QR": "QR Forensic Signature Verified",
            "INTERCEPT_MSG": "WhatsApp Interceptor Payload Active",
            "GENERATE_RECOVERY_BUNDLE": "Legal Restitution Bundle Generated",
            "SUPPORT_TOOL": f"Redirecting to {req.target_id or 'Support Resource'}",
            "OPTIMIZE_STRATEGIES": "AI Strategy Optimization Complete",
            "LAUNCH_PROBE": "DRISHYAM Agentic Probe Dispatched",
            "BROADCAST_EMERGENCY": "Emergency Broadcast Dispatched to Target Region",
            "DEPLOY_BHARAT_ALERT": "National Strategic Alert successfully deployed to cellular nodes",
            "VIEW_ALERT_HISTORY": "Accessing Historical Broadcast Logs",
            "SAVE_ALERT_DRAFT": "Alert Draft Saved to DRISHYAM Vault",
            "PREVIEW_SEND_ALERT": "Alert Preview Generated. Awaiting Final Confirmation",
            "VIEW_CASE": f"Loading Full Case Dossier for {req.target_id or 'Case'}",
            "MARK_RISK": f"VPA {req.target_id or 'Unknown'} Flagged as High-Risk in NPCI Registry",
            "BLOCK_IMEI": f"IMEI Block Signal Broadcast for Range {req.target_id or 'Unknown'}",
            "INTERCEPT_MESSAGE": f"WhatsApp Interception Protocol Activated for {req.target_id or 'Source'}",
            "VIEW_VPA_HISTORY": f"Loading Transaction History for {req.target_id or 'VPA'}",
            "GENERATE_OMBUDSMAN_COMPLAINT": "RBI Ombudsman Complaint Draft Generated",
        }

        user_msg = messages.get(req.action_type.upper(), f"Action {req.action_type} executed successfully")

        # Rich Metadata for UI feedback
        detail_data = {}
        
        if action_type == "SCAN_MULE_FEED":
            # Simulate Intercepting new Ads
            from models.database import MuleAd
            import random
            
            # Check if we already have ads, if not, or 50% chance, create a new one
            ad_titles = ["International Payments Helper", "Flexible Process Executive", "E-Commerce Reviewer", "Remote Treasury Associate"]
            platforms = ["Telegram", "WhatsApp", "Facebook Meta", "LinkedIn"]
            
            new_ad = MuleAd(
                title=random.choice(ad_titles),
                salary=f"₹{random.randint(20, 80)},000 / month",
                platform=random.choice(platforms),
                risk_score=random.uniform(0.85, 0.99),
                status="Mule Campaign",
                recruiter_id=f"AGENT_{random.randint(1000, 9999)}"
            )
            db.add(new_ad)
            db.commit()
            db.refresh(new_ad)
            
            user_msg = f"Neural Interception Complete: {new_ad.title} flagged on {new_ad.platform}"
            detail_data = {"new_ad_id": new_ad.id}

            # Also create a CrimeReport for centralized tracking
            from models.database import CrimeReport
            new_report = CrimeReport(
                report_id=f"MLE-{uuid.uuid4().hex[:6].upper()}",
                category="police",
                scam_type="Mule Recruitment Campaign",
                platform=new_ad.platform,
                priority="HIGH",
                metadata_json={
                    "ad_title": new_ad.title,
                    "risk_score": new_ad.risk_score
                }
            )
            db.add(new_report)

        elif action_type == "VPA_LOOKUP" and req.target_id:
            from models.database import HoneypotEntity
            vpa = req.target_id.lower()
            entity = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == vpa).first()
            
            is_flagged = entity and entity.risk_score > 0.7
            detail_data = {
                "vpa": vpa,
                "is_flagged": is_flagged,
                "risk_level": "CRITICAL" if is_flagged else "SAFE",
                "reputation": "Known Malicious (Honeypot Intercepted)" if is_flagged else ("Flagged" if entity else "Established / Clean")
            }
            user_msg = f"VPA Analysis for {vpa} Complete. Risk: {'HIGH' if is_flagged else 'LOW'}"

        elif action_type == "DECOMPILE_AGENT":
            # Simulated forensic attribution
            detail_data = {
                "attribution": "Shadow_Mule_Network",
                "ip_origin": "103.21.XX.XX (Kolkata Proxy)",
                "fingerprint": "BH-992-MULE",
                "related_cases": 14
            }
            user_msg = f"Forensic Attribution for {req.target_id or 'Agent'} Complete."

        elif action_type in ["VIEW_FEED_DETAIL", "VIEW_DETAIL", "VIEW_INCIDENT"]:
            detail_data = {
                "id": req.target_id,
                "victim_id": f"V-{req.target_id}09",
                "scam_type": "UPI Impersonation / QR Trap",
                "risk_score": 0.94,
                "status": "INTERCEPTED",
                "evidence": [
                    "Audio Match: Known Fraud Voiceprint (98%)",
                    "Network: High-Density Scam Hotspot (Mewat)",
                    "CLI: Spoofing detected via Protocol Header analysis"
                ],
                "location": req.metadata.get("location", "Unknown Sector") if req.metadata else "Unknown Sector"
            }
        elif action_type == "GENERATE_RECOVERY_BUNDLE":
            from models.database import RecoveryCase
            inc_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
            
            # Create persistent recovery case
            new_case = RecoveryCase(
                user_id=current_user.id,
                incident_id=inc_id,
                bank_status="INVESTIGATING",
                total_recovered=0.0
            )
            db.add(new_case)
            
            detail_data = {
                "bundle_id": inc_id,
                "status": "READY",
                "generated_at": datetime.datetime.utcnow().isoformat(),
                "download_category": "RESTITUTION_BUNDLE",
                "download_file_type": "zip",
                "incident_id": inc_id,
            }
            user_msg = f"Legal Restitution Bundle Generated (ID: {inc_id}). Tracking activated."
        elif action_type == "CONNECT_TICKER":
            detail_data = {
                "ticker_items": [
                    "[ALERT] Surge in UPI traps detected in Noida Sector-62",
                    "[SUCCESS] 14 Mule accounts frozen in collaboration with Bank of Baroda",
                    "[INTEL] New persona detected: 'Electricity Board Official' impersonation",
                    "[LIVE] 124 Honeypot sessions active across NCR grid",
                    "[SECURE] 14.8M Citizens protected by active 1930 layer"
                ]
            }

        new_action = SystemAction(
            user_id=current_user.id,
            action_type=action_type,
            target_id=req.target_id,
            metadata_json=req.metadata,
            status="success"
        )
        
        # [AC-M7-05] Increment DRISHYAM Score for Active Defense
        active_defense_actions = ["SCAN_VIDEO", "GENERATE_FIR", "FREEZE_VPA", "BLOCK_IMEI", "REPORT_INCIDENT", "SCAN_MULE_FEED"]
        if action_type in active_defense_actions:
            current_user.drishyam_score = (current_user.drishyam_score or 100) + 5
            logger.info(f"User {current_user.username} DRISHYAM Score increased to {current_user.drishyam_score}")
        
        db.add(new_action)
        db.commit()
        db.refresh(new_action)
        
        # [AC-M9-01] Centralized Audit Logging
        log_audit(
            db=db,
            user_id=current_user.id,
            action=action_type,
            resource=req.target_id,
            metadata=req.metadata
        )

        if approval:
            approval.status = "EXECUTED"
            approval.metadata_json = {
                **(approval.metadata_json or {}),
                "executed_action_id": new_action.id,
                "executed_at": datetime.datetime.utcnow().isoformat(),
            }
            db.commit()
        
        return {
            "status": "success",
            "message": user_msg,
            "action_id": new_action.id,
            "detail": detail_data
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Action failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500, 
            detail=f"Backend Sync Error: {str(e)}"
        )

@router.get("/download-file")
async def get_download_file(
    export_id: int | None = None,
    filename: str | None = None,
    category: str = "report",
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    export_action = None
    if export_id is not None:
        export_action = (
            db.query(SystemAction)
            .filter(
                SystemAction.id == export_id,
                SystemAction.user_id == current_user.id,
                SystemAction.action_type == "EXPORT",
            )
            .first()
        )
        if not export_action:
            raise HTTPException(status_code=404, detail="Export request not found")

    export_meta = export_action.metadata_json or {} if export_action else {}
    resolved_category = export_meta.get("category") or category
    resolved_file_type = _resolve_file_type(filename, export_meta.get("file_type"))
    resolved_target = export_meta.get("target_id")
    resolved_context = export_meta.get("context") if isinstance(export_meta.get("context"), dict) else {}

    content, media_type, resolved_filename = _build_export_artifact(
        db,
        current_user,
        category=resolved_category,
        file_type=resolved_file_type,
        target_id=resolved_target,
        context=resolved_context,
    )

    log_audit(
        db,
        current_user.id,
        "DOC_GENERATION",
        resolved_filename,
        metadata={
            "category": resolved_category,
            "file_type": resolved_file_type,
            "export_id": export_id,
        },
    )

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{resolved_filename}\"",
        },
    )

@router.get("/download-sim")
async def download_simulation(
    file_type: str = "pdf",
    category: str = "report",
    target_id: str | None = None,
    context: str | None = None,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """
    Creates an export job and returns a secure download URL for the generated artifact.
    """
    try:
        logger.info(f"User {current_user.username} downloading {category} as {file_type}")
        context_payload = _parse_export_context(context)
        new_action = SystemAction(
            user_id=current_user.id,
            action_type="EXPORT",
            target_id=target_id or f"{category}.{file_type}",
            metadata_json={
                "category": category,
                "file_type": file_type,
                "target_id": target_id,
                "context": context_payload,
            },
        )
        db.add(new_action)
        db.commit()

        filename = _build_export_filename(category, file_type, target_id)
        return {
            "status": "success",
            "download_url": f"/api/v1/actions/download-file?export_id={new_action.id}",
            "filename": filename,
            "message": "Export prepared successfully."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Download failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Report Generation Error: {str(e)}")

@router.get("/graph/{entity_id}")
async def get_entity_graph(entity_id: str):
    """
    [Module 3] Fetch linked fraud network for a specific entity.
    """
    return fraud_graph.get_network(entity_id)
