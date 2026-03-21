import os
from pydantic_settings import BaseSettings
from pydantic import Field, validator, field_validator
from dotenv import load_dotenv
from typing import Optional

# Load .env file explicitly
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "DRISHYAM AI"
    API_V1_STR: str = "/api/v1"
    
    # Environment Mode: 'dev' or 'prod'
    ENV: str = Field("dev", env="ENV")
    
    # Security
    CIPHER_KEY: str = Field("uN7f_pS_X_Z_Q_Z_R_Y_Z_X_Z_Q_Z_R_Y_Z_X_Z_Q_Z_R_Y=", env="CIPHER_KEY")

    # JWT Auth
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # External APIs
    SARVAM_API_KEY: str = Field(..., env="SARVAM_API_KEY")
    GEMINI_API_KEY: Optional[str] = Field(None, env="GEMINI_API_KEY")
    DEEPGRAM_API_KEY: Optional[str] = Field(None, env="DEEPGRAM_API_KEY")
    
    # Twilio Voice Calling
    TWILIO_ACCOUNT_SID: Optional[str] = Field(None, env="TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = Field(None, env="TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER: Optional[str] = Field(None, env="TWILIO_PHONE_NUMBER")
    TWILIO_WEBHOOK_BASE_URL: Optional[str] = Field(None, env="TWILIO_WEBHOOK_BASE_URL")
    
    # Database
    DATABASE_URL: str = Field("sqlite:///./drishyam.db", env="DATABASE_URL")
    
    # Deepfake Forensic API (Railway)
    DEEPFAKE_API_URL: str = Field("https://deepfake-production-39b6.up.railway.app", env="DEEPFAKE_API_URL")
    DEEPFAKE_API_KEY: str = Field("drishyam_admin_2026", env="DEEPFAKE_API_KEY")
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        uri = self.DATABASE_URL
        if uri.startswith("postgres://"):
            uri = uri.replace("postgres://", "postgresql://", 1)
        return uri

    # Redis (Optional in dev, recommended in prod)
    REDIS_URL: Optional[str] = Field(None, env="REDIS_URL")

    # Neo4j
    NEO4J_URI: Optional[str] = Field(None, env="NEO4J_URI")
    NEO4J_USER: str = Field("neo4j", env="NEO4J_USER")
    NEO4J_PASSWORD: str = Field("password", env="NEO4J_PASSWORD")

    # Security Restraints
    CORS_ORIGINS: list[str] = Field(["*"], env="CORS_ORIGINS")

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    RATE_LIMIT_PER_MINUTE: int = 100

    class Config:
        env_prefix = "DRISHYAM_"
        case_sensitive = True
        env_file = ".env"
        extra = "ignore" # Ignore extra env vars

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info):
        if info.data.get("ENV") == "prod" and "change-in-production" in v:
            raise ValueError("SECRET_KEY must be changed for production!")
        return v

try:
    # Use a dummy secret for validation if not provided in dev
    if os.getenv("ENV") != "prod" and not os.getenv("SECRET_KEY"):
        os.environ["SECRET_KEY"] = "dev-secret-key-only"
    if os.getenv("ENV") != "prod" and not os.getenv("SARVAM_API_KEY"):
        os.environ["SARVAM_API_KEY"] = "mock-sarvam-key"
    if os.getenv("ENV") != "prod" and not os.getenv("DEEPGRAM_API_KEY"):
        os.environ["DEEPGRAM_API_KEY"] = "mock-deepgram-key"
        
    settings = Settings()
except Exception as e:
    print(f"Configuration Error: {e}")
    if os.getenv("ENV") != "prod":
        print("Falling back to robust mock settings for development...")
        class MockSettings:
            PROJECT_NAME = "DRISHYAM AI (MOCK)"
            API_V1_STR = "/api/v1"
            ENV = "dev"
            SECRET_KEY = "mock-secret"
            ALGORITHM = "HS256"
            ACCESS_TOKEN_EXPIRE_MINUTES = 480
            SARVAM_API_KEY = "mock-key"
            DEEPGRAM_API_KEY = "mock-key"
            SQLALCHEMY_DATABASE_URI = "sqlite:///./drishyam.db"
            REDIS_URL = None
            NEO4J_URI = None
            NEO4J_USER = "neo4j"
            NEO4J_PASSWORD = "password"
            CORS_ORIGINS = ["*"]
            RATE_LIMIT_PER_MINUTE = 1000
            TWILIO_ACCOUNT_SID = None
            TWILIO_AUTH_TOKEN = None
            TWILIO_PHONE_NUMBER = None
            TWILIO_WEBHOOK_BASE_URL = None
        settings = MockSettings()
    else:
        raise e
