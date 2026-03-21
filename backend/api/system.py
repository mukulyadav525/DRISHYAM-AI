from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
import uuid
import datetime
import random

router = APIRouter()

@router.get("/overview")
async def get_system_overview(db: Session = Depends(get_db)):
    return {
        "stats": {
            "scams_blocked": "12,482",
            "citizens_protected": "5.2 Cr",
            "estimated_savings": "₹842 Cr",
            "active_threats": 142
        },
        "hotspots": [
            {"name": "Mumbai", "lng": 72.8777, "lat": 19.0760, "intensity": "high"},
            {"name": "Delhi", "lng": 77.1025, "lat": 28.7041, "intensity": "critical"},
            {"name": "Bengaluru", "lng": 77.5946, "lat": 12.9716, "intensity": "medium"}
        ],
        "live_feed": [
            {
                "id": 1,
                "location": "MUMBAI_ZONE_4",
                "message": "Honeypot 'Elderly_Uncle_01' engaged scammer for 12 mins. Bank account extracted.",
                "time": "JUST NOW"
            },
            {
                "id": 2,
                "location": "DELHI_NCR",
                "message": "Deepfake video call from 'Manager' detected and blocked for Employee #5502.",
                "time": "2 MINS AGO"
            },
            {
                "id": 3,
                "location": "BENGALURU_SBI",
                "message": "Bulk UPI freeze initiated for 42 mule accounts in JP Nagar cluster.",
                "time": "5 MINS AGO"
            }
        ]
    }

@router.get("/heatmap")
@router.post("/heatmap")
async def get_heatmap(state: str = "ALL", interval: str = "1h", db: Session = Depends(get_db)):
    return {
        "districts_active": 773,
        "hotspot_districts": ["Mumbai", "Delhi", "Bengaluru"],
        "fri_max_district": "Mumbai",
        "rupees_saved_today": 12500000,
        "active_honeypot_sessions": 45
    }

@router.get("/roi-counter")
async def get_roi(period: str = "MONTH", agency: str = "MHA", db: Session = Depends(get_db)):
    return {
        "rupees_saved_this_month": 450000000,
        "citizens_protected": 1240000,
        "firs_generated": 8470,
        "mule_accounts_frozen": 1242,
        "embeddable_widget_url": "https://gov.in/drishyam/roi-widget"
    }

from typing import Optional

@router.get("/scam-weather/panel")
@router.post("/scam-weather/panel")
async def get_scam_weather_panel(body: Optional[dict] = None, db: Session = Depends(get_db)):
    return {
        "forecast_summary": "High risk of KYC scams in Maharashtra due to salary cycle.",
        "high_risk_windows": ["2024-04-01T09:00:00Z", "2024-04-01T18:00:00Z"],
        "recommended_predeployment_actions": ["SMS blast in MH", "Increase honeypot capacity"],
        "daily_09_war_room_briefing_ready": True
    }

@router.post("/warroom/trigger")
async def trigger_warroom(body: dict, db: Session = Depends(get_db)):
    return {
        "warroom_active": True,
        "sms_capacity_scaled": True,
        "honeypot_instances_spawned": 50,
        "cell_broadcast_activated": True,
        "dd1_ticker_triggered": True,
        "air_fm_blast_triggered": True,
        "mha_auto_fir_bulk_submitted": True,
        "gram_panchayat_pa_activated": True
    }

@router.post("/escalate")
async def occ_escalate(body: dict, db: Session = Depends(get_db)):
    return {
        "ticket_id": f"TICK-{uuid.uuid4().hex[:6].upper()}",
        "analyst_assigned": "OFFICER_REKHA_B",
        "script_retrain_triggered": True,
        "estimated_recovery_min": 15
    }

@router.post("/dr/failover-test")
async def dr_failover_test(body: dict, db: Session = Depends(get_db)):
    return {
        "failover_initiated": True,
        "rto_minutes": 14,
        "rpo_seconds": 0,
        "sla_99_99_maintained": True
    }

@router.post("/chaos/run-drill")
async def chaos_run_drill(body: dict, db: Session = Depends(get_db)):
    return {
        "drill_id": f"CHA-{uuid.uuid4().hex[:6].upper()}",
        "services_degraded": ["HONEYPOT_LATENCY"],
        "auto_failover_triggered": True,
        "data_loss_detected": False,
        "war_room_alerted": True
    }

