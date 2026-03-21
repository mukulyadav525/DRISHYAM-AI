from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime
import enum

Base = declarative_base()

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    BANK = "bank"
    POLICE = "police"
    COMMON = "common"
    GOVERNMENT = "government"
    TELECOM = "telecom"
    COURT = "court"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default=UserRole.COMMON.value)
    is_active = Column(Boolean, default=True)
    drishyam_score = Column(Integer, default=100) # [AC-M7-05] Fraud Immunity Score
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class CallRecord(Base):
    __tablename__ = "call_records"

    id = Column(Integer, primary_key=True, index=True)
    caller_num = Column(String, index=True)
    receiver_num = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    duration = Column(Integer)  # In seconds
    call_type = Column(String)  # 'incoming', 'outgoing'
    
    # Metadata for scoring
    metadata_json = Column(JSON)  # { 'location': '...', 'imei': '...', 'sim_age': '...' }
    
    # Results
    fraud_risk_score = Column(Float)
    verdict = Column(String)  # 'safe', 'suspicious', 'scam'
    
    # Relationships
    detection_details = relationship("DetectionDetail", back_populates="call")

class DetectionDetail(Base):
    __tablename__ = "detection_details"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("call_records.id"))
    feature_name = Column(String)  # e.g., 'velocity', 'geographic_anomaly'
    feature_value = Column(Float)
    impact_score = Column(Float)  # Contribution to total fraud_risk_score

    call = relationship("CallRecord", back_populates="detection_details")

class SuspiciousNumber(Base):
    __tablename__ = "suspicious_numbers"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True)
    reputation_score = Column(Float, default=0.0)
    category = Column(String)  # 'banking_scam', 'job_scam', etc.
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)
    report_count = Column(Integer, default=0)

class HoneypotSession(Base):
    __tablename__ = "honeypot_sessions"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    caller_num = Column(String)
    customer_id = Column(String, index=True, nullable=True)
    persona = Column(String) # e.g., "Elderly Uncle"
    status = Column(String, default="active") # active, completed
    direction = Column(String, default="outgoing") # incoming, outgoing, handoff
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    handoff_timestamp = Column(DateTime, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    recording_analysis_json = Column(JSON, nullable=True)
    
    user = relationship("User", backref="honeypot_sessions")
    messages = relationship("HoneypotMessage", back_populates="session")

class HoneypotMessage(Base):
    __tablename__ = "honeypot_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("honeypot_sessions.id"))
    role = Column(String) # user, assistant
    content = Column(String)
    audio_url = Column(String, nullable=True) # Path to recorded audio turn
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("HoneypotSession", back_populates="messages")

class SystemStat(Base):
    __tablename__ = "system_stats"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True) # e.g., 'mule', 'deepfake', 'upi'
    key = Column(String, index=True)
    value = Column(String)
    metadata_json = Column(JSON)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class SystemAction(Base):
    __tablename__ = "system_actions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action_type = Column(String, nullable=False)
    target_id = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    status = Column(String, default="success")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class HoneypotPersona(Base):
    __tablename__ = "honeypot_personas"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    language = Column(String)
    speaker = Column(String)
    pace = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ScamCluster(Base):
    __tablename__ = "scam_clusters"
    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(String, unique=True, index=True)
    risk_level = Column(String) # CRITICAL, HIGH, MEDIUM
    location = Column(String)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    linked_vpas = Column(Integer, default=0)
    honeypot_hits = Column(Integer, default=0)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SimulationRequest(Base):
    __tablename__ = "simulation_requests"
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True)
    status = Column(String, default="pending") # pending, approved, rejected
    requested_at = Column(DateTime, default=datetime.datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

class MuleAd(Base):
    __tablename__ = "mule_ads"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    salary = Column(String, nullable=True)
    platform = Column(String)
    risk_score = Column(Float, default=0.0)
    status = Column(String)
    recruiter_id = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class HoneypotEntity(Base):
    __tablename__ = "honeypot_entities"
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String) # "VPA", "PHONE", "ACCOUNT"
    entity_value = Column(String, unique=True, index=True)
    first_seen = Column(DateTime, default=datetime.datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    risk_score = Column(Float, default=0.5)


class CrimeReport(Base):
    __tablename__ = "crime_reports"
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String, unique=True, index=True) # e.g., REQ-5001
    category = Column(String) # police, bank, telecom
    scam_type = Column(String)
    amount = Column(String, nullable=True)
    platform = Column(String)
    priority = Column(String) # CRITICAL, HIGH, MEDIUM
    status = Column(String, default="PENDING") # PENDING, RESOLVED, DISMISSED
    reporter_num = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class FileUpload(Base):
    __tablename__ = "file_uploads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    status = Column(String, default="PENDING") # PENDING, PROCESSING, COMPLETED, FAILED
    
    # Analysis Results
    verdict = Column(String)  # 'REAL', 'SUSPICIOUS', 'FAKE'
    confidence_score = Column(Float)
    risk_level = Column(String) # 'LOW', 'MEDIUM', 'HIGH'
    
    metadata_json = Column(JSON) # Detailed analysis results
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", backref="uploads")
class TrustLink(Base):
    __tablename__ = "trust_links"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    guardian_name = Column(String)
    guardian_phone = Column(String)
    guardian_email = Column(String, nullable=True)
    relation_type = Column(String) # e.g., "Son", "Daughter"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", backref="trust_circle")
    
