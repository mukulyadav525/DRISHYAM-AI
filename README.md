# DRISHYAM AI 🛡️🇮🇳
### India's Real-Time Fraud Interception, Intelligence & Recovery Platform

> **Built by ThassaAI (Threat Analysis & Security Surveillance Application - AI)**
> IIIT-Delhi | Cyber Security Track | Smart India Hackathon 2025

---

## 🎯 Mission

India loses **₹13,333 crore every year** to telecom-based fraud. 40 crore Indians on feature phones have zero protection. Every existing system acts *after* money is lost.

**DRISHYAM AI intercepts before the money moves.**

One platform. 5 live modules. 22 Indian languages. Every device. Every district.

> *Scam starts → AI intercepts → Evidence extracted → Police + Bank + Telecom notified → Victim recovers.*

---

## 🏗️ System Architecture

The platform is split into three high-performance components:

```
DRISHYAM-AI/
├── backend/          # FastAPI — AI Honeypot engine, voice processing, fraud graph
├── dashboard/        # Next.js — Agency portal (Police, Bank, Telecom, MHA)
└── simulation-app/   # Next.js — Citizen trap portal & scam simulation layer
```

| Component | Tech | Port | Purpose |
|---|---|---|---|
| **Backend** | FastAPI + Python | `8000` | AI honeypot, Sarvam AI voice, Neo4j fraud graph, forensic DB |
| **Agency Dashboard** | Next.js | `3000` | Live monitor, FIR generator, 773-district heatmap, scammer profiles |
| **Simulation Portal** | Next.js | `3001` | Citizen-facing trap, UPI Armor, Bharat USSD layer, recovery flow |

---

## 🧩 The 5 Live Modules

### Module 1 — AI Scam Handoff (Honeypot Engine)
One tap transfers a suspicious call to our AI agent. The scammer never knows they are speaking to an AI. The agent engages, delays, and extracts structured intelligence — UPI IDs, phone clusters, bank references, scam scripts — formatted as **Indian Evidence Act Section 65B court-admissible evidence** in under 60 seconds.

### Module 2 — UPI Armor
Citizens verify any UPI ID, QR code, or payment link before acting. Flagged entities are instantly escalated to the linked bank's fraud team via structured API. Protects over ₹18,000 crore in monthly UPI transactions.

### Module 3 — Bharat Layer (USSD + IVR + Cell Broadcast)
`*1930#` on any phone. No app. No internet. No smartphone required. IVR support in **22 Indian languages**. Cell Broadcast tower mesh pushes emergency alerts to every SIM in a 2km radius during a scam surge — reaching **40 crore** Indians that every other tool ignores.

### Module 4 — Agency Dashboard
Real-time case routing to bank fraud team, cyber police, and telecom partner — **simultaneously**. One-click FIR packet generation in under 60 seconds. Live fraud heatmaps across all **773 districts**. Role-based access for MHA, RBI, CERT-In, NPCI, SEBI, and all 28 state cyber police units.

### Module 5 — Recovery Companion
Auto-generated bank dispute letters, RBI Ombudsman complaint pre-fill, Consumer Court filing guidance, NALSA free legal aid connection, and mental health referral — all in one guided flow, in 22 languages. The only platform that stays with the victim after the scam is over.

---

## ✨ Production Mode

The system runs in a **100% Dynamic Operational State**:

- **No hardcoded data** — every metric (scams blocked, citizens protected, estimated savings) is calculated in real-time from the database
- **Dynamic simulation** — every trap session generates a unique `caller_num` and `location` from active network nodes
- **AI warnings generated live** from forensic analysis of each session
- **Agency modules** show only active, processed cases — no seed data

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+ (with `ffmpeg` for voice processing)
- Node.js 18+
- Sarvam AI API Key (set in `backend/.env`)

### Installation

```bash
# Install root management tools
npm install

# Install frontend dependencies
cd dashboard && npm install
cd ../simulation-app && npm install

# Install backend dependencies
cd ../backend && pip install -r requirements.txt
```

### Run Everything

From the root directory:

```bash
npm run dev:all
```

| Service | URL |
|---|---|
| Backend API | `http://localhost:8000` |
| Agency Dashboard | `http://localhost:3000` |
| Simulation Portal | `http://localhost:3001` |

---

## 🧪 Verification Suite

```bash
# Demo-safe pre-handoff checks
npm run verify:launch

# Full MVP + narrative bundle
npm run verify:mvp

# Full repo PRD control-plane bundle
npm run verify:prd

# Backend API contract suite
npm run verify:contracts

# Load, soak, chaos, recovery & failover validation
npm run verify:resilience

# Browser E2E suite (Chrome) — citizen, UPI Armor, Bharat, recovery journeys
npm run verify:e2e
```

> The resilience suite runs against an isolated local verification database — drills are repeatable and do not mutate the live Supabase dataset.

---

## 🔑 Demo Credentials

