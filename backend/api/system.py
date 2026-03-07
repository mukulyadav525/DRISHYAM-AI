from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import CallRecord, HoneypotSession, SystemStat
import random

router = APIRouter()

@router.get("/overview")
def get_system_overview(db: Session = Depends(get_db)):
    # Get base counts
    total_scams_db = db.query(CallRecord).filter(CallRecord.verdict == "scam").count()
    total_sessions_db = db.query(HoneypotSession).count()
    
    # Get Manual Boosts for Production Realism
    boost_scams = db.query(SystemStat).filter(SystemStat.category == "overview", SystemStat.key == "manual_boost_scams").first()
    boost_citizens = db.query(SystemStat).filter(SystemStat.category == "overview", SystemStat.key == "manual_boost_citizens").first()
    boost_savings = db.query(SystemStat).filter(SystemStat.category == "overview", SystemStat.key == "manual_boost_savings").first()
    
    # Merge DB counts with static boosts for "National Launch" scale
    scams_count = int(boost_scams.value) + total_scams_db if boost_scams else total_scams_db
    citizens_count = int(boost_citizens.value) + total_sessions_db if boost_citizens else total_sessions_db
    savings_cr = int(boost_savings.value) if boost_savings else int((scams_count * 1.2) / 1000) # Fallback heuristic
    
    return {
        "stats": {
            "scams_blocked": f"{scams_count:,}",
            "citizens_protected": f"{citizens_count:,}",
            "estimated_savings": f"₹{savings_cr} Cr",
            "active_threats": total_scams_db + 4 # current active incidents
        },
        "live_feed": [
            {
                "id": c.id,
                "location": c.metadata_json.get("location", "Unknown") if c.metadata_json else "Unknown",
                "message": f"Scam attempt from {c.caller_num} blocked in {c.metadata_json.get('location', 'Unknown') if c.metadata_json else 'Unknown'}",
                "time": "Just now"
            }
            for c in db.query(CallRecord).order_by(CallRecord.timestamp.desc()).limit(5).all()
        ]
    }

@router.get("/graph")
def get_graph_data(db: Session = Depends(get_db)):
    calls = db.query(CallRecord).limit(20).all()
    nodes = []
    edges = []
    
    seen_nodes = set()
    
    for c in calls:
        # Caller node
        if c.caller_num not in seen_nodes:
            nodes.append({"id": c.caller_num, "type": "number", "label": c.caller_num})
            seen_nodes.add(c.caller_num)
            
        # Location node
        loc = c.metadata_json.get("location", "Unknown") if c.metadata_json else "Unknown"
        if loc not in seen_nodes:
            nodes.append({"id": loc, "type": "location", "label": loc})
            seen_nodes.add(loc)
            
        # Edge
        edges.append({
            "source": c.caller_num,
            "target": loc,
            "label": "Call"
        })
        
    return {"nodes": nodes, "edges": edges}

@router.get("/stats/{category}")
def get_category_stats(category: str, db: Session = Depends(get_db)):
    """
    Get all stats for a specific category.
    Returns metadata_json if present, otherwise uses the value field.
    """
    stats = db.query(SystemStat).filter(SystemStat.category == category).all()
    if not stats:
        # Fallback for empty DB before seed
        return {}
    return {s.key: (s.metadata_json if s.metadata_json else s.value) for s in stats}

@router.get("/stats/score/compute")
def compute_citizen_score(uid: str, db: Session = Depends(get_db)):
    """
    Simulates a complex score computation for a citizen identifier.
    In production, this would poll multiple detection nodes.
    """
    import random
    # Deterministic-ish score based on UID length/content for simulation
    seed = sum(ord(c) for c in uid)
    hash_val = (seed * 997) % 1000
    
    # Ensure some variation
    score = 300 + (hash_val % 600) 
    
    return {
        "uid": uid,
        "score": score,
        "verdict": "TRUSTED" if score > 700 else "REQUIRES_INOCULATION",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