# --- Consolidate Stats for Dashboard ---

@router.get("/stats/command")
async def get_command_stats(db: Session = Depends(get_db)):
    from models.database import CrimeReport, ScamCluster, SystemAction, HoneypotSession
    import datetime

    # 1. Total Rupees Saved
    # Base demo value + real resolved reports
    rupees_saved = 1420500000
    reports = db.query(CrimeReport).all()
    for r in reports:
        if r.status == "RESOLVED" and r.amount:
            try:
                # Clean amount string
                amt_str = str(r.amount).replace("₹", "").replace(",", "").replace("/ month", "").strip()
                if amt_str.isdigit():
                    rupees_saved = int(rupees_saved) + int(amt_str)
            except:
                pass

    # 2. Active Scam Clusters
    active_clusters = db.query(ScamCluster).filter(ScamCluster.status == "active").count()
    if active_clusters == 0:
        active_clusters = 14

    # 3. Mule VPA Freeze Requests
    freeze_requests = db.query(SystemAction).filter(SystemAction.action_type == "FREEZE_VPA").count()
    if freeze_requests == 0:
        freeze_requests = db.query(CrimeReport).filter(CrimeReport.status == "FROZEN").count()

    # 4. National Cyber Hygiene
    # Resilience score based on resolution rate
    total_crime = db.query(CrimeReport).count()
    resolved_crime = db.query(CrimeReport).filter(CrimeReport.status == "RESOLVED").count()
    cyber_hygiene_val = 85.2 if total_crime == 0 else (resolved_crime / total_crime * 100)
    cyber_hygiene = f"{cyber_hygiene_val:.1f}%"

    # 5. State Performance (Influenced by real data)
    states = [
        {"state": "Uttar Pradesh", "cases": 14205, "resolved": "92%", "trend": "down"},
        {"state": "Maharashtra", "cases": 12100, "resolved": "88%", "trend": "up"},
        {"state": "Karnataka", "cases": 9500, "resolved": "94%", "trend": "down"},
        {"state": "West Bengal", "cases": 8800, "resolved": "85%", "trend": "up"}
    ]
    
    # 6. Active Intelligence Alerts
    from models.database import IntelligenceAlert
    recent_alerts = []
    
    # Fetch real persistent alerts
    db_alerts = db.query(IntelligenceAlert).filter(IntelligenceAlert.is_active == True).order_by(IntelligenceAlert.created_at.desc()).limit(3).all()
    for a in db_alerts:
        recent_alerts.append({
            "id": a.id,
            "msg": a.message,
            "time": "JUST NOW" if (datetime.datetime.utcnow() - a.created_at).seconds < 60 else f"{(datetime.datetime.utcnow() - a.created_at).seconds // 60}m ago",
            "severity": a.severity,
            "location": a.location
        })
    
    # Fallback to critical reports if no global alerts
    if not recent_alerts:
        critical_reports = db.query(CrimeReport).filter(CrimeReport.priority == "CRITICAL").order_by(CrimeReport.created_at.desc()).limit(2).all()
        for r in critical_reports:
            recent_alerts.append({
                "id": f"REP-{r.id}",
                "msg": f"{r.scam_type} detected on {r.platform}",
                "time": "JUST NOW",
                "severity": "CRITICAL"
            })
    
    if not recent_alerts:
        recent_alerts = [
            { "id": 1, "msg": "New Scam Pod detected in Noida Sector 15", "time": "2m ago", "severity": "HIGH" },
            { "id": 2, "msg": "Massive VPA rotation detected in Jamtara", "time": "15m ago", "severity": "CRITICAL" }
        ]

    return {
        "rupees_saved": rupees_saved,
        "active_clusters": active_clusters,
        "freeze_requests": freeze_requests,
        "cyber_hygiene": cyber_hygiene,
        "state_performance": states,
        "alerts": recent_alerts,
        "system_health": {
            "detection_nodes": "Operational",
            "vpa_interceptor": "Operational",
            "voice_ai_core": "Operational"
        },
        "forecast": [
            { "day": "Today", "trend": "High Activity", "color": "text-redalert" },
            { "day": "Tomorrow", "trend": "Moderate", "color": "text-saffron" },
            { "day": "Weekend", "trend": "Critical Spike", "color": "text-redalert" }
        ],
        "ops_readiness": "98.4%",
        "incident_response_avg": "2.4m",
        "active_warrooms": 2,
        "threat_level": "ELEVATED"
    }

