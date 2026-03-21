import datetime
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.auth import get_current_verified_user, require_role
from core.database import get_db
from models.database import PilotFeedback, PilotProgram, User

router = APIRouter()

ALLOWED_PILOT_ROLES = ("admin", "government", "police", "bank", "telecom")
PILOT_SCOPE_DEFAULT = {
    "pilot_only": True,
    "dashboard_views": ["command", "detection", "graph", "alerts", "recovery"],
    "districts": ["Delhi NCR", "Mewat"],
}
SUCCESS_METRICS_DEFAULT = {
    "prevented_loss_target_inr": 2500000,
    "avg_response_target_min": 3.5,
    "alert_delivery_target_pct": 94,
    "feedback_score_target": 4.2,
}
TRAINING_DEFAULT = {
    "analysts": {"target": 12, "completed": 0},
    "police": {"target": 24, "completed": 0},
    "bank": {"target": 10, "completed": 0},
    "field_support": {"target": 18, "completed": 0},
}
COMMUNICATIONS_DEFAULT = {
    "status": "DRAFT",
    "channels": [],
    "message": "",
    "launched_at": None,
}


class PilotProgramUpdate(BaseModel):
    name: str = "North Grid Pilot"
    geography: str
    telecom_partner: str
    bank_partners: list[str] = Field(default_factory=list)
    agencies: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    scam_categories: list[str] = Field(default_factory=list)
    dashboard_scope: dict = Field(default_factory=dict)
    success_metrics: dict = Field(default_factory=dict)


class PilotTrainingUpdate(BaseModel):
    stakeholder_type: str
    completed: int = Field(..., ge=0)
    target: Optional[int] = Field(None, ge=0)


class PilotCommunicationsLaunch(BaseModel):
    channels: list[str] = Field(default_factory=list)
    message: str


class PilotMetricsSnapshot(BaseModel):
    prevented_loss_inr: int = Field(..., ge=0)
    avg_response_min: float = Field(..., ge=0)
    alert_delivery_pct: float = Field(..., ge=0)
    citizen_coverage_pct: float = Field(..., ge=0)
    satisfaction_score: float = Field(..., ge=0)


class PilotFeedbackCreate(BaseModel):
    stakeholder_type: str
    source_agency: Optional[str] = None
    sentiment: str = "NEUTRAL"
    message: str


def _get_or_create_pilot(db: Session) -> PilotProgram:
    pilot = db.query(PilotProgram).order_by(PilotProgram.updated_at.desc()).first()
    if pilot:
        return pilot

    pilot = PilotProgram(
        pilot_id=f"PIL-{uuid.uuid4().hex[:6].upper()}",
        name="North Grid Pilot",
        geography="Delhi NCR + Mewat",
        telecom_partner="Airtel Sandbox",
        bank_partners_json=["SBI", "HDFC Bank"],
        agencies_json=["Delhi Police Cyber Cell", "Mewat Police", "1930 National Helpline"],
        languages_json=["Hindi", "English"],
        scam_categories_json=["KYC Fraud", "UPI Collect Scam", "Deepfake Impersonation"],
        dashboard_scope_json=PILOT_SCOPE_DEFAULT,
        success_metrics_json={**SUCCESS_METRICS_DEFAULT},
        training_status_json={**TRAINING_DEFAULT},
        communications_json={**COMMUNICATIONS_DEFAULT},
        outcome_summary_json={"snapshots": []},
        launch_status="CONFIGURING",
    )
    db.add(pilot)
    db.commit()
    db.refresh(pilot)
    return pilot


def _serialize_pilot(pilot: PilotProgram) -> dict:
    return {
        "pilot_id": pilot.pilot_id,
        "name": pilot.name,
        "geography": pilot.geography,
        "telecom_partner": pilot.telecom_partner,
        "bank_partners": pilot.bank_partners_json or [],
        "agencies": pilot.agencies_json or [],
        "languages": pilot.languages_json or [],
        "scam_categories": pilot.scam_categories_json or [],
        "dashboard_scope": pilot.dashboard_scope_json or {},
        "success_metrics": pilot.success_metrics_json or {},
        "training_status": pilot.training_status_json or {},
        "communications": pilot.communications_json or {},
        "outcome_summary": pilot.outcome_summary_json or {},
        "launch_status": pilot.launch_status,
        "updated_at": pilot.updated_at.isoformat() if pilot.updated_at else None,
    }


def _checklist_row(label: str, complete: bool, detail: str) -> dict:
    return {"label": label, "complete": complete, "detail": detail}


