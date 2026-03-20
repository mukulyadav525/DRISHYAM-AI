-- ============================================================
-- DRISHYAM AI — MASTER CONSOLIDATED SCHEMA & SEED
-- Version: 4.0 (Final Comprehensive)
-- Description: One-stop SQL script for Supabase Database Setup.
-- Includes: Schema, RBAC, RLS Policies, and Demo Data.
-- ============================================================

-- I. CLEANUP (IDEMPOTENT)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS system_actions CASCADE;
DROP TABLE IF EXISTS detection_details CASCADE;
DROP TABLE IF EXISTS call_records CASCADE;
DROP TABLE IF EXISTS suspicious_numbers CASCADE;
DROP TABLE IF EXISTS honeypot_messages CASCADE;
DROP TABLE IF EXISTS honeypot_sessions CASCADE;
DROP TABLE IF EXISTS honeypot_personas CASCADE;
DROP TABLE IF EXISTS scam_clusters CASCADE;
DROP TABLE IF EXISTS simulation_requests CASCADE;
DROP TABLE IF EXISTS mule_ads CASCADE;
DROP TABLE IF EXISTS crime_reports CASCADE;
DROP TABLE IF EXISTS system_stats CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- II. SCHEMA DEFINITION
-- ------------------------------------------------------------

-- 1. Users & RBAC
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR,
    role VARCHAR NOT NULL DEFAULT 'common',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX ix_users_username ON users (username);
CREATE INDEX ix_users_email ON users (email);

-- 2. Call Records
CREATE TABLE call_records (
    id SERIAL PRIMARY KEY,
    caller_num TEXT NOT NULL,
    receiver_num TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration INTEGER,
    call_type TEXT, -- 'incoming', 'outgoing'
    metadata_json JSONB,
    fraud_risk_score FLOAT,
    verdict TEXT -- 'scam', 'safe', 'suspicious'
);
CREATE INDEX idx_call_records_caller ON call_records(caller_num);