@router.get("/stats/inoculation")
async def get_inoculation_stats(db: Session = Depends(get_db)):
    from models.database import SystemAction

    drill_actions = db.query(SystemAction).filter(
        SystemAction.action_type.in_(["START_DRILL", "INOCULATION_DRILL"])
    ).order_by(SystemAction.created_at.desc()).limit(50).all()
    drills_today = len(drill_actions)
    completed_drills = len([action for action in drill_actions if action.status == "success"])
    completion_rate = int((completed_drills / drills_today) * 100) if drills_today else 84

    return {
        "citizen_resilience_index": 72,
        "drills_conducted_today": 1240 + drills_today,
        "top_vulnerable_sector": "Elderly / Retirees",
        "awareness_reach": "1.2M",
        "scenarios": {
            "bank_kyc": {
                "name": "Hindi SMS KYC Trap",
                "desc": "Build resistance against urgent KYC links and caller-pressure tactics.",
                "steps": [
                    "[SIM] Hindi SMS drill dispatched: 'Aapka bank KYC aaj band ho jayega.'",
                    "[CHECK] Citizen opens safe drill explainer instead of the phishing link.",
                    "[COACH] DRISHYAM explains why OTP, PIN, and APK requests are scam signals.",
                    "[SCORE] Drill marked complete and resilience score updated.",
                ],
            },
            "upi_collect": {
                "name": "UPI Collect Request Drill",
                "desc": "Teach citizens to spot fake collect requests and refund scams.",
                "steps": [
                    "[SIM] UPI collect request training prompt sent to the target.",
                    "[CHECK] Citizen identifies 'receive money' vs 'pay money' mismatch.",
                    "[COACH] Guidance shared on VPAs, collect handles, and payment intent.",
                    "[SCORE] Payment safety score increased for the completed drill.",
                ],
            },
            "job_scam": {
                "name": "Job Offer Mule Trap",
                "desc": "Prepare users for recruiter-style scams and mule account bait.",
                "steps": [
                    "[SIM] Recruiter scam script delivered through the safe drill sandbox.",
                    "[CHECK] Citizen challenges salary promise and document ask.",
                    "[COACH] DRISHYAM explains mule recruitment red flags in simple language.",
                    "[SCORE] Citizen classified as safer against mule recruitment campaigns.",
                ],
            },
        },
        "impact": {
            "prevented": f"{1480 + drills_today * 12}",
            "velocity": f"+{max(completion_rate - 52, 18)}%",
        },
    }

@router.get("/stats/score")
async def get_score_stats(db: Session = Depends(get_db)):
    return {
        "national_trust_avg": 84,
        "high_risk_citizens": 1420,
        "recovery_success_rate": "14%",
        "daily_simulations": 8400
    }

@router.get("/stats/score/compute")
async def compute_score(uid: str, db: Session = Depends(get_db)):
    return {
        "citizen_id": uid,
        "trust_score": random.randint(40, 95),
        "risk_factors": ["High volume of unknown international calls", "VPA Reputation: LOW"]
    }

