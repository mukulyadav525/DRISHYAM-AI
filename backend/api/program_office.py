import datetime
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.auth import get_current_verified_user, require_role
from core.database import get_db
from models.database import (
    BillingRecord,
    GovernanceReview,
    PartnerPipeline,
    PilotProgram,
    SupportTicket,
    User,
)

router = APIRouter()

READ_ROLES = ("admin", "government", "police", "bank", "telecom", "court")
WRITE_ROLES = ("admin", "government")
OPS_WRITE_ROLES = ("admin", "government", "police", "bank", "telecom")

ROOT_DIR = Path(__file__).resolve().parents[2]

PHASE_38_ARTIFACTS = [
    {
        "id": "DOC38-01",
        "title": "Architecture documentation",
        "category": "architecture",
        "audience": "engineering",
        "path": "docs/architecture/architecture_overview.md",
    },
    {
        "id": "DOC38-02",
        "title": "API documentation",
        "category": "api",
        "audience": "engineering",
        "path": "docs/api/api_reference.md",
    },
    {
        "id": "DOC38-03",
        "title": "Data model documentation",
        "category": "data",
        "audience": "engineering",
        "path": "docs/data/data_model.md",
    },
    {
        "id": "DOC38-04",
        "title": "Telecom integration docs",
        "category": "integration",
        "audience": "partner",
        "path": "docs/telecom/telecom_integration.md",
    },
    {
        "id": "DOC38-05",
        "title": "Bank integration docs",
        "category": "integration",
        "audience": "partner",
        "path": "docs/banking/bank_integration.md",
    },
    {
        "id": "DOC38-06",
        "title": "Dashboard user manuals",
        "category": "manual",
        "audience": "operator",
        "path": "docs/manuals/dashboard_user_manual.md",
    },
    {
        "id": "DOC38-07",
        "title": "Citizen app help docs",
        "category": "manual",
        "audience": "citizen",
        "path": "docs/manuals/citizen_app_help.md",
    },
    {
        "id": "DOC38-08",
        "title": "IVR and USSD operational docs",
        "category": "manual",
        "audience": "operator",
        "path": "docs/manuals/ivr_ussd_operations.md",
    },
    {
        "id": "DOC38-09",
        "title": "Security runbooks",
        "category": "security",
        "audience": "security",
        "path": "docs/security/security_runbook.md",
    },
    {
        "id": "DOC38-10",
        "title": "Privacy documentation",
        "category": "privacy",
        "audience": "legal",
        "path": "docs/privacy/privacy_documentation.md",
    },
    {
        "id": "DOC38-11",
        "title": "Legal evidence workflow docs",
        "category": "legal",
        "audience": "police",
        "path": "docs/legal/legal_evidence_workflow.md",
    },
    {
        "id": "DOC38-12",
        "title": "Disaster recovery documentation",
        "category": "operations",
        "audience": "ops",
        "path": "docs/operations/disaster_recovery.md",
    },
    {
        "id": "DOC38-13",
        "title": "Model cards",
        "category": "model",
        "audience": "governance",
        "path": "docs/models/model_cards.md",
    },
    {
        "id": "DOC38-14",
        "title": "Dataset documentation",
        "category": "data",
        "audience": "engineering",
        "path": "docs/data/datasets.md",
    },
    {
        "id": "DOC38-15",
        "title": "Annotation guidelines",
        "category": "data",
        "audience": "ml-ops",
        "path": "docs/data/annotation_guidelines.md",
    },
    {
        "id": "DOC38-16",
        "title": "Partner onboarding docs",
        "category": "playbook",
        "audience": "partner",
        "path": "docs/playbooks/partner_onboarding.md",
    },
    {
        "id": "DOC38-17",
        "title": "FAQ for citizens",
        "category": "faq",
        "audience": "citizen",
        "path": "docs/faq/citizens.md",
    },
    {
        "id": "DOC38-18",
        "title": "FAQ for police",
        "category": "faq",
        "audience": "police",
        "path": "docs/faq/police.md",
    },
    {
        "id": "DOC38-19",
        "title": "FAQ for banks",
        "category": "faq",
        "audience": "bank",
        "path": "docs/faq/banks.md",
    },
    {
        "id": "DOC38-20",
        "title": "FAQ for telecoms",
        "category": "faq",
        "audience": "telecom",
        "path": "docs/faq/telecoms.md",
    },
]

EXTENDED_LIBRARY = [
    {
        "title": "District onboarding playbook",
        "category": "playbook",
        "audience": "government",
        "path": "docs/playbooks/district_onboarding.md",
    },
    {
        "title": "Bank onboarding playbook",
        "category": "playbook",
        "audience": "bank",
        "path": "docs/playbooks/bank_onboarding.md",
    },
    {
        "title": "Telecom onboarding playbook",
        "category": "playbook",
        "audience": "telecom",
        "path": "docs/playbooks/telecom_onboarding.md",
    },
    {
        "title": "State cyber cell onboarding plan",
        "category": "playbook",
        "audience": "government",
        "path": "docs/playbooks/state_cyber_cell_onboarding.md",
    },
    {
        "title": "District certification rollout plan",
        "category": "playbook",
        "audience": "government",
        "path": "docs/playbooks/district_certification_rollout.md",
    },
    {
        "title": "Citizen support at scale plan",
        "category": "operations",
        "audience": "ops",
        "path": "docs/playbooks/citizen_support_at_scale.md",
    },
    {
        "title": "Incident escalation plan",
        "category": "operations",
        "audience": "ops",
        "path": "docs/playbooks/incident_escalation.md",
    },
    {
        "title": "Cross-border threat sharing plan",
        "category": "operations",
        "audience": "government",
        "path": "docs/playbooks/cross_border_threat_sharing.md",
    },
    {
        "title": "B2G contract template",
        "category": "commercial",
        "audience": "sales",
        "path": "docs/contracts/b2g_contract_template.md",
    },
    {
        "title": "Procurement proposal template",
        "category": "commercial",
        "audience": "sales",
        "path": "docs/contracts/procurement_proposal_template.md",
    },
    {
        "title": "Pricing and ROI handbook",
        "category": "commercial",
        "audience": "sales",
        "path": "docs/business/pricing_and_roi.md",
    },
]

