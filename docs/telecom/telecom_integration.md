# Telecom Integration Guide

Telecom integration is represented in sandbox-safe form for demo and pilot workflows.

## Covered Flows

- call-risk scoring
- IVR language confirmation
- cell-broadcast alerting
- launch-readiness telecom onboarding

## Operational Notes

- Telecom APIs return deterministic demo-safe payloads when live partners are not connected.
- Sandbox readiness is exposed via `/api/v1/telecom/sandbox/status`.
- Pilot and national rollout plans reference telecom SLA and onboarding playbooks before production deployment.
