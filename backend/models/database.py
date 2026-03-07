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
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default=UserRole.COMMON.value)
    is_active = Column(Boolean, default=True)
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
    caller_num = Column(String)
    customer_id = Column(String, index=True, nullable=True)
    persona = Column(String) # e.g., "Elderly Uncle"
    status = Column(String, default="active") # active, completed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    messages = relationship("HoneypotMessage", back_populates="session")

class HoneypotMessage(Base):
    __tablename__ = "honeypot_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("honeypot_sessions.id"))
    role = Column(String) # user, assistant
    content = Column(String)
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