class BankNodeRule(Base):
    __tablename__ = "bank_node_rules"
    id = Column(Integer, primary_key=True, index=True)
    bank_name = Column(String, index=True)
    rule_type = Column(String) # e.g., "AMOUNT_THRESHOLD", "VELOCITY"
    threshold = Column(Float)
    action = Column(String) # e.g., "FREEZE", "FLAG"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SystemAuditLog(Base):
    __tablename__ = "system_audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, index=True) # e.g., "ACCESS_PII", "LOGIN", "EXPORT_GRAPH"
    resource = Column(String) # e.g., "CrimeReport-501", "FraudGraph"
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    metadata_json = Column(JSON, nullable=True)

class CitizenConsent(Base):
    __tablename__ = "citizen_consents"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    phone_number = Column(String, index=True, nullable=False)
    status = Column(String, default="ACTIVE", index=True) # ACTIVE, REVOKED
    channel = Column(String, default="SIMULATION_PORTAL")
    policy_version = Column(String, default="MVP-2026.03")
    scopes_json = Column(JSON, nullable=False, default=dict)
    metadata_json = Column(JSON, nullable=True)
    given_at = Column(DateTime, default=datetime.datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class NotificationLog(Base):
    __tablename__ = "notification_logs"
    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String, index=True)
    channel = Column(String) # "SMS", "WHATSAPP", "EMAIL"
    template_id = Column(String)
    status = Column(String) # "SENT", "DELIVERED", "FAILED"
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)
    metadata_json = Column(JSON, nullable=True)

