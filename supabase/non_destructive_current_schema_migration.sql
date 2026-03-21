-- ============================================================
-- DRISHYAM AI
-- Non-destructive Supabase / PostgreSQL migration
-- Source of truth: backend/models/database.py
--
-- Safe to run on an existing schema.
-- Does NOT drop tables.
-- Do NOT use supabase/complete_setup.sql on a live database because it is destructive.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXISTING TABLE PATCHES
-- ============================================================

-- users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    hashed_password TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'common',
    is_active BOOLEAN DEFAULT TRUE,
    drishyam_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'common';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS drishyam_score INTEGER DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- call_records
CREATE TABLE IF NOT EXISTS call_records (
    id SERIAL PRIMARY KEY,
    caller_num TEXT,
    receiver_num TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration INTEGER,
    call_type TEXT,
    metadata_json JSONB,
    fraud_risk_score DOUBLE PRECISION,
    verdict TEXT
);

ALTER TABLE call_records ADD COLUMN IF NOT EXISTS caller_num TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS receiver_num TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS call_type TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS fraud_risk_score DOUBLE PRECISION;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS verdict TEXT;

-- detection_details
CREATE TABLE IF NOT EXISTS detection_details (
    id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES call_records(id),
    feature_name TEXT,
    feature_value DOUBLE PRECISION,
    impact_score DOUBLE PRECISION
);

ALTER TABLE detection_details ADD COLUMN IF NOT EXISTS call_id INTEGER;
ALTER TABLE detection_details ADD COLUMN IF NOT EXISTS feature_name TEXT;
ALTER TABLE detection_details ADD COLUMN IF NOT EXISTS feature_value DOUBLE PRECISION;
ALTER TABLE detection_details ADD COLUMN IF NOT EXISTS impact_score DOUBLE PRECISION;

-- suspicious_numbers
CREATE TABLE IF NOT EXISTS suspicious_numbers (
    id SERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE,
    reputation_score DOUBLE PRECISION DEFAULT 0.0,
    category TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    report_count INTEGER DEFAULT 0
);

ALTER TABLE suspicious_numbers ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE suspicious_numbers ADD COLUMN IF NOT EXISTS reputation_score DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE suspicious_numbers ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE suspicious_numbers ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE suspicious_numbers ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;

-- honeypot_sessions
CREATE TABLE IF NOT EXISTS honeypot_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE,
    user_id INTEGER REFERENCES users(id),
    caller_num TEXT,
    customer_id TEXT,
    persona TEXT,
    status TEXT DEFAULT 'active',
    direction TEXT DEFAULT 'outgoing',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    handoff_timestamp TIMESTAMPTZ,
    metadata_json JSONB,
    recording_analysis_json JSONB
);

ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS caller_num TEXT;
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS persona TEXT;
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outgoing';
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS handoff_timestamp TIMESTAMPTZ;
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS recording_analysis_json JSONB;

-- honeypot_messages
CREATE TABLE IF NOT EXISTS honeypot_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES honeypot_sessions(id),
    role TEXT,
    content TEXT,
    audio_url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE honeypot_messages ADD COLUMN IF NOT EXISTS session_id INTEGER;
ALTER TABLE honeypot_messages ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE honeypot_messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE honeypot_messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE honeypot_messages ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

