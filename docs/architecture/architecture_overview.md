# DRISHYAM Architecture Overview

DRISHYAM AI is a full-stack anti-fraud platform with a FastAPI backend, an agency dashboard, and a citizen simulation app.

## Core Layers

- Detection and intelligence APIs score calls, payments, alerts, deepfakes, and fraud graphs.
- Engagement layers include honeypot, Bharat messaging, inoculation drills, and recovery workflows.
- Control-plane layers include pilot launch, national scale planning, business ops, support readiness, governance, and launch gating.

## Runtime

- Development uses FastAPI plus SQLite fallback when the remote database is unavailable.
- Dashboard and simulation surfaces are Next.js apps.
- Shared verification uses backend smoke tests plus end-to-end narrative checks.
