"""
SENTINEL-ML: Scam Number Classifier — Training Script
Generates synthetic training data representative of SENTINEL-1930's threat profile
and trains a RandomForestClassifier. Saves the model to model/model.pkl.

Run: python model/train.py
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import os

# ── Feature columns (must match classifier.py) ──────────────────────────────
FEATURES = [
    "call_velocity",       # Calls made in last 24h (int)
    "rep_score",           # Known fraud reputation score 0.0-1.0 (float)
    "report_count",        # Times reported by citizens (int)
    "sim_age_days",        # SIM card age in days (int)
    "is_vpa_linked",       # Is a fraudulent VPA attached? (bool 0/1)
    "avg_call_duration",   # Average call duration in seconds (float)
    "geographic_anomaly",  # Location mismatch flag (bool 0/1)
    "honeypot_hits",       # Times trapped by honeypot (int)
    "scam_network_degree", # Connections to known scam cluster nodes (int)
]
# Labels: 0=SAFE, 1=SUSPICIOUS, 2=SCAM
LABEL_MAP = {0: "SAFE", 1: "SUSPICIOUS", 2: "SCAM"}

def generate_synthetic_data(n_samples: int = 5000) -> pd.DataFrame:
    """
    Generates realistic synthetic data matching the feature distribution
    observed in Indian telecom scam patterns (2022-2025).
    """
    rng = np.random.default_rng(42)
    rows = []

    for _ in range(n_samples):
        label = rng.choice([0, 1, 2], p=[0.55, 0.25, 0.20])

        if label == 0:  # SAFE
            row = {
                "call_velocity": rng.integers(0, 5),
                "rep_score": rng.uniform(0.0, 0.15),
                "report_count": rng.integers(0, 2),
                "sim_age_days": rng.integers(180, 3650),
                "is_vpa_linked": 0,
                "avg_call_duration": rng.uniform(30, 300),
                "geographic_anomaly": 0,
                "honeypot_hits": 0,
                "scam_network_degree": 0,
            }
        elif label == 1:  # SUSPICIOUS
            row = {
                "call_velocity": rng.integers(5, 30),
                "rep_score": rng.uniform(0.2, 0.6),
                "report_count": rng.integers(1, 5),
                "sim_age_days": rng.integers(30, 365),
                "is_vpa_linked": rng.choice([0, 1], p=[0.6, 0.4]),
                "avg_call_duration": rng.uniform(10, 90),
                "geographic_anomaly": rng.choice([0, 1], p=[0.5, 0.5]),
                "honeypot_hits": rng.integers(0, 3),
                "scam_network_degree": rng.integers(0, 5),
            }
        else:  # SCAM
            row = {
                "call_velocity": rng.integers(30, 200),
                "rep_score": rng.uniform(0.6, 1.0),
                "report_count": rng.integers(5, 50),
                "sim_age_days": rng.integers(1, 90),
                "is_vpa_linked": 1,
                "avg_call_duration": rng.uniform(5, 45),
                "geographic_anomaly": 1,
                "honeypot_hits": rng.integers(1, 15),
                "scam_network_degree": rng.integers(3, 20),
            }

        row["label"] = label
        rows.append(row)

    return pd.DataFrame(rows)


def train():
    print("🔬 SENTINEL-ML: Training Scam Classifier...")
    df = generate_synthetic_data(n_samples=5000)

    X = df[FEATURES]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # RandomForest: strong baseline, explainable, no GPU required
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_split=5,
        class_weight="balanced",  # Handles SAFE imbalance
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)

    # ── Evaluate ──────────────────────────────────────────────────────────────
    y_pred = clf.predict(X_test)
    print("\n📊 Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["SAFE", "SUSPICIOUS", "SCAM"]))

    # ── Save model ────────────────────────────────────────────────────────────
    model_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(model_dir, "model.pkl")
    joblib.dump({"model": clf, "features": FEATURES, "labels": LABEL_MAP}, model_path)
    print(f"\n✅ Model saved to: {model_path}")


if __name__ == "__main__":
    train()
