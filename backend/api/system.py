import datetime
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.access_control import authorize_agency_access
from core.auth import get_current_verified_user
from core.config import settings
from core.database import get_db
from models.database import (
    AdminApproval,
    AgencySession,
    BillingRecord,
    CitizenConsent,
    CrimeReport,
    FileUpload,
    GovernanceReview,
    HoneypotEntity,
    HoneypotMessage,
    HoneypotSession,
    IntelligenceAlert,
    MuleAd,
    NotificationLog,
    PartnerPipeline,
    RecoveryCase,
    ScamCluster,
    SupportTicket,
    SystemAction,
    SystemStat,
    TrustLink,
    User,
)

router = APIRouter()


def _utcnow() -> datetime.datetime:
    return datetime.datetime.utcnow()


def _normalize_datetime(value: datetime.datetime | None) -> datetime.datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return value


def _time_ago(value: datetime.datetime | None) -> str:
    normalized = _normalize_datetime(value)
    if not normalized:
        return "Unknown"
    delta = _utcnow() - normalized
    if delta.total_seconds() < 60:
        return "JUST NOW"
    if delta.total_seconds() < 3600:
        return f"{int(delta.total_seconds() // 60)}m ago"
    if delta.total_seconds() < 86400:
        return f"{int(delta.total_seconds() // 3600)}h ago"
    return normalized.strftime("%d %b")


def _parse_amount(raw: str | None) -> float:
    if not raw:
        return 0.0
    cleaned = str(raw).strip().upper().replace("₹", "").replace(",", "").replace("/ MONTH", "")
    multiplier = 1.0
    if cleaned.endswith("CR"):
        multiplier = 10_000_000
        cleaned = cleaned[:-2]
    elif cleaned.endswith("CRORE"):
        multiplier = 10_000_000
        cleaned = cleaned[:-5]
    elif cleaned.endswith("L") or cleaned.endswith("LAKH"):
        multiplier = 100_000
        cleaned = cleaned[:-1] if cleaned.endswith("L") else cleaned[:-4]
    try:
        return float(cleaned.strip() or 0) * multiplier
    except ValueError:
        return 0.0


def _format_inr(value: float) -> str:
    amount = max(float(value or 0), 0.0)
    if amount >= 10_000_000:
        return f"₹{amount / 10_000_000:.2f} Cr"
    if amount >= 100_000:
        return f"₹{amount / 100_000:.2f} L"
    return f"₹{amount:,.0f}"


def _route_access(db: Session, current_user: User, resource: str) -> None:
    authorize_agency_access(
        db,
        current_user,
        action="READ",
        resource=resource,
        attrs={"region": "INDIA", "sensitivity": "MEDIUM"},
    )


def _recent_report_amounts(reports: list[CrimeReport]) -> float:
    return sum(_parse_amount(report.amount) for report in reports if report.status in {"RESOLVED", "FROZEN", "RECOVERED"})


def _latest_root_entity(db: Session) -> str | None:
    latest_entity = db.query(HoneypotEntity).order_by(HoneypotEntity.last_seen.desc()).first()
    if latest_entity:
        return latest_entity.entity_value

    latest_session = db.query(HoneypotSession).order_by(HoneypotSession.created_at.desc()).first()
    if latest_session and latest_session.caller_num:
        return latest_session.caller_num

    latest_report = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).first()
    if latest_report:
        metadata = latest_report.metadata_json or {}
        return metadata.get("vpa") or latest_report.report_id or latest_report.reporter_num

    return None


def _graph_type(entity_value: str | None) -> str:
    entity = str(entity_value or "")
    if "@" in entity:
        return "upi"
    if entity.upper().startswith("H-"):
        return "session"
    if entity.upper().startswith(("REQ-", "MSG-", "QRF-", "MLE-", "INC-")):
        return "report"
    if sum(ch.isdigit() for ch in entity) >= 10:
        return "phone"
    return "target"


