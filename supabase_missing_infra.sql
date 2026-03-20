-- ============================================================
-- DRISHYAM AI — COMPLETE INFRASTRUCTURE SETUP
-- Version: 2.0 (Unified Core + Features)
-- Description: Run this script in your Supabase SQL Editor to add
--              ALL tables required for the application.
-- ============================================================

BEGIN;

-- 1. Core Users Table Extensions (If not exists)
-- Assuming a basic 'users' table exists, adding essential columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'common';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS drishyam_score INTEGER DEFAULT 100;

-- 2. Call Monitoring & Detection
CREATE TABLE IF NOT EXISTS call_records (
    id SERIAL PRIMARY KEY,
    caller_num TEXT,
    receiver_num TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration INTEGER,
    call_type TEXT, -- 'incoming', 'outgoing'
    metadata_json JSONB,
    fraud_risk_score FLOAT,
    verdict TEXT -- 'safe', 'suspicious', 'scam'
);

CREATE TABLE IF NOT EXISTS detection_details (
    id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES call_records(id) ON DELETE CASCADE,
    feature_name TEXT,
    feature_value FLOAT,
    impact_score FLOAT
);

CREATE TABLE IF NOT EXISTS suspicious_numbers (
    id SERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    reputation_score FLOAT DEFAULT 0.0,
    category TEXT, -- 'banking_scam', 'job_scam', etc.
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    report_count INTEGER DEFAULT 0
);

-- 3. Honeypot System
CREATE TABLE IF NOT EXISTS honeypot_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    caller_num TEXT,
    customer_id TEXT,
    persona TEXT,
    status TEXT DEFAULT 'active', -- active, completed
    direction TEXT DEFAULT 'outgoing',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB,
    recording_analysis_json JSONB
);

CREATE TABLE IF NOT EXISTS honeypot_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES honeypot_sessions(id) ON DELETE CASCADE,
    role TEXT, -- user, assistant
    content TEXT,
    audio_url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Reporting & Multi-Agency Dissemination
CREATE TABLE IF NOT EXISTS crime_reports (
    id SERIAL PRIMARY KEY,
    report_id TEXT UNIQUE NOT NULL,
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

-- 5. Intelligence & Blacklisting
CREATE TABLE IF NOT EXISTS honeypot_entities (
    id SERIAL PRIMARY KEY,
    entity_type TEXT, -- "VPA", "PHONE", "ACCOUNT"
    entity_value TEXT UNIQUE NOT NULL,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    risk_score FLOAT DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS intelligence_alerts (
    id SERIAL PRIMARY KEY,
    severity TEXT,
    message TEXT,
    location TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Forensic Artifacts
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    verdict TEXT,
    confidence_score FLOAT,
    risk_level TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Recovery & System Logs
CREATE TABLE IF NOT EXISTS recovery_cases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    incident_id TEXT UNIQUE NOT NULL,
    bank_status TEXT DEFAULT 'PENDING',
    rbi_status TEXT DEFAULT 'NOT_STARTED',
    insurance_status TEXT DEFAULT 'NOT_STARTED',
    legal_aid_status TEXT DEFAULT 'NOT_STARTED',
    total_recovered FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT,
    ip_address TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB
);

CREATE TABLE IF NOT EXISTS system_stats (
    id SERIAL PRIMARY KEY,
    category TEXT, -- e.g., 'mule', 'deepfake', 'upi'
    key TEXT,
    value TEXT,
    metadata_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    recipient TEXT NOT NULL,
    channel TEXT,
    template_id TEXT,
    status TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB
);

-- ============================================================
-- STORAGE BUCKETS (Create these in Supabase Dashboard)
-- ============================================================
-- 1. 'calls'     - Recordings of intercepted scam calls.
-- 2. 'forensics' - Uploaded images/videos for deepfake analysis.
-- 3. 'reports'   - Generated FIR PDF exports.

COMMIT;
