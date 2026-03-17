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

@router.get("/scam-weather/panel")
@router.post("/scam-weather/panel")
async def get_scam_weather_panel(body: dict = None, db: Session = Depends(get_db)):
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
    return {
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
        "interstate_cases_solved": 840
    }

@router.get("/stats/agency")
async def get_agency_stats(db: Session = Depends(get_db)):
    return {
        "active_officers": 4200,
        "prosecution_readiness": "68%",
        "court_admissible_evidence_generated": 124,
        "avg_triage_time": "12m"
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
    return {
        "nodes": [
            {"id": "node1", "label": "Scammer Cluster A", "type": "cluster"},
            {"id": "node2", "label": "Mule BP-01", "type": "bank"},
            {"id": "node3", "label": "Victim Node", "type": "citizen"}
        ],
        "edges": [
            {"from": "node1", "to": "node2", "label": "Laundering"},
            {"from": "node1", "to": "node3", "label": "Call Trace"}
        ]
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