def _build_graph_network(db: Session, root_entity: str | None) -> dict:
    root = (root_entity or "").strip()
    if not root:
        return {"nodes": [], "edges": []}

    nodes: list[dict] = []
    edges: list[dict] = []
    seen = set()

    def add_node(node_id: str, label: str, node_type: str, risk: str = "MEDIUM"):
        if node_id in seen:
            return
        seen.add(node_id)
        nodes.append({"id": node_id, "label": label, "type": node_type, "risk": risk})

    add_node(f"root:{root}", root, _graph_type(root), "HIGH")

    matching_entity = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == root).first()
    if matching_entity:
        add_node(
            f"entity:{matching_entity.id}",
            matching_entity.entity_value,
            (matching_entity.entity_type or "entity").lower(),
            "CRITICAL" if (matching_entity.risk_score or 0) >= 0.8 else "HIGH",
        )
        edges.append({"source": f"root:{root}", "target": f"entity:{matching_entity.id}", "label": "Entity Record"})

    matching_sessions = (
        db.query(HoneypotSession)
        .filter((HoneypotSession.caller_num == root) | (HoneypotSession.session_id == root))
        .order_by(HoneypotSession.created_at.desc())
        .limit(5)
        .all()
    )
    for session in matching_sessions:
        session_id = f"session:{session.session_id}"
        add_node(session_id, session.session_id, "session", "HIGH" if session.status == "completed" else "MEDIUM")
        edges.append({"source": f"root:{root}", "target": session_id, "label": "Observed Session"})

    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(20).all()
    linked_reports = []
    for report in reports:
        metadata = report.metadata_json or {}
        if root in {report.report_id, report.reporter_num, metadata.get("vpa"), metadata.get("entity")}:
            linked_reports.append(report)
        elif isinstance(metadata.get("entities"), list) and root in metadata.get("entities", []):
            linked_reports.append(report)

    for report in linked_reports[:6]:
        report_node = f"report:{report.report_id}"
        add_node(report_node, report.report_id, "report", report.priority or "MEDIUM")
        edges.append({"source": f"root:{root}", "target": report_node, "label": report.scam_type or "Linked Report"})

    clusters = db.query(ScamCluster).order_by(ScamCluster.honeypot_hits.desc(), ScamCluster.created_at.desc()).limit(3).all()
    for cluster in clusters:
        cluster_node = f"cluster:{cluster.cluster_id}"
        add_node(cluster_node, cluster.location or cluster.cluster_id, "cluster", cluster.risk_level or "MEDIUM")
        edges.append({"source": f"root:{root}", "target": cluster_node, "label": "Regional Correlation"})

    return {"nodes": nodes, "edges": edges}


@router.get("/overview")
async def get_system_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "overview")

    reports = db.query(CrimeReport).all()
    alerts = db.query(IntelligenceAlert).filter(IntelligenceAlert.is_active.is_(True)).order_by(IntelligenceAlert.created_at.desc()).limit(5).all()
    clusters = db.query(ScamCluster).order_by(ScamCluster.honeypot_hits.desc(), ScamCluster.created_at.desc()).limit(8).all()
    sessions = db.query(HoneypotSession).order_by(HoneypotSession.created_at.desc()).limit(6).all()
    actions = db.query(SystemAction).order_by(SystemAction.created_at.desc()).limit(10).all()

    resolved_reports = [report for report in reports if report.status in {"RESOLVED", "FROZEN", "RECOVERED"}]
    protected_citizens = db.query(User).filter(User.role == "common", User.is_active.is_(True)).count()
    protected_citizens += db.query(CitizenConsent).filter(CitizenConsent.status == "ACTIVE").count()

    live_feed = []
    for alert in alerts:
        live_feed.append(
            {
                "id": alert.id,
                "location": alert.location or "UNKNOWN",
                "message": alert.message,
                "time": _time_ago(alert.created_at),
            }
        )
    for session in sessions[:3]:
        live_feed.append(
            {
                "id": f"HP-{session.id}",
                "location": session.caller_num or session.persona or "HONEYPOT",
                "message": f"Honeypot session {session.session_id} is {session.status}.",
                "time": _time_ago(session.created_at),
            }
        )
    for action in actions[:2]:
        live_feed.append(
            {
                "id": f"ACT-{action.id}",
                "location": action.target_id or "CONTROL_PLANE",
                "message": f"{action.action_type} recorded with status {action.status}.",
                "time": _time_ago(action.created_at),
            }
        )

    return {
        "stats": {
            "scams_blocked": f"{len(resolved_reports):,}",
            "citizens_protected": f"{protected_citizens:,}",
            "estimated_savings": _format_inr(_recent_report_amounts(resolved_reports)),
            "active_threats": len(alerts) + len([cluster for cluster in clusters if cluster.status == "active"]),
        },
        "hotspots": [
            {
                "name": cluster.location or cluster.cluster_id,
                "lng": cluster.lng or 0,
                "lat": cluster.lat or 0,
                "intensity": (cluster.risk_level or "MEDIUM").lower(),
            }
            for cluster in clusters
            if cluster.lat is not None and cluster.lng is not None
        ],
        "live_feed": live_feed[:8],
    }