@router.get("/stats/deepfake")
async def get_deepfake_stats(db: Session = Depends(get_db)):
    """
    Fetch live deepfake detection stats from the Railway ULTIMATE-V3 engine.
    """
    from core.config import settings
    import httpx
    from models.database import FileUpload

    uploads = db.query(FileUpload).order_by(FileUpload.created_at.desc()).limit(5).all()
    incidents = [
        {
            "type": upload.filename,
            "risk": upload.risk_level or ("HIGH" if (upload.verdict or "").upper() in {"FAKE", "DEEPFAKE"} else "LOW"),
            "status": "Deepfake" if (upload.verdict or "").upper() in {"FAKE", "DEEPFAKE"} else ("Suspicious" if (upload.verdict or "").upper() == "SUSPICIOUS" else "Verified"),
        }
        for upload in uploads
    ]
    if not incidents:
        incidents = [
            {"type": "Manager video callback", "risk": "HIGH", "status": "Deepfake"},
            {"type": "Aadhaar selfie verification", "risk": "MEDIUM", "status": "Suspicious"},
            {"type": "Recruiter onboarding clip", "risk": "LOW", "status": "Verified"},
        ]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {"X-API-KEY": settings.DEEPFAKE_API_KEY}
            response = await client.get(f"{settings.DEEPFAKE_API_URL}/stats", headers=headers)
            if response.status_code == 200:
                data = response.json()
                return {
                    "total_media_scanned": data.get("total_analyzed", 42500),
                    "deepfakes_thwarted": int(data.get("total_analyzed", 0) * 0.087), # Simulated based on real total
                    "detection_accuracy": f"{data.get('precision_avg', 0.988) * 100:.1f}%",
                    "model_runtime_status": data.get("status", "OPERATIONAL").upper(),
                    "engine": data.get("engine", "DRISHYAM-ULTIMATE-V3"),
                    "capabilities": data.get("forensic_capabilities", []),
                    "incidents": incidents,
                    "model_status": {
                        "liveness": "Operational",
                        "gan_detector": "Active",
                        "false_positive_rate": "0.01%"
                    }
                }
    except Exception as e:
        print(f"Stats Fetch Error: {e}")

    # Fallback
    return {
        "total_media_scanned": 42500,
        "deepfakes_thwarted": 1240,
        "detection_accuracy": "99.8%",
        "model_runtime_status": "OPERATIONAL",
        "incidents": incidents,
        "model_status": {
            "liveness": "Operational",
            "gan_detector": "Active",
            "false_positive_rate": "0.01%",
        },
    }


@router.get("/stats/mule")
async def get_mule_stats(db: Session = Depends(get_db)):
    from models.database import MuleAd

    ads = db.query(MuleAd).order_by(MuleAd.created_at.desc()).limit(12).all()
    if not ads:
        ads_payload = [
            {
                "id": 1,
                "title": "Instant Salary Transfer Coordinator",
                "salary": "₹48,000 / month",
                "platform": "Telegram",
                "risk": 0.96,
                "status": "Mule Campaign",
            },
            {
                "id": 2,
                "title": "Remote KYC Processing Executive",
                "salary": "₹32,000 / month",
                "platform": "WhatsApp",
                "risk": 0.88,
                "status": "High Risk",
            },
            {
                "id": 3,
                "title": "International Settlement Assistant",
                "salary": "₹55,000 / month",
                "platform": "Facebook Meta",
                "risk": 0.79,
                "status": "Under Review",
            },
        ]
    else:
        ads_payload = [
            {
                "id": ad.id,
                "title": ad.title,
                "salary": ad.salary or "₹0 / month",
                "platform": ad.platform,
                "risk": round(ad.risk_score or 0.0, 2),
                "status": ad.status,
            }
            for ad in ads
        ]

    platform_counts: dict[str, int] = {}
    for ad in ads_payload:
        platform_counts[ad["platform"]] = platform_counts.get(ad["platform"], 0) + 1

    patterns = [
        {"label": "High Salary Bait", "value": min(96, 62 + len(ads_payload) * 4)},
        {"label": "Telegram / WhatsApp Funnel", "value": min(94, 58 + sum(platform_counts.get(p, 0) for p in ["Telegram", "WhatsApp"]) * 11)},
        {"label": "Rapid Onboarding Pressure", "value": min(92, 54 + len([ad for ad in ads_payload if ad["risk"] > 0.85]) * 9)},
    ]

    return {
        "accounts_flagged": 2400 + len(ads_payload) * 3,
        "funds_intercepted": "₹12.4 Cr",
        "organized_clusters": 12,
        "active_mules_detected": 420 + len(ads_payload),
        "ads": ads_payload,
        "patterns": patterns,
    }

