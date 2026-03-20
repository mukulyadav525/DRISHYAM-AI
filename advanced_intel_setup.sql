-- DRISHYAM AI: Advanced Intelligence & Auditing Schema (Module 7/8/9)
-- Add these tables to your Supabase/Postgres instance to enable full tactical history.

-- 1. Public Alert History
-- Tracks the reach and status of emergency broadcasts from the Public Alert Console.
CREATE TABLE IF NOT EXISTS public_alerts (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    category VARCHAR(100), -- e.g., 'UPI Collect Trap', 'Job Fraud'
    target_region VARCHAR(100), -- e.g., 'delhi', 'national'
    message_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'dispatched', -- 'draft', 'dispatched', 'failed'
    citizen_reach INTEGER DEFAULT 0,
    delivery_rate FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WhatsApp / Message Interception Logs
-- Stores the results of message scans from the UPI Shield & Message Interceptor.
CREATE TABLE IF NOT EXISTS message_interceptions (
    id SERIAL PRIMARY KEY,
    sender_info VARCHAR(255), -- Phone number or VPA
    original_text TEXT,
    risk_score FLOAT DEFAULT 0.0,
    verdict VARCHAR(20), -- 'SAFE', 'SUSPICIOUS', 'SCAM'
    detected_entities JSONB, -- { 'vpas': [], 'links': [], 'amounts': [] }
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Number Reputation Audit Trail
-- Tracks how and why a phone number's reputation score has changed over time.
CREATE TABLE IF NOT EXISTS reputation_audit (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(50) NOT NULL,
    old_score FLOAT,
    new_score FLOAT,
    change_reason VARCHAR(255), -- e.g., 'Honeypot Extraction', 'Citizen Report'
    source_type VARCHAR(50), -- 'AI', 'MANUAL', 'AUTOMATED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bharat Layer USSD Logs
-- Tracks interactions with the USSD simulation for rural forensics.
CREATE TABLE IF NOT EXISTS ussd_logs (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(50),
    ussd_code VARCHAR(100),
    action_taken VARCHAR(100),
    region VARCHAR(100),
    status VARCHAR(20) DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Recovery Restitution Bundles
-- Tracks generated legal documents for citizens during the recovery process.
CREATE TABLE IF NOT EXISTS recovery_bundles (
    id SERIAL PRIMARY KEY,
    citizen_id VARCHAR(100),
    scam_type VARCHAR(100),
    bundle_id VARCHAR(100) UNIQUE,
    file_urls JSONB, -- Links to generated PDF templates
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_public_alerts_region ON public_alerts(target_region);
CREATE INDEX IF NOT EXISTS idx_msg_interception_risk ON message_interceptions(risk_score);
CREATE INDEX IF NOT EXISTS idx_reputation_audit_num ON reputation_audit(phone_number);
CREATE INDEX IF NOT EXISTS idx_ussd_logs_num ON ussd_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_recovery_bundles_cit ON recovery_bundles(citizen_id);
