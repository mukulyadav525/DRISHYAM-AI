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
    try:
        # 1. Add customer_id to honeypot_sessions if missing
        if "postgresql" in str(engine.url):
            db.execute(text("ALTER TABLE honeypot_sessions ADD COLUMN IF NOT EXISTS customer_id VARCHAR;"))
            db.commit()
            print("[SCHEMA] Column 'customer_id' verified/added to honeypot_sessions.")
        elif "sqlite" in str(engine.url):
            # SQLite doesn't support IF NOT EXISTS in ALTER TABLE well, so we check first
            try:
                db.execute(text("SELECT customer_id FROM honeypot_sessions LIMIT 1;"))
            except Exception:
                db.execute(text("ALTER TABLE honeypot_sessions ADD COLUMN customer_id VARCHAR;"))
                db.commit()
                print("[SCHEMA] Column 'customer_id' added to honeypot_sessions (SQLite).")
    except Exception as e:
        print(f"[SCHEMA] Migration warning: {e}")
        db.rollback()
    finally:
        db.close()
