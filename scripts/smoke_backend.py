#!/usr/bin/env python3

from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from core.auth import get_password_hash  # noqa: E402
from core.database import SessionLocal, engine, ensure_schema_compliance  # noqa: E402
from main import app  # noqa: E402
from models.database import Base, MuleAd, User, UserRole  # noqa: E402


def expect_status(name, response, status_code=200):
    if response.status_code != status_code:
        raise SystemExit(f"[FAIL] {name}: expected {status_code}, got {response.status_code}: {response.text}")
    return response.json()


def expect(condition, name, detail):
    if not condition:
        raise SystemExit(f"[FAIL] {name}: {detail}")


def prepare_runtime():
    Base.metadata.create_all(bind=engine)
    ensure_schema_compliance()

    db = SessionLocal()
    try:
        seed_users = [
            ("admin", "System Administrator", UserRole.ADMIN.value),
            ("bankops", "Bank Operations Lead", UserRole.BANK.value),
        ]
        created = False
        for username, full_name, role in seed_users:
            existing = db.query(User).filter(User.username == username).first()
            if existing:
                continue
            db.add(
                User(
                    username=username,
                    hashed_password=get_password_hash("password123"),
                    full_name=full_name,
                    role=role,
                    is_active=True,
                )
            )
            created = True
        if created:
            db.commit()

        if db.query(MuleAd).count() == 0:
            db.add(
                MuleAd(
                    title="Earn Rs. 50,000 by receiving and forwarding payments",
                    salary="₹50,000",
                    platform="Telegram",
                    risk_score=0.96,
                    status="Mule Campaign",
                    recruiter_id="SMOKE-OPS-01",
                )
            )
            db.commit()
    finally:
        db.close()


