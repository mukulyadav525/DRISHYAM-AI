from typing import Dict
from models.database import CallRecord, DetectionDetail

def calculate_fraud_risk(caller_num: str, metadata: Dict) -> Dict:
    features = []
    base_score = 0.0
    
    # Extract metadata with defaults
    velocity = metadata.get("velocity", 1)
    sim_age = metadata.get("sim_age", 365)
    cli_spoofed = metadata.get("cli_spoofed", False)
    prior_complaints = metadata.get("prior_complaints", 0)
    location = metadata.get("location", "Home")

    # 1. Check Caller Reputation (Simulated)
    if caller_num.startswith("+919000"): 
        features.append({"name": "reputation_match", "value": 1.0, "impact": 0.4})
        base_score += 0.4
        
    # 2. Call Velocity
    if velocity > 50:
        impact = 0.3 if velocity < 100 else 0.5
        features.append({"name": "high_velocity", "value": float(velocity), "impact": impact})
        base_score += impact
        
    # 3. SIM Age & SIM Swap (New SIMs are higher risk)
    if sim_age < 30:
        impact = 0.4 if sim_age < 7 else 0.2
        features.append({"name": "new_sim", "value": float(sim_age), "impact": impact})
        base_score += impact
    
    # Simulated SIM Swap detection (T2B requirement)
    if metadata.get("sim_swap_last_48h", False):
        features.append({"name": "sim_swap_detected", "value": 1.0, "impact": 0.25})
        base_score += 0.25

    # 4. CLI Spoofing
    if cli_spoofed:
        features.append({"name": "cli_spoofing", "value": 1.0, "impact": 0.5})
        base_score += 0.5

    # 5. Prior Complaints
    if prior_complaints > 0:
        # 1 complaint = 0.18, 5 complaints = 0.9
        impact = min(0.95, prior_complaints * 0.18)
        features.append({"name": "prior_complaints", "value": float(prior_complaints), "impact": impact})
        base_score += impact

    # 6. Geographic Anomaly (T2B Requirement)
    # Check if a non-India number (+91) is calling from an India location, or vice-versa
    is_india_num = caller_num.startswith("+91")
    if is_india_num and location == "Overseas":
        features.append({"name": "geographic_anomaly", "value": 1.0, "impact": 0.45})
        base_score += 0.45
    elif not is_india_num and location == "Domestic":
        # International number calling from within India
        features.append({"name": "intl_roaming_anomaly", "value": 1.0, "impact": 0.3})
        base_score += 0.3
        
    # 7. Festival Surge Multiplier (T2B Requirement)
    import datetime
    now = datetime.datetime.now()
    # Mocking Diwali/Festival dates for test
    is_festival = (now.month == 10 or now.month == 11) or metadata.get("is_festival_season", False)
    if is_festival:
        base_score *= 1.2 # 20% surge in risk during festivals
        features.append({"name": "festival_surge", "value": 1.2, "impact": 0.2})

    final_score = max(0.0, min(1.0, base_score))
    
    verdict = "ALLOW"
    if final_score >= 0.85:
        verdict = "ROUTE_TO_HONEYPOT"
    elif final_score >= 0.6:
        verdict = "FLAG_AND_WARN"
    elif final_score >= 0.3:
        verdict = "SUSPICIOUS"
        
    return {
        "score": final_score,
        "verdict": verdict,
        "features": features,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
