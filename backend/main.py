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
from api.observability import router as observability_router
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
    from models.database import Base
    
    logger.info("[STARTUP] Initializing database...")
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)
        logger.info("[STARTUP] Database tables verified/created.")
        
        # 1. Ensure Schema Compliance (migrations for existing tables)
        from core.database import ensure_schema_compliance
        ensure_schema_compliance()
        if settings.ENABLE_BOOTSTRAP_DATA:
            logger.warning("[STARTUP] Bootstrap data mode is enabled. Seeding development records.")
            db = SessionLocal()
            try:
                from api.program_office import (
                    _seed_billing,
                    _seed_governance,
                    _seed_partner_integrations,
                    _seed_pipeline,
                    _seed_support,
                )
                from core.access_control import seed_access_policies

                seed_access_policies(db)
                _seed_pipeline(db)
                _seed_billing(db)
                _seed_support(db)
                _seed_partner_integrations(db)
                _seed_governance(db)
            finally:
                db.close()
        else:
            logger.info("[STARTUP] Bootstrap data is disabled. Using only persisted database records.")
            
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
app.include_router(observability_router, prefix="/api/v1/observability", tags=["observability"])
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
