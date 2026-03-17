-- Sentinel 1930 / BASIG
-- Supabase / PostgreSQL Schema Setup

-- 1. Users table with RBAC and Sentinel Score
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'common',
    is_active BOOLEAN DEFAULT TRUE,
    sentinel_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Call Records for FRI Scoring
CREATE TABLE IF NOT EXISTS call_records (
    id SERIAL PRIMARY KEY,
    caller_num VARCHAR(50),
    receiver_num VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration INTEGER,
    call_type VARCHAR(20),
    metadata_json JSONB,
    fraud_risk_score FLOAT,
    verdict VARCHAR(20)
);

-- 3. Detection Details for Score Explanation
CREATE TABLE IF NOT EXISTS detection_details (
    id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES call_records(id),
    feature_name VARCHAR(100),
    feature_value FLOAT,
    impact_score FLOAT
);

-- 4. Suspicious Numbers Registry
CREATE TABLE IF NOT EXISTS suspicious_numbers (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    reputation_score FLOAT DEFAULT 0.0,
    category VARCHAR(50),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    report_count INTEGER DEFAULT 0
);

-- 5. Honeypot Sessions
CREATE TABLE IF NOT EXISTS honeypot_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    caller_num VARCHAR(50),
    customer_id VARCHAR(50),
    persona VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    handoff_timestamp TIMESTAMPTZ,
    metadata_json JSONB
);

-- 6. Honeypot Messages
CREATE TABLE IF NOT EXISTS honeypot_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES honeypot_sessions(id),
    role VARCHAR(20),
    content TEXT,
    audio_url VARCHAR(255),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 7. System Stats (Rupees Saved, Fatigue, etc.)
CREATE TABLE IF NOT EXISTS system_stats (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100),
    key VARCHAR(100),
    value VARCHAR(255),
    metadata_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. System Actions Audit Trail
CREATE TABLE IF NOT EXISTS system_actions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(255),
    metadata_json JSONB,
    status VARCHAR(50) DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Honeypot Personas
CREATE TABLE IF NOT EXISTS honeypot_personas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    language VARCHAR(50),
    speaker VARCHAR(100),
    pace FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Scam Clusters Map Data
CREATE TABLE IF NOT EXISTS scam_clusters (
    id SERIAL PRIMARY KEY,
    cluster_id VARCHAR(100) UNIQUE NOT NULL,
    risk_level VARCHAR(20),
    location VARCHAR(255),
    lat FLOAT,
    lng FLOAT,
    linked_vpas INTEGER DEFAULT 0,
    honeypot_hits INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Simulation Requests
CREATE TABLE IF NOT EXISTS simulation_requests (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 12. Mule Ads Registry
CREATE TABLE IF NOT EXISTS mule_ads (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    salary VARCHAR(100),
    platform VARCHAR(100),
    risk_score FLOAT DEFAULT 0.0,
    status VARCHAR(50),
    recruiter_id VARCHAR(100),
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Honeypot Entity Intel
CREATE TABLE IF NOT EXISTS honeypot_entities (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50),
    entity_value VARCHAR(255) UNIQUE NOT NULL,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    risk_score FLOAT DEFAULT 0.5
);

-- 14. Crime Reports (Central Case Queue)
CREATE TABLE IF NOT EXISTS crime_reports (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50),
    scam_type VARCHAR(100),
    amount VARCHAR(50),
    platform VARCHAR(100),
    priority VARCHAR(20),
    status VARCHAR(20) DEFAULT 'PENDING',
    reporter_num VARCHAR(50),
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. File Uploads (Forensics / Deepfake)
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    verdict VARCHAR(20),
    confidence_score FLOAT,
    risk_level VARCHAR(20),
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Trust Circle / Links
CREATE TABLE IF NOT EXISTS trust_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    guardian_name VARCHAR(255),
    guardian_phone VARCHAR(50),
    guardian_email VARCHAR(255),
    relation_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create appropriate indexes for search performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_records_caller ON call_records(caller_num);
CREATE INDEX IF NOT EXISTS idx_honeypot_sessions_sid ON honeypot_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_crime_reports_rid ON crime_reports(report_id);