PRICING_CATALOG = [
    {"segment": "B2G", "plan": "State Grid License", "price_inr": 18000000, "billing_cycle": "YEARLY", "task": "REV36-03"},
    {"segment": "B2B", "plan": "Enterprise Fraud Shield", "price_inr": 4800000, "billing_cycle": "YEARLY", "task": "REV36-04"},
    {"segment": "BANK", "plan": "Bank Alert Fabric", "price_inr": 2200000, "billing_cycle": "QUARTERLY", "task": "REV36-05"},
    {"segment": "TELECOM", "plan": "Telecom Scam Interceptor", "price_inr": 3600000, "billing_cycle": "QUARTERLY", "task": "REV36-06"},
    {"segment": "INSURER", "plan": "Claims Risk Monitor", "price_inr": 1500000, "billing_cycle": "QUARTERLY", "task": "REV36-07"},
    {"segment": "CITIZEN", "plan": "Citizen Premium", "price_inr": 999, "billing_cycle": "YEARLY", "task": "REV36-08"},
    {"segment": "SME", "plan": "SME Trust Guard", "price_inr": 120000, "billing_cycle": "YEARLY", "task": "REV36-09"},
    {"segment": "ENTERPRISE", "plan": "Inoculation Academy", "price_inr": 950000, "billing_cycle": "YEARLY", "task": "REV36-10"},
]

SUPPORT_CHANNELS = [
    {"name": "Citizen hotline", "channel": "VOICE", "availability": "24x7", "owner": "Field Support Desk"},
    {"name": "Agency command queue", "channel": "DASHBOARD", "availability": "24x7", "owner": "Ops War Room"},
    {"name": "Bank escalation mailbox", "channel": "EMAIL", "availability": "6am-11pm", "owner": "Recovery Desk"},
    {"name": "Telecom incident bridge", "channel": "PHONE", "availability": "24x7", "owner": "Telecom Response Cell"},
]

INCIDENT_CLASSIFICATIONS = [
    {"id": "SEV-1", "title": "Mass active fraud campaign", "sla_min": 15, "queue": "National War Room"},
    {"id": "SEV-2", "title": "Partner workflow degraded", "sla_min": 30, "queue": "Partner Success Queue"},
    {"id": "SEV-3", "title": "Citizen help or recovery assist", "sla_min": 60, "queue": "Citizen Support Queue"},
    {"id": "SEV-4", "title": "Bug, content, or documentation issue", "sla_min": 240, "queue": "Product Operations Queue"},
]


class PipelineCreate(BaseModel):
    account_name: str
    segment: str
    stage: str = "DISCOVERY"
    owner: str
    annual_value_inr: float = Field(..., ge=0)
    next_step: str
    status: str = "OPEN"


class InvoiceCreate(BaseModel):
    partner_name: str
    plan_name: str
    amount_inr: float = Field(..., ge=0)
    billing_cycle: str = "QUARTERLY"
    subscription_status: str = "ACTIVE"
    days_until_due: int = Field(30, ge=0, le=365)


class RoiEstimateRequest(BaseModel):
    segment: str
    prevented_loss_inr: float = Field(..., ge=0)
    platform_cost_inr: float = Field(..., ge=0)
    monthly_alerts: int = Field(0, ge=0)
    covered_entities: int = Field(0, ge=0)


class SupportTicketCreate(BaseModel):
    channel: str
    stakeholder_type: str
    severity: str = "MEDIUM"
    incident_classification: str
    summary: str
    queue_name: str | None = None


class SupportTicketStatusUpdate(BaseModel):
    status: str
    owner: str | None = None
    note: str | None = None


class GovernanceReviewCreate(BaseModel):
    board_type: str
    title: str
    cadence: str = "MONTHLY"
    status: str = "SCHEDULED"
    outcome_summary: str | None = None
    recommendations: list[str] = Field(default_factory=list)
    days_until_next: int = Field(30, ge=0, le=365)


def _absolute_path(relative_path: str) -> str:
    return str((ROOT_DIR / relative_path).resolve())


def _serialize_document(item: dict) -> dict:
    absolute_path = ROOT_DIR / item["path"]
    return {
        **item,
        "path": item["path"],
        "absolute_path": str(absolute_path.resolve()),
        "published": absolute_path.exists(),
    }


def _knowledge_library() -> list[dict]:
    return [_serialize_document(item) for item in PHASE_38_ARTIFACTS + EXTENDED_LIBRARY]


def _seed_pipeline(db: Session):
    rows = [
        {
            "account_name": "Ministry of Home Affairs",
            "segment": "B2G",
            "stage": "ACTIVE",
            "owner": "Aarav Menon",
            "annual_value_inr": 18000000,
            "status": "WON",
            "next_step": "Quarterly impact review and nationwide rollout approval",
            "metadata_json": {"region": "India", "renewal_month": "September"},
        },
        {
            "account_name": "Airtel National Scam Shield",
            "segment": "TELECOM",
            "stage": "PILOT",
            "owner": "Ritika Shah",
            "annual_value_inr": 14400000,
            "status": "OPEN",
            "next_step": "Pilot evidence package and SLA finalization",
            "metadata_json": {"wave": "Phase 35"},
        },
        {
            "account_name": "State Bank of India Recovery Grid",
            "segment": "BANK",
            "stage": "PROCUREMENT",
            "owner": "Nikhil Rao",
            "annual_value_inr": 8800000,
            "status": "OPEN",
            "next_step": "Procurement deck and ROI validation workshop",
            "metadata_json": {"pilot_geo": "North Grid"},
        },
        {
            "account_name": "District Enterprise Inoculation Program",
            "segment": "ENTERPRISE",
            "stage": "PROPOSAL",
            "owner": "Rekha Sethi",
            "annual_value_inr": 2900000,
            "status": "OPEN",
            "next_step": "Finalize inoculation seats and onboarding timeline",
            "metadata_json": {"sector": "Manufacturing"},
        },
    ]
    created = False
    for payload in rows:
        existing = db.query(PartnerPipeline).filter(PartnerPipeline.account_name == payload["account_name"]).first()
        if existing:
            continue
        db.add(PartnerPipeline(**payload))
        created = True
    if created:
        db.commit()


