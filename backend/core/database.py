from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.config import settings

# Connect args required for SQLite to handle multi-threaded requests
db_uri = settings.SQLALCHEMY_DATABASE_URI
if db_uri.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {"connect_timeout": 10}

engine = create_engine(db_uri, connect_args=connect_args)
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
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS customer_id VARCHAR;",
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS handoff_timestamp TIMESTAMP;",
        "ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS metadata_json JSON;",
        "ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;",
        "ALTER TABLE scam_clusters ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;"
    ]
    
    queries_sqlite = [
        "ALTER TABLE honeypot_sessions ADD COLUMN customer_id VARCHAR;",
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