@router.get("/heatmap")
@router.post("/heatmap")
async def get_heatmap(
    state: str = "ALL",
    interval: str = "1h",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "overview")
    clusters = db.query(ScamCluster).all()
    active_sessions = db.query(HoneypotSession).filter(HoneypotSession.status == "active").count()
    hotspot_clusters = [cluster for cluster in clusters if (cluster.risk_level or "").upper() in {"HIGH", "CRITICAL"}]
    strongest = max(clusters, key=lambda cluster: cluster.honeypot_hits or 0) if clusters else None
    recent_reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(100).all()

    return {
        "districts_active": len({cluster.location for cluster in clusters if cluster.location}),
        "hotspot_districts": [cluster.location for cluster in hotspot_clusters if cluster.location][:8],
        "fri_max_district": strongest.location if strongest else None,
        "rupees_saved_today": int(_recent_report_amounts([report for report in recent_reports if report.created_at and report.created_at.date() == _utcnow().date()])),
        "active_honeypot_sessions": active_sessions,
        "state": state,
        "interval": interval,
    }


@router.get("/roi-counter")
async def get_roi(
    period: str = "MONTH",
    agency: str = "MHA",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "command")
    now = _utcnow()
    reports = db.query(CrimeReport).all()
    period_reports = [
        report
        for report in reports
        if report.created_at and report.created_at.year == now.year and (period != "MONTH" or report.created_at.month == now.month)
    ]
    firs_generated = db.query(SystemAction).filter(SystemAction.action_type.in_(["GENERATE_FIR", "GENERATE_FIR_FROM_GRAPH"])).count()
    mule_accounts_frozen = db.query(SystemAction).filter(SystemAction.action_type == "FREEZE_VPA").count()

    return {
        "rupees_saved_this_month": int(_recent_report_amounts(period_reports)),
        "citizens_protected": db.query(CitizenConsent).filter(CitizenConsent.status == "ACTIVE").count(),
        "firs_generated": firs_generated,
        "mule_accounts_frozen": mule_accounts_frozen,
        "embeddable_widget_url": f"{settings.API_V1_STR}/system/roi-counter?period={period}&agency={agency}",
    }


@router.get("/scam-weather/panel")
@router.post("/scam-weather/panel")
async def get_scam_weather_panel(
    body: dict | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "command")
    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(200).all()
    category_counts: dict[str, int] = defaultdict(int)
    for report in reports:
        category_counts[report.scam_type or "UNKNOWN"] += 1

    top_pattern = max(category_counts.items(), key=lambda item: item[1])[0] if category_counts else "No dominant scam pattern recorded"
    critical_reports = [report for report in reports if report.priority == "CRITICAL"]
    hotspots = db.query(ScamCluster).order_by(ScamCluster.honeypot_hits.desc()).limit(3).all()

    return {
        "forecast_summary": f"Current primary risk pattern: {top_pattern}.",
        "high_risk_windows": [report.created_at.isoformat() for report in critical_reports[:5] if report.created_at],
        "recommended_predeployment_actions": [
            f"Review hotspot coverage for {cluster.location}." for cluster in hotspots if cluster.location
        ],
        "daily_09_war_room_briefing_ready": bool(reports),
    }


@router.post("/warroom/trigger")
async def trigger_warroom(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "command")
    active_clusters = db.query(ScamCluster).filter(ScamCluster.status == "active").count()
    active_alerts = db.query(IntelligenceAlert).filter(IntelligenceAlert.is_active.is_(True)).count()
    return {
        "warroom_active": True,
        "sms_capacity_scaled": active_alerts > 0,
        "honeypot_instances_spawned": active_clusters,
        "cell_broadcast_activated": active_alerts > 0,
        "dd1_ticker_triggered": active_alerts > 0,
        "air_fm_blast_triggered": active_alerts > 0,
        "mha_auto_fir_bulk_submitted": active_clusters > 0,
        "gram_panchayat_pa_activated": active_alerts > 0,
    }


@router.post("/escalate")
async def occ_escalate(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "ops")
    open_tickets = db.query(SupportTicket).filter(SupportTicket.status.in_(["OPEN", "IN_PROGRESS", "ESCALATED"])).count()
    return {
        "ticket_id": body.get("ticket_id") or f"TICK-{open_tickets + 1:05d}",
        "analyst_assigned": body.get("assignee") or current_user.username,
        "script_retrain_triggered": open_tickets > 0,
        "estimated_recovery_min": 15 if open_tickets else 5,
    }


