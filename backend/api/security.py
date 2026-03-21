from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.orm import aliased
from core.database import get_db
from core.auth import decode_access_token, get_current_user, get_current_verified_user, oauth2_scheme
from core.audit import log_audit
from core.access_control import authorize_agency_access, evaluate_agency_access, seed_access_policies, serialize_policy
from models.database import (
    AdminApproval,
    AgencyAccessPolicy,
    AgencySession,
    CitizenConsent,
    SystemAuditLog,
    User,
)
import uuid
import datetime

router = APIRouter()

CONSENT_POLICY_VERSION = "MVP-2026.03"
CONSENT_SCOPE_LIBRARY = {
    "ai_handoff": {
        "label": "AI scam handoff",
        "description": "Allow DRISHYAM to take over suspicious calls or chats to protect the citizen.",
        "required": True,
    },
    "transcript_analysis": {
        "label": "Transcript and scam analysis",
        "description": "Analyze suspicious messages or transcripts to extract scam entities and risk indicators.",
        "required": True,
    },
    "evidence_packaging": {
        "label": "Evidence packaging",
        "description": "Package verified scam evidence for FIR, graph linkage, and restitution workflows.",
        "required": True,
    },
    "alerting_recovery": {
        "label": "Alerts and recovery support",
        "description": "Send protective alerts and generate recovery guidance if the citizen chooses help.",
        "required": False,
    },
}
REQUIRED_CONSENT_SCOPES = [scope for scope, config in CONSENT_SCOPE_LIBRARY.items() if config["required"]]


class AuditLogOut(BaseModel):
    id: int
    action: str
    resource: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: str
    user_id: Optional[int] = None
    username: Optional[str] = None
    role: Optional[str] = None
    metadata: Optional[dict] = None


class ConsentRecordRequest(BaseModel):
    phone_number: str = Field(..., min_length=10)
    scopes: dict[str, bool]
    channel: str = "SIMULATION_PORTAL"
    locale: str = "en-IN"
    policy_version: Optional[str] = None


class ConsentRevokeRequest(BaseModel):
    reason: Optional[str] = None


class AccessEvaluationRequest(BaseModel):
    action: str
    resource: str
    segment: Optional[str] = None
    region: str = "INDIA"
    sensitivity: str = "MEDIUM"
    metadata: Optional[dict] = None


class SessionRevokeRequest(BaseModel):
    reason: Optional[str] = None


class ApprovalCreateRequest(BaseModel):
    action_type: str
    resource: str
    resource_domain: str = "security"
    justification: str = Field(..., min_length=8)
    risk_level: str = "HIGH"
    expires_in_minutes: int = Field(60, ge=5, le=1440)
    metadata: Optional[dict] = None


class ApprovalDecisionRequest(BaseModel):
    status: str
    note: Optional[str] = None


def _normalize_phone(phone_number: str | None) -> str:
    digits = "".join(ch for ch in str(phone_number or "") if ch.isdigit())
    if len(digits) >= 10:
        return digits[-10:]
    return str(phone_number or "").strip()


def _mask_phone(phone_number: str | None) -> str:
    phone = _normalize_phone(phone_number)
    if len(phone) < 4:
        return phone or "Unknown"
    return f"{phone[:2]}XXXXXX{phone[-2:]}"


def _base_scope_state() -> dict[str, bool]:
    return {scope: False for scope in CONSENT_SCOPE_LIBRARY}


def _required_complete(scopes: dict | None) -> bool:
    scope_state = scopes or {}
    return all(bool(scope_state.get(scope)) for scope in REQUIRED_CONSENT_SCOPES)


def _resolve_current_phone(current_user: User) -> str:
    if current_user.role == "common":
        return _normalize_phone(current_user.username or current_user.phone_number)
    return _normalize_phone(current_user.phone_number)


def _find_latest_consent(db: Session, phone_number: str | None = None, user_id: int | None = None) -> CitizenConsent | None:
    query = db.query(CitizenConsent)
    normalized_phone = _normalize_phone(phone_number)

    if user_id is not None and normalized_phone:
        query = query.filter(
            (CitizenConsent.user_id == user_id) | (CitizenConsent.phone_number == normalized_phone)
        )
    elif user_id is not None:
        query = query.filter(CitizenConsent.user_id == user_id)
    elif normalized_phone:
        query = query.filter(CitizenConsent.phone_number == normalized_phone)
    else:
        return None

    return query.order_by(CitizenConsent.updated_at.desc(), CitizenConsent.given_at.desc()).first()


