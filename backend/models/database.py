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