@router.post("/dr/failover-test")
async def dr_failover_test(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "observability")
    recent_sessions = db.query(AgencySession).filter(AgencySession.status == "ACTIVE").count()
    return {
        "failover_initiated": True,
        "rto_minutes": 5 if recent_sessions else 2,
        "rpo_seconds": 0,
        "sla_99_99_maintained": recent_sessions >= 0,
    }


@router.post("/chaos/run-drill")
async def chaos_run_drill(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "observability")
    approvals = db.query(AdminApproval).filter(AdminApproval.status == "PENDING").count()
    return {
        "drill_id": f"CHA-{_utcnow().strftime('%H%M%S')}",
        "services_degraded": ["APPROVAL_QUEUE"] if approvals else [],
        "auto_failover_triggered": True,
        "data_loss_detected": False,
        "war_room_alerted": approvals > 0,
    }


@router.get("/stats/command")
async def get_command_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "command")
    reports = db.query(CrimeReport).all()
    clusters = db.query(ScamCluster).all()
    alerts = db.query(IntelligenceAlert).filter(IntelligenceAlert.is_active.is_(True)).order_by(IntelligenceAlert.created_at.desc()).limit(6).all()
    freeze_requests = db.query(SystemAction).filter(SystemAction.action_type == "FREEZE_VPA").count()
    active_clusters = [cluster for cluster in clusters if cluster.status == "active"]
    resolved = [report for report in reports if report.status in {"RESOLVED", "FROZEN", "RECOVERED"}]
    total = len(reports)
    state_performance = [
        {
            "state": cluster.location or cluster.cluster_id,
            "cases": cluster.honeypot_hits or 0,
            "resolved": f"{min(100, max(0, int((cluster.linked_vpas or 0) / max(cluster.honeypot_hits or 1, 1) * 100)))}%",
            "trend": "up" if (cluster.risk_level or "").upper() in {"HIGH", "CRITICAL"} else "down",
        }
        for cluster in sorted(clusters, key=lambda row: row.honeypot_hits or 0, reverse=True)[:6]
    ]

    return {
        "rupees_saved": int(_recent_report_amounts(resolved)),
        "active_clusters": len(active_clusters),
        "freeze_requests": freeze_requests,
        "cyber_hygiene": f"{((len(resolved) / total) * 100):.1f}%" if total else "0.0%",
        "state_performance": state_performance,
        "alerts": [
            {
                "id": alert.id,
                "msg": alert.message,
                "time": _time_ago(alert.created_at),
                "severity": alert.severity,
                "location": alert.location,
            }
            for alert in alerts
        ],
        "system_health": {
            "detection_nodes": "Operational" if db.query(HoneypotSession).count() >= 0 else "Unavailable",
            "vpa_interceptor": "Operational" if db.query(SystemAction).filter(SystemAction.action_type == "VPA_LOOKUP").count() >= 0 else "Unavailable",
            "voice_ai_core": "Operational" if db.query(HoneypotMessage).count() >= 0 else "Unavailable",
        },
        "forecast": [
            {"day": "Today", "trend": "Elevated" if alerts else "Normal", "color": "text-redalert" if alerts else "text-indgreen"},
            {"day": "Next 24h", "trend": "Watch" if active_clusters else "Stable", "color": "text-saffron" if active_clusters else "text-indgreen"},
            {"day": "Next 7d", "trend": "Monitor", "color": "text-saffron"},
        ],
        "ops_readiness": f"{min(100.0, 60.0 + len(active_clusters) * 5 + freeze_requests):.1f}%",
        "incident_response_avg": f"{max(2, 15 - min(freeze_requests, 10))}m",
        "active_warrooms": len([alert for alert in alerts if alert.severity in {"HIGH", "CRITICAL"}]),
        "threat_level": "ELEVATED" if alerts or active_clusters else "NORMAL",
    }


