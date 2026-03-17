from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ForensicRequest(BaseModel):
    media_type: str = "video"
    media_url: Optional[str] = ""
    metadata: Optional[Dict[str, Any]] = None

class ForensicResponse(BaseModel):
    verdict: str  # REAL | SUSPICIOUS | FAKE
    confidence: float
    probability: float 
    false_positive_rate: float
    risk_level: str # LOW | MEDIUM | HIGH
    anomalies: list[str]
    analysis_details: Dict[str, Any]
    timestamp: datetime
