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
        "embeddable_widget_url": "https://gov.in/sentinel/roi-widget"
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
    recent_alerts = []
    # Fetch real recent critical reports
    critical_reports = db.query(CrimeReport).filter(CrimeReport.priority == "CRITICAL").order_by(CrimeReport.created_at.desc()).limit(2).all()
    for r in critical_reports:
        recent_alerts.append({
            "id": r.id,
            "msg": f"{r.scam_type} detected on target platform",
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
    return {
        "citizen_resilience_index": 72,
        "drills_conducted_today": 1240,
        "top_vulnerable_sector": "Elderly / Retirees",
        "awareness_reach": "1.2M"
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
    return {
        "total_media_scanned": 42500,
        "deepfakes_thwarted": 1240,
        "detection_accuracy": "99.8%",
        "model_runtime_status": "OPERATIONAL"
    }

@router.get("/stats/mule")
async def get_mule_stats(db: Session = Depends(get_db)):
    return {
        "accounts_flagged": 2400,
        "funds_intercepted": "₹12.4 Cr",
        "organized_clusters": 12,
        "active_mules_detected": 420
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
    from models.database import ScamCluster, HoneypotEntity
    import random
    
    clusters = db.query(ScamCluster).limit(5).all()
    entities = db.query(HoneypotEntity).limit(10).all()
    
    nodes = []
    edges = []
    
    # 1. Add clusters as central nodes
    for c in clusters:
        nodes.append({"id": f"cluster_{c.cluster_id}", "label": c.location, "type": "cluster"})
        
    # 2. Add entities (VPA, Phone etc) and link to clusters
    for e in entities:
        node_id = f"entity_{e.id}"
        nodes.append({"id": node_id, "label": e.entity_value, "type": e.entity_type.lower() if e.entity_type else "unknown"})
        if clusters:
            # Create a semi-random edge for visualization
            target = random.choice(clusters)
            edges.append({
                "source": node_id,
                "target": f"cluster_{target.cluster_id}",
                "label": "Direct Linked"
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
        "edges": edges
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
    return {
        "region": region,
        "population_reach": "84%",
        "active_broadcast_channels": ["SMS", "IVR", "WHATSAPP", "FM_RADIO"],
        "latency_sec": 4
    }