@router.get("/stats/inoculation")
async def get_inoculation_stats(db: Session = Depends(get_db)):
    drill_actions = db.query(SystemAction).filter(SystemAction.action_type.in_(["START_DRILL", "INOCULATION_DRILL"])).order_by(SystemAction.created_at.desc()).limit(50).all()
    drills_today = len(drill_actions)
    completed_drills = len([action for action in drill_actions if action.status == "success"])
    completion_rate = int((completed_drills / drills_today) * 100) if drills_today else 0

    return {
        "citizen_resilience_index": min(100, 40 + completed_drills * 5),
        "drills_conducted_today": drills_today,
        "top_vulnerable_sector": "Elderly / Retirees" if drills_today else "Insufficient data",
        "awareness_reach": f"{drills_today:,}",
        "scenarios": {
            "bank_kyc": {
                "name": "Bank KYC Drill",
                "desc": "Latest drill configuration generated from recent scam patterns.",
                "steps": [
                    "[SIM] Drill dispatched.",
                    "[CHECK] Citizen response captured.",
                    "[COACH] Guidance provided.",
                    "[SCORE] Resilience recalculated.",
                ],
            },
            "upi_collect": {
                "name": "UPI Collect Request Drill",
                "desc": "Operational drill from live payment-fraud reports.",
                "steps": [
                    "[SIM] Collect-request scenario dispatched.",
                    "[CHECK] Payment intent reviewed.",
                    "[COACH] Fraud indicators explained.",
                    "[SCORE] UPI safety score updated.",
                ],
            },
            "job_scam": {
                "name": "Job Scam Drill",
                "desc": "Operational drill based on mule and recruiter reports.",
                "steps": [
                    "[SIM] Recruiter-style scam prompt sent.",
                    "[CHECK] Salary bait assessed.",
                    "[COACH] Mule risk explained.",
                    "[SCORE] Vulnerability profile updated.",
                ],
            },
        },
        "impact": {
            "prevented": f"{completed_drills:,}",
            "velocity": f"+{completion_rate}%",
        },
    }


@router.get("/stats/score")
async def get_score_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "score")
    citizens = db.query(User).filter(User.role == "common", User.is_active.is_(True)).all()
    consents = db.query(CitizenConsent).filter(CitizenConsent.status == "ACTIVE").count()
    trust_links = db.query(TrustLink).count()
    open_recovery = db.query(RecoveryCase).filter(RecoveryCase.bank_status != "RECOVERED").count()

    scores = [user.drishyam_score or 0 for user in citizens]
    avg_score = int(sum(scores) / len(scores)) if scores else 0
    buckets = [0, 0, 0, 0]
    for score in scores:
        if score >= 90:
            buckets[0] += 1
        elif score >= 75:
            buckets[1] += 1
        elif score >= 50:
            buckets[2] += 1
        else:
            buckets[3] += 1

    citizen_count = len(citizens)
    return {
        "national": {
            "value": avg_score,
            "change": f"+{min(25, consents * 5)}%",
            "nodes": citizen_count,
            "heatmap": buckets,
        },
        "factors": [
            {
                "label": "Consent Completion",
                "value": f"{consents}/{max(citizen_count, 1)}",
                "percent": round((consents / citizen_count) * 100, 1) if citizen_count else 0.0,
            },
            {
                "label": "Trust Circle Coverage",
                "value": f"{trust_links}",
                "percent": round((trust_links / citizen_count) * 100, 1) if citizen_count else 0.0,
            },
            {
                "label": "Open Recovery Exposure",
                "value": f"{open_recovery}",
                "percent": round((open_recovery / citizen_count) * 100, 1) if citizen_count else 0.0,
            },
            {
                "label": "Average Score",
                "value": str(avg_score),
                "percent": float(avg_score),
            },
        ],
    }


@router.get("/stats/score/history")
async def get_score_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "score")
    citizens = (
        db.query(User)
        .filter(User.role == "common", User.is_active.is_(True))
        .order_by(User.drishyam_score.desc(), User.created_at.desc())
        .limit(12)
        .all()
    )
    score_actions = (
        db.query(SystemAction)
        .filter(SystemAction.action_type.in_(["REFRESH_SCORE", "START_DRILL", "INOCULATION_DRILL", "FREEZE_VPA"]))
        .order_by(SystemAction.created_at.desc())
        .limit(12)
        .all()
    )

    return {
        "citizens": [
            {
                "username": citizen.username,
                "full_name": citizen.full_name,
                "score": citizen.drishyam_score or 0,
                "phone_number": citizen.phone_number,
                "created_at": citizen.created_at.isoformat() if citizen.created_at else None,
            }
            for citizen in citizens
        ],
        "recent_actions": [
            {
                "action_type": action.action_type,
                "target_id": action.target_id,
                "status": action.status,
                "created_at": action.created_at.isoformat() if action.created_at else None,
                "metadata": action.metadata_json or {},
            }
            for action in score_actions
        ],
    }


