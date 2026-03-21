# DRISHYAM Data Model

The SQLAlchemy model layer stores operational, forensic, and control-plane records.

## Operational Tables

- `users`, `call_records`, `detection_details`
- `honeypot_sessions`, `honeypot_messages`, `honeypot_personas`
- `crime_reports`, `intelligence_alerts`, `recovery_cases`, `file_uploads`

## Governance and Control Tables

- `citizen_consents`, `system_audit_logs`, `pilot_programs`, `pilot_feedback`
- `partner_pipeline`, `billing_records`, `support_tickets`, `governance_reviews`

JSON columns are used for flexible evidence, partner, and readiness payloads in demo-safe environments.