def _build_readiness(pilot: PilotProgram, feedback_count: int) -> dict:
    training = pilot.training_status_json or {}
    communications = pilot.communications_json or {}
    outcome = pilot.outcome_summary_json or {}
    snapshots = outcome.get("snapshots", [])

    analysts_done = training.get("analysts", {}).get("completed", 0) >= training.get("analysts", {}).get("target", 0) > 0
    police_done = training.get("police", {}).get("completed", 0) >= training.get("police", {}).get("target", 0) > 0
    bank_done = training.get("bank", {}).get("completed", 0) >= training.get("bank", {}).get("target", 0) > 0
    field_done = training.get("field_support", {}).get("completed", 0) >= training.get("field_support", {}).get("target", 0) > 0

    checklist = [
        _checklist_row("Pilot geography selected", bool(pilot.geography), pilot.geography or "Not selected"),
        _checklist_row("Pilot agencies selected", len(pilot.agencies_json or []) > 0, ", ".join(pilot.agencies_json or []) or "Not selected"),
        _checklist_row("Telecom partner selected", bool(pilot.telecom_partner), pilot.telecom_partner or "Not selected"),
        _checklist_row("Bank partners selected", len(pilot.bank_partners_json or []) > 0, ", ".join(pilot.bank_partners_json or []) or "Not selected"),
        _checklist_row("Pilot languages selected", len(pilot.languages_json or []) > 0, ", ".join(pilot.languages_json or []) or "Not selected"),
        _checklist_row("Pilot scam categories selected", len(pilot.scam_categories_json or []) > 0, ", ".join(pilot.scam_categories_json or []) or "Not selected"),
        _checklist_row("Pilot-only dashboards configured", bool((pilot.dashboard_scope_json or {}).get("pilot_only")), "Pilot scope is locked" if (pilot.dashboard_scope_json or {}).get("pilot_only") else "Pilot-only dashboard not configured"),
        _checklist_row("Pilot success metrics configured", bool(pilot.success_metrics_json), "Targets loaded" if pilot.success_metrics_json else "Targets missing"),
        _checklist_row("Pilot analysts trained", analysts_done, f"{training.get('analysts', {}).get('completed', 0)}/{training.get('analysts', {}).get('target', 0)} completed"),
        _checklist_row("Pilot police users trained", police_done, f"{training.get('police', {}).get('completed', 0)}/{training.get('police', {}).get('target', 0)} completed"),
        _checklist_row("Pilot bank users trained", bank_done, f"{training.get('bank', {}).get('completed', 0)}/{training.get('bank', {}).get('target', 0)} completed"),
        _checklist_row("Field support staff trained", field_done, f"{training.get('field_support', {}).get('completed', 0)}/{training.get('field_support', {}).get('target', 0)} completed"),
        _checklist_row("Pilot communications launched", communications.get("status") == "LAUNCHED", communications.get("message") or "Not launched"),
        _checklist_row("Pilot metrics monitored", len(snapshots) > 0, f"{len(snapshots)} snapshot(s) captured"),
        _checklist_row("Pilot feedback collected", feedback_count > 0, f"{feedback_count} feedback item(s)"),
        _checklist_row("Rapid issue-fix loop active", feedback_count > 0, "Feedback loop active" if feedback_count > 0 else "No issue loop evidence yet"),
        _checklist_row("Pilot outcome report published", bool(outcome.get("published_at")), outcome.get("published_at") or "Not published"),
        _checklist_row("Pilot evidence pack ready for partners", bool(outcome.get("published_at")), "Outcome evidence ready" if outcome.get("published_at") else "Publish outcome report first"),
    ]

    completed = len([item for item in checklist if item["complete"]])
    return {
        "completed": completed,
        "total": len(checklist),
        "progress_percent": int(completed / len(checklist) * 100),
        "checklist": checklist,
    }


def _build_outcome_report(db: Session, pilot: PilotProgram) -> dict:
    feedback_rows = (
        db.query(PilotFeedback)
        .filter(PilotFeedback.pilot_program_id == pilot.id)
        .order_by(PilotFeedback.created_at.desc())
        .all()
    )
    outcome = pilot.outcome_summary_json or {}
    snapshots = outcome.get("snapshots", [])
    latest_snapshot = snapshots[-1] if snapshots else {}

    positive = len([row for row in feedback_rows if row.sentiment.upper() == "POSITIVE"])
    neutral = len([row for row in feedback_rows if row.sentiment.upper() == "NEUTRAL"])
    negative = len([row for row in feedback_rows if row.sentiment.upper() == "NEGATIVE"])
    open_issues = len([row for row in feedback_rows if row.status != "CLOSED"])

    return {
        "pilot_id": pilot.pilot_id,
        "name": pilot.name,
        "geography": pilot.geography,
        "launch_status": pilot.launch_status,
        "metrics": latest_snapshot,
        "feedback_summary": {
            "total": len(feedback_rows),
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "open_issues": open_issues,
        },
        "recommended_partnerships": [
            "Expand telecom pilot evidence to additional DoT-aligned sandboxes",
            "Use bank freeze and recovery evidence to onboard two more pilot banks",
            "Package pilot outcome for state cyber cell and ministry review",
        ],
        "published_at": outcome.get("published_at"),
    }


@router.get("/program/active")
async def get_active_pilot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    pilot = _get_or_create_pilot(db)
    return _serialize_pilot(pilot)


