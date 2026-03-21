import copy
import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.inoculation import SCENARIO_LIBRARY
from core.audit import log_audit
from core.auth import get_current_verified_user
from core.database import get_db
from models.database import CitizenConsent, NotificationLog, RecoveryCase, SystemAction, SystemStat, TrustLink, User

router = APIRouter()

PROFILE_CATEGORY = "citizen_profile"
HABIT_CATEGORY = "citizen_habit"
ANALYTICS_CATEGORY = "citizen_analytics"


class PreferenceUpdateRequest(BaseModel):
    district: str | None = None
    language: str | None = None
    senior_mode: bool | None = None
    low_bandwidth: bool | None = None
    onboarding_step: str | None = None
    segment: str | None = None


class TrustCircleCreateRequest(BaseModel):
    guardian_name: str = Field(..., min_length=2)
    guardian_phone: str = Field(..., min_length=10)
    guardian_email: str | None = None
    relation_type: str = Field(..., min_length=2)


class TrustCircleNotifyRequest(BaseModel):
    trust_link_id: int | None = None
    message: str | None = None


class ScoreComputeRequest(BaseModel):
    suspicious_links_avoided: int = Field(1, ge=0, le=100)
    drills_completed: int = Field(0, ge=0, le=100)
    alerts_acknowledged: int = Field(0, ge=0, le=100)
    trust_circle_contacts: int = Field(0, ge=0, le=10)
    recovery_preparedness: int = Field(0, ge=0, le=100)


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


def _upsert_stat(db: Session, category: str, key: str, metadata: dict, value: str = "ACTIVE") -> SystemStat:
    payload = copy.deepcopy(metadata) if metadata is not None else None
    row = (
        db.query(SystemStat)
        .filter(SystemStat.category == category, SystemStat.key == key)
        .order_by(SystemStat.updated_at.desc())
        .first()
    )
    if row:
        row.value = value
        row.metadata_json = payload
        db.commit()
        db.refresh(row)
        return row

    row = SystemStat(category=category, key=key, value=value, metadata_json=payload)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _default_profile(user: User) -> dict:
    return {
        "citizen_id": f"CIT-{user.id:04d}",
        "display_name": user.full_name or f"Citizen {user.username[-4:]}",
        "phone_masked": _mask_phone(user.phone_number or user.username),
        "district": "Delhi NCR",
        "language": "en",
        "senior_mode": False,
        "low_bandwidth": False,
        "segment": "general",
        "completed_steps": ["consent_verified"],
        "last_score": 78,
    }


