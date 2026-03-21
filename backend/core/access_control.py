import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.database import AgencyAccessPolicy, User

SENSITIVITY_ORDER = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}

ROLE_LABELS = {
    "admin": "Administrator",
    "police": "Police / LEA",
    "bank": "Banking / NBFC",
    "government": "Government",
    "telecom": "Telecom Operator",
    "court": "Judiciary / Court",
    "common": "Citizen",
}

DASHBOARD_PAGE_CATALOG = [
    {"path": "/", "resource": "overview", "label": "Overview"},
    {"path": "/detection", "resource": "detection", "label": "Detection Grid"},
    {"path": "/honeypot", "resource": "honeypot", "label": "Honeypot"},
    {"path": "/graph", "resource": "graph", "label": "Fraud Graph"},
    {"path": "/alerts", "resource": "alerts", "label": "Alerts"},
    {"path": "/deepfake", "resource": "deepfake", "label": "Deepfake"},
    {"path": "/history", "resource": "history", "label": "History"},
    {"path": "/mule", "resource": "mule", "label": "Mule Shield"},
    {"path": "/inoculation", "resource": "inoculation", "label": "Inoculation"},
    {"path": "/upi", "resource": "upi", "label": "UPI Shield"},
    {"path": "/score", "resource": "score", "label": "Score"},
    {"path": "/profiling", "resource": "profiling", "label": "Profiling"},
    {"path": "/command", "resource": "command", "label": "Command Center"},
    {"path": "/agency", "resource": "agency", "label": "Agency Portal"},
    {"path": "/launch", "resource": "launch", "label": "Launch Control"},
    {"path": "/national", "resource": "national", "label": "National Scale"},
    {"path": "/partners", "resource": "partners", "label": "Partners"},
    {"path": "/business", "resource": "business", "label": "Business Ops"},
    {"path": "/ops", "resource": "ops", "label": "Support Ops"},
    {"path": "/observability", "resource": "observability", "label": "Observability"},
    {"path": "/security", "resource": "security", "label": "Security Ops"},
    {"path": "/governance", "resource": "governance", "label": "Governance"},
    {"path": "/bharat", "resource": "bharat", "label": "Bharat Layer"},
    {"path": "/recovery", "resource": "recovery", "label": "Recovery"},
    {"path": "/settings", "resource": "settings", "label": "Settings"},
]