@router.post("/program/active")
async def update_active_pilot(
    body: PilotProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*ALLOWED_PILOT_ROLES)),
):
    pilot = _get_or_create_pilot(db)
    pilot.name = body.name
    pilot.geography = body.geography
    pilot.telecom_partner = body.telecom_partner
    pilot.bank_partners_json = body.bank_partners
    pilot.agencies_json = body.agencies
    pilot.languages_json = body.languages
    pilot.scam_categories_json = body.scam_categories
    pilot.dashboard_scope_json = {**PILOT_SCOPE_DEFAULT, **body.dashboard_scope}
    pilot.success_metrics_json = {**SUCCESS_METRICS_DEFAULT, **body.success_metrics}
    pilot.launch_status = "READY" if body.geography and body.telecom_partner and body.agencies else "CONFIGURING"
    db.commit()
    db.refresh(pilot)
    return _serialize_pilot(pilot)


@router.post("/training/update")
async def update_training_status(
    body: PilotTrainingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*ALLOWED_PILOT_ROLES)),
):
    pilot = _get_or_create_pilot(db)
    training = {**TRAINING_DEFAULT, **(pilot.training_status_json or {})}
    current = {**training.get(body.stakeholder_type, {"target": 0, "completed": 0})}
    current["completed"] = body.completed
    if body.target is not None:
        current["target"] = body.target
    training[body.stakeholder_type] = current
    pilot.training_status_json = training
    db.commit()
    db.refresh(pilot)
    feedback_count = db.query(PilotFeedback).filter(PilotFeedback.pilot_program_id == pilot.id).count()
    return {
        "training_status": training,
        "readiness": _build_readiness(pilot, feedback_count),
    }


@router.post("/communications/launch")
async def launch_pilot_communications(
    body: PilotCommunicationsLaunch,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*ALLOWED_PILOT_ROLES)),
):
    pilot = _get_or_create_pilot(db)
    pilot.communications_json = {
        "status": "LAUNCHED",
        "channels": body.channels,
        "message": body.message,
        "launched_at": datetime.datetime.utcnow().isoformat(),
    }
    if pilot.launch_status == "READY":
        pilot.launch_status = "LIVE"
    db.commit()
    db.refresh(pilot)
    return _serialize_pilot(pilot)


@router.post("/metrics/snapshot")
async def add_metrics_snapshot(
    body: PilotMetricsSnapshot,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*ALLOWED_PILOT_ROLES)),
):
    pilot = _get_or_create_pilot(db)
    outcome = dict(pilot.outcome_summary_json or {})
    snapshots = list(outcome.get("snapshots", []))
    snapshots.append({
        "captured_at": datetime.datetime.utcnow().isoformat(),
        "prevented_loss_inr": body.prevented_loss_inr,
        "avg_response_min": body.avg_response_min,
        "alert_delivery_pct": body.alert_delivery_pct,
        "citizen_coverage_pct": body.citizen_coverage_pct,
        "satisfaction_score": body.satisfaction_score,
    })
    outcome["snapshots"] = snapshots[-10:]
    pilot.outcome_summary_json = outcome
    db.commit()
    db.refresh(pilot)
    return {"latest_snapshot": outcome["snapshots"][-1], "snapshot_count": len(outcome["snapshots"])}


@router.post("/feedback")
async def add_pilot_feedback(
    body: PilotFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    pilot = _get_or_create_pilot(db)
    feedback = PilotFeedback(
        pilot_program_id=pilot.id,
        stakeholder_type=body.stakeholder_type,
        source_agency=body.source_agency,
        sentiment=body.sentiment.upper(),
        message=body.message,
        metadata_json={"submitted_by": current_user.username},
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {
        "id": feedback.id,
        "stakeholder_type": feedback.stakeholder_type,
        "sentiment": feedback.sentiment,
        "message": feedback.message,
        "status": feedback.status,
    }


@router.get("/feedback")
async def list_pilot_feedback(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    pilot = _get_or_create_pilot(db)
    rows = (
        db.query(PilotFeedback)
        .filter(PilotFeedback.pilot_program_id == pilot.id)
        .order_by(PilotFeedback.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "feedback": [
            {
                "id": row.id,
                "stakeholder_type": row.stakeholder_type,
                "source_agency": row.source_agency,
                "sentiment": row.sentiment,
                "message": row.message,
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
    }


@router.get("/readiness")
async def get_pilot_readiness(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    pilot = _get_or_create_pilot(db)
    feedback_count = db.query(PilotFeedback).filter(PilotFeedback.pilot_program_id == pilot.id).count()
    return {
        "pilot": _serialize_pilot(pilot),
        "readiness": _build_readiness(pilot, feedback_count),
    }


@router.get("/outcome-report")
async def get_pilot_outcome_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    pilot = _get_or_create_pilot(db)
    return _build_outcome_report(db, pilot)


@router.post("/outcome-report/publish")
async def publish_pilot_outcome_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*ALLOWED_PILOT_ROLES)),
):
    pilot = _get_or_create_pilot(db)
    outcome = dict(pilot.outcome_summary_json or {})
    outcome["published_at"] = datetime.datetime.utcnow().isoformat()
    pilot.outcome_summary_json = outcome
    db.commit()
    db.refresh(pilot)
    return _build_outcome_report(db, pilot)