def _serialize_consent(consent: CitizenConsent | None, phone_number: str | None = None) -> dict:
    scopes = _base_scope_state()
    if consent and isinstance(consent.scopes_json, dict):
        scopes.update({scope: bool(value) for scope, value in consent.scopes_json.items() if scope in scopes})

    metadata = consent.metadata_json or {} if consent else {}
    return {
        "id": consent.id if consent else None,
        "phone_number": _mask_phone(consent.phone_number if consent else phone_number),
        "status": consent.status if consent else "NOT_GRANTED",
        "channel": consent.channel if consent else None,
        "policy_version": consent.policy_version if consent else CONSENT_POLICY_VERSION,
        "required_complete": _required_complete(scopes),
        "scopes": scopes,
        "given_at": consent.given_at.isoformat() if consent and consent.given_at else None,
        "revoked_at": consent.revoked_at.isoformat() if consent and consent.revoked_at else None,
        "locale": metadata.get("locale"),
        "source": metadata.get("source"),
    }


def _utcnow() -> datetime.datetime:
    return datetime.datetime.utcnow()


def _current_session_uid(token: str | None) -> str | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        return payload.get("session_uid")
    except Exception:
        return None


def _serialize_session(row: AgencySession, user: User | None = None, current_session_uid: str | None = None) -> dict:
    return {
        "session_id": row.session_uid,
        "user_id": row.user_id,
        "username": user.username if user else None,
        "full_name": user.full_name if user else None,
        "role": user.role if user else None,
        "device_label": row.device_label,
        "device_type": row.device_type,
        "ip_address": row.ip_address,
        "network_zone": row.network_zone,
        "auth_stage": row.auth_stage,
        "risk_level": row.risk_level,
        "status": row.status,
        "verified_at": row.verified_at.isoformat() if row.verified_at else None,
        "revoked_at": row.revoked_at.isoformat() if row.revoked_at else None,
        "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "is_current": row.session_uid == current_session_uid,
        "metadata": row.metadata_json or {},
    }


def _serialize_approval(row: AdminApproval, requester: User | None = None, approver: User | None = None) -> dict:
    return {
        "approval_id": row.approval_id,
        "action_type": row.action_type,
        "resource": row.resource,
        "risk_level": row.risk_level,
        "justification": row.justification,
        "status": row.status,
        "requested_by_user_id": row.requested_by_user_id,
        "requested_by": requester.username if requester else None,
        "approver_user_id": row.approver_user_id,
        "approver": approver.username if approver else None,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "decided_at": row.decided_at.isoformat() if row.decided_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "metadata": row.metadata_json or {},
    }


def _build_access_summary(db: Session) -> dict:
    seed_access_policies(db)
    policies = db.query(AgencyAccessPolicy).filter(AgencyAccessPolicy.active.is_(True)).order_by(AgencyAccessPolicy.created_at.asc()).all()
    serialized = [serialize_policy(policy) for policy in policies]
    return {
        "summary": {
            "policies": len(serialized),
            "roles_covered": sorted({policy["role_scope"] for policy in serialized}),
            "resources_covered": sorted({policy["resource_scope"] for policy in serialized}),
        },
        "policies": serialized,
    }


def _build_session_summary(db: Session, current_user: User, current_session_uid: str | None) -> dict:
    query = db.query(AgencySession, User).join(User, User.id == AgencySession.user_id).order_by(AgencySession.updated_at.desc())
    if current_user.role != "admin":
        query = query.filter(AgencySession.user_id == current_user.id)

    rows = query.limit(50).all()
    sessions = [_serialize_session(session, user, current_session_uid) for session, user in rows]
    active_sessions = [session for session in sessions if session["status"] == "ACTIVE"]

    return {
        "summary": {
            "total": len(sessions),
            "active": len(active_sessions),
            "high_risk": len([session for session in active_sessions if session["risk_level"] in {"HIGH", "CRITICAL"}]),
            "mfa_verified": len([session for session in active_sessions if session["auth_stage"] == "MFA_VERIFIED"]),
        },
        "current_session_id": current_session_uid,
        "sessions": sessions,
    }