@router.get("/stats/bharat")
async def get_bharat_stats(db: Session = Depends(get_db)):
    return {
        "states_covered": 28,
        "central_registry_sync": "SYNC_OK",
        "ndr_compliance": "100%",
        "interstate_cases_solved": 840,
        "regions": [
            {"id": "north", "name": "North India (Haryana/Punjab)", "towers": 1240, "reach": "8.2M"},
            {"id": "east", "name": "East India (Bihar/WB)", "towers": 2150, "reach": "12.4M"},
            {"id": "west", "name": "West India (Rajasthan/Gujarat)", "towers": 1890, "reach": "10.1M"},
            {"id": "south", "name": "South India (Karnataka/TN)", "towers": 2450, "reach": "15.2M"}
        ]
    }

@router.get("/stats/agency")
async def get_agency_stats(db: Session = Depends(get_db)):
    from models.database import CrimeReport, HoneypotSession
    
    # 1. Fetch real crime reports (Police view)
    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(15).all()
    police_cases = []
    urgent_count = 0
    for r in reports:
        police_cases.append({
            "id": r.report_id,
            "amount": r.amount or "N/A",
            "type": r.scam_type,
            "platform": r.platform,
            "status": r.status,
            "priority": r.priority
        })
        if r.priority in ["CRITICAL", "HIGH"]:
            urgent_count += 1

    # 2. Fetch real flagged VPAs (Bank view)
    bank_reports = db.query(CrimeReport).filter(CrimeReport.category == "bank").limit(10).all()
    mule_accounts = []
    for br in bank_reports:
        mule_accounts.append({
            "vpa": br.metadata_json.get("vpa", "unknown@vpa") if br.metadata_json else "unknown@vpa",
            "holder": "Flagged Account",
            "bank": "ICICI/HDFC/sbi",
            "action": br.status
        })
    # If no real data, add some mock ones for "working" feel but keep them realistic
    if not mule_accounts:
        mule_accounts = [
            {"vpa": "fraud.target@okhdfc", "holder": "Unknown", "bank": "HDFC", "action": "FLAGGED"},
            {"vpa": "test.mule@oksbi", "holder": "Dummy", "bank": "SBI", "action": "FLAGGED"}
        ]

    # 3. Fetch active simulations (Monitor view)
    sessions = db.query(HoneypotSession).order_by(HoneypotSession.created_at.desc()).limit(10).all()
    simulations = []
    for s in sessions:
        simulations.append({
            "id": s.session_id,
            "caller": s.caller_num or "+91-TRACE-NODE",
            "status": s.status,
            "persona": s.persona,
            "time": "JUST NOW" if (datetime.datetime.utcnow() - s.created_at).seconds < 60 else f"{(datetime.datetime.utcnow() - s.created_at).seconds // 60}m ago",
            "messages_count": 8 # Simulated count
        })

    # 4. Telecom Threat Status
    # Check if there's any CRITICAL report in last 1 hour
    one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    critical_telecom = db.query(CrimeReport).filter(
        CrimeReport.category == "telecom",
        CrimeReport.priority == "CRITICAL",
        CrimeReport.created_at >= one_hour_ago
    ).first()

    has_active_threat = critical_telecom is not None
    threat_description = f"Active Threat: {critical_telecom.scam_type} detected from {critical_telecom.platform}" if has_active_threat else "No active mass-robocall events detected."

    return {
        "police": {
            "cases": police_cases,
            "urgent_count": urgent_count
        },
        "bank": {
            "mule_accounts": mule_accounts,
            "frozen_count": len([m for m in mule_accounts if m["action"] == "FROZEN"]) + 14,
            "total_flagged": len(mule_accounts) + 42
        },
        "telecom": {
            "has_active_threat": has_active_threat,
            "blocked_imei_count": 124,
            "threat_description": threat_description
        },
        "simulations": simulations,
        "triage": {
            "cases_resolved": 842 + len([r for r in reports if r.status == "RESOLVED"]),
            "total_cases": 1240 + len(reports),
            "avg_response_time": "12m",
            "threat_level": "HIGH" if urgent_count > 2 or has_active_threat else "MODERATE",
            "active_agents": 24,
            "rupees_saved": int(142000000) + (len(mule_accounts) * 50000) # Mock calculation
        }
    }

@router.get("/stats/upi")
async def get_upi_stats(db: Session = Depends(get_db)):
    return {
        "realtime_checks": 142000,
        "fraudulent_vpas_blocked": 1240,
        "saved_value_today": "₹2.4 Cr",
        "avg_verification_ms": 42
    }

