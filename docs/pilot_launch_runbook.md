# DRISHYAM AI Pilot Launch Runbook

This runbook covers the first post-MVP phase from the PRD: Phase 34 pilot launch.

## Purpose

Move from a validated MVP into a live, measured pilot configuration with selected geography, agencies, languages, metrics, feedback, and outcome reporting.

## Product Surface

- Launch control UI: `dashboard/src/app/launch/page.tsx`
- Pilot API: `backend/api/pilot.py`
- Runtime verification: `scripts/smoke_backend.py`

## Pilot Checklist

1. Configure pilot geography, telecom partner, bank partners, agencies, languages, and scam categories.
2. Lock pilot-only dashboard scope.
3. Set pilot success metrics.
4. Mark analyst, police, bank, and field-support training progress.
5. Launch pilot communications.
6. Capture daily pilot metrics snapshots.
7. Collect field feedback.
8. Publish the pilot outcome report.

## Recommended Demo Configuration

- Geography: `Delhi NCR + Mewat`
- Telecom partner: `Airtel Sandbox`
- Bank partners: `SBI`, `HDFC Bank`
- Languages: `Hindi`, `English`
- Scam categories: `KYC Fraud`, `UPI Collect Scam`, `Deepfake Impersonation`

## Verification

Run:

```bash
npm run verify:mvp
```

This now includes pilot program update, training update, communications launch, metrics snapshot, feedback capture, readiness computation, and outcome report publish checks.

## Operational Notes

- Pilot integrations remain sandbox or demo-grade unless live credentials are configured.
- The launch page shows real readiness progress from the backend checklist.
- Outcome reporting is generated from saved pilot state, metrics, and field feedback.
