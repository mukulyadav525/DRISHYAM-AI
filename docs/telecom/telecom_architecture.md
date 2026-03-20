# Telecom Architecture Spec (Phase 7)
## National Gateway Interface (NGI)

### 1. SIP Handoff Protocol
- **Endpoint**: `https://api.drishyam1930.gov.in/v1/telecom/handoff`
- **Method**: POST
- **Payload**:
  ```json
  {
    "call_id": "UUID",
    "caller_msisdn": "E.164",
    "target_msisdn": "E.164",
    "timestamp": "ISO8601",
    "origination_node": "TSP-ID",
    "risk_score_request": true
  }
  ```

### 2. USSD Routing (*1930#)
- **Primary Node**: National Unified USSD Gateway (1.0)
- **Interaction Model**:
  1. User dials *1930#
  2. Telecom Node sends HTTP/XML packet to DRISHYAM AI USSD Service.
  3. DRISHYAM AI returns Menu (1. Report Fraud, 2. Check Score, 3. Recovery).

### 3. Cell Broadcast Interface
- **Trigger**: `POST /v1/telecom/broadcast`
- **Scopes**: 
  - `ZONE_SURGE`: When >10 reports originate from a specific cell tower in 60 mins.
  - `STATE_CRUCIAL`: For national-level warnings.

### 4. 2-Hour Sharing Rule
- All Telecom Service Providers (TSPs) MUST ingest DRISHYAM AI Fraud Feeds every 120 minutes to block reported IMEI/IMSI ranges globally.
