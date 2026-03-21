from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
import os
import contextlib
import logging
from dotenv import load_dotenv

from api.detection import router as detection_router
from api.honeypot import router as honeypot_router
from api.inoculation import router as inoculation_router
from api.voice import router as voice_router
from api.system import router as system_router
from api.auth import router as auth_router
from api.actions import router as actions_router
from api.forensic import router as forensic_router
from api.profiling import router as profiling_router
from api.upi import router as upi_router
from api.bharat import router as bharat_router
from api.mule import router as mule_router
from api.twilio_call import router as twilio_router
from api.simulation import router as simulation_router
from api.telecom import router as telecom_router
from api.intelligence import router as intelligence_router
from api.notifications import router as notifications_router
from api.citizen import router as citizen_router
from api.recovery import router as recovery_router
from api.modules import router as modules_router
from api.whatsapp import router as whatsapp_router
from api.security import router as security_router
from api.pilot import router as pilot_router
from api.program_office import router as program_office_router
from api.ai import router as ai_router

from core.security import security_logging_middleware
from core.logging_config import setup_production_logging

# Security & Rate Limiting
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    SLOWAPI_AVAILABLE = True
except Exception as import_error:
    Limiter = None
    RateLimitExceeded = None
    SLOWAPI_AVAILABLE = False

    def _rate_limit_exceeded_handler(request, exc):
        raise exc

    def get_remote_address(request):
        return "local-dev"
import secure

# Initialize Rate Limiter
limiter = None
if SLOWAPI_AVAILABLE:
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
    )
else:
    logging.getLogger("drishyam.main").warning(
        "SlowAPI could not be imported. Rate limiting is disabled for this environment."
    )
secure_headers = secure.Secure()

# Setup Logging
if settings.ENV == "prod":
    setup_production_logging()
else:
    logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("drishyam.main")

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Database Setup
    from core.database import engine, SessionLocal
    from models.database import Base, User, UserRole
    
    logger.info("[STARTUP] Initializing database...")
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)
        logger.info("[STARTUP] Database tables verified/created.")
        
        # 1. Ensure Schema Compliance (migrations for existing tables)
        from core.database import ensure_schema_compliance
        ensure_schema_compliance()
        
        # Seed Admin
        db = SessionLocal()
        try:
            admin = db.query(User).filter(User.username == "admin").first()
            if not admin:
                from core.auth import get_password_hash
                admin = User(
                    username="admin",
                    hashed_password=get_password_hash("password123"),
                    full_name="System Administrator",
                    role=UserRole.ADMIN.value,
                    is_active=True,
                )
                db.add(admin)
                db.commit()
                logger.info("[STARTUP] Default admin user created (admin / password123)")
            else:
                logger.info("[STARTUP] Admin user already exists.")
            
            # Seed Agency Portal data if empty
            from models.database import CrimeReport, HoneypotSession
            if db.query(CrimeReport).count() == 0:
                logger.info("[STARTUP] Seeding initial crime reports for Agency Portal...")
                reports = [
                    CrimeReport(report_id="REQ-8821", category="police", scam_type="KYC_EXTORTION", amount="₹45,000", platform="WhatsApp", priority="CRITICAL", status="PENDING"),
                    CrimeReport(report_id="REQ-8822", category="police", scam_type="PART_TIME_JOB", amount="₹1.2L", platform="Telegram", priority="HIGH", status="RESOLVED"),
                    CrimeReport(report_id="REQ-8823", category="bank", scam_type="UPI_COLLECT", amount="₹5,000", platform="GPay", priority="MEDIUM", status="PENDING", metadata_json={"vpa": "scammer.node@oksbi"}),
                    CrimeReport(report_id="REQ-8824", category="telecom", scam_type="MASS_ROBOCALL", amount="N/A", platform="GSM_TOWER_72", priority="CRITICAL", status="PENDING")
                ]
                db.add_all(reports)
                db.commit()
            
            if db.query(HoneypotSession).count() == 0:
                logger.info("[STARTUP] Seeding initial honeypot sessions...")
                sessions = [
                    HoneypotSession(session_id="H-99881", caller_num="+91-9821-XXX", persona="ELDERLY_UNCLE", status="active"),
                    HoneypotSession(session_id="H-99882", caller_num="+91-7722-XXX", persona="HELPLESS_GRANDMA", status="active")
                ]
                db.add_all(sessions)
                db.commit()

            from models.database import ScamCluster
            if db.query(ScamCluster).count() == 0:
                logger.info("[STARTUP] Seeding initial scam clusters map...")
                clusters = [
                    ScamCluster(cluster_id="CLS-991", risk_level="CRITICAL", location="Jamtara, JH", lat=24.21, lng=86.64, linked_vpas=42, honeypot_hits=156),
                    ScamCluster(cluster_id="CLS-992", risk_level="HIGH", location="Mewat, HR", lat=28.14, lng=77.01, linked_vpas=28, honeypot_hits=89),
                    ScamCluster(cluster_id="CLS-993", risk_level="MEDIUM", location="Noida, UP", lat=28.53, lng=77.39, linked_vpas=15, honeypot_hits=45)
                ]
                db.add_all(clusters)
                db.commit()

            from models.database import BankNodeRule
            if db.query(BankNodeRule).count() == 0:
                logger.info("[STARTUP] Seeding initial fraud mitigation rules...")
                rules = [
                    BankNodeRule(bank_name="HDFC Bank", rule_type="AMOUNT_THRESHOLD", threshold=100000.0, action="FLAG"),
                    BankNodeRule(bank_name="SBI", rule_type="VELOCITY", threshold=5.0, action="FREEZE"),
                    BankNodeRule(bank_name="ALL", rule_type="PII_ACCESS", threshold=1.0, action="AUDIT")
                ]
                db.add_all(rules)
                db.commit()

            from models.database import IntelligenceAlert
            if db.query(IntelligenceAlert).count() == 0:
                logger.info("[STARTUP] Seeding initial intelligence alerts...")
                alerts = [
                    IntelligenceAlert(severity="HIGH", message="New Scam Pod detected in Noida Sector 15", category="SCAM_POD", location="Noida"),
                    IntelligenceAlert(severity="CRITICAL", message="Massive VPA rotation detected in Jamtara", category="VPA_ROTATION", location="Jamtara")
                ]
                db.add_all(alerts)
                db.commit()
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"[STARTUP] Database initialization failed: {e}")

    yield
    logger.info("[SHUTDOWN] Cleaning up...")

