import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env file explicitly
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sentinel 1930"
    API_V1_STR: str = "/api/v1"

    # JWT Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "sentinel-1930-basig-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # External APIs
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sentinel.db")
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # For SQLAlchemy 2.0+ and Railway (postgres:// vs postgresql://)
        uri = self.DATABASE_URL
        if uri.startswith("postgres://"):
            uri = uri.replace("postgres://", "postgresql://", 1)
        return uri

    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = 6379

    # Neo4j
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "sentinel_password")

    # Supabase (Injected via Railway/Env)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

# Validation before client initialization
if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
    print(f"[WARN] Supabase credentials missing! Authentication features will be disabled.")
    print(f"SUPABASE_URL: {'[SET]' if settings.SUPABASE_URL else '[MISSING]'}")
    print(f"SUPABASE_ANON_KEY: {'[SET]' if settings.SUPABASE_ANON_KEY else '[MISSING]'}")

# Initialize Supabase client safely
supabase: Client = create_client(
    settings.SUPABASE_URL if settings.SUPABASE_URL else "https://placeholder-supa.supabase.co", 
    settings.SUPABASE_ANON_KEY if settings.SUPABASE_ANON_KEY else "placeholder-key-for-boot"
)
