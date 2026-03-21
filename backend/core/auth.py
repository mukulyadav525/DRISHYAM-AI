from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from core.config import settings
from core.database import get_db
from models.database import AgencySession, User

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
PRIVILEGED_ROLES = {"admin", "police", "bank", "government", "telecom", "court"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


SESSION_LAST_SEEN_WRITE_INTERVAL = timedelta(seconds=30)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    session_uid = payload.get("session_uid")
    if session_uid:
        session_row = (
            db.query(AgencySession)
            .filter(
                AgencySession.session_uid == session_uid,
                AgencySession.user_id == user.id,
            )
            .first()
        )
        if not session_row or session_row.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session is no longer active",
                headers={"WWW-Authenticate": "Bearer"},
            )

        now = _utcnow()
        should_commit = False
        if (
            session_row.last_seen_at is None
            or now - session_row.last_seen_at >= SESSION_LAST_SEEN_WRITE_INTERVAL
        ):
            session_row.last_seen_at = now
            should_commit = True
        if payload.get("mfa_verified", False) and session_row.auth_stage != "MFA_VERIFIED":
            session_row.auth_stage = "MFA_VERIFIED"
            session_row.verified_at = session_row.verified_at or now
            should_commit = True
        if should_commit:
            db.commit()

    return user


async def get_current_verified_user(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
) -> User:
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    requires_mfa = current_user.role in PRIVILEGED_ROLES
    if requires_mfa and not payload.get("mfa_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA verification required for this account",
        )

    return current_user


def require_role(*allowed_roles: str):
    """
    FastAPI dependency factory that restricts access to specific roles.
    Usage: Depends(require_role("admin", "police"))
    """
    async def role_checker(current_user: User = Depends(get_current_verified_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