# Initialize FastAPI with lifespan
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0-PROD",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENV != "prod" else None,
    lifespan=lifespan
)

# Rate Limiting Error Handler
if limiter is not None:
    app.state.limiter = limiter
if RateLimitExceeded is not None:
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.railway\.app|https://.*\.netlify\.app|http://localhost:300[0-1]",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Secure Headers Middleware
@app.middleware("http")
async def set_secure_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if settings.ENV == "prod":
        response.headers["Content-Security-Policy"] = "default-src 'self'"
    else:
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://fastapi.tiangolo.com"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["X-Data-Residency"] = "IN-CERT-IN-COMPLIANT"
    return response

# Add Global Request Logging
@app.middleware("http")
async def simple_request_log(request, call_next):
    logger.info(f"[NODE] Incoming Request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"[NODE] Outgoing Response: {response.status_code}")
    return response

# Include Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(detection_router, prefix="/api/v1/detection", tags=["detection"])
app.include_router(honeypot_router, prefix="/api/v1/honeypot", tags=["honeypot"])
app.include_router(inoculation_router, prefix="/api/v1/inoculation", tags=["inoculation"])
app.include_router(voice_router, prefix="/api/v1/voice", tags=["voice"])
app.include_router(system_router, prefix="/api/v1/system", tags=["system"])
app.include_router(actions_router, prefix="/api/v1/actions", tags=["actions"])
app.include_router(forensic_router, prefix="/api/v1/forensic", tags=["forensic"])
app.include_router(profiling_router, prefix="/api/v1/profiling", tags=["profiling"])
app.include_router(upi_router, prefix="/api/v1/upi", tags=["upi"])
app.include_router(bharat_router, prefix="/api/v1/bharat", tags=["bharat"])
app.include_router(mule_router, prefix="/api/v1/mule", tags=["mule"])
app.include_router(twilio_router, prefix="/api/v1/twilio", tags=["twilio"])
app.include_router(simulation_router, prefix="/api/v1/auth/simulation", tags=["simulation"])
app.include_router(telecom_router, prefix="/api/v1/telecom", tags=["telecom"])
app.include_router(intelligence_router, prefix="/api/v1/intelligence", tags=["intelligence"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(pilot_router, prefix="/api/v1/pilot", tags=["pilot"])
app.include_router(program_office_router, prefix="/api/v1/program-office", tags=["program-office"])
app.include_router(citizen_router, prefix="/api/v1/citizen", tags=["citizen"])
app.include_router(recovery_router, prefix="/api/v1/recovery", tags=["recovery"])
app.include_router(modules_router, prefix="/api/v1/modules", tags=["modules"])
app.include_router(whatsapp_router, prefix="/api/v1/whatsapp", tags=["whatsapp"])
app.include_router(security_router, prefix="/api/v1/security", tags=["security"])
app.include_router(security_router, prefix="/api/v1/privacy", tags=["privacy"]) 
app.include_router(system_router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(system_router, prefix="/api/v1/occ", tags=["occ"])
app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"])

@app.get("/")
async def root():
    logger.info("[HIT] Root endpoint")
    return {"message": "DRISHYAM AI (BASIG) API is running. For My India."}

@app.get("/health")
async def health_check():
    logger.info("[HIT] Health endpoint")
    return {
        "status": "healthy",
        "mode": "PRODUCTION",
        "engine": "BASIG-NGI-v3.0"
    }

@app.get("/status")
async def status_check():
    return {
        "status": "online",
        "services": {
            "postgres": "connected",
            "redis": "configured",
            "neo4j": "configured"
        },
        "version": "v1.0.0-bharat"
    }

@app.get("/api/v1/system/mode")
async def get_system_mode():
    return {"mode": "PRODUCTION"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