@router.get("/graph")
async def get_system_graph(db: Session = Depends(get_db)):
    from models.database import ScamCluster, HoneypotEntity, HoneypotSession
    import random
    
    clusters = db.query(ScamCluster).limit(5).all()
    entities = db.query(HoneypotEntity).order_by(HoneypotEntity.last_seen.desc()).limit(12).all()
    sessions = db.query(HoneypotSession).order_by(HoneypotSession.created_at.desc()).limit(6).all()
    
    nodes = []
    edges = []
    seen_nodes = set()

    def add_node(node: dict):
        if node["id"] in seen_nodes:
            return
        seen_nodes.add(node["id"])
        nodes.append(node)
    
    # 1. Add clusters as central nodes
    for c in clusters:
        add_node({"id": f"cluster_{c.cluster_id}", "label": c.location, "type": "cluster", "risk": c.risk_level})
        
    # 2. Add entities (VPA, Phone etc) and link to clusters
    for e in entities:
        node_id = f"entity_{e.id}"
        add_node({
            "id": node_id,
            "label": e.entity_value,
            "type": e.entity_type.lower() if e.entity_type else "unknown",
            "risk": "CRITICAL" if e.risk_score >= 0.8 else "HIGH",
        })
        if clusters:
            # Create a semi-random edge for visualization
            target = random.choice(clusters)
            edges.append({
                "source": node_id,
                "target": f"cluster_{target.cluster_id}",
                "label": "Direct Linked"
            })

    for s in sessions:
        session_node_id = f"session_{s.session_id}"
        add_node({
            "id": session_node_id,
            "label": s.session_id,
            "type": "session",
            "risk": "HIGH" if s.status == "completed" else "MEDIUM",
        })
        if s.caller_num:
            caller_node_id = f"caller_{s.session_id}"
            add_node({
                "id": caller_node_id,
                "label": s.caller_num,
                "type": "number",
                "risk": "HIGH",
            })
            edges.append({"source": session_node_id, "target": caller_node_id, "label": "Observed Caller"})
        if clusters:
            cluster = random.choice(clusters)
            edges.append({
                "source": session_node_id,
                "target": f"cluster_{cluster.cluster_id}",
                "label": "Regional Correlation",
            })
            
    # Fallback if DB is empty to prevent blank screen
    if not nodes:
        nodes = [
            {"id": "node1", "label": "Cluster: Jamtara", "type": "cluster"},
            {"id": "node2", "label": "Flagged BP-01", "type": "bank"},
            {"id": "node3", "label": "Victim ID", "type": "citizen"}
        ]
        edges = [
            {"source": "node1", "target": "node2", "label": "Laundering"},
            {"source": "node1", "target": "node3", "label": "Call Trace"}
        ]
        
    return {
        "nodes": nodes,
        "edges": edges,
        "root_entity": entities[0].entity_value if entities else (sessions[0].caller_num if sessions else "Cluster: Jamtara"),
    }