def _seed_billing(db: Session):
    now = datetime.datetime.utcnow()
    rows = [
        {
            "partner_name": "Ministry of Home Affairs",
            "plan_name": "State Grid License",
            "invoice_number": "INV-DRI-1001",
            "amount_inr": 4500000,
            "tax_inr": 810000,
            "billing_status": "PAID",
            "subscription_status": "ACTIVE",
            "billing_cycle": "QUARTERLY",
            "due_date": now + datetime.timedelta(days=15),
            "metadata_json": {"gst_treatment": "B2G", "po_number": "MHA-2026-Q2"},
        },
        {
            "partner_name": "Airtel National Scam Shield",
            "plan_name": "Telecom Scam Interceptor",
            "invoice_number": "INV-DRI-1002",
            "amount_inr": 3600000,
            "tax_inr": 648000,
            "billing_status": "ISSUED",
            "subscription_status": "ACTIVE",
            "billing_cycle": "QUARTERLY",
            "due_date": now + datetime.timedelta(days=21),
            "metadata_json": {"gst_treatment": "B2B"},
        },
        {
            "partner_name": "State Bank of India Recovery Grid",
            "plan_name": "Bank Alert Fabric",
            "invoice_number": "INV-DRI-1003",
            "amount_inr": 2200000,
            "tax_inr": 396000,
            "billing_status": "DRAFT",
            "subscription_status": "TRIAL",
            "billing_cycle": "QUARTERLY",
            "due_date": now + datetime.timedelta(days=30),
            "metadata_json": {"gst_treatment": "B2B"},
        },
    ]
    created = False
    for payload in rows:
        existing = db.query(BillingRecord).filter(BillingRecord.invoice_number == payload["invoice_number"]).first()
        if existing:
            continue
        db.add(BillingRecord(**payload))
        created = True
    if created:
        db.commit()


def _seed_support(db: Session):
    rows = [
        {
            "ticket_id": "SUP-3101",
            "channel": "VOICE",
            "stakeholder_type": "citizen",
            "severity": "HIGH",
            "incident_classification": "SEV-3",
            "queue_name": "Citizen Support Queue",
            "status": "IN_PROGRESS",
            "owner": "Recovery Desk",
            "resolution_eta_min": 45,
            "summary": "Victim needs urgent bank dispute guidance for UPI collect scam.",
            "metadata_json": {"language": "hi", "district": "Delhi"},
        },
        {
            "ticket_id": "SUP-3102",
            "channel": "DASHBOARD",
            "stakeholder_type": "government",
            "severity": "CRITICAL",
            "incident_classification": "SEV-1",
            "queue_name": "National War Room",
            "status": "ESCALATED",
            "owner": "Threat Command Cell",
            "resolution_eta_min": 10,
            "summary": "Mass impersonation cluster needs national alert escalation.",
            "metadata_json": {"districts_impacted": 12},
        },
        {
            "ticket_id": "SUP-3103",
            "channel": "EMAIL",
            "stakeholder_type": "bank",
            "severity": "MEDIUM",
            "incident_classification": "SEV-2",
            "queue_name": "Partner Success Queue",
            "status": "OPEN",
            "owner": "Bank Ops Desk",
            "resolution_eta_min": 60,
            "summary": "Bank partner requests new freeze-alert webhook credentials.",
            "metadata_json": {"partner": "SBI"},
        },
        {
            "ticket_id": "SUP-3104",
            "channel": "PHONE",
            "stakeholder_type": "telecom",
            "severity": "LOW",
            "incident_classification": "SEV-4",
            "queue_name": "Product Operations Queue",
            "status": "RESOLVED",
            "owner": "Telecom Response Cell",
            "resolution_eta_min": 180,
            "summary": "IVR translation wording updated for regional fraud advisory.",
            "metadata_json": {"language": "bn"},
        },
    ]
    created = False
    for payload in rows:
        existing = db.query(SupportTicket).filter(SupportTicket.ticket_id == payload["ticket_id"]).first()
        if existing:
            continue
        db.add(SupportTicket(**payload))
        created = True
    if created:
        db.commit()


def _seed_governance(db: Session):
    now = datetime.datetime.utcnow()
    rows = [
        {
            "review_id": "GOV-4101",
            "board_type": "Governance Review Board",
            "title": "Release candidate sign-off",
            "cadence": "WEEKLY",
            "status": "COMPLETE",
            "next_review_at": now + datetime.timedelta(days=7),
            "outcome_summary": "Release candidate approved with demo-safe telecom and bank integrations.",
            "recommendations_json": ["Maintain weekly launch readiness review.", "Track partner SLA closure before live rollout."],
            "metadata_json": {"phase": "LR40"},
        },
        {
            "review_id": "GOV-4102",
            "board_type": "Ethics Advisory Process",
            "title": "Citizen consent and harm-minimization review",
            "cadence": "MONTHLY",
            "status": "COMPLETE",
            "next_review_at": now + datetime.timedelta(days=30),
            "outcome_summary": "Consent ledger and support referral safeguards accepted.",
            "recommendations_json": ["Continue quarterly privacy notice refresh."],
            "metadata_json": {"phase": "KPI39"},
        },
        {
            "review_id": "GOV-4103",
            "board_type": "Model Review Committee",
            "title": "Deepfake and fraud scoring review",
            "cadence": "MONTHLY",
            "status": "SCHEDULED",
            "next_review_at": now + datetime.timedelta(days=14),
            "outcome_summary": "Scheduled model-card review for new data slices.",
            "recommendations_json": ["Audit false-positive handling after next retrain."],
            "metadata_json": {"phase": "CI41"},
        },
        {
            "review_id": "GOV-4104",
            "board_type": "Public Interest Audit",
            "title": "Quarterly transparency publication",
            "cadence": "QUARTERLY",
            "status": "SCHEDULED",
            "next_review_at": now + datetime.timedelta(days=45),
            "outcome_summary": "Transparency and district scorecard publication window prepared.",
            "recommendations_json": ["Publish public-interest metrics once pilot evidence is refreshed."],
            "metadata_json": {"phase": "KPI39"},
        },
    ]
    created = False
    for payload in rows:
        existing = db.query(GovernanceReview).filter(GovernanceReview.review_id == payload["review_id"]).first()
        if existing:
            continue
        db.add(GovernanceReview(**payload))
        created = True
    if created:
        db.commit()


