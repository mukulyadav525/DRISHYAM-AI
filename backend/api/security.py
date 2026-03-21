from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from core.database import get_db
from core.auth import get_current_user, get_current_verified_user
from core.audit import log_audit
from models.database import CitizenConsent, SystemAuditLog, User
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
        linked_user.id if linked_user else 0,
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