| Portal | Field | Value |
|---|---|---|
| Simulation App | Phone | `9050864264` |
| Agency Dashboard | Username | `admin` |
| Agency Dashboard | Password | `password123` |
| Agency Dashboard | 2FA | `19301930` |

---

## 📋 Operational Workflow

```
1. Access Agency Dashboard    → Monitor national triage health and active threats
2. Deploy a Trap              → Simulation Portal → Initiate voice call with AI Persona
3. Real-time Surveillance     → Live Monitor tab → Watch session in real time
4. Forensic Reporting         → Download Restitution Bundle → FIR auto-generated
```

---

## 🛠️ Technology Stack

| Layer | Stack |
|---|---|
| **AI / ML** | LLM fine-tuned on fraud transcripts · Sarvam AI (voice) · IndicASR · NER (IndicNLP) · RawNet3 (deepfake audio) · PyG GNN (fraud graph) |
| **Backend** | Python FastAPI · Apache Kafka · Neo4j Enterprise · PostgreSQL · Redis · Weaviate Vector DB |
| **Telecom** | Asterisk + FreeSWITCH (SIP/VoIP) · USSD Gateway · Exotel IVR · Cell Broadcast · MSG91 |
| **Frontend** | Next.js · React Native · D3.js (fraud graph) · Mapbox (district heatmaps) |
| **Infrastructure** | Railway (backend) · Vercel (frontends) · Kubernetes · AWS ap-south-1 |
| **Security** | AES-256 · TLS 1.3 · Kyber-1024 PQC · DPDP Act 2023 · Evidence Act Section 65B |

---

## ☁️ Cloud Deployment

| Component | Platform | Config |
|---|---|---|
| Backend | **Railway** | Dockerfile-based deployment |
| Agency Dashboard | **Netlify** | `NEXT_PUBLIC_API_BASE` → Railway API URL |
| Simulation Portal | **Netlify** | `NEXT_PUBLIC_API_BASE` → Railway API URL |

---

## 📚 Documentation

| Document | Path |
|---|---|
| Launch & Recovery Runbook | `docs/launch_readiness_runbook.md` |
| Pilot Execution Guide | `docs/pilot_launch_runbook.md` |
| End-to-End Demo Story | `docs/demo_narrative_runbook.md` |
| Documentation Index | `docs/documentation_index.md` |
| PRD Demo Scope Audit | `docs/prd_demo_scope_audit.md` |

---

## 📊 Impact Targets

| Metric | Year 1 | Year 3 |
|---|---|---|
| Fraud losses prevented | ₹500 Cr | ₹6,000 Cr |
| Citizens saved | 10 Lakh | 1.5 Crore |
| Feature-phone users protected | 5 Crore | 40 Crore |
| Mule accounts frozen | 50,000 | 8 Lakh |
| FIR packets generated | 25,000 | 5 Lakh |
| Scammer profiles → Interpol | 500 | 10,000 |
| Districts with live heatmap | 100 | 773 |

---

## 💼 Business Model

**Citizens pay nothing. Ever.**
Revenue comes from institutions that benefit from a scam-free India.

| Stream | Customer | Pricing |
|---|---|---|
| Government B2G | MHA, state cyber cells | ₹50L – ₹5 Cr/year |
| Telecom SaaS | Jio, Airtel, Vi, BSNL | ₹1 – ₹6 Cr/year |
| Banking Alert API | 650+ banks | ₹2–5 per alert |
| Corporate Drills | Enterprise HR | ₹49/employee/month |
| Citizen Suraksha+ | Smartphone users | ₹49/month |

**Revenue: ₹7 Cr (Y1) → ₹34.5 Cr (Y2) → ₹111 Cr (Y3)**

---

## 🗺️ Roadmap

- [x] AI Scam Handoff (Honeypot Engine)
- [x] UPI Armor
- [x] Bharat USSD Layer (`*1930#`)
- [x] Agency Dashboard (live monitor + FIR generator)
- [x] Recovery Companion
- [ ] Deepfake Video Call Detector *(India's first — roadmap)*
- [ ] Scammer Reverse Profiling + Interpol I-24/7 feed
- [ ] Mule Recruitment Interceptor (Naukri + LinkedIn scan)
- [ ] National Command Dashboard (773 districts)
- [ ] Global Fraud Intelligence Marketplace

---

## 👥 Team

**ThassaAI** — Threat Analysis & Security Surveillance Application - AI
**Institution:** IIIT-Delhi
**Track:** Cyber Security | Smart India Hackathon 2025
**Team Size:** 50 developers

---

## ⚖️ Legal & Compliance

- **DPDP Act 2023** — Full data minimisation, consent framework, federated learning
- **IT Act 2000 (Section 69)** — Lawful interception with MHA oversight
- **Indian Evidence Act (Section 65B)** — All AI transcripts court-admissible
- **TRAI UCC Regulations** — DLT-compliant telecom integrations
- **No raw voice stored centrally** — Federated learning on edge devices only

---

*Built by Indians. For India. For all 150 crore of us.* 🇮🇳