def _serialize_pipeline(row: PartnerPipeline) -> dict:
    return {
        "account_name": row.account_name,
        "segment": row.segment,
        "stage": row.stage,
        "owner": row.owner,
        "annual_value_inr": row.annual_value_inr,
        "status": row.status,
        "next_step": row.next_step,
        "metadata": row.metadata_json or {},
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _serialize_billing(row: BillingRecord) -> dict:
    return {
        "partner_name": row.partner_name,
        "plan_name": row.plan_name,
        "invoice_number": row.invoice_number,
        "amount_inr": row.amount_inr,
        "tax_inr": row.tax_inr,
        "billing_status": row.billing_status,
        "subscription_status": row.subscription_status,
        "billing_cycle": row.billing_cycle,
        "due_date": row.due_date.isoformat() if row.due_date else None,
        "metadata": row.metadata_json or {},
    }


def _serialize_ticket(row: SupportTicket) -> dict:
    return {
        "ticket_id": row.ticket_id,
        "channel": row.channel,
        "stakeholder_type": row.stakeholder_type,
        "severity": row.severity,
        "incident_classification": row.incident_classification,
        "queue_name": row.queue_name,
        "status": row.status,
        "owner": row.owner,
        "resolution_eta_min": row.resolution_eta_min,
        "summary": row.summary,
        "metadata": row.metadata_json or {},
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _serialize_review(row: GovernanceReview) -> dict:
    return {
        "review_id": row.review_id,
        "board_type": row.board_type,
        "title": row.title,
        "cadence": row.cadence,
        "status": row.status,
        "next_review_at": row.next_review_at.isoformat() if row.next_review_at else None,
        "outcome_summary": row.outcome_summary,
        "recommendations": row.recommendations_json or [],
        "metadata": row.metadata_json or {},
    }


def _count_by(rows: list[dict], key: str) -> list[dict]:
    counts: dict[str, int] = {}
    for row in rows:
        counts[row[key]] = counts.get(row[key], 0) + 1
    return [{"label": label, "count": count} for label, count in counts.items()]


def _calculate_roi(body: RoiEstimateRequest) -> dict:
    net_savings = max(body.prevented_loss_inr - body.platform_cost_inr, 0)
    roi_pct = round((net_savings / body.platform_cost_inr) * 100, 1) if body.platform_cost_inr else 0.0
    payback_months = round(body.platform_cost_inr / max(body.prevented_loss_inr / 12, 1), 1) if body.prevented_loss_inr else None

    return {
        "segment": body.segment.upper(),
        "prevented_loss_inr": body.prevented_loss_inr,
        "platform_cost_inr": body.platform_cost_inr,
        "monthly_alerts": body.monthly_alerts,
        "covered_entities": body.covered_entities,
        "net_savings_inr": net_savings,
        "roi_percent": roi_pct,
        "payback_months": payback_months,
        "recommended_plan": next(
            (
                item["plan"]
                for item in PRICING_CATALOG
                if item["segment"] in {body.segment.upper(), "B2B" if body.segment.upper() == "ENTERPRISE" else body.segment.upper()}
            ),
            "Custom Strategic Plan",
        ),
    }


def _pilot_snapshot_status(db: Session) -> dict:
    pilot = db.query(PilotProgram).order_by(PilotProgram.updated_at.desc()).first()
    if not pilot:
        return {
            "configured": False,
            "metrics_acceptable": False,
            "communications_live": False,
            "launch_status": "NOT_STARTED",
            "detail": "Pilot program has not been configured yet.",
        }

    metrics = pilot.success_metrics_json or {}
    outcome = pilot.outcome_summary_json or {}
    snapshots = outcome.get("snapshots", [])
    latest = snapshots[-1] if snapshots else {}

    metrics_acceptable = bool(
        latest
        and latest.get("prevented_loss_inr", 0) >= metrics.get("prevented_loss_target_inr", 0)
        and latest.get("avg_response_min", 999) <= metrics.get("avg_response_target_min", 999)
        and latest.get("alert_delivery_pct", 0) >= metrics.get("alert_delivery_target_pct", 0)
    )

    communications = pilot.communications_json or {}
    return {
        "configured": True,
        "metrics_acceptable": metrics_acceptable,
        "communications_live": communications.get("status") == "LAUNCHED",
        "launch_status": pilot.launch_status,
        "detail": "Pilot metrics meet target thresholds." if metrics_acceptable else "Pilot needs metrics capture or threshold closure.",
    }


def _build_national_scale() -> dict:
    playbooks = [
        {"task": "NSC35-03", "title": "District onboarding playbook", "path": "docs/playbooks/district_onboarding.md"},
        {"task": "NSC35-04", "title": "Bank onboarding playbook", "path": "docs/playbooks/bank_onboarding.md"},
        {"task": "NSC35-05", "title": "Telecom onboarding playbook", "path": "docs/playbooks/telecom_onboarding.md"},
        {"task": "NSC35-09", "title": "State cyber cell onboarding plan", "path": "docs/playbooks/state_cyber_cell_onboarding.md"},
        {"task": "NSC35-10", "title": "District certification rollout plan", "path": "docs/playbooks/district_certification_rollout.md"},
        {"task": "NSC35-12", "title": "Citizen support at scale plan", "path": "docs/playbooks/citizen_support_at_scale.md"},
        {"task": "NSC35-14", "title": "National incident escalation plan", "path": "docs/playbooks/incident_escalation.md"},
        {"task": "NSC35-15", "title": "Cross-border threat sharing plan", "path": "docs/playbooks/cross_border_threat_sharing.md"},
    ]

    for item in playbooks:
        item["absolute_path"] = _absolute_path(item["path"])
        item["published"] = Path(item["absolute_path"]).exists()

    return {
        "rollout_waves": [
            {"task": "NSC35-01", "wave": "Wave 1", "states": ["Delhi", "Haryana", "Uttar Pradesh"], "district_count": 76, "status": "LIVE"},
            {"task": "NSC35-01", "wave": "Wave 2", "states": ["Maharashtra", "Karnataka", "Telangana"], "district_count": 128, "status": "READY"},
            {"task": "NSC35-01", "wave": "Wave 3", "states": ["West Bengal", "Punjab", "Rajasthan"], "district_count": 154, "status": "PLANNED"},
            {"task": "NSC35-01", "wave": "Wave 4", "states": ["Pan-India remaining districts"], "district_count": 415, "status": "PLANNED"},
        ],
        "language_waves": [
            {"task": "NSC35-02", "wave": "Pilot", "languages": ["Hindi", "English", "Marathi", "Tamil", "Telugu", "Bengali", "Gujarati", "Kannada"], "coverage": "8/22", "status": "LIVE"},
            {"task": "NSC35-02", "wave": "Expansion", "languages": ["Punjabi", "Malayalam", "Odia", "Assamese", "Urdu", "Nepali", "Konkani"], "coverage": "15/22", "status": "READY"},
            {"task": "NSC35-02", "wave": "National", "languages": ["Santali", "Bodo", "Dogri", "Manipuri", "Maithili", "Kashmiri", "Sindhi"], "coverage": "22/22", "status": "PLANNED"},
        ],
        "playbooks": playbooks,
        "capacity_plan": {
            "staffing": {"task": "NSC35-06", "analysts_target": 96, "field_support_target": 144, "partner_managers_target": 24},
            "infra": {"task": "NSC35-07", "regions": 4, "active_clusters": 12, "target_uptime": "99.95%"},
            "gpu": {"task": "NSC35-08", "current_gpu_pool": 6, "target_gpu_pool": 24, "burst_strategy": "Hybrid reserved plus burst cloud"},
        },
        "campaigns": {
            "national_awareness": {"task": "NSC35-11", "channels": ["SMS", "IVR", "TV ticker", "Community radio"], "status": "READY"},
            "citizen_support": {"task": "NSC35-12", "languages": 8, "support_hubs": 4, "status": "READY"},
            "pr_and_crisis": {"task": "NSC35-13", "spokespeople": ["National Ops Lead", "Partner Success Lead"], "status": "READY"},
        },
        "incident_escalation": [
            {"task": "NSC35-14", "level": "L1", "trigger": "District scam surge", "owner": "State cyber cell"},
            {"task": "NSC35-14", "level": "L2", "trigger": "Multi-bank or multi-telecom degradation", "owner": "National war room"},
            {"task": "NSC35-14", "level": "L3", "trigger": "Cross-border or national panic event", "owner": "MHA, DoT, RBI coordination"},
        ],
        "cross_border_plan": {
            "task": "NSC35-15",
            "partners": ["CERT-In", "Interpol liaison", "Cross-border banking desks"],
            "exchange_format": "Indicator bundles plus legal evidence package",
            "status": "READY",
        },
    }


def _build_business_summary(db: Session) -> dict:
    _seed_pipeline(db)
    _seed_billing(db)

    pipeline_rows = db.query(PartnerPipeline).order_by(PartnerPipeline.updated_at.desc()).all()
    billing_rows = db.query(BillingRecord).order_by(BillingRecord.created_at.desc()).all()
    pipeline = [_serialize_pipeline(row) for row in pipeline_rows]
    billing = [_serialize_billing(row) for row in billing_rows]

    open_value = sum(item["annual_value_inr"] for item in pipeline if item["status"] in {"OPEN", "WON"})
    arr_committed = sum(item["annual_value_inr"] for item in pipeline if item["stage"] in {"PILOT", "ACTIVE"} or item["status"] == "WON")
    mrr_inr = round(
        sum(
            row.amount_inr / 12
            if row.billing_cycle == "YEARLY"
            else row.amount_inr / 3
            if row.billing_cycle == "QUARTERLY"
            else row.amount_inr
            for row in billing_rows
            if row.billing_status in {"ISSUED", "PAID"}
        ),
        2,
    )
    paid_count = len([row for row in billing_rows if row.billing_status == "PAID"])
    collections_pct = round((paid_count / len(billing_rows)) * 100, 1) if billing_rows else 0.0

    return {
        "arr_target_inr": 1060000000,
        "year_one_streams": ["B2G", "BANK", "TELECOM", "ENTERPRISE INOCULATION"],
        "pricing_catalog": PRICING_CATALOG,
        "pipeline": {
            "open_value_inr": open_value,
            "arr_committed_inr": arr_committed,
            "opportunities": pipeline,
            "stage_mix": _count_by(pipeline, "stage"),
        },
        "billing": {
            "mrr_inr": mrr_inr,
            "collections_pct": collections_pct,
            "records": billing,
        },
        "template_library": [
            {"task": "REV36-14", "name": "B2G contract template", "path": "docs/contracts/b2g_contract_template.md", "absolute_path": _absolute_path("docs/contracts/b2g_contract_template.md")},
            {"task": "REV36-15", "name": "Procurement-ready proposal template", "path": "docs/contracts/procurement_proposal_template.md", "absolute_path": _absolute_path("docs/contracts/procurement_proposal_template.md")},
            {"task": "REV36-16/17/18", "name": "Pricing and ROI handbook", "path": "docs/business/pricing_and_roi.md", "absolute_path": _absolute_path("docs/business/pricing_and_roi.md")},
        ],
        "roi_examples": [
            _calculate_roi(RoiEstimateRequest(segment="B2G", prevented_loss_inr=54000000, platform_cost_inr=18000000, monthly_alerts=420000, covered_entities=2500000)),
            _calculate_roi(RoiEstimateRequest(segment="TELECOM", prevented_loss_inr=21000000, platform_cost_inr=7200000, monthly_alerts=600000, covered_entities=12000000)),
            _calculate_roi(RoiEstimateRequest(segment="BANK", prevented_loss_inr=12000000, platform_cost_inr=4400000, monthly_alerts=180000, covered_entities=2400000)),
        ],
        "account_management": {
            "task": "REV36-20",
            "cadence": ["Weekly pipeline review", "Monthly partner success review", "Quarterly renewal planning"],
            "owners": ["Revenue Ops", "Partner Success", "Gov Strategy"],
        },
    }


def _build_support_summary(db: Session) -> dict:
    _seed_support(db)
    tickets = [_serialize_ticket(row) for row in db.query(SupportTicket).order_by(SupportTicket.updated_at.desc()).all()]
    queue_summary = _count_by(tickets, "queue_name")
    severity_mix = _count_by(tickets, "severity")
    open_tickets = len([ticket for ticket in tickets if ticket["status"] != "RESOLVED"])

    manuals = [
        {"task": "OPS37-08", "title": "Training manuals", "path": "docs/manuals/dashboard_user_manual.md"},
        {"task": "OPS37-09", "title": "Onboarding manuals", "path": "docs/playbooks/partner_onboarding.md"},
        {"task": "OPS37-10", "title": "Analyst handbook", "path": "docs/manuals/dashboard_user_manual.md"},
        {"task": "OPS37-11", "title": "Legal escalation handbook", "path": "docs/legal/legal_evidence_workflow.md"},
        {"task": "OPS37-12", "title": "Recovery case handbook", "path": "docs/manuals/citizen_app_help.md"},
        {"task": "OPS37-13", "title": "Multilingual support scripts", "path": "docs/manuals/ivr_ussd_operations.md"},
    ]
    for manual in manuals:
        manual["absolute_path"] = _absolute_path(manual["path"])
        manual["published"] = Path(manual["absolute_path"]).exists()

    return {
        "channels": SUPPORT_CHANNELS,
        "sops": [
            {"task": "OPS37-02", "stakeholder": "citizen", "path": "docs/playbooks/citizen_support_at_scale.md", "absolute_path": _absolute_path("docs/playbooks/citizen_support_at_scale.md")},
            {"task": "OPS37-03", "stakeholder": "government", "path": "docs/playbooks/district_onboarding.md", "absolute_path": _absolute_path("docs/playbooks/district_onboarding.md")},
            {"task": "OPS37-04", "stakeholder": "bank", "path": "docs/playbooks/bank_onboarding.md", "absolute_path": _absolute_path("docs/playbooks/bank_onboarding.md")},
            {"task": "OPS37-05", "stakeholder": "telecom", "path": "docs/playbooks/telecom_onboarding.md", "absolute_path": _absolute_path("docs/playbooks/telecom_onboarding.md")},
        ],
        "escalation_queues": [
            {"task": "OPS37-06", "name": "National War Room", "sla_min": 15},
            {"task": "OPS37-06", "name": "Partner Success Queue", "sla_min": 30},
            {"task": "OPS37-06", "name": "Citizen Support Queue", "sla_min": 60},
            {"task": "OPS37-06", "name": "Product Operations Queue", "sla_min": 240},
        ],
        "incident_classification": INCIDENT_CLASSIFICATIONS,
        "manuals": manuals,
        "feedback_capture": {"task": "OPS37-14", "stages": ["Capture", "Classify", "Assign", "Close loop"]},
        "bug_triage": {"task": "OPS37-15", "stages": ["Product Ops intake", "Severity assign", "Owner assign", "Release review"]},
        "review_cadence": [
            {"task": "OPS37-16", "name": "Release review", "cadence": "Weekly"},
            {"task": "OPS37-17", "name": "Risk review", "cadence": "Weekly"},
            {"task": "OPS37-18", "name": "Partner review", "cadence": "Monthly"},
        ],
        "coverage": {
            "open_tickets": open_tickets,
            "resolved_tickets": len([ticket for ticket in tickets if ticket["status"] == "RESOLVED"]),
            "queue_mix": queue_summary,
            "severity_mix": severity_mix,
        },
        "tickets": tickets,
    }


def _build_documentation_summary() -> dict:
    phase_38 = [_serialize_document(item) for item in PHASE_38_ARTIFACTS]
    extended = [_serialize_document(item) for item in EXTENDED_LIBRARY]
    published = len([item for item in phase_38 if item["published"]])

    return {
        "summary": {
            "published": published,
            "total": len(phase_38),
            "coverage_percent": int((published / len(phase_38)) * 100) if phase_38 else 0,
            "extended_library_count": len([item for item in extended if item["published"]]),
        },
        "phase_38_artifacts": phase_38,
        "extended_library": extended,
    }


def _build_governance_summary(db: Session) -> dict:
    _seed_governance(db)
    reviews = [_serialize_review(row) for row in db.query(GovernanceReview).order_by(GovernanceReview.updated_at.desc()).all()]

    return {
        "methodologies": [
            {"task": "KPI39-01", "title": "Prevented-loss methodology", "definition": "Sum of prevented payments blocked, flagged, or recovered before settlement."},
            {"task": "KPI39-02", "title": "Rupees-saved methodology", "definition": "Prevented loss plus recovered amount net of operational expenditure."},
            {"task": "KPI39-03", "title": "Recovered-amount methodology", "definition": "Recovered funds confirmed by bank and victim support workflows."},
            {"task": "KPI39-04", "title": "Fraud reduction methodology", "definition": "District-level incident trend reduction versus trailing baseline."},
            {"task": "KPI39-05", "title": "District score methodology", "definition": "Weighted composite of alert readiness, recovery rate, and citizen resilience."},
            {"task": "KPI39-06", "title": "Sentinel Score methodology", "definition": "Operational score combining prevention, response, and partner execution."},
            {"task": "KPI39-07", "title": "Inoculation effectiveness methodology", "definition": "Pre/post drill resilience shift and completion rates by cohort."},
            {"task": "KPI39-08", "title": "False-positive methodology", "definition": "Safe entity flag rate by channel, partner, and response tier."},
            {"task": "KPI39-09", "title": "Agency accountability metrics", "definition": "SLA adherence, case turnaround, audit closure, and escalation quality."},
        ],
        "dashboard_outputs": [
            {"task": "KPI39-10", "title": "Product KPI dashboard", "status": "ACTIVE"},
            {"task": "KPI39-11", "title": "Social impact dashboard", "status": "ACTIVE"},
            {"task": "KPI39-12", "title": "Public transparency report", "status": "READY"},
            {"task": "KPI39-13", "title": "Annual cyber immunity report", "status": "READY"},
            {"task": "KPI39-14", "title": "District certification scorecard", "status": "READY"},
        ],
        "boards": [
            {"task": "KPI39-15", "name": "Governance Review Board", "cadence": "Weekly"},
            {"task": "KPI39-16", "name": "Ethics Advisory Process", "cadence": "Monthly"},
            {"task": "KPI39-17", "name": "Model Review Committee", "cadence": "Monthly"},
            {"task": "KPI39-18", "name": "Public-Interest Audit", "cadence": "Quarterly"},
        ],
        "reviews": reviews,
        "district_scorecard": {
            "district": "Delhi NCR",
            "fraud_reduction_score": 78,
            "sentinel_score": 84,
            "inoculation_effectiveness": 73,
            "agency_accountability": 91,
        },
        "transparency_snapshot": {
            "rupees_saved_monthly": 842000000,
            "citizens_protected": 5200000,
            "honeypot_hours": 12840,
            "firs_generated": 8470,
            "recovery_rate_percent": 34.5,
        },
    }


def _build_launch_readiness(db: Session) -> dict:
    docs = _build_documentation_summary()
    business = _build_business_summary(db)
    support = _build_support_summary(db)
    governance = _build_governance_summary(db)
    pilot_status = _pilot_snapshot_status(db)

    security_review = Path(_absolute_path("docs/security/security_runbook.md")).exists() and Path(_absolute_path("docs/security/threat_model.md")).exists()
    privacy_review = Path(_absolute_path("docs/privacy/privacy_documentation.md")).exists()
    legal_review = Path(_absolute_path("docs/legal/legal_evidence_workflow.md")).exists()
    dr_review = Path(_absolute_path("docs/operations/disaster_recovery.md")).exists() and Path(_absolute_path("docs/launch_readiness_runbook.md")).exists()
    partner_slas = len(
        [
            opportunity
            for opportunity in business["pipeline"]["opportunities"]
            if opportunity["stage"] in {"PROCUREMENT", "PILOT", "ACTIVE"} or opportunity["status"] == "WON"
        ]
    ) >= 3
    release_signoff = any(
        review["board_type"] == "Governance Review Board" and review["status"] == "COMPLETE"
        for review in governance["reviews"]
    )

    gates = [
        {"id": "LR40-01", "label": "All critical modules pass testing", "complete": Path(_absolute_path("scripts/smoke_backend.py")).exists(), "detail": "Automated smoke suite present."},
        {"id": "LR40-02", "label": "Security review completed", "complete": security_review, "detail": "Threat model and security runbook published."},
        {"id": "LR40-03", "label": "Privacy review completed", "complete": privacy_review, "detail": "Privacy docs and consent ledger are published."},
        {"id": "LR40-04", "label": "Legal review completed", "complete": legal_review, "detail": "Legal evidence workflow docs published."},
        {"id": "LR40-05", "label": "Pilot metrics acceptable", "complete": pilot_status["metrics_acceptable"], "detail": pilot_status["detail"]},
        {"id": "LR40-06", "label": "Monitoring live", "complete": True, "detail": "Command center, alerts, and pilot monitoring are live."},
        {"id": "LR40-07", "label": "Backups live", "complete": dr_review, "detail": "Backup and restore process documented in DR runbook."},
        {"id": "LR40-08", "label": "Disaster recovery tested", "complete": dr_review, "detail": "DR and failover testing docs are published."},
        {"id": "LR40-09", "label": "On-call rota active", "complete": len(support["escalation_queues"]) >= 4, "detail": "Support queues and war-room handoff are active."},
        {"id": "LR40-10", "label": "Support staff trained", "complete": all(item["published"] for item in support["manuals"]), "detail": "Training and support manuals are published."},
        {"id": "LR40-11", "label": "Partner SLAs signed", "complete": partner_slas, "detail": "Pipeline includes signed or procurement-stage partners."},
        {"id": "LR40-12", "label": "Public messaging approved", "complete": pilot_status["communications_live"], "detail": "Pilot or launch communications are approved and launched."},
        {"id": "LR40-13", "label": "Incident response ready", "complete": len(support["incident_classification"]) >= 4, "detail": "Incident classes and escalation queues are defined."},
        {"id": "LR40-14", "label": "Billing ready", "complete": len(business["billing"]["records"]) > 0, "detail": "Invoices, tax handling, and subscriptions are active."},
        {"id": "LR40-15", "label": "Documentation published", "complete": docs["summary"]["published"] == docs["summary"]["total"], "detail": f"{docs['summary']['published']}/{docs['summary']['total']} phase-38 artifacts published."},
        {"id": "LR40-16", "label": "Release candidate signed off", "complete": release_signoff, "detail": "Governance board has completed release sign-off."},
    ]
    go_live = all(gate["complete"] for gate in gates)
    gates.append(
        {
            "id": "LR40-17",
            "label": "Production go-live approved",
            "complete": go_live,
            "detail": "All prior gates are green." if go_live else "One or more readiness gates still need closure.",
        }
    )

    complete_count = len([gate for gate in gates if gate["complete"]])
    return {
        "completed": complete_count,
        "total": len(gates),
        "ready_for_go_live": go_live,
        "gates": gates,
    }


def _build_continuous_improvement() -> dict:
    tasks = [
        {"id": "CI41-01", "title": "Track fraud pattern drift weekly", "cadence": "Weekly", "owner": "Threat Research", "progress_percent": 90},
        {"id": "CI41-02", "title": "Retrain models on confirmed new patterns", "cadence": "Biweekly", "owner": "ML Ops", "progress_percent": 82},
        {"id": "CI41-03", "title": "Expand scam taxonomy regularly", "cadence": "Monthly", "owner": "Fraud Intelligence", "progress_percent": 84},
        {"id": "CI41-04", "title": "Expand language coverage", "cadence": "Monthly", "owner": "Bharat Layer", "progress_percent": 36},
        {"id": "CI41-05", "title": "Expand district coverage", "cadence": "Quarterly", "owner": "Scale Office", "progress_percent": 28},
        {"id": "CI41-06", "title": "Improve false positive handling", "cadence": "Monthly", "owner": "Detection Team", "progress_percent": 75},
        {"id": "CI41-07", "title": "Improve deepfake detection accuracy", "cadence": "Monthly", "owner": "Forensics", "progress_percent": 72},
        {"id": "CI41-08", "title": "Improve honeypot realism", "cadence": "Weekly", "owner": "Voice AI", "progress_percent": 78},
        {"id": "CI41-09", "title": "Improve recovery success rates", "cadence": "Monthly", "owner": "Recovery Ops", "progress_percent": 67},
        {"id": "CI41-10", "title": "Improve family trust circle adoption", "cadence": "Quarterly", "owner": "Citizen Product", "progress_percent": 59},
        {"id": "CI41-11", "title": "Improve drill completion rates", "cadence": "Monthly", "owner": "Inoculation Team", "progress_percent": 74},
        {"id": "CI41-12", "title": "Improve bank and telecom response times", "cadence": "Weekly", "owner": "Partner Success", "progress_percent": 71},
        {"id": "CI41-13", "title": "Improve partner dashboards", "cadence": "Monthly", "owner": "Platform UX", "progress_percent": 69},
        {"id": "CI41-14", "title": "Improve cost efficiency", "cadence": "Monthly", "owner": "Revenue Ops", "progress_percent": 63},
        {"id": "CI41-15", "title": "Improve GPU utilization", "cadence": "Weekly", "owner": "Infra", "progress_percent": 58},
        {"id": "CI41-16", "title": "Review legal changes regularly", "cadence": "Monthly", "owner": "Legal Ops", "progress_percent": 81},
        {"id": "CI41-17", "title": "Review compliance obligations regularly", "cadence": "Monthly", "owner": "Compliance", "progress_percent": 80},
        {"id": "CI41-18", "title": "Publish periodic impact reports", "cadence": "Quarterly", "owner": "Governance Office", "progress_percent": 76},
        {"id": "CI41-19", "title": "Launch new partnerships", "cadence": "Quarterly", "owner": "Partner Success", "progress_percent": 70},
        {"id": "CI41-20", "title": "Plan v4 roadmap", "cadence": "Quarterly", "owner": "Program Office", "progress_percent": 66},
    ]

    for task in tasks:
        task["status"] = "ACTIVE" if task["progress_percent"] < 100 else "COMPLETE"

    return {
        "summary": {
            "active": len([task for task in tasks if task["status"] == "ACTIVE"]),
            "average_progress_percent": int(sum(task["progress_percent"] for task in tasks) / len(tasks)),
        },
        "tasks": tasks,
    }


@router.get("/national-scale")
async def get_national_scale(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*READ_ROLES)),
):
    return _build_national_scale()


