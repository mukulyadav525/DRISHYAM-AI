# Sentinel 1930 | Unified Fraud Defense Ecosystem

Welcome to the Sentinel 1930 project. This repository contains the complete "National Level" fraud interception and surveillance system, now architected as a multi-application ecosystem for maximum realism and operational efficiency.

## 🏗️ Project Architecture

The system consists of three primary components:

1.  **Backend (FastAPI)**: The central intelligence hub. Manages the AI Honeypot engine, voice processing (STT/TTS), and the persistent fraud database.
2.  **Agency Dashboard (Next.js - Port 3000)**: The operational portal for Police, Bank, and Telecom authorities. Includes the **Live Interception Monitor** for real-time tracking of scam attempts.
3.  **Simulation Portal (Next.js - Port 3001)**: A standalone "trap" site where scammers interact with AI personas. This app is isolated from the main dashboard to mimic a realistic external environment.

---

## 🚀 Getting Started

We've provided a unified way to run all components simultaneously using `concurrently`.

### Prerequisites
- Python 3.10+
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
    This will start:
    - Backend on `http://localhost:8000`
    - Agency Dashboard on `http://localhost:3000`
    - Simulation Portal on `http://localhost:3001`

---

## 🛡️ Operational Workflow

1.  **Access the Dashboard**: Use the Agency Portal to monitor national triage health and active threats.
2.  **Deploy a Trap**: Open the **Simulation Portal**. Choose an AI Persona (e.g., "Elderly Uncle") and initiate a call.
3.  **Real-time Surveillance**: Keep the **Live Monitor** tab open in the Agency Dashboard. You will see the trap session appear immediately as it begins.
4.  **Forensic Reporting**: Once the AI concludes the session (after wasting significant scammer time), the dashboard will provide a full forensic analysis ready for FIR generation.

---

## ☁️ Cloud Deployment

For a "real-life" production experience, follow the [Deployment Guide](file:///Users/mukul/.gemini/antigravity/brain/42d480fb-9861-4c1d-b966-2e52117d9d31/deployment_plan.md).

### 1. Backend (Railway)
- Connect your GitHub repository to Railway.
- Railway will detect the `backend/Dockerfile`.
- Set the required environment variables: `SARVAM_API_KEY`, `GEMINI_API_KEY`, `SECRET_KEY`.

### 2. Frontends (Vercel)
- Deploy the `dashboard` and `simulation-app` folders as separate projects on Vercel.
- Set `NEXT_PUBLIC_API_BASE` for each to your Railway backend URL + `/api/v1`.

---
*Developed for the Google DeepMind Advanced Agentic Coding initiative.*
