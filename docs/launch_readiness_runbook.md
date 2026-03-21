# DRISHYAM AI Launch Readiness Runbook

## Purpose

This runbook is the shortest path to bring the local demo stack up, verify that the core product slices are healthy, and recover quickly if a dependency is unavailable.

## Preflight

1. Install Node.js 18+ and Python 3.10+.
2. Confirm `backend/.env` is present if you want live third-party integrations.
3. Expect local SQLite fallback when the Supabase development database is unreachable.

## Fast Startup

From the repository root:

```bash
./run.sh
```

What it does:

- checks for `node` and `python3`
- creates `backend/venv` if missing
- installs backend requirements only when FastAPI is unavailable in the venv
- skips workspace `npm install` when `node_modules` already exists
- starts backend on `:8000`, dashboard on `:3000`, and simulation app on `:3001`

## Default Demo Credentials

- Username: `admin`
- Password: `password123`
- MFA OTP: `19301930`

## Readiness Verification

Run the launch verification bundle before demos or handoffs:

```bash
npm run verify:launch
```

This runs:

- dashboard build
- simulation build
- backend smoke checks via `scripts/smoke_backend.py`

## Demo-Safe Flow

1. Login to the dashboard with the seeded admin account and complete MFA.
2. Check `/settings` for session and audit visibility.
3. Use `/detection` to confirm honeypot-route candidates appear.
4. Use `/graph` to spotlight an entity and generate FIR context.
5. Use `/bharat` to preview regional USSD, IVR, and SMS operations.
6. Use `/deepfake`, `/inoculation`, and `/mule` to exercise the final hardened slices.

## Operational Notes

- In restricted environments, the backend can start correctly even if port binding is blocked by the sandbox.
- Deepfake analysis falls back to a local simulated forensic verdict when the external engine is unreachable.
- Bharat reporting, inoculation drills, and mule interception all have local-safe fallback data so the UI stays demoable.

## Recovery Checklist

If something looks off:

1. Re-run `npm run verify:backend`.
2. Confirm `backend/venv` exists and contains FastAPI.
3. Check that `backend/drishyam.db` is writable.
4. Rebuild frontends with `npm run build`.
5. Restart with `./run.sh`.
