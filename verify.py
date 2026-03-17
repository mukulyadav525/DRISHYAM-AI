"""
╔══════════════════════════════════════════════════════════════════════════════════╗
║   SENTINEL 1930 — BASIG COMPLETE TEST SUITE v3.0                              ║
║   Bharat Anti-Scam Intelligence Grid                                           ║
║                                                                                ║
║   41 Testable Units across 15 Modules                                         ║
║   ─────────────────────────────────────────────────────────────────────────── ║
║   MODULE  1 — Real-Time Telecom Detection Grid          [4 units]             ║
║   MODULE  2 — Agentic AI Honeypot Engine                [5 units]             ║
║   MODULE  3 — Fraud Intelligence Graph Engine           [5 units]             ║
║   MODULE  4 — UPI & WhatsApp Scam Shield                [5 units]             ║
║   MODULE  5 — Bharat Feature Phone Layer                [4 units]             ║
║   MODULE  6 — National Command Intelligence Dashboard   [4 units]             ║
║   MODULE  7 — Citizen Early Warning & Alert Engine      [5 units]             ║
║   MODULE  8 — Population Segment Protection (9 Guards)  [9 units]             ║
║   MODULE  9 — Privacy-First AI Layer                    [3 units]             ║
║   MODULE 10 — Operations Command Centre                 [3 units]             ║
║   MODULE 11 — Scammer Reverse Profiling Engine          [4 units]             ║
║   MODULE 12 — Deepfake Video Call Defense               [5 units]             ║
║   MODULE 13 — AI Scam Inoculation & Simulation          [5 units]             ║
║   MODULE 14 — Mule Recruitment Interceptor              [5 units]             ║
║   MODULE 15 — Post-Scam Recovery Companion              [6 units]             ║
║                                                          ──────────           ║
║                                                   TOTAL  72 units             ║
║   (41 distinct scenarios + 31 supporting assertion units)                     ║
╚══════════════════════════════════════════════════════════════════════════════════╝

Usage:
    python test_sentinel_1930_full.py              # run all 41 scenarios
    python test_sentinel_1930_full.py --module 2   # run only Module 2 tests
    python test_sentinel_1930_full.py --dry-run    # validate structure only (no HTTP)
"""

import sys
import uuid
import time
import json
import argparse
from datetime import datetime
from typing import Optional, Tuple, Any

# ── optional requests import ──────────────────────────────────────────────────
try:
    import requests as _requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────────────────────
BASE_URL  = "http://localhost:8000/api/v1"
HEADERS   = {"Content-Type": "application/json", "X-Sentinel-Key": "test-key-1930"}
T_DEFAULT = 12   # default request timeout (seconds)
T_AGENT   = 90   # AI honeypot / long-inference timeout
T_FIR     = 65   # FIR generation SLA ceiling

# ─────────────────────────────────────────────────────────────────────────────
#  TERMINAL COLOURS
# ─────────────────────────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"
B = "\033[94m"; C = "\033[96m"; W = "\033[97m"
BOLD = "\033[1m"; DIM = "\033[2m"; RESET = "\033[0m"
BAR = "─" * 80


# ─────────────────────────────────────────────────────────────────────────────
#  LOGGING HELPERS
# ─────────────────────────────────────────────────────────────────────────────
_pass = _fail = _skip = 0

def hdr(module_no: int, title: str) -> None:
    print(f"\n{BOLD}{B}{BAR}{RESET}")
    print(f"{BOLD}{C}  MODULE {module_no:02d} — {title}{RESET}")
    print(f"{BOLD}{B}{BAR}{RESET}")

def unit(label: str) -> None:
    print(f"\n{Y}  ▶ {label}{RESET}")

def ok(msg: str) -> None:
    global _pass; _pass += 1
    print(f"    {G}✔  {msg}{RESET}")

def fail(msg: str) -> None:
    global _fail; _fail += 1
    print(f"    {R}✘  {msg}{RESET}")

def skip(msg: str) -> None:
    global _skip; _skip += 1
    print(f"    {DIM}⊘  {msg}{RESET}")

def info(msg: str) -> None:
    print(f"    {C}ℹ  {msg}{RESET}")


# ─────────────────────────────────────────────────────────────────────────────
#  HTTP HELPERS
# ─────────────────────────────────────────────────────────────────────────────
_DRY_RUN = False   # set by CLI --dry-run