class RecoveryCase(Base) :
    __tablename__ = "recovery_cases"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    incident_id = Column(String, unique=True, index=True)
    bank_status = Column(String, default="PENDING") # PENDING, INVESTIGATING, FROZEN, RECOVERED
    rbi_status = Column(String, default="NOT_STARTED")
    insurance_status = Column(String, default="NOT_STARTED")
    legal_aid_status = Column(String, default="NOT_STARTED")
    total_recovered = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class IntelligenceAlert(Base):
    __tablename__ = "intelligence_alerts"
    id = Column(Integer, primary_key=True, index=True)
    severity = Column(String) # CRITICAL, HIGH, MEDIUM
    message = Column(String)
    location = Column(String, nullable=True)
    category = Column(String) # e.g., "VPA_ROTATION", "SCAM_POD"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PilotProgram(Base):
    __tablename__ = "pilot_programs"
    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    geography = Column(String, nullable=True)
    telecom_partner = Column(String, nullable=True)
    bank_partners_json = Column(JSON, nullable=True)
    agencies_json = Column(JSON, nullable=True)
    languages_json = Column(JSON, nullable=True)
    scam_categories_json = Column(JSON, nullable=True)
    dashboard_scope_json = Column(JSON, nullable=True)
    success_metrics_json = Column(JSON, nullable=True)
    training_status_json = Column(JSON, nullable=True)
    communications_json = Column(JSON, nullable=True)
    outcome_summary_json = Column(JSON, nullable=True)
    launch_status = Column(String, default="CONFIGURING")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class PilotFeedback(Base):
    __tablename__ = "pilot_feedback"
    id = Column(Integer, primary_key=True, index=True)
    pilot_program_id = Column(Integer, ForeignKey("pilot_programs.id"), nullable=True, index=True)
    stakeholder_type = Column(String, nullable=False)
    source_agency = Column(String, nullable=True)
    sentiment = Column(String, default="NEUTRAL")
    message = Column(String, nullable=False)
    status = Column(String, default="OPEN")
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class PartnerPipeline(Base):
    __tablename__ = "partner_pipeline"
    id = Column(Integer, primary_key=True, index=True)
    account_name = Column(String, nullable=False, index=True)
    segment = Column(String, nullable=False, index=True)  # B2G, BANK, TELECOM, ENTERPRISE, SME, INSURER
    stage = Column(String, nullable=False, default="LEAD", index=True)  # LEAD, DISCOVERY, PROPOSAL, PROCUREMENT, PILOT, ACTIVE
    owner = Column(String, nullable=False)
    annual_value_inr = Column(Float, default=0.0)
    status = Column(String, default="OPEN", index=True)  # OPEN, WON, LOST, ON_HOLD
    next_step = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class BillingRecord(Base):
    __tablename__ = "billing_records"
    id = Column(Integer, primary_key=True, index=True)
    partner_name = Column(String, nullable=False, index=True)
    plan_name = Column(String, nullable=False)
    invoice_number = Column(String, unique=True, nullable=False, index=True)
    amount_inr = Column(Float, default=0.0)
    tax_inr = Column(Float, default=0.0)
    billing_status = Column(String, default="DRAFT", index=True)  # DRAFT, ISSUED, PAID, OVERDUE
    subscription_status = Column(String, default="ACTIVE", index=True)  # ACTIVE, TRIAL, EXPIRING, CANCELLED
    billing_cycle = Column(String, default="MONTHLY")  # MONTHLY, QUARTERLY, YEARLY
    due_date = Column(DateTime, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, unique=True, nullable=False, index=True)
    channel = Column(String, nullable=False)
    stakeholder_type = Column(String, nullable=False, index=True)
    severity = Column(String, default="MEDIUM", index=True)
    incident_classification = Column(String, nullable=False, index=True)
    queue_name = Column(String, nullable=False, index=True)
    status = Column(String, default="OPEN", index=True)  # OPEN, IN_PROGRESS, ESCALATED, RESOLVED
    owner = Column(String, nullable=True)
    resolution_eta_min = Column(Integer, default=60)
    summary = Column(String, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class GovernanceReview(Base):
    __tablename__ = "governance_reviews"
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(String, unique=True, nullable=False, index=True)
    board_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    cadence = Column(String, default="MONTHLY")
    status = Column(String, default="SCHEDULED", index=True)  # SCHEDULED, COMPLETE
    next_review_at = Column(DateTime, nullable=True)
    outcome_summary = Column(String, nullable=True)
    recommendations_json = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class PartnerIntegrationStatus(Base):
    __tablename__ = "partner_integrations"
    id = Column(Integer, primary_key=True, index=True)
    partner_name = Column(String, unique=True, nullable=False, index=True)
    segment = Column(String, nullable=False, index=True)
    owner = Column(String, nullable=False)
    region_scope = Column(String, default="INDIA", index=True)
    mou_status = Column(String, default="DRAFT", index=True)
    sandbox_access_status = Column(String, default="REQUESTED", index=True)
    production_access_status = Column(String, default="PLANNED", index=True)
    api_access_status = Column(String, default="PENDING", index=True)
    credential_status = Column(String, default="NOT_ISSUED", index=True)
    sla_status = Column(String, default="IN_NEGOTIATION", index=True)
    escalation_contact = Column(String, nullable=True)
    next_milestone = Column(String, nullable=True)
    status = Column(String, default="ON_TRACK", index=True)  # ON_TRACK, AT_RISK, BLOCKED, LIVE
    last_checked_at = Column(DateTime, default=datetime.datetime.utcnow)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AgencyAccessPolicy(Base):
    __tablename__ = "agency_access_policies"
    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    role_scope = Column(String, nullable=False, index=True)
    resource_scope = Column(String, default="*", index=True)
    action_scope = Column(String, default="*", index=True)
    region_scope = Column(String, default="*", index=True)
    effect = Column(String, default="ALLOW", index=True)  # ALLOW, DENY
    active = Column(Boolean, default=True, index=True)
    conditions_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AgencySession(Base):
    __tablename__ = "agency_sessions"
    id = Column(Integer, primary_key=True, index=True)
    session_uid = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    device_label = Column(String, nullable=False)
    device_type = Column(String, default="WEB", index=True)
    ip_address = Column(String, nullable=True)
    network_zone = Column(String, nullable=True)
    auth_stage = Column(String, default="PASSWORD_ONLY", index=True)  # PASSWORD_ONLY, MFA_VERIFIED
    risk_level = Column(String, default="LOW", index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String, default="ACTIVE", index=True)  # ACTIVE, REVOKED, EXPIRED
    last_seen_at = Column(DateTime, default=datetime.datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AdminApproval(Base):
    __tablename__ = "admin_approvals"
    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(String, unique=True, nullable=False, index=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    approver_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action_type = Column(String, nullable=False, index=True)
    resource = Column(String, nullable=False, index=True)
    risk_level = Column(String, default="HIGH", index=True)
    justification = Column(String, nullable=False)
    status = Column(String, default="PENDING", index=True)  # PENDING, APPROVED, REJECTED, EXECUTED, EXPIRED
    expires_at = Column(DateTime, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class NPCILog(Base):
    __tablename__ = "npci_logs"
    id = Column(Integer, primary_key=True, index=True)
    vpa = Column(String, index=True)
    action = Column(String) # VERIFY, BLOCK, DISPUTE
    status_code = Column(String) # NPCI Response Codes (00, 91, etc.)
    message = Column(String, nullable=True)
    reference_id = Column(String, unique=True, index=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Note: For PII Encryption (AC-M9-04), use the cryptography.fernet based hybrid approach 
# in the API layer or as a custom SQLAlchemy TypeDecorator if time permits.
# Current implementation uses plain strings for MVP but requires ciphertexts in production.
