from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class CallCreate(BaseModel):
    caller_num: str
    receiver_num: str
    duration: Optional[int] = 0
    call_type: str = "incoming"
    sim_age: Optional[int] = 365
    cli_spoofed: Optional[bool] = False
    prior_complaints: Optional[int] = 0
    metadata: Optional[Dict] = {}

class DetectionResponse(BaseModel):
    call_id: int
    fraud_risk_score: float
    verdict: str
    timestamp: datetime

class SuspiciousNumberSchema(BaseModel):
    phone_number: str
    reputation_score: float
    category: str
    report_count: int

    class Config:
        from_attributes = True