def _post(endpoint: str, body: dict, timeout: int = T_DEFAULT) -> Optional[dict]:
    if _DRY_RUN:
        skip(f"DRY-RUN  POST {endpoint}")
        return None
    if not HAS_REQUESTS:
        skip("requests not installed — pip install requests")
        return None
    url = f"{BASE_URL}{endpoint}"
    try:
        r = _requests.post(url, json=body, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except _requests.exceptions.ConnectionError:
        fail(f"Connection refused → {url}  (server not running?)")
    except _requests.exceptions.Timeout:
        fail(f"Timeout after {timeout}s → {url}")
    except _requests.exceptions.HTTPError:
        fail(f"HTTP {r.status_code} → {url} | {r.text[:120]}")
    except Exception as exc:
        fail(f"Unexpected: {exc}")
    return None


def _get(endpoint: str, params: dict = None, timeout: int = T_DEFAULT) -> Optional[dict]:
    if _DRY_RUN:
        skip(f"DRY-RUN   GET {endpoint}")
        return None
    if not HAS_REQUESTS:
        skip("requests not installed")
        return None
    url = f"{BASE_URL}{endpoint}"
    try:
        r = _requests.get(url, params=params, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except _requests.exceptions.ConnectionError:
        fail(f"Connection refused → {url}")
    except Exception as exc:
        fail(f"Unexpected: {exc}")
    return None


def _assert(res: Optional[dict], field: str, expected: Any = None) -> bool:
    """Assert field exists in res; optionally assert its value."""
    if res is None:
        skip(f"No response — cannot assert '{field}'")
        return False
    if field not in res:
        fail(f"Missing field: '{field}'")
        return False
    val = res[field]
    if expected is not None and val != expected:
        fail(f"'{field}' expected={expected!r}  got={val!r}")
        return False
    ok(f"'{field}' = {val!r}")
    return True


def _assert_positive(res: Optional[dict], field: str) -> bool:
    """Assert field is numeric and > 0."""
    if res is None:
        skip(f"No response for '{field}'")
        return False
    val = res.get(field)
    if val is None:
        fail(f"Missing field: '{field}'")
        return False
    if not isinstance(val, (int, float)) or val <= 0:
        fail(f"'{field}' should be > 0, got {val!r}")
        return False
    ok(f"'{field}' = {val}  (> 0 ✔)")
    return True


# ─────────────────────────────────────────────────────────────────────────────
#  SHARED STATE  (populated as scenarios run; consumed by later ones)
# ─────────────────────────────────────────────────────────────────────────────
STATE: dict = {
    "incident_id"       : None,
    "session_id"        : None,
    "transcript_id"     : None,
    "scammer_profile_id": None,
    "fir_packet_id"     : None,
    "scammer_number"    : "+919876543210",
    "victim_number"     : "+918888888888",
    "senior_number"     : "+918877665544",
}


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 1  —  REAL-TIME TELECOM DETECTION GRID
# ══════════════════════════════════════════════════════════════════════════════

def test_m1_u1_fri_scoring() -> None:
    """M1-U1  Fraud Risk Index scored at network layer before call reaches citizen."""
    unit("M1-U1  Fraud Risk Index (FRI) — inbound call scoring")
    body = {
        "caller"                 : STATE["scammer_number"],
        "callee"                 : STATE["victim_number"],
        "sim_age_days"           : 3,
        "call_velocity_per_hour" : 450,
        "cli_spoofed"            : True,
        "bulk_dialling_pattern"  : True,
        "network"                : "AIRTEL",
    }
    res = _post("/telecom/call/score", body)
    _assert(res, "fri_score")
    _assert(res, "action")           # ROUTE_TO_HONEYPOT | WARN_CITIZEN | PASS
    _assert(res, "number_reputation_cluster")
    if res:
        fri = res.get("fri_score", 0)
        info(f"FRI = {fri}  →  {'Auto-route Honeypot' if fri > 85 else 'Citizen Warning'}")
        if fri > 85:
            STATE["session_id"] = STATE["session_id"] or str(uuid.uuid4())


def test_m1_u2_sim_swap_detection() -> None:
    """M1-U2  SIM Swap anomaly detected within 10 seconds of swap attempt."""
    unit("M1-U2  SIM Swap Fraud Detection")
    body = {
        "msisdn"            : STATE["victim_number"],
        "old_sim_iccid"     : "8991101200003204510F",
        "new_sim_iccid"     : "8991101200007654321X",
        "operator"          : "JIO",
        "swap_timestamp_utc": datetime.utcnow().isoformat(),
    }
    res = _post("/telecom/sim-swap/detect", body)
    _assert(res, "is_anomalous")
    _assert(res, "alert_latency_ms")     # must be < 10 000
    _assert(res, "freeze_requested")
    if res:
        latency = res.get("alert_latency_ms", 99999)
        (ok if latency < 10_000 else fail)(f"Alert latency {latency}ms (SLA = 10 000ms)")


def test_m1_u3_scam_weather_forecast() -> None:
    """M1-U3  48-hour predictive scam spike model (Scam Weather Forecast)."""
    unit("M1-U3  Scam Weather Forecast — 48-hour predictive model")
    body = {
        "forecast_window_hours": 48,
        "state"                : "MH",
        "context_signals"      : ["FESTIVAL_GANESH_CHATURTHI", "SALARY_CREDIT_DATE"],
    }
    res = _post("/intelligence/forecast/scam-weather", body)
    _assert(res, "high_risk_scam_types")    # e.g. ["KYC_SCAM", "INVESTMENT_SCAM"]
    _assert(res, "predicted_spike_percent")
    _assert(res, "affected_districts")
    _assert(res, "recommended_preemptive_alerts")


def test_m1_u4_cell_broadcast_tower_mesh() -> None:
    """M1-U4  Cell Broadcast Tower Mesh — emergency SMS to all SIMs in surge zone."""
    unit("M1-U4  Cell Broadcast Tower Mesh Alert (no app, no internet)")
    body = {
        "district"       : "GURUGRAM",
        "state"          : "HR",
        "radius_km"      : 2,
        "scam_type"      : "DIGITAL_ARREST",
        "message_hindi"  : "सावधान! आपके क्षेत्र में डिजिटल अरेस्ट घोटाला सक्रिय है।",
        "message_english": "ALERT: Digital arrest scam active in your area. Do NOT comply.",
        "dot_authorised" : True,
    }
    res = _post("/telecom/cell-broadcast/send", body)
    _assert(res, "broadcast_id")
    _assert(res, "towers_activated")
    _assert(res, "estimated_sims_reached")
    _assert(res, "dot_log_ref")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 2  —  AGENTIC AI HONEYPOT ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def test_m2_u1_honeypot_session() -> None:
    """M2-U1  AI Honeypot session start, turn-by-turn conversation, intelligence pull."""
    unit("M2-U1  AI Honeypot Session — full conversation lifecycle")
    sid = str(uuid.uuid4())
    STATE["session_id"] = sid

    # Start
    body = {
        "session_id"    : sid,
        "scammer_number": STATE["scammer_number"],
        "trigger"       : "CITIZEN_HANDOFF",
        "persona"       : "ELDERLY_UNCLE",
        "language"      : "hi",
        "scam_type_hint": "KYC_BANK_IMPERSONATION",
    }
    res = _post("/honeypot/session/start", body, timeout=T_AGENT)
    _assert(res, "session_id")
    _assert(res, "persona_active")
    _assert(res, "sip_transfer_complete")
    _assert(res, "scammer_notified", False)

    # Turn 1 — scammer urgency push
    turn_body = {
        "session_id": sid,
        "speaker"   : "SCAMMER",
        "text"      : "Aapka KYC expire ho gaya hai. Abhi verify karein warna account band.",
        "turn"      : 1,
    }
    res_turn = _post("/honeypot/turn", turn_body, timeout=T_AGENT)
    _assert(res_turn, "ai_response")
    _assert(res_turn, "psychological_exploitation_index")
    _assert(res_turn, "entities_extracted")
    if res_turn:
        info(f"AI reply: \"{str(res_turn.get('ai_response',''))[:80]}...\"")

    # End session
    res_end = _post("/honeypot/session/end",
                    {"session_id": sid, "reason": "SCAMMER_HUNG_UP"},
                    timeout=T_AGENT)
    _assert(res_end, "transcript_id")
    _assert(res_end, "scammer_profile_id")
    _assert(res_end, "fir_packet_ready")
    if res_end:
        STATE["transcript_id"]      = res_end.get("transcript_id")
        STATE["scammer_profile_id"] = res_end.get("scammer_profile_id")


def test_m2_u2_confession_trap() -> None:
    """M2-U2  Confession Trap Mode — AI leads scammer to verbal fraud admission."""
    unit("M2-U2  Confession Trap (court-admissible under Evidence Act §65B)")
    body = {
        "session_id"    : STATE["session_id"] or str(uuid.uuid4()),
        "trap_mode"     : "VERBAL_ADMISSION",
        "scam_type"     : "KYC_BANK_IMPERSONATION",
        "current_turn"  : 4,
        "scammer_text"  : "Bas Rs.499 bhejiye aur aapka account save ho jayega. Main bank officer hoon.",
    }
    res = _post("/honeypot/confession-trap/trigger", body, timeout=T_AGENT)
    _assert(res, "trap_activated")
    _assert(res, "ai_response_trap_variant")
    _assert(res, "admission_probability_score")  # 0.0–1.0
    _assert(res, "evidence_quality_rating")       # WEAK / MODERATE / STRONG
    if res:
        info(f"Admission probability: {res.get('admission_probability_score', 0):.0%}")


def test_m2_u3_whatsapp_honeypot() -> None:
    """M2-U3  WhatsApp Honeypot Persona — multi-day investment scam engagement."""
    unit("M2-U3  WhatsApp Honeypot Persona (multi-day dossier building)")
    body = {
        "persona"            : "ELDERLY_WHATSAPP_USER",
        "scammer_wa_number"  : "+917700001111",
        "scam_type"          : "FAKE_INVESTMENT_TRADING",
        "initial_message"    : "Namaste! Mujhe aapke trading scheme mein interest hai.",
        "session_duration_h" : 72,    # simulate multi-day
        "language"           : "hi",
    }
    res = _post("/honeypot/whatsapp/session/start", body, timeout=T_AGENT)
    _assert(res, "wa_session_id")
    _assert(res, "fake_account_created")
    _assert(res, "first_message_sent")
    _assert(res, "dossier_id")


def test_m2_u4_scammer_fatigue_index() -> None:
    """M2-U4  Scammer Fatigue Index — economic damage metric for fraud networks."""
    unit("M2-U4  Scammer Fatigue Index — network throughput damage")
    sid = STATE["session_id"] or "SID-DUMMY"
    res = _get(f"/honeypot/session/{sid}/fatigue")
    _assert(res, "minutes_engaged")
    _assert(res, "estimated_calls_prevented")
    _assert(res, "economic_damage_to_network_inr")
    _assert(res, "session_status")
    if res:
        dmg = res.get("economic_damage_to_network_inr", 0)
        info(f"Estimated network damage: ₹{dmg:,}")


def test_m2_u5_adversarial_persona_switching() -> None:
    """M2-U5  Adversarial resilience — auto-switch persona when scammer tests AI."""
    unit("M2-U5  Adversarial Persona Switching (scammer testing detection)")
    body = {
        "session_id"       : STATE["session_id"] or str(uuid.uuid4()),
        "scammer_utterance": "Are you a robot? Say something a human would say.",
        "current_persona"  : "ELDERLY_UNCLE",
        "turn"             : 7,
    }
    res = _post("/honeypot/persona/switch-adversarial", body, timeout=T_AGENT)
    _assert(res, "persona_switched")
    _assert(res, "new_persona")
    _assert(res, "detection_risk_score_before")
    _assert(res, "detection_risk_score_after")
    if res:
        info(f"Switched to persona: {res.get('new_persona')}")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 3  —  FRAUD INTELLIGENCE GRAPH ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def test_m3_u1_graph_ner_extraction() -> None:
    """M3-U1  Live NER entity extraction from conversation transcript."""
    unit("M3-U1  Graph NER — UPI IDs, accounts, phone numbers, Telegram handles")
    body = {
        "transcript_id" : STATE["transcript_id"] or "TX-DUMMY-001",
        "raw_transcript": (
            "Send ₹499 to UPI electricity.department@paytm. "
            "My account is 32180011223344 at SBI IFSC SBIN0001234. "
            "Contact on Telegram @fraud_boss99. WhatsApp this link: http://bit.ly/fake"
        ),
        "language"      : "hi",
    }
    res = _post("/intelligence/graph/extract-entities", body)
    _assert(res, "upi_ids")
    _assert(res, "bank_accounts")
    _assert(res, "phone_numbers")
    _assert(res, "telegram_handles")
    _assert(res, "urls")
    _assert(res, "graph_nodes_created")


def test_m3_u2_voice_fingerprint_clustering() -> None:
    """M3-U2  Voice fingerprint — 'same voice, 17 numbers' = call centre pod."""
    unit("M3-U2  Voice Fingerprint Clustering — pod identification")
    body = {
        "voice_embedding_b64" : "BASE64_VOICE_EMBEDDING_VECTOR",
        "session_id"          : STATE["session_id"] or "SID-DUMMY",
        "check_existing_pods" : True,
    }
    res = _post("/intelligence/voice/cluster", body)
    _assert(res, "pod_id")
    _assert(res, "numbers_in_pod")
    _assert(res, "confidence_score")
    _assert(res, "new_pod_created")
    if res:
        info(f"Pod {res.get('pod_id')} — {res.get('numbers_in_pod', 0)} numbers linked")


def test_m3_u3_fir_packet_generator() -> None:
    """M3-U3  One-click FIR packet — court-ready dossier in under 60 seconds."""
    unit("M3-U3  FIR Packet Generator (SLA = 60s, Evidence Act §65B compliant)")
    t0 = time.time()
    iid = "INC-" + str(uuid.uuid4())[:8].upper()
    STATE["incident_id"] = iid
    body = {
        "incident_id"        : iid,
        "transcript_id"      : STATE["transcript_id"]      or "TX-DUMMY",
        "scammer_profile_id" : STATE["scammer_profile_id"] or "PROF-DUMMY",
        "scam_category"      : "KYC_BANK_IMPERSONATION",
        "victim_number"      : STATE["victim_number"],
        "jurisdiction_state" : "UP",
        "include_graph_snapshot" : True,
    }
    res = _post("/intelligence/fir/generate", body, timeout=T_FIR)
    elapsed = time.time() - t0
    _assert(res, "fir_packet_id")
    _assert(res, "evidence_act_65b_compliant")
    _assert(res, "entities_included")
    _assert(res, "graph_cluster_snapshot")
    _assert(res, "download_url")
    if res:
        (ok if elapsed < 60 else fail)(f"Generated in {elapsed:.1f}s (SLA = 60s)")
        STATE["fir_packet_id"] = res.get("fir_packet_id")


def test_m3_u4_cross_border_mapping() -> None:
    """M3-U4  Cross-border network mapping — India ↔ Myanmar/Cambodia/Pakistan hubs."""
    unit("M3-U4  Cross-Border Fraud Network Mapping")
    body = {
        "cluster_id"     : "CLUSTER-DIGITAL-ARREST-UP-42",
        "known_countries": ["IN", "MM", "KH"],   # India, Myanmar, Cambodia
        "depth"          : 3,
    }
    res = _post("/intelligence/graph/cross-border-map", body)
    _assert(res, "foreign_nodes_found")
    _assert(res, "country_links")
    _assert(res, "interpol_referral_ready")
    _assert(res, "hub_confidence_scores")


def test_m3_u5_script_evolution_tracker() -> None:
    """M3-U5  Scam script mutation detection — auto-retrains NER within 6 hours."""
    unit("M3-U5  Scam Script Evolution Tracker (auto-retrain < 6h)")
    body = {
        "new_script_sample"  : "Aapki bijli department ki taraf se notice aaya hai. Turant ₹299 bharein.",
        "known_script_hashes": ["SHA256_OF_KNOWN_SCRIPT_1", "SHA256_OF_KNOWN_SCRIPT_2"],
        "scam_type"          : "ELECTRICITY_UTILITY",
    }
    res = _post("/intelligence/script/mutation-detect", body)
    _assert(res, "is_mutation")
    _assert(res, "similarity_to_parent")
    _assert(res, "retrain_triggered")
    _assert(res, "estimated_retrain_complete_utc")
    if res and res.get("retrain_triggered"):
        ok("NER retrain pipeline triggered (SLA = 6 hours)")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 4  —  UPI & WHATSAPP SCAM SHIELD
# ══════════════════════════════════════════════════════════════════════════════

def test_m4_u1_upi_mule_detection() -> None:
    """M4-U1  NPCI API — flag mule UPI before transaction is approved."""
    unit("M4-U1  UPI Mule Detection (pre-transaction flag via NPCI API)")
    body = {
        "vpa"     : "electricity.department@paytm",
        "amount"  : 499,
        "purpose" : "kyc_verification",
        "payer"   : STATE["victim_number"],
    }
    res = _post("/upi/verify", body)
    _assert(res, "is_flagged")
    _assert(res, "risk_level")      # HIGH / MEDIUM / LOW
    _assert(res, "reason")
    _assert(res, "npci_block_ref")
    if res and res.get("is_flagged"):
        ok("Transaction blocked before money leaves victim's account.")


def test_m4_u2_fake_qr_detection() -> None:
    """M4-U2  AI image analysis on QR codes shared during calls."""
    unit("M4-U2  Fake QR Code Detection")
    body = {
        "image_b64"    : "BASE64_QR_CODE_IMAGE",
        "source"       : "WHATSAPP_MESSAGE",
        "sender_number": STATE["scammer_number"],
    }
    res = _post("/upi/qr/verify", body)
    _assert(res, "is_fake_qr")
    _assert(res, "decoded_vpa")
    _assert(res, "vpa_risk_score")
    _assert(res, "recommended_action")


def test_m4_u3_whatsapp_business_impersonation() -> None:
    """M4-U3  Detect fake HDFC/SBI/IRCTC/Amazon WhatsApp Business accounts."""
    unit("M4-U3  WhatsApp Business Impersonation Detection")
    body = {
        "wa_business_name"   : "HDFC Bank Customer Care",
        "wa_number"          : "+9100001234567",
        "message_content"    : "Your account is at risk. Click to verify: http://bit.ly/hdfc-kyc-fake",
        "verified_badge"     : False,
        "sender_country_code": "IN",
    }
    res = _post("/whatsapp/impersonation/check", body)
    _assert(res, "is_impersonator")
    _assert(res, "legitimate_brand")
    _assert(res, "confidence")
    _assert(res, "meta_report_submitted")


def test_m4_u4_fake_payment_screenshot() -> None:
    """M4-U4  Validate whether 'payment proof' screenshot is genuine."""
    unit("M4-U4  Fake Payment Screenshot Detector")
    body = {
        "screenshot_b64": "BASE64_SCREENSHOT_IMAGE",
        "claimed_amount": 5000,
        "claimed_utr"   : "UTR123456789012",
        "claimed_bank"  : "SBI",
    }
    res = _post("/upi/screenshot/verify", body)
    _assert(res, "is_genuine")
    _assert(res, "utr_verified")
    _assert(res, "tampering_detected")
    _assert(res, "analysis_details")


def test_m4_u5_collect_request_interceptor() -> None:
    """M4-U5  Block citizen approval of fraudulent UPI collect requests."""
    unit("M4-U5  Collect Request Fraud Interceptor")
    body = {
        "collect_request_id": "COL-" + str(uuid.uuid4())[:8],
        "requestor_vpa"     : "govt.refund@ybl",
        "amount"            : 1,
        "note"              : "Refund processing fee",
        "recipient_number"  : STATE["victim_number"],
    }
    res = _post("/upi/collect/intercept", body)
    _assert(res, "is_fraudulent_collect")
    _assert(res, "risk_indicators")
    _assert(res, "block_recommended")
    _assert(res, "citizen_alert_sent")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 5  —  BHARAT FEATURE PHONE LAYER
# ══════════════════════════════════════════════════════════════════════════════

def test_m5_u1_ussd_reporting() -> None:
    """M5-U1  *1930# USSD scam report — any phone, any network, 2G, zero internet."""
    unit("M5-U1  USSD *1930# Report (feature phone, zero internet)")
    body = {
        "ussd_string": "*1930*1*919876543210#",
        "msisdn"     : STATE["victim_number"],
        "network"    : "BSNL",
        "2g_only"    : True,
    }
    res = _post("/telecom/ussd/menu", body)
    _assert(res, "incident_id")
    _assert(res, "ussd_response")
    _assert(res, "lang_detected")
    _assert(res, "acknowledgement_sms_queued")
    if res:
        STATE["incident_id"] = res.get("incident_id") or STATE["incident_id"]
        ok(f"Incident created: {STATE['incident_id']}")


def test_m5_u2_ivr_helpline() -> None:
    """M5-U2  IVR helpline — guided reporting in all 22 Indian languages."""
    unit("M5-U2  IVR Helpline — 22 Indian language voice reporting")
    for lang_code, lang_name in [("hi", "Hindi"), ("ta", "Tamil"), ("bn", "Bengali")]:
        body = {
            "caller_number": STATE["victim_number"],
            "language_code": lang_code,
            "menu_option"  : "REPORT_SCAM",
            "scammer_number_spoken": STATE["scammer_number"],
        }
        res = _post("/telecom/ivr/handle", body)
        _assert(res, "session_id")
        _assert(res, "language_confirmed")
        _assert(res, "transcript_started")
        if res:
            info(f"IVR session in {lang_name}: confirmed={res.get('language_confirmed')}")


def test_m5_u3_sarpanch_network() -> None:
    """M5-U3  Sarpanch WhatsApp Network — 2.5L Sarpanchs receive scam intel."""
    unit("M5-U3  Sarpanch WhatsApp Network Broadcast")
    body = {
        "district"       : "MATHURA",
        "state"          : "UP",
        "scam_type"      : "PM_KISAN_IMPERSONATION",
        "alert_hindi"    : "सावधान! पीएम किसान के नाम पर ठगी हो रही है। OTP किसी को न दें।",
        "sarpanch_count" : 847,
        "source"         : "SENTINEL_INTELLIGENCE",
    }
    res = _post("/notifications/sarpanch-network/broadcast", body)
    _assert(res, "broadcast_id")
    _assert(res, "sarpanchs_reached")
    _assert(res, "delivery_rate_percent")
    _assert(res, "gram_panchayat_pa_triggered")


def test_m5_u4_cell_broadcast_bharat() -> None:
    """M5-U4  Cell Broadcast via BharatNet — no app, no literacy, every SIM in range."""
    unit("M5-U4  BharatNet-Priority Cell Broadcast — rural surge zone alert")
    body = {
        "taluk"          : "BALLIA",
        "state"          : "UP",
        "scam_type"      : "FAKE_SUBSIDY",
        "message_regional": "ध्यान दें! फर्जी सब्सिडी कॉल आ रहे हैं। बैंक OTP न दें।",
        "priority"       : "HIGH",
        "bharatnet_route": True,
    }
    res = _post("/telecom/cell-broadcast/bharatnet", body)
    _assert(res, "broadcast_id")
    _assert(res, "towers_activated")
    _assert(res, "estimated_reach")
    _assert(res, "no_internet_required", True)


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 6  —  NATIONAL COMMAND INTELLIGENCE DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

def test_m6_u1_command_dashboard_heatmap() -> None:
    """M6-U1  Real-time fraud heatmap across all 773 districts."""
    unit("M6-U1  National Command Dashboard — district-level heatmap")
    res = _get("/dashboard/heatmap", params={"state": "ALL", "interval": "1h"})
    _assert(res, "districts_active")
    _assert(res, "hotspot_districts")
    _assert(res, "fri_max_district")
    _assert(res, "rupees_saved_today")
    _assert(res, "active_honeypot_sessions")


def test_m6_u2_warroom_trigger() -> None:
    """M6-U2  War Room Mode — FRI spike triggers 10x SMS, Kubernetes scale, DD1."""
    unit("M6-U2  War Room Trigger (FRI spike > 200% OR ₹50Cr mule movement)")
    body = {
        "trigger_type"        : "FRI_SPIKE",
        "fri_spike_percent"   : 250,
        "district"            : "NOIDA",
        "state"               : "UP",
        "scam_type"           : "DIGITAL_ARREST",
        "calls_last_2_hours"  : 847,
        "mule_movement_inr"   : 6_00_00_000,  # ₹6 Crore
    }
    res = _post("/system/warroom/trigger", body)
    _assert(res, "warroom_active", True)
    _assert(res, "sms_capacity_scaled")
    _assert(res, "honeypot_instances_spawned")
    _assert(res, "cell_broadcast_activated")
    _assert(res, "dd1_ticker_triggered")
    _assert(res, "air_fm_blast_triggered")
    _assert(res, "mha_auto_fir_bulk_submitted")
    _assert(res, "gram_panchayat_pa_activated")


def test_m6_u3_roi_counter() -> None:
    """M6-U3  ROI Counter — live 'tax money saved this month' for govt dashboards."""
    unit("M6-U3  Government ROI Counter")
    res = _get("/dashboard/roi-counter", params={"period": "MONTH", "agency": "MHA"})
    _assert(res, "rupees_saved_this_month")
    _assert(res, "citizens_protected")
    _assert(res, "firs_generated")
    _assert(res, "mule_accounts_frozen")
    _assert(res, "embeddable_widget_url")
    if res:
        saved = res.get("rupees_saved_this_month", 0)
        info(f"₹{saved:,} saved this month (MHA dashboard counter)")


def test_m6_u4_scam_weather_panel() -> None:
    """M6-U4  Scam Weather Forecast Panel — 48h advance surge prediction for commanders."""
    unit("M6-U4  Scam Weather Panel — 48h advance alert for command staff")
    body = {
        "query_agency"  : "MHA",
        "state_focus"   : "MH",
        "window_hours"  : 48,
    }
    res = _post("/dashboard/scam-weather/panel", body)
    _assert(res, "forecast_summary")
    _assert(res, "high_risk_windows")
    _assert(res, "recommended_predeployment_actions")
    _assert(res, "daily_09_war_room_briefing_ready")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 7  —  CITIZEN EARLY WARNING & PUBLIC ALERT ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def test_m7_u1_citizen_push_alert() -> None:
    """M7-U1  Region-specific push alert — 'Electricity scam active in Pune'."""
    unit("M7-U1  Citizen Push Alert — region-specific, pre-scam warning")
    body = {
        "district"    : "PUNE",
        "state"       : "MH",
        "scam_type"   : "ELECTRICITY_UTILITY",
        "message_en"  : "ALERT: Electricity scam calls active in Pune. Do NOT share OTP.",
        "message_mr"  : "इशारा: पुण्यात वीज बिल घोटाळा सक्रिय आहे. OTP शेअर करू नका.",
        "channels"    : ["PUSH_NOTIFICATION", "SMS", "UMANG_APP"],
        "target_count": 50000,
    }
    res = _post("/notifications/citizen/push-alert", body)
    _assert(res, "alert_id")
    _assert(res, "citizens_notified")
    _assert(res, "channels_dispatched")
    _assert(res, "delivery_rate_percent")


def test_m7_u2_sentinel_score() -> None:
    """M7-U2  Sentinel Score — opt-in cyber safety rating (0–100), device-local privacy."""
    unit("M7-U2  Sentinel Score — personal cyber safety rating")
    body = {
        "citizen_id"        : "CITIZEN-ANON-" + str(uuid.uuid4())[:8],
        "drills_completed"  : 5,
        "near_miss_count"   : 1,
        "hygiene_behaviours": ["2FA_ENABLED", "DIGILOCKER_VERIFIED", "OTP_NEVER_SHARED"],
        "consent_given"     : True,
    }
    res = _post("/citizen/sentinel-score/compute", body)
    _assert(res, "score")           # 0–100
    _assert(res, "decile_band")     # 1–10 (only this shared with banks)
    _assert(res, "computed_locally", True)
    _assert(res, "central_storage", False)
    _assert(res, "badge")           # GOLD_SHIELD / SILVER / STANDARD
    if res:
        info(f"Sentinel Score: {res.get('score')}/100  Band: {res.get('decile_band')}")


def test_m7_u3_family_trust_circle() -> None:
    """M7-U3  Family Trust Circle — auto-alert spouse/child when elder gets scam call."""
    unit("M7-U3  Family Trust Circle Notification")
    body = {
        "elder_number"  : STATE["senior_number"],
        "circle_members": ["+919911223344", "+919922334455"],
        "trigger"       : "SCAM_CALL_DETECTED",
        "scam_type"     : "DIGITAL_ARREST",
        "fri_score"     : 93,
        "call_duration_s": 45,
    }
    res = _post("/notifications/family-trust-circle/alert", body)
    _assert(res, "members_notified")
    _assert(res, "notification_ids")
    _assert(res, "elder_call_intercepted")
    _assert(res, "ai_handoff_offered")


def test_m7_u4_scam_habit_breaker() -> None:
    """M7-U4  Scam Habit Breaker — 7-day Dhan Suraksha Challenge post near-miss."""
    unit("M7-U4  Scam Habit Breaker — gamified 7-day SMS series")
    body = {
        "citizen_number": STATE["victim_number"],
        "trigger"       : "NEAR_MISS",
        "scam_type"     : "KYC_BANK_IMPERSONATION",
        "language"      : "hi",
        "upi_reward_enabled": True,
        "reward_inr"    : 5,   # Rs.1–5 UPI reward per NPCI nudge programme
    }
    res = _post("/citizen/habit-breaker/enrol", body)
    _assert(res, "enrolment_id")
    _assert(res, "day1_message_scheduled")
    _assert(res, "gamification_score_initialised")
    _assert(res, "npci_reward_linked")


def test_m7_u5_hyper_local_alert() -> None:
    """M7-U5  Hyper-Local Alert — 'Scam active in Sector 14 Gurugram today'."""
    unit("M7-U5  Hyper-Local Scam Density Alert (neighbourhood level)")
    body = {
        "lat"         : 28.4595,
        "lng"         : 77.0266,
        "radius_m"    : 2000,
        "scam_type"   : "DIGITAL_ARREST",
        "incidents_24h": 3,
        "anonymised"  : True,   # never reveals victim identities
    }
    res = _post("/notifications/citizen/hyper-local-alert", body)
    _assert(res, "alert_id")
    _assert(res, "area_label")      # e.g. "Sector 14, Gurugram"
    _assert(res, "density_map_url")
    _assert(res, "incidents_anonymised", True)


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 8  —  POPULATION SEGMENT PROTECTION (9 Guards)
# ══════════════════════════════════════════════════════════════════════════════

def test_m8_u1_jan_dhan_guard() -> None:
    """M8-U1  Jan Dhan Guard — 50 Cr accounts protected from fake subsidy scams."""
    unit("M8-U1  Jan Dhan Guard — fake PM scheme call detection")
    body = {
        "account_number"  : "JDHAN-" + str(uuid.uuid4())[:8],
        "caller_number"   : STATE["scammer_number"],
        "claimed_scheme"  : "PM_AWAS_YOJANA",
        "message"         : "Aapko PM Awas Yojana ka 50,000 milega. OTP batayein.",
    }
    res = _post("/modules/jan-dhan-guard/verify", body)
    _assert(res, "is_fake_scheme_call")
    _assert(res, "legitimate_scheme_details")
    _assert(res, "bank_api_alert_sent")
    _assert(res, "citizen_warning_dispatched")


def test_m8_u2_kisan_guard() -> None:
    """M8-U2  Kisan Guard — PM-KISAN impersonation, fertiliser subsidy scams."""
    unit("M8-U2  Kisan Guard — 11 Cr farmers protected")
    body = {
        "farmer_number" : "+917654321098",
        "caller_number" : STATE["scammer_number"],
        "claimed_scheme": "PM_KISAN_SAMMAN_NIDHI",
        "demand"        : "OTP_FOR_REFUND_PROCESSING",
        "language"      : "bho",   # Bhojpuri
    }
    res = _post("/modules/kisan-guard/verify", body)
    _assert(res, "is_impersonation")
    _assert(res, "official_pm_kisan_helpline")
    _assert(res, "ivr_alert_triggered")
    _assert(res, "language_match")


def test_m8_u3_job_scam_interceptor() -> None:
    """M8-U3  Job Scam Interceptor — 45 Cr active job seekers protected."""
    unit("M8-U3  Job Scam Interceptor — fake offer classifier")
    body = {
        "job_offer_text": "Urgent hiring! Work from home data entry. ₹50,000/month. No experience. WhatsApp 9988776655.",
        "sender_number" : STATE["scammer_number"],
        "platform"      : "WHATSAPP",
    }
    res = _post("/modules/job-scam/classify", body)
    _assert(res, "is_fake_job")
    _assert(res, "confidence")
    _assert(res, "red_flags")
    _assert(res, "official_job_portal_redirect")


def test_m8_u4_education_scam_guard() -> None:
    """M8-U4  Education Scam Guard — fake scholarships, JEE coaching, MBBS seat fraud."""
    unit("M8-U4  Education Scam Guard — fake scholarship / admission")
    body = {
        "message"       : "Congratulations! You have qualified for a full scholarship at Manipal. Pay ₹5,000 seat deposit now.",
        "sender_number" : STATE["scammer_number"],
        "target_age"    : 18,
        "exam_season"   : "JEE_RESULT",
    }
    res = _post("/modules/education-guard/classify", body)
    _assert(res, "is_education_scam")
    _assert(res, "scam_type")
    _assert(res, "legitimate_institution_check")
    _assert(res, "parent_alert_sent")


def test_m8_u5_sme_gst_buster() -> None:
    """M8-U5  SME GST Buster — honeypot mimics GST-defaulter owner, extracts fake CA."""
    unit("M8-U5  SME GST Buster (Rs.2,499/yr B2B subscription)")
    body = {
        "business_gstin"  : "27AABCU9603R1ZX",
        "caller_number"   : STATE["scammer_number"],
        "claim"           : "Your GST filing is overdue. Pay ₹12,000 to avoid prosecution.",
        "honeypot_persona": "CONFUSED_SME_OWNER",
    }
    res = _post("/modules/sme-gst-buster/engage", body)
    _assert(res, "is_gst_scam")
    _assert(res, "fake_ca_details_extracted")
    _assert(res, "mca_blacklist_submission")
    _assert(res, "honeypot_session_id")


def test_m8_u6_women_safety_layer() -> None:
    """M8-U6  Women Safety Layer — gender-specific romance/loan/job scam patterns."""
    unit("M8-U6  Women Safety Layer — gender-pattern alert engine")
    body = {
        "caller_number"  : STATE["scammer_number"],
        "target_number"  : "+917788996655",
        "message_text"   : "Hi dear, I am an NRI businessman. Let me help you with an online job opportunity.",
        "gender_inferred": "FEMALE",
        "scam_type_hint" : "ROMANCE_JOB_HYBRID",
    }
    res = _post("/modules/women-safety/detect", body)
    _assert(res, "is_gendered_scam")
    _assert(res, "scam_pattern")
    _assert(res, "confidence")
    _assert(res, "ngo_resource_link")


def test_m8_u7_senior_citizen_shield() -> None:
    """M8-U7  Senior Citizen Shield — caregiver alert, one-button AI handoff."""
    unit("M8-U7  Senior Citizen Shield — simplified UI + caregiver notification")
    body = {
        "senior_number"    : STATE["senior_number"],
        "caller_number"    : STATE["scammer_number"],
        "call_duration_s"  : 120,
        "fri_score"        : 91,
        "caregiver_numbers": ["+919911223344"],
        "one_button_mode"  : True,
    }
    res = _post("/modules/senior-shield/activate", body)
    _assert(res, "ai_handoff_initiated")
    _assert(res, "caregiver_notified")
    _assert(res, "simplified_ui_pushed")
    _assert(res, "large_text_mode_enabled")


def test_m8_u8_college_cyber_patrol() -> None:
    """M8-U8  College Cyber Patrol — AICTE capstone + govt internship pipeline."""
    unit("M8-U8  College Cyber Patrol (AICTE / 10,000 colleges)")
    body = {
        "college_aicte_id"  : "AICTE-MH-2024-00123",
        "student_count"     : 120,
        "submission_type"   : "HONEYPOT_VARIANT",
        "project_title"     : "Marathi-Language Elderly Persona Honeypot for Courier Scams",
        "quality_score"     : 84,
    }
    res = _post("/modules/college-patrol/submit-capstone", body)
    _assert(res, "accepted")
    _assert(res, "internship_certificate_queued")
    _assert(res, "open_contribution_layer_merged")
    _assert(res, "hackathon_eligible")


def test_m8_u9_nri_diaspora_guard() -> None:
    """M8-U9  NRI / Diaspora Guard — 3.2 Cr NRIs vs 'family emergency' deepfakes."""
    unit("M8-U9  NRI / Diaspora Guard — international alert relay")
    body = {
        "nri_number"           : "+447700900123",
        "india_contact_number" : "+918888000111",
        "scam_type"            : "FAMILY_EMERGENCY_IMPERSONATION",
        "caller_number"        : STATE["scammer_number"],
        "call_country_origin"  : "IN",
        "target_country"       : "GB",
    }
    res = _post("/modules/nri-guard/alert", body)
    _assert(res, "is_family_emergency_scam")
    _assert(res, "alert_sent_to_nri")
    _assert(res, "india_contact_verified")
    _assert(res, "interpol_flag_if_cross_border")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 9  —  PRIVACY-FIRST AI LAYER (DPDP Act Compliant)
# ══════════════════════════════════════════════════════════════════════════════

def test_m9_u1_federated_learning() -> None:
    """M9-U1  Federated Honeypot Learning — edge training, no raw voice centralised."""
    unit("M9-U1  Federated Learning — differential privacy aggregation")
    body = {
        "edge_node_id"    : "JIO-EDGE-MH-042",
        "model_version"   : "honeypot-llm-v3.2",
        "gradient_hash"   : "SHA256_OF_GRADIENT_VECTOR",
        "samples_trained" : 1500,
        "raw_audio_uploaded": False,   # MUST be False
    }
    res = _post("/privacy/federated/submit-gradient", body)
    _assert(res, "gradient_accepted")
    _assert(res, "raw_audio_uploaded", False)
    _assert(res, "differential_privacy_applied")
    _assert(res, "global_model_updated")


def test_m9_u2_homomorphic_encryption() -> None:
    """M9-U2  Homomorphic encryption — police query fraud clusters without decrypting."""
    unit("M9-U2  Homomorphic Encryption Query (police query, transcript safe)")
    body = {
        "query_type"   : "COUNT_FRAUD_CLUSTER",
        "cluster_id"   : "CLUSTER-DIGITAL-ARREST-UP-42",
        "querying_agency": "UP_CYBER_CELL",
        "officer_token": "OFFICER-MFA-TOKEN-XYZ",
    }
    res = _post("/privacy/homomorphic/query", body)
    _assert(res, "result_encrypted")
    _assert(res, "raw_transcripts_accessed", False)
    _assert(res, "cluster_size_returned")
    _assert(res, "dpdp_audit_logged")
    if res:
        ok("Police received cluster stats — raw transcripts never decrypted.")


def test_m9_u3_pqc_encryption() -> None:
    """M9-U3  Post-Quantum Cryptography — Kyber-1024 + Dilithium-5, 2028-RBI-ahead."""
    unit("M9-U3  Post-Quantum Cryptography (Kyber-1024 / Dilithium-5)")
    body = {
        "packet_type"       : "INTELLIGENCE_PACKET",
        "payload_sample"    : "SAMPLE_TRANSCRIPT_EXTRACT",
        "requested_algo"    : "KYBER_1024",
        "signature_algo"    : "DILITHIUM_5",
    }
    res = _post("/security/pqc/encrypt-packet", body)
    _assert(res, "encrypted_payload")
    _assert(res, "algorithm_used", "KYBER_1024")
    _assert(res, "signature_algorithm", "DILITHIUM_5")
    _assert(res, "rbi_2028_compliant", True)


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 10  —  OPERATIONS COMMAND CENTRE & DISASTER RECOVERY
# ══════════════════════════════════════════════════════════════════════════════

def test_m10_u1_occ_operations() -> None:
    """M10-U1  OCC 24/7 operations — analyst queue, script retrain escalation."""
    unit("M10-U1  OCC Analyst Queue & Escalation (Delhi + Bengaluru)")
    body = {
        "escalation_type"    : "HONEYPOT_ENGAGEMENT_DROP",
        "engagement_rate_pct": 62,    # below 70% threshold
        "district"           : "LUCKNOW",
        "occ_site"           : "DELHI",
        "shift"              : "NIGHT",
    }
    res = _post("/occ/escalate", body)
    _assert(res, "ticket_id")
    _assert(res, "analyst_assigned")
    _assert(res, "script_retrain_triggered")
    _assert(res, "estimated_recovery_min")


def test_m10_u2_disaster_recovery() -> None:
    """M10-U2  Disaster Recovery — RPO=0, RTO=15min, 99.99% uptime SLA."""
    unit("M10-U2  Disaster Recovery Failover (RPO=0, RTO=15min)")
    body = {
        "simulated_failure" : "AWS_AP_SOUTH_1_OUTAGE",
        "failover_target"   : "NIC_CLOUD_DELHI",
    }
    res = _post("/system/dr/failover-test", body)
    _assert(res, "failover_initiated")
    _assert(res, "rto_minutes")
    _assert(res, "rpo_seconds", 0)
    _assert(res, "sla_99_99_maintained")
    if res:
        rto = res.get("rto_minutes", 999)
        (ok if rto <= 15 else fail)(f"RTO = {rto}min (SLA = 15min)")


def test_m10_u3_chaos_engineering() -> None:
    """M10-U3  Chaos Engineering — weekly Netflix Chaos Monkey simulations."""
    unit("M10-U3  Chaos Engineering Drill (Jio outage / Mumbai floods / Delhi power)")
    body = {
        "scenario"           : "JIO_NETWORK_OUTAGE",
        "duration_minutes"   : 30,
        "kill_percentage"    : 40,
        "components_targeted": ["HONEYPOT_PODS", "SMS_GATEWAY", "KAFKA_BROKER_1"],
    }
    res = _post("/system/chaos/run-drill", body)
    _assert(res, "drill_id")
    _assert(res, "services_degraded")
    _assert(res, "auto_failover_triggered")
    _assert(res, "data_loss_detected", False)
    _assert(res, "war_room_alerted")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 11  —  SCAMMER REVERSE PROFILING ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def test_m11_u1_voice_stress_analysis() -> None:
    """M11-U1  Voice Stress Analysis — nervousness, script fatigue, shift changes."""
    unit("M11-U1  Voice Stress Analysis (OpenSMILE + LSTM)")
    body = {
        "session_id"       : STATE["session_id"] or "SID-DUMMY",
        "audio_chunk_b64"  : "BASE64_AUDIO_CHUNK",
        "turn"             : 6,
        "check_shift_change": True,
    }
    res = _post("/profiling/voice-stress/analyse", body)
    _assert(res, "stress_score")          # 0–100
    _assert(res, "script_reading_fatigue")
    _assert(res, "shift_change_detected")
    _assert(res, "operator_consistency")  # SAME_OPERATOR | DIFFERENT_OPERATOR
    if res and res.get("shift_change_detected"):
        ok("Shift change detected — pod-change alert raised in fraud graph.")


def test_m11_u2_scammer_career_graph() -> None:
    """M11-U2  Scammer Career Graph — tracks operator across months, multiple SIMs."""
    unit("M11-U2  Scammer Career Graph Tracking (promotion mapping)")
    body = {
        "voice_fingerprint_id": "VFP-" + str(uuid.uuid4())[:8],
        "current_session_id"  : STATE["session_id"] or "SID-DUMMY",
        "linked_numbers"      : [STATE["scammer_number"], "+919876543211"],
        "date_range_months"   : 6,
    }
    res = _post("/profiling/career-graph/build", body)
    _assert(res, "profile_id")
    _assert(res, "career_timeline")
    _assert(res, "hierarchy_level")    # FOOT_SOLDIER | TEAM_LEAD | MASTERMIND
    _assert(res, "promotion_detected")
    _assert(res, "total_attempts_estimated")
    if res:
        STATE["scammer_profile_id"] = res.get("profile_id") or STATE["scammer_profile_id"]
        info(f"Career graph: {res.get('hierarchy_level')} — {res.get('total_attempts_estimated')} attempts")


def test_m11_u3_interpol_feed() -> None:
    """M11-U3  Interpol I-24/7 — high-confidence profiles for cross-border prosecution."""
    unit("M11-U3  Interpol I-24/7 Feed (prosecution readiness score ≥ 80)")
    body = {
        "scammer_profile_id"   : STATE["scammer_profile_id"] or "PROF-DUMMY",
        "prosecution_readiness": 88,
        "linked_countries"     : ["IN", "MM", "KH"],
        "economic_damage_inr"  : 4_50_000,
        "hierarchy_level"      : "TEAM_LEAD",
        "submit_to_interpol"   : True,
    }
    res = _post("/intelligence/interpol/submit", body)
    _assert(res, "interpol_case_id")
    _assert(res, "cross_border_links_found")
    _assert(res, "submitted_at")
    _assert(res, "i24_7_ack")
    if res:
        ok(f"Interpol case: {res.get('interpol_case_id')}")


def test_m11_u4_prosecution_readiness() -> None:
    """M11-U4  Prosecution Readiness Score — tells investigators which cases are court-ready."""
    unit("M11-U4  Prosecution Readiness Score per scammer profile")
    body = {
        "scammer_profile_id": STATE["scammer_profile_id"] or "PROF-DUMMY",
    }
    res = _post("/profiling/prosecution/score", body)
    _assert(res, "readiness_score")      # 0–100
    _assert(res, "court_ready")          # bool: score >= 80
    _assert(res, "gaps")                 # what evidence is still missing
    _assert(res, "economic_damage_inr")
    _assert(res, "sentencing_recommendation")
    if res:
        score = res.get("readiness_score", 0)
        (ok if score >= 80 else info)(f"Prosecution readiness: {score}/100 ({'Court-ready' if score >= 80 else 'Needs more evidence'})")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 12  —  DEEPFAKE VIDEO CALL DEFENSE
# ══════════════════════════════════════════════════════════════════════════════

def test_m12_u1_deepfake_video_detection() -> None:
    """M12-U1  Real-time liveness + GAN fingerprint detection on video frame."""
    unit("M12-U1  Deepfake Video Detection (EfficientNet + Temporal Attention)")
    body = {
        "call_type"         : "WHATSAPP_VIDEO",
        "caller_number"     : STATE["scammer_number"],
        "recipient_number"  : STATE["senior_number"],
        "claimed_identity"  : "CBI_OFFICER",
        "video_frame_b64"   : "BASE64_VIDEO_FRAME",
        "audio_sample_b64"  : "BASE64_AUDIO_SAMPLE",
    }
    res = _post("/ai/deepfake/video/detect", body)
    _assert(res, "verdict")              # REAL | SUSPECT | DEEPFAKE
    _assert(res, "confidence")
    _assert(res, "liveness_score")
    _assert(res, "gan_fingerprint_detected")
    _assert(res, "detected_tool")        # StableDiffusion | FaceSwap | etc.
    if res:
        info(f"Verdict: {res.get('verdict')} ({res.get('confidence', 0):.0%} confidence)")


def test_m12_u2_audio_visual_sync() -> None:
    """M12-U2  Audio-Visual lip-sync desync detection in under 100ms."""
    unit("M12-U2  Audio-Visual Sync Analysis (lip-sync < 100ms)")
    t0 = time.time()
    body = {
        "session_id"     : STATE["session_id"] or "SID-DUMMY",
        "video_chunk_b64": "BASE64_VIDEO_CHUNK",
        "audio_chunk_b64": "BASE64_AUDIO_CHUNK",
    }
    res = _post("/ai/deepfake/lipsync/check", body)
    elapsed_ms = (time.time() - t0) * 1000
    _assert(res, "is_desynchronised")
    _assert(res, "offset_ms")
    _assert(res, "confidence")
    if res:
        (ok if elapsed_ms < 100 else fail)(f"Lip-sync latency: {elapsed_ms:.0f}ms (SLA = 100ms)")


def test_m12_u3_uniform_badge_check() -> None:
    """M12-U3  Uniform & Badge Detection — fake CBI/police insignia flagging."""
    unit("M12-U3  Uniform & Badge Authentication (CBI / State Police patterns)")
    body = {
        "video_frame_b64" : "BASE64_VIDEO_FRAME_WITH_UNIFORM",
        "claimed_force"   : "CBI",
        "claimed_rank"    : "DSP",
    }
    res = _post("/ai/deepfake/uniform/verify", body)
    _assert(res, "uniform_match")
    _assert(res, "badge_authentic")
    _assert(res, "inconsistencies")    # list of detected issues
    _assert(res, "background_authentic")
    if res and not res.get("badge_authentic"):
        ok("Fake badge/uniform detected — alert triggered.")


def test_m12_u4_family_trust_deepfake_alert() -> None:
    """M12-U4  Deepfake family-member impersonation → alert real family instantly."""
    unit("M12-U4  Family Trust Circle — deepfake family member impersonation alert")
    body = {
        "victim_number"    : STATE["senior_number"],
        "claimed_identity" : "FAMILY_MEMBER",
        "deepfake_verdict" : "DEEPFAKE",
        "confidence"       : 0.94,
        "trust_circle"     : ["+919911223344", "+919922334455"],
    }
    res = _post("/notifications/family-trust-circle/alert", body)
    _assert(res, "members_notified")
    _assert(res, "notification_ids")
    _assert(res, "real_family_member_contacted")
    _assert(res, "call_blocked")


def test_m12_u5_deepfake_evidence_package() -> None:
    """M12-U5  Package deepfake frames as IT Act §65B court-admissible evidence."""
    unit("M12-U5  Deepfake Evidence Packaging (IT Act §65B)")
    body = {
        "session_id"    : STATE["session_id"] or "SID-DUMMY",
        "frames_b64"    : ["FRAME1_B64", "FRAME2_B64", "FRAME3_B64"],
        "evidence_format": "IT_ACT_65B",
        "hash_algorithm" : "SHA256",
    }
    res = _post("/intelligence/evidence/package-video", body)
    _assert(res, "evidence_package_id")
    _assert(res, "sha256_hash")
    _assert(res, "court_admissible", True)
    _assert(res, "immutable_log_ref")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 13  —  AI SCAM INOCULATION & SIMULATION ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def test_m13_u1_monthly_inoculation_drills() -> None:
    """M13-U1  Monthly scam drills via SMS/App — gamified, personalised feedback."""
    unit("M13-U1  Monthly Inoculation Drill — gamified citizen pre-exposure")
    body = {
        "citizen_number": STATE["victim_number"],
        "drill_type"    : "KYC_SCAM_SIMULATION",
        "language"      : "hi",
        "channel"       : "SMS",
        "clearly_labelled_as_drill": True,
    }
    res = _post("/inoculation/drill/send", body)
    _assert(res, "drill_id")
    _assert(res, "message_sent")
    _assert(res, "clearly_labelled_as_drill", True)
    _assert(res, "response_tracking_active")


def test_m13_u2_personalised_vulnerability() -> None:
    """M13-U2  Personalised Vulnerability Assessment — tailor drills by risk profile."""
    unit("M13-U2  Personalised Vulnerability Assessment")
    body = {
        "age"              : 68,
        "district"         : "PATNA",
        "state"            : "BR",
        "device_type"      : "FEATURE_PHONE",
        "language"         : "bho",
        "past_near_misses" : 2,
    }
    res = _post("/inoculation/vulnerability/assess", body)
    _assert(res, "top_scam_risks")        # ordered list
    _assert(res, "recommended_drills")
    _assert(res, "drill_format")          # VOICE_IVR for feature phone
    _assert(res, "personalisation_score")


def test_m13_u3_corporate_b2b_shield() -> None:
    """M13-U3  Sentinel Workplace Shield — Rs.49/employee/month, HR dashboard."""
    unit("M13-U3  Corporate B2B — Sentinel Workplace Shield")
    body = {
        "company_gstin"    : "29AABCT1332L1ZS",
        "employee_count"   : 500,
        "plan"             : "MONTHLY",
        "price_per_employee": 49,
        "hr_dashboard"     : True,
    }
    res = _post("/inoculation/corporate/enrol", body)
    _assert(res, "subscription_id")
    _assert(res, "hr_dashboard_url")
    _assert(res, "team_vulnerability_score_enabled")
    _assert(res, "first_drill_scheduled")
    if res:
        info(f"Corporate subscription: {res.get('subscription_id')} — {body['employee_count']} employees")


def test_m13_u4_nep_school_curriculum() -> None:
    """M13-U4  NEP 2020 DIKSHA school curriculum — Class 8–10, 25 Cr students."""
    unit("M13-U4  NEP / DIKSHA School Curriculum Integration (25 Cr students)")
    body = {
        "diksha_course_id"   : "SENTINEL-CYBER-SAFETY-2024",
        "class_levels"       : ["8", "9", "10"],
        "states_active"      : ["UP", "MH", "TN", "WB", "KA"],
        "languages_available": ["hi", "en", "ta", "bn", "kn"],
        "student_count_crore": 25,
    }
    res = _post("/inoculation/diksha/publish-course", body)
    _assert(res, "course_published")
    _assert(res, "diksha_course_url")
    _assert(res, "states_onboarded")
    _assert(res, "completion_certificate_enabled")


def test_m13_u5_post_incident_inoculation() -> None:
    """M13-U5  Post-incident inoculation — 7-day intensive series after near-miss."""
    unit("M13-U5  Post-Incident Inoculation Series (tailored to exact scam type)")
    body = {
        "citizen_number"   : STATE["victim_number"],
        "incident_id"      : STATE["incident_id"] or "INC-DUMMY",
        "scam_type"        : "KYC_BANK_IMPERSONATION",
        "near_miss_severity": "HIGH",
        "language"         : "hi",
        "duration_days"    : 7,
    }
    res = _post("/inoculation/post-incident/enrol", body)
    _assert(res, "series_id")
    _assert(res, "day1_drill_scheduled")
    _assert(res, "tailored_to_scam_type", True)
    _assert(res, "counselling_referral_offered")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 14  —  MULE RECRUITMENT INTERCEPTOR
# ══════════════════════════════════════════════════════════════════════════════

def test_m14_u1_mule_ad_classifier() -> None:
    """M14-U1  Job portal ML scan — mule ad precision > 92% per testing."""
    unit("M14-U1  Mule Ad Classifier (Naukri / LinkedIn / Telegram)")
    body = {
        "source"     : "NAUKRI",
        "job_title"  : "Work From Home — Simple Data Entry",
        "description": (
            "Easy WFH. Share your bank account to receive client payments. "
            "Earn ₹5,000/day. Just forward OTPs. WhatsApp: 9876500000."
        ),
        "posted_by"  : "Quick Jobs Pvt Ltd",
        "city"       : "NOIDA",
        "job_ad_url" : "https://naukri.com/job-123456",
    }
    res = _post("/mule/ad/classify", body)
    _assert(res, "is_mule_ad")
    _assert(res, "confidence")
    _assert(res, "red_flags")
    _assert(res, "portal_removal_requested")
    _assert(res, "fake_employer_db_updated")
    if res:
        info(f"Mule ad: {res.get('confidence', 0):.0%} — flags: {res.get('red_flags', [])}")


def test_m14_u2_jobseeker_realtime_alert() -> None:
    """M14-U2  Pop-up warning to job seeker before they apply to mule ad."""
    unit("M14-U2  Job Seeker Real-Time Alert (browser extension + portal API)")
    body = {
        "job_seeker_number": "+917766554433",
        "ad_url"           : "https://naukri.com/job-123456",
        "alert_channel"    : "APP_POPUP",
        "language"         : "hi",
    }
    res = _post("/notifications/jobseeker/mule-warning", body)
    _assert(res, "notification_sent", True)
    _assert(res, "message_preview")
    _assert(res, "safe_job_portal_redirect")
    _assert(res, "nalsa_legal_info_attached")


def test_m14_u3_telegram_channel_infiltration() -> None:
    """M14-U3  AI honeypot joins mule recruitment Telegram channel, extracts details."""
    unit("M14-U3  Telegram Channel Infiltration (AI honeypot as 'potential mule')")
    body = {
        "telegram_channel" : "t.me/easyworkfromhome2024",
        "honeypot_persona" : "DESPERATE_JOB_SEEKER",
        "language"         : "hi",
        "infiltration_mode": "PASSIVE_OBSERVATION",
        "dot_authorised"   : True,    # public channel only; lawful interception MoU
    }
    res = _post("/mule/telegram/infiltrate", body)
    _assert(res, "infiltration_session_id")
    _assert(res, "recruiter_details_extracted")
    _assert(res, "scripts_captured")
    _assert(res, "payment_flows_mapped")
    _assert(res, "meta_report_queued")


def test_m14_u4_recruiter_prosecution_dossier() -> None:
    """M14-U4  Evidence dossier packaged for mule recruiter arrest (easiest in chain)."""
    unit("M14-U4  Recruiter Prosecution Dossier (police prioritisation package)")
    body = {
        "recruiter_number"  : "9876500000",
        "employer_entity"   : "Quick Jobs Pvt Ltd",
        "channels_used"     : ["NAUKRI", "WHATSAPP", "TELEGRAM"],
        "mule_accounts_linked": 14,
        "incident_ids"      : [STATE["incident_id"] or "INC-DUMMY"],
    }
    res = _post("/mule/recruiter/prosecution-dossier", body)
    _assert(res, "dossier_id")
    _assert(res, "evidence_strength")     # WEAK / MODERATE / STRONG
    _assert(res, "fir_auto_packet_ready")
    _assert(res, "police_dispatch_recommended")
    _assert(res, "mca_deregistration_requested")


def test_m14_u5_npci_preactivation_alert() -> None:
    """M14-U5  NPCI pre-activation alert before first fraudulent mule transaction."""
    unit("M14-U5  NPCI Pre-Activation Alert (catch mule before first transaction)")
    body = {
        "account_no"        : "XXXXXXXX4567",
        "bank_code"         : "PNB",
        "activation_pattern": "MULE_RECRUITMENT_CONFIRMED",
        "linked_recruiter"  : "9876500000",
        "alert_npci"        : True,
        "enhanced_monitoring": True,
    }
    res = _post("/notifications/npci/pre-activation-alert", body)
    _assert(res, "npci_alert_id")
    _assert(res, "bank_notified", True)
    _assert(res, "monitoring_enhanced", True)
    _assert(res, "freeze_triggered_if_first_txn_suspicious")


# ══════════════════════════════════════════════════════════════════════════════
#  MODULE 15  —  POST-SCAM RECOVERY COMPANION
# ══════════════════════════════════════════════════════════════════════════════

def test_m15_u1_bank_dispute_letter() -> None:
    """M15-U1  One-click legally formatted bank dispute letters, all 22 languages."""
    unit("M15-U1  Automated Bank Dispute Letter Generator")
    body = {
        "incident_id"     : STATE["incident_id"] or "INC-DUMMY",
        "victim_number"   : STATE["victim_number"],
        "bank_code"       : "SBI",
        "transaction_ref" : "UTR123456789012",
        "amount_lost_inr" : 14900,
        "language"        : "hi",
        "evidence_refs"   : [STATE["transcript_id"] or "TX-DUMMY"],
    }
    res = _post("/recovery/bank-dispute/generate", body)
    _assert(res, "letter_id")
    _assert(res, "letter_url")
    _assert(res, "legally_formatted", True)
    _assert(res, "pre_filled_with_evidence", True)
    _assert(res, "language")


def test_m15_u2_rbi_ombudsman_generator() -> None:
    """M15-U2  Auto-populate RBI Banking Ombudsman complaint with evidence."""
    unit("M15-U2  RBI Ombudsman Complaint Auto-Generator")
    body = {
        "incident_id"    : STATE["incident_id"] or "INC-DUMMY",
        "victim_number"  : STATE["victim_number"],
        "bank_code"      : "SBI",
        "dispute_ref"    : "DISPUTE-SBI-2024-001",
        "escalation_reason": "BANK_DID_NOT_RESPOND_IN_30_DAYS",
    }
    res = _post("/recovery/rbi-ombudsman/generate", body)
    _assert(res, "complaint_id")
    _assert(res, "ombudsman_portal_url")
    _assert(res, "evidence_attached")
    _assert(res, "submission_status")


def test_m15_u3_case_status_tracker() -> None:
    """M15-U3  Single-view dashboard tracking case across police, bank, RBI, court."""
    unit("M15-U3  Case Status Tracker — unified multi-agency view")
    res = _get("/recovery/case/status",
               params={"incident_id": STATE["incident_id"] or "INC-DUMMY"})
    _assert(res, "police_fir_status")
    _assert(res, "bank_dispute_status")
    _assert(res, "rbi_ombudsman_status")
    _assert(res, "consumer_court_status")
    _assert(res, "last_updated_utc")
    _assert(res, "next_action_required")


def test_m15_u4_nalsa_bridge() -> None:
    """M15-U4  NALSA Bridge — free legal aid for income-eligible victims."""
    unit("M15-U4  NALSA Legal Aid Bridge (income < ₹1L/yr eligibility check)")
    body = {
        "victim_number"      : STATE["victim_number"],
        "annual_income_inr"  : 85_000,    # below ₹1L threshold
        "state"              : "UP",
        "district"           : "LUCKNOW",
        "incident_id"        : STATE["incident_id"] or "INC-DUMMY",
    }
    res = _post("/recovery/nalsa/check-eligibility", body)
    _assert(res, "eligible_for_free_aid")
    _assert(res, "nearest_nalsa_centre")
    _assert(res, "referral_letter_generated")
    _assert(res, "appointment_booked")
    if res and res.get("eligible_for_free_aid"):
        ok("NALSA referral generated — victim connected to free legal aid.")


def test_m15_u5_mental_health_referral() -> None:
    """M15-U5  Mental health support — iCall (TISS) + Vandrevala Foundation referral."""
    unit("M15-U5  Mental Health Support Referral (financial fraud trauma)")
    body = {
        "victim_number"  : STATE["victim_number"],
        "incident_id"    : STATE["incident_id"] or "INC-DUMMY",
        "trauma_score"   : 74,       # from intake questionnaire
        "preferred_lang" : "hi",
        "consent_given"  : True,
    }
    res = _post("/recovery/mental-health/refer", body)
    _assert(res, "referral_id")
    _assert(res, "partner_org")       # iCALL_TISS | VANDREVALA_FOUNDATION
    _assert(res, "counsellor_assigned")
    _assert(res, "first_session_scheduled")
    _assert(res, "free_of_charge", True)
    if res:
        info(f"Referred to {res.get('partner_org')} — first session: {res.get('first_session_scheduled')}")


def test_m15_u6_insurance_claim_automation() -> None:
    """M15-U6  Insurance claim automation — auto-generates docs, submits on victim's behalf."""
    unit("M15-U6  Cyber Insurance Claim Automation")
    body = {
        "incident_id"     : STATE["incident_id"] or "INC-DUMMY",
        "victim_number"   : STATE["victim_number"],
        "insurer"         : "BAJAJ_ALLIANZ",
        "policy_number"   : "OG-24-1234-5678-00000123",
        "claim_type"      : "CYBER_FRAUD",
        "amount_claimed"  : 14900,
        "evidence_refs"   : [STATE["fir_packet_id"] or "FIR-DUMMY",
                              STATE["transcript_id"] or "TX-DUMMY"],
    }
    res = _post("/recovery/insurance/auto-claim", body)
    _assert(res, "claim_id")
    _assert(res, "documents_generated")
    _assert(res, "submitted_to_insurer")
    _assert(res, "status_tracking_active")
    _assert(res, "rs_recovered_counter_updated")
    if res:
        ok(f"Insurance claim submitted: {res.get('claim_id')}")


# ══════════════════════════════════════════════════════════════════════════════
#  POLICE & BANK NOTIFICATION PIPELINE  (cross-module integration)
# ══════════════════════════════════════════════════════════════════════════════

def test_integration_police_bank_pipeline() -> None:
    """INTEGRATION  Police + Bank notification pipeline end-to-end."""
    unit("INTEGRATION  Police dispatch + Bank freeze + NPCI notification")

    # 1. Police dispatch — UP Cyber Cell
    body = {
        "fir_packet_id"  : STATE["fir_packet_id"] or "FIR-DUMMY",
        "police_unit"    : "UP_CYBER_CELL",
        "priority"       : "HIGH",
        "notify_channels": ["DASHBOARD", "EMAIL", "WHATSAPP_OPS"],
        "duty_officer"   : "SI_SHARMA",
    }
    res_police = _post("/notifications/police/dispatch", body)
    _assert(res_police, "notification_id")
    _assert(res_police, "dashboard_updated", True)
    _assert(res_police, "officer_notified")

    # 2. Bank mule freeze — SBI
    body_freeze = {
        "incident_id"  : STATE["incident_id"] or "INC-DUMMY",
        "bank_code"    : "SBI",
        "account_no"   : "3218XXXXXXXX",
        "upi_vpa"      : "electricity.department@paytm",
        "freeze_reason": "MULE_ACCOUNT_HONEYPOT_CONFIRMED",
        "evidence_ref" : STATE["transcript_id"] or "TX-DUMMY",
        "priority"     : "CRITICAL",
    }
    res_freeze = _post("/notifications/bank/freeze-alert", body_freeze)
    _assert(res_freeze, "freeze_request_id")
    _assert(res_freeze, "bank_acknowledged")
    _assert(res_freeze, "npci_notified")
    if res_freeze:
        info(f"SBI freeze request: {res_freeze.get('freeze_request_id')}")

    # 3. Poll freeze status
    time.sleep(1)
    res_status = _get(f"/notifications/bank/freeze-status/{STATE['incident_id'] or 'INC-DUMMY'}")
    _assert(res_status, "total_inr_frozen")
    _assert(res_status, "rupees_saved_this_incident")


# ══════════════════════════════════════════════════════════════════════════════
#  MASTER RUNNER
# ══════════════════════════════════════════════════════════════════════════════

ALL_TESTS = [
    # Module 1
    ("M1-U1", "FRI Scoring",                     test_m1_u1_fri_scoring),
    ("M1-U2", "SIM Swap Detection",              test_m1_u2_sim_swap_detection),
    ("M1-U3", "Scam Weather Forecast",           test_m1_u3_scam_weather_forecast),
    ("M1-U4", "Cell Broadcast Tower Mesh",       test_m1_u4_cell_broadcast_tower_mesh),
    # Module 2
    ("M2-U1", "Honeypot Session Lifecycle",      test_m2_u1_honeypot_session),
    ("M2-U2", "Confession Trap Mode",            test_m2_u2_confession_trap),
    ("M2-U3", "WhatsApp Honeypot Persona",       test_m2_u3_whatsapp_honeypot),
    ("M2-U4", "Scammer Fatigue Index",           test_m2_u4_scammer_fatigue_index),
    ("M2-U5", "Adversarial Persona Switching",   test_m2_u5_adversarial_persona_switching),
    # Module 3
    ("M3-U1", "Graph NER Entity Extraction",     test_m3_u1_graph_ner_extraction),
    ("M3-U2", "Voice Fingerprint Clustering",    test_m3_u2_voice_fingerprint_clustering),
    ("M3-U3", "FIR Packet Generator",            test_m3_u3_fir_packet_generator),
    ("M3-U4", "Cross-Border Mapping",            test_m3_u4_cross_border_mapping),
    ("M3-U5", "Script Evolution Tracker",        test_m3_u5_script_evolution_tracker),
    # Module 4
    ("M4-U1", "UPI Mule Detection",              test_m4_u1_upi_mule_detection),
    ("M4-U2", "Fake QR Code Detection",          test_m4_u2_fake_qr_detection),
    ("M4-U3", "WhatsApp Business Impersonation", test_m4_u3_whatsapp_business_impersonation),
    ("M4-U4", "Fake Payment Screenshot",         test_m4_u4_fake_payment_screenshot),
    ("M4-U5", "Collect Request Interceptor",     test_m4_u5_collect_request_interceptor),
    # Module 5
    ("M5-U1", "USSD *1930# Reporting",           test_m5_u1_ussd_reporting),
    ("M5-U2", "IVR 22-Language Helpline",        test_m5_u2_ivr_helpline),
    ("M5-U3", "Sarpanch WhatsApp Network",       test_m5_u3_sarpanch_network),
    ("M5-U4", "BharatNet Cell Broadcast",        test_m5_u4_cell_broadcast_bharat),
    # Module 6
    ("M6-U1", "Command Dashboard Heatmap",       test_m6_u1_command_dashboard_heatmap),
    ("M6-U2", "War Room Mode Trigger",           test_m6_u2_warroom_trigger),
    ("M6-U3", "Government ROI Counter",          test_m6_u3_roi_counter),
    ("M6-U4", "Scam Weather Panel",              test_m6_u4_scam_weather_panel),
    # Module 7
    ("M7-U1", "Citizen Push Alert",              test_m7_u1_citizen_push_alert),
    ("M7-U2", "Sentinel Score",                  test_m7_u2_sentinel_score),
    ("M7-U3", "Family Trust Circle",             test_m7_u3_family_trust_circle),
    ("M7-U4", "Scam Habit Breaker",              test_m7_u4_scam_habit_breaker),
    ("M7-U5", "Hyper-Local Scam Alert",          test_m7_u5_hyper_local_alert),
    # Module 8 (9 Guards)
    ("M8-U1", "Jan Dhan Guard",                  test_m8_u1_jan_dhan_guard),
    ("M8-U2", "Kisan Guard",                     test_m8_u2_kisan_guard),
    ("M8-U3", "Job Scam Interceptor",            test_m8_u3_job_scam_interceptor),
    ("M8-U4", "Education Scam Guard",            test_m8_u4_education_scam_guard),
    ("M8-U5", "SME GST Buster",                  test_m8_u5_sme_gst_buster),
    ("M8-U6", "Women Safety Layer",              test_m8_u6_women_safety_layer),
    ("M8-U7", "Senior Citizen Shield",           test_m8_u7_senior_citizen_shield),
    ("M8-U8", "College Cyber Patrol (AICTE)",    test_m8_u8_college_cyber_patrol),
    ("M8-U9", "NRI / Diaspora Guard",            test_m8_u9_nri_diaspora_guard),
    # Module 9
    ("M9-U1", "Federated Learning",              test_m9_u1_federated_learning),
    ("M9-U2", "Homomorphic Encryption Query",    test_m9_u2_homomorphic_encryption),
    ("M9-U3", "Post-Quantum Cryptography",       test_m9_u3_pqc_encryption),
    # Module 10
    ("M10-U1","OCC 24/7 Operations",             test_m10_u1_occ_operations),
    ("M10-U2","Disaster Recovery Failover",      test_m10_u2_disaster_recovery),
    ("M10-U3","Chaos Engineering Drill",         test_m10_u3_chaos_engineering),
    # Module 11
    ("M11-U1","Voice Stress Analysis",           test_m11_u1_voice_stress_analysis),
    ("M11-U2","Scammer Career Graph",            test_m11_u2_scammer_career_graph),
    ("M11-U3","Interpol I-24/7 Feed",            test_m11_u3_interpol_feed),
    ("M11-U4","Prosecution Readiness Score",     test_m11_u4_prosecution_readiness),
    # Module 12
    ("M12-U1","Deepfake Video Detection",        test_m12_u1_deepfake_video_detection),
    ("M12-U2","Audio-Visual Sync Check",         test_m12_u2_audio_visual_sync),
    ("M12-U3","Uniform & Badge Check",           test_m12_u3_uniform_badge_check),
    ("M12-U4","Family Trust Deepfake Alert",     test_m12_u4_family_trust_deepfake_alert),
    ("M12-U5","Deepfake Evidence Package",       test_m12_u5_deepfake_evidence_package),
    # Module 13
    ("M13-U1","Monthly Inoculation Drills",      test_m13_u1_monthly_inoculation_drills),
    ("M13-U2","Personalised Vulnerability",      test_m13_u2_personalised_vulnerability),
    ("M13-U3","Corporate B2B Shield",            test_m13_u3_corporate_b2b_shield),
    ("M13-U4","NEP DIKSHA School Curriculum",    test_m13_u4_nep_school_curriculum),
    ("M13-U5","Post-Incident Inoculation",       test_m13_u5_post_incident_inoculation),
    # Module 14
    ("M14-U1","Mule Ad Classifier",              test_m14_u1_mule_ad_classifier),
    ("M14-U2","Job Seeker Real-Time Alert",      test_m14_u2_jobseeker_realtime_alert),
    ("M14-U3","Telegram Channel Infiltration",   test_m14_u3_telegram_channel_infiltration),
    ("M14-U4","Recruiter Prosecution Dossier",   test_m14_u4_recruiter_prosecution_dossier),
    ("M14-U5","NPCI Pre-Activation Alert",       test_m14_u5_npci_preactivation_alert),
    # Module 15
    ("M15-U1","Bank Dispute Letter",             test_m15_u1_bank_dispute_letter),
    ("M15-U2","RBI Ombudsman Generator",         test_m15_u2_rbi_ombudsman_generator),
    ("M15-U3","Case Status Tracker",             test_m15_u3_case_status_tracker),
    ("M15-U4","NALSA Bridge",                    test_m15_u4_nalsa_bridge),
    ("M15-U5","Mental Health Referral",          test_m15_u5_mental_health_referral),
    ("M15-U6","Insurance Claim Automation",      test_m15_u6_insurance_claim_automation),
    # Cross-module integration
    ("INT-01", "Police + Bank Notification Pipeline", test_integration_police_bank_pipeline),
]


def run(module_filter: Optional[int] = None, dry_run: bool = False) -> None:
    global _DRY_RUN
    _DRY_RUN = dry_run

    banner = f"""
{BOLD}{B}
╔══════════════════════════════════════════════════════════════════════════════════╗
║   SENTINEL 1930  —  BASIG COMPLETE TEST SUITE v3.0                            ║
║   {len(ALL_TESTS)} Test Units · 15 Modules · 4 Integrations                               ║
║   Mode: {'DRY-RUN (structure only)' if dry_run else 'LIVE (requires server at '+BASE_URL+')'}
╚══════════════════════════════════════════════════════════════════════════════════╝
{RESET}"""
    print(banner)
    print(f"  Started : {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    if module_filter:
        print(f"  Filter  : Module {module_filter} only")

    selected = []
    for code, label, fn in ALL_TESTS:
        if module_filter:
            # code format: M<num>-U<num> or INT-xx
            mod_num = code.split("-")[0].replace("M", "").replace("INT", "0")
            try:
                if int(mod_num) != module_filter:
                    continue
            except ValueError:
                pass
        selected.append((code, label, fn))

    for i, (code, label, fn) in enumerate(selected, 1):
        try:
            fn()
        except Exception as exc:
            fail(f"[UNCAUGHT EXCEPTION in {code}] {exc}")

    # ── SUMMARY ───────────────────────────────────────────────────────────────
    total = _pass + _fail + _skip
    print(f"""
{BOLD}{B}
{BAR}
  TEST SUMMARY
  ─────────────────────────────────────────
  Units run  : {len(selected)}
  Assertions : {total}
  {G}PASS  : {_pass}{RESET}{BOLD}{B}
  {R}FAIL  : {_fail}{RESET}{BOLD}{B}
  {DIM}SKIP  : {_skip}{RESET}{BOLD}{B}
  ─────────────────────────────────────────
  {'⊘  DRY-RUN — no HTTP calls made.' if dry_run else '✔  Live run against Sentinel server.'}
{BAR}
{RESET}""")
    if _fail > 0:
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sentinel 1930 Full Test Suite")
    parser.add_argument("--module",  type=int, default=None,
                        help="Run tests for a single module (1–15)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate structure only — no HTTP calls")
    parser.add_argument("--url",     type=str, default=BASE_URL,
                        help=f"Base URL for API (default: {BASE_URL})")
    args = parser.parse_args()
    BASE_URL = args.url
    run(module_filter=args.module, dry_run=args.dry_run)