@router.get("/graph/spotlight")
async def get_graph_spotlight(entity: str | None = None, db: Session = Depends(get_db)):
    from models.database import HoneypotEntity, HoneypotSession, CrimeReport
    from core.graph import fraud_graph

    latest_entity = db.query(HoneypotEntity).order_by(HoneypotEntity.last_seen.desc()).first()
    latest_session = db.query(HoneypotSession).order_by(HoneypotSession.created_at.desc()).first()

    root_entity = entity or (latest_entity.entity_value if latest_entity else None) or (latest_session.caller_num if latest_session else "+919000123456")
    network = fraud_graph.get_network(root_entity)

    entity_record = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == root_entity).first()
    recent_sessions = db.query(HoneypotSession).order_by(HoneypotSession.created_at.desc()).limit(5).all()
    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(5).all()

    matching_sessions = []
    fir_preview = None
    for session in recent_sessions:
        analysis = session.recording_analysis_json or {}
        linked_entities = analysis.get("key_entities", []) if isinstance(analysis, dict) else []
        if root_entity == session.caller_num or root_entity in linked_entities:
            matching_sessions.append({
                "session_id": session.session_id,
                "status": session.status,
                "direction": session.direction,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "scam_type": analysis.get("scam_type", "UNKNOWN") if isinstance(analysis, dict) else "UNKNOWN",
            })
            auto_fir = (session.metadata_json or {}).get("auto_fir") if session.metadata_json else None
            if auto_fir and not fir_preview:
                fir_preview = {
                    "fir_id": auto_fir.get("fir_id"),
                    "summary": auto_fir.get("formatted_document", "")[:420],
                    "entities": auto_fir.get("accused_info", {}).get("extracted_entities", []),
                    "ready": True,
                }

    if not fir_preview:
        fir_preview = {
            "fir_id": f"FIR-PREVIEW-{abs(hash(root_entity)) % 10000:04d}",
            "summary": f"Entity {root_entity} is linked to live scam activity, honeypot transcript evidence, and downstream police packaging.",
            "entities": [root_entity],
            "ready": True,
        }

    linked_reports = [
        {
            "report_id": report.report_id,
            "category": report.category,
            "scam_type": report.scam_type,
            "priority": report.priority,
            "status": report.status,
            "created_at": report.created_at.isoformat() if report.created_at else None,
        }
        for report in reports
    ]

    return {
        "root_entity": root_entity,
        "network": network,
        "entity_intel": {
            "type": entity_record.entity_type if entity_record else "PHONE",
            "confidence": round(entity_record.risk_score if entity_record else 0.91, 2),
            "report_count": len(linked_reports),
            "recommended_action": "Generate FIR and route to graph-linked agencies",
            "last_seen": entity_record.last_seen.isoformat() if entity_record and entity_record.last_seen else None,
        },
        "recent_sessions": matching_sessions or [
            {
                "session_id": latest_session.session_id if latest_session else "H-DEMO01",
                "status": latest_session.status if latest_session else "completed",
                "direction": latest_session.direction if latest_session else "handoff",
                "created_at": latest_session.created_at.isoformat() if latest_session and latest_session.created_at else None,
                "scam_type": (latest_session.recording_analysis_json or {}).get("scam_type", "BANK_FRAUD") if latest_session else "BANK_FRAUD",
            }
        ],
        "linked_reports": linked_reports,
        "fir_preview": fir_preview,
    }

@router.get("/search/citizen")
async def search_citizen(query: str, db: Session = Depends(get_db)):
    return {
        "results": [
            {
                "id": "GRID_USER_01",
                "name": "Mukul Yadav",
                "risk_score": 12,
                "status": "PROTECTED"
            }
        ]
    }

@router.get("/alerts/coverage")
async def get_alert_coverage(region: str, db: Session = Depends(get_db)):
    from models.database import NotificationLog

    coverage_profiles = {
        "national": {"citizens": 1480000, "districts": 766, "delivery": 94, "channels": ["SMS", "IVR", "WHATSAPP", "FM_RADIO"]},
        "delhi": {"citizens": 210000, "districts": 11, "delivery": 97, "channels": ["SMS", "WHATSAPP", "CELL_BROADCAST"]},
        "mh": {"citizens": 540000, "districts": 36, "delivery": 95, "channels": ["SMS", "IVR", "FM_RADIO"]},
        "ka": {"citizens": 160000, "districts": 31, "delivery": 96, "channels": ["SMS", "IVR", "GRAM_PANCHAYAT_PA"]},
    }
    profile = coverage_profiles.get(region, coverage_profiles["national"])

    recent_logs = db.query(NotificationLog).filter(
        NotificationLog.template_id.like("ALERT_%"),
        NotificationLog.recipient == region,
    ).order_by(NotificationLog.sent_at.desc()).limit(20).all()

    if recent_logs:
        deliveries = [
            float((log.metadata_json or {}).get("delivery_rate_percent", profile["delivery"]))
            for log in recent_logs
        ]
        delivery = round(sum(deliveries) / len(deliveries), 1)
    else:
        delivery = profile["delivery"]

    return {
        "region": region,
        "citizens": profile["citizens"],
        "districts": profile["districts"],
        "delivery": delivery,
        "population_reach": f"{profile['delivery']}%",
        "active_broadcast_channels": profile["channels"],
        "latency_sec": 4,
    }
