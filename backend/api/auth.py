from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from core.database import get_db
from core.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    require_role,
)
from models.database import User, UserRole

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    full_name: Optional[str] = None


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


# ─── Endpoints ──────────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # MFA requirement for Agency roles (T6)
    requires_mfa = user.role in [UserRole.ADMIN, UserRole.POLICE, UserRole.BANK, UserRole.GOVERNMENT, UserRole.TELECOM]
    
    access_token = create_access_token(data={
        "sub": user.username, 
        "role": user.role,
        "mfa_verified": not requires_mfa # Citizens pass, Agency needs step 2
    })
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "full_name": user.full_name,
        "mfa_required": requires_mfa
    }

@router.post("/mfa/verify")
def verify_mfa(otp: str, current_user: User = Depends(get_current_user)):
    """Simulated MFA verification for Agency roles."""
    if otp == "19301930": # Static demo OTP
        access_token = create_access_token(data={
            "sub": current_user.username, 
            "role": current_user.role,
            "mfa_verified": True
        })
        return {"access_token": access_token, "status": "verified"}
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
def get_me(current_user: User = Depends(get_current_user)):
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

