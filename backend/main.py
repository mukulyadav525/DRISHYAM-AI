from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
import os
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
from core.security import security_logging_middleware

# Auto-create tables (safe — skips if already exists in Supabase)
from core.database import engine
from models.database import Base
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"[WARN] Could not auto-create tables: {e}. Tables must exist in Supabase.")

# Modified app initialization to use settings
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0", # Kept the version from original
    openapi_url=f"{settings.API_V1_STR}/openapi.json" # Added openapi_url
)

# Add Security Middleware
@app.middleware("http")
async def add_security_logging(request, call_next):
    print(f"[DEBUG] Incoming: {request.method} {request.url}")
    return await security_logging_middleware(request, call_next)

# Include Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(detection_router, prefix="/api/v1/detection", tags=["detection"])
app.include_router(honeypot_router, prefix="/api/v1/honeypot", tags=["honeypot"])
app.include_router(inoculation_router, prefix="/api/v1/inoculation", tags=["inoculation"])
app.include_router(voice_router, prefix="/api/v1", tags=["voice"])
app.include_router(system_router, prefix="/api/v1/system", tags=["system"])
app.include_router(actions_router, prefix="/api/v1/actions", tags=["actions"])
app.include_router(forensic_router, prefix="/api/v1/forensic", tags=["forensic"])
app.include_router(profiling_router, prefix="/api/v1/profiling", tags=["profiling"])

# Configure CORS for Dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Sentinel 1930 (BASIG) API is running. For My India."}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "mode": "PRODUCTION",
        "engine": "BASIG-NGI-v3.0"
    }

@app.get("/api/v1/system/mode")
async def get_system_mode():
    return {"mode": "PRODUCTION"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
