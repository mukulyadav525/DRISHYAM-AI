"""
DRISHYAM-ML: Inference Engine
Loads the trained model and provides the predict() function used by the FastAPI server.
"""
import os
import joblib
import numpy as np
from typing import Any

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

# Feature order (must match train.py)
FEATURES = [
    "call_velocity",
    "rep_score",
    "report_count",
    "sim_age_days",
    "is_vpa_linked",
    "avg_call_duration",
    "geographic_anomaly",
    "honeypot_hits",
    "scam_network_degree",
]

HUMAN_LABELS = {
    "call_velocity": "High call frequency",
    "rep_score": "Known fraud reputation",
    "report_count": "Multiple citizen reports",
    "sim_age_days": "Very new SIM card",
    "is_vpa_linked": "Linked to fraudulent VPA",
    "avg_call_duration": "Unusually short calls",
    "geographic_anomaly": "Geographic location mismatch",
    "honeypot_hits": "Trapped by AI honeypot",
    "scam_network_degree": "Connected to scam network",
}

_bundle = None


def _load_model():
    global _bundle
    if _bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. Run `python model/train.py` first."
            )
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def predict(metadata: dict[str, Any]) -> dict:
    """
    Predict the scam classification for a phone number given its metadata.
    Returns label, confidence, and a human-readable explanation.
    """
    bundle = _load_model()
    clf = bundle["model"]
    label_map = bundle["labels"]

    # Build feature vector with safe defaults
    feature_vector = np.array([[
        float(metadata.get("call_velocity", 0)),
        float(metadata.get("rep_score", 0.0)),
        float(metadata.get("report_count", 0)),
        float(metadata.get("sim_age_days", 365)),
        float(metadata.get("is_vpa_linked", 0)),
        float(metadata.get("avg_call_duration", 60.0)),
        float(metadata.get("geographic_anomaly", 0)),
        float(metadata.get("honeypot_hits", 0)),
        float(metadata.get("scam_network_degree", 0)),
    ]])

    # Prediction
    label_idx = int(clf.predict(feature_vector)[0])
    probas = clf.predict_proba(feature_vector)[0]
    confidence = float(round(probas[label_idx] * 100, 1))
    label = label_map[label_idx]

    # Feature importance for explanability (top 3 drivers)
    feature_importances = clf.feature_importances_
    fv = feature_vector[0]

    # Score each feature: importance * normalized input contribution
    scaled = np.abs(fv / (np.max(np.abs(fv)) + 1e-9))
    contribution = feature_importances * scaled
    top_indices = np.argsort(contribution)[::-1][:3]

    explanations = []
    for idx in top_indices:
        fname = FEATURES[idx]
        val = fv[idx]
        human = HUMAN_LABELS.get(fname, fname)
        explanations.append({
            "feature": fname,
            "label": human,
            "value": round(val, 2),
            "importance": round(float(feature_importances[idx]) * 100, 1),
        })

    return {
        "label": label,
        "label_index": label_idx,
        "confidence": confidence,
        "probabilities": {
            "SAFE": round(float(probas[0]) * 100, 1),
            "SUSPICIOUS": round(float(probas[1]) * 100, 1),
            "SCAM": round(float(probas[2]) * 100, 1),
        },
        "explanations": explanations,
    }