def _default_habit_state() -> dict:
    next_nudge = (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat()
    return {
        "enrolled": False,
        "streak_days": 0,
        "reward_points": 0,
        "challenge": "Pause before tapping and verify the sender.",
        "next_nudge_at": next_nudge,
        "last_completed_at": None,
    }


def _load_profile_state(db: Session, user: User) -> tuple[SystemStat, dict]:
    key = f"user:{user.id}"
    row = (
        db.query(SystemStat)
        .filter(SystemStat.category == PROFILE_CATEGORY, SystemStat.key == key)
        .order_by(SystemStat.updated_at.desc())
        .first()
    )
    if row and isinstance(row.metadata_json, dict):
        return row, copy.deepcopy(row.metadata_json)

    default_state = _default_profile(user)
    row = _upsert_stat(db, PROFILE_CATEGORY, key, default_state)
    return row, default_state


def _load_habit_state(db: Session, user: User) -> tuple[SystemStat, dict]:
    key = f"user:{user.id}"
    row = (
        db.query(SystemStat)
        .filter(SystemStat.category == HABIT_CATEGORY, SystemStat.key == key)
        .order_by(SystemStat.updated_at.desc())
        .first()
    )
    if row and isinstance(row.metadata_json, dict):
        return row, copy.deepcopy(row.metadata_json)

    default_state = _default_habit_state()
    row = _upsert_stat(db, HABIT_CATEGORY, key, default_state, value="PENDING")
    return row, default_state


def _load_analytics_state(db: Session, user: User) -> tuple[SystemStat, dict]:
    key = f"user:{user.id}"
    row = (
        db.query(SystemStat)
        .filter(SystemStat.category == ANALYTICS_CATEGORY, SystemStat.key == key)
        .order_by(SystemStat.updated_at.desc())
        .first()
    )
    default_state = {
        "sessions_opened": 1,
        "alerts_acknowledged": 0,
        "drills_started": 0,
        "trust_circle_updates": 0,
        "recovery_actions": 0,
        "last_opened_at": datetime.datetime.utcnow().isoformat(),
    }
    if row and isinstance(row.metadata_json, dict):
        state = copy.deepcopy(row.metadata_json)
        state["sessions_opened"] = int(state.get("sessions_opened", 0)) + 1
        state["last_opened_at"] = datetime.datetime.utcnow().isoformat()
        return _upsert_stat(db, ANALYTICS_CATEGORY, key, state), state

    return _upsert_stat(db, ANALYTICS_CATEGORY, key, default_state), default_state


def _seed_personal_alerts(db: Session, user: User, profile: dict):
    region = str(profile.get("district", "delhi")).lower().replace(" ", "_")
    existing = (
        db.query(NotificationLog)
        .filter(
            NotificationLog.template_id.like("ALERT_APP_%"),
            NotificationLog.recipient.in_([region, "national", user.username]),
        )
        .count()
    )
    if existing >= 3:
        return

    now = datetime.datetime.utcnow()
    rows = [
        {
            "recipient": region,
            "channel": "PUSH",
            "template_id": "ALERT_APP_OTP_SURGE",
            "status": "DELIVERED",
            "sent_at": now - datetime.timedelta(minutes=15),
            "metadata_json": {
                "alert_id": "ALT-CIT-1001",
                "severity": "HIGH",
                "title": "OTP sharing scam surge near you",
                "message": "Fraud callers are impersonating banks and asking for OTP. Never share OTP, PIN, or app access.",
                "region": profile.get("district", "Delhi NCR"),
                "scenario_title": "OTP Sharing Scam",
                "acknowledged_by": [],
                "languages": ["en", "hi"],
            },
        },
        {
            "recipient": region,
            "channel": "SMS",
            "template_id": "ALERT_APP_UPI_COLLECT",
            "status": "DELIVERED",
            "sent_at": now - datetime.timedelta(hours=3),
            "metadata_json": {
                "alert_id": "ALT-CIT-1002",
                "severity": "MEDIUM",
                "title": "Refund scam collect requests reported",
                "message": "If a screen asks for your UPI PIN, money is leaving your account. Do not approve unknown collect requests.",
                "region": profile.get("district", "Delhi NCR"),
                "scenario_title": "UPI Collect Trap",
                "acknowledged_by": [],
                "languages": ["en", "hi"],
            },
        },
        {
            "recipient": "national",
            "channel": "PUSH",
            "template_id": "ALERT_APP_JOB_MULE",
            "status": "DELIVERED",
            "sent_at": now - datetime.timedelta(hours=6),
            "metadata_json": {
                "alert_id": "ALT-CIT-1003",
                "severity": "LOW",
                "title": "Fake job and mule recruitment warning",
                "message": "No genuine job should ask you to receive or forward money through your own account.",
                "region": "National",
                "scenario_title": "Recruiter Mule Trap",
                "acknowledged_by": [],
                "languages": ["en", "hi"],
            },
        },
    ]
    for row in rows:
        if (
            db.query(NotificationLog)
            .filter(NotificationLog.template_id == row["template_id"], NotificationLog.recipient == row["recipient"])
            .first()
        ):
            continue
        db.add(NotificationLog(**row))
    db.commit()


def _serialize_trust_link(row: TrustLink) -> dict:
    return {
        "id": row.id,
        "guardian_name": row.guardian_name,
        "guardian_phone": _mask_phone(row.guardian_phone),
        "guardian_email": row.guardian_email,
        "relation_type": row.relation_type,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _recent_alerts(db: Session, user: User, profile: dict) -> list[dict]:
    region = str(profile.get("district", "delhi")).lower().replace(" ", "_")
    logs = (
        db.query(NotificationLog)
        .filter(
            NotificationLog.template_id.like("ALERT_APP_%"),
            NotificationLog.recipient.in_([region, "national", user.username]),
        )
        .order_by(NotificationLog.sent_at.desc())
        .limit(10)
        .all()
    )

    alerts = []
    for log in logs:
        metadata = log.metadata_json or {}
        acknowledged_by = metadata.get("acknowledged_by", [])
        alerts.append(
            {
                "id": metadata.get("alert_id") or f"ALT-{log.id}",
                "severity": metadata.get("severity", "MEDIUM"),
                "title": metadata.get("title", metadata.get("scenario_title", "Citizen Alert")),
                "message": metadata.get("message", "Stay alert for suspicious activity."),
                "region": metadata.get("region", log.recipient),
                "channels": [log.channel],
                "languages": metadata.get("languages", ["en"]),
                "acknowledged": user.id in acknowledged_by,
                "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            }
        )
    return alerts


def _compute_local_score(user: User, profile: dict, trust_links: list[TrustLink], drills_completed: int, acknowledged_alerts: int, recovery_cases: int) -> dict:
    completed_steps = profile.get("completed_steps", [])
    base_score = 52
    score = base_score
    score += min(len(trust_links) * 8, 16)
    score += min(drills_completed * 6, 18)
    score += min(acknowledged_alerts * 2, 8)
    score += 6 if profile.get("senior_mode") else 0
    score += 4 if profile.get("low_bandwidth") else 0
    score += 8 if "profile_ready" in completed_steps else 0
    score += 8 if "trust_circle_ready" in completed_steps else 0
    score += 6 if recovery_cases > 0 else 0
    score = min(score, 98)

    return {
        "score": score,
        "decile_band": max(1, min(10, (score + 9) // 10)),
        "computed_locally": True,
        "central_storage": False,
        "badge": "PLATINUM_SHIELD" if score >= 90 else "GOLD_SHIELD" if score >= 75 else "SILVER_SHIELD",
        "factors": [
            {"label": "Trust circle readiness", "value": len(trust_links)},
            {"label": "Drills completed", "value": drills_completed},
            {"label": "Alerts acknowledged", "value": acknowledged_alerts},
            {"label": "Onboarding completion", "value": len(completed_steps)},
        ],
    }


def _build_onboarding(profile: dict, consent_active: bool, trust_links: list[TrustLink], drills_completed: int) -> dict:
    completed_steps = set(profile.get("completed_steps", []))
    steps = [
        {"id": "consent_verified", "title": "Consent verified", "complete": consent_active},
        {"id": "profile_ready", "title": "Profile and district selected", "complete": "profile_ready" in completed_steps},
        {"id": "alerts_ready", "title": "Alert preferences ready", "complete": "alerts_ready" in completed_steps},
        {"id": "trust_circle_ready", "title": "Trust circle added", "complete": len(trust_links) > 0},
        {"id": "first_drill_done", "title": "First scam drill completed", "complete": drills_completed > 0},
    ]
    return {
        "steps": steps,
        "completed": len([step for step in steps if step["complete"]]),
        "total": len(steps),
    }


def _neighborhood_density(profile: dict) -> dict:
    district = profile.get("district", "Delhi NCR")
    sample = {
        "Delhi NCR": {"risk_band": "HIGH", "incidents_last_7d": 46, "trend": "OTP scams and fake refund requests"},
        "Mumbai": {"risk_band": "MEDIUM", "incidents_last_7d": 28, "trend": "KYC scams and mule recruitment"},
        "Bengaluru": {"risk_band": "MEDIUM", "incidents_last_7d": 24, "trend": "Courier fraud and fake tech support"},
    }.get(district, {"risk_band": "MEDIUM", "incidents_last_7d": 18, "trend": "Mixed scam traffic"})
    return {
        "district": district,
        "risk_band": sample["risk_band"],
        "incidents_last_7d": sample["incidents_last_7d"],
        "trend": sample["trend"],
        "top_scam_types": ["OTP phishing", "UPI collect scam", "Job mule trap"],
    }


def _recent_drills(db: Session, user: User) -> list[dict]:
    rows = (
        db.query(SystemAction)
        .filter(
            SystemAction.action_type == "INOCULATION_DRILL",
            SystemAction.target_id.in_([user.username, user.phone_number or user.username]),
        )
        .order_by(SystemAction.created_at.desc())
        .limit(5)
        .all()
    )
    drills = []
    for row in rows:
        metadata = row.metadata_json or {}
        scorecard = metadata.get("scorecard", {})
        drills.append(
            {
                "scenario": metadata.get("scenario", "bank_kyc"),
                "readiness_score": scorecard.get("readiness_score", 0),
                "channel": scorecard.get("channel", "SMS"),
                "completed_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return drills


@router.get("/app-home")
async def get_citizen_app_home(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _, profile = _load_profile_state(db, current_user)
    _, habit = _load_habit_state(db, current_user)
    _, analytics = _load_analytics_state(db, current_user)

    consent = (
        db.query(CitizenConsent)
        .filter(CitizenConsent.user_id == current_user.id)
        .order_by(CitizenConsent.updated_at.desc(), CitizenConsent.given_at.desc())
        .first()
    )
    if not consent:
        consent = (
            db.query(CitizenConsent)
            .filter(CitizenConsent.phone_number == _normalize_phone(current_user.username))
            .order_by(CitizenConsent.updated_at.desc(), CitizenConsent.given_at.desc())
            .first()
        )

    trust_links = db.query(TrustLink).filter(TrustLink.user_id == current_user.id).order_by(TrustLink.created_at.asc()).all()
    recovery_cases = db.query(RecoveryCase).filter(RecoveryCase.user_id == current_user.id).order_by(RecoveryCase.updated_at.desc()).all()
    drills = _recent_drills(db, current_user)

    _seed_personal_alerts(db, current_user, profile)
    alerts = _recent_alerts(db, current_user, profile)
    acknowledged_alerts = len([alert for alert in alerts if alert["acknowledged"]])
    score = _compute_local_score(current_user, profile, trust_links, len(drills), acknowledged_alerts, len(recovery_cases))

    profile["last_score"] = score["score"]
    _upsert_stat(db, PROFILE_CATEGORY, f"user:{current_user.id}", profile)

    log_audit(db, current_user.id, "CITIZEN_APP_HOME_VIEW", resource=current_user.username)

    return {
        "profile": profile,
        "onboarding": _build_onboarding(profile, consent.status == "ACTIVE" if consent else False, trust_links, len(drills)),
        "trust_circle": [_serialize_trust_link(link) for link in trust_links],
        "alerts": alerts,
        "score": score,
        "habit_breaker": habit,
        "neighborhood_density": _neighborhood_density(profile),
        "drills": {
            "recent": drills,
            "recommended": [
                {"id": key, "title": value["name"], "channel": value["channel"], "risk_band": value["risk_band"]}
                for key, value in SCENARIO_LIBRARY.items()
            ],
        },
        "recovery": {
            "active_cases": len(recovery_cases),
            "latest_case_id": recovery_cases[0].incident_id if recovery_cases else None,
            "latest_status": recovery_cases[0].bank_status if recovery_cases else "READY",
        },
        "notification_templates": [
            {
                "id": "TPL-ALERT-EN",
                "language": "en",
                "sample": "DRISHYAM advisory: Never share OTP, PIN, or remote screen access.",
            },
            {
                "id": "TPL-ALERT-HI",
                "language": "hi",
                "sample": "DRISHYAM सलाह: OTP, PIN या स्क्रीन एक्सेस कभी साझा न करें।",
            },
        ],
        "analytics": analytics,
    }


@router.post("/preferences")
async def update_citizen_preferences(
    body: PreferenceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _, profile = _load_profile_state(db, current_user)

    if body.district:
        profile["district"] = body.district
        profile.setdefault("completed_steps", [])
        if "profile_ready" not in profile["completed_steps"]:
            profile["completed_steps"].append("profile_ready")
    if body.language:
        profile["language"] = body.language
    if body.senior_mode is not None:
        profile["senior_mode"] = body.senior_mode
    if body.low_bandwidth is not None:
        profile["low_bandwidth"] = body.low_bandwidth
    if body.segment:
        profile["segment"] = body.segment
    if body.onboarding_step:
        profile.setdefault("completed_steps", [])
        if body.onboarding_step not in profile["completed_steps"]:
            profile["completed_steps"].append(body.onboarding_step)

    _upsert_stat(db, PROFILE_CATEGORY, f"user:{current_user.id}", profile)
    log_audit(db, current_user.id, "CITIZEN_PREFERENCES_UPDATED", resource=current_user.username, metadata=body.model_dump(exclude_none=True))
    return profile


@router.get("/trust-circle")
async def get_trust_circle(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    rows = db.query(TrustLink).filter(TrustLink.user_id == current_user.id).order_by(TrustLink.created_at.asc()).all()
    return {"trust_circle": [_serialize_trust_link(row) for row in rows]}


@router.post("/trust-circle")
async def create_trust_circle_link(
    body: TrustCircleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    normalized_phone = _normalize_phone(body.guardian_phone)
    existing = (
        db.query(TrustLink)
        .filter(TrustLink.user_id == current_user.id, TrustLink.guardian_phone == normalized_phone)
        .first()
    )
    if existing:
        return _serialize_trust_link(existing)

    row = TrustLink(
        user_id=current_user.id,
        guardian_name=body.guardian_name,
        guardian_phone=normalized_phone,
        guardian_email=body.guardian_email,
        relation_type=body.relation_type,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    _, profile = _load_profile_state(db, current_user)
    profile.setdefault("completed_steps", [])
    if "trust_circle_ready" not in profile["completed_steps"]:
        profile["completed_steps"].append("trust_circle_ready")
    _upsert_stat(db, PROFILE_CATEGORY, f"user:{current_user.id}", profile)

    analytics_row, analytics = _load_analytics_state(db, current_user)
    analytics["trust_circle_updates"] = int(analytics.get("trust_circle_updates", 0)) + 1
    _upsert_stat(db, ANALYTICS_CATEGORY, analytics_row.key, analytics)

    log_audit(db, current_user.id, "TRUST_CIRCLE_CREATED", resource=_mask_phone(normalized_phone))
    return _serialize_trust_link(row)


@router.post("/trust-circle/notify")
async def notify_trust_circle(
    body: TrustCircleNotifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    row = None
    if body.trust_link_id is not None:
        row = db.query(TrustLink).filter(TrustLink.id == body.trust_link_id, TrustLink.user_id == current_user.id).first()
    if not row:
        row = db.query(TrustLink).filter(TrustLink.user_id == current_user.id).order_by(TrustLink.created_at.asc()).first()
    if not row:
        raise HTTPException(status_code=404, detail="No trust-circle contact found")

    message = body.message or "DRISHYAM alert: your family member may need support after a suspicious scam interaction."
    db.add(
        NotificationLog(
            recipient=row.guardian_phone,
            channel="SMS",
            template_id="TRUST_CIRCLE_ALERT",
            status="DELIVERED",
            sent_at=datetime.datetime.utcnow(),
            metadata_json={
                "guardian_name": row.guardian_name,
                "citizen_user_id": current_user.id,
                "message": message,
            },
        )
    )
    db.commit()

    log_audit(db, current_user.id, "TRUST_CIRCLE_NOTIFIED", resource=_mask_phone(row.guardian_phone))
    return {
        "status": "DELIVERED",
        "guardian_name": row.guardian_name,
        "guardian_phone": _mask_phone(row.guardian_phone),
        "message_preview": message,
    }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_citizen_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    rows = (
        db.query(NotificationLog)
        .filter(NotificationLog.template_id.like("ALERT_APP_%"))
        .order_by(NotificationLog.sent_at.desc())
        .all()
    )
    matched = 0
    for row in rows:
        metadata = row.metadata_json or {}
        if metadata.get("alert_id") != alert_id:
            continue
        acknowledged_by = list(metadata.get("acknowledged_by", []))
        if current_user.id not in acknowledged_by:
            acknowledged_by.append(current_user.id)
        metadata["acknowledged_by"] = acknowledged_by
        row.metadata_json = metadata
        matched += 1

    if matched == 0:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.commit()

    analytics_row, analytics = _load_analytics_state(db, current_user)
    analytics["alerts_acknowledged"] = int(analytics.get("alerts_acknowledged", 0)) + 1
    _upsert_stat(db, ANALYTICS_CATEGORY, analytics_row.key, analytics)

    _, profile = _load_profile_state(db, current_user)
    profile.setdefault("completed_steps", [])
    if "alerts_ready" not in profile["completed_steps"]:
        profile["completed_steps"].append("alerts_ready")
    _upsert_stat(db, PROFILE_CATEGORY, f"user:{current_user.id}", profile)

    log_audit(db, current_user.id, "CITIZEN_ALERT_ACKNOWLEDGED", resource=alert_id)
    return {"alert_id": alert_id, "acknowledged": True}


@router.post("/drishyam-score/compute")
async def compute_drishyam_score(
    body: ScoreComputeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    score = min(
        40
        + body.suspicious_links_avoided * 3
        + body.drills_completed * 6
        + body.alerts_acknowledged * 2
        + body.trust_circle_contacts * 5
        + body.recovery_preparedness // 5,
        99,
    )
    result = {
        "score": score,
        "decile_band": max(1, min(10, (score + 9) // 10)),
        "computed_locally": True,
        "central_storage": False,
        "badge": "PLATINUM_SHIELD" if score >= 90 else "GOLD_SHIELD" if score >= 75 else "SILVER_SHIELD",
        "factors": body.model_dump(),
    }

    _, profile = _load_profile_state(db, current_user)
    profile["last_score"] = score
    _upsert_stat(db, PROFILE_CATEGORY, f"user:{current_user.id}", profile)

    log_audit(db, current_user.id, "CITIZEN_SCORE_COMPUTED", resource=current_user.username, metadata={"score": score})
    return result


@router.post("/habit-breaker/enrol")
async def habit_breaker_enrol(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _, state = _load_habit_state(db, current_user)
    state["enrolled"] = True
    state["streak_days"] = max(int(state.get("streak_days", 0)), 1)
    state["reward_points"] = int(state.get("reward_points", 0)) + 25
    state["last_completed_at"] = datetime.datetime.utcnow().isoformat()
    state["next_nudge_at"] = (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat()
    _upsert_stat(db, HABIT_CATEGORY, f"user:{current_user.id}", state, value="ENROLLED")

    log_audit(db, current_user.id, "HABIT_BREAKER_ENROLLED", resource=current_user.username)
    return {
        "enrolment_id": f"HAB-{uuid.uuid4().hex[:6].upper()}",
        "day1_message_scheduled": True,
        "gamification_score_initialised": True,
        "npci_reward_linked": True,
        **state,
    }


@router.get("/habit-breaker/status")
async def habit_breaker_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _, state = _load_habit_state(db, current_user)
    return state


@router.get("/profile")
async def get_citizen_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _, profile = _load_profile_state(db, current_user)
    return profile


@router.get("/recovery-companion")
async def get_recovery_companion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    latest_case = (
        db.query(RecoveryCase)
        .filter(RecoveryCase.user_id == current_user.id)
        .order_by(RecoveryCase.updated_at.desc())
        .first()
    )
    return {
        "latest_case_id": latest_case.incident_id if latest_case else None,
        "latest_status": latest_case.bank_status if latest_case else "READY",
        "next_actions": [
            "Generate bank dispute letter",
            "Prepare RBI ombudsman complaint",
            "Request legal aid referral",
            "Check mental health and family support options",
        ],
        "golden_hour_tip": "If money was just lost, contact your bank and 1930 immediately before settlement completes.",
    }


@router.get("/drill-center")
async def get_drill_center(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    drills = _recent_drills(db, current_user)
    return {
        "recent": drills,
        "scenarios": [
            {
                "id": key,
                "title": value["name"],
                "risk_band": value["risk_band"],
                "channel": value["channel"],
                "recommended_follow_up": value["recommended_follow_up"],
            }
            for key, value in SCENARIO_LIBRARY.items()
        ],
    }