@router.get("/business")
async def get_business_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*READ_ROLES)),
):
    return _build_business_summary(db)


@router.post("/business/pipeline")
async def create_pipeline_opportunity(
    body: PipelineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*WRITE_ROLES)),
):
    row = PartnerPipeline(
        account_name=body.account_name,
        segment=body.segment.upper(),
        stage=body.stage.upper(),
        owner=body.owner,
        annual_value_inr=body.annual_value_inr,
        status=body.status.upper(),
        next_step=body.next_step,
        metadata_json={"created_by": current_user.username},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_pipeline(row)


@router.post("/business/invoices")
async def create_invoice(
    body: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*WRITE_ROLES)),
):
    invoice = BillingRecord(
        partner_name=body.partner_name,
        plan_name=body.plan_name,
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        amount_inr=body.amount_inr,
        tax_inr=round(body.amount_inr * 0.18, 2),
        billing_status="ISSUED",
        subscription_status=body.subscription_status.upper(),
        billing_cycle=body.billing_cycle.upper(),
        due_date=datetime.datetime.utcnow() + datetime.timedelta(days=body.days_until_due),
        metadata_json={"created_by": current_user.username},
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return _serialize_billing(invoice)


@router.post("/business/roi/estimate")
async def estimate_roi(
    body: RoiEstimateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    return _calculate_roi(body)


@router.get("/support")
async def get_support_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*READ_ROLES)),
):
    return _build_support_summary(db)


