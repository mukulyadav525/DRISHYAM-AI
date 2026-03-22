#!/usr/bin/env python3

from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from smoke_backend import prepare_runtime  # noqa: E402


def fail(name: str, detail: str):
    raise SystemExit(f"[FAIL] {name}: {detail}")


def expect_status(name: str, response, status_code: int = 200):
    if response.status_code != status_code:
        fail(name, f"expected {status_code}, got {response.status_code}: {response.text}")
    try:
        return response.json()
    except Exception as exc:  # pragma: no cover - defensive guard
        fail(name, f"response was not valid JSON: {exc}")


def expect_keys(name: str, payload: dict, keys: list[str]):
    missing = [key for key in keys if key not in payload]
    if missing:
        fail(name, f"missing keys: {', '.join(missing)}")


def expect_type(name: str, value, expected_type, detail: str):
    if not isinstance(value, expected_type):
        fail(name, detail)


def expect_non_empty_string(name: str, value, detail: str):
    if not isinstance(value, str) or not value.strip():
        fail(name, detail)


def approve_citizen_session(client: TestClient, verified_token: str, phone_number: str) -> str:
    simulation_request = expect_status(
        "contract simulation request",
        client.post("/api/v1/auth/simulation/request", json={"phone_number": phone_number}),
    )
    expect_keys("contract simulation request", simulation_request, ["status"])

    requests = expect_status(
        "contract simulation list",
        client.get("/api/v1/auth/simulation/list", headers={"Authorization": f"Bearer {verified_token}"}),
    )
    record = next((item for item in requests if item.get("phone_number") == phone_number), None)
    if not record:
        fail("contract simulation list", f"expected request row for {phone_number}")

    if record.get("status") != "approved":
        approval = expect_status(
            "contract simulation approval",
            client.post(
                f"/api/v1/auth/simulation/approve/{record['id']}?approve=true",
                headers={"Authorization": f"Bearer {verified_token}"},
            ),
        )
        expect_non_empty_string(
            "contract simulation approval",
            approval.get("message"),
            "expected approval confirmation message",
        )

    status = expect_status(
        "contract simulation status",
        client.get(f"/api/v1/auth/simulation/status/{phone_number}"),
    )
    expect_keys("contract simulation status", status, ["status", "access_token", "phone_number"])
    if status["status"] != "approved":
        fail("contract simulation status", "expected citizen session to be approved")
    return status["access_token"]


