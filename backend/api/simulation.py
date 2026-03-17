from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from core.database import get_db
from core.auth import require_role, create_access_token
from models.database import SimulationRequest, User, UserRole
import datetime
import uuid

router = APIRouter()

# --- Schemas ---
class SimulationRequestCreate(BaseModel):
    phone_number: str

class SimulationRequestOut(BaseModel):
    id: int
    phone_number: str
    status: str
    requested_at: datetime.datetime
    processed_at: Optional[datetime.datetime] = None
    access_token: Optional[str] = None

    class Config:
        from_attributes = True

# --- Endpoints ---

@router.post("/request", response_model=SimulationRequestOut)
def create_request(req_in: SimulationRequestCreate, db: Session = Depends(get_db)):
    """Citizens call this to request access to the simulation."""
    # Check if a request already exists
    existing = db.query(SimulationRequest).filter(SimulationRequest.phone_number == req_in.phone_number).first()
    if existing:
        return existing
    
    new_request = SimulationRequest(
        phone_number=req_in.phone_number,
        status="pending"
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    return new_request

@router.get("/status/{phone}", response_model=SimulationRequestOut)
def get_status(phone: str, db: Session = Depends(get_db)):
    """Simulation app calls this to check if access is granted."""
    request = db.query(SimulationRequest).filter(SimulationRequest.phone_number == phone).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # If approved, generate a token for the user
    if request.status == "approved":
        # Ensure a User object exists for this simulation phone number
        user = db.query(User).filter(User.username == phone).first()
        if not user:
            from core.auth import get_password_hash
            user = User(
                username=phone,
                phone_number=phone,
                hashed_password=get_password_hash(uuid.uuid4().hex),
                role=UserRole.COMMON.value,
                is_active=True,
                full_name=f"Simulation User {phone[-4:]}"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Generate token
        token = create_access_token(data={
            "sub": user.username,
            "role": user.role,
            "mfa_verified": True # Simulation users are pre-verified
        })
        request.access_token = token
        
    return request

@router.get("/list", response_model=List[SimulationRequestOut])
def list_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Admin only: list all simulation requests."""
    return db.query(SimulationRequest).order_by(SimulationRequest.requested_at.desc()).all()

@router.post("/approve/{request_id}")
def approve_request(
    request_id: int,
    approve: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Admin only: approve or reject a request."""
    request = db.query(SimulationRequest).filter(SimulationRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request.status = "approved" if approve else "rejected"
    request.processed_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": f"Request {request_id} set to {request.status}"}