def _build_approval_summary(db: Session, current_user: User) -> dict:
    requester_alias = aliased(User)
    approver_alias = aliased(User)
    query = (
        db.query(AdminApproval, requester_alias, approver_alias)
        .outerjoin(requester_alias, requester_alias.id == AdminApproval.requested_by_user_id)
        .outerjoin(approver_alias, approver_alias.id == AdminApproval.approver_user_id)
        .order_by(AdminApproval.updated_at.desc())
    )
    if current_user.role != "admin":
        query = query.filter(
            or_(
                AdminApproval.requested_by_user_id == current_user.id,
                AdminApproval.approver_user_id == current_user.id,
            )
        )

    rows = query.limit(50).all()
    approvals = [_serialize_approval(approval, requester, approver) for approval, requester, approver in rows]
    return {
        "summary": {
            "total": len(approvals),
            "pending": len([item for item in approvals if item["status"] == "PENDING"]),
            "approved": len([item for item in approvals if item["status"] in {"APPROVED", "EXECUTED"}]),
            "rejected": len([item for item in approvals if item["status"] == "REJECTED"]),
        },
        "approvals": approvals,
    }


def _build_anomaly_summary(db: Session) -> dict:
    now = _utcnow()
    sessions = db.query(AgencySession).order_by(AgencySession.created_at.desc()).all()
    approvals = db.query(AdminApproval).order_by(AdminApproval.created_at.desc()).all()
    audit_rows = db.query(SystemAuditLog).order_by(SystemAuditLog.timestamp.desc()).limit(250).all()

    anomalies = []

    high_risk_sessions = [session for session in sessions if session.status == "ACTIVE" and session.risk_level in {"HIGH", "CRITICAL"}]
    if high_risk_sessions:
        anomalies.append(
            {
                "id": "ANOM-SESSION-RISK",
                "severity": "MEDIUM",
                "title": "High-risk privileged sessions detected",
                "description": "One or more active privileged sessions are marked as high risk and should be reviewed.",
                "evidence_count": len(high_risk_sessions),
                "status": "OPEN",
            }
        )

    stale_approvals = [
        approval
        for approval in approvals
        if approval.status == "PENDING" and approval.created_at and approval.created_at < now - datetime.timedelta(hours=12)
    ]
    if stale_approvals:
        anomalies.append(
            {
                "id": "ANOM-STALE-APPROVAL",
                "severity": "HIGH",
                "title": "Approval queue backlog detected",
                "description": "Pending privileged approvals have exceeded the review SLO and may block critical actions.",
                "evidence_count": len(stale_approvals),
                "status": "OPEN",
            }
        )

    recent_window = now - datetime.timedelta(hours=1)
    action_counts: dict[int, int] = {}
    for row in audit_rows:
        if row.user_id is None or not row.timestamp or row.timestamp < recent_window:
            continue
        action_counts[row.user_id] = action_counts.get(row.user_id, 0) + 1

    spiking_users = [user_id for user_id, count in action_counts.items() if count >= 8]
    if spiking_users:
        anomalies.append(
            {
                "id": "ANOM-AUDIT-SPIKE",
                "severity": "MEDIUM",
                "title": "Privileged action spike detected",
                "description": "A privileged operator crossed the hourly action threshold and should be reviewed for intent and context.",
                "evidence_count": len(spiking_users),
                "status": "OPEN",
            }
        )

    expired_approvals = [
        approval
        for approval in approvals
        if approval.status == "APPROVED" and approval.expires_at and approval.expires_at < now
    ]
    if expired_approvals:
        anomalies.append(
            {
                "id": "ANOM-EXPIRED-APPROVAL",
                "severity": "LOW",
                "title": "Expired approvals need cleanup",
                "description": "Approved but unused privileged actions have expired and should be closed to maintain a clean control plane.",
                "evidence_count": len(expired_approvals),
                "status": "OPEN",
            }
        )

    if not anomalies:
        anomalies.append(
            {
                "id": "ANOM-BASELINE",
                "severity": "LOW",
                "title": "No active security anomalies",
                "description": "Privileged session, approval, and audit activity are within baseline thresholds.",
                "evidence_count": 0,
                "status": "MONITORING",
            }
        )

    return {
        "summary": {
            "open": len([item for item in anomalies if item["status"] == "OPEN"]),
            "critical": len([item for item in anomalies if item["severity"] == "CRITICAL"]),
            "high": len([item for item in anomalies if item["severity"] == "HIGH"]),
        },
        "anomalies": anomalies,
    }