def main():
    prepare_runtime()
    client = TestClient(app)

    consent_record = expect_status(
        "contract consent record",
        client.post(
            "/api/v1/privacy/consent/record",
            json={
                "phone_number": "9876500022",
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
    expect_keys(
        "contract consent record",
        consent_record,
        ["phone_number", "status", "required_complete", "policy_version", "scopes"],
    )
    expect_type("contract consent record", consent_record["scopes"], dict, "expected consent scopes map")

    login = expect_status(
        "contract login",
        client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "password123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ),
    )
    expect_keys(
        "contract login",
        login,
        ["access_token", "token_type", "role", "username", "mfa_required", "mfa_verified", "access"],
    )
    if login["role"] != "admin":
        fail("contract login", "expected admin role")

    verify = expect_status(
        "contract mfa verify",
        client.post(
            "/api/v1/auth/mfa/verify",
            json={"otp": "19301930"},
            headers={"Authorization": f"Bearer {login['access_token']}"},
        ),
    )
    expect_keys(
        "contract mfa verify",
        verify,
        ["access_token", "token_type", "role", "username", "mfa_required", "mfa_verified", "session_id", "access"],
    )
    if verify["mfa_verified"] is not True:
        fail("contract mfa verify", "expected verified token")
    verified_token = verify["access_token"]
    protected_headers = {"Authorization": f"Bearer {verified_token}"}

    session = expect_status(
        "contract session",
        client.get("/api/v1/auth/session", headers=protected_headers),
    )
    expect_keys(
        "contract session",
        session,
        [
            "username",
            "role",
            "full_name",
            "mfa_required",
            "mfa_verified",
            "expires_at",
            "session_id",
            "device_label",
            "device_type",
            "auth_stage",
            "risk_level",
            "last_seen_at",
            "access",
        ],
    )

    citizen_token = approve_citizen_session(client, verified_token, "9876500022")
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    citizen_home = expect_status(
        "contract citizen home",
        client.get("/api/v1/citizen/app-home", headers=citizen_headers),
    )
    expect_keys(
        "contract citizen home",
        citizen_home,
        [
            "profile",
            "onboarding",
            "trust_circle",
            "alerts",
            "score",
            "habit_breaker",
            "neighborhood_density",
            "drills",
            "recovery",
            "notification_templates",
            "analytics",
        ],
    )
    expect_keys(
        "contract citizen home profile",
        citizen_home["profile"],
        ["citizen_id", "display_name", "phone_masked", "district", "language", "senior_mode", "low_bandwidth", "segment", "completed_steps", "last_score"],
    )
    expect_type("contract citizen home alerts", citizen_home["alerts"], list, "expected alerts list")
    expect_type("contract citizen home trust circle", citizen_home["trust_circle"], list, "expected trust circle list")
    expect_type("contract citizen home templates", citizen_home["notification_templates"], list, "expected template list")

    low_bandwidth_profile = expect_status(
        "contract citizen preferences",
        client.post(
            "/api/v1/citizen/preferences",
            json={
                "district": "Delhi NCR",
                "language": "hi",
                "senior_mode": True,
                "low_bandwidth": True,
                "segment": "senior",
                "onboarding_step": "low_bandwidth_ready",
            },
            headers=citizen_headers,
        ),
    )
    expect_keys(
        "contract citizen preferences",
        low_bandwidth_profile,
        ["citizen_id", "display_name", "phone_masked", "district", "language", "senior_mode", "low_bandwidth", "segment", "completed_steps", "last_score"],
    )
    if low_bandwidth_profile["low_bandwidth"] is not True:
        fail("contract citizen preferences", "expected low-bandwidth mode to persist")

    telecom_ivr = expect_status(
        "contract telecom ivr",
        client.post("/api/v1/telecom/ivr/handle", json={"language": "hi"}),
    )
    expect_keys("contract telecom ivr", telecom_ivr, ["session_id", "language_confirmed", "transcript_started"])

    ussd_menu = expect_status(
        "contract bharat ussd menu",
        client.get("/api/v1/bharat/ussd/menu?lang=hi&region=north"),
    )
    expect_keys(
        "contract bharat ussd menu",
        ussd_menu,
        ["language", "region", "text", "low_literacy_prompt", "callback_eta"],
    )

    ussd_report = expect_status(
        "contract bharat ussd report",
        client.post(
            "/api/v1/bharat/ussd/report?phone_number=9876500022&scam_type=KYC/Bank%20Fraud&lang=hi&region=north",
            headers=citizen_headers,
        ),
    )
    expect_keys(
        "contract bharat ussd report",
        ussd_report,
        ["status", "case_id", "message", "sms_preview", "routed_to", "next_step"],
    )
    expect_keys(
        "contract bharat ussd sms preview",
        ussd_report["sms_preview"],
        ["alert_type", "language", "language_name", "region", "channel", "template_id", "text"],
    )

    comprehensive_report = expect_status(
        "contract bharat report",
        client.post(
            "/api/v1/bharat/report/comprehensive",
            json={
                "reporter_num": "9876500022",
                "category": "Financial Fraud",
                "scam_type": "Financial Fraud",
                "amount": "12000",
                "platform": "WhatsApp",
                "description": "Caller asked for urgent KYC verification and sent a payment link.",
                "channel": "IVR",
                "lang": "en",
                "region": "north",
                "bank_name": "SBI",
                "utr_id": "123456789012",
            },
            headers=citizen_headers,
        ),
    )
    expect_keys(
        "contract bharat report",
        comprehensive_report,
        ["status", "case_id", "fir_copy_url", "message", "sms_preview", "routed_to", "saved_context"],
    )
    fir_details = expect_status(
        "contract bharat fir",
        client.get(f"/api/v1/bharat/fir/{comprehensive_report['case_id']}"),
    )
    expect_keys(
        "contract bharat fir",
        fir_details,
        ["case_id", "timestamp", "section_65b_certified", "digital_signature", "details"],
    )

    honeypot_session = expect_status(
        "contract honeypot session",
        client.post(
            "/api/v1/honeypot/sessions",
            json={"caller_num": "+919876543210", "persona": "Elderly Uncle", "customer_id": "9876500022"},
            headers=citizen_headers,
        ),
    )
    expect_keys(
        "contract honeypot session",
        honeypot_session,
        ["session_id", "persona_active", "sip_transfer_complete", "scammer_notified", "caller_num", "location", "risk_band", "threat_pattern", "citizen_banner"],
    )
    sid = honeypot_session["session_id"]

    honeypot_handoff = expect_status(
        "contract honeypot handoff",
        client.post(f"/api/v1/honeypot/session/{sid}/handoff", json={"persona": "Elderly Uncle"}, headers=citizen_headers),
    )
    expect_keys("contract honeypot handoff", honeypot_handoff, ["status", "session_id", "greeting", "summary"])

    honeypot_turn = expect_status(
        "contract honeypot direct chat",
        client.post(
            "/api/v1/honeypot/direct-chat",
            json={
                "session_id": sid,
                "persona": "Elderly Uncle",
                "message": "Your UPI is blocked. Send money to suspect@okaxis and share OTP now.",
            },
            headers=citizen_headers,
        ),
    )
    expect_keys("contract honeypot direct chat", honeypot_turn, ["ai_response", "session_id", "persona", "status"])

    honeypot_summary = expect_status(
        "contract honeypot summary",
        client.get(f"/api/v1/honeypot/session/{sid}/summary", headers=citizen_headers),
    )
    expect_keys(
        "contract honeypot summary",
        honeypot_summary,
        ["session_id", "status", "direction", "persona", "caller_num", "customer_id", "citizen_banner", "citizen_safe", "threat_profile", "live_summary", "transcript", "updated_at", "routing"],
    )
    expect_type("contract honeypot transcript", honeypot_summary["transcript"], list, "expected transcript list")
    expect_type("contract honeypot routing", honeypot_summary["routing"], dict, "expected routing payload")

    honeypot_conclude = expect_status(
        "contract honeypot conclude",
        client.post(
            "/api/v1/honeypot/direct-conclude",
            json={"session_id": sid, "customer_id": "9876500022"},
            headers=citizen_headers,
        ),
    )
    expect_keys(
        "contract honeypot conclude",
        honeypot_conclude,
        [
            "session_id",
            "transcript_id",
            "scammer_profile_id",
            "fir_packet_ready",
            "intelligence_report",
            "analysis",
            "reports_created",
            "report_ids",
            "routed_agencies",
            "notifications_created",
            "recovery_case_id",
            "session_summary",
        ],
    )

    upi_verify = expect_status(
        "contract upi verify",
        client.post("/api/v1/upi/verify", json={"vpa": "suspect@okaxis"}, headers=citizen_headers),
    )
    expect_keys(
        "contract upi verify",
        upi_verify,
        ["vpa", "is_flagged", "risk_level", "reason", "bank_name", "recommended_next_action"],
    )

    upi_protect = expect_status(
        "contract upi protect",
        client.post(
            "/api/v1/upi/protect",
            json={"vpa": "suspect@okaxis", "reporter_num": "9876500022", "description": "Citizen reported suspicious refund request."},
            headers=citizen_headers,
        ),
    )
    expect_keys(
        "contract upi protect",
        upi_protect,
        ["routed", "bank_case_id", "police_case_id", "notifications_created", "agencies"],
    )

    recovery_bank = expect_status(
        "contract recovery bank dispute",
        client.post(
            "/api/v1/recovery/bank-dispute/generate",
            json={"incident_id": upi_protect["bank_case_id"], "language": "en"},
            headers=citizen_headers,
        ),
    )
    expect_keys(
        "contract recovery bank dispute",
        recovery_bank,
        ["letter_id", "letter_url", "legally_formatted", "pre_filled_with_evidence", "language", "incident_id", "bank_status"],
    )

    recovery_rbi = expect_status(
        "contract recovery rbi",
        client.post(
            "/api/v1/recovery/rbi-ombudsman/generate",
            json={"incident_id": upi_protect["bank_case_id"]},
            headers=citizen_headers,
        ),
    )
    expect_keys(
        "contract recovery rbi",
        recovery_rbi,
        ["complaint_id", "ombudsman_portal_url", "evidence_attached", "submission_status", "incident_id"],
    )

    recovery_status = expect_status(
        "contract recovery status",
        client.get(f"/api/v1/recovery/case/status?incident_id={upi_protect['bank_case_id']}"),
    )
    expect_keys(
        "contract recovery status",
        recovery_status,
        ["police_fir_status", "bank_dispute_status", "rbi_ombudsman_status", "consumer_court_status", "last_updated_utc", "next_action_required"],
    )

    print("[PASS] Backend contract checks completed.")


if __name__ == "__main__":
    main()
