-- ============================================================
-- DRISHYAM AI — MISSING INFRASTRUCTURE SETUP
-- Version: 1.0 (Post-Consolidation)
-- Description: Run this script in your Supabase SQL Editor to add
--              missing tables required for Forensics, Recovery, and UPI Shield.
-- ============================================================

BEGIN;

-- 1. Forensics & Deepfake Uploads
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    verdict TEXT, -- 'REAL', 'SUSPICIOUS', 'FAKE'
    confidence_score FLOAT,
    risk_level TEXT, -- 'LOW', 'MEDIUM', 'HIGH'
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trust Circle / Links
CREATE TABLE IF NOT EXISTS trust_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian_email TEXT,
    relation_type TEXT, -- e.g., "Son", "Daughter"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Recovery Cases & Restoration
CREATE TABLE IF NOT EXISTS recovery_cases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    incident_id TEXT UNIQUE NOT NULL,
    bank_status TEXT DEFAULT 'PENDING', -- PENDING, INVESTIGATING, FROZEN, RECOVERED
    rbi_status TEXT DEFAULT 'NOT_STARTED',
    insurance_status TEXT DEFAULT 'NOT_STARTED',
    legal_aid_status TEXT DEFAULT 'NOT_STARTED',
    total_recovered FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recovery Restitution Bundles
CREATE TABLE IF NOT EXISTS recovery_bundles (
    id SERIAL PRIMARY KEY,
    citizen_id TEXT,
    scam_type TEXT,
    bundle_id TEXT UNIQUE,
    file_urls JSONB, -- Links to generated PDF templates
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Public Alert Console
CREATE TABLE IF NOT EXISTS public_alerts (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category TEXT, -- e.g., 'UPI Collect Trap', 'Job Fraud'
    target_region TEXT, -- e.g., 'delhi', 'national'
    message_text TEXT NOT NULL,
    status TEXT DEFAULT 'dispatched', -- 'draft', 'dispatched', 'failed'
    citizen_reach INTEGER DEFAULT 0,
    delivery_rate FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. UPI Shield / Message Interception Logs
CREATE TABLE IF NOT EXISTS message_interceptions (
    id SERIAL PRIMARY KEY,
    sender_info TEXT, -- Phone number or VPA
    original_text TEXT,
    risk_score FLOAT DEFAULT 0.0,
    verdict TEXT, -- 'SAFE', 'SUSPICIOUS', 'SCAM'
    detected_entities JSONB, -- { 'vpas': [], 'links': [], 'amounts': [] }
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Number Reputation Audit Trail
CREATE TABLE IF NOT EXISTS reputation_audit (
    id SERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    old_score FLOAT,
    new_score FLOAT,
    change_reason TEXT, -- e.g., 'Honeypot Extraction', 'Citizen Report'
    source_type TEXT, -- 'AI', 'MANUAL', 'AUTOMATED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Bharat Layer / USSD Logs
CREATE TABLE IF NOT EXISTS ussd_logs (
    id SERIAL PRIMARY KEY,
    phone_number TEXT,
    ussd_code TEXT,
    action_taken TEXT,
    region TEXT,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Intelligence Alerts
CREATE TABLE IF NOT EXISTS intelligence_alerts (
    id SERIAL PRIMARY KEY,
    severity TEXT, -- CRITICAL, HIGH, MEDIUM
    message TEXT,
    location TEXT,
    category TEXT, -- e.g., "VPA_ROTATION", "SCAM_POD"
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Honeypot Entity Intel
CREATE TABLE IF NOT EXISTS honeypot_entities (
    id SERIAL PRIMARY KEY,
    entity_type TEXT, -- "VPA", "PHONE", "ACCOUNT"
    entity_value TEXT UNIQUE NOT NULL,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    risk_score FLOAT DEFAULT 0.5
);

-- 11. Bank Node Rules (Mule Detection)
CREATE TABLE IF NOT EXISTS bank_node_rules (
    id SERIAL PRIMARY KEY,
    bank_name TEXT NOT NULL,
    rule_type TEXT, -- e.g., "AMOUNT_THRESHOLD", "VELOCITY"
    threshold FLOAT,
    action TEXT, -- e.g., "FREEZE", "FLAG"
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. System Audit Logs
CREATE TABLE IF NOT EXISTS system_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- e.g., "ACCESS_PII", "LOGIN", "EXPORT_GRAPH"
    resource TEXT, -- e.g., "CrimeReport-501", "FraudGraph"
    ip_address TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB
);

-- 13. Notification Dispatch Logs
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    recipient TEXT NOT NULL,
    channel TEXT, -- "SMS", "WHATSAPP", "EMAIL"
    template_id TEXT,
    status TEXT, -- "SENT", "DELIVERED", "FAILED"
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB
);

-- ============================================================
-- STORAGE BUCKET CONFIGURATION (Informational)
-- ============================================================
-- You MUST create the following buckets in the Supabase Dashboard:
-- 1. 'calls'     (Public: No, Policy: Authenticated users can read/write)
-- 2. 'forensics' (Public: No, Policy: Authenticated users can write, Admins can read)
-- 3. 'reports'   (Public: No, Policy: Authenticated user can read their own reports)

COMMIT;
