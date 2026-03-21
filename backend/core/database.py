import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from core.config import settings

logger = logging.getLogger("drishyam.database")


def _create_engine(db_uri: str):
    if db_uri.startswith("sqlite"):
        return create_engine(db_uri, connect_args={"check_same_thread": False})
    return create_engine(db_uri, connect_args={"connect_timeout": 10})


def _resolve_engine():
    primary_uri = settings.SQLALCHEMY_DATABASE_URI
    engine = _create_engine(primary_uri)

    if settings.ENV == "prod" or primary_uri.startswith("sqlite"):
        return engine

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        logger.info("Database connectivity check succeeded for configured development database.")
        return engine
    except Exception as exc:
        if not settings.ALLOW_DATABASE_FALLBACK:
            logger.error(
                "Configured database is unreachable and fallback is disabled. Refusing to switch to SQLite. Error: %s",
                exc,
            )
            raise
        fallback_uri = "sqlite:///./drishyam.db"
        logger.warning(
            "Configured development database is unreachable. Falling back to local SQLite at %s. Error: %s",
            fallback_uri,
            exc,
        )
        return _create_engine(fallback_uri)


engine = _resolve_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
def ensure_schema_compliance():
    """
    Ensures the database schema matches the models by running manual migrations.
    Useful for quick fixes in environments like Railway without full Alembic setups.
    """
    from sqlalchemy import text
    db = SessionLocal()
    
    queries_pg = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS drishyam_score INTEGER DEFAULT 100;",
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS customer_id VARCHAR;",
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);",
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS recording_analysis_json JSON;",
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS direction VARCHAR DEFAULT 'outgoing';",
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS handoff_timestamp TIMESTAMP;",
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS metadata_json JSON;",
        "ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;",
        "ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;"
    ]
    
    queries_sqlite = [
        "ALTER TABLE users ADD COLUMN phone_number VARCHAR;",
        "ALTER TABLE users ADD COLUMN drishyam_score INTEGER DEFAULT 100;",
        "ALTER TABLE honeypot_sessions ADD COLUMN customer_id VARCHAR;",
        "ALTER TABLE honeypot_sessions ADD COLUMN user_id INTEGER;",
        "ALTER TABLE honeypot_sessions ADD COLUMN recording_analysis_json JSON;",
        "ALTER TABLE honeypot_sessions ADD COLUMN direction VARCHAR DEFAULT 'outgoing';",
        "ALTER TABLE honeypot_sessions ADD COLUMN handoff_timestamp TIMESTAMP;",
        "ALTER TABLE honeypot_sessions ADD COLUMN metadata_json JSON;",
        "ALTER TABLE scam_clusters ADD COLUMN lat FLOAT;",
        "ALTER TABLE scam_clusters ADD COLUMN lng FLOAT;"
    ]

    try:
        url_str = str(engine.url)
        if "postgresql" in url_str:
            for q in queries_pg:
                try:
                    db.execute(text(q))
                    db.commit()
                except Exception as e:
                    db.rollback()
                    print(f"[SCHEMA] PostgreSQL schema patch warning for '{q}': {e}")
            print("[SCHEMA] PostgreSQL column checks complete.")
            
        elif "sqlite" in url_str:
            for q in queries_sqlite:
                try:
                    db.execute(text(q))
                    db.commit()
                except Exception as e:
                    db.rollback()
            print("[SCHEMA] SQLite column checks complete.")
            
    except Exception as e:
        print(f"[SCHEMA] Fatal Migration error: {e}")
    finally:
        db.close()