-- 3. Detection Details
CREATE TABLE detection_details (
    id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES call_records(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    feature_value FLOAT,
    impact_score FLOAT
);

-- 4. Suspicious Numbers Registry
CREATE TABLE suspicious_numbers (
    id SERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    reputation_score FLOAT DEFAULT 0.0,
    category TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    report_count INTEGER DEFAULT 0
);
CREATE INDEX idx_suspicious_numbers_phone ON suspicious_numbers(phone_number);

-- 5. Honeypot Personas
CREATE TABLE honeypot_personas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE,
    language VARCHAR(50),
    speaker VARCHAR(50),
    pace FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Honeypot Sessions
CREATE TABLE honeypot_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    caller_num TEXT,
    customer_id TEXT, -- Added for citizen attribution
    persona TEXT,
    status TEXT DEFAULT 'active',
    handoff_timestamp TIMESTAMPTZ,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_honeypot_sessions_sid ON honeypot_sessions(session_id);

-- 7. Honeypot Messages
CREATE TABLE honeypot_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES honeypot_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL,
    audio_url TEXT, -- Added for Deepgram recording storage
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 8. System Stats (Unified Data Store for Dashboard)
CREATE TABLE system_stats (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    metadata_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_system_stats_cat_key ON system_stats(category, key);

-- 9. System Actions Audit Log
CREATE TABLE system_actions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL, -- 'BLOCK', 'FREEZE', 'FLAG', etc.
    target_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'success',
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Scam Clusters
CREATE TABLE scam_clusters (
    id SERIAL PRIMARY KEY,
    cluster_id VARCHAR(50) UNIQUE,
    risk_level VARCHAR(20),
    location VARCHAR(100),
    lat FLOAT,
    lng FLOAT,
    linked_vpas INTEGER DEFAULT 0,
    honeypot_hits INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Simulation Requests
CREATE TABLE simulation_requests (
    id SERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 12. Mule Advertisements
CREATE TABLE mule_ads (
    id SERIAL PRIMARY KEY,
    title TEXT,
    salary TEXT,
    platform TEXT,
    risk_score FLOAT DEFAULT 0.0,
    status TEXT,
    recruiter_id TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Crime Reports
CREATE TABLE crime_reports (
    id SERIAL PRIMARY KEY,
    report_id TEXT UNIQUE NOT NULL, -- e.g., REQ-5001
    category TEXT, -- police, bank, telecom
    scam_type TEXT,
    amount TEXT,
    platform TEXT,
    priority TEXT, -- CRITICAL, HIGH, MEDIUM
    status TEXT DEFAULT 'PENDING',
    reporter_num TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- III. DEMO DATA SEEDING
-- ------------------------------------------------------------

-- 1. Demo Users (Password: password123)
-- bcrypt hash for 'password123'
INSERT INTO users (username, email, hashed_password, full_name, role) VALUES
('admin', 'admin@sentinel.gov.in', '$2b$12$rZ2e19sttSddtNJINi5LTey0l9ikpRSVvKFfPV/g9r7SybHkGdCN2', 'System Administrator', 'admin'),
('police_officer', 'sharma@police.gov.in', '$2b$12$rZ2e19sttSddtNJINi5LTey0l9ikpRSVvKFfPV/g9r7SybHkGdCN2', 'Inspector Sharma', 'police'),
('sbi_fraud', 'cell@sbi.co.in', '$2b$12$rZ2e19sttSddtNJINi5LTey0l9ikpRSVvKFfPV/g9r7SybHkGdCN2', 'SBI Fraud Desk', 'bank'),
('govt_analyst', 'analyst@mha.gov.in', '$2b$12$rZ2e19sttSddtNJINi5LTey0l9ikpRSVvKFfPV/g9r7SybHkGdCN2', 'MHA Data Analyst', 'government'),
('jio_security', 'security@jio.com', '$2b$12$rZ2e19sttSddtNJINi5LTey0l9ikpRSVvKFfPV/g9r7SybHkGdCN2', 'Jio Security Lead', 'telecom'),
('registrar', 'registrar@hc.gov.in', '$2b$12$rZ2e19sttSddtNJINi5LTey0l9ikpRSVvKFfPV/g9r7SybHkGdCN2', 'Court Registrar', 'court'),
('citizen', 'citizen@outlook.com', '$2b$12$rZ2e19sttSddtNJINi5LTey0l9ikpRSVvKFfPV/g9r7SybHkGdCN2', 'Common Man', 'common');

-- 2. Call Records & Detection Seed
INSERT INTO call_records (id, caller_num, receiver_num, duration, call_type, metadata_json, fraud_risk_score, verdict) VALUES
(1, '+91 9123456789', '+91 9876543210', 45, 'incoming', '{"location": "Delhi", "carrier": "Airtel"}', 0.92, 'scam'),
(2, '+91 8234567890', '+91 8888888888', 120, 'incoming', '{"location": "Mumbai", "carrier": "Jio"}', 0.12, 'safe'),
(3, '+91 7011223344', '+91 7777777777', 15, 'incoming', '{"location": "Jamtara", "carrier": "Vi"}', 0.88, 'scam');

INSERT INTO detection_details (call_id, feature_name, feature_value, impact_score) VALUES
(1, 'Voice Stress', 0.85, 0.4), (1, 'Velocity', 12.0, 0.3), (1, 'Script Match', 0.78, 0.2),
(3, 'Location Anomaly', 1.0, 0.5), (3, 'Reputation', 0.9, 0.4);

-- 3. Suspicious Numbers
INSERT INTO suspicious_numbers (phone_number, reputation_score, category, report_count) VALUES
('+91 9123456789', 0.92, 'Lottery Scam', 54),
('+91 8234567890', 0.48, 'Bank Impersonation', 12);

-- 4. Scam Clusters
INSERT INTO scam_clusters (cluster_id, risk_level, location, linked_vpas, honeypot_hits) VALUES
('POD-72X', 'CRITICAL', 'Noida, Sector 62', 42, 1205),
('POD-11M', 'HIGH', 'Jamtara, Jharkhand', 18, 450),
('POD-09K', 'MEDIUM', 'Bharatpur, Rajasthan', 12, 210);

-- 5. SYSTEM STATS MASTER LOG (Direct Dashboard Support)

-- Overview
INSERT INTO system_stats (category, key, value) VALUES
('overview', 'scams_blocked', '1,54,201'),
('overview', 'citizens_protected', '1,12,450'),
('overview', 'estimated_savings', '₹452 Cr'),
('overview', 'active_threats', '1,042');

-- Score Engine
INSERT INTO system_stats (category, key, metadata_json) VALUES
('score', 'national', '{"value": 742, "change": "+12.4%", "nodes": 4520, "heatmap": [45, 62, 38, 55, 72, 48, 65, 50, 42, 58, 70, 45]}'),
('score', 'factors', '[{"label": "Identity Trust", "value": "High", "percent": 92}, {"label": "Behavioral Risk", "value": "Medium", "percent": 74}, {"label": "Network Reputation", "value": "High", "percent": 88}]');

-- Deepfake Defense
INSERT INTO system_stats (category, key, metadata_json) VALUES
('deepfake', 'incidents', '[{"type": "Video Overlay", "risk": "High", "status": "Deepfake"}, {"type": "Voice Synth", "risk": "Medium", "status": "Suspicious"}, {"type": "Face Swap", "risk": "Critical", "status": "Detected"}]'),
('deepfake', 'model_status', '{"liveness": "Active", "gan_detector": "Operational", "false_positive_rate": "0.02%"}');

-- Mule Detection
INSERT INTO system_stats (category, key, metadata_json) VALUES
('mule', 'ads', '[{"id": 1, "title": "Commission Agent", "salary": "₹50k/mo", "platform": "Telegram", "risk": 0.85, "status": "Mule Recruitment"}, {"id": 2, "title": "Data Entry Remote", "salary": "₹25k/mo", "platform": "WhatsApp", "risk": 0.72, "status": "Suspicious"}]'),
('mule', 'patterns', '[{"label": "Remote Job Scam", "value": 82}, {"label": "Rental Scam", "value": 45}, {"label": "Investment", "value": 31}]');

-- UPI Protection
INSERT INTO system_stats (category, key, metadata_json) VALUES
('upi', 'dashboard', '{"vpa_checks_24h": "45,201", "flags": "1,042", "vpa_risk_percent": 12}'),
('upi', 'threat_feed', '[{"id": "VPA-8921", "time": "2m ago", "risk": "High", "type": "Collect Request", "vpa": "airtel.pay@ybl"}, {"id": "VPA-1102", "time": "15m ago", "risk": "Critical", "type": "Fraudulent Link", "vpa": "lottery.99@okhdfc"}]');

-- Bharat Layer
INSERT INTO system_stats (category, key, metadata_json) VALUES
('bharat', 'regions', '[{"id": "north", "name": "North India (Haryana/Punjab)", "towers": 1240, "reach": "8.2M"}, {"id": "east", "name": "East India (Bihar/WB)", "towers": 2150, "reach": "12.4M"}, {"id": "west", "name": "West India (Rajasthan/Gujarat)", "towers": 1890, "reach": "10.1M"}]');

-- Inoculation Scenarios
INSERT INTO system_stats (category, key, metadata_json) VALUES
('inoculation', 'scenarios', '{
    "bank_kyc": {"name": "Bank KYC Scam", "desc": "Simulated phishing message asking for KYC update via suspicious link.", "steps": ["Dispatching SMS", "Simulating Click-through", "Capturing Awareness Index"]},
    "lottery_win": {"name": "Lottery Win Scam", "desc": "Message claiming lottery win to test user report-first behavior.", "steps": ["Dispatching WhatsApp", "Monitoring Response", "Reporting to 1930 Simulation"]},
    "upi_refund": {"name": "UPI Refund Trap", "desc": "Collect-request trap simulation for mobile payment education.", "steps": ["Sending VPA Link", "Verifying Denial Rate", "Issuing Safety Certificate"]}
}'),
('inoculation', 'impact', '{"prevented": "12,402", "velocity": "+14.2%"}');

-- IV. SECURITY POLICIES (RLS)
-- ------------------------------------------------------------
ALTER TABLE system_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated inserts" ON system_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated selects" ON system_actions FOR SELECT TO authenticated USING (true);

-- V. FINAL COMMIT
-- ------------------------------------------------------------
COMMIT;
