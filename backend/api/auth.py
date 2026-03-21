from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from core.database import get_db
from core.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
    get_current_user,
    get_current_verified_user,
    require_role,
    oauth2_scheme,
    PRIVILEGED_ROLES,
)
from core.audit import log_audit
from core.access_control import build_access_manifest
from models.database import AgencySession, User, UserRole

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    full_name: Optional[str] = None
    mfa_required: bool = False
    mfa_verified: bool = False
    session_id: Optional[str] = None
    access: dict


class UserCreate(BaseModel):
    username: str
    password: str
    phone_number: Optional[str] = None
    role: str = UserRole.COMMON.value
    full_name: Optional[str] = None
    email: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    is_active: bool


class MFAVerifyRequest(BaseModel):
    otp: str


class SessionStatus(BaseModel):
    username: str
    role: str
    full_name: Optional[str] = None
    mfa_required: bool
    mfa_verified: bool
    expires_at: Optional[str] = None
    session_id: Optional[str] = None
    device_label: Optional[str] = None
    device_type: Optional[str] = None
    auth_stage: Optional[str] = None
    risk_level: Optional[str] = None
    last_seen_at: Optional[str] = None
    access: dict


class UserRoleUpdateRequest(BaseModel):
    role: str
    is_active: Optional[bool] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _infer_device_context(request: Request) -> dict:
    user_agent = (request.headers.get("user-agent") or "unknown").lower()
    ip_address = request.client.host if request.client else "unknown"

    if "mobile" in user_agent or "android" in user_agent or "iphone" in user_agent:
        device_type = "MOBILE"
        device_label = "Field Mobile Device"
    elif "codex" in user_agent:
        device_type = "DESKTOP"
        device_label = "Codex Desktop Console"
    elif "testclient" in user_agent:
        device_type = "AUTOMATION"
        device_label = "Automated Test Client"
    else:
        device_type = "WEB"
        device_label = "Agency Web Console"

    trusted_hosts = {"127.0.0.1", "localhost", "testclient"}
    network_zone = "LOCAL_TRUSTED" if ip_address in trusted_hosts else "PARTNER_EDGE"
    risk_level = "LOW" if network_zone == "LOCAL_TRUSTED" and device_type != "MOBILE" else "MEDIUM"

    return {
        "device_label": device_label,
        "device_type": device_type,
        "ip_address": ip_address,
        "network_zone": network_zone,
        "risk_level": risk_level,
        "user_agent": request.headers.get("user-agent"),
    }


# ─── Endpoints ──────────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    requires_mfa = user.role in PRIVILEGED_ROLES
    session_uid = f"SES-{uuid.uuid4().hex[:10].upper()}"
    device_context = _infer_device_context(request)

    agency_session = AgencySession(
        session_uid=session_uid,
        user_id=user.id,
        device_label=device_context["device_label"],
        device_type=device_context["device_type"],
        ip_address=device_context["ip_address"],
        network_zone=device_context["network_zone"],
        auth_stage="PASSWORD_ONLY" if requires_mfa else "MFA_VERIFIED",
        risk_level=device_context["risk_level"],
        status="ACTIVE",
        last_seen_at=_utcnow(),
        verified_at=None if requires_mfa else _utcnow(),
        metadata_json={"user_agent": device_context["user_agent"]},
    )
    db.add(agency_session)
    db.commit()

    access_token = create_access_token(data={
        "sub": user.username,
        "role": user.role,
        "mfa_verified": not requires_mfa,
        "session_uid": session_uid,
    })

    log_audit(
        db,
        user.id,
        "LOGIN_SUCCESS",
        user.username,
        metadata={
            "mfa_required": requires_mfa,
            "session_uid": session_uid,
            "device_type": device_context["device_type"],
            "risk_level": device_context["risk_level"],
        },
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "full_name": user.full_name,
        "mfa_required": requires_mfa,
        "mfa_verified": not requires_mfa,
        "session_id": session_uid,
        "access": build_access_manifest(db, user),
    }