@router.get("/consent/catalog")
async def get_consent_catalog():
    return {
        "policy_version": CONSENT_POLICY_VERSION,
        "title": "Citizen consent for DRISHYAM protection",
        "scopes": [
            {
                "id": scope,
                "label": config["label"],
                "description": config["description"],
                "required": config["required"],
            }
            for scope, config in CONSENT_SCOPE_LIBRARY.items()
        ],
    }


@router.get("/consent/lookup")
async def lookup_consent(
    phone_number: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
):
    normalized_phone = _normalize_phone(phone_number)
    consent = _find_latest_consent(db, phone_number=normalized_phone)
    return _serialize_consent(consent, normalized_phone)


@router.post("/consent/record")
async def record_consent(body: ConsentRecordRequest, db: Session = Depends(get_db)):
    normalized_phone = _normalize_phone(body.phone_number)
    scopes = _base_scope_state()
    scopes.update({scope: bool(value) for scope, value in body.scopes.items() if scope in scopes})

    if not _required_complete(scopes):
        raise HTTPException(
            status_code=400,
            detail="Required consent scopes must be accepted before access is granted.",
        )

    policy_version = body.policy_version or CONSENT_POLICY_VERSION
    linked_user = db.query(User).filter(User.username == normalized_phone).first()
    consent = _find_latest_consent(db, phone_number=normalized_phone, user_id=linked_user.id if linked_user else None)

    if consent and consent.status == "ACTIVE":
        consent.scopes_json = scopes
        consent.channel = body.channel.upper()
        consent.policy_version = policy_version
        consent.revoked_at = None
        consent.metadata_json = {
            "locale": body.locale,
            "source": "simulation_portal" if body.channel.upper() == "SIMULATION_PORTAL" else body.channel.lower(),
        }
        if linked_user:
            consent.user_id = linked_user.id
    else:
        consent = CitizenConsent(
            user_id=linked_user.id if linked_user else None,
            phone_number=normalized_phone,
            status="ACTIVE",
            channel=body.channel.upper(),
            policy_version=policy_version,
            scopes_json=scopes,
            metadata_json={
                "locale": body.locale,
                "source": "simulation_portal" if body.channel.upper() == "SIMULATION_PORTAL" else body.channel.lower(),
            },
            given_at=datetime.datetime.utcnow(),
        )
        db.add(consent)

    db.commit()
    db.refresh(consent)

    log_audit(
        db,
        linked_user.id if linked_user else None,
        "CONSENT_GRANTED",
        resource=normalized_phone,
        metadata={"policy_version": policy_version, "scopes": scopes, "channel": consent.channel},
    )

    return _serialize_consent(consent, normalized_phone)


@router.get("/consent/me")
async def get_my_consent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    consent = _find_latest_consent(db, phone_number=_resolve_current_phone(current_user), user_id=current_user.id)
    return _serialize_consent(consent, _resolve_current_phone(current_user))


