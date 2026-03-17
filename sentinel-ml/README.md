# SENTINEL-ML

**AI-powered scam call classifier, built as a standalone module for SENTINEL-1930.**

## Setup

### 1. Create virtual environment & install dependencies
```bash
cd sentinel-ml
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Train the model
```bash
python model/train.py
```
This generates `model/model.pkl` (~2MB).

### 3. Start the API server
```bash
uvicorn api.main:app --port 8001 --reload
```

### 4. Open the UI
Open `ui/index.html` directly in your browser (no server needed).

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Model status check |
| `POST` | `/classify` | Classify a single phone number |
| `POST` | `/bulk-classify` | Classify up to 100 numbers |
| `GET` | `/features` | List all input features |

### Example Request
```bash
curl -X POST http://localhost:8001/classify \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+919999999999",
    "call_velocity": 45,
    "rep_score": 0.85,
    "report_count": 12,
    "sim_age_days": 15,
    "is_vpa_linked": 1,
    "honeypot_hits": 3
  }'
```

### Example Response
```json
{
  "phone_number": "+919999999999",
  "label": "SCAM",
  "confidence": 94.2,
  "probabilities": { "SAFE": 1.1, "SUSPICIOUS": 4.7, "SCAM": 94.2 },
  "explanations": [
    { "feature": "honeypot_hits", "label": "Trapped by AI honeypot", "value": 3.0, "importance": 28.4 },
    { "feature": "rep_score", "label": "Known fraud reputation", "value": 0.85, "importance": 24.1 },
    { "feature": "report_count", "label": "Multiple citizen reports", "value": 12.0, "importance": 19.7 }
  ]
}
```

---

## Future Integration with SENTINEL-1930

1. Add `ml_verdict VARCHAR(20)` column to `call_records` in Supabase
2. In Dashboard's `detection/page.tsx`, add a call to `http://localhost:8001/classify` per row
3. Display the `label` badge and `confidence` from the ML response alongside the existing `fraud_risk_score`