@router.post("/mfa/verify", response_model=Token)
def verify_mfa(
    body: MFAVerifyRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Simulated MFA verification for Agency roles."""
    if body.otp == "19301930": # Static demo OTP
        payload = decode_access_token(token)
        session_uid = payload.get("session_uid")
        agency_session = None
        if session_uid:
            agency_session = (
                db.query(AgencySession)
                .filter(
                    AgencySession.session_uid == session_uid,
                    AgencySession.user_id == current_user.id,
                )
                .first()
            )
            if not agency_session or agency_session.status != "ACTIVE":
                raise HTTPException(status_code=401, detail="Session is no longer active")

            agency_session.auth_stage = "MFA_VERIFIED"
            agency_session.verified_at = _utcnow()
            agency_session.last_seen_at = _utcnow()
            db.commit()

        access_token = create_access_token(data={
            "sub": current_user.username,
            "role": current_user.role,
            "mfa_verified": True,
            "session_uid": session_uid,
        })
        log_audit(
            db,
            current_user.id,
            "MFA_VERIFIED",
            current_user.username,
            metadata={"session_uid": session_uid},
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": current_user.role,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "mfa_required": current_user.role in PRIVILEGED_ROLES,
            "mfa_verified": True,
            "session_id": session_uid,
            "access": build_access_manifest(db, current_user),
        }
    raise HTTPException(status_code=400, detail="Invalid MFA OTP")


@router.post("/register", response_model=UserOut)
def register_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Only admins can register new users."""
    # Check if username already exists
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Validate role
    valid_roles = [r.value for r in UserRole]
    if user_in.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    from core.security_utils import encrypt_pii
    new_user = User(
        username=user_in.username,
        phone_number=encrypt_pii(user_in.phone_number),
        email=encrypt_pii(user_in.email),
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Decrypt for response
    from core.security_utils import decrypt_pii
    new_user.phone_number = decrypt_pii(new_user.phone_number)
    new_user.email = decrypt_pii(new_user.email)
    return new_user


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_verified_user)):
    from core.security_utils import decrypt_pii
    current_user.phone_number = decrypt_pii(current_user.phone_number)
    current_user.email = decrypt_pii(current_user.email)
    return current_user


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Admin only: list all users."""
    from core.security_utils import decrypt_pii
    users = db.query(User).all()
    for u in users:
        u.phone_number = decrypt_pii(u.phone_number)
        u.email = decrypt_pii(u.email)
    return users


@router.patch("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    body: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    valid_roles = [r.value for r in UserRole]
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.role = body.role
    if body.is_active is not None:
        target.is_active = body.is_active
    db.commit()
    db.refresh(target)

    log_audit(
        db,
        current_user.id,
        "USER_ROLE_UPDATED",
        resource=target.username,
        metadata={"role": target.role, "is_active": target.is_active},
    )

    from core.security_utils import decrypt_pii
    target.phone_number = decrypt_pii(target.phone_number)
    target.email = decrypt_pii(target.email)
    return target


@router.get("/session", response_model=SessionStatus)
def get_session_status(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    exp = payload.get("exp")
    expires_at = None
    if exp:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).isoformat()

    session_uid = payload.get("session_uid")
    agency_session = None
    if session_uid:
        agency_session = (
            db.query(AgencySession)
            .filter(
                AgencySession.session_uid == session_uid,
                AgencySession.user_id == current_user.id,
            )
            .first()
        )

    return {
        "username": current_user.username,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "mfa_required": current_user.role in PRIVILEGED_ROLES,
        "mfa_verified": bool(payload.get("mfa_verified", False)),
        "expires_at": expires_at,
        "session_id": session_uid,
        "device_label": agency_session.device_label if agency_session else None,
        "device_type": agency_session.device_type if agency_session else None,
        "auth_stage": agency_session.auth_stage if agency_session else None,
        "risk_level": agency_session.risk_level if agency_session else None,
        "last_seen_at": agency_session.last_seen_at.isoformat() if agency_session and agency_session.last_seen_at else None,
        "access": build_access_manifest(db, current_user),
    }
