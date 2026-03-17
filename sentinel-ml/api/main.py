"""
SENTINEL-ML: FastAPI Inference Server
Standalone API — runs on port 8001, separate from SENTINEL-1930 backend.

Run: uvicorn api.main:app --port 8001 --reload
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import sys
import os

# Ensure the sentinel-ml root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model.classifier import predict

app = FastAPI(
    title="SENTINEL-ML: Scam Classifier",
    description="AI-powered phone number scam classification engine for SENTINEL-1930.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to dashboard origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClassifyRequest(BaseModel):
    phone_number: str = Field(..., example="+919876543210")
    call_velocity: Optional[int] = Field(0, description="Calls made in last 24h")
    rep_score: Optional[float] = Field(0.0, ge=0.0, le=1.0, description="Fraud reputation (0-1)")
    report_count: Optional[int] = Field(0, description="Times reported by citizens")
    sim_age_days: Optional[int] = Field(365, description="SIM card age in days")
    is_vpa_linked: Optional[int] = Field(0, description="Is a fraudulent VPA linked (0/1)")
    avg_call_duration: Optional[float] = Field(60.0, description="Avg call duration in seconds")
    geographic_anomaly: Optional[int] = Field(0, description="Geographic location mismatch (0/1)")
    honeypot_hits: Optional[int] = Field(0, description="Times trapped by AI honeypot")
    scam_network_degree: Optional[int] = Field(0, description="Connections to scam network nodes")


class ClassifyResponse(BaseModel):
    phone_number: str
    label: str
    confidence: float
    probabilities: dict
    explanations: list


@app.get("/health")
def health():
    """Model health check."""
    try:
        # Quick sanity check that the model is loadable
        from model.classifier import _load_model
        _load_model()
        return {"status": "ok", "model": "RandomForestClassifier", "version": "1.0.0"}
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Model not trained. Run: python model/train.py")


@app.post("/classify", response_model=ClassifyResponse)
def classify(request: ClassifyRequest):
    """
    Classify a phone number as SAFE, SUSPICIOUS, or SCAM.
    Provide as much metadata as available — unknown fields default to safe values.
    """
    metadata = request.model_dump(exclude={"phone_number"})
    result = predict(metadata)
    return {
        "phone_number": request.phone_number,
        **result,
    }


@app.post("/bulk-classify")
def bulk_classify(requests: list[ClassifyRequest]):
    """Batch classify up to 100 numbers at once."""
    if len(requests) > 100:
        raise HTTPException(status_code=400, detail="Max 100 numbers per batch.")
    results = []
    for req in requests:
        metadata = req.model_dump(exclude={"phone_number"})
        result = predict(metadata)
        results.append({"phone_number": req.phone_number, **result})
    return {"count": len(results), "results": results}


@app.get("/features")
def get_features():
    """Returns the list of features the model uses, with descriptions."""
    return {
        "features": [
            {"name": "call_velocity", "description": "Calls made in last 24h", "type": "int", "default": 0},
            {"name": "rep_score", "description": "Known fraud reputation (0.0 - 1.0)", "type": "float", "default": 0.0},
            {"name": "report_count", "description": "Times reported by citizens", "type": "int", "default": 0},
            {"name": "sim_age_days", "description": "SIM card age in days", "type": "int", "default": 365},
            {"name": "is_vpa_linked", "description": "Is a fraudulent VPA linked (0/1)", "type": "int", "default": 0},
            {"name": "avg_call_duration", "description": "Average call duration in seconds", "type": "float", "default": 60},
            {"name": "geographic_anomaly", "description": "Geographic location mismatch (0/1)", "type": "int", "default": 0},
            {"name": "honeypot_hits", "description": "Times trapped by AI honeypot", "type": "int", "default": 0},
            {"name": "scam_network_degree", "description": "Connections to scam network nodes", "type": "int", "default": 0},
        ]
    }