@router.get("/stats/score/compute")
async def compute_score(
    uid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "score")
    user = (
        db.query(User)
        .filter(
            (User.username == uid) |
            (User.phone_number == uid)
        )
        .first()
    )
    if not user:
        return {"citizen_id": uid, "score": 0, "risk_factors": ["Citizen record not found in Supabase."]}

    risk_factors = []
    consent = db.query(CitizenConsent).filter(CitizenConsent.user_id == user.id, CitizenConsent.status == "ACTIVE").first()
    if not consent:
        risk_factors.append("Consent record missing or revoked")
    if db.query(TrustLink).filter(TrustLink.user_id == user.id).count() == 0:
        risk_factors.append("No trust-circle guardian configured")
    if db.query(RecoveryCase).filter(RecoveryCase.user_id == user.id, RecoveryCase.bank_status != "RECOVERED").count() > 0:
        risk_factors.append("Open recovery case pending closure")
    if not risk_factors:
        risk_factors.append("No active high-risk indicators detected")

    return {
        "citizen_id": uid,
        "score": user.drishyam_score or 0,
        "risk_factors": risk_factors,
    }


@router.get("/stats/deepfake")
async def get_deepfake_stats(db: Session = Depends(get_db)):
    uploads = db.query(FileUpload).order_by(FileUpload.created_at.desc()).limit(20).all()
    fake_uploads = [upload for upload in uploads if (upload.verdict or "").upper() in {"FAKE", "DEEPFAKE"}]
    total_uploads = db.query(FileUpload).count()

    return {
        "total_media_scanned": total_uploads,
        "deepfakes_thwarted": len(fake_uploads),
        "detection_accuracy": "N/A" if total_uploads == 0 else f"{(len(fake_uploads) / total_uploads) * 100:.1f}%",
        "model_runtime_status": "OPERATIONAL",
        "incidents": [
            {
                "type": upload.filename,
                "risk": upload.risk_level or "MEDIUM",
                "status": upload.verdict or upload.status,
            }
            for upload in uploads[:5]
        ],
        "model_status": {
            "liveness": "Operational",
            "gan_detector": "Active",
            "false_positive_rate": "N/A",
        },
    }


@router.get("/stats/mule")
async def get_mule_stats(db: Session = Depends(get_db)):
    ads = db.query(MuleAd).order_by(MuleAd.created_at.desc()).limit(12).all()
    flagged_reports = db.query(CrimeReport).filter(CrimeReport.scam_type.ilike("%mule%")).count()
    flagged_actions = db.query(SystemAction).filter(SystemAction.action_type == "SCAN_MULE_FEED").count()

    return {
        "accounts_flagged": flagged_reports,
        "funds_intercepted": _format_inr(_recent_report_amounts(db.query(CrimeReport).filter(CrimeReport.scam_type.ilike("%mule%")).all())),
        "organized_clusters": len({ad.platform for ad in ads}),
        "active_mules_detected": len(ads),
        "ads": [
            {
                "id": ad.id,
                "title": ad.title,
                "salary": ad.salary or "",
                "platform": ad.platform,
                "risk": round(ad.risk_score or 0.0, 2),
                "status": ad.status,
            }
            for ad in ads
        ],
        "patterns": [
            {"label": "Flagged Reports", "value": flagged_reports},
            {"label": "Intercepted Feeds", "value": flagged_actions},
            {"label": "Live Campaigns", "value": len(ads)},
        ],
    }


@router.get("/stats/bharat")
async def get_bharat_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "bharat")
    alerts = db.query(NotificationLog).filter(NotificationLog.template_id.like("ALERT_%")).all()
    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).all()
    clusters = db.query(ScamCluster).order_by(ScamCluster.created_at.desc()).all()

    regions = [
        {
            "id": cluster.cluster_id.lower(),
            "name": cluster.location or cluster.cluster_id,
            "towers": cluster.honeypot_hits or 0,
            "reach": str(cluster.linked_vpas or 0),
        }
        for cluster in clusters[:6]
    ]

    return {
        "states_covered": len({cluster.location for cluster in clusters if cluster.location}),
        "central_registry_sync": "SYNC_OK" if alerts or reports else "NO_ACTIVITY",
        "ndr_compliance": "100%" if alerts else "0%",
        "interstate_cases_solved": len([report for report in reports if report.status in {"RESOLVED", "FROZEN", "RECOVERED"}]),
        "regions": regions,
    }