def main():
    prepare_runtime()
    client = TestClient(app)

    initial_login = expect_status(
        "initial login",
        client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "password123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ),
    )
    initial_verify = expect_status(
        "initial mfa verify",
        client.post(
            "/api/v1/auth/mfa/verify",
            json={"otp": "19301930"},
            headers={"Authorization": f"Bearer {initial_login['access_token']}"},
        ),
    )
    protected_headers = {"Authorization": f"Bearer {initial_verify['access_token']}"}

    consent_record = expect_status(
        "consent record",
        client.post(
            "/api/v1/privacy/consent/record",
            json={
                "phone_number": "9876500011",
                "scopes": {
                    "ai_handoff": True,
                    "transcript_analysis": True,
                    "evidence_packaging": True,
                    "alerting_recovery": True,
                },
                "channel": "SIMULATION_PORTAL",
                "locale": "en-IN",
            },
        ),
    )
    expect(consent_record.get("required_complete") is True, "consent record", "expected required consent completion")

    consent_lookup = expect_status(
        "consent lookup",
        client.get("/api/v1/privacy/consent/lookup?phone_number=9876500011"),
    )
    expect(consent_lookup.get("status") == "ACTIVE", "consent lookup", "expected active consent record")

    simulation_without_consent = client.post(
        "/api/v1/auth/simulation/request",
        json={"phone_number": "9876500099"},
    )
    expect(
        simulation_without_consent.status_code == 400,
        "simulation consent guard",
        "expected simulation request without consent to be blocked",
    )

    simulation_request = expect_status(
        "simulation request",
        client.post("/api/v1/auth/simulation/request", json={"phone_number": "9876500011"}),
    )
    expect(
        simulation_request.get("status") in {"pending", "approved"},
        "simulation request",
        "expected pending or previously approved simulation request",
    )

    telecom_sandbox = expect_status("telecom sandbox", client.get("/api/v1/telecom/sandbox/status"))
    expect(telecom_sandbox.get("configured") is True, "telecom sandbox", "expected telecom sandbox readiness")

    telecom_score = expect_status(
        "telecom call score",
        client.post(
            "/api/v1/telecom/call/score",
            json={
                "phone_number": "+919123456789",
                "sim_age_days": 2,
                "call_velocity_24h": 200,
                "cli_spoofed": True,
                "prior_complaints": 5,
            },
        ),
    )
    expect(0 <= telecom_score.get("fri_score", -1) <= 100, "telecom call score", "expected bounded FRI score")
    expect(telecom_score.get("action") == "ROUTE_TO_HONEYPOT", "telecom call score", "expected honeypot routing")

    detection_calls = expect_status("detection calls", client.get("/api/v1/detection/calls?limit=3"))
    expect(isinstance(detection_calls, list) and len(detection_calls) > 0, "detection calls", "expected at least one call row")
    expect("recommended_action" in detection_calls[0], "detection calls", "missing recommended action")

    telecom_ivr = expect_status("telecom ivr", client.post("/api/v1/telecom/ivr/handle", json={"language": "hi"}))
    expect(telecom_ivr.get("language_confirmed") is True, "telecom ivr", "expected confirmed IVR language")

    telecom_broadcast = expect_status(
        "telecom broadcast",
        client.post("/api/v1/telecom/cell-broadcast/send", json={"region": "delhi"}),
    )
    expect(telecom_broadcast.get("towers_activated", 0) > 0, "telecom broadcast", "expected towers to activate")

    personas = expect_status("voice personas", client.get("/api/v1/voice/personas"))
    persona_list = personas.get("personas", [])
    expect(len(persona_list) >= 3, "voice personas", "expected at least 3 personas")
    persona_languages = {persona.get("language") for persona in persona_list}
    expect({"hi-IN", "en-IN"}.issubset(persona_languages), "voice personas", "expected Hindi and English personas")

    honeypot_session = expect_status(
        "honeypot start",
        client.post(
            "/api/v1/honeypot/sessions",
            json={"caller_num": "+919876540000", "persona": "Elderly Uncle", "customer_id": "GRID_USER_01"},
        ),
    )
    expect(honeypot_session.get("sip_transfer_complete") is True, "honeypot start", "expected handoff-ready session")
    session_id = honeypot_session["session_id"]

    honeypot_handoff = expect_status(
        "honeypot handoff",
        client.post(f"/api/v1/honeypot/session/{session_id}/handoff", json={"persona": "Elderly Uncle"}),
    )
    expect(honeypot_handoff.get("status") == "active", "honeypot handoff", "expected active session")
    expect(
        honeypot_handoff.get("summary", {}).get("citizen_safe") is True,
        "honeypot handoff",
        "expected citizen safe banner state",
    )

    honeypot_turn = expect_status(
        "honeypot turn",
        client.post(
            "/api/v1/honeypot/direct-chat",
            json={
                "session_id": session_id,
                "persona": "Elderly Uncle",
                "message": "Sir your SBI KYC is blocked, share OTP and send money to testscammer@paytm",
            },
        ),
    )
    expect(bool(honeypot_turn.get("ai_response")), "honeypot turn", "expected AI response")

    honeypot_summary = expect_status("honeypot summary", client.get(f"/api/v1/honeypot/session/{session_id}/summary"))
    expect(len(honeypot_summary.get("transcript", [])) >= 2, "honeypot summary", "expected transcript entries")
    expect(
        honeypot_summary.get("live_summary", {}).get("entity_count", 0) >= 1,
        "honeypot summary",
        "expected extracted entities",
    )

    graph = expect_status("system graph", client.get("/api/v1/system/graph", headers=protected_headers))
    expect(len(graph.get("nodes", [])) > 0, "system graph", "expected graph nodes")

    graph_spotlight = expect_status(
        "graph spotlight",
        client.get("/api/v1/system/graph/spotlight?entity=%2B919876540000", headers=protected_headers),
    )
    expect("fir_preview" in graph_spotlight, "graph spotlight", "expected FIR preview payload")

    bharat_languages = expect_status("bharat languages", client.get("/api/v1/bharat/languages"))
    expect(len(bharat_languages.get("languages", [])) >= 8, "bharat languages", "expected at least 8 pilot languages")
    bharat_language_codes = {language.get("code") for language in bharat_languages.get("languages", [])}
    expect({"hi", "en"}.issubset(bharat_language_codes), "bharat languages", "expected Hindi and English support")

    bank_integration = expect_status("bank integration", client.get("/api/v1/upi/integration/status"))
    expect(bank_integration.get("configured") is True, "bank integration", "expected bank demo integration readiness")

    bharat_coverage = expect_status("bharat coverage", client.get("/api/v1/bharat/coverage"))
    expect("regional_queue" in bharat_coverage, "bharat coverage", "missing regional queue")

    hindi_sms = expect_status("bharat sms hindi", client.get("/api/v1/bharat/templates/sms?lang=hi&region=north"))
    english_sms = expect_status("bharat sms english", client.get("/api/v1/bharat/templates/sms?lang=en&region=north"))
    expect(hindi_sms.get("language") == "hi", "bharat sms hindi", "expected Hindi SMS template")
    expect(english_sms.get("language") == "en", "bharat sms english", "expected English SMS template")

    command_stats = expect_status("command stats", client.get("/api/v1/system/stats/command", headers=protected_headers))
    expect("rupees_saved" in command_stats, "command stats", "missing rupees saved")
    expect(len(command_stats.get("alerts", [])) > 0, "command stats", "expected command alerts")

    inoculation_stats = expect_status("inoculation stats", client.get("/api/v1/system/stats/inoculation"))
    expect("bank_kyc" in inoculation_stats.get("scenarios", {}), "inoculation stats", "missing bank_kyc scenario")

    scenarios = expect_status("inoculation scenarios", client.get("/api/v1/inoculation/scenarios"))
    expect(len(scenarios.get("scenarios", [])) > 0, "inoculation scenarios", "expected scenario library")

    mule_stats = expect_status("mule stats", client.get("/api/v1/system/stats/mule"))
    expect(len(mule_stats.get("ads", [])) > 0, "mule stats", "expected mule ads")
    expect(len(mule_stats.get("patterns", [])) > 0, "mule stats", "expected mule patterns")

    mule_classify = expect_status(
        "mule classify",
        client.post(
            "/api/v1/mule/ad/classify",
            json={"title": "Earn Rs. 50,000 by receiving and forwarding payments", "language": "en"},
        ),
    )
    expect(mule_classify.get("is_mule_ad") is True, "mule classify", "expected mule ad classification")

    deepfake_stats = expect_status("deepfake stats", client.get("/api/v1/system/stats/deepfake"))
    expect(len(deepfake_stats.get("incidents", [])) > 0, "deepfake stats", "expected deepfake incidents")

    drill = expect_status(
        "drill send",
        client.post("/api/v1/inoculation/drill/send", json={"phone": "+919999000111", "scenario": "job_scam"}),
    )
    expect(len(drill.get("steps", [])) > 0, "drill send", "expected drill steps")
    expect(drill.get("scorecard", {}).get("readiness_score") is not None, "drill send", "missing readiness score")

    login = expect_status(
        "login",
        client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "password123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ),
    )
    expect(login.get("mfa_required") is True, "login", "expected admin MFA requirement")

    audit_blocked = client.get(
        "/api/v1/security/audit/logs",
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )
    expect(audit_blocked.status_code == 403, "audit log guard", "expected unverified admin token to be blocked")

    verify = expect_status(
        "mfa verify",
        client.post(
            "/api/v1/auth/mfa/verify",
            json={"otp": "19301930"},
            headers={"Authorization": f"Bearer {login['access_token']}"},
        ),
    )
    expect(verify.get("mfa_verified") is True, "mfa verify", "expected verified MFA token")
    verified_token = verify["access_token"]

    session = expect_status(
        "session status",
        client.get("/api/v1/auth/session", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(session.get("mfa_verified") is True, "session status", "expected verified session")
    expect(bool(session.get("session_id")), "session status", "expected session id on verified token")

    simulation_requests = expect_status(
        "simulation requests",
        client.get("/api/v1/auth/simulation/list", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    citizen_request = next((item for item in simulation_requests if item.get("phone_number") == "9876500011"), None)
    expect(citizen_request is not None, "simulation requests", "expected citizen simulation request to exist")

    if citizen_request.get("status") != "approved":
        simulation_approval = expect_status(
            "simulation approval",
            client.post(
                f"/api/v1/auth/simulation/approve/{citizen_request['id']}?approve=true",
                headers={"Authorization": f"Bearer {verified_token}"},
            ),
        )
        expect("approved" in simulation_approval.get("message", ""), "simulation approval", "expected approval message")

    citizen_status = expect_status(
        "citizen simulation status",
        client.get("/api/v1/auth/simulation/status/9876500011"),
    )
    expect(citizen_status.get("status") == "approved", "citizen simulation status", "expected approved citizen session")
    expect(bool(citizen_status.get("access_token")), "citizen simulation status", "expected citizen access token")
    citizen_token = citizen_status["access_token"]

    citizen_home = expect_status(
        "citizen app home",
        client.get("/api/v1/citizen/app-home", headers={"Authorization": f"Bearer {citizen_token}"}),
    )
    expect(citizen_home.get("profile", {}).get("citizen_id", "").startswith("CIT-"), "citizen app home", "expected citizen id")
    expect(len(citizen_home.get("alerts", [])) >= 1, "citizen app home", "expected seeded alert feed")
    expect(citizen_home.get("score", {}).get("computed_locally") is True, "citizen app home", "expected local score state")

    citizen_preferences = expect_status(
        "citizen preferences",
        client.post(
            "/api/v1/citizen/preferences",
            json={
                "district": "Delhi NCR",
                "language": "hi",
                "senior_mode": True,
                "low_bandwidth": True,
                "segment": "senior",
                "onboarding_step": "alerts_ready",
            },
            headers={"Authorization": f"Bearer {citizen_token}"},
        ),
    )
    expect(citizen_preferences.get("senior_mode") is True, "citizen preferences", "expected senior mode enablement")
    expect(citizen_preferences.get("low_bandwidth") is True, "citizen preferences", "expected low-bandwidth enablement")

    citizen_trust_link = expect_status(
        "citizen trust circle create",
        client.post(
            "/api/v1/citizen/trust-circle",
            json={
                "guardian_name": "Asha Sharma",
                "guardian_phone": "9811100022",
                "relation_type": "Caregiver",
            },
            headers={"Authorization": f"Bearer {citizen_token}"},
        ),
    )
    expect(bool(citizen_trust_link.get("id")), "citizen trust circle create", "expected trust-circle record id")

    citizen_trust_circle = expect_status(
        "citizen trust circle list",
        client.get("/api/v1/citizen/trust-circle", headers={"Authorization": f"Bearer {citizen_token}"}),
    )
    expect(
        len(citizen_trust_circle.get("trust_circle", [])) >= 1,
        "citizen trust circle list",
        "expected trust-circle entries",
    )

    citizen_trust_notify = expect_status(
        "citizen trust circle notify",
        client.post(
            "/api/v1/citizen/trust-circle/notify",
            json={"trust_link_id": citizen_trust_link["id"]},
            headers={"Authorization": f"Bearer {citizen_token}"},
        ),
    )
    expect(citizen_trust_notify.get("status") == "DELIVERED", "citizen trust circle notify", "expected caregiver alert")

    first_alert = citizen_home.get("alerts", [{}])[0].get("id")
    if first_alert:
        citizen_alert_ack = expect_status(
            "citizen alert acknowledge",
            client.post(
                f"/api/v1/citizen/alerts/{first_alert}/acknowledge",
                headers={"Authorization": f"Bearer {citizen_token}"},
            ),
        )
        expect(citizen_alert_ack.get("acknowledged") is True, "citizen alert acknowledge", "expected alert acknowledgement")

    citizen_score = expect_status(
        "citizen score compute",
        client.post(
            "/api/v1/citizen/drishyam-score/compute",
            json={
                "suspicious_links_avoided": 5,
                "drills_completed": 1,
                "alerts_acknowledged": 1,
                "trust_circle_contacts": 1,
                "recovery_preparedness": 65,
            },
            headers={"Authorization": f"Bearer {citizen_token}"},
        ),
    )
    expect(citizen_score.get("computed_locally") is True, "citizen score compute", "expected local score computation")
    expect(citizen_score.get("score", 0) >= 60, "citizen score compute", "expected practical readiness score")

    citizen_habit = expect_status(
        "citizen habit enrol",
        client.post(
            "/api/v1/citizen/habit-breaker/enrol",
            json={"channel": "simulation"},
            headers={"Authorization": f"Bearer {citizen_token}"},
        ),
    )
    expect(citizen_habit.get("enrolled") is True, "citizen habit enrol", "expected enrolled habit breaker")

    citizen_habit_status = expect_status(
        "citizen habit status",
        client.get("/api/v1/citizen/habit-breaker/status", headers={"Authorization": f"Bearer {citizen_token}"}),
    )
    expect(citizen_habit_status.get("reward_points", 0) >= 25, "citizen habit status", "expected habit points")

    citizen_recovery_bundle = expect_status(
        "citizen recovery bundle",
        client.post(
            "/api/v1/actions/perform",
            json={"action_type": "GENERATE_RECOVERY_BUNDLE"},
            headers={"Authorization": f"Bearer {citizen_token}"},
        ),
    )
    bundle_id = citizen_recovery_bundle.get("detail", {}).get("bundle_id")
    expect(bool(bundle_id), "citizen recovery bundle", "expected generated recovery incident id")

    citizen_recovery = expect_status(
        "citizen recovery companion",
        client.get("/api/v1/citizen/recovery-companion", headers={"Authorization": f"Bearer {citizen_token}"}),
    )
    expect(citizen_recovery.get("latest_case_id") == bundle_id, "citizen recovery companion", "expected latest bundle tracking")

    citizen_case_status = expect_status(
        "citizen case status",
        client.get(f"/api/v1/recovery/case/status?incident_id={bundle_id}"),
    )
    expect(
        citizen_case_status.get("bank_dispute_status") == "INVESTIGATING",
        "citizen case status",
        "expected active recovery investigation",
    )

    citizen_drill_send = expect_status(
        "citizen drill send",
        client.post("/api/v1/inoculation/drill/send", json={"phone": "9876500011", "scenario": "bank_kyc"}),
    )
    expect(citizen_drill_send.get("message_sent") is True, "citizen drill send", "expected citizen drill dispatch")

    citizen_drill_center = expect_status(
        "citizen drill center",
        client.get("/api/v1/citizen/drill-center", headers={"Authorization": f"Bearer {citizen_token}"}),
    )
    expect(len(citizen_drill_center.get("recent", [])) >= 1, "citizen drill center", "expected recent drill history")
    expect(len(citizen_drill_center.get("scenarios", [])) >= 3, "citizen drill center", "expected scenario menu")

    citizen_home_refreshed = expect_status(
        "citizen app home refreshed",
        client.get("/api/v1/citizen/app-home", headers={"Authorization": f"Bearer {citizen_token}"}),
    )
    expect(
        citizen_home_refreshed.get("recovery", {}).get("latest_case_id") == bundle_id,
        "citizen app home refreshed",
        "expected recovery summary on refreshed citizen home",
    )
    expect(
        citizen_home_refreshed.get("analytics", {}).get("sessions_opened", 0) >= 2,
        "citizen app home refreshed",
        "expected citizen analytics instrumentation",
    )

    audit_logs = expect_status(
        "audit logs",
        client.get("/api/v1/security/audit/logs?limit=10", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(len(audit_logs) > 0, "audit logs", "expected audit log entries")

    security_center = expect_status(
        "security control center",
        client.get("/api/v1/security/control-center", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(
        security_center.get("access", {}).get("summary", {}).get("policies", 0) >= 6,
        "security control center",
        "expected agency access policies",
    )

    agency_sessions = expect_status(
        "agency sessions",
        client.get("/api/v1/security/sessions", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(agency_sessions.get("summary", {}).get("active", 0) >= 1, "agency sessions", "expected active sessions")

    abac_eval = expect_status(
        "abac evaluate",
        client.post(
            "/api/v1/security/agency-access/evaluate",
            json={
                "action": "WRITE",
                "resource": "partner_registry",
                "segment": "B2G",
                "region": "INDIA",
                "sensitivity": "HIGH",
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(abac_eval.get("allowed") is True, "abac evaluate", "expected admin policy allow decision")

    consent_summary = expect_status(
        "consent summary",
        client.get("/api/v1/privacy/consent/summary?limit=5", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(consent_summary.get("totals", {}).get("active", 0) >= 1, "consent summary", "expected active consent totals")

    pilot_program = expect_status(
        "pilot program update",
        client.post(
            "/api/v1/pilot/program/active",
            json={
                "name": "North Grid Pilot",
                "geography": "Delhi NCR + Mewat",
                "telecom_partner": "Airtel Sandbox",
                "bank_partners": ["SBI", "HDFC Bank"],
                "agencies": ["Delhi Police Cyber Cell", "1930 National Helpline"],
                "languages": ["Hindi", "English"],
                "scam_categories": ["KYC Fraud", "UPI Collect Scam"],
                "dashboard_scope": {"pilot_only": True},
                "success_metrics": {"prevented_loss_target_inr": 2500000},
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(pilot_program.get("geography") == "Delhi NCR + Mewat", "pilot program update", "expected pilot geography")

    pilot_training = expect_status(
        "pilot training",
        client.post(
            "/api/v1/pilot/training/update",
            json={"stakeholder_type": "analysts", "completed": 12, "target": 12},
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(
        pilot_training.get("training_status", {}).get("analysts", {}).get("completed") == 12,
        "pilot training",
        "expected analyst training completion",
    )

    pilot_comms = expect_status(
        "pilot communications",
        client.post(
            "/api/v1/pilot/communications/launch",
            json={
                "channels": ["SMS", "IVR", "DASHBOARD"],
                "message": "DRISHYAM pilot launch advisory for selected districts.",
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(
        pilot_comms.get("communications", {}).get("status") == "LAUNCHED",
        "pilot communications",
        "expected launched communications",
    )

    pilot_metrics = expect_status(
        "pilot metrics",
        client.post(
            "/api/v1/pilot/metrics/snapshot",
            json={
                "prevented_loss_inr": 3800000,
                "avg_response_min": 2.8,
                "alert_delivery_pct": 96.4,
                "citizen_coverage_pct": 54.0,
                "satisfaction_score": 4.4,
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(pilot_metrics.get("snapshot_count", 0) >= 1, "pilot metrics", "expected pilot snapshot count")

    pilot_feedback = expect_status(
        "pilot feedback",
        client.post(
            "/api/v1/pilot/feedback",
            json={
                "stakeholder_type": "analyst",
                "source_agency": "Pilot Ops Cell",
                "sentiment": "POSITIVE",
                "message": "District command view is stable and alert routing is on time.",
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(pilot_feedback.get("sentiment") == "POSITIVE", "pilot feedback", "expected pilot feedback sentiment")

    pilot_readiness = expect_status(
        "pilot readiness",
        client.get("/api/v1/pilot/readiness", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(pilot_readiness.get("readiness", {}).get("total", 0) >= 18, "pilot readiness", "expected phase 34 checklist")

    pilot_outcome = expect_status(
        "pilot outcome",
        client.get("/api/v1/pilot/outcome-report", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(pilot_outcome.get("feedback_summary", {}).get("total", 0) >= 1, "pilot outcome", "expected feedback in outcome")

    pilot_publish = expect_status(
        "pilot publish",
        client.post("/api/v1/pilot/outcome-report/publish", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(bool(pilot_publish.get("published_at")), "pilot publish", "expected published pilot report")

    national_scale = expect_status(
        "national scale",
        client.get("/api/v1/program-office/national-scale", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(len(national_scale.get("rollout_waves", [])) >= 4, "national scale", "expected rollout waves")
    expect(len(national_scale.get("playbooks", [])) >= 8, "national scale", "expected scale playbooks")

    pipeline_opportunity = expect_status(
        "pipeline opportunity",
        client.post(
            "/api/v1/program-office/business/pipeline",
            json={
                "account_name": "Demo Cooperative Bank",
                "segment": "BANK",
                "stage": "DISCOVERY",
                "owner": "Revenue Ops",
                "annual_value_inr": 1500000,
                "next_step": "Validate recovery ROI with fraud desk",
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(pipeline_opportunity.get("account_name") == "Demo Cooperative Bank", "pipeline opportunity", "expected created opportunity")

    invoice = expect_status(
        "billing invoice",
        client.post(
            "/api/v1/program-office/business/invoices",
            json={
                "partner_name": "Demo Cooperative Bank",
                "plan_name": "Bank Alert Fabric",
                "amount_inr": 800000,
                "billing_cycle": "QUARTERLY",
                "subscription_status": "ACTIVE",
                "days_until_due": 21,
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(invoice.get("billing_status") == "ISSUED", "billing invoice", "expected issued invoice")

    business = expect_status(
        "business summary",
        client.get("/api/v1/program-office/business", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(len(business.get("pricing_catalog", [])) >= 8, "business summary", "expected pricing catalog")
    expect(len(business.get("billing", {}).get("records", [])) >= 1, "business summary", "expected billing records")

    roi_estimate = expect_status(
        "roi estimate",
        client.post(
            "/api/v1/program-office/business/roi/estimate",
            json={
                "segment": "BANK",
                "prevented_loss_inr": 12000000,
                "platform_cost_inr": 4400000,
                "monthly_alerts": 180000,
                "covered_entities": 2400000,
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(roi_estimate.get("roi_percent", 0) > 0, "roi estimate", "expected positive ROI estimate")

    support_ticket = expect_status(
        "support ticket",
        client.post(
            "/api/v1/program-office/support/tickets",
            json={
                "channel": "DASHBOARD",
                "stakeholder_type": "government",
                "severity": "HIGH",
                "incident_classification": "SEV-2",
                "summary": "District onboarding support is required for the next rollout wave.",
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(support_ticket.get("ticket_id", "").startswith("SUP-"), "support ticket", "expected support ticket id")

    support_update = expect_status(
        "support ticket update",
        client.post(
            f"/api/v1/program-office/support/tickets/{support_ticket['ticket_id']}/status",
            json={"status": "RESOLVED", "note": "Closed during smoke verification."},
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(support_update.get("status") == "RESOLVED", "support ticket update", "expected resolved ticket")

    support = expect_status(
        "support summary",
        client.get("/api/v1/program-office/support", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(len(support.get("channels", [])) >= 4, "support summary", "expected support channels")
    expect(len(support.get("tickets", [])) >= 1, "support summary", "expected support tickets")

    partners = expect_status(
        "partner summary",
        client.get("/api/v1/program-office/partners", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(partners.get("summary", {}).get("tracked", 0) >= 4, "partner summary", "expected tracked partner integrations")

    partner_update = expect_status(
        "partner status update",
        client.post(
            "/api/v1/program-office/partners/Airtel%20National%20Scam%20Shield/status",
            json={
                "api_access_status": "ACTIVE",
                "credential_status": "ISSUED",
                "status": "LIVE",
                "note": "Advanced during smoke verification.",
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(partner_update.get("api_access_status") == "ACTIVE", "partner status update", "expected updated API status")

    documentation = expect_status(
        "documentation summary",
        client.get("/api/v1/program-office/documentation", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(documentation.get("summary", {}).get("coverage_percent") == 100, "documentation summary", "expected full phase-38 docs coverage")

    governance_review = expect_status(
        "governance review create",
        client.post(
            "/api/v1/program-office/governance/reviews",
            json={
                "board_type": "Governance Review Board",
                "title": "Smoke verification sign-off",
                "cadence": "MONTHLY",
                "status": "COMPLETE",
                "outcome_summary": "Program office surfaces verified in smoke suite.",
                "recommendations": ["Maintain weekly launch review cadence"],
                "days_until_next": 30,
            },
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(governance_review.get("status") == "COMPLETE", "governance review create", "expected governance review")

    governance = expect_status(
        "governance summary",
        client.get("/api/v1/program-office/governance", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(len(governance.get("methodologies", [])) >= 9, "governance summary", "expected KPI methodologies")

    launch_readiness = expect_status(
        "launch readiness",
        client.get("/api/v1/program-office/launch-readiness", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(launch_readiness.get("readiness", {}).get("ready_for_go_live") is True, "launch readiness", "expected green go-live gates")

    continuous_improvement = expect_status(
        "continuous improvement",
        client.get("/api/v1/program-office/continuous-improvement", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(len(continuous_improvement.get("tasks", [])) == 20, "continuous improvement", "expected CI41 task set")

    observability_overview = expect_status(
        "observability overview",
        client.get("/api/v1/observability/overview", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(observability_overview.get("summary", {}).get("traces_live") is True, "observability overview", "expected traces live")

    observability_traces = expect_status(
        "observability traces",
        client.get("/api/v1/observability/traces", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(observability_traces.get("summary", {}).get("count", 0) >= 1, "observability traces", "expected trace rows")

    observability_models = expect_status(
        "observability models",
        client.get("/api/v1/observability/models", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(observability_models.get("summary", {}).get("models", 0) >= 4, "observability models", "expected model scorecards")

    observability_errors = expect_status(
        "observability errors",
        client.get("/api/v1/observability/errors", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(observability_errors.get("summary", {}).get("open", 0) >= 1, "observability errors", "expected issue tracking rows")

    fir_action = expect_status(
        "fir action",
        client.post(
            "/api/v1/actions/perform",
            json={"action_type": "GENERATE_FIR_FROM_GRAPH", "target_id": "+919876540000"},
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(fir_action.get("status") == "success", "fir action", "expected FIR action success")

    upi_flagged = expect_status(
        "upi verify flagged",
        client.post("/api/v1/upi/verify", json={"vpa": "broken-vpa-handle"}),
    )
    expect(upi_flagged.get("is_flagged") is True, "upi verify flagged", "expected blocked or invalid VPA signal")

    upi_clean = expect_status(
        "upi verify clean",
        client.post("/api/v1/upi/verify", json={"vpa": "shopkeeper@oksbi"}),
    )
    expect(upi_clean.get("is_flagged") is False, "upi verify clean", "expected clean VPA")

    bank_freeze = expect_status(
        "bank freeze alert",
        client.post("/api/v1/notifications/bank/freeze-alert", json={"incident_id": "INC-DEMO", "vpa": "testscammer@paytm"}),
    )
    expect(bank_freeze.get("bank_acknowledged") is True, "bank freeze alert", "expected bank acknowledgement")

    npci_block = expect_status(
        "npci direct block",
        client.post(
            "/api/v1/upi/npci/direct-block",
            json={"vpa": "testscammer@paytm", "reason": "Demo freeze", "case_id": "INC-DEMO"},
        ),
    )
    expect(npci_block.get("status") == "SUCCESS", "npci direct block", "expected NPCI block acceptance")

    alert_coverage = expect_status(
        "alert coverage",
        client.get("/api/v1/system/alerts/coverage?region=delhi", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    expect(alert_coverage.get("citizens", 0) > 0, "alert coverage", "expected covered citizens")

    alert_dispatch = expect_status(
        "alert dispatch",
        client.post(
            "/api/v1/notifications/citizen/push-alert",
            json={
                "region": "delhi",
                "scenario_title": "OTP Sharing Scam",
                "message": "DRISHYAM advisory: OTP sharing scam surge in Delhi.",
                "channels": ["SMS", "PUSH"],
            },
        ),
    )
    expect(alert_dispatch.get("citizens_notified", 0) > 0, "alert dispatch", "expected notified citizens")

    alert_history = expect_status("alert history", client.get("/api/v1/notifications/history/recent?limit=5"))
    expect(len(alert_history.get("alerts", [])) > 0, "alert history", "expected alert history rows")

    deepfake_scan = expect_status(
        "deepfake analyze",
        client.post(
            "/api/v1/forensic/deepfake/analyze",
            json={"media_type": "video"},
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(deepfake_scan.get("verdict") in {"REAL", "FAKE", "SUSPICIOUS"} or deepfake_scan.get("status") == "PENDING", "deepfake analyze", "unexpected verdict or status")
    if deepfake_scan.get("status") != "PENDING":
        expect("risk_level" in deepfake_scan, "deepfake analyze", "missing risk level")

    bank_login = expect_status(
        "bank login",
        client.post(
            "/api/v1/auth/login",
            data={"username": "bankops", "password": "password123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ),
    )
    expect(bank_login.get("mfa_required") is True, "bank login", "expected bank MFA requirement")

    bank_verify = expect_status(
        "bank mfa verify",
        client.post(
            "/api/v1/auth/mfa/verify",
            json={"otp": "19301930"},
            headers={"Authorization": f"Bearer {bank_login['access_token']}"},
        ),
    )
    bank_token = bank_verify["access_token"]

    blocked_freeze = client.post(
        "/api/v1/actions/perform",
        json={"action_type": "FREEZE_VPA", "target_id": "testscammer@paytm"},
        headers={"Authorization": f"Bearer {bank_token}"},
    )
    expect(blocked_freeze.status_code == 403, "approval guard", "expected critical action without approval to be blocked")

    bank_approval = expect_status(
        "bank approval request",
        client.post(
            "/api/v1/security/approvals",
            json={
                "action_type": "FREEZE_VPA",
                "resource": "testscammer@paytm",
                "resource_domain": "recovery",
                "justification": "Bank ops needs sign-off to execute a demo VPA freeze action.",
                "risk_level": "HIGH",
                "metadata": {"segment": "BANK", "region": "INDIA"},
            },
            headers={"Authorization": f"Bearer {bank_token}"},
        ),
    )
    expect(bank_approval.get("status") == "PENDING", "bank approval request", "expected pending approval")

    approval_decision = expect_status(
        "approval decision",
        client.post(
            f"/api/v1/security/approvals/{bank_approval['approval_id']}/decision",
            json={"status": "APPROVED", "note": "Approved during smoke verification."},
            headers={"Authorization": f"Bearer {verified_token}"},
        ),
    )
    expect(approval_decision.get("status") == "APPROVED", "approval decision", "expected approved request")

    approved_freeze = expect_status(
        "approved freeze action",
        client.post(
            "/api/v1/actions/perform",
            json={
                "action_type": "FREEZE_VPA",
                "target_id": "testscammer@paytm",
                "metadata": {"approval_id": bank_approval["approval_id"]},
            },
            headers={"Authorization": f"Bearer {bank_token}"},
        ),
    )
    expect(approved_freeze.get("status") == "success", "approved freeze action", "expected approved critical action success")

    print("[PASS] Backend smoke checks completed.")
    print(f"  Active consents: {consent_summary.get('totals', {}).get('active')}")
    print(f"  Telecom sandbox mode: {telecom_sandbox.get('mode')}")
    print(f"  Telecom FRI score: {telecom_score.get('fri_score')}")
    print(f"  Honeypot personas: {len(persona_list)}")
    print(f"  Honeypot transcript rows: {len(honeypot_summary.get('transcript', []))}")
    print(f"  Citizen score: {citizen_score.get('score')}")
    print(f"  Citizen trust-circle size: {len(citizen_trust_circle.get('trust_circle', []))}")
    print(f"  Citizen recovery bundle: {bundle_id}")
    print(f"  Citizen drill readiness score: {citizen_drill_send.get('scorecard', {}).get('readiness_score')}")
    print(f"  Detection rows: {len(detection_calls)}")
    print(f"  Bharat languages: {len(bharat_languages.get('languages', []))}")
    print(f"  Bank integration mode: {bank_integration.get('mode')}")
    print(f"  Pilot readiness: {pilot_readiness.get('readiness', {}).get('progress_percent')}%")
    print(f"  National rollout waves: {len(national_scale.get('rollout_waves', []))}")
    print(f"  Business billing rows: {len(business.get('billing', {}).get('records', []))}")
    print(f"  Partner integrations tracked: {partners.get('summary', {}).get('tracked')}")
    print(f"  Documentation coverage: {documentation.get('summary', {}).get('coverage_percent')}%")
    print(f"  Launch readiness green: {launch_readiness.get('readiness', {}).get('ready_for_go_live')}")
    print(f"  Observability traces: {observability_traces.get('summary', {}).get('count')}")
    print(f"  Command alerts: {len(command_stats.get('alerts', []))}")
    print(f"  Mule ads: {len(mule_stats.get('ads', []))}")
    print(f"  Deepfake incidents: {len(deepfake_stats.get('incidents', []))}")
    print(f"  Drill readiness score: {drill.get('scorecard', {}).get('readiness_score')}")
    print(f"  Audit log rows: {len(audit_logs)}")
    print(f"  Approval queue pending after flow: {security_center.get('approvals', {}).get('summary', {}).get('pending')}")
    print(f"  Alert dispatch id: {alert_dispatch.get('alert_id')}")
    print(f"  Deepfake fallback verdict: {deepfake_scan.get('verdict')}")


if __name__ == "__main__":
    main()