DEFAULT_AGENCY_POLICIES = [
    {
        "policy_id": "ABAC-ADMIN-ALL",
        "name": "Administrator full control",
        "role_scope": "admin",
        "resource_scope": "*",
        "action_scope": "*",
        "region_scope": "*",
        "effect": "ALLOW",
        "conditions_json": {
            "resources": ["*"],
            "actions": ["*"],
            "segments": ["*"],
            "regions": ["*"],
            "max_sensitivity": "CRITICAL",
        },
    },
    {
        "policy_id": "ABAC-GOV-OPERATIONS",
        "name": "Government command, rollout, and governance access",
        "role_scope": "government",
        "resource_scope": "launch_control",
        "action_scope": "READ",
        "region_scope": "INDIA",
        "effect": "ALLOW",
        "conditions_json": {
            "resources": [
                "overview",
                "detection",
                "graph",
                "alerts",
                "deepfake",
                "history",
                "inoculation",
                "upi",
                "score",
                "command",
                "agency",
                "launch",
                "national",
                "partners",
                "business",
                "ops",
                "observability",
                "security",
                "governance",
                "bharat",
                "partner_registry",
                "business_ops",
                "launch_control",
                "national_scale",
                "support_ops",
                "incident_response",
            ],
            "actions": ["READ", "WRITE", "APPROVE", "REQUEST"],
            "segments": ["*"],
            "regions": ["DISTRICT", "STATE", "INDIA", "NATIONAL"],
            "max_sensitivity": "CRITICAL",
        },
    },
    {
        "policy_id": "ABAC-POLICE-OPERATIONS",
        "name": "Police operational detection and evidence access",
        "role_scope": "police",
        "resource_scope": "incident_response",
        "action_scope": "READ",
        "region_scope": "STATE",
        "effect": "ALLOW",
        "conditions_json": {
            "resources": [
                "overview",
                "detection",
                "honeypot",
                "graph",
                "alerts",
                "deepfake",
                "history",
                "mule",
                "inoculation",
                "score",
                "profiling",
                "command",
                "agency",
                "national",
                "partners",
                "business",
                "ops",
                "observability",
                "security",
                "governance",
                "bharat",
                "recovery",
                "incident_response",
                "support_ops",
                "observability",
                "security",
                "alerts",
                "recovery",
            ],
            "actions": ["READ", "WRITE", "REQUEST"],
            "segments": ["*"],
            "regions": ["DISTRICT", "STATE", "INDIA"],
            "max_sensitivity": "HIGH",
        },
    },
    {
        "policy_id": "ABAC-BANK-OPERATIONS",
        "name": "Bank fraud, recovery, and UPI operations access",
        "role_scope": "bank",
        "resource_scope": "upi_ops",
        "action_scope": "READ",
        "region_scope": "INDIA",
        "effect": "ALLOW",
        "conditions_json": {
            "resources": [
                "overview",
                "graph",
                "alerts",
                "mule",
                "inoculation",
                "upi",
                "score",
                "agency",
                "national",
                "partners",
                "business",
                "ops",
                "observability",
                "security",
                "governance",
                "bharat",
                "recovery",
                "upi_ops",
                "partner_registry",
                "recovery",
                "alerts",
                "observability",
            ],
            "actions": ["READ", "WRITE", "REQUEST"],
            "segments": ["BANK", "*"],
            "regions": ["DISTRICT", "STATE", "INDIA"],
            "max_sensitivity": "HIGH",
        },
    },
    {
        "policy_id": "ABAC-TELECOM-OPERATIONS",
        "name": "Telecom alert, detection, and launch access",
        "role_scope": "telecom",
        "resource_scope": "telecom_ops",
        "action_scope": "READ",
        "region_scope": "INDIA",
        "effect": "ALLOW",
        "conditions_json": {
            "resources": [
                "overview",
                "detection",
                "alerts",
                "inoculation",
                "agency",
                "launch",
                "national",
                "partners",
                "business",
                "ops",
                "observability",
                "security",
                "governance",
                "bharat",
                "telecom_ops",
                "partner_registry",
                "launch_control",
            ],
            "actions": ["READ", "WRITE", "REQUEST"],
            "segments": ["TELECOM", "*"],
            "regions": ["STATE", "INDIA", "NATIONAL"],
            "max_sensitivity": "HIGH",
        },
    },
    {
        "policy_id": "ABAC-COURT-REVIEW",
        "name": "Judicial review and evidence access",
        "role_scope": "court",
        "resource_scope": "evidence",
        "action_scope": "READ",
        "region_scope": "NATIONAL",
        "effect": "ALLOW",
        "conditions_json": {
            "resources": [
                "overview",
                "graph",
                "deepfake",
                "history",
                "mule",
                "score",
                "profiling",
                "agency",
                "national",
                "partners",
                "business",
                "ops",
                "observability",
                "security",
                "governance",
                "bharat",
                "recovery",
                "evidence",
            ],
            "actions": ["READ"],
            "segments": ["*"],
            "regions": ["DISTRICT", "STATE", "INDIA", "NATIONAL"],
            "max_sensitivity": "HIGH",
        },
    },
    {
        "policy_id": "ABAC-CITIZEN-SAFETY",
        "name": "Citizen safety and recovery access",
        "role_scope": "common",
        "resource_scope": "citizen_services",
        "action_scope": "READ",
        "region_scope": "INDIA",
        "effect": "ALLOW",
        "conditions_json": {
            "resources": [
                "overview",
                "alerts",
                "inoculation",
                "upi",
                "score",
                "bharat",
                "recovery",
                "citizen_services",
            ],
            "actions": ["READ", "REQUEST"],
            "segments": ["*"],
            "regions": ["DISTRICT", "STATE", "INDIA"],
            "max_sensitivity": "MEDIUM",
        },
    },
]


def _utcnow() -> datetime.datetime:
    return datetime.datetime.utcnow()


def _normalize_scope(value: str | None) -> str:
    return (value or "").strip().lower()


def seed_access_policies(db: Session):
    changed = False
    for payload in DEFAULT_AGENCY_POLICIES:
        existing = db.query(AgencyAccessPolicy).filter(AgencyAccessPolicy.policy_id == payload["policy_id"]).first()
        if not existing:
            db.add(AgencyAccessPolicy(**payload))
            changed = True
            continue

        for key, value in payload.items():
            if getattr(existing, key) != value:
                setattr(existing, key, value)
                changed = True

    if changed:
        db.commit()