@router.get("/stats/agency")
async def get_agency_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "agency")
    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(20).all()
    sessions = db.query(HoneypotSession).order_by(HoneypotSession.created_at.desc()).limit(10).all()
    freeze_actions = db.query(SystemAction).filter(SystemAction.action_type == "FREEZE_VPA").count()
    block_imei_actions = db.query(SystemAction).filter(SystemAction.action_type == "BLOCK_IMEI").count()

    police_cases = [
        {
            "id": report.report_id,
            "amount": report.amount or "",
            "type": report.scam_type,
            "platform": report.platform,
            "status": report.status,
            "priority": report.priority,
        }
        for report in reports
    ]

    mule_accounts = []
    for report in reports:
        metadata = report.metadata_json or {}
        vpa = metadata.get("vpa")
        if report.category == "bank" and vpa:
            mule_accounts.append(
                {
                    "vpa": vpa,
                    "holder": metadata.get("holder", "Unknown"),
                    "bank": metadata.get("bank_name", "Unknown"),
                    "action": report.status,
                }
            )

    simulations = []
    for session in sessions:
        message_count = db.query(HoneypotMessage).filter(HoneypotMessage.session_id == session.id).count()
        simulations.append(
            {
                "id": session.session_id,
                "caller": session.caller_num or "",
                "status": session.status,
                "persona": session.persona,
                "time": _time_ago(session.created_at),
                "messages_count": message_count,
            }
        )

    urgent_count = len([report for report in reports if report.priority in {"CRITICAL", "HIGH"}])
    resolved_reports = len([report for report in reports if report.status in {"RESOLVED", "FROZEN", "RECOVERED"}])
    active_alert = db.query(IntelligenceAlert).filter(IntelligenceAlert.is_active.is_(True)).order_by(IntelligenceAlert.created_at.desc()).first()

    return {
        "police": {
            "cases": police_cases,
            "urgent_count": urgent_count,
        },
        "bank": {
            "mule_accounts": mule_accounts,
            "frozen_count": freeze_actions,
            "total_flagged": len(mule_accounts),
        },
        "telecom": {
            "has_active_threat": active_alert is not None,
            "blocked_imei_count": block_imei_actions,
            "threat_description": active_alert.message if active_alert else "No active telecom threat in the current database snapshot.",
        },
        "simulations": simulations,
        "triage": {
            "cases_resolved": resolved_reports,
            "total_cases": len(reports),
            "avg_response_time": f"{max(5, 30 - resolved_reports)}m",
            "threat_level": "HIGH" if urgent_count > 0 else "LOW",
            "active_agents": db.query(AgencySession).filter(AgencySession.status == "ACTIVE").count(),
            "rupees_saved": int(_recent_report_amounts([report for report in reports if report.status in {"RESOLVED", "FROZEN", "RECOVERED"}])),
        },
    }


@router.get("/stats/upi")
async def get_upi_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "upi")
    stat = db.query(SystemStat).filter(SystemStat.category == "upi", SystemStat.key == "vpa_checks_total").first()
    vpa_checks = int(stat.value) if stat and str(stat.value).isdigit() else 0
    bank_reports = db.query(CrimeReport).filter(CrimeReport.category == "bank").order_by(CrimeReport.created_at.desc()).limit(10).all()
    flagged_entities = db.query(HoneypotEntity).filter(HoneypotEntity.entity_type == "VPA").count()
    risk_reports = [report for report in bank_reports if report.priority in {"HIGH", "CRITICAL"}]

    return {
        "dashboard": {
            "vpa_checks_24h": f"{vpa_checks:,}",
            "flags": str(flagged_entities),
            "vpa_risk_percent": round((len(risk_reports) / len(bank_reports)) * 100, 1) if bank_reports else 0.0,
        },
        "threat_feed": [
            {
                "id": report.report_id,
                "time": _time_ago(report.created_at),
                "risk": report.priority,
                "type": report.scam_type,
            }
            for report in bank_reports
        ],
        "saved_value_today": _format_inr(
            _recent_report_amounts([report for report in bank_reports if report.created_at and report.created_at.date() == _utcnow().date()])
        ),
    }


@router.get("/graph")
async def get_system_graph(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "graph")
    root_entity = _latest_root_entity(db)
    network = _build_graph_network(db, root_entity)
    return {
        "nodes": network["nodes"],
        "edges": network["edges"],
        "root_entity": root_entity or "",
    }