-- system_stats
CREATE TABLE IF NOT EXISTS system_stats (
    id SERIAL PRIMARY KEY,
    category TEXT,
    key TEXT,
    value TEXT,
    metadata_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_stats ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE system_stats ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE system_stats ADD COLUMN IF NOT EXISTS value TEXT;
ALTER TABLE system_stats ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE system_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- system_actions
CREATE TABLE IF NOT EXISTS system_actions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type TEXT NOT NULL,
    target_id TEXT,
    metadata_json JSONB,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_actions ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE system_actions ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE system_actions ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE system_actions ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE system_actions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
ALTER TABLE system_actions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- honeypot_personas
CREATE TABLE IF NOT EXISTS honeypot_personas (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE,
    language TEXT,
    speaker TEXT,
    pace DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE honeypot_personas ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE honeypot_personas ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE honeypot_personas ADD COLUMN IF NOT EXISTS speaker TEXT;
ALTER TABLE honeypot_personas ADD COLUMN IF NOT EXISTS pace DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE honeypot_personas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- scam_clusters
CREATE TABLE IF NOT EXISTS scam_clusters (
    id SERIAL PRIMARY KEY,
    cluster_id TEXT UNIQUE,
    risk_level TEXT,
    location TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    linked_vpas INTEGER DEFAULT 0,
    honeypot_hits INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS cluster_id TEXT;
ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS linked_vpas INTEGER DEFAULT 0;
ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS honeypot_hits INTEGER DEFAULT 0;
ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- simulation_requests
CREATE TABLE IF NOT EXISTS simulation_requests (
    id SERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

ALTER TABLE simulation_requests ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE simulation_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE simulation_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE simulation_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- mule_ads
CREATE TABLE IF NOT EXISTS mule_ads (
    id SERIAL PRIMARY KEY,
    title TEXT,
    salary TEXT,
    platform TEXT,
    risk_score DOUBLE PRECISION DEFAULT 0.0,
    status TEXT,
    recruiter_id TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mule_ads ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE mule_ads ADD COLUMN IF NOT EXISTS salary TEXT;
ALTER TABLE mule_ads ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE mule_ads ADD COLUMN IF NOT EXISTS risk_score DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE mule_ads ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE mule_ads ADD COLUMN IF NOT EXISTS recruiter_id TEXT;
ALTER TABLE mule_ads ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE mule_ads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- honeypot_entities
CREATE TABLE IF NOT EXISTS honeypot_entities (
    id SERIAL PRIMARY KEY,
    entity_type TEXT,
    entity_value TEXT UNIQUE,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    risk_score DOUBLE PRECISION DEFAULT 0.5
);

ALTER TABLE honeypot_entities ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE honeypot_entities ADD COLUMN IF NOT EXISTS entity_value TEXT;
ALTER TABLE honeypot_entities ADD COLUMN IF NOT EXISTS first_seen TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE honeypot_entities ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE honeypot_entities ADD COLUMN IF NOT EXISTS risk_score DOUBLE PRECISION DEFAULT 0.5;

-- crime_reports
CREATE TABLE IF NOT EXISTS crime_reports (
    id SERIAL PRIMARY KEY,
    report_id TEXT UNIQUE,
    category TEXT,
    scam_type TEXT,
    amount TEXT,
    platform TEXT,
    priority TEXT,
    status TEXT DEFAULT 'PENDING',
    reporter_num TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS report_id TEXT;
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS scam_type TEXT;
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS amount TEXT;
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS reporter_num TEXT;
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- file_uploads
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    verdict TEXT,
    confidence_score DOUBLE PRECISION,
    risk_level TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS verdict TEXT;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- trust_links
CREATE TABLE IF NOT EXISTS trust_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian_email TEXT,
    relation_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trust_links ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE trust_links ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE trust_links ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE trust_links ADD COLUMN IF NOT EXISTS guardian_email TEXT;
ALTER TABLE trust_links ADD COLUMN IF NOT EXISTS relation_type TEXT;
ALTER TABLE trust_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- bank_node_rules
CREATE TABLE IF NOT EXISTS bank_node_rules (
    id SERIAL PRIMARY KEY,
    bank_name TEXT,
    rule_type TEXT,
    threshold DOUBLE PRECISION,
    action TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_node_rules ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE bank_node_rules ADD COLUMN IF NOT EXISTS rule_type TEXT;
ALTER TABLE bank_node_rules ADD COLUMN IF NOT EXISTS threshold DOUBLE PRECISION;
ALTER TABLE bank_node_rules ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE bank_node_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE bank_node_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- system_audit_logs
CREATE TABLE IF NOT EXISTS system_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT,
    resource TEXT,
    ip_address TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB
);

ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS resource TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS metadata_json JSONB;

-- citizen_consents
CREATE TABLE IF NOT EXISTS citizen_consents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    phone_number TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    channel TEXT DEFAULT 'SIMULATION_PORTAL',
    policy_version TEXT DEFAULT 'MVP-2026.03',
    scopes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata_json JSONB,
    given_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'SIMULATION_PORTAL';
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS policy_version TEXT DEFAULT 'MVP-2026.03';
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS scopes_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS given_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE citizen_consents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE citizen_consents SET scopes_json = '{}'::jsonb WHERE scopes_json IS NULL;
ALTER TABLE citizen_consents ALTER COLUMN scopes_json SET DEFAULT '{}'::jsonb;

-- notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    recipient TEXT,
    channel TEXT,
    template_id TEXT,
    status TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    metadata_json JSONB
);

ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS recipient TEXT;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS metadata_json JSONB;

-- recovery_cases
CREATE TABLE IF NOT EXISTS recovery_cases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    incident_id TEXT UNIQUE,
    bank_status TEXT DEFAULT 'PENDING',
    rbi_status TEXT DEFAULT 'NOT_STARTED',
    insurance_status TEXT DEFAULT 'NOT_STARTED',
    legal_aid_status TEXT DEFAULT 'NOT_STARTED',
    total_recovered DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS incident_id TEXT;
ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS bank_status TEXT DEFAULT 'PENDING';
ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS rbi_status TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS insurance_status TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS legal_aid_status TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS total_recovered DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- intelligence_alerts
CREATE TABLE IF NOT EXISTS intelligence_alerts (
    id SERIAL PRIMARY KEY,
    severity TEXT,
    message TEXT,
    location TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE intelligence_alerts ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE intelligence_alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE intelligence_alerts ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE intelligence_alerts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE intelligence_alerts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE intelligence_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- pilot_programs
CREATE TABLE IF NOT EXISTS pilot_programs (
    id SERIAL PRIMARY KEY,
    pilot_id TEXT UNIQUE,
    name TEXT NOT NULL,
    geography TEXT,
    telecom_partner TEXT,
    bank_partners_json JSONB,
    agencies_json JSONB,
    languages_json JSONB,
    scam_categories_json JSONB,
    dashboard_scope_json JSONB,
    success_metrics_json JSONB,
    training_status_json JSONB,
    communications_json JSONB,
    outcome_summary_json JSONB,
    launch_status TEXT DEFAULT 'CONFIGURING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS pilot_id TEXT;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS geography TEXT;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS telecom_partner TEXT;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS bank_partners_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS agencies_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS languages_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS scam_categories_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS dashboard_scope_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS success_metrics_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS training_status_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS communications_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS outcome_summary_json JSONB;
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS launch_status TEXT DEFAULT 'CONFIGURING';
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pilot_programs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- pilot_feedback
CREATE TABLE IF NOT EXISTS pilot_feedback (
    id SERIAL PRIMARY KEY,
    pilot_program_id INTEGER REFERENCES pilot_programs(id),
    stakeholder_type TEXT NOT NULL,
    source_agency TEXT,
    sentiment TEXT DEFAULT 'NEUTRAL',
    message TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS pilot_program_id INTEGER;
ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS stakeholder_type TEXT;
ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS source_agency TEXT;
ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT 'NEUTRAL';
ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';
ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pilot_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- partner_pipeline
CREATE TABLE IF NOT EXISTS partner_pipeline (
    id SERIAL PRIMARY KEY,
    account_name TEXT NOT NULL,
    segment TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'LEAD',
    owner TEXT NOT NULL,
    annual_value_inr DOUBLE PRECISION DEFAULT 0.0,
    status TEXT DEFAULT 'OPEN',
    next_step TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS segment TEXT;
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'LEAD';
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS annual_value_inr DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS next_step TEXT;
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE partner_pipeline ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- billing_records
CREATE TABLE IF NOT EXISTS billing_records (
    id SERIAL PRIMARY KEY,
    partner_name TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    amount_inr DOUBLE PRECISION DEFAULT 0.0,
    tax_inr DOUBLE PRECISION DEFAULT 0.0,
    billing_status TEXT DEFAULT 'DRAFT',
    subscription_status TEXT DEFAULT 'ACTIVE',
    billing_cycle TEXT DEFAULT 'MONTHLY',
    due_date TIMESTAMPTZ,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS plan_name TEXT;
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS amount_inr DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS tax_inr DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'DRAFT';
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'MONTHLY';
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE billing_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    stakeholder_type TEXT NOT NULL,
    severity TEXT DEFAULT 'MEDIUM',
    incident_classification TEXT NOT NULL,
    queue_name TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    owner TEXT,
    resolution_eta_min INTEGER DEFAULT 60,
    summary TEXT NOT NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS stakeholder_type TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'MEDIUM';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS incident_classification TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS queue_name TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolution_eta_min INTEGER DEFAULT 60;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- governance_reviews
CREATE TABLE IF NOT EXISTS governance_reviews (
    id SERIAL PRIMARY KEY,
    review_id TEXT NOT NULL,
    board_type TEXT NOT NULL,
    title TEXT NOT NULL,
    cadence TEXT DEFAULT 'MONTHLY',
    status TEXT DEFAULT 'SCHEDULED',
    next_review_at TIMESTAMPTZ,
    outcome_summary TEXT,
    recommendations_json JSONB,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS review_id TEXT;
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS board_type TEXT;
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS cadence TEXT DEFAULT 'MONTHLY';
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SCHEDULED';
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS outcome_summary TEXT;
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS recommendations_json JSONB;
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE governance_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- npci_logs
CREATE TABLE IF NOT EXISTS npci_logs (
    id SERIAL PRIMARY KEY,
    vpa TEXT,
    action TEXT,
    status_code TEXT,
    message TEXT,
    reference_id TEXT NOT NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE npci_logs ADD COLUMN IF NOT EXISTS vpa TEXT;
ALTER TABLE npci_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE npci_logs ADD COLUMN IF NOT EXISTS status_code TEXT;
ALTER TABLE npci_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE npci_logs ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE npci_logs ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE npci_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- 2. INDEXES AND UNIQUENESS
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone_number ON users (phone_number) WHERE phone_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_call_records_caller_num ON call_records (caller_num);
CREATE INDEX IF NOT EXISTS ix_call_records_receiver_num ON call_records (receiver_num);

CREATE UNIQUE INDEX IF NOT EXISTS ix_suspicious_numbers_phone_number ON suspicious_numbers (phone_number) WHERE phone_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_honeypot_sessions_session_id ON honeypot_sessions (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_honeypot_sessions_user_id ON honeypot_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_honeypot_sessions_customer_id ON honeypot_sessions (customer_id);

CREATE INDEX IF NOT EXISTS ix_system_stats_category ON system_stats (category);
CREATE INDEX IF NOT EXISTS ix_system_stats_key ON system_stats (key);

CREATE UNIQUE INDEX IF NOT EXISTS ix_honeypot_personas_name ON honeypot_personas (name) WHERE name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_scam_clusters_cluster_id ON scam_clusters (cluster_id) WHERE cluster_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_simulation_requests_phone_number ON simulation_requests (phone_number) WHERE phone_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_honeypot_entities_entity_value ON honeypot_entities (entity_value) WHERE entity_value IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_crime_reports_report_id ON crime_reports (report_id) WHERE report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_bank_node_rules_bank_name ON bank_node_rules (bank_name);

CREATE INDEX IF NOT EXISTS ix_system_audit_logs_action ON system_audit_logs (action);

CREATE INDEX IF NOT EXISTS ix_citizen_consents_user_id ON citizen_consents (user_id);
CREATE INDEX IF NOT EXISTS ix_citizen_consents_phone_number ON citizen_consents (phone_number);
CREATE INDEX IF NOT EXISTS ix_citizen_consents_status ON citizen_consents (status);

CREATE INDEX IF NOT EXISTS ix_notification_logs_recipient ON notification_logs (recipient);

CREATE INDEX IF NOT EXISTS ix_recovery_cases_user_id ON recovery_cases (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_recovery_cases_incident_id ON recovery_cases (incident_id) WHERE incident_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_pilot_programs_pilot_id ON pilot_programs (pilot_id) WHERE pilot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pilot_feedback_pilot_program_id ON pilot_feedback (pilot_program_id);

CREATE INDEX IF NOT EXISTS ix_partner_pipeline_account_name ON partner_pipeline (account_name);
CREATE INDEX IF NOT EXISTS ix_partner_pipeline_segment ON partner_pipeline (segment);
CREATE INDEX IF NOT EXISTS ix_partner_pipeline_stage ON partner_pipeline (stage);
CREATE INDEX IF NOT EXISTS ix_partner_pipeline_status ON partner_pipeline (status);

CREATE INDEX IF NOT EXISTS ix_billing_records_partner_name ON billing_records (partner_name);
CREATE UNIQUE INDEX IF NOT EXISTS ix_billing_records_invoice_number ON billing_records (invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_billing_records_billing_status ON billing_records (billing_status);
CREATE INDEX IF NOT EXISTS ix_billing_records_subscription_status ON billing_records (subscription_status);

CREATE UNIQUE INDEX IF NOT EXISTS ix_support_tickets_ticket_id ON support_tickets (ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_support_tickets_stakeholder_type ON support_tickets (stakeholder_type);
CREATE INDEX IF NOT EXISTS ix_support_tickets_severity ON support_tickets (severity);
CREATE INDEX IF NOT EXISTS ix_support_tickets_incident_classification ON support_tickets (incident_classification);
CREATE INDEX IF NOT EXISTS ix_support_tickets_queue_name ON support_tickets (queue_name);
CREATE INDEX IF NOT EXISTS ix_support_tickets_status ON support_tickets (status);

CREATE UNIQUE INDEX IF NOT EXISTS ix_governance_reviews_review_id ON governance_reviews (review_id) WHERE review_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_governance_reviews_board_type ON governance_reviews (board_type);
CREATE INDEX IF NOT EXISTS ix_governance_reviews_status ON governance_reviews (status);

CREATE INDEX IF NOT EXISTS ix_npci_logs_vpa ON npci_logs (vpa);
CREATE UNIQUE INDEX IF NOT EXISTS ix_npci_logs_reference_id ON npci_logs (reference_id) WHERE reference_id IS NOT NULL;

-- ============================================================
-- 3. OPTIONAL FOREIGN KEYS FOR EXISTING TABLES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_detection_details_call_id'
    ) THEN
        ALTER TABLE detection_details
        ADD CONSTRAINT fk_detection_details_call_id
        FOREIGN KEY (call_id) REFERENCES call_records(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_honeypot_sessions_user_id'
    ) THEN
        ALTER TABLE honeypot_sessions
        ADD CONSTRAINT fk_honeypot_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_honeypot_messages_session_id'
    ) THEN
        ALTER TABLE honeypot_messages
        ADD CONSTRAINT fk_honeypot_messages_session_id
        FOREIGN KEY (session_id) REFERENCES honeypot_sessions(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_system_actions_user_id'
    ) THEN
        ALTER TABLE system_actions
        ADD CONSTRAINT fk_system_actions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_file_uploads_user_id'
    ) THEN
        ALTER TABLE file_uploads
        ADD CONSTRAINT fk_file_uploads_user_id
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_trust_links_user_id'
    ) THEN
        ALTER TABLE trust_links
        ADD CONSTRAINT fk_trust_links_user_id
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_system_audit_logs_user_id'
    ) THEN
        ALTER TABLE system_audit_logs
        ADD CONSTRAINT fk_system_audit_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_citizen_consents_user_id'
    ) THEN
        ALTER TABLE citizen_consents
        ADD CONSTRAINT fk_citizen_consents_user_id
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_recovery_cases_user_id'
    ) THEN
        ALTER TABLE recovery_cases
        ADD CONSTRAINT fk_recovery_cases_user_id
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pilot_feedback_pilot_program_id'
    ) THEN
        ALTER TABLE pilot_feedback
        ADD CONSTRAINT fk_pilot_feedback_pilot_program_id
        FOREIGN KEY (pilot_program_id) REFERENCES pilot_programs(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS partner_integrations (
    id BIGSERIAL PRIMARY KEY,
    partner_name VARCHAR NOT NULL UNIQUE,
    segment VARCHAR NOT NULL,
    owner VARCHAR NOT NULL,
    region_scope VARCHAR DEFAULT 'INDIA',
    mou_status VARCHAR DEFAULT 'DRAFT',
    sandbox_access_status VARCHAR DEFAULT 'REQUESTED',
    production_access_status VARCHAR DEFAULT 'PLANNED',
    api_access_status VARCHAR DEFAULT 'PENDING',
    credential_status VARCHAR DEFAULT 'NOT_ISSUED',
    sla_status VARCHAR DEFAULT 'IN_NEGOTIATION',
    escalation_contact VARCHAR,
    next_milestone VARCHAR,
    status VARCHAR DEFAULT 'ON_TRACK',
    last_checked_at TIMESTAMP DEFAULT NOW(),
    metadata_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_integrations_segment ON partner_integrations(segment);
CREATE INDEX IF NOT EXISTS idx_partner_integrations_status ON partner_integrations(status);
CREATE INDEX IF NOT EXISTS idx_partner_integrations_api_access_status ON partner_integrations(api_access_status);

CREATE TABLE IF NOT EXISTS agency_access_policies (
    id BIGSERIAL PRIMARY KEY,
    policy_id VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    role_scope VARCHAR NOT NULL,
    resource_scope VARCHAR DEFAULT '*',
    action_scope VARCHAR DEFAULT '*',
    region_scope VARCHAR DEFAULT '*',
    effect VARCHAR DEFAULT 'ALLOW',
    active BOOLEAN DEFAULT TRUE,
    conditions_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_access_policies_role_scope ON agency_access_policies(role_scope);
CREATE INDEX IF NOT EXISTS idx_agency_access_policies_active ON agency_access_policies(active);

CREATE TABLE IF NOT EXISTS agency_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_uid VARCHAR NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    device_label VARCHAR NOT NULL,
    device_type VARCHAR DEFAULT 'WEB',
    ip_address VARCHAR,
    network_zone VARCHAR,
    auth_stage VARCHAR DEFAULT 'PASSWORD_ONLY',
    risk_level VARCHAR DEFAULT 'LOW',
    status VARCHAR DEFAULT 'ACTIVE',
    last_seen_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP,
    revoked_at TIMESTAMP,
    metadata_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_sessions_user_id ON agency_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_sessions_status ON agency_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agency_sessions_risk_level ON agency_sessions(risk_level);

CREATE TABLE IF NOT EXISTS admin_approvals (
    id BIGSERIAL PRIMARY KEY,
    approval_id VARCHAR NOT NULL UNIQUE,
    requested_by_user_id BIGINT NOT NULL,
    approver_user_id BIGINT,
    action_type VARCHAR NOT NULL,
    resource VARCHAR NOT NULL,
    risk_level VARCHAR DEFAULT 'HIGH',
    justification TEXT NOT NULL,
    status VARCHAR DEFAULT 'PENDING',
    expires_at TIMESTAMP,
    decided_at TIMESTAMP,
    metadata_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_approvals_requested_by_user_id ON admin_approvals(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_approvals_approver_user_id ON admin_approvals(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_approvals_status ON admin_approvals(status);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_agency_sessions_user_id'
    ) THEN
        ALTER TABLE agency_sessions
        ADD CONSTRAINT fk_agency_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_approvals_requested_by_user_id'
    ) THEN
        ALTER TABLE admin_approvals
        ADD CONSTRAINT fk_admin_approvals_requested_by_user_id
        FOREIGN KEY (requested_by_user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_approvals_approver_user_id'
    ) THEN
        ALTER TABLE admin_approvals
        ADD CONSTRAINT fk_admin_approvals_approver_user_id
        FOREIGN KEY (approver_user_id) REFERENCES users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
