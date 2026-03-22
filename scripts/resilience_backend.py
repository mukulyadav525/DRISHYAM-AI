#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
import sys
import time

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from smoke_backend import prepare_runtime  # noqa: E402


def fail(name: str, detail: str) -> None:
    raise SystemExit(f"[FAIL] {name}: {detail}")


def expect(name: str, condition: bool, detail: str) -> None:
    if not condition:
        fail(name, detail)


def expect_status(name: str, response, status_code: int = 200) -> dict:
    if response.status_code != status_code:
        fail(name, f"expected {status_code}, got {response.status_code}: {response.text}")
    try:
        return response.json()
    except Exception as exc:  # pragma: no cover - defensive guard
        fail(name, f"response was not valid JSON: {exc}")


def expect_keys(name: str, payload: dict, keys: list[str]) -> None:
    missing = [key for key in keys if key not in payload]
    if missing:
        fail(name, f"missing keys: {', '.join(missing)}")


def percentile(values: list[float], ratio: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = int((len(ordered) - 1) * ratio)
    return ordered[index]


def timed_request(
    client: TestClient,
    name: str,
    method: str,
    path: str,
    *,
    headers: dict[str, str] | None = None,
    json: dict | None = None,
    expected_status: int = 200,
) -> tuple[float, dict]:
    started = time.perf_counter()
    response = client.request(method, path, headers=headers, json=json)
    elapsed_ms = (time.perf_counter() - started) * 1000
    payload = expect_status(name, response, expected_status)
    return elapsed_ms, payload


def get_verified_admin_headers(client: TestClient) -> dict[str, str]:
    login = expect_status(
        "resilience login",
        client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "password123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ),
    )
    verify = expect_status(
        "resilience mfa verify",
        client.post(
            "/api/v1/auth/mfa/verify",
            json={"otp": "19301930"},
            headers={"Authorization": f"Bearer {login['access_token']}"},
        ),
    )
    return {"Authorization": f"Bearer {verify['access_token']}"}


def record_consent(client: TestClient, phone_number: str) -> None:
    payload = expect_status(
        "resilience consent record",
        client.post(
            "/api/v1/privacy/consent/record",
            json={
                "phone_number": phone_number,
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
    expect("resilience consent record", payload.get("required_complete") is True, "expected consent completion")


def get_citizen_headers(client: TestClient, admin_headers: dict[str, str], phone_number: str) -> dict[str, str]:
    record_consent(client, phone_number)
    request_payload = expect_status(
        "resilience citizen request",
        client.post("/api/v1/auth/simulation/request", json={"phone_number": phone_number}),
    )
    expect(
        "resilience citizen request",
        request_payload.get("status") in {"pending", "approved"},
        "expected pending or approved citizen request",
    )

    queue = expect_status(
        "resilience citizen queue",
        client.get("/api/v1/auth/simulation/list", headers=admin_headers),
    )
    row = next((item for item in queue if item.get("phone_number") == phone_number), None)
    if not row:
        fail("resilience citizen queue", f"expected row for {phone_number}")

    if row.get("status") != "approved":
        approval = expect_status(
            "resilience citizen approve",
            client.post(
                f"/api/v1/auth/simulation/approve/{row['id']}?approve=true",
                headers=admin_headers,
            ),
        )
        expect(
            "resilience citizen approve",
            bool(str(approval.get("message", "")).strip()),
            "expected approval message",
        )

    status = expect_status(
        "resilience citizen status",
        client.get(f"/api/v1/auth/simulation/status/{phone_number}"),
    )
    expect(
        "resilience citizen status",
        status.get("status") == "approved" and bool(status.get("access_token")),
        "expected approved citizen session",
    )
    return {"Authorization": f"Bearer {status['access_token']}"}


def run_stage(
    client: TestClient,
    stage_name: str,
    endpoint_specs: list[dict],
    *,
    iterations: int,
    pause_seconds: float = 0.0,
) -> dict:
    durations: list[float] = []
    per_endpoint: dict[str, list[float]] = {spec["name"]: [] for spec in endpoint_specs}

    for _ in range(iterations):
        for spec in endpoint_specs:
            elapsed_ms, payload = timed_request(
                client,
                f"{stage_name}::{spec['name']}",
                spec.get("method", "GET"),
                spec["path"],
                headers=spec.get("headers"),
                json=spec.get("json"),
                expected_status=spec.get("status_code", 200),
            )
            durations.append(elapsed_ms)
            per_endpoint[spec["name"]].append(elapsed_ms)
            expect_keys(f"{stage_name}::{spec['name']}", payload, spec.get("keys", []))
        if pause_seconds > 0:
            time.sleep(pause_seconds)

    total_requests = len(durations)
    expect(stage_name, total_requests > 0, "expected at least one request to be executed")

    summary = {
        "stage": stage_name,
        "requests": total_requests,
        "avg_latency_ms": round(sum(durations) / total_requests, 2),
        "p95_latency_ms": round(percentile(durations, 0.95), 2),
        "max_latency_ms": round(max(durations), 2),
        "per_endpoint_avg_ms": {
            name: round(sum(values) / len(values), 2)
            for name, values in per_endpoint.items()
            if values
        },
    }

    expect(
        stage_name,
        summary["max_latency_ms"] < 15000,
        f"latency spike exceeded ceiling: {summary['max_latency_ms']}ms",
    )
    return summary


def assert_recovery_health(client: TestClient, admin_headers: dict[str, str], citizen_headers: dict[str, str], label: str) -> dict:
    session_payload = expect_status(
        f"{label} session",
        client.get("/api/v1/auth/session", headers=admin_headers),
    )
    expect_keys(f"{label} session", session_payload, ["username", "role", "access", "session_id"])

    overview_payload = expect_status(
        f"{label} system overview",
        client.get("/api/v1/system/overview", headers=admin_headers),
    )
    expect_keys(f"{label} system overview", overview_payload, ["stats", "hotspots", "live_feed"])

    security_payload = expect_status(
        f"{label} security control center",
        client.get("/api/v1/security/control-center", headers=admin_headers),
    )
    expect_keys(f"{label} security control center", security_payload, ["access", "sessions", "approvals", "anomalies"])

    observability_payload = expect_status(
        f"{label} observability overview",
        client.get("/api/v1/observability/overview", headers=admin_headers),
    )
    expect_keys(
        f"{label} observability overview",
        observability_payload,
        ["summary", "service_health", "dashboard_matrix", "partner_health", "district_performance", "product_analytics"],
    )

    citizen_home = expect_status(
        f"{label} citizen home",
        client.get("/api/v1/citizen/app-home", headers=citizen_headers),
    )
    expect_keys(
        f"{label} citizen home",
        citizen_home,
        ["profile", "onboarding", "trust_circle", "alerts", "score", "habit_breaker", "neighborhood_density", "drills", "recovery", "notification_templates", "analytics"],
    )

    routed_vpa = f"{label.replace(' ', '-').lower()}@okaxis"
    protect_payload = expect_status(
        f"{label} upi protect",
        client.post(
            "/api/v1/upi/protect",
            json={
                "vpa": routed_vpa,
                "reporter_num": "9876500033",
                "description": f"Resilience validation write path for {label}.",
            },
            headers=citizen_headers,
        ),
    )
    expect_keys(
        f"{label} upi protect",
        protect_payload,
        ["routed", "bank_case_id", "police_case_id", "notifications_created", "agencies"],
    )

    dispute_payload = expect_status(
        f"{label} bank dispute",
        client.post(
            "/api/v1/recovery/bank-dispute/generate",
            json={"incident_id": protect_payload["bank_case_id"], "language": "en"},
            headers=citizen_headers,
        ),
    )
    expect_keys(
        f"{label} bank dispute",
        dispute_payload,
        ["letter_id", "letter_url", "legally_formatted", "pre_filled_with_evidence", "language", "incident_id", "bank_status"],
    )

    recovery_payload = expect_status(
        f"{label} recovery status",
        client.get(f"/api/v1/recovery/case/status?incident_id={protect_payload['bank_case_id']}"),
    )
    expect_keys(
        f"{label} recovery status",
        recovery_payload,
        ["police_fir_status", "bank_dispute_status", "rbi_ombudsman_status", "consumer_court_status", "last_updated_utc", "next_action_required"],
    )

    return {
        "label": label,
        "healthy_services": observability_payload["summary"]["healthy_services"],
        "citizen_alerts": len(citizen_home["alerts"]),
        "bank_case_id": protect_payload["bank_case_id"],
        "police_case_id": protect_payload["police_case_id"],
    }


def main() -> None:
    prepare_runtime()
    client = TestClient(app)

    admin_headers = get_verified_admin_headers(client)
    citizen_headers = get_citizen_headers(client, admin_headers, "9876500033")

    load_specs = [
        {"name": "session", "path": "/api/v1/auth/session", "headers": admin_headers, "keys": ["username", "role", "access"]},
        {"name": "system_overview", "path": "/api/v1/system/overview", "headers": admin_headers, "keys": ["stats", "hotspots", "live_feed"]},
        {"name": "agency_stats", "path": "/api/v1/system/stats/agency", "headers": admin_headers, "keys": ["police", "bank", "telecom", "simulations", "triage"]},
        {"name": "command_stats", "path": "/api/v1/system/stats/command", "headers": admin_headers, "keys": ["rupees_saved", "alerts", "system_health"]},
        {"name": "upi_stats", "path": "/api/v1/system/stats/upi", "headers": admin_headers, "keys": ["dashboard", "threat_feed", "saved_value_today"]},
        {"name": "security_control_center", "path": "/api/v1/security/control-center", "headers": admin_headers, "keys": ["access", "sessions", "approvals", "anomalies"]},
        {"name": "observability_overview", "path": "/api/v1/observability/overview", "headers": admin_headers, "keys": ["summary", "service_health", "dashboard_matrix"]},
    ]
    load_summary = run_stage(client, "load", load_specs, iterations=4)

    soak_specs = [
        {"name": "citizen_home", "path": "/api/v1/citizen/app-home", "headers": citizen_headers, "keys": ["profile", "alerts", "score", "recovery"]},
        {"name": "system_graph", "path": "/api/v1/system/graph", "headers": admin_headers, "keys": ["nodes", "edges", "root_entity"]},
        {"name": "score_stats", "path": "/api/v1/system/stats/score", "headers": admin_headers, "keys": ["national", "factors"]},
        {"name": "security_control_center", "path": "/api/v1/security/control-center", "headers": admin_headers, "keys": ["access", "sessions", "approvals", "anomalies"]},
        {"name": "observability_traces", "path": "/api/v1/observability/traces", "headers": admin_headers, "keys": ["summary", "traces"]},
        {"name": "command_stats", "path": "/api/v1/system/stats/command", "headers": admin_headers, "keys": ["rupees_saved", "alerts", "system_health"]},
    ]
    soak_summary = run_stage(client, "soak", soak_specs, iterations=6, pause_seconds=0.05)

    chaos_payload = expect_status(
        "chaos drill",
        client.post(
            "/api/v1/system/chaos/run-drill",
            json={"scenario": "approval_queue_outage", "target": "APPROVAL_QUEUE"},
            headers=admin_headers,
        ),
    )
    expect_keys(
        "chaos drill",
        chaos_payload,
        ["drill_id", "services_degraded", "auto_failover_triggered", "data_loss_detected", "war_room_alerted"],
    )
    expect("chaos drill", chaos_payload["auto_failover_triggered"] is True, "expected auto failover trigger")
    chaos_recovery = assert_recovery_health(client, admin_headers, citizen_headers, "post chaos")

    failover_payload = expect_status(
        "failover drill",
        client.post(
            "/api/v1/system/dr/failover-test",
            json={"scenario": "regional_control_plane_loss"},
            headers=admin_headers,
        ),
    )
    expect_keys(
        "failover drill",
        failover_payload,
        ["failover_initiated", "rto_minutes", "rpo_seconds", "sla_99_99_maintained"],
    )
    expect("failover drill", failover_payload["failover_initiated"] is True, "expected failover initiation")
    failover_recovery = assert_recovery_health(client, admin_headers, citizen_headers, "post failover")

    print("[PASS] Resilience verification completed.")
    print(
        {
            "load": load_summary,
            "soak": soak_summary,
            "chaos": {
                "drill_id": chaos_payload["drill_id"],
                "services_degraded": chaos_payload["services_degraded"],
                "recovery": chaos_recovery,
            },
            "failover": {
                "rto_minutes": failover_payload["rto_minutes"],
                "rpo_seconds": failover_payload["rpo_seconds"],
                "recovery": failover_recovery,
            },
        }
    )


if __name__ == "__main__":
    main()