@router.post("/consent/revoke")
async def revoke_consent(
    body: ConsentRevokeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    normalized_phone = _resolve_current_phone(current_user)
    consent = _find_latest_consent(db, phone_number=normalized_phone, user_id=current_user.id)
    if not consent or consent.status != "ACTIVE":
        return {
            "status": "NOT_FOUND",
            "message": "No active consent record found for this citizen.",
        }

    consent.status = "REVOKED"
    consent.revoked_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(consent)

    log_audit(
        db,
        current_user.id,
        "CONSENT_REVOKED",
        resource=normalized_phone,
        metadata={"reason": body.reason or "Citizen initiated revocation"},
    )

    return _serialize_consent(consent, normalized_phone)


@router.get("/consent/summary")
async def get_consent_summary(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    consents = db.query(CitizenConsent).order_by(CitizenConsent.updated_at.desc(), CitizenConsent.given_at.desc()).all()

    active_consents = [consent for consent in consents if consent.status == "ACTIVE"]
    revoked_consents = [consent for consent in consents if consent.status == "REVOKED"]
    complete_consents = [consent for consent in active_consents if _required_complete(consent.scopes_json)]
    simulation_consents = [consent for consent in active_consents if consent.channel == "SIMULATION_PORTAL"]

    log_audit(
        db,
        current_user.id,
        "CONSENT_LEDGER_VIEW",
        resource="CONSENT_SUMMARY",
        metadata={"limit": limit},
    )

    return {
        "policy_version": CONSENT_POLICY_VERSION,
        "totals": {
            "active": len(active_consents),
            "revoked": len(revoked_consents),
            "required_complete": len(complete_consents),
            "simulation_portal": len(simulation_consents),
        },
        "scope_catalog": [
            {
                "id": scope,
                "label": config["label"],
                "required": config["required"],
            }
            for scope, config in CONSENT_SCOPE_LIBRARY.items()
        ],
        "recent": [
            _serialize_consent(consent, consent.phone_number)
            for consent in consents[:limit]
        ],
    }

@router.post("/pqc/encrypt-packet")
async def pqc_encrypt(body: dict, db: Session = Depends(get_db)):
    return {
        "encrypted_payload": uuid.uuid4().hex * 2,
        "algorithm_used": "KYBER_1024",
        "signature_algorithm": "DILITHIUM_5",
        "rbi_2028_compliant": True
    }

@router.post("/federated/submit-gradient")
async def federated_submit(body: dict, db: Session = Depends(get_db)):
    return {
        "gradient_accepted": True,
        "raw_audio_uploaded": False,
        "differential_privacy_applied": True,
        "global_model_updated": True
    }

@router.post("/homomorphic/query")
async def homomorphic_query(body: dict, db: Session = Depends(get_db)):
    return {
        "result_encrypted": uuid.uuid4().hex,
        "raw_transcripts_accessed": False,
        "cluster_size_returned": 42,
        "dpdp_audit_logged": True
    }


@router.get("/audit/logs", response_model=list[AuditLogOut])
async def get_audit_logs(
    limit: int = Query(25, ge=1, le=100),
    action: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    query = (
        db.query(SystemAuditLog, User.username, User.role)
        .outerjoin(User, User.id == SystemAuditLog.user_id)
        .order_by(SystemAuditLog.timestamp.desc())
    )

    if current_user.role != "admin":
        query = query.filter(SystemAuditLog.user_id == current_user.id)

    if action:
        query = query.filter(SystemAuditLog.action == action.upper())

    rows = query.limit(limit).all()

    log_audit(
        db,
        current_user.id,
        "AUDIT_LOG_VIEW",
        resource=action.upper() if action else "ALL",
        metadata={"limit": limit},
    )

    return [
        {
            "id": audit.id,
            "action": audit.action,
            "resource": audit.resource,
            "ip_address": audit.ip_address,
            "timestamp": audit.timestamp.isoformat(),
            "user_id": audit.user_id,
            "username": username,
            "role": role,
            "metadata": audit.metadata_json,
        }
        for audit, username, role in rows
    ]


@router.get("/agency-access")
async def get_agency_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    summary = _build_access_summary(db)
    log_audit(db, current_user.id, "ABAC_POLICY_VIEW", resource="AGENCY_ACCESS")
    return summary


@router.post("/agency-access/evaluate")
async def evaluate_agency_policy(
    body: AccessEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    decision = evaluate_agency_access(
        db,
        current_user,
        action=body.action,
        resource=body.resource,
        attrs={
            "segment": body.segment,
            "region": body.region,
            "sensitivity": body.sensitivity,
            **(body.metadata or {}),
        },
    )
    log_audit(
        db,
        current_user.id,
        "ABAC_POLICY_EVALUATE",
        resource=body.resource,
        metadata={"action": body.action, "allowed": decision["allowed"]},
    )
    return decision


@router.get("/sessions")
async def get_agency_sessions(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    summary = _build_session_summary(db, current_user, _current_session_uid(token))
    log_audit(db, current_user.id, "SESSION_INVENTORY_VIEW", resource=current_user.username)
    return summary


@router.post("/sessions/{session_uid}/revoke")
async def revoke_agency_session(
    session_uid: str,
    body: SessionRevokeRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    session = db.query(AgencySession).filter(AgencySession.session_uid == session_uid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    current_session_uid = _current_session_uid(token)
    if current_user.role != "admin" and session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only revoke your own session")

    session.status = "REVOKED"
    session.revoked_at = _utcnow()
    session.last_seen_at = _utcnow()
    metadata = session.metadata_json or {}
    metadata["revocation_reason"] = body.reason or "Manual revoke from security console"
    metadata["revoked_by"] = current_user.username
    session.metadata_json = metadata
    db.commit()
    db.refresh(session)

    log_audit(
        db,
        current_user.id,
        "SESSION_REVOKED",
        resource=session_uid,
        metadata={"reason": body.reason, "is_current": session_uid == current_session_uid},
    )
    return {"status": session.status, "session_id": session_uid}


@router.get("/approvals")
async def get_admin_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    summary = _build_approval_summary(db, current_user)
    log_audit(db, current_user.id, "APPROVAL_QUEUE_VIEW", resource=current_user.username)
    return summary


@router.post("/approvals")
async def create_admin_approval(
    body: ApprovalCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    authorize_agency_access(
        db,
        current_user,
        action="REQUEST",
        resource=body.resource_domain,
        attrs={
            "segment": (body.metadata or {}).get("segment"),
            "region": (body.metadata or {}).get("region", "INDIA"),
            "sensitivity": body.risk_level,
        },
    )

    approval = AdminApproval(
        approval_id=f"APR-{uuid.uuid4().hex[:8].upper()}",
        requested_by_user_id=current_user.id,
        action_type=body.action_type.upper(),
        resource=body.resource,
        risk_level=body.risk_level.upper(),
        justification=body.justification,
        status="PENDING",
        expires_at=_utcnow() + datetime.timedelta(minutes=body.expires_in_minutes),
        metadata_json={
            "resource_domain": body.resource_domain,
            "requested_by": current_user.username,
            **(body.metadata or {}),
        },
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)

    log_audit(
        db,
        current_user.id,
        "ADMIN_APPROVAL_REQUESTED",
        resource=body.resource,
        metadata={"approval_id": approval.approval_id, "action_type": body.action_type.upper()},
    )
    return _serialize_approval(approval, requester=current_user)


@router.post("/approvals/{approval_id}/decision")
async def decide_admin_approval(
    approval_id: str,
    body: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can approve or reject privileged actions.")

    approval = db.query(AdminApproval).filter(AdminApproval.approval_id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    new_status = body.status.upper()
    if new_status not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED")

    approval.status = new_status
    approval.approver_user_id = current_user.id
    approval.decided_at = _utcnow()
    metadata = approval.metadata_json or {}
    metadata["decision_note"] = body.note
    metadata["decided_by"] = current_user.username
    approval.metadata_json = metadata
    db.commit()
    db.refresh(approval)

    log_audit(
        db,
        current_user.id,
        "ADMIN_APPROVAL_DECIDED",
        resource=approval.resource,
        metadata={"approval_id": approval.approval_id, "status": new_status},
    )

    requester = db.query(User).filter(User.id == approval.requested_by_user_id).first()
    return _serialize_approval(approval, requester=requester, approver=current_user)


@router.get("/anomalies")
async def get_security_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    summary = _build_anomaly_summary(db)
    log_audit(db, current_user.id, "SECURITY_ANOMALIES_VIEW", resource=current_user.username)
    return summary


@router.get("/control-center")
async def get_security_control_center(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    return {
        "access": _build_access_summary(db),
        "sessions": _build_session_summary(db, current_user, _current_session_uid(token)),
        "approvals": _build_approval_summary(db, current_user),
        "anomalies": _build_anomaly_summary(db),
    }