def serialize_policy(row: AgencyAccessPolicy) -> dict:
    return {
        "policy_id": row.policy_id,
        "name": row.name,
        "role_scope": row.role_scope,
        "resource_scope": row.resource_scope,
        "action_scope": row.action_scope,
        "region_scope": row.region_scope,
        "effect": row.effect,
        "active": row.active,
        "conditions": row.conditions_json or {},
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _scope_match(allowed: list[str] | None, requested: str | None) -> bool:
    if not allowed or "*" in allowed:
        return True
    if not requested:
        return False
    requested_value = requested.upper()
    return requested_value in {value.upper() for value in allowed}


def _rank_sensitivity(value: str | None) -> int:
    return SENSITIVITY_ORDER.get((value or "MEDIUM").upper(), SENSITIVITY_ORDER["MEDIUM"])


def evaluate_agency_access(
    db: Session,
    user: User,
    action: str,
    resource: str,
    attrs: dict | None = None,
) -> dict:
    seed_access_policies(db)
    attrs = attrs or {}

    action = action.upper()
    resource = _normalize_scope(resource)
    segment = (attrs.get("segment") or "*").upper()
    region = (attrs.get("region") or "INDIA").upper()
    sensitivity = (attrs.get("sensitivity") or "MEDIUM").upper()

    policies = (
        db.query(AgencyAccessPolicy)
        .filter(AgencyAccessPolicy.active.is_(True))
        .order_by(AgencyAccessPolicy.created_at.asc(), AgencyAccessPolicy.id.asc())
        .all()
    )

    deny_reason = f"No active policy allows {user.role} to {action} {resource}."
    for policy in policies:
        if policy.role_scope not in {user.role, "*"}:
            continue

        conditions = policy.conditions_json or {}
        resources = [_normalize_scope(value) for value in conditions.get("resources", [policy.resource_scope])]
        actions = [value.upper() for value in conditions.get("actions", [policy.action_scope])]
        segments = [value.upper() for value in conditions.get("segments", ["*"])]
        regions = [value.upper() for value in conditions.get("regions", [policy.region_scope])]
        max_sensitivity = conditions.get("max_sensitivity", "CRITICAL")

        if not _scope_match(resources, resource):
            deny_reason = f"Policy scope does not cover resource {resource}."
            continue
        if not _scope_match(actions, action):
            deny_reason = f"Policy scope does not cover action {action}."
            continue
        if not _scope_match(segments, segment):
            deny_reason = f"Role {user.role} cannot operate on segment {segment}."
            continue
        if not _scope_match(regions, region):
            deny_reason = f"Role {user.role} is not cleared for region {region}."
            continue
        if _rank_sensitivity(sensitivity) > _rank_sensitivity(max_sensitivity):
            deny_reason = f"Requested sensitivity {sensitivity} exceeds policy ceiling {max_sensitivity}."
            continue

        allowed = policy.effect.upper() == "ALLOW"
        return {
            "allowed": allowed,
            "reason": "Allowed by agency access policy." if allowed else deny_reason,
            "policy": serialize_policy(policy),
            "request": {
                "action": action,
                "resource": resource,
                "segment": segment,
                "region": region,
                "sensitivity": sensitivity,
            },
        }

    return {
        "allowed": False,
        "reason": deny_reason,
        "policy": None,
        "request": {
            "action": action,
            "resource": resource,
            "segment": segment,
            "region": region,
            "sensitivity": sensitivity,
        },
    }


def authorize_agency_access(
    db: Session,
    user: User,
    action: str,
    resource: str,
    attrs: dict | None = None,
) -> dict:
    decision = evaluate_agency_access(db, user, action=action, resource=resource, attrs=attrs)
    if not decision["allowed"]:
        raise HTTPException(status_code=403, detail=decision["reason"])
    return decision


def build_access_manifest(db: Session, user: User) -> dict:
    seed_access_policies(db)

    page_decisions = []
    allowed_pages = []
    allowed_resources = set()

    for page in DASHBOARD_PAGE_CATALOG:
        decision = evaluate_agency_access(db, user, action="READ", resource=page["resource"])
        is_allowed = bool(decision["allowed"])
        page_decisions.append({
            "path": page["path"],
            "resource": page["resource"],
            "label": page["label"],
            "allowed": is_allowed,
        })
        if is_allowed:
            allowed_pages.append(page["path"])
            allowed_resources.add(page["resource"])

    return {
        "role": user.role,
        "role_label": ROLE_LABELS.get(user.role, user.role.title()),
        "allowed_pages": allowed_pages,
        "allowed_resources": sorted(allowed_resources),
        "pages": page_decisions,
        "generated_at": _utcnow().isoformat(),
    }
