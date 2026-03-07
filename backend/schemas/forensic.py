from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ForensicRequest(BaseModel):
    media_type: str = "video"
    media_url: Optional[str] = ""
    metadata: Optional[Dict[str, Any]] = None

class ForensicResponse(BaseModel):
    verdict: str  # DEEPFAKE | VERIFIED
    confidence: float
    analysis_details: Dict[str, Any]
    timestamp: datetime
