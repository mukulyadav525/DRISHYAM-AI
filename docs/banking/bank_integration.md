# Bank Integration Guide

Bank integration is implemented as a demo-safe partner fabric around UPI, freeze alerts, recovery, and billing readiness.

## Covered Flows

- VPA verification and freeze actions
- bank dispute generation
- NPCI direct block demo path
- recovery case tracking

## Operational Notes

- `/api/v1/upi/integration/status` exposes current bank-demo readiness.
- Recovery bundles, dispute letters, and NPCI actions are normalized for dashboard use.
- Production deployment requires partner credentials, SLA approval, and legal sign-off.