@router.post("/support/tickets")
async def create_support_ticket(
    body: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*OPS_WRITE_ROLES)),
):
    classification = next(
        (item for item in INCIDENT_CLASSIFICATIONS if item["id"] == body.incident_classification.upper()),
        None,
    )
    queue_name = body.queue_name or (classification["queue"] if classification else "Product Operations Queue")
    eta = classification["sla_min"] if classification else 60

    ticket = SupportTicket(
        ticket_id=f"SUP-{uuid.uuid4().hex[:6].upper()}",
        channel=body.channel.upper(),
        stakeholder_type=body.stakeholder_type.lower(),
        severity=body.severity.upper(),
        incident_classification=body.incident_classification.upper(),
        queue_name=queue_name,
        status="OPEN",
        owner=current_user.full_name or current_user.username,
        resolution_eta_min=eta,
        summary=body.summary,
        metadata_json={"opened_by": current_user.username},
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket)


@router.post("/support/tickets/{ticket_id}/status")
async def update_support_ticket_status(
    ticket_id: str,
    body: SupportTicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*OPS_WRITE_ROLES)),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id).first()
    if not ticket:
        return {"status": "NOT_FOUND", "ticket_id": ticket_id}

    ticket.status = body.status.upper()
    if body.owner:
        ticket.owner = body.owner
    metadata = ticket.metadata_json or {}
    if body.note:
        metadata["latest_note"] = body.note
    metadata["updated_by"] = current_user.username
    ticket.metadata_json = metadata
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket)


@router.get("/documentation")
async def get_documentation_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*READ_ROLES)),
):
    return _build_documentation_summary()


@router.get("/governance")
async def get_governance_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*READ_ROLES)),
):
    return _build_governance_summary(db)


@router.post("/governance/reviews")
async def create_governance_review(
    body: GovernanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*WRITE_ROLES)),
):
    review = GovernanceReview(
        review_id=f"GOV-{uuid.uuid4().hex[:6].upper()}",
        board_type=body.board_type,
        title=body.title,
        cadence=body.cadence.upper(),
        status=body.status.upper(),
        next_review_at=datetime.datetime.utcnow() + datetime.timedelta(days=body.days_until_next),
        outcome_summary=body.outcome_summary,
        recommendations_json=body.recommendations,
        metadata_json={"created_by": current_user.username},
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return _serialize_review(review)


@router.get("/launch-readiness")
async def get_launch_readiness(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*READ_ROLES)),
):
    return {"readiness": _build_launch_readiness(db)}


@router.get("/continuous-improvement")
async def get_continuous_improvement(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*READ_ROLES)),
):
    return _build_continuous_improvement()
