# DRISHYAM AI | Unified Fraud Defense Ecosystem 🛡️🇮🇳

Welcome to the DRISHYAM AI project. This repository contains the complete "National Level" fraud interception and surveillance system, now architected as a multi-application ecosystem for maximum realism and operational efficiency.

---

## 🏗️ Project Architecture

The system is split into three high-performance components:

1.  **Backend (FastAPI)**: The central intelligence hub. Manages the AI Honeypot engine, voice processing via **Sarvam AI**, and a persistent SQL database for forensic logging.
2.  **Agency Dashboard (Next.js)**: The operational portal for Police, Bank, and Telecom authorities. Features include the **Live Interception Monitor**, **Bharat Regional Alerts**, and **Scammer Profiling**.
3.  **Simulation Portal (Next.js)**: A standalone "trap" site (separable from the dashboard) where scammers interact with AI. This mimics a real-world scenario where the trap exists on an independent network node.

---

## ✨ "Real-Life" Mode (Production Purge)
The system has been transitioned to a **100% Dynamic Operational State**. 
- **Purged Manual Boosts**: No more "lorem ipsum" or hardcoded 10k+ numbers. Every metric (Scams blocked, Citizens protected, Estimated Savings) is now calculated in real-time from the database.
- **Dynamic Simulation**: Every trap session generates a unique `caller_num` and `location` based on active network nodes, and AI warnings are generated live from forensic analysis.
- **Agency Realism**: Police and Bank modules only show active, processed cases, ensuring no reliance on pre-recorded seed data.

---

## 🚀 Getting Started

We've provided a unified way to run all components simultaneously using `concurrently`.

### Prerequisites
- Python 3.10+ (with `ffmpeg` for voice processing)
- Node.js 18+
- Sarvam AI API Key (Set in `backend/.env`)

### Installation & Execution

1.  **Install dependencies**:
    ```bash
    # install root management tools
    npm install
    
    # install frontend dependencies
    cd dashboard && npm install
    cd ../simulation-app && npm install
    
    # install backend dependencies
    cd ../backend && pip install -r requirements.txt
    ```

2.  **Run everything**:
    From the root directory:
    ```bash
    npm run dev:all
    ```
    - Backend: `http://localhost:8000`
    - Agency Dashboard: `http://localhost:3000`
    - Simulation Portal: `http://localhost:3001`

### Verification

Run the demo-safe verification bundle before handoff or live demos:

```bash
npm run verify:launch
```

This builds both frontends and runs the backend smoke checks in [scripts/smoke_backend.py](/Users/mukul/Desktop/DRISHYAM-AI/scripts/smoke_backend.py).

Run the full MVP plus narrative bundle with:

```bash
npm run verify:mvp
```

Run the full repo PRD control-plane bundle with:

```bash
npm run verify:prd
```

### Runbook

Launch and recovery instructions live in [docs/launch_readiness_runbook.md](/Users/mukul/Desktop/DRISHYAM-AI/docs/launch_readiness_runbook.md).
Pilot execution guidance lives in [docs/pilot_launch_runbook.md](/Users/mukul/Desktop/DRISHYAM-AI/docs/pilot_launch_runbook.md).
The end-to-end demo story lives in [docs/demo_narrative_runbook.md](/Users/mukul/Desktop/DRISHYAM-AI/docs/demo_narrative_runbook.md).
The documentation index lives in [docs/documentation_index.md](/Users/mukul/Desktop/DRISHYAM-AI/docs/documentation_index.md).
The demo-scope PRD audit lives in [docs/prd_demo_scope_audit.md](/Users/mukul/Desktop/DRISHYAM-AI/docs/prd_demo_scope_audit.md).

---

## 🛡️ Operational Workflow

1.  **Access the Dashboard**: Monitor national triage health and active threats.
2.  **Deploy a Trap**: Use the **Simulation Portal**. Initiate a voice call with the AI Persona.
3.  **Real-time Surveillance**: Monitor the trap session in the **Live Monitor** tab in the Agency Dashboard.
4.  **Forensic Reporting**: After session conclusion, download the **Restitution Bundle** for FIR generation.

---

## ☁️ Cloud Deployment

- **Backend**: Deployed to **Railway** (Dockerfile-based).
- **Frontends**: Deployed to **Vercel** with `NEXT_PUBLIC_API_BASE` pointing to the Railway API.

---
✨ *Developed for the Google DeepMind Advanced Agentic Coding initiative. For A Secured Digital India.*
