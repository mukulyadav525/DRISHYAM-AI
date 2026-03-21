# DRISHYAM AI MVP Demo Narrative Runbook

This runbook is the approved MVP story for the current repo.

## Goal

Show one complete citizen-protection journey from consent to interception, intelligence packaging, alerting, and recovery support.

## Preconditions

- Start the stack with `./run.sh` or `npm run dev:all`
- Validate readiness with `npm run verify:mvp`
- Use dashboard credentials:
  - Username: `admin`
  - Password: `password123`
  - OTP: `19301930`

## Demo Flow

1. Citizen enters the simulation portal and grants protection consent.
   - UI: `simulation-app/src/components/simulation/AuthScreen.tsx`
   - Result: required consent is recorded before simulation access is requested.

2. Telecom scoring marks the caller as high-risk and routes to the honeypot.
   - Backend: `backend/api/telecom.py`
   - Dashboard: `dashboard/src/app/detection/page.tsx`

3. "Let AI Handle" transfers the interaction to a DRISHYAM persona.
   - Backend: `backend/api/honeypot.py`
   - Simulation UI: `simulation-app/src/components/simulation/ChatModule.tsx`

4. Extracted entities are shown in graph context and FIR packaging is triggered.
   - Backend: `backend/api/system.py`, `backend/api/actions.py`
   - Dashboard: `dashboard/src/app/graph/page.tsx`

5. Bank and payment defense actions are demonstrated.
   - Backend: `backend/api/upi.py`, `backend/api/notifications.py`
   - Result: VPA verification, bank freeze alerting, and NPCI hard-block are available in demo mode.

6. Citizen alerting demonstrates the public safety loop.
   - Backend: `backend/api/notifications.py`, `backend/api/system.py`
   - Dashboard: `dashboard/src/app/alerts/page.tsx`

7. Recovery, deepfake, inoculation, and mule modules can be used as follow-on proof points.
   - Dashboard:
     - `dashboard/src/app/recovery/page.tsx`
     - `dashboard/src/app/deepfake/page.tsx`
     - `dashboard/src/app/inoculation/page.tsx`
     - `dashboard/src/app/mule/page.tsx`

## Verification Hooks

- Core MVP stack: `npm run verify:launch`
- Narrative rehearsal: `npm run verify:narrative`
- Combined MVP verification: `npm run verify:mvp`

## Script Anchor

- Dialogue script: `DEMO_SCRIPT_RAMESH.txt`
- Narrative verifier: `scripts/verify_ramesh_scenario.py`