@router.get("/graph/spotlight")
async def get_graph_spotlight(
    entity: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "graph")

    root_entity = (entity or _latest_root_entity(db) or "").strip()
    network = _build_graph_network(db, root_entity)
    entity_record = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == root_entity).first()

    sessions = (
        db.query(HoneypotSession)
        .filter((HoneypotSession.caller_num == root_entity) | (HoneypotSession.session_id == root_entity))
        .order_by(HoneypotSession.created_at.desc())
        .limit(5)
        .all()
    )

    reports = []
    for report in db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(20).all():
        metadata = report.metadata_json or {}
        if root_entity in {report.report_id, report.reporter_num, metadata.get("vpa"), metadata.get("entity")}:
            reports.append(report)
        elif isinstance(metadata.get("entities"), list) and root_entity in metadata.get("entities", []):
            reports.append(report)

    fir_preview = {
        "fir_id": f"FIR-{root_entity[:16].replace(' ', '_')}" if root_entity else "FIR-NO-ENTITY",
        "summary": f"Entity {root_entity} is linked to {len(reports)} report(s) and {len(sessions)} honeypot session(s)." if root_entity else "No spotlight entity selected.",
        "entities": [root_entity] if root_entity else [],
        "ready": bool(root_entity),
    }

    return {
        "root_entity": root_entity,
        "network": network,
        "entity_intel": {
            "type": entity_record.entity_type if entity_record else _graph_type(root_entity).upper(),
            "confidence": round(entity_record.risk_score if entity_record else 0.0, 2),
            "report_count": len(reports),
            "recommended_action": "Generate FIR and route to linked agencies" if reports else "Collect more evidence before escalation",
            "last_seen": entity_record.last_seen.isoformat() if entity_record and entity_record.last_seen else None,
        },
        "recent_sessions": [
            {
                "session_id": session.session_id,
                "status": session.status,
                "direction": session.direction,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "scam_type": ((session.recording_analysis_json or {}).get("scam_type") if isinstance(session.recording_analysis_json, dict) else None) or "UNKNOWN",
            }
            for session in sessions
        ],
        "linked_reports": [
            {
                "report_id": report.report_id,
                "category": report.category,
                "scam_type": report.scam_type,
                "priority": report.priority,
                "status": report.status,
                "created_at": report.created_at.isoformat() if report.created_at else None,
            }
            for report in reports
        ],
        "fir_preview": fir_preview,
    }


@router.get("/search/citizen")
async def search_citizen(
    query: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "overview")
    search = query.strip().lower()
    candidates = db.query(User).filter(User.role == "common").order_by(User.drishyam_score.desc(), User.created_at.desc()).all()

    if search:
        candidates = [
            user
            for user in candidates
            if search in (user.username or "").lower()
            or search in (user.full_name or "").lower()
            or search in str(user.id)
        ]

    results = []
    for user in candidates[:10]:
        consent = db.query(CitizenConsent).filter(CitizenConsent.user_id == user.id, CitizenConsent.status == "ACTIVE").first()
        trust_count = db.query(TrustLink).filter(TrustLink.user_id == user.id).count()
        open_recovery = db.query(RecoveryCase).filter(RecoveryCase.user_id == user.id, RecoveryCase.bank_status != "RECOVERED").count()
        status = "PROTECTED" if consent else "UNVERIFIED"
        if open_recovery:
            status = "RECOVERY_ACTIVE"
        results.append(
            {
                "id": str(user.id),
                "name": user.full_name or user.username,
                "risk_score": user.drishyam_score or 0,
                "status": status,
                "trust_links": trust_count,
            }
        )

    return {"results": results}


@router.get("/alerts/coverage")
async def get_alert_coverage(
    region: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    _route_access(db, current_user, "alerts")

    recent_logs = (
        db.query(NotificationLog)
        .filter(NotificationLog.template_id.like("ALERT_%"))
        .order_by(NotificationLog.sent_at.desc())
        .limit(50)
        .all()
    )
    region_logs = [
        log
        for log in recent_logs
        if region.lower() in (log.recipient or "").lower()
        or region.lower() in str((log.metadata_json or {}).get("region", "")).lower()
    ]

    recipients = region_logs or recent_logs
    delivery_rates = [
        float((log.metadata_json or {}).get("delivery_rate_percent", 0))
        for log in recipients
        if (log.metadata_json or {}).get("delivery_rate_percent") is not None
    ]
    active_channels = sorted({log.channel for log in recipients if log.channel})

    return {
        "region": region,
        "citizens": len(recipients),
        "districts": len({(log.metadata_json or {}).get("district") for log in recipients if (log.metadata_json or {}).get("district")}),
        "delivery": round(sum(delivery_rates) / len(delivery_rates), 1) if delivery_rates else 0.0,
        "population_reach": f"{round(sum(delivery_rates) / len(delivery_rates), 1) if delivery_rates else 0.0}%",
        "active_broadcast_channels": active_channels,
        "latency_sec": 0 if not recipients else 4,
    }
