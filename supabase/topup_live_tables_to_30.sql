BEGIN;

CREATE OR REPLACE FUNCTION public._drishyam_seed_shifted_now(seed integer)
RETURNS timestamp
LANGUAGE sql
AS $$
  SELECT (now() AT TIME ZONE 'utc')
    - make_interval(days => (seed % 60), hours => ((seed * 3) % 24), mins => ((seed * 7) % 60));
$$;

CREATE OR REPLACE FUNCTION public._drishyam_seed_phone(seed integer)
RETURNS text
LANGUAGE sql
AS $$
  SELECT '98' || lpad(seed::text, 8, '0');
$$;

DO $$
DECLARE
  target_rows integer := 30;
  missing integer;
  idx integer;
  user_ids integer[];
  common_user_ids integer[];
  privileged_user_ids integer[];
  admin_id integer;
  call_ids integer[];
  session_ids integer[];
  pilot_ids integer[];
  persona_names text[];
  hash_password text := '$2b$12$uA5X8JmKr9yPEN2cYk57cOksnjG498lTkPDuFad7Ce8TuhjR2Xs5O';
BEGIN
  INSERT INTO honeypot_personas (name, language, speaker, pace, created_at)
  VALUES
    ('Elderly Uncle', 'hi-IN', 'Male', 0.85, public._drishyam_seed_shifted_now(1)),
    ('Rural Farmer', 'hi-IN', 'Male', 0.90, public._drishyam_seed_shifted_now(2)),
    ('College Student', 'en-IN', 'Male', 1.05, public._drishyam_seed_shifted_now(3)),
    ('Housewife', 'hi-IN', 'Female', 0.95, public._drishyam_seed_shifted_now(4)),
    ('Busy Executive', 'en-IN', 'Female', 1.00, public._drishyam_seed_shifted_now(5))
  ON CONFLICT (name) DO NOTHING;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM users;
  FOR idx IN 1..missing LOOP
    INSERT INTO users (
      username,
      phone_number,
      email,
      hashed_password,
      full_name,
      role,
      is_active,
      drishyam_score,
      created_at
    )
    VALUES (
      format('seed_user_%s', lpad(((SELECT COUNT(*) FROM users) + 1)::text, 3, '0')),
      public._drishyam_seed_phone(1000 + (SELECT COUNT(*) FROM users) + 1),
      format('seed_user_%s@seed.drishyam.ai', lpad(((SELECT COUNT(*) FROM users) + 1)::text, 3, '0')),
      hash_password,
      format('Seed User %s', lpad(((SELECT COUNT(*) FROM users) + 1)::text, 3, '0')),
      CASE ((SELECT COUNT(*) FROM users) + 1) % 8
        WHEN 0 THEN 'court'
        WHEN 1 THEN 'common'
        WHEN 2 THEN 'common'
        WHEN 3 THEN 'common'
        WHEN 4 THEN 'bank'
        WHEN 5 THEN 'police'
        WHEN 6 THEN 'government'
        ELSE 'telecom'
      END,
      TRUE,
      100 + (((SELECT COUNT(*) FROM users) + 1) % 35),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM users) + 1)
    );
  END LOOP;

  SELECT array_agg(id ORDER BY id) INTO user_ids FROM users;
  SELECT array_agg(id ORDER BY id) INTO common_user_ids FROM users WHERE role = 'common';
  SELECT array_agg(id ORDER BY id) INTO privileged_user_ids
  FROM users
  WHERE role IN ('admin', 'bank', 'police', 'government', 'telecom', 'court');
  SELECT COALESCE(
    (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
    (SELECT id FROM users ORDER BY id LIMIT 1)
  ) INTO admin_id;
  IF common_user_ids IS NULL THEN
    common_user_ids := user_ids;
  END IF;
  IF privileged_user_ids IS NULL THEN
    privileged_user_ids := user_ids;
  END IF;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM suspicious_numbers;
  FOR idx IN 1..missing LOOP
    INSERT INTO suspicious_numbers (phone_number, reputation_score, category, last_seen, report_count)
    VALUES (
      '+91' || (7000000000 + (SELECT COUNT(*) FROM suspicious_numbers) + 1)::text,
      ROUND((0.62 + (((SELECT COUNT(*) FROM suspicious_numbers) + 1) % 30) * 0.01)::numeric, 2),
      (ARRAY['banking_scam', 'job_scam', 'upi_trap', 'telecom_fraud'])[((SELECT COUNT(*) FROM suspicious_numbers) % 4) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM suspicious_numbers) + 1),
      5 + (((SELECT COUNT(*) FROM suspicious_numbers) + 1) % 40)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM honeypot_personas;
  FOR idx IN 1..missing LOOP
    INSERT INTO honeypot_personas (name, language, speaker, pace, created_at)
    VALUES (
      format('Seed Persona %s', lpad(((SELECT COUNT(*) FROM honeypot_personas) + 1)::text, 2, '0')),
      CASE ((SELECT COUNT(*) FROM honeypot_personas) + 1) % 2 WHEN 0 THEN 'en-IN' ELSE 'hi-IN' END,
      CASE ((SELECT COUNT(*) FROM honeypot_personas) + 1) % 3 WHEN 0 THEN 'Female' ELSE 'Male' END,
      ROUND((0.8 + (((SELECT COUNT(*) FROM honeypot_personas) + 1) % 5) * 0.08)::numeric, 2),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM honeypot_personas) + 1)
    )
    ON CONFLICT (name) DO NOTHING;
  END LOOP;
  SELECT array_agg(name ORDER BY id) INTO persona_names FROM honeypot_personas;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM scam_clusters;
  FOR idx IN 1..missing LOOP
    INSERT INTO scam_clusters (
      cluster_id,
      risk_level,
      location,
      lat,
      lng,
      linked_vpas,
      honeypot_hits,
      status,
      created_at
    )
    VALUES (
      format('CL-%s', lpad(((SELECT COUNT(*) FROM scam_clusters) + 1)::text, 4, '0')),
      (ARRAY['CRITICAL', 'HIGH', 'MEDIUM'])[((SELECT COUNT(*) FROM scam_clusters) % 3) + 1],
      (ARRAY['Delhi', 'Mumbai', 'Jaipur', 'Lucknow', 'Kolkata', 'Chennai', 'Bhopal', 'Patna'])[((SELECT COUNT(*) FROM scam_clusters) % 8) + 1],
      18.0 + (((SELECT COUNT(*) FROM scam_clusters) + 1) % 10),
      72.0 + (((SELECT COUNT(*) FROM scam_clusters) + 1) % 10),
      3 + (((SELECT COUNT(*) FROM scam_clusters) + 1) % 9),
      5 + (((SELECT COUNT(*) FROM scam_clusters) + 1) % 15),
      CASE (((SELECT COUNT(*) FROM scam_clusters) + 1) % 4) WHEN 0 THEN 'monitoring' ELSE 'active' END,
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM scam_clusters) + 1)
    )
    ON CONFLICT (cluster_id) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM honeypot_entities;
  FOR idx IN 1..missing LOOP
    INSERT INTO honeypot_entities (
      entity_type,
      entity_value,
      first_seen,
      last_seen,
      risk_score
    )
    VALUES (
      CASE ((SELECT COUNT(*) FROM honeypot_entities) + 1) % 2 WHEN 0 THEN 'PHONE' ELSE 'VPA' END,
      format('seed%s@upi', lpad(((SELECT COUNT(*) FROM honeypot_entities) + 1)::text, 3, '0')),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM honeypot_entities) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM honeypot_entities)),
      ROUND((0.55 + (((SELECT COUNT(*) FROM honeypot_entities) + 1) % 35) * 0.01)::numeric, 2)
    )
    ON CONFLICT (entity_value) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM system_stats;
  FOR idx IN 1..missing LOOP
    INSERT INTO system_stats (category, key, value, metadata_json, updated_at)
    VALUES (
      format('seed_category_%s', lpad((((SELECT COUNT(*) FROM system_stats)) / 5 + 1)::text, 2, '0')),
      format('metric_%s', lpad(((SELECT COUNT(*) FROM system_stats) + 1)::text, 3, '0')),
      ((SELECT COUNT(*) FROM system_stats) + 11)::text,
      jsonb_build_object('seed', TRUE, 'label', format('Seed metric %s', (SELECT COUNT(*) FROM system_stats) + 1)),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM system_stats) + 1)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM call_records;
  FOR idx IN 1..missing LOOP
    INSERT INTO call_records (
      caller_num,
      receiver_num,
      timestamp,
      duration,
      call_type,
      metadata_json,
      fraud_risk_score,
      verdict
    )
    VALUES (
      '+91' || (7000000000 + (((SELECT COUNT(*) FROM call_records) + 1) % 5000))::text,
      public._drishyam_seed_phone(5000 + (((SELECT COUNT(*) FROM call_records) + 1) % GREATEST(array_length(common_user_ids, 1), 1))),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM call_records) + 1),
      45 + (((SELECT COUNT(*) FROM call_records) + 1) % 360),
      CASE ((SELECT COUNT(*) FROM call_records) + 1) % 2 WHEN 0 THEN 'outgoing' ELSE 'incoming' END,
      jsonb_build_object(
        'location', (ARRAY['Delhi', 'Noida', 'Mumbai', 'Jaipur'])[((SELECT COUNT(*) FROM call_records) % 4) + 1],
        'imei', substring(md5(((SELECT COUNT(*) FROM call_records) + 1)::text) for 15),
        'sim_age', (((SELECT COUNT(*) FROM call_records) + 7) % 18)::text || ' months'
      ),
      ROUND((0.45 + (((SELECT COUNT(*) FROM call_records) + 1) % 40) * 0.01)::numeric, 2),
      (ARRAY['safe', 'suspicious', 'scam'])[((SELECT COUNT(*) FROM call_records) % 3) + 1]
    );
  END LOOP;

  SELECT array_agg(id ORDER BY id) INTO call_ids FROM call_records;
  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM detection_details;
  FOR idx IN 1..missing LOOP
    INSERT INTO detection_details (call_id, feature_name, feature_value, impact_score)
    VALUES (
      call_ids[((idx - 1) % array_length(call_ids, 1)) + 1],
      (ARRAY['velocity', 'geo_anomaly', 'device_switch', 'repeat_target'])[((SELECT COUNT(*) FROM detection_details) % 4) + 1],
      ROUND((0.5 + (((SELECT COUNT(*) FROM detection_details) + 1) % 30) * 0.1)::numeric, 2),
      ROUND((0.2 + (((SELECT COUNT(*) FROM detection_details) + 1) % 10) * 0.05)::numeric, 2)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM simulation_requests;
  FOR idx IN 1..missing LOOP
    INSERT INTO simulation_requests (phone_number, status, requested_at, processed_at)
    VALUES (
      public._drishyam_seed_phone(2000 + (SELECT COUNT(*) FROM simulation_requests) + 1),
      (ARRAY['pending', 'approved', 'rejected'])[((SELECT COUNT(*) FROM simulation_requests) % 3) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM simulation_requests) + 1),
      CASE (((SELECT COUNT(*) FROM simulation_requests) + 1) % 3)
        WHEN 0 THEN NULL
        ELSE public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM simulation_requests))
      END
    )
    ON CONFLICT (phone_number) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM mule_ads;
  FOR idx IN 1..missing LOOP
    INSERT INTO mule_ads (title, salary, platform, risk_score, status, recruiter_id, metadata_json, created_at)
    VALUES (
      format(
        '%s %s',
        (ARRAY['Remote Treasury Assistant', 'E-Commerce Reviewer', 'Crypto Settlements Agent', 'Payment Escrow Handler'])[((SELECT COUNT(*) FROM mule_ads) % 4) + 1],
        lpad(((SELECT COUNT(*) FROM mule_ads) + 1)::text, 2, '0')
      ),
      '₹' || (25 + (((SELECT COUNT(*) FROM mule_ads) + 1) % 50))::text || ',000 / month',
      (ARRAY['Telegram', 'WhatsApp', 'Instagram', 'LinkedIn'])[((SELECT COUNT(*) FROM mule_ads) % 4) + 1],
      ROUND((0.72 + (((SELECT COUNT(*) FROM mule_ads) + 1) % 20) * 0.01)::numeric, 2),
      CASE ((SELECT COUNT(*) FROM mule_ads) + 1) % 2 WHEN 0 THEN 'Escalated' ELSE 'Mule Campaign' END,
      format('REC-%s', lpad(((SELECT COUNT(*) FROM mule_ads) + 1)::text, 4, '0')),
      jsonb_build_object('seed', TRUE, 'region', (ARRAY['North', 'West', 'South'])[((SELECT COUNT(*) FROM mule_ads) % 3) + 1]),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM mule_ads) + 1)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM crime_reports;
  FOR idx IN 1..missing LOOP
    INSERT INTO crime_reports (
      report_id,
      category,
      scam_type,
      amount,
      platform,
      priority,
      status,
      reporter_num,
      metadata_json,
      created_at
    )
    VALUES (
      format('REP-%s', lpad(((SELECT COUNT(*) FROM crime_reports) + 1)::text, 5, '0')),
      (ARRAY['police', 'bank', 'telecom'])[((SELECT COUNT(*) FROM crime_reports) % 3) + 1],
      (ARRAY['KYC Scam', 'UPI Collect Fraud', 'Digital Arrest', 'Job Mule Fraud'])[((SELECT COUNT(*) FROM crime_reports) % 4) + 1],
      '₹' || (((SELECT COUNT(*) FROM crime_reports) + 1) * 3250)::text,
      (ARRAY['WhatsApp', 'UPI', 'Voice Call', 'Telegram'])[((SELECT COUNT(*) FROM crime_reports) % 4) + 1],
      (ARRAY['MEDIUM', 'HIGH', 'CRITICAL'])[((SELECT COUNT(*) FROM crime_reports) % 3) + 1],
      (ARRAY['PENDING', 'RESOLVED', 'FROZEN', 'RECOVERED'])[((SELECT COUNT(*) FROM crime_reports) % 4) + 1],
      public._drishyam_seed_phone(3000 + (((SELECT COUNT(*) FROM crime_reports) + 1) % 5000)),
      jsonb_build_object(
        'vpa', format('report%s@upi', lpad(((SELECT COUNT(*) FROM crime_reports) + 1)::text, 3, '0')),
        'holder', format('Seed Holder %s', lpad(((SELECT COUNT(*) FROM crime_reports) + 1)::text, 2, '0')),
        'bank_name', (ARRAY['SBI', 'HDFC', 'ICICI', 'Axis'])[((SELECT COUNT(*) FROM crime_reports) % 4) + 1],
        'txn_id', format('TXN-%s', lpad(((SELECT COUNT(*) FROM crime_reports) + 1)::text, 8, '0')),
        'entities', jsonb_build_array(
          jsonb_build_object('type', 'Phone', 'value', public._drishyam_seed_phone(3000 + (((SELECT COUNT(*) FROM crime_reports) + 1) % 5000))),
          jsonb_build_object('type', 'VPA', 'value', format('report%s@upi', lpad(((SELECT COUNT(*) FROM crime_reports) + 1)::text, 3, '0')))
        )
      ),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM crime_reports) + 1)
    )
    ON CONFLICT (report_id) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM file_uploads;
  FOR idx IN 1..missing LOOP
    INSERT INTO file_uploads (
      user_id,
      filename,
      file_path,
      mime_type,
      status,
      verdict,
      confidence_score,
      risk_level,
      metadata_json,
      created_at
    )
    VALUES (
      user_ids[((idx - 1) % array_length(user_ids, 1)) + 1],
      format('seed_forensic_%s.pdf', lpad(((SELECT COUNT(*) FROM file_uploads) + 1)::text, 3, '0')),
      format('static/uploads/seed_forensic_%s.pdf', lpad(((SELECT COUNT(*) FROM file_uploads) + 1)::text, 3, '0')),
      (ARRAY['image/jpeg', 'video/mp4', 'application/pdf'])[((SELECT COUNT(*) FROM file_uploads) % 3) + 1],
      'COMPLETED',
      (ARRAY['REAL', 'SUSPICIOUS', 'FAKE'])[((SELECT COUNT(*) FROM file_uploads) % 3) + 1],
      ROUND((0.72 + (((SELECT COUNT(*) FROM file_uploads) + 1) % 25) * 0.01)::numeric, 2),
      (ARRAY['LOW', 'MEDIUM', 'HIGH'])[((SELECT COUNT(*) FROM file_uploads) % 3) + 1],
      jsonb_build_object(
        'forensic', jsonb_build_object(
          'anomalies',
          CASE (((SELECT COUNT(*) FROM file_uploads) + 1) % 3)
            WHEN 0 THEN jsonb_build_array('Edge blending mismatch', 'Metadata drift')
            ELSE '[]'::jsonb
          END
        ),
        'ai', jsonb_build_object(
          'analysis_details', jsonb_build_object(
            'lip_sync_match', CASE (((SELECT COUNT(*) FROM file_uploads) + 1) % 3) WHEN 2 THEN 'Failed' ELSE 'Verified' END,
            'visual_artifacts', CASE (((SELECT COUNT(*) FROM file_uploads) + 1) % 3) WHEN 1 THEN 'Detected' ELSE 'None' END
          )
        )
      ),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM file_uploads) + 1)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM trust_links;
  FOR idx IN 1..missing LOOP
    INSERT INTO trust_links (
      user_id,
      guardian_name,
      guardian_phone,
      guardian_email,
      relation_type,
      created_at
    )
    VALUES (
      common_user_ids[((idx - 1) % array_length(common_user_ids, 1)) + 1],
      format('Guardian %s', lpad(((SELECT COUNT(*) FROM trust_links) + 1)::text, 2, '0')),
      public._drishyam_seed_phone(4000 + (SELECT COUNT(*) FROM trust_links) + 1),
      format('guardian%s@seed.drishyam.ai', lpad(((SELECT COUNT(*) FROM trust_links) + 1)::text, 2, '0')),
      (ARRAY['Father', 'Mother', 'Brother', 'Daughter'])[((SELECT COUNT(*) FROM trust_links) % 4) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM trust_links) + 1)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM bank_node_rules;
  FOR idx IN 1..missing LOOP
    INSERT INTO bank_node_rules (bank_name, rule_type, threshold, action, is_active, created_at)
    VALUES (
      (ARRAY['SBI', 'HDFC', 'ICICI', 'Axis', 'PNB', 'BOB'])[((SELECT COUNT(*) FROM bank_node_rules) % 6) + 1],
      (ARRAY['AMOUNT_THRESHOLD', 'VELOCITY', 'BLACKLIST', 'GEO_MISMATCH'])[((SELECT COUNT(*) FROM bank_node_rules) % 4) + 1],
      5000 + (((SELECT COUNT(*) FROM bank_node_rules) + 1) * 250),
      (ARRAY['FREEZE', 'FLAG', 'REVIEW'])[((SELECT COUNT(*) FROM bank_node_rules) % 3) + 1],
      (((SELECT COUNT(*) FROM bank_node_rules) + 1) % 5) <> 0,
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM bank_node_rules) + 1)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM system_audit_logs;
  FOR idx IN 1..missing LOOP
    INSERT INTO system_audit_logs (user_id, action, resource, ip_address, timestamp, metadata_json)
    VALUES (
      user_ids[((idx - 1) % array_length(user_ids, 1)) + 1],
      (ARRAY['LOGIN', 'VIEW_CASE', 'EXPORT_GRAPH', 'FREEZE_VPA', 'CONSENT_GRANTED'])[((SELECT COUNT(*) FROM system_audit_logs) % 5) + 1],
      format('seed_resource_%s', lpad(((SELECT COUNT(*) FROM system_audit_logs) + 1)::text, 3, '0')),
      format('10.0.0.%s', (((SELECT COUNT(*) FROM system_audit_logs) + 1) % 254) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM system_audit_logs) + 1),
      jsonb_build_object('seed', TRUE, 'channel', 'SQL_TOPUP')
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM citizen_consents;
  FOR idx IN 1..missing LOOP
    INSERT INTO citizen_consents (
      user_id,
      phone_number,
      status,
      channel,
      policy_version,
      scopes_json,
      metadata_json,
      given_at,
      revoked_at,
      updated_at
    )
    VALUES (
      common_user_ids[((idx - 1) % array_length(common_user_ids, 1)) + 1],
      public._drishyam_seed_phone(5000 + (SELECT COUNT(*) FROM citizen_consents) + 1),
      CASE (((SELECT COUNT(*) FROM citizen_consents) + 1) % 6) WHEN 0 THEN 'REVOKED' ELSE 'ACTIVE' END,
      CASE (((SELECT COUNT(*) FROM citizen_consents) + 1) % 2) WHEN 0 THEN 'MOBILE_APP' ELSE 'SIMULATION_PORTAL' END,
      'MVP-2026.03',
      jsonb_build_object(
        'awareness', TRUE,
        'alerts', TRUE,
        'fraud_response', TRUE,
        'reporting', (((SELECT COUNT(*) FROM citizen_consents) + 1) % 4) <> 0
      ),
      jsonb_build_object('seed', TRUE, 'source', 'sql_topup'),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM citizen_consents) + 1),
      CASE (((SELECT COUNT(*) FROM citizen_consents) + 1) % 6)
        WHEN 0 THEN public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM citizen_consents))
        ELSE NULL
      END,
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM citizen_consents) + 1)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM notification_logs;
  FOR idx IN 1..missing LOOP
    INSERT INTO notification_logs (recipient, channel, template_id, status, sent_at, metadata_json)
    VALUES (
      public._drishyam_seed_phone(6000 + (SELECT COUNT(*) FROM notification_logs) + 1),
      (ARRAY['SMS', 'WHATSAPP', 'EMAIL'])[((SELECT COUNT(*) FROM notification_logs) % 3) + 1],
      format('TPL-%s', lpad(((SELECT COUNT(*) FROM notification_logs) + 1)::text, 3, '0')),
      (ARRAY['SENT', 'DELIVERED', 'FAILED'])[((SELECT COUNT(*) FROM notification_logs) % 3) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM notification_logs) + 1),
      jsonb_build_object('seed', TRUE, 'campaign', format('campaign_%s', (((SELECT COUNT(*) FROM notification_logs) % 5) + 1)))
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM recovery_cases;
  FOR idx IN 1..missing LOOP
    INSERT INTO recovery_cases (
      user_id,
      incident_id,
      bank_status,
      rbi_status,
      insurance_status,
      legal_aid_status,
      total_recovered,
      created_at,
      updated_at
    )
    VALUES (
      common_user_ids[((idx - 1) % array_length(common_user_ids, 1)) + 1],
      format('INC-SEED-%s', lpad(((SELECT COUNT(*) FROM recovery_cases) + 1)::text, 4, '0')),
      (ARRAY['PENDING', 'INVESTIGATING', 'FROZEN', 'RECOVERED'])[((SELECT COUNT(*) FROM recovery_cases) % 4) + 1],
      (ARRAY['NOT_STARTED', 'READY_FOR_SUBMISSION', 'SUBMITTED'])[((SELECT COUNT(*) FROM recovery_cases) % 3) + 1],
      (ARRAY['NOT_STARTED', 'SUBMITTED', 'APPROVED'])[((SELECT COUNT(*) FROM recovery_cases) % 3) + 1],
      (ARRAY['NOT_STARTED', 'REFERRED', 'ASSIGNED'])[((SELECT COUNT(*) FROM recovery_cases) % 3) + 1],
      (((SELECT COUNT(*) FROM recovery_cases) + 1) % 12) * 2500,
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM recovery_cases) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM recovery_cases))
    )
    ON CONFLICT (incident_id) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM intelligence_alerts;
  FOR idx IN 1..missing LOOP
    INSERT INTO intelligence_alerts (severity, message, location, category, is_active, created_at)
    VALUES (
      (ARRAY['CRITICAL', 'HIGH', 'MEDIUM'])[((SELECT COUNT(*) FROM intelligence_alerts) % 3) + 1],
      format('Seed intelligence alert %s detected elevated fraud chatter.', lpad(((SELECT COUNT(*) FROM intelligence_alerts) + 1)::text, 3, '0')),
      (ARRAY['Delhi', 'Mumbai', 'Noida', 'Kolkata', 'Jaipur'])[((SELECT COUNT(*) FROM intelligence_alerts) % 5) + 1],
      (ARRAY['VPA_ROTATION', 'SCAM_POD', 'MULE_CLUSTER', 'DEEPFAKE_SURGE'])[((SELECT COUNT(*) FROM intelligence_alerts) % 4) + 1],
      (((SELECT COUNT(*) FROM intelligence_alerts) + 1) % 5) <> 0,
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM intelligence_alerts) + 1)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM pilot_programs;
  FOR idx IN 1..missing LOOP
    INSERT INTO pilot_programs (
      pilot_id,
      name,
      geography,
      telecom_partner,
      bank_partners_json,
      agencies_json,
      languages_json,
      scam_categories_json,
      dashboard_scope_json,
      success_metrics_json,
      training_status_json,
      communications_json,
      outcome_summary_json,
      launch_status,
      created_at,
      updated_at
    )
    VALUES (
      format('PILOT-%s', lpad(((SELECT COUNT(*) FROM pilot_programs) + 1)::text, 4, '0')),
      format('Seed Pilot %s', lpad(((SELECT COUNT(*) FROM pilot_programs) + 1)::text, 2, '0')),
      (ARRAY['Delhi NCR', 'UP West', 'Rajasthan', 'Kolkata'])[((SELECT COUNT(*) FROM pilot_programs) % 4) + 1],
      (ARRAY['Jio', 'Airtel', 'VI'])[((SELECT COUNT(*) FROM pilot_programs) % 3) + 1],
      '["SBI", "HDFC"]'::jsonb,
      '["Delhi Police", "RBI Cell"]'::jsonb,
      '["hi", "en"]'::jsonb,
      '["UPI", "KYC", "Deepfake"]'::jsonb,
      '["command", "agency", "recovery"]'::jsonb,
      jsonb_build_object('freeze_time_min', 15, 'awareness_reach', 10000 + (((SELECT COUNT(*) FROM pilot_programs) + 1) * 50)),
      jsonb_build_object('police', 'READY', 'bank', 'READY', 'telecom', 'IN_PROGRESS'),
      jsonb_build_object('sms', TRUE, 'ivr', TRUE, 'broadcast', (((SELECT COUNT(*) FROM pilot_programs) + 1) % 2) = 0),
      jsonb_build_object('status', 'SEED', 'baseline_score', 60 + (((SELECT COUNT(*) FROM pilot_programs) + 1) % 20)),
      (ARRAY['CONFIGURING', 'READY', 'LIVE'])[((SELECT COUNT(*) FROM pilot_programs) % 3) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM pilot_programs) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM pilot_programs))
    )
    ON CONFLICT (pilot_id) DO NOTHING;
  END LOOP;
  SELECT array_agg(id ORDER BY id) INTO pilot_ids FROM pilot_programs;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM pilot_feedback;
  FOR idx IN 1..missing LOOP
    INSERT INTO pilot_feedback (
      pilot_program_id,
      stakeholder_type,
      source_agency,
      sentiment,
      message,
      status,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      pilot_ids[((idx - 1) % array_length(pilot_ids, 1)) + 1],
      (ARRAY['POLICE', 'BANK', 'TELECOM', 'CITIZEN'])[((SELECT COUNT(*) FROM pilot_feedback) % 4) + 1],
      (ARRAY['Delhi Police', 'SBI', 'Airtel', 'Citizen App'])[((SELECT COUNT(*) FROM pilot_feedback) % 4) + 1],
      (ARRAY['POSITIVE', 'NEUTRAL', 'ACTION_REQUIRED'])[((SELECT COUNT(*) FROM pilot_feedback) % 3) + 1],
      format('Seed pilot feedback %s recorded for rollout readiness tracking.', lpad(((SELECT COUNT(*) FROM pilot_feedback) + 1)::text, 3, '0')),
      (ARRAY['OPEN', 'TRACKED', 'CLOSED'])[((SELECT COUNT(*) FROM pilot_feedback) % 3) + 1],
      jsonb_build_object('seed', TRUE, 'severity', (ARRAY['LOW', 'MEDIUM', 'HIGH'])[((SELECT COUNT(*) FROM pilot_feedback) % 3) + 1]),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM pilot_feedback) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM pilot_feedback))
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM partner_pipeline;
  FOR idx IN 1..missing LOOP
    INSERT INTO partner_pipeline (
      account_name,
      segment,
      stage,
      owner,
      annual_value_inr,
      status,
      next_step,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      format('Seed Account %s', lpad(((SELECT COUNT(*) FROM partner_pipeline) + 1)::text, 2, '0')),
      (ARRAY['B2G', 'BANK', 'TELECOM', 'ENTERPRISE', 'INSURER'])[((SELECT COUNT(*) FROM partner_pipeline) % 5) + 1],
      (ARRAY['LEAD', 'DISCOVERY', 'PROPOSAL', 'PILOT', 'ACTIVE'])[((SELECT COUNT(*) FROM partner_pipeline) % 5) + 1],
      format('Owner %s', (((SELECT COUNT(*) FROM partner_pipeline) + 1) % 6) + 1),
      250000 + (((SELECT COUNT(*) FROM partner_pipeline) + 1) * 17500),
      (ARRAY['OPEN', 'WON', 'ON_HOLD'])[((SELECT COUNT(*) FROM partner_pipeline) % 3) + 1],
      format('Follow-up step %s', lpad(((SELECT COUNT(*) FROM partner_pipeline) + 1)::text, 2, '0')),
      jsonb_build_object('seed', TRUE, 'region', (ARRAY['North', 'West', 'South'])[((SELECT COUNT(*) FROM partner_pipeline) % 3) + 1]),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM partner_pipeline) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM partner_pipeline))
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM billing_records;
  FOR idx IN 1..missing LOOP
    INSERT INTO billing_records (
      partner_name,
      plan_name,
      invoice_number,
      amount_inr,
      tax_inr,
      billing_status,
      subscription_status,
      billing_cycle,
      due_date,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      format('Seed Partner Billing %s', lpad(((SELECT COUNT(*) FROM billing_records) + 1)::text, 2, '0')),
      (ARRAY['Launch', 'Pilot', 'Scale'])[((SELECT COUNT(*) FROM billing_records) % 3) + 1],
      format('INV-SEED-%s', lpad(((SELECT COUNT(*) FROM billing_records) + 1)::text, 5, '0')),
      50000 + (((SELECT COUNT(*) FROM billing_records) + 1) * 2750),
      9000 + (((SELECT COUNT(*) FROM billing_records) + 1) * 250),
      (ARRAY['DRAFT', 'ISSUED', 'PAID', 'OVERDUE'])[((SELECT COUNT(*) FROM billing_records) % 4) + 1],
      (ARRAY['ACTIVE', 'TRIAL', 'EXPIRING'])[((SELECT COUNT(*) FROM billing_records) % 3) + 1],
      (ARRAY['MONTHLY', 'QUARTERLY', 'YEARLY'])[((SELECT COUNT(*) FROM billing_records) % 3) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM billing_records) - 10),
      jsonb_build_object('seed', TRUE),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM billing_records) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM billing_records))
    )
    ON CONFLICT (invoice_number) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM support_tickets;
  FOR idx IN 1..missing LOOP
    INSERT INTO support_tickets (
      ticket_id,
      channel,
      stakeholder_type,
      severity,
      incident_classification,
      queue_name,
      status,
      owner,
      resolution_eta_min,
      summary,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      format('SUP-SEED-%s', lpad(((SELECT COUNT(*) FROM support_tickets) + 1)::text, 5, '0')),
      (ARRAY['EMAIL', 'PHONE', 'DASHBOARD', 'WHATSAPP'])[((SELECT COUNT(*) FROM support_tickets) % 4) + 1],
      (ARRAY['BANK', 'POLICE', 'TELECOM', 'GOVERNMENT'])[((SELECT COUNT(*) FROM support_tickets) % 4) + 1],
      (ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])[((SELECT COUNT(*) FROM support_tickets) % 4) + 1],
      (ARRAY['INTEGRATION', 'OPS', 'SECURITY', 'BILLING'])[((SELECT COUNT(*) FROM support_tickets) % 4) + 1],
      (ARRAY['L1', 'L2', 'Escalation'])[((SELECT COUNT(*) FROM support_tickets) % 3) + 1],
      (ARRAY['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'])[((SELECT COUNT(*) FROM support_tickets) % 4) + 1],
      format('Analyst %s', (((SELECT COUNT(*) FROM support_tickets) + 1) % 8) + 1),
      30 + (((SELECT COUNT(*) FROM support_tickets) + 1) * 3),
      format('Seed support ticket %s', lpad(((SELECT COUNT(*) FROM support_tickets) + 1)::text, 3, '0')),
      jsonb_build_object('seed', TRUE),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM support_tickets) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM support_tickets))
    )
    ON CONFLICT (ticket_id) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM governance_reviews;
  FOR idx IN 1..missing LOOP
    INSERT INTO governance_reviews (
      review_id,
      board_type,
      title,
      cadence,
      status,
      next_review_at,
      outcome_summary,
      recommendations_json,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      format('GR-SEED-%s', lpad(((SELECT COUNT(*) FROM governance_reviews) + 1)::text, 5, '0')),
      (ARRAY['Steering', 'Risk', 'Privacy', 'Fraud Ops'])[((SELECT COUNT(*) FROM governance_reviews) % 4) + 1],
      format('Seed governance review %s', lpad(((SELECT COUNT(*) FROM governance_reviews) + 1)::text, 2, '0')),
      (ARRAY['WEEKLY', 'MONTHLY', 'QUARTERLY'])[((SELECT COUNT(*) FROM governance_reviews) % 3) + 1],
      (ARRAY['SCHEDULED', 'COMPLETE'])[((SELECT COUNT(*) FROM governance_reviews) % 2) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM governance_reviews) - 20),
      format('Seed review outcome %s', lpad(((SELECT COUNT(*) FROM governance_reviews) + 1)::text, 2, '0')),
      jsonb_build_array(
        format('Recommendation %s', lpad(((SELECT COUNT(*) FROM governance_reviews) + 1)::text, 2, '0')),
        format('Follow-up %s', lpad(((SELECT COUNT(*) FROM governance_reviews) + 1)::text, 2, '0'))
      ),
      jsonb_build_object('seed', TRUE),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM governance_reviews) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM governance_reviews))
    )
    ON CONFLICT (review_id) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM partner_integrations;
  FOR idx IN 1..missing LOOP
    INSERT INTO partner_integrations (
      partner_name,
      segment,
      owner,
      region_scope,
      mou_status,
      sandbox_access_status,
      production_access_status,
      api_access_status,
      credential_status,
      sla_status,
      escalation_contact,
      next_milestone,
      status,
      last_checked_at,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      format('Seed Integration Partner %s', lpad(((SELECT COUNT(*) FROM partner_integrations) + 1)::text, 2, '0')),
      (ARRAY['BANK', 'TELECOM', 'GOVERNMENT', 'INSURER'])[((SELECT COUNT(*) FROM partner_integrations) % 4) + 1],
      format('Program Owner %s', (((SELECT COUNT(*) FROM partner_integrations) + 1) % 5) + 1),
      (ARRAY['INDIA', 'NORTH', 'WEST', 'SOUTH'])[((SELECT COUNT(*) FROM partner_integrations) % 4) + 1],
      (ARRAY['DRAFT', 'SIGNED'])[((SELECT COUNT(*) FROM partner_integrations) % 2) + 1],
      (ARRAY['REQUESTED', 'READY'])[((SELECT COUNT(*) FROM partner_integrations) % 2) + 1],
      (ARRAY['PLANNED', 'LIVE'])[((SELECT COUNT(*) FROM partner_integrations) % 2) + 1],
      (ARRAY['PENDING', 'READY', 'LIVE'])[((SELECT COUNT(*) FROM partner_integrations) % 3) + 1],
      (ARRAY['NOT_ISSUED', 'ISSUED'])[((SELECT COUNT(*) FROM partner_integrations) % 2) + 1],
      (ARRAY['IN_NEGOTIATION', 'SIGNED'])[((SELECT COUNT(*) FROM partner_integrations) % 2) + 1],
      format('escalation%s@seed.drishyam.ai', lpad(((SELECT COUNT(*) FROM partner_integrations) + 1)::text, 2, '0')),
      format('Milestone %s', lpad(((SELECT COUNT(*) FROM partner_integrations) + 1)::text, 2, '0')),
      (ARRAY['ON_TRACK', 'AT_RISK', 'LIVE', 'BLOCKED'])[((SELECT COUNT(*) FROM partner_integrations) % 4) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM partner_integrations) + 1),
      jsonb_build_object('seed', TRUE),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM partner_integrations) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM partner_integrations))
    )
    ON CONFLICT (partner_name) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM agency_access_policies;
  FOR idx IN 1..missing LOOP
    INSERT INTO agency_access_policies (
      policy_id,
      name,
      role_scope,
      resource_scope,
      action_scope,
      region_scope,
      effect,
      active,
      conditions_json,
      created_at,
      updated_at
    )
    VALUES (
      format('ACP-SEED-%s', lpad(((SELECT COUNT(*) FROM agency_access_policies) + 1)::text, 5, '0')),
      format('Seed Policy %s', lpad(((SELECT COUNT(*) FROM agency_access_policies) + 1)::text, 2, '0')),
      (ARRAY['bank', 'police', 'government', 'telecom', 'court', 'admin'])[((SELECT COUNT(*) FROM agency_access_policies) % 6) + 1],
      format('seed_resource_%s', lpad(((SELECT COUNT(*) FROM agency_access_policies) + 1)::text, 2, '0')),
      'READ',
      'INDIA',
      'ALLOW',
      FALSE,
      jsonb_build_object('seed', TRUE),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM agency_access_policies) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM agency_access_policies))
    )
    ON CONFLICT (policy_id) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM agency_sessions;
  FOR idx IN 1..missing LOOP
    INSERT INTO agency_sessions (
      session_uid,
      user_id,
      device_label,
      device_type,
      ip_address,
      network_zone,
      auth_stage,
      risk_level,
      status,
      last_seen_at,
      verified_at,
      revoked_at,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      format('AGS-SEED-%s', lpad(((SELECT COUNT(*) FROM agency_sessions) + 1)::text, 5, '0')),
      privileged_user_ids[((idx - 1) % array_length(privileged_user_ids, 1)) + 1],
      format('Seed Device %s', lpad(((SELECT COUNT(*) FROM agency_sessions) + 1)::text, 2, '0')),
      (ARRAY['WEB', 'MOBILE', 'WARROOM'])[((SELECT COUNT(*) FROM agency_sessions) % 3) + 1],
      format('10.10.0.%s', (((SELECT COUNT(*) FROM agency_sessions) + 1) % 254) + 1),
      (ARRAY['HQ', 'BANK_NOC', 'POLICE_CELL'])[((SELECT COUNT(*) FROM agency_sessions) % 3) + 1],
      (ARRAY['PASSWORD_ONLY', 'MFA_VERIFIED'])[((SELECT COUNT(*) FROM agency_sessions) % 2) + 1],
      (ARRAY['LOW', 'MEDIUM', 'HIGH'])[((SELECT COUNT(*) FROM agency_sessions) % 3) + 1],
      (ARRAY['ACTIVE', 'REVOKED', 'EXPIRED'])[((SELECT COUNT(*) FROM agency_sessions) % 3) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM agency_sessions) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM agency_sessions)),
      NULL,
      jsonb_build_object('seed', TRUE),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM agency_sessions) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM agency_sessions))
    )
    ON CONFLICT (session_uid) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM admin_approvals;
  FOR idx IN 1..missing LOOP
    INSERT INTO admin_approvals (
      approval_id,
      requested_by_user_id,
      approver_user_id,
      action_type,
      resource,
      risk_level,
      justification,
      status,
      expires_at,
      decided_at,
      metadata_json,
      created_at,
      updated_at
    )
    VALUES (
      format('APR-SEED-%s', lpad(((SELECT COUNT(*) FROM admin_approvals) + 1)::text, 5, '0')),
      privileged_user_ids[((idx - 1) % array_length(privileged_user_ids, 1)) + 1],
      admin_id,
      (ARRAY['FREEZE_VPA', 'BLOCK_IMEI', 'EXPORT_GRAPH'])[((SELECT COUNT(*) FROM admin_approvals) % 3) + 1],
      format('seed_resource_%s', lpad(((SELECT COUNT(*) FROM admin_approvals) + 1)::text, 3, '0')),
      (ARRAY['MEDIUM', 'HIGH', 'CRITICAL'])[((SELECT COUNT(*) FROM admin_approvals) % 3) + 1],
      format('Seed approval request %s', lpad(((SELECT COUNT(*) FROM admin_approvals) + 1)::text, 3, '0')),
      (ARRAY['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED'])[((SELECT COUNT(*) FROM admin_approvals) % 4) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM admin_approvals) - 2),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM admin_approvals) - 1),
      jsonb_build_object('seed', TRUE),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM admin_approvals) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM admin_approvals))
    )
    ON CONFLICT (approval_id) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM npci_logs;
  FOR idx IN 1..missing LOOP
    INSERT INTO npci_logs (vpa, action, status_code, message, reference_id, metadata_json, created_at)
    VALUES (
      format('seednpci%s@upi', lpad(((SELECT COUNT(*) FROM npci_logs) + 1)::text, 3, '0')),
      (ARRAY['VERIFY', 'BLOCK', 'DISPUTE', 'FREEZE'])[((SELECT COUNT(*) FROM npci_logs) % 4) + 1],
      (ARRAY['00', '91', '85'])[((SELECT COUNT(*) FROM npci_logs) % 3) + 1],
      format('Seed NPCI log %s', lpad(((SELECT COUNT(*) FROM npci_logs) + 1)::text, 3, '0')),
      format('NPCI-SEED-%s', lpad(((SELECT COUNT(*) FROM npci_logs) + 1)::text, 5, '0')),
      jsonb_build_object('seed', TRUE, 'channel', 'sql_topup'),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM npci_logs) + 1)
    )
    ON CONFLICT (reference_id) DO NOTHING;
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM honeypot_sessions;
  FOR idx IN 1..missing LOOP
    INSERT INTO honeypot_sessions (
      session_id,
      user_id,
      caller_num,
      customer_id,
      persona,
      status,
      direction,
      created_at,
      handoff_timestamp,
      metadata_json,
      recording_analysis_json
    )
    VALUES (
      format('H-SEED-%s', lpad(((SELECT COUNT(*) FROM honeypot_sessions) + 1)::text, 5, '0')),
      common_user_ids[((idx - 1) % array_length(common_user_ids, 1)) + 1],
      '+91' || (7600000000 + (SELECT COUNT(*) FROM honeypot_sessions) + 1)::text,
      format('seed_user_%s', lpad((((SELECT COUNT(*) FROM honeypot_sessions) + 1) % GREATEST(array_length(common_user_ids, 1), 1) + 1)::text, 3, '0')),
      persona_names[((idx - 1) % array_length(persona_names, 1)) + 1],
      (ARRAY['active', 'completed', 'paused'])[((SELECT COUNT(*) FROM honeypot_sessions) % 3) + 1],
      (ARRAY['outgoing', 'incoming', 'handoff'])[((SELECT COUNT(*) FROM honeypot_sessions) % 3) + 1],
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM honeypot_sessions) + 1),
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM honeypot_sessions)),
      jsonb_build_object('seed', TRUE, 'fatigue_score', 15 + (((SELECT COUNT(*) FROM honeypot_sessions) + 1) % 60)),
      jsonb_build_object('sentiment', (ARRAY['confused', 'hostile', 'neutral'])[((SELECT COUNT(*) FROM honeypot_sessions) % 3) + 1])
    )
    ON CONFLICT (session_id) DO NOTHING;
  END LOOP;

  SELECT array_agg(id ORDER BY id) INTO session_ids FROM honeypot_sessions;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM honeypot_messages;
  FOR idx IN 1..missing LOOP
    INSERT INTO honeypot_messages (session_id, role, content, audio_url, timestamp)
    VALUES (
      session_ids[((idx - 1) % array_length(session_ids, 1)) + 1],
      CASE ((SELECT COUNT(*) FROM honeypot_messages) + 1) % 2 WHEN 0 THEN 'assistant' ELSE 'user' END,
      format('Seed honeypot message %s', lpad(((SELECT COUNT(*) FROM honeypot_messages) + 1)::text, 3, '0')),
      NULL,
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM honeypot_messages) + 1)
    );
  END LOOP;

  SELECT GREATEST(0, target_rows - COUNT(*)) INTO missing FROM system_actions;
  FOR idx IN 1..missing LOOP
    INSERT INTO system_actions (user_id, action_type, target_id, metadata_json, status, created_at)
    VALUES (
      user_ids[((idx - 1) % array_length(user_ids, 1)) + 1],
      (ARRAY['VIEW_CASE', 'FREEZE_VPA', 'START_DRILL'])[((SELECT COUNT(*) FROM system_actions) % 3) + 1],
      format('seed_target_%s', lpad(((SELECT COUNT(*) FROM system_actions) + 1)::text, 3, '0')),
      jsonb_build_object('seed', TRUE),
      'success',
      public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM system_actions) + 1)
    );
  END LOOP;

  IF to_regclass('public.recovery_bundles') IS NOT NULL THEN
    EXECUTE $sql$
      DO $inner$
      DECLARE missing_local integer; idx_local integer;
      BEGIN
        SELECT GREATEST(0, 30 - COUNT(*)) INTO missing_local FROM recovery_bundles;
        FOR idx_local IN 1..missing_local LOOP
          INSERT INTO recovery_bundles (citizen_id, scam_type, bundle_id, file_urls, created_at)
          VALUES (
            public._drishyam_seed_phone(7000 + (SELECT COUNT(*) FROM recovery_bundles) + 1),
            (ARRAY['UPI', 'KYC', 'Deepfake'])[((SELECT COUNT(*) FROM recovery_bundles) % 3) + 1],
            format('BUNDLE-SEED-%s', lpad(((SELECT COUNT(*) FROM recovery_bundles) + 1)::text, 5, '0')),
            jsonb_build_array(
              format('/seed/bundle/%s/fir.pdf', lpad(((SELECT COUNT(*) FROM recovery_bundles) + 1)::text, 3, '0')),
              format('/seed/bundle/%s/bank.pdf', lpad(((SELECT COUNT(*) FROM recovery_bundles) + 1)::text, 3, '0'))
            ),
            public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM recovery_bundles) + 1)
          )
          ON CONFLICT (bundle_id) DO NOTHING;
        END LOOP;
      END
      $inner$;
    $sql$;
  END IF;

  IF to_regclass('public.reputation_audit') IS NOT NULL THEN
    EXECUTE $sql$
      DO $inner$
      DECLARE missing_local integer; idx_local integer;
      BEGIN
        SELECT GREATEST(0, 30 - COUNT(*)) INTO missing_local FROM reputation_audit;
        FOR idx_local IN 1..missing_local LOOP
          INSERT INTO reputation_audit (phone_number, old_score, new_score, change_reason, source_type, created_at)
          VALUES (
            '+91' || (7800000000 + (SELECT COUNT(*) FROM reputation_audit) + 1)::text,
            ROUND((0.25 + (((SELECT COUNT(*) FROM reputation_audit) + 1) % 10) * 0.04)::numeric, 2),
            ROUND((0.55 + (((SELECT COUNT(*) FROM reputation_audit) + 1) % 15) * 0.03)::numeric, 2),
            format('Seed reputation uplift %s', lpad(((SELECT COUNT(*) FROM reputation_audit) + 1)::text, 3, '0')),
            (ARRAY['HONEYPOT', 'NPCI', 'REPORT'])[((SELECT COUNT(*) FROM reputation_audit) % 3) + 1],
            public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM reputation_audit) + 1)
          );
        END LOOP;
      END
      $inner$;
    $sql$;
  END IF;

  IF to_regclass('public.ussd_logs') IS NOT NULL THEN
    EXECUTE $sql$
      DO $inner$
      DECLARE missing_local integer; idx_local integer;
      BEGIN
        SELECT GREATEST(0, 30 - COUNT(*)) INTO missing_local FROM ussd_logs;
        FOR idx_local IN 1..missing_local LOOP
          INSERT INTO ussd_logs (phone_number, ussd_code, action_taken, region, status, created_at)
          VALUES (
            public._drishyam_seed_phone(8000 + (SELECT COUNT(*) FROM ussd_logs) + 1),
            '*401#',
            (ARRAY['REPORT', 'CALLBACK', 'ALERT'])[((SELECT COUNT(*) FROM ussd_logs) % 3) + 1],
            (ARRAY['North', 'South', 'West', 'East'])[((SELECT COUNT(*) FROM ussd_logs) % 4) + 1],
            (ARRAY['success', 'queued', 'failed'])[((SELECT COUNT(*) FROM ussd_logs) % 3) + 1],
            public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM ussd_logs) + 1)
          );
        END LOOP;
      END
      $inner$;
    $sql$;
  END IF;

  IF to_regclass('public.public_alerts') IS NOT NULL THEN
    EXECUTE format($sql$
      DO $inner$
      DECLARE missing_local integer; idx_local integer; sender_id_local integer := %s;
      BEGIN
        SELECT GREATEST(0, 30 - COUNT(*)) INTO missing_local FROM public_alerts;
        FOR idx_local IN 1..missing_local LOOP
          INSERT INTO public_alerts (sender_id, category, target_region, message_text, status, citizen_reach, delivery_rate, created_at)
          VALUES (
            sender_id_local,
            (ARRAY['SCAM_SURGE', 'DEEPFAKE', 'UPI'])[((SELECT COUNT(*) FROM public_alerts) % 3) + 1],
            (ARRAY['Delhi', 'Mumbai', 'Rajasthan', 'UP West'])[((SELECT COUNT(*) FROM public_alerts) % 4) + 1],
            format('Seed public alert %s for citizen awareness.', lpad(((SELECT COUNT(*) FROM public_alerts) + 1)::text, 3, '0')),
            (ARRAY['dispatched', 'delivered', 'queued'])[((SELECT COUNT(*) FROM public_alerts) % 3) + 1],
            1000 + (((SELECT COUNT(*) FROM public_alerts) + 1) * 125),
            ROUND((82.0 + (((SELECT COUNT(*) FROM public_alerts) + 1) % 15))::numeric, 2),
            public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM public_alerts) + 1)
          );
        END LOOP;
      END
      $inner$;
    $sql$, admin_id);
  END IF;

  IF to_regclass('public.message_interceptions') IS NOT NULL THEN
    EXECUTE $sql$
      DO $inner$
      DECLARE missing_local integer; idx_local integer;
      BEGIN
        SELECT GREATEST(0, 30 - COUNT(*)) INTO missing_local FROM message_interceptions;
        FOR idx_local IN 1..missing_local LOOP
          INSERT INTO message_interceptions (sender_info, original_text, risk_score, verdict, detected_entities, metadata_json, created_at)
          VALUES (
            format('Seed Sender %s', lpad(((SELECT COUNT(*) FROM message_interceptions) + 1)::text, 3, '0')),
            format('Seed intercepted message %s requesting urgent KYC verification.', lpad(((SELECT COUNT(*) FROM message_interceptions) + 1)::text, 3, '0')),
            ROUND((0.45 + (((SELECT COUNT(*) FROM message_interceptions) + 1) % 40) * 0.01)::numeric, 2),
            (ARRAY['safe', 'suspicious', 'scam'])[((SELECT COUNT(*) FROM message_interceptions) % 3) + 1],
            jsonb_build_array(
              format('seed%s@upi', lpad(((SELECT COUNT(*) FROM message_interceptions) + 1)::text, 3, '0')),
              public._drishyam_seed_phone(9000 + (SELECT COUNT(*) FROM message_interceptions) + 1)
            ),
            jsonb_build_object('seed', TRUE, 'channel', (ARRAY['SMS', 'WhatsApp', 'Email'])[((SELECT COUNT(*) FROM message_interceptions) % 3) + 1]),
            public._drishyam_seed_shifted_now((SELECT COUNT(*) FROM message_interceptions) + 1)
          );
        END LOOP;
      END
      $inner$;
    $sql$;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public._drishyam_seed_phone(integer);
DROP FUNCTION IF EXISTS public._drishyam_seed_shifted_now(integer);

COMMIT;